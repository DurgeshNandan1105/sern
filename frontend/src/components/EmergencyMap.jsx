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
  Crosshair,
  Sliders,
  CheckCircle2,
  ShieldAlert,
  Ambulance,
  Eye,
  EyeOff,
} from "lucide-react";
import { playEmergencyAlert, playDispatchChime } from "../utils/sound";
import { sernApi } from "../services/api";
import RouteComparisonPanel from "./RouteComparisonPanel";

// High-fidelity RNSIT Campus -> SPARSH Hospital RR Nagar Corridors (matching Image 1)
const RNSIT_RR_NAGAR_ROUTES = {
  CONGESTION_AWARE: {
    points: [
      [12.9015, 77.5192], // RNSIT Campus
      [12.9080, 77.5198], // Intersection #1 (Channasandra link)
      [12.9140, 77.5165], // Intersection #2 (80ft link)
      [12.9150, 77.5120], // Turn west to Kenchenahalli Main Rd
      [12.9220, 77.5122], // North along Kenchenahalli bypass
      [12.9260, 77.5130],
      [12.9285, 77.5140],
      [12.9285, 77.5180], // Intersection #3 (Srinivasaiah Rd)
      [12.9320, 77.5180],
      [12.9355, 77.5175]  // SPARSH Hospital RR Nagar
    ],
    distanceKm: 6.87,
    durationMin: 14.78,
    speedKmh: 27.9,
    delay: "No delay"
  },
  SHORTEST: {
    points: [
      [12.9015, 77.5192], // RNSIT Campus
      [12.9080, 77.5198], // Intersection #1 (Channasandra link)
      [12.9140, 77.5165], // Intersection #2 (80ft link)
      [12.9200, 77.5172], // Straight through 80 Feet Road (CONGESTED!)
      [12.9250, 77.5176],
      [12.9285, 77.5180], // Intersection #3 (Srinivasaiah Rd)
      [12.9320, 77.5180],
      [12.9355, 77.5175]  // SPARSH Hospital RR Nagar
    ],
    distanceKm: 5.29,
    durationMin: 19.82,
    speedKmh: 16.0,
    delay: "+7m 50s"
  },
  FASTEST: {
    points: [
      [12.9015, 77.5192], // RNSIT Campus
      [12.9080, 77.5198], // Intersection #1 (Channasandra link)
      [12.9140, 77.5165], // Intersection #2 (80ft link)
      [12.9200, 77.5172], // Straight through 80 Feet Road (CONGESTED!)
      [12.9250, 77.5176],
      [12.9285, 77.5180], // Intersection #3 (Srinivasaiah Rd)
      [12.9320, 77.5180],
      [12.9355, 77.5175]  // SPARSH Hospital RR Nagar
    ],
    distanceKm: 5.29,
    durationMin: 19.82,
    speedKmh: 16.0,
    delay: "+7m 50s"
  }
};

// Congested Road Section on 80 Feet Road (between Int #2 and Int #3)
const CONGESTED_80FT_ROAD_POINTS = [
  [12.9140, 77.5165],
  [12.9180, 77.5170],
  [12.9220, 77.5174],
  [12.9250, 77.5178],
  [12.9285, 77.5180]
];

