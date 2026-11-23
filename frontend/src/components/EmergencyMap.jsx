import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  Navigation,
  Play,
  Pause,
  RotateCcw,
  Gauge,
  Clock,
  Radio,
  Zap,
  Volume2,
  VolumeX,
} from "lucide-react";
import { playEmergencyAlert, playDispatchChime } from "../utils/sound";
import { formatAiConfidence } from "../utils/confidence";
import { sernApi } from "../services/api";

// Smooth map recenter / follow vehicle helper
function MapController({ center, zoom, followVehicle, vehiclePos }) {
  const map = useMap();

  useEffect(() => {
    if (followVehicle && vehiclePos && vehiclePos[0] && vehiclePos[1]) {
      map.panTo(vehiclePos, { animate: true, duration: 0.5 });
    } else if (center && center[0] && center[1]) {
      map.setView(center, zoom || 13, { animate: true });
    }
  }, [center, zoom, followVehicle, vehiclePos, map]);

  return null;
}

// Calculate compass bearing between two GPS coordinates
function calculateBearing(startLat, startLng, destLat, destLng) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const φ1 = toRad(startLat);
  const φ2 = toRad(destLat);
  const Δλ = toRad(destLng - startLng);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

// Haversine distance in meters
function distanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function EmergencyMap({
  ambulances = [],
  accidents = [],
  hospitals = [],
  selectedRoute = null,
  activeCenter = [12.9716, 77.5946],
  onSelectAccident = null,
  onSelectAmbulance = null,
  onEmergencyArrived = null,
}) {
  const defaultCenter = activeCenter || [12.9716, 77.5946];

  // Live Navigation State
  const [isNavigating, setIsNavigating] = useState(false);
  const [navProgress, setNavProgress] = useState(0); // 0.0 to 1.0
  const [speedMultiplier, setSpeedMultiplier] = useState(2); // 1x, 2x, 4x
  const [followVehicle, setFollowVehicle] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [telemetry, setTelemetry] = useState({
    speedKmh: 0,
    headingDeg: 0,
    remainingKm: 0,
    etaSec: 0,
    currentStep: "En route to scene",
  });

  const lastTelemetrySendRef = useRef(0);
  const animationFrameRef = useRef(null);
  const lastTickTimeRef = useRef(null);
  const loadedRouteIdRef = useRef(null);
  const hasPlayedSirenRef = useRef(false);

  // Convert Route GeoJSON LineString coordinates ([lon, lat]) to Leaflet ([lat, lon])
  const routePoints = useMemo(() => {
    if (!selectedRoute || !selectedRoute.route_geometry) return [];
    try {
      const geom =
        typeof selectedRoute.route_geometry === "string"
          ? JSON.parse(selectedRoute.route_geometry)
          : selectedRoute.route_geometry;

      if (geom.type === "LineString" && Array.isArray(geom.coordinates)) {
        return geom.coordinates.map((coord) => [coord[1], coord[0]]);
      }
    } catch (e) {
      console.warn("Failed to parse route geometry:", e);
    }
    return [];
  }, [selectedRoute]);

  // Compute total route length in meters and segment distances
  const routeMetrics = useMemo(() => {
    if (routePoints.length < 2) return { totalDist: 0, segments: [] };
    let total = 0;
    const segs = [];
    for (let i = 0; i < routePoints.length - 1; i++) {
      const p1 = routePoints[i];
      const p2 = routePoints[i + 1];
      const dist = distanceInMeters(p1[0], p1[1], p2[0], p2[1]);
      segs.push({
        from: p1,
        to: p2,
        dist,
        bearing: calculateBearing(p1[0], p1[1], p2[0], p2[1]),
        startDist: total,
        endDist: total + dist,
      });
      total += dist;
    }
    return { totalDist: total, segments: segs };
  }, [routePoints]);

  // Active Dispatched Ambulance associated with active emergency
  const activeDispatchedAmb = useMemo(() => {
    return (
      ambulances.find(
        (a) =>
          a.status === "ASSIGNED" ||
          a.status === "DISPATCHED" ||
          a.status === "EN_ROUTE"
      ) || null
    );
  }, [ambulances]);

  // Auto-start live GPS navigation whenever a NEW route is loaded
  useEffect(() => {
    const routeId = selectedRoute?.id || selectedRoute?.emergency_id;
    if (routeId && routeId !== loadedRouteIdRef.current && routePoints.length >= 2) {
      loadedRouteIdRef.current = routeId;
      hasPlayedSirenRef.current = false;
      const timer = setTimeout(() => {
        setIsNavigating(true);
        setNavProgress(0);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedRoute, routePoints.length]);

  // Compute Current Animated Vehicle Coordinates along the Polyline
  const vehicleState = useMemo(() => {
    if (routePoints.length < 2) {
      if (activeDispatchedAmb) {
        return {
          pos: [activeDispatchedAmb.latitude, activeDispatchedAmb.longitude],
          bearing: 0,
          traveledPoints: [],
          remainingPoints: [],
        };
      }
      return null;
    }

    const targetDistance = navProgress * routeMetrics.totalDist;
    const segs = routeMetrics.segments;

    let currentSeg = segs[0];
    for (let i = 0; i < segs.length; i++) {
      if (targetDistance <= segs[i].endDist || i === segs.length - 1) {
        currentSeg = segs[i];
        break;
      }
    }

    const segRatio =
      currentSeg.dist > 0
        ? Math.max(0, Math.min(1, (targetDistance - currentSeg.startDist) / currentSeg.dist))
        : 0;

    const lat = currentSeg.from[0] + (currentSeg.to[0] - currentSeg.from[0]) * segRatio;
    const lon = currentSeg.from[1] + (currentSeg.to[1] - currentSeg.from[1]) * segRatio;

    // Split points into traveled vs ahead
    const segIdx = segs.indexOf(currentSeg);
    const traveledPoints = [...routePoints.slice(0, segIdx + 1), [lat, lon]];
    const remainingPoints = [[lat, lon], ...routePoints.slice(segIdx + 1)];

    return {
      pos: [lat, lon],
      bearing: currentSeg.bearing,
      traveledPoints,
      remainingPoints,
    };
  }, [routePoints, navProgress, routeMetrics, activeDispatchedAmb]);

  // Handle Arrival at Incident Destination
  const handleDestinationArrival = useCallback(() => {
    setIsNavigating(false);
    setNavProgress(1.0);
    if (soundEnabled) {
      playDispatchChime();
    }
    setTelemetry((prev) => ({
      ...prev,
      speedKmh: 0,
      remainingKm: 0,
      etaSec: 0,
      currentStep: "Arrived at Emergency Scene (Unit On Site)",
    }));

    if (activeDispatchedAmb) {
      sernApi.streamAmbulanceTelemetry(activeDispatchedAmb.id, {
        latitude: routePoints[routePoints.length - 1][0],
        longitude: routePoints[routePoints.length - 1][1],
        speed_kmh: 0,
        heading_deg: 0,
        distance_remaining_km: 0,
        eta_seconds: 0,
        status: "AT_SCENE",
      }).catch((e) => console.debug("Arrival telemetry sync error:", e));
    }

    if (onEmergencyArrived && selectedRoute) {
      onEmergencyArrived(selectedRoute.emergency_id);
    }
  }, [soundEnabled, activeDispatchedAmb, routePoints, onEmergencyArrived, selectedRoute]);

  // Turn-by-Turn GPS Animation Loop
  useEffect(() => {
    if (!isNavigating || routeMetrics.totalDist === 0) {
      lastTickTimeRef.current = null;
      return;
    }

    // Play siren sound on start once if enabled
    if (soundEnabled && !hasPlayedSirenRef.current) {
      hasPlayedSirenRef.current = true;
      playEmergencyAlert();
    }

    const stepSimulation = (timestamp) => {
      if (!lastTickTimeRef.current) lastTickTimeRef.current = timestamp;
      const deltaTime = (timestamp - lastTickTimeRef.current) / 1000;
      lastTickTimeRef.current = timestamp;

      // Base speed ~55 km/h (15.27 m/s) modulated by multiplier
      const speedMs = 15.27 * speedMultiplier;
      const distIncrement = speedMs * deltaTime;
      const progressIncrement = distIncrement / routeMetrics.totalDist;

      setNavProgress((prev) => {
        const next = prev + progressIncrement;
        if (next >= 1.0) {
          handleDestinationArrival();
          return 1.0;
        }

        // Calculate live telemetry HUD stats
        const remainingM = (1.0 - next) * routeMetrics.totalDist;
        const remainingKm = Math.max(0, +(remainingM / 1000).toFixed(2));
        const currentSpeedKmh = Math.round(55 + Math.sin(next * 20) * 8);
        const etaSec = Math.round(remainingM / (currentSpeedKmh * (1000 / 3600)));

        let stepText;
        if (next < 0.25) stepText = "Turn onto arterial connector (Siren Active)";
        else if (next < 0.7) stepText = "Fast-track signal priority corridor";
        else if (next < 0.95) stepText = "Prepare for incident site approach";
        else stepText = "Final approach to emergency scene";

        setTelemetry({
          speedKmh: currentSpeedKmh,
          headingDeg: Math.round(vehicleState?.bearing || 0),
          remainingKm,
          etaSec,
          currentStep: stepText,
        });

        // Sync backend location & WebSocket clients every 1.5 seconds
        const now = Date.now();
        if (activeDispatchedAmb && vehicleState && now - lastTelemetrySendRef.current > 1500) {
          lastTelemetrySendRef.current = now;
          sernApi.streamAmbulanceTelemetry(activeDispatchedAmb.id, {
            latitude: vehicleState.pos[0],
            longitude: vehicleState.pos[1],
            speed_kmh: currentSpeedKmh,
            heading_deg: Math.round(vehicleState.bearing),
            distance_remaining_km: remainingKm,
            eta_seconds: etaSec,
            status: "EN_ROUTE",
          }).catch(() => {});
        }

        return next;
      });

      animationFrameRef.current = requestAnimationFrame(stepSimulation);
    };

    animationFrameRef.current = requestAnimationFrame(stepSimulation);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    isNavigating,
    routeMetrics.totalDist,
    speedMultiplier,
    soundEnabled,
    navProgress,
    handleDestinationArrival,
    activeDispatchedAmb,
    vehicleState,
  ]);

  // Custom DivIcons
  const createPinIcon = (color, symbol, pulse = false) => {
    return L.divIcon({
      className: "",
      html: `
        <div style="
          position: relative;
          width: 30px;
          height: 30px;
          background: ${color};
          border: 2px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 13px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.5);
          ${pulse ? "animation: map-pulse 1.5s infinite;" : ""}
        ">
          ${symbol || ""}
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15],
    });
  };

  // High-fidelity Rotating Ambulance Icon with Beacon
  const createAmbulanceIcon = (bearing = 0, isLiveAnimated = false) => {
    return L.divIcon({
      className: "",
      html: `
        <div style="
          position: relative;
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(${bearing}deg);
          transition: transform 0.15s ease-out;
        ">
          ${isLiveAnimated ? `
            <div style="
              position: absolute;
              width: 48px;
              height: 48px;
              border-radius: 50%;
              background: rgba(6, 182, 212, 0.25);
              animation: map-pulse 1.2s infinite;
            "></div>
          ` : ""}
          <div style="
            position: relative;
            width: 32px;
            height: 32px;
            background: #ef4444;
            border: 2px solid white;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.6);
            color: white;
            font-size: 16px;
          ">
            🚑
            <div style="
              position: absolute;
              top: -4px;
              right: -4px;
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: #38bdf8;
              box-shadow: 0 0 8px #38bdf8;
              animation: beacon-blink 0.6s infinite alternate;
            "></div>
          </div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
      popupAnchor: [0, -19],
    });
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "400px", borderRadius: "12px", overflow: "hidden" }}>
      {/* Top Banner when a unit is en-route but route is not yet open on map */}
      {!selectedRoute && activeDispatchedAmb && (
        <div
          style={{
            position: "absolute",
            top: "12px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "rgba(15, 23, 42, 0.94)",
            backdropFilter: "blur(8px)",
            border: "1px solid #f59e0b",
            borderRadius: "8px",
            padding: "8px 16px",
            color: "white",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
          }}
        >
          <span style={{ fontSize: "12px", color: "#facc15", fontWeight: "bold" }}>
            🚨 Unit {activeDispatchedAmb.registration_number} is {activeDispatchedAmb.status}
          </span>
          <button
            onClick={() => onSelectAmbulance && onSelectAmbulance(activeDispatchedAmb)}
            style={{
              padding: "5px 10px",
              background: "#0284c7",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Load Route & Start GPS →
          </button>
        </div>
      )}

      {/* LIVE GPS TURN-BY-TURN TELEMETRY HUD OVERLAY */}
      {selectedRoute && routePoints.length >= 2 && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            zIndex: 1000,
            background: "rgba(15, 23, 42, 0.88)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            borderRadius: "10px",
            padding: "10px 14px",
            color: "white",
            minWidth: "270px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Radio size={14} color="#38bdf8" style={{ animation: isNavigating ? "map-pulse 1s infinite" : "none" }} />
              <strong style={{ fontSize: "12px", color: "#38bdf8", letterSpacing: "0.5px" }}>
                LIVE GPS TELEMETRY
              </strong>
            </div>
            <span
              style={{
                fontSize: "10px",
                padding: "2px 6px",
                borderRadius: "4px",
                background: isNavigating ? "#065f46" : "#334155",
                color: isNavigating ? "#34d399" : "#94a3b8",
                fontWeight: "bold",
              }}
            >
              {isNavigating ? "NAVIGATING" : navProgress >= 1.0 ? "ARRIVED" : "STANDBY"}
            </span>
          </div>

          {/* Real-Time Metrics Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "8px" }}>
            <div style={{ background: "rgba(30, 41, 59, 0.7)", padding: "6px", borderRadius: "6px", textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "3px", color: "#94a3b8", fontSize: "10px" }}>
                <Gauge size={11} /> SPEED
              </div>
              <div style={{ fontSize: "13px", fontWeight: "bold", color: "#38bdf8" }}>
                {telemetry.speedKmh} <span style={{ fontSize: "9px" }}>km/h</span>
              </div>
            </div>

            <div style={{ background: "rgba(30, 41, 59, 0.7)", padding: "6px", borderRadius: "6px", textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "3px", color: "#94a3b8", fontSize: "10px" }}>
                <Navigation size={11} /> REMAINING
              </div>
              <div style={{ fontSize: "13px", fontWeight: "bold", color: "#facc15" }}>
                {telemetry.remainingKm || (selectedRoute?.distance_km || 0)} <span style={{ fontSize: "9px" }}>km</span>
              </div>
            </div>

            <div style={{ background: "rgba(30, 41, 59, 0.7)", padding: "6px", borderRadius: "6px", textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "3px", color: "#94a3b8", fontSize: "10px" }}>
                <Clock size={11} /> ETA
              </div>
              <div style={{ fontSize: "13px", fontWeight: "bold", color: "#4ade80" }}>
                {telemetry.etaSec > 0 ? `${Math.floor(telemetry.etaSec / 60)}m ${telemetry.etaSec % 60}s` : "0m"}
              </div>
            </div>
          </div>

          {/* Turn Guidance */}
          <div style={{ fontSize: "11px", color: "#cbd5e1", marginBottom: "8px", display: "flex", alignItems: "center", gap: "5px" }}>
            <Zap size={12} color="#f59e0b" />
            <span>{telemetry.currentStep}</span>
          </div>

          {/* Progress Bar */}
          <div style={{ width: "100%", height: "4px", background: "#334155", borderRadius: "2px", overflow: "hidden", marginBottom: "10px" }}>
            <div
              style={{
                width: `${Math.round(navProgress * 100)}%`,
                height: "100%",
                background: "linear-gradient(90deg, #06b6d4, #10b981)",
                transition: "width 0.1s linear",
              }}
            />
          </div>

          {/* Interactive Controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
            <button
              onClick={() => {
                if (navProgress >= 1.0) {
                  hasPlayedSirenRef.current = false;
                  setNavProgress(0);
                  setIsNavigating(true);
                } else {
                  setIsNavigating((prev) => !prev);
                }
              }}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                padding: "6px 10px",
                background: isNavigating ? "#dc2626" : "#0284c7",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              {isNavigating ? <Pause size={13} /> : <Play size={13} />}
              {isNavigating ? "Pause" : navProgress >= 1.0 ? "Re-Run Navigation" : "Resume GPS"}
            </button>

            <button
              onClick={() => {
                setIsNavigating(false);
                setNavProgress(0);
                hasPlayedSirenRef.current = false;
              }}
              title="Reset Route Position"
              style={{
                padding: "6px 8px",
                background: "rgba(51, 65, 85, 0.8)",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              <RotateCcw size={13} />
            </button>

            <button
              onClick={() => setSpeedMultiplier((prev) => (prev === 1 ? 2 : prev === 2 ? 4 : 1))}
              title="Toggle Speed Multiplier"
              style={{
                padding: "6px 8px",
                background: "rgba(51, 65, 85, 0.8)",
                color: "#38bdf8",
                border: "none",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              {speedMultiplier}x
            </button>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title="Toggle Siren Sound"
              style={{
                padding: "6px 8px",
                background: "rgba(51, 65, 85, 0.8)",
                color: soundEnabled ? "#f43f5e" : "#64748b",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            </button>

            <button
              onClick={() => setFollowVehicle(!followVehicle)}
              title="Lock Camera on Vehicle"
              style={{
                padding: "6px 8px",
                background: followVehicle ? "rgba(14, 165, 233, 0.25)" : "rgba(51, 65, 85, 0.8)",
                color: followVehicle ? "#38bdf8" : "#94a3b8",
                border: "1px solid",
                borderColor: followVehicle ? "#38bdf8" : "transparent",
                borderRadius: "6px",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              Lock
            </button>
          </div>
        </div>
      )}

      <MapContainer
        center={defaultCenter}
        zoom={12}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", borderRadius: "12px" }}
      >
        <MapController
          center={defaultCenter}
          zoom={13}
          followVehicle={followVehicle && isNavigating}
          vehiclePos={vehicleState?.pos}
        />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* 1. Partner Hospitals */}
        {hospitals.map((hosp) => (
          <Marker
            key={`hosp-${hosp.id}`}
            position={[hosp.latitude, hosp.longitude]}
            icon={createPinIcon("#10b981", "H")}
          >
            <Popup>
              <div style={{ minWidth: "180px", color: "#0f172a" }}>
                <strong style={{ fontSize: "14px", color: "#059669" }}>{hosp.name}</strong>
                <p style={{ margin: "4px 0", fontSize: "12px", color: "#475569" }}>{hosp.address}</p>
                <div style={{ fontSize: "11px", marginTop: "4px" }}>
                  <strong>Contact:</strong> {hosp.contact_information}
                </div>
                <div style={{ marginTop: "6px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: "#d1fae5",
                      color: "#065f46",
                      fontSize: "11px",
                      fontWeight: "600",
                    }}
                  >
                    Active Trauma Center
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* 2. Registered Ambulances (Stationary / Idle) */}
        {ambulances.map((amb) => {
          // If this ambulance is currently being animated along route, skip rendering its static marker
          if (activeDispatchedAmb && amb.id === activeDispatchedAmb.id && vehicleState && routePoints.length >= 2) {
            return null;
          }

          const isAvail = amb.status === "AVAILABLE";
          const isBusy = ["ASSIGNED", "DISPATCHED", "EN_ROUTE"].includes(amb.status);
          const color = isAvail ? "#3b82f6" : isBusy ? "#f59e0b" : "#8b5cf6";

          return (
            <Marker
              key={`amb-${amb.id}`}
              position={[amb.latitude, amb.longitude]}
              icon={createPinIcon(color, "🚑")}
              eventHandlers={{
                click: () => onSelectAmbulance && onSelectAmbulance(amb),
              }}
            >
              <Popup>
                <div style={{ minWidth: "160px", color: "#0f172a" }}>
                  <strong style={{ fontSize: "13px" }}>{amb.registration_number}</strong>
                  <div style={{ margin: "4px 0" }}>
                    Status:{" "}
                    <span
                      style={{
                        fontWeight: "bold",
                        color: isAvail ? "#16a34a" : isBusy ? "#d97706" : "#7c3aed",
                      }}
                    >
                      {amb.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                    Coords: {amb.latitude.toFixed(4)}, {amb.longitude.toFixed(4)}
                  </div>
                  {isBusy && onSelectAmbulance && (
                    <button
                      onClick={() => onSelectAmbulance(amb)}
                      style={{
                        marginTop: "8px",
                        width: "100%",
                        padding: "6px 8px",
                        background: "#0284c7",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        fontWeight: "bold",
                        fontSize: "11px",
                        cursor: "pointer",
                      }}
                    >
                      🚗 Track Route & Start GPS →
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* 3. Live Animated Dispatched Ambulance along Route */}
        {vehicleState && activeDispatchedAmb && routePoints.length >= 2 && (
          <Marker
            position={vehicleState.pos}
            icon={createAmbulanceIcon(vehicleState.bearing, isNavigating)}
            zIndexOffset={1000}
          >
            <Popup>
              <div style={{ minWidth: "180px", color: "#0f172a" }}>
                <strong style={{ fontSize: "13px", color: "#dc2626" }}>
                  🚑 {activeDispatchedAmb.registration_number} (LIVE GPS)
                </strong>
                <div style={{ margin: "4px 0", fontSize: "12px" }}>
                  Status: <strong>{isNavigating ? "EN_ROUTE (Active Navigation)" : activeDispatchedAmb.status}</strong>
                </div>
                <div style={{ fontSize: "11px", color: "#475569" }}>
                  Speed: <strong>{telemetry.speedKmh} km/h</strong> · Heading: {telemetry.headingDeg}°
                </div>
                <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>
                  Remaining: <strong>{telemetry.remainingKm} km</strong> (ETA {Math.round(telemetry.etaSec / 60)}m)
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* 4. Accidents & Emergencies */}
        {accidents.map((acc) => {
          const isPending = acc.validation_status === "PENDING";
          const isValidated = acc.validation_status === "VALIDATED";
          const isNormal = acc.validation_status === "NORMAL";

          if (isNormal) return null;

          const color = isPending ? "#ef4444" : isValidated ? "#dc2626" : "#6b7280";

          return (
            <Marker
              key={`acc-${acc.id}`}
              position={[acc.latitude, acc.longitude]}
              icon={createPinIcon(color, "⚠️", isPending)}
              eventHandlers={{
                click: () => onSelectAccident && onSelectAccident(acc),
              }}
            >
              <Popup>
                <div style={{ minWidth: "200px", color: "#0f172a" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ color: "#dc2626", fontSize: "14px" }}>Incident #{acc.id}</strong>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "10px",
                        fontWeight: "bold",
                        background: isPending ? "#fee2e2" : "#fef3c7",
                        color: isPending ? "#991b1b" : "#92400e",
                      }}
                    >
                      {acc.validation_status}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", margin: "6px 0 2px" }}>
                    <strong>AI Confidence:</strong>{" "}
                    <span style={{ color: formatAiConfidence(acc.accident_probability, acc.model_threshold).color, fontWeight: "bold" }}>
                      {formatAiConfidence(acc.accident_probability, acc.model_threshold).percentage}% ({formatAiConfidence(acc.accident_probability, acc.model_threshold).label})
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                    ML Threshold: {(acc.model_threshold * 100).toFixed(1)}% · Raw Model Score: {(acc.accident_probability * 100).toFixed(1)}%
                  </div>
                  {acc.validation_notes && (
                    <p style={{ fontSize: "11px", marginTop: "4px", fontStyle: "italic", color: "#475569" }}>
                      "{acc.validation_notes}"
                    </p>
                  )}
                  {isPending && onSelectAccident && (
                    <button
                      onClick={() => onSelectAccident(acc)}
                      style={{
                        marginTop: "8px",
                        width: "100%",
                        padding: "5px",
                        background: "#dc2626",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        fontWeight: "600",
                        fontSize: "11px",
                        cursor: "pointer",
                      }}
                    >
                      Review & Validate Emergency →
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* 5. Traveled Route Segment (Green Corridor) */}
        {vehicleState && vehicleState.traveledPoints.length >= 2 && (
          <Polyline
            positions={vehicleState.traveledPoints}
            color="#10b981"
            weight={6}
            opacity={0.9}
          />
        )}

        {/* 6. Remaining Route Ahead (Cyan Corridor) */}
        {vehicleState && vehicleState.remainingPoints.length >= 2 ? (
          <Polyline
            positions={vehicleState.remainingPoints}
            color="#06b6d4"
            weight={5}
            opacity={0.85}
            dashArray="8, 6"
          />
        ) : routePoints.length > 0 ? (
          <Polyline
            positions={routePoints}
            color="#06b6d4"
            weight={5}
            opacity={0.85}
            dashArray="8, 6"
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