// MapController for centering and smooth following
function MapController({ center, zoom, followVehicle, vehiclePos }) {
  const map = useMap();

  useEffect(() => {
    if (followVehicle && vehiclePos && vehiclePos[0] && vehiclePos[1]) {
      map.panTo(vehiclePos, { animate: true, duration: 0.5 });
    } else if (center && center[0] && center[1]) {
      map.setView(center, zoom || 14, { animate: true });
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
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.cos(φ1) * Math.cos(Δλ);
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
  emergencies = [],
  hospitals = [],
  intersections = [],
  selectedRoute = null,
  activeCenter = [12.9180, 77.5160],
  onSelectAccident = null,
  onSelectAmbulance = null,
  onEmergencyArrived = null,
}) {
  // Route selection mode: "CONGESTION_AWARE" (default) | "SHORTEST" | "FASTEST"
  const [routeMode, setRouteMode] = useState("CONGESTION_AWARE");

  // Manual Preview Override (for demonstration / testing before an accident is created)
  const [manualPreviewActive, setManualPreviewActive] = useState(false);

  // Live Navigation State
  const [isNavigating, setIsNavigating] = useState(false);
  const [navProgress, setNavProgress] = useState(0); // 0.0 to 1.0
  const [speedMultiplier, setSpeedMultiplier] = useState(2); // 1x, 2x, 4x
  const [followVehicle, setFollowVehicle] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Manual Signal Overrides: { 1: boolean|null, 2: boolean|null, 3: boolean|null }
  const [manualSignalOverrides, setManualSignalOverrides] = useState({
    1: null,
    2: null,
    3: null,
  });

  const [telemetry, setTelemetry] = useState({
    speedKmh: 28,
    headingDeg: 0,
    remainingKm: 6.87,
    etaSec: 887,
    currentStep: "Fast-track Green Corridor Standby · Signals in RED HOLD State",
  });

  const lastTelemetrySendRef = useRef(0);
  const animationFrameRef = useRef(null);
  const lastTickTimeRef = useRef(null);
  const loadedRouteIdRef = useRef(null);
  const hasPlayedSirenRef = useRef(false);
  const lastPreemptRef = useRef({ 1: false, 2: false, 3: false });

  // 1. Identify Active Dispatched Ambulance
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

  // 2. Identify Pending / Active Accident Incident
  const activeAccident = useMemo(() => {
    if (accidents.length === 0) return null;
    return (
      accidents.find((a) => a.validation_status === "PENDING" || a.validation_status === "CONFIRMED") ||
      accidents[0]
    );
  }, [accidents]);

  // 3. Find Nearest Available Ambulance to Active Incident
  const nearestAmbulance = useMemo(() => {
    if (!activeAccident || ambulances.length === 0) return null;
    let nearest = null;
    let minDistance = Infinity;

    for (const amb of ambulances) {
      const isAvailOrDispatched = ["AVAILABLE", "ASSIGNED", "DISPATCHED", "EN_ROUTE"].includes(amb.status);
      if (isAvailOrDispatched) {
        const dist = distanceInMeters(amb.latitude, amb.longitude, activeAccident.latitude, activeAccident.longitude);
        if (dist < minDistance) {
          minDistance = dist;
          nearest = { ...amb, distanceMeters: dist, distanceKm: +(dist / 1000).toFixed(2) };
        }
      }
    }
    return nearest;
  }, [activeAccident, ambulances]);

  // 4. Critical Gate: Is an Ambulance Assigned / Active Route Dispatched?
  // User Requirement: "when some first login only map shown not any live red telemetry it will after assign the ambulance only show the ambulance on map and nearest ambulance on it"
  const isCorridorActive = useMemo(() => {
    const hasEmergencyRoute = Boolean(selectedRoute && (selectedRoute.route_geometry || selectedRoute.id));
    const hasActiveUnit = Boolean(activeDispatchedAmb);
    const hasActiveEmergencyInDb = emergencies.some((e) =>
      ["DISPATCHED", "ASSIGNED", "EN_ROUTE"].includes(e.status)
    );
    return hasEmergencyRoute || hasActiveUnit || hasActiveEmergencyInDb || manualPreviewActive;
  }, [selectedRoute, activeDispatchedAmb, emergencies, manualPreviewActive]);

  // Compute active route points based on selection
  const routePoints = useMemo(() => {
    if (!isCorridorActive) return [];

    if (RNSIT_RR_NAGAR_ROUTES[routeMode]) {
      return RNSIT_RR_NAGAR_ROUTES[routeMode].points;
    }
    if (!selectedRoute || !selectedRoute.route_geometry) {
      return RNSIT_RR_NAGAR_ROUTES.CONGESTION_AWARE.points;
    }
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
    return RNSIT_RR_NAGAR_ROUTES.CONGESTION_AWARE.points;
  }, [isCorridorActive, selectedRoute, routeMode]);

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

  // Auto-start or reset navigation when route changes
  useEffect(() => {
    if (!isCorridorActive) {
      loadedRouteIdRef.current = null;
      const t = setTimeout(() => {
        setIsNavigating(false);
        setNavProgress(0);
      }, 0);
      return () => clearTimeout(t);
    }

    const routeId = selectedRoute?.id || selectedRoute?.emergency_id || "RNSIT-CORRIDOR";
    if (routeId && routeId !== loadedRouteIdRef.current && routePoints.length >= 2) {
      loadedRouteIdRef.current = routeId;
      hasPlayedSirenRef.current = false;
      lastPreemptRef.current = { 1: false, 2: false, 3: false };
      const t = setTimeout(() => {
        setManualSignalOverrides({ 1: null, 2: null, 3: null });
        setNavProgress(0);
        setIsNavigating(true);
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isCorridorActive, selectedRoute, routePoints.length]);

  // Dynamic Red-to-Green Signal Clearance Computation:
  // Thresholds: #1 clears at 18%, #2 clears at 48%, #3 clears at 78% along route
  const isSignal1Cleared = manualSignalOverrides[1] !== null ? manualSignalOverrides[1] : navProgress >= 0.18;
  const isSignal2Cleared = manualSignalOverrides[2] !== null ? manualSignalOverrides[2] : navProgress >= 0.48;
  const isSignal3Cleared = manualSignalOverrides[3] !== null ? manualSignalOverrides[3] : navProgress >= 0.78;

  // Audio chimes on automatic state transitions (RED -> GREEN)
  useEffect(() => {
    if (!isNavigating) return;

    if (isSignal1Cleared && !lastPreemptRef.current[1]) {
      lastPreemptRef.current[1] = true;
      if (soundEnabled) playDispatchChime();
    }
    if (isSignal2Cleared && !lastPreemptRef.current[2]) {
      lastPreemptRef.current[2] = true;
      if (soundEnabled) playDispatchChime();
    }
    if (isSignal3Cleared && !lastPreemptRef.current[3]) {
      lastPreemptRef.current[3] = true;
      if (soundEnabled) playDispatchChime();
    }
  }, [isSignal1Cleared, isSignal2Cleared, isSignal3Cleared, isNavigating, soundEnabled]);

  // Compute Current Animated Vehicle Coordinates along Polyline
  const vehicleState = useMemo(() => {
    if (!isCorridorActive || routePoints.length < 2) return null;

    const targetDistance = navProgress * routeMetrics.totalDist;
    const segs = routeMetrics.segments;
    if (!segs || segs.length === 0) return null;

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

    const segIdx = segs.indexOf(currentSeg);
    const traveledPoints = [...routePoints.slice(0, segIdx + 1), [lat, lon]];
    const remainingPoints = [[lat, lon], ...routePoints.slice(segIdx + 1)];

    return {
      pos: [lat, lon],
      bearing: currentSeg.bearing,
      traveledPoints,
      remainingPoints,
    };
  }, [isCorridorActive, routePoints, navProgress, routeMetrics]);

  // Handle Arrival at Destination
  const handleDestinationArrival = useCallback(() => {
    setIsNavigating(false);
    setNavProgress(1.0);
    if (soundEnabled) playDispatchChime();

    setTelemetry((prev) => ({
      ...prev,
      speedKmh: 0,
      remainingKm: 0,
      etaSec: 0,
      currentStep: "Arrived at Destination: SPARSH Hospital RR Nagar (Unit On Site)",
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
      }).catch(() => {});
    }

    if (onEmergencyArrived && selectedRoute) {
      onEmergencyArrived(selectedRoute.emergency_id);
    }
  }, [soundEnabled, activeDispatchedAmb, routePoints, onEmergencyArrived, selectedRoute]);

  // Turn-by-Turn GPS Animation Loop:
  // Full trip duration calibrated to ~24 seconds at 1x (or ~12s at 2x) for optimal live demonstration
  useEffect(() => {
    if (!isNavigating || routeMetrics.totalDist === 0) {
      lastTickTimeRef.current = null;
      return;
    }

    if (soundEnabled && !hasPlayedSirenRef.current) {
      hasPlayedSirenRef.current = true;
      playEmergencyAlert();
    }

    const stepSimulation = (timestamp) => {
      if (!lastTickTimeRef.current) lastTickTimeRef.current = timestamp;
      const deltaTime = (timestamp - lastTickTimeRef.current) / 1000;
      lastTickTimeRef.current = timestamp;

      const fullTripSeconds = 24 / speedMultiplier;
      const progressIncrement = deltaTime / fullTripSeconds;

      setNavProgress((prev) => {
        const next = prev + progressIncrement;
        if (next >= 1.0) {
          handleDestinationArrival();
          return 1.0;
        }

        const remainingRatio = 1.0 - next;
        const totalDistanceKm = routeMode === "CONGESTION_AWARE" ? 6.87 : 5.29;
        const remainingKm = Math.max(0, +(remainingRatio * totalDistanceKm).toFixed(2));
        const baseSpeed = routeMode === "CONGESTION_AWARE" ? 28 : 16;
        const currentSpeedKmh = Math.round(baseSpeed + Math.sin(next * 20) * 3);
        const etaSec = Math.round((remainingKm / (currentSpeedKmh || 20)) * 3600);

        let stepText;
        if (next < 0.18) {
          stepText = "Approaching Signal #1: Cross-traffic holding RED";
        } else if (next < 0.48) {
          stepText = "Signal #1 CLEARED (RED ➔ GREEN). Detouring Kenchenahalli Main Rd";
        } else if (next < 0.78) {
          stepText = "Signal #2 CLEARED (RED ➔ GREEN). Bypassing 80ft Road Traffic Jam";
        } else if (next < 0.98) {
          stepText = "Signal #3 CLEARED (RED ➔ GREEN). Final approach to SPARSH RR Nagar Gate";
        } else {
          stepText = "Arrived at Destination: SPARSH Hospital RR Nagar";
        }

        setTelemetry({
          speedKmh: currentSpeedKmh,
          headingDeg: Math.round(vehicleState?.bearing || 0),
          remainingKm,
          etaSec,
          currentStep: stepText,
        });

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
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [
    isNavigating,
    routeMetrics.totalDist,
    speedMultiplier,
    soundEnabled,
    handleDestinationArrival,
    activeDispatchedAmb,
    vehicleState,
    routeMode,
  ]);

  // Toggle individual signal manually
  const toggleSignal = (signalNum) => {
    setManualSignalOverrides((prev) => {
      const current = signalNum === 1 ? isSignal1Cleared : signalNum === 2 ? isSignal2Cleared : isSignal3Cleared;
      const nextState = !current;
      if (nextState && soundEnabled) playDispatchChime();
      return {
        ...prev,
        [signalNum]: nextState,
      };
    });
  };

  // Preempt all signals (force all GREEN)
  const preemptAllSignals = () => {
    if (soundEnabled) playDispatchChime();
    setManualSignalOverrides({ 1: true, 2: true, 3: true });
  };

  // Reset all signals (force all RED HOLD)
  const resetAllSignals = () => {
    setManualSignalOverrides({ 1: false, 2: false, 3: false });
  };

  // Custom DivIcon for Corridor Signals (matching Image 1)
  const createCorridorSignalIcon = (num, isCleared) => {
    if (isCleared) {
      return L.divIcon({
        className: "",
        html: `
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 5px;
            background: #020617;
            border: 2px solid #06b6d4;
            border-radius: 6px;
            padding: 3px 8px;
            color: #38bdf8;
            font-weight: 800;
            font-size: 11px;
            box-shadow: 0 0 16px rgba(6, 182, 212, 0.7);
            letter-spacing: 0.5px;
            cursor: pointer;
            user-select: none;
          " title="Click to toggle Red / Green signal">
            <span style="
              display: inline-flex;
              align-items: center;
              justify-content: center;
              border: 1.5px solid #06b6d4;
              border-radius: 3px;
              width: 13px;
              height: 13px;
              font-size: 9px;
              color: #38bdf8;
              font-weight: 900;
            ">✓</span>
            #${num} CLR
          </div>
        `,
        iconSize: [72, 28],
        iconAnchor: [36, 14],
        popupAnchor: [0, -14],
      });
    } else {
      return L.divIcon({
        className: "",
        html: `
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 5px;
            background: #020617;
            border: 2px solid #ef4444;
            border-radius: 6px;
            padding: 3px 8px;
            color: #f87171;
            font-weight: 800;
            font-size: 11px;
            box-shadow: 0 0 14px rgba(239, 68, 68, 0.7);
            letter-spacing: 0.5px;
            cursor: pointer;
            user-select: none;
          " title="Click to toggle Red / Green signal">
            <span style="
              display: inline-block;
              width: 9px;
              height: 9px;
              border-radius: 50%;
              background: #ef4444;
              box-shadow: 0 0 8px #ef4444;
            "></span>
            #${num} HOLD
          </div>
        `,
        iconSize: [78, 28],
        iconAnchor: [39, 14],
        popupAnchor: [0, -14],
      });
    }
  };

  // Custom DivIcon for Start Point (S)
  const createStartMarkerIcon = () => {
    return L.divIcon({
      className: "",
      html: `
        <div style="
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #1e40af;
          border: 2.5px solid #60a5fa;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 900;
          font-size: 13px;
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.8);
        ">
          S
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15],
    });
  };

  // Custom DivIcon for RNSIT Campus Incident (matching Image 1)
  const createRnsitCampusIcon = () => {
    return L.divIcon({
      className: "",
      html: `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div style="
            position: relative;
            width: 36px;
            height: 36px;
            background: rgba(220, 38, 38, 0.25);
            border: 2px solid #ef4444;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 18px rgba(239, 68, 68, 0.7);
          ">
            <span style="font-size: 18px;">⚠️</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px; margin-top: 5px;">
            <span style="
              background: #1e3a8a;
              border: 1px solid #3b82f6;
              color: #bfdbfe;
              font-size: 10px;
              font-weight: 800;
              padding: 2px 6px;
              border-radius: 4px;
            ">RNS</span>
            <span style="
              background: #020617;
              border: 1px solid #334155;
              color: #f8fafc;
              font-size: 11px;
              font-weight: 700;
              padding: 2px 8px;
              border-radius: 6px;
              white-space: nowrap;
            ">RNSIT Campus</span>
          </div>
        </div>
      `,
      iconSize: [120, 60],
      iconAnchor: [60, 20],
      popupAnchor: [0, -25],
    });
  };

  // Custom DivIcon for SPARSH Hospital RR Nagar (matching Image 1)
  const createSparshHospitalIcon = () => {
    return L.divIcon({
      className: "",
      html: `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div style="
            width: 38px;
            height: 38px;
            background: #064e3b;
            border: 2px solid #10b981;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 16px rgba(16, 185, 129, 0.6);
          ">
            <span style="font-size: 20px;">🏥</span>
          </div>
          <div style="
            background: #020617;
            border: 1px solid #10b981;
            color: #34d399;
            font-size: 11px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 6px;
            margin-top: 5px;
            white-space: nowrap;
          ">
            SPARSH RR Nagar
          </div>
        </div>
      `,
      iconSize: [120, 60],
      iconAnchor: [60, 20],
      popupAnchor: [0, -25],
    });
  };

  // Custom DivIcon for Adichunchanagiri / BGS GIMS Hospital ([H] blue badge in Image 1)
  const createHospitalIconH = (name) => {
    return L.divIcon({
      className: "",
      html: `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div style="
            width: 30px;
            height: 30px;
            background: #1e3a8a;
            border: 2px solid #3b82f6;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 900;
            font-size: 14px;
            box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);
          ">
            H
          </div>
          <div style="
            background: #020617;
            border: 1px solid #334155;
            color: #cbd5e1;
            font-size: 10px;
            font-weight: 600;
            padding: 1px 6px;
            border-radius: 4px;
            margin-top: 3px;
            white-space: nowrap;
          ">
            ${name}
          </div>
        </div>
      `,
      iconSize: [120, 50],
      iconAnchor: [60, 15],
      popupAnchor: [0, -15],
    });
  };

  // Rotating Ambulance Icon with Beacon for Dispatched / Moving Unit
  const createAmbulanceIcon = (bearing = 0, isLiveAnimated = false, regNum = "KA-05-EM-7720") => {
    return L.divIcon({
      className: "",
      html: `
        <div style="
          position: relative;
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(${bearing}deg);
          transition: transform 0.15s ease-out;
        ">
          ${isLiveAnimated ? `
            <div style="
              position: absolute;
              width: 52px;
              height: 52px;
              border-radius: 50%;
              background: rgba(6, 182, 212, 0.35);
              animation: sernPulse 1s infinite;
            "></div>
          ` : ""}
          <div style="
            position: relative;
            width: 34px;
            height: 34px;
            background: #ef4444;
            border: 2px solid white;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 14px rgba(239, 68, 68, 0.7);
            color: white;
            font-size: 17px;
          ">
            🚑
            <div style="
              position: absolute;
              top: -4px;
              right: -4px;
              width: 9px;
              height: 9px;
              border-radius: 50%;
              background: #38bdf8;
              box-shadow: 0 0 8px #38bdf8;
            "></div>
          </div>
          <div style="
            position: absolute;
            bottom: -14px;
            background: #020617;
            border: 1px solid #38bdf8;
            color: #38bdf8;
            font-size: 9px;
            font-weight: 800;
            padding: 1px 4px;
            border-radius: 3px;
            white-space: nowrap;
            transform: rotate(-${bearing}deg);
          ">
            ${regNum}
          </div>
        </div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
      popupAnchor: [0, -21],
    });
  };

  // Available Standby Fleet Ambulance Icon
  const createStandbyAmbulanceIcon = (regNum, isNearest = false) => {
    return L.divIcon({
      className: "",
      html: `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div style="
            position: relative;
            width: 32px;
            height: 32px;
            background: ${isNearest ? "#0284c7" : "#1e3a8a"};
            border: 2px solid ${isNearest ? "#38bdf8" : "#60a5fa"};
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 16px;
            box-shadow: 0 0 ${isNearest ? "16px rgba(56, 189, 248, 0.8)" : "8px rgba(30, 58, 138, 0.6)"};
          ">
            🚑
            ${isNearest ? `
              <span style="
                position: absolute;
                top: -3px;
                right: -3px;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #10b981;
                box-shadow: 0 0 6px #10b981;
              "></span>
            ` : ""}
          </div>
          <div style="
            background: #020617;
            border: 1px solid ${isNearest ? "#38bdf8" : "#334155"};
            color: ${isNearest ? "#38bdf8" : "#bfdbfe"};
            font-size: 9px;
            font-weight: 800;
            padding: 1px 5px;
            border-radius: 4px;
            margin-top: 3px;
            white-space: nowrap;
          ">
            ${isNearest ? `★ ${regNum}` : regNum}
          </div>
        </div>
      `,
      iconSize: [90, 48],
      iconAnchor: [45, 16],
      popupAnchor: [0, -20],
    });
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* 1. MAP VIEW CANVAS */}
      <div style={{
        position: "relative",
        width: "100%",
        height: "540px",
        borderRadius: "14px",
        overflow: "hidden",
        border: "1px solid #1e293b",
        boxShadow: "0 8px 30px rgba(0,0,0,0.5)"
      }}>
        
        {/* A. STANDBY FLEET STATUS BAR (Rendered on First Login when No Ambulance is Dispatched) */}
        {!isCorridorActive && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: "14px",
              left: "60px",
              right: "14px",
              zIndex: 1000,
              background: "rgba(11, 19, 41, 0.92)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: "10px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
              color: "white"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "#10b981",
                boxShadow: "0 0 10px #10b981"
              }} />
              <div>
                <strong style={{ fontSize: "12px", color: "#f8fafc", display: "block" }}>
                  Fleet Standby & Live GPS Fleet Observer
                </strong>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                  {nearestAmbulance && activeAccident
                    ? `⚠️ Incident reported at RNSIT · Nearest ambulance: ${nearestAmbulance.registration_number} (${nearestAmbulance.distanceKm} km away)`
                    : `${ambulances.length || 6} Ambulances online · Standby for incident validation and dispatch`}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {activeAccident && (
                <button
                  onClick={() => {
                    if (onSelectAccident) onSelectAccident(activeAccident);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 12px",
                    background: "#2563eb",
                    border: "none",
                    borderRadius: "6px",
                    color: "white",
                    fontSize: "11px",
                    fontWeight: "bold",
                    cursor: "pointer"
                  }}
                >
                  <Ambulance size={13} />
                  Dispatch Nearest Unit
                </button>
              )}

              <button
                onClick={() => setManualPreviewActive(true)}
                title="Preview RNSIT Green Corridor Navigation"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 10px",
                  background: "rgba(6, 182, 212, 0.15)",
                  border: "1px solid #06b6d4",
                  borderRadius: "6px",
                  color: "#38bdf8",
                  fontSize: "11px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                <Eye size={13} />
                Preview Green Corridor
              </button>
            </div>
          </div>
        )}

        {/* B. LIVE GPS TELEMETRY & SMART SIGNAL CONTROL HUD OVERLAY (Shown ONLY After Ambulance Assignment) */}
        {isCorridorActive && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: "14px",
              right: "14px",
              zIndex: 1000,
              background: "rgba(11, 19, 41, 0.94)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              borderRadius: "12px",
              padding: "12px 16px",
              color: "white",
              minWidth: "320px",
              maxWidth: "360px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Radio size={14} color="#38bdf8" />
                <strong style={{ fontSize: "12px", color: "#38bdf8", letterSpacing: "0.5px" }}>
                  LIVE GPS TELEMETRY
                </strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    fontSize: "10px",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: isNavigating ? "#065f46" : navProgress >= 1.0 ? "#0284c7" : "#334155",
                    color: isNavigating ? "#34d399" : "#ffffff",
                    fontWeight: "bold",
                  }}
                >
                  {isNavigating ? "NAVIGATING" : navProgress >= 1.0 ? "ARRIVED" : "STANDBY"}
                </span>

                {manualPreviewActive && (
                  <button
                    onClick={() => {
                      setManualPreviewActive(false);
                      setIsNavigating(false);
                      setNavProgress(0);
                    }}
                    title="Close Preview & Return to Standby Map"
                    style={{
                      padding: "2px 6px",
                      background: "rgba(239, 68, 68, 0.2)",
                      border: "1px solid #ef4444",
                      borderRadius: "4px",
                      color: "#f87171",
                      fontSize: "10px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "3px"
                    }}
                  >
                    <EyeOff size={10} /> Exit
                  </button>
                )}
              </div>
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
                  {telemetry.remainingKm} <span style={{ fontSize: "9px" }}>km</span>
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

            {/* DYNAMIC RED-TO-GREEN TRAFFIC PREEMPTION STATUS BANNER */}
            <div style={{
              background: isSignal1Cleared && isSignal2Cleared && isSignal3Cleared
                ? "rgba(6, 78, 59, 0.6)"
                : isSignal1Cleared
                ? "rgba(14, 116, 144, 0.5)"
                : "rgba(153, 27, 27, 0.5)",
              border: `1px solid ${
                isSignal1Cleared && isSignal2Cleared && isSignal3Cleared
                  ? "rgba(16, 185, 129, 0.6)"
                  : isSignal1Cleared
                  ? "rgba(56, 189, 248, 0.6)"
                  : "rgba(239, 68, 68, 0.6)"
              }`,
              borderRadius: "6px",
              padding: "6px 10px",
              fontSize: "11px",
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <span style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                color: isSignal1Cleared ? "#38bdf8" : "#f87171",
                fontWeight: "700"
              }}>
                <span style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: isSignal1Cleared ? "#10b981" : "#ef4444",
                  boxShadow: isSignal1Cleared ? "0 0 8px #10b981" : "0 0 6px #ef4444",
                }} />
                {isSignal1Cleared && isSignal2Cleared && isSignal3Cleared
                  ? "All 3 Signals Cleared (Green Corridor)"
                  : isSignal2Cleared
                  ? "Signals #1 & #2 CLEARED (RED ➔ GREEN)"
                  : isSignal1Cleared
                  ? "Signal #1 CLEARED (RED ➔ GREEN)"
                  : "Signals in RED HOLD (Standby)"}
              </span>

              <span style={{
                fontSize: "10px",
                color: isSignal1Cleared ? "#38bdf8" : "#fca5a5",
                fontWeight: "800",
                background: isSignal1Cleared ? "rgba(6, 182, 212, 0.25)" : "rgba(239, 68, 68, 0.25)",
                padding: "2px 6px",
                borderRadius: "4px"
              }}>
                {isSignal1Cleared ? "GREEN LOCK" : "RED HOLD"}
              </span>
            </div>

            {/* TURN GUIDANCE TEXT */}
            <div style={{ fontSize: "11px", color: "#cbd5e1", marginBottom: "8px", display: "flex", alignItems: "center", gap: "5px" }}>
              <Zap size={12} color="#f59e0b" />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {telemetry.currentStep}
              </span>
            </div>

            {/* INTERACTIVE ROUTE PROGRESS SCRUBBER SLIDER */}
            <div style={{ marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", color: "#94a3b8", marginBottom: "3px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                  <Sliders size={10} /> Scrub Route & Signals
                </span>
                <span>{Math.round(navProgress * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(navProgress * 100)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) / 100;
                  setNavProgress(val);
                  setManualSignalOverrides({ 1: null, 2: null, 3: null });
                  if (val >= 1.0) handleDestinationArrival();
                }}
                style={{
                  width: "100%",
                  accentColor: "#06b6d4",
                  cursor: "pointer",
                  height: "6px",
                  borderRadius: "3px",
                }}
              />
            </div>

            {/* INDIVIDUAL SIGNAL QUICK TOGGLE BUTTONS */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "5px",
              marginBottom: "10px"
            }}>
              <button
                onClick={() => toggleSignal(1)}
                style={{
                  padding: "4px 2px",
                  background: isSignal1Cleared ? "rgba(6, 182, 212, 0.25)" : "rgba(239, 68, 68, 0.2)",
                  border: `1px solid ${isSignal1Cleared ? "#06b6d4" : "#ef4444"}`,
                  borderRadius: "4px",
                  color: isSignal1Cleared ? "#38bdf8" : "#f87171",
                  fontSize: "10px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
                title="Click to toggle Signal #1 between Red and Green"
              >
                #1 {isSignal1Cleared ? "🟢 CLR" : "🔴 HOLD"}
              </button>

              <button
                onClick={() => toggleSignal(2)}
                style={{
                  padding: "4px 2px",
                  background: isSignal2Cleared ? "rgba(6, 182, 212, 0.25)" : "rgba(239, 68, 68, 0.2)",
                  border: `1px solid ${isSignal2Cleared ? "#06b6d4" : "#ef4444"}`,
                  borderRadius: "4px",
                  color: isSignal2Cleared ? "#38bdf8" : "#f87171",
                  fontSize: "10px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
                title="Click to toggle Signal #2 between Red and Green"
              >
                #2 {isSignal2Cleared ? "🟢 CLR" : "🔴 HOLD"}
              </button>

              <button
                onClick={() => toggleSignal(3)}
                style={{
                  padding: "4px 2px",
                  background: isSignal3Cleared ? "rgba(6, 182, 212, 0.25)" : "rgba(239, 68, 68, 0.2)",
                  border: `1px solid ${isSignal3Cleared ? "#06b6d4" : "#ef4444"}`,
                  borderRadius: "4px",
                  color: isSignal3Cleared ? "#38bdf8" : "#f87171",
                  fontSize: "10px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
                title="Click to toggle Signal #3 between Red and Green"
              >
                #3 {isSignal3Cleared ? "🟢 CLR" : "🔴 HOLD"}
              </button>
            </div>

            {/* MAIN INTERACTIVE SIMULATION CONTROLS */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
              <button
                onClick={() => {
                  if (navProgress >= 1.0) {
                    hasPlayedSirenRef.current = false;
                    setNavProgress(0);
                    setManualSignalOverrides({ 1: null, 2: null, 3: null });
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
                  padding: "7px 10px",
                  background: isNavigating ? "#dc2626" : "#0284c7",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                {isNavigating ? <Pause size={12} /> : <Play size={12} />}
                {isNavigating ? "Pause" : navProgress >= 1.0 ? "Re-run" : "Simulate Run"}
              </button>

              <button
                onClick={() => {
                  if (isSignal1Cleared && isSignal2Cleared && isSignal3Cleared) {
                    resetAllSignals();
                  } else {
                    preemptAllSignals();
                  }
                }}
                title="Clear All Corridor Signals (Red ➔ Green)"
                style={{
                  padding: "7px 9px",
                  background: "rgba(16, 185, 129, 0.25)",
                  border: "1px solid #10b981",
                  color: "#34d399",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <CheckCircle2 size={12} />
                {isSignal1Cleared && isSignal2Cleared && isSignal3Cleared ? "Hold" : "Preempt"}
              </button>

              <button
                onClick={() => {
                  setNavProgress(0);
                  setIsNavigating(false);
                  hasPlayedSirenRef.current = false;
                  lastPreemptRef.current = { 1: false, 2: false, 3: false };
                  setManualSignalOverrides({ 1: null, 2: null, 3: null });
                }}
                title="Reset progress to zero"
                style={{
                  padding: "7px",
                  background: "#334155",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                <RotateCcw size={12} />
              </button>

              <button
                onClick={() => setSpeedMultiplier((prev) => (prev === 1 ? 2 : prev === 2 ? 4 : 1))}
                title="Toggle Simulation Speed (1x, 2x, 4x)"
                style={{
                  padding: "5px 8px",
                  background: "#1e293b",
                  border: "1px solid #475569",
                  color: "#38bdf8",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                {speedMultiplier}x
              </button>

              <button
                onClick={() => setFollowVehicle((prev) => !prev)}
                title={followVehicle ? "Following Vehicle (Auto-center)" : "Free Map Pan"}
                style={{
                  padding: "7px",
                  background: followVehicle ? "#0284c7" : "#334155",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                <Crosshair size={12} />
              </button>

              <button
                onClick={() => setSoundEnabled((prev) => !prev)}
                title={soundEnabled ? "Mute Siren & Chimes" : "Enable Siren & Chimes"}
                style={{
                  padding: "7px",
                  background: soundEnabled ? "#0284c7" : "#334155",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
              </button>
            </div>
          </div>
        )}

        {/* C. LEAFLET MAP CONTAINER WITH OPENSTREETMAP TILES (100% Free, No Watermark, No API Key Required) */}
        <MapContainer
          center={activeCenter || [12.9180, 77.5160]}
          zoom={14}
          style={{ width: "100%", height: "100%" }}
          scrollWheelZoom={true}
        >
          <MapController
            center={activeCenter || [12.9180, 77.5160]}
            zoom={14}
            followVehicle={followVehicle}
            vehiclePos={vehicleState?.pos}
          />

          {/* Standard OpenStreetMap Tiles (Styled Dark via CSS, zero third-party API key requirement) */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* === 1. CORRIDOR & INCIDENT OVERLAYS (Active when an Emergency / Ambulance is Dispatched) === */}
          {isCorridorActive && (
            <>
              {/* Origin Incident Marker: RNSIT Campus (matching Image 1) */}
              <Marker
                position={[12.9015, 77.5192]}
                icon={createRnsitCampusIcon()}
                eventHandlers={{
                  click: () => {
                    if (onSelectAccident && accidents.length > 0) {
                      onSelectAccident(accidents[0]);
                    }
                  }
                }}
              >
                <Popup>
                  <div style={{ color: "#0f172a", minWidth: "180px" }}>
                    <strong style={{ color: "#dc2626", fontSize: "14px" }}>RNSIT Campus Incident</strong>
                    <p style={{ margin: "4px 0", fontSize: "12px" }}>Location: Dr. Vishnuvardhan Rd, RR Nagar</p>
                    <div style={{ fontSize: "11px", color: "#16a34a", fontWeight: "bold" }}>● Severe Collision Confirmed</div>
                  </div>
                </Popup>
              </Marker>

              {/* Starting Ambulance Depot Marker (S) near RNSIT (matching Image 1) */}
              <Marker
                position={[12.9050, 77.5215]}
                icon={createStartMarkerIcon()}
              >
                <Popup>
                  <div style={{ color: "#0f172a", minWidth: "160px" }}>
                    <strong>Ambulance Base (S)</strong>
                    <p style={{ margin: "4px 0", fontSize: "12px" }}>KA-05-EM-7720 (RR Nagar Unit)</p>
                    <span style={{ color: "#2563eb", fontWeight: "bold", fontSize: "11px" }}>Assigned to Corridor</span>
                  </div>
                </Popup>
              </Marker>

              {/* Destination Hospital Marker: SPARSH Hospital RR Nagar (matching Image 1) */}
              <Marker
                position={[12.9355, 77.5175]}
                icon={createSparshHospitalIcon()}
              >
                <Popup>
                  <div style={{ color: "#0f172a", minWidth: "180px" }}>
                    <strong style={{ color: "#15803d", fontSize: "14px" }}>SPARSH Hospital RR Nagar</strong>
                    <p style={{ margin: "4px 0", fontSize: "12px" }}>Rajarajeshwari Nagar Trauma Centre</p>
                    <span style={{ fontSize: "11px", color: "#2563eb", fontWeight: "bold" }}>Direct Trauma Link Ready</span>
                  </div>
                </Popup>
              </Marker>

              {/* Three Corridor Intersections with Live Red -> Green Simulation (matching Image 1) */}
              {/* Signal #1 */}
              <Marker
                position={[12.9080, 77.5198]}
                icon={createCorridorSignalIcon(1, isSignal1Cleared)}
                eventHandlers={{
                  click: () => toggleSignal(1)
                }}
              >
                <Popup>
                  <div style={{ color: "#0f172a", minWidth: "170px" }}>
                    <strong>Intersection #1: Channasandra Link</strong>
                    <p style={{ margin: "4px 0", fontSize: "12px" }}>
                      Status: <strong style={{ color: isSignal1Cleared ? "#16a34a" : "#dc2626" }}>
                        {isSignal1Cleared ? "GREEN (PREEMPTION CLEARED)" : "RED (HOLDING CROSS-TRAFFIC)"}
                      </strong>
                    </p>
                    <button
                      onClick={() => toggleSignal(1)}
                      style={{
                        padding: "4px 8px",
                        background: "#0284c7",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                        marginTop: "4px"
                      }}
                    >
                      Toggle Red / Green
                    </button>
                  </div>
                </Popup>
              </Marker>

              {/* Signal #2 */}
              <Marker
                position={[12.9140, 77.5165]}
                icon={createCorridorSignalIcon(2, isSignal2Cleared)}
                eventHandlers={{
                  click: () => toggleSignal(2)
                }}
              >
                <Popup>
                  <div style={{ color: "#0f172a", minWidth: "170px" }}>
                    <strong>Intersection #2: 80ft Rd / Kenchenahalli Link</strong>
                    <p style={{ margin: "4px 0", fontSize: "12px" }}>
                      Status: <strong style={{ color: isSignal2Cleared ? "#16a34a" : "#dc2626" }}>
                        {isSignal2Cleared ? "GREEN (PREEMPTION CLEARED)" : "RED (HOLDING CROSS-TRAFFIC)"}
                      </strong>
                    </p>
                    <button
                      onClick={() => toggleSignal(2)}
                      style={{
                        padding: "4px 8px",
                        background: "#0284c7",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                        marginTop: "4px"
                      }}
                    >
                      Toggle Red / Green
                    </button>
                  </div>
                </Popup>
              </Marker>

              {/* Signal #3 */}
              <Marker
                position={[12.9285, 77.5180]}
                icon={createCorridorSignalIcon(3, isSignal3Cleared)}
                eventHandlers={{
                  click: () => toggleSignal(3)
                }}
              >
                <Popup>
                  <div style={{ color: "#0f172a", minWidth: "170px" }}>
                    <strong>Intersection #3: Srinivasaiah Road Link</strong>
                    <p style={{ margin: "4px 0", fontSize: "12px" }}>
                      Status: <strong style={{ color: isSignal3Cleared ? "#16a34a" : "#dc2626" }}>
                        {isSignal3Cleared ? "GREEN (PREEMPTION CLEARED)" : "RED (HOLDING CROSS-TRAFFIC)"}
                      </strong>
                    </p>
                    <button
                      onClick={() => toggleSignal(3)}
                      style={{
                        padding: "4px 8px",
                        background: "#0284c7",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                        marginTop: "4px"
                      }}
                    >
                      Toggle Red / Green
                    </button>
                  </div>
                </Popup>
              </Marker>

              {/* Congested Section along 80 Feet Road (Dashed Red & Blue Line matching Image 1) */}
              <Polyline
                positions={CONGESTED_80FT_ROAD_POINTS}
                color="#ef4444"
                weight={8}
                opacity={0.85}
                dashArray="14, 10"
              />
              <Polyline
                positions={CONGESTED_80FT_ROAD_POINTS}
                color="#38bdf8"
                weight={3}
                opacity={0.8}
                dashArray="6, 18"
              />

              {/* Traveled Route Segment (Solid Green Corridor) */}
              {vehicleState && vehicleState.traveledPoints.length >= 2 && (
                <Polyline
                  positions={vehicleState.traveledPoints}
                  color="#10b981"
                  weight={7}
                  opacity={0.95}
                />
              )}

              {/* Remaining Route Ahead (Cyan/Amber based on mode) */}
              {vehicleState && vehicleState.remainingPoints.length >= 2 ? (
                <Polyline
                  positions={vehicleState.remainingPoints}
                  color={routeMode === "CONGESTION_AWARE" ? "#06b6d4" : "#f59e0b"}
                  weight={5}
                  opacity={0.85}
                  dashArray={routeMode === "CONGESTION_AWARE" ? "8, 6" : "6, 4"}
                />
              ) : routePoints.length > 0 ? (
                <Polyline
                  positions={routePoints}
                  color={routeMode === "CONGESTION_AWARE" ? "#06b6d4" : "#f59e0b"}
                  weight={5}
                  opacity={0.85}
                  dashArray={routeMode === "CONGESTION_AWARE" ? "8, 6" : "6, 4"}
                />
              ) : null}

              {/* Live Animated Ambulance Marker along Corridor */}
              {vehicleState && (
                <Marker
                  position={vehicleState.pos}
                  icon={createAmbulanceIcon(vehicleState.bearing, isNavigating, activeDispatchedAmb?.registration_number || "KA-05-EM-7720")}
                >
                  <Popup>
                    <div style={{ color: "#0f172a", minWidth: "160px" }}>
                      <strong>Assigned Unit ({activeDispatchedAmb?.registration_number || "KA-05-EM-7720"})</strong>
                      <p style={{ margin: "4px 0", fontSize: "12px" }}>
                        Status: <strong style={{ color: "#2563eb" }}>{isNavigating ? "EN ROUTE (SIREN ACTIVE)" : "STANDBY"}</strong>
                      </p>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>Speed: {telemetry.speedKmh} km/h</div>
                    </div>
                  </Popup>
                </Marker>
              )}
            </>
          )}

          {/* === 2. FLEET STANDBY AMBULANCES (Always Shown on Map, highlighting Nearest) === */}
          {ambulances.map((amb) => {
            // When corridor is active, skip the assigned unit since it is rendered by vehicleState
            if (isCorridorActive && activeDispatchedAmb && amb.id === activeDispatchedAmb.id) {
              return null;
            }

            const isNearest = nearestAmbulance && amb.id === nearestAmbulance.id;
            return (
              <Marker
                key={`amb-${amb.id}`}
                position={[amb.latitude, amb.longitude]}
                icon={createStandbyAmbulanceIcon(amb.registration_number, isNearest)}
                eventHandlers={{
                  click: () => {
                    if (onSelectAmbulance) onSelectAmbulance(amb);
                  }
                }}
              >
                <Popup>
                  <div style={{ minWidth: "160px", color: "#0f172a" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <strong style={{ fontSize: "13px" }}>{amb.registration_number}</strong>
                      {isNearest && (
                        <span style={{ background: "#0284c7", color: "white", fontSize: "9px", padding: "1px 4px", borderRadius: "3px", fontWeight: "bold" }}>
                          NEAREST
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", margin: "4px 0" }}>
                      Status: <strong style={{ color: amb.status === "AVAILABLE" ? "#16a34a" : "#2563eb" }}>{amb.status}</strong>
                    </div>
                    {isNearest && activeAccident && (
                      <div style={{ fontSize: "11px", color: "#0284c7", fontWeight: "bold", margin: "4px 0" }}>
                        Distance to Incident: {nearestAmbulance.distanceKm} km
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* === 3. PENDING ACCIDENTS (When Not Yet Dispatched) === */}
          {!isCorridorActive && accidents.map((acc) => {
            return (
              <Marker
                key={`acc-${acc.id}`}
                position={[acc.latitude, acc.longitude]}
                icon={L.divIcon({
                  className: "",
                  html: `
                    <div style="display: flex; flex-direction: column; align-items: center;">
                      <div style="
                        width: 34px;
                        height: 34px;
                        background: rgba(220, 38, 38, 0.3);
                        border: 2px solid #ef4444;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 0 16px rgba(239, 68, 68, 0.8);
                        font-size: 17px;
                      ">
                        ⚠️
                      </div>
                      <div style="
                        background: #020617;
                        border: 1px solid #ef4444;
                        color: #fca5a5;
                        font-size: 10px;
                        font-weight: 800;
                        padding: 1px 6px;
                        border-radius: 4px;
                        margin-top: 3px;
                        white-space: nowrap;
                      ">
                        Incident #${acc.id} (${acc.vehicle_type || 'Vehicle'})
                      </div>
                    </div>
                  `,
                  iconSize: [120, 52],
                  iconAnchor: [60, 17],
                  popupAnchor: [0, -17],
                })}
              >
                <Popup>
                  <div style={{ minWidth: "180px", color: "#0f172a" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <ShieldAlert size={14} color="#dc2626" />
                      <strong style={{ color: "#dc2626" }}>Accident Detected</strong>
                    </div>
                    <p style={{ margin: "4px 0", fontSize: "12px" }}>
                      Vehicle: <strong>{acc.vehicle_type?.toUpperCase()}</strong> · Confidence: <strong>{Math.round((acc.confidence_score || 0.9) * 100)}%</strong>
                    </p>
                    {nearestAmbulance && (
                      <div style={{ fontSize: "11px", color: "#0284c7", margin: "4px 0" }}>
                        Nearest Unit: <strong>{nearestAmbulance.registration_number}</strong> ({nearestAmbulance.distanceKm} km)
                      </div>
                    )}
                    <button
                      onClick={() => {
                        if (onSelectAccident) onSelectAccident(acc);
                      }}
                      style={{
                        width: "100%",
                        padding: "6px",
                        background: "#2563eb",
                        color: "white",
                        border: "none",
                        borderRadius: "5px",
                        fontWeight: "bold",
                        fontSize: "11px",
                        cursor: "pointer",
                        marginTop: "4px"
                      }}
                    >
                      🚑 Validate & Dispatch Nearest
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* === 4. PARTNER HOSPITALS (Shown in both Standby and Active modes) === */}
          {/* Adichunchanagiri / BGS GIMS Hospital ([H] blue badge in Image 1) */}
          <Marker
            position={[12.9030, 77.4980]}
            icon={createHospitalIconH("BGS GIMS / Trust")}
          >
            <Popup>
              <div style={{ color: "#0f172a", minWidth: "170px" }}>
                <strong>BGS GIMS & Hospital</strong>
                <p style={{ margin: "4px 0", fontSize: "12px" }}>Adichunchanagiri Trust, RR Nagar</p>
                <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: "bold" }}>Emergency Services Available</span>
              </div>
            </Popup>
          </Marker>

          {/* Additional Partner Hospitals from database */}
          {hospitals.map((hosp) => {
            if (Math.abs(hosp.latitude - 12.9355) < 0.002) return null; // Skip SPARSH RR Nagar duplicate
            return (
              <Marker
                key={`hosp-${hosp.id}`}
                position={[hosp.latitude, hosp.longitude]}
                icon={L.divIcon({
                  className: "",
                  html: `
                    <div style="display: flex; flex-direction: column; align-items: center;">
                      <div style="
                        width: 26px;
                        height: 26px;
                        background: #064e3b;
                        border: 2px solid #10b981;
                        border-radius: 6px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 13px;
                        box-shadow: 0 0 10px rgba(16, 185, 129, 0.6);
                      ">
                        🏥
                      </div>
                      <div style="
                        background: #020617;
                        border: 1px solid #10b981;
                        color: #34d399;
                        font-size: 9px;
                        font-weight: 700;
                        padding: 1px 5px;
                        border-radius: 4px;
                        margin-top: 2px;
                        white-space: nowrap;
                      ">
                        ${hosp.name.split(" ")[0]}
                      </div>
                    </div>
                  `,
                  iconSize: [90, 44],
                  iconAnchor: [45, 13],
                  popupAnchor: [0, -15],
                })}
              >
                <Popup>
                  <div style={{ minWidth: "150px", color: "#0f172a" }}>
                    <strong>{hosp.name}</strong>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>ICU Beds: {hosp.icu_beds_available}</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* === 5. SECONDARY TRAFFIC INTERSECTIONS (City Junctions) === */}
          {intersections.map((intNode) => {
            const isCorridorNode =
              Math.abs(intNode.latitude - 12.9080) < 0.001 ||
              Math.abs(intNode.latitude - 12.9140) < 0.001 ||
              Math.abs(intNode.latitude - 12.9285) < 0.001;
            if (isCorridorNode && isCorridorActive) return null;

            return (
              <Marker
                key={`int-${intNode.id}`}
                position={[intNode.latitude, intNode.longitude]}
                icon={L.divIcon({
                  className: "",
                  html: `<div style="width:10px;height:10px;border-radius:50%;background:#06b6d4;border:2px solid white;box-shadow:0 0 6px #06b6d4;"></div>`,
                  iconSize: [10, 10],
                  iconAnchor: [5, 5]
                })}
              >
                <Popup>
                  <div style={{ minWidth: "150px", color: "#0f172a" }}>
                    <strong>{intNode.name}</strong>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>Cycle: {intNode.signal_state}</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* 2. THREE ROUTE MODE CARDS (Image 2) & ALTERNATIVE ROUTE COMPARISON TABLE (Image 3) */}
      {/* Shown ONLY After Ambulance Assignment / Active Route */}
      {isCorridorActive && (
        <RouteComparisonPanel
          activeRouteType={routeMode}
          onRouteChange={(newMode) => {
            setRouteMode(newMode);
            setNavProgress(0);
            setIsNavigating(false);
            lastPreemptRef.current = { 1: false, 2: false, 3: false };
            setManualSignalOverrides({ 1: null, 2: null, 3: null });
          }}
          targetHospitalName="SPARSH RR Nagar"
        />
      )}
    </div>
  );
}
