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
} from "lucide-react";
import { playEmergencyAlert, playDispatchChime } from "../utils/sound";
import { sernApi } from "../services/api";
import RouteComparisonPanel from "./RouteComparisonPanel";

// High-fidelity RNSIT Campus -> SPARSH Hospital RR Nagar Corridors
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
      [12.9015, 77.5192],
      [12.9080, 77.5198],
      [12.9140, 77.5165],
      [12.9200, 77.5172],
      [12.9250, 77.5176],
      [12.9285, 77.5180],
      [12.9320, 77.5180],
      [12.9355, 77.5175]
    ],
    distanceKm: 5.29,
    durationMin: 19.82,
    speedKmh: 16.0,
    delay: "+7m 50s"
  },
  FASTEST: {
    points: [
      [12.9015, 77.5192],
      [12.9080, 77.5198],
      [12.9140, 77.5165],
      [12.9200, 77.5172],
      [12.9250, 77.5176],
      [12.9285, 77.5180],
      [12.9320, 77.5180],
      [12.9355, 77.5175]
    ],
    distanceKm: 5.29,
    durationMin: 19.82,
    speedKmh: 16.0,
    delay: "+7m 50s"
  }
};

// MapController with automatic zoom-to-route and vehicle following
function MapController({ center, zoom, followVehicle, vehiclePos, routePoints, isCorridorActive, routeKey }) {
  const map = useMap();
  const lastZoomedKeyRef = useRef(null);

  useEffect(() => {
    if (isCorridorActive && routePoints && routePoints.length >= 2) {
      if (lastZoomedKeyRef.current !== routeKey) {
        lastZoomedKeyRef.current = routeKey;
        try {
          const bounds = L.latLngBounds(routePoints);
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: true });
        } catch (e) {
          console.warn("fitBounds notice:", e);
        }
      } else if (followVehicle && vehiclePos && vehiclePos[0] && vehiclePos[1]) {
        map.panTo(vehiclePos, { animate: true, duration: 0.5 });
      }
    } else {
      lastZoomedKeyRef.current = null;
      if (center && center[0] && center[1]) {
        map.setView(center, zoom || 13, { animate: true });
      }
    }
  }, [center, zoom, followVehicle, vehiclePos, routePoints, isCorridorActive, routeKey, map]);

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
  activeCenter = [12.9716, 77.5946],
  onSelectAccident = null,
  onSelectAmbulance = null,
  onEmergencyArrived = null,
  isCitizenRole = false,
  onOpenCitizenReport = null,
  routeMode: controlledRouteMode = null,
  onRouteModeChange = null,
  showComparisonPanel = true,
}) {
  // Route selection mode: "CONGESTION_AWARE" | "SHORTEST" | "FASTEST"
  const [localRouteMode, setLocalRouteMode] = useState("CONGESTION_AWARE");
  const routeMode =
    controlledRouteMode ||
    selectedRoute?.selected_strategy ||
    selectedRoute?.route_geometry?.selected_candidate ||
    localRouteMode;
  const setRouteMode = useCallback(
    (newMode) => {
      if (onRouteModeChange) {
        onRouteModeChange(newMode);
      } else {
        setLocalRouteMode(newMode);
      }
    },
    [onRouteModeChange]
  );

  // Extract live candidate routes from backend Dijkstra calculation
  const routeCandidates = useMemo(() => {
    return selectedRoute?.candidates || selectedRoute?.route_geometry?.candidates || null;
  }, [selectedRoute]);
  const activeCandidate = routeCandidates?.[routeMode] || null;

  // Live Navigation State
  const [isNavigating, setIsNavigating] = useState(false);
  const [navProgress, setNavProgress] = useState(0); // 0.0 to 1.0
  const [speedMultiplier, setSpeedMultiplier] = useState(2); // 1x, 2x, 4x
  const [followVehicle, setFollowVehicle] = useState(true);
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
  const navProgressRef = useRef(0);
  const vehicleStateRef = useRef(null);
  const arrivalFiredRef = useRef(false);
  const arrivedRouteIdsRef = useRef(new Set());

  // 1. Identify Active Dispatched Ambulance or Active Emergency (includes AT_SCENE / TRANSPORTING until COMPLETED)
  const activeDispatchedAmb = useMemo(() => {
    return (
      ambulances.find(
        (a) =>
          a.status === "ASSIGNED" ||
          a.status === "DISPATCHED" ||
          a.status === "EN_ROUTE" ||
          a.status === "AT_SCENE" ||
          a.status === "TRANSPORTING"
      ) || null
    );
  }, [ambulances]);

  const activeEmergency = useMemo(() => {
    return (
      emergencies.find(
        (e) => ["DISPATCHED", "ASSIGNED", "EN_ROUTE", "AT_SCENE", "TRANSPORTING"].includes(e.status)
      ) || null
    );
  }, [emergencies]);

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

  // 4. Strict Condition: Is an Ambulance Actively Assigned & En Route?
  // Only true when an ambulance is actively dispatched and route is loaded (Disabled for Citizen Role)
  const isCorridorActive = useMemo(() => {
    if (isCitizenRole) return false;
    const hasDispatchedAmb = Boolean(
      activeDispatchedAmb || (activeEmergency && activeEmergency.assigned_ambulance_id)
    );
    const hasRoute = Boolean(selectedRoute && (selectedRoute.route_geometry || selectedRoute.id));
    return Boolean(hasDispatchedAmb && (hasRoute || activeAccident));
  }, [isCitizenRole, activeDispatchedAmb, activeEmergency, selectedRoute, activeAccident]);

  // Dynamic Route Points: Computed according to the actual registered place
  const routePoints = useMemo(() => {
    if (!isCorridorActive) return [];

    // 1. Check candidate route matching active routeMode from backend multi-strategy Dijkstra router
    const candidates = selectedRoute?.candidates || selectedRoute?.route_geometry?.candidates;
    if (candidates && candidates[routeMode]?.route_geometry?.coordinates) {
      const coords = candidates[routeMode].route_geometry.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        return coords.map((coord) => [coord[1], coord[0]]);
      }
    }

    // 2. If backend calculated route geometry is provided, use it directly!
    if (selectedRoute && selectedRoute.route_geometry) {
      try {
        const geom =
          typeof selectedRoute.route_geometry === "string"
            ? JSON.parse(selectedRoute.route_geometry)
            : selectedRoute.route_geometry;

        if (geom.type === "LineString" && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
          return geom.coordinates.map((coord) => [coord[1], coord[0]]);
        }
      } catch (e) {
        console.warn("Failed to parse route geometry:", e);
      }
    }

    // 2. If active incident and dispatched ambulance exist, construct dynamic route to nearest hospital
    if (activeAccident && activeDispatchedAmb) {
      const ambPt = [activeDispatchedAmb.latitude, activeDispatchedAmb.longitude];
      const accPt = [activeAccident.latitude, activeAccident.longitude];

      // Find nearest hospital to accident
      let nearestHospPt = [12.9355, 77.5175];
      let minHospDist = Infinity;
      for (const h of hospitals) {
        const d = distanceInMeters(accPt[0], accPt[1], h.latitude, h.longitude);
        if (d < minHospDist) {
          minHospDist = d;
          nearestHospPt = [h.latitude, h.longitude];
        }
      }

      // If accident is near RNSIT, use detailed RR Nagar corridor
      const distToRnsit = distanceInMeters(accPt[0], accPt[1], 12.9015, 77.5192);
      if (distToRnsit < 1500 && RNSIT_RR_NAGAR_ROUTES[routeMode]) {
        return RNSIT_RR_NAGAR_ROUTES[routeMode].points;
      }

      // Dynamic road network path connecting registered accident location
      const midLat1 = ambPt[0] + (accPt[0] - ambPt[0]) * 0.5 + 0.001;
      const midLon1 = ambPt[1] + (accPt[1] - ambPt[1]) * 0.5;
      const midLat2 = accPt[0] + (nearestHospPt[0] - accPt[0]) * 0.5;
      const midLon2 = accPt[1] + (nearestHospPt[1] - accPt[1]) * 0.5 + 0.001;

      return [ambPt, [midLat1, midLon1], accPt, [midLat2, midLon2], nearestHospPt];
    }

    if (RNSIT_RR_NAGAR_ROUTES[routeMode]) {
      return RNSIT_RR_NAGAR_ROUTES[routeMode].points;
    }

    return [];
  }, [isCorridorActive, selectedRoute, activeAccident, activeDispatchedAmb, hospitals, routeMode]);

  // Dynamic Map Center & Zoom:
  const mapCenter = useMemo(() => {
    if (isCorridorActive && routePoints.length >= 2) {
      return routePoints[0];
    }
    if (activeAccident && activeAccident.latitude && activeAccident.longitude) {
      return [activeAccident.latitude, activeAccident.longitude];
    }
    return activeCenter || [12.9716, 77.5946];
  }, [isCorridorActive, routePoints, activeAccident, activeCenter]);

  const mapZoom = useMemo(() => {
    if (isCorridorActive) return 14;
    if (activeAccident) return 13;
    return 12;
  }, [isCorridorActive, activeAccident]);

  const routeKey = useMemo(() => {
    if (!isCorridorActive || routePoints.length < 2) return null;
    return `${routePoints[0][0]}-${routePoints[routePoints.length - 1][0]}-${routePoints.length}-${selectedRoute?.id || 'corridor'}`;
  }, [isCorridorActive, routePoints, selectedRoute]);

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

  // Start navigation simulation once an ambulance is assigned
  useEffect(() => {
    if (!isCorridorActive) {
      loadedRouteIdRef.current = null;
      arrivalFiredRef.current = false;
      arrivedRouteIdsRef.current.clear();
      navProgressRef.current = 0;
      const t = setTimeout(() => {
        setIsNavigating(false);
        setNavProgress(0);
      }, 0);
      return () => clearTimeout(t);
    }

    const routeId = selectedRoute?.emergency_id || selectedRoute?.id || activeEmergency?.id || "ROUTE-ACTIVE";
    if (routeId && routeId !== loadedRouteIdRef.current && routePoints.length >= 2) {
      loadedRouteIdRef.current = routeId;
      const alreadyArrived =
        arrivedRouteIdsRef.current.has(routeId) ||
        ["AT_SCENE", "TRANSPORTING"].includes(activeEmergency?.status);

      if (alreadyArrived) {
        arrivalFiredRef.current = true;
        navProgressRef.current = 1.0;
        const t = setTimeout(() => {
          setNavProgress(1.0);
          setIsNavigating(false);
        }, 0);
        return () => clearTimeout(t);
      }

      arrivalFiredRef.current = false;
      hasPlayedSirenRef.current = false;
      lastPreemptRef.current = { 1: false, 2: false, 3: false };
      navProgressRef.current = 0;
      const t = setTimeout(() => {
        setManualSignalOverrides({ 1: null, 2: null, 3: null });
        setNavProgress(0);
        setIsNavigating(true);
      }, 100);
      return () => clearTimeout(t);
    }
  }, [isCorridorActive, selectedRoute, routePoints.length, activeEmergency?.id, activeEmergency?.status]);

  // Proactive Predictive Green Corridor Traffic Signal Control
  // Signal 1: Intersection at ~0.18. Advance trigger at 0.06 (~20-25s before arrival). Passes at 0.22 (Restores normal cycle).
  // Signal 2: Intersection at ~0.48. Advance trigger at 0.36 (~20-25s before arrival). Passes at 0.52 (Restores normal cycle).
  // Signal 3: Intersection at ~0.78. Advance trigger at 0.66 (~20-25s before arrival). Passes at 0.82 (Restores normal cycle).
  const getSignalState = useCallback((sigNum, progress, manualOverride) => {
    if (manualOverride !== null) {
      return manualOverride ? "PREEMPTIVE_GREEN" : "HOLD_RED";
    }
    const config = {
      1: { approach: 0.06, at: 0.18, pass: 0.22 },
      2: { approach: 0.36, at: 0.48, pass: 0.52 },
      3: { approach: 0.66, at: 0.78, pass: 0.82 },
    }[sigNum];

    if (!config) return "HOLD_RED";
    if (progress < config.approach) return "HOLD_RED";
    if (progress < config.pass) return "PREEMPTIVE_GREEN";
    return "RESTORED_NORMAL";
  }, []);

  const signal1State = getSignalState(1, navProgress, manualSignalOverrides[1]);
  const signal2State = getSignalState(2, navProgress, manualSignalOverrides[2]);
  const signal3State = getSignalState(3, navProgress, manualSignalOverrides[3]);

  // Backward-compatible booleans for quick checks
  const isSignal1Cleared = signal1State === "PREEMPTIVE_GREEN" || signal1State === "RESTORED_NORMAL";
  const isSignal2Cleared = signal2State === "PREEMPTIVE_GREEN" || signal2State === "RESTORED_NORMAL";
  const isSignal3Cleared = signal3State === "PREEMPTIVE_GREEN" || signal3State === "RESTORED_NORMAL";

  // Audio chimes on automatic state transitions into PREEMPTIVE_GREEN
  useEffect(() => {
    if (!isNavigating) return;

    if (signal1State === "PREEMPTIVE_GREEN" && !lastPreemptRef.current[1]) {
      lastPreemptRef.current[1] = true;
      if (soundEnabled) playDispatchChime();
    }
    if (signal2State === "PREEMPTIVE_GREEN" && !lastPreemptRef.current[2]) {
      lastPreemptRef.current[2] = true;
      if (soundEnabled) playDispatchChime();
    }
    if (signal3State === "PREEMPTIVE_GREEN" && !lastPreemptRef.current[3]) {
      lastPreemptRef.current[3] = true;
      if (soundEnabled) playDispatchChime();
    }
  }, [signal1State, signal2State, signal3State, isNavigating, soundEnabled]);

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

  // Sync refs for smooth requestAnimationFrame reads without tearing down loop
  useEffect(() => {
    vehicleStateRef.current = vehicleState;
  }, [vehicleState]);

  // Handle Arrival at Destination
  const handleDestinationArrival = useCallback(() => {
    if (arrivalFiredRef.current) return;
    arrivalFiredRef.current = true;

    const routeId = selectedRoute?.emergency_id || selectedRoute?.id || activeEmergency?.id || loadedRouteIdRef.current;
    if (routeId) arrivedRouteIdsRef.current.add(routeId);

    navProgressRef.current = 1.0;
    setIsNavigating(false);
    setNavProgress(1.0);
    if (soundEnabled) playDispatchChime();

    setTelemetry((prev) => ({
      ...prev,
      speedKmh: 0,
      remainingKm: 0,
      etaSec: 0,
      currentStep: "Arrived at Destination: Trauma Hospital (Unit On Site)",
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

    const emId = selectedRoute?.emergency_id || activeEmergency?.id;
    if (onEmergencyArrived && emId) {
      onEmergencyArrived(emId);
    }
  }, [soundEnabled, activeDispatchedAmb, activeEmergency?.id, routePoints, onEmergencyArrived, selectedRoute]);

  // Turn-by-Turn GPS Animation Loop
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
      const deltaTime = Math.min(0.1, (timestamp - lastTickTimeRef.current) / 1000);
      lastTickTimeRef.current = timestamp;

      const fullTripSeconds = 24 / speedMultiplier;
      const progressIncrement = deltaTime / fullTripSeconds;
      const next = Math.min(1.0, navProgressRef.current + progressIncrement);
      navProgressRef.current = next;

      if (next >= 1.0) {
        animationFrameRef.current = null;
        handleDestinationArrival();
        return;
      }

      setNavProgress(next);

      const remainingRatio = 1.0 - next;
      const totalDistanceKm = +(routeMetrics.totalDist / 1000).toFixed(2) || (routeMode === "CONGESTION_AWARE" ? 6.87 : 5.29);
      const remainingKm = Math.max(0, +(remainingRatio * totalDistanceKm).toFixed(2));
      const baseSpeed = routeMode === "CONGESTION_AWARE" ? 28 : 16;
      const currentSpeedKmh = Math.round(baseSpeed + Math.sin(next * 20) * 3);
      const etaSec = Math.round((remainingKm / (currentSpeedKmh || 20)) * 3600);

      let stepText;
      if (next < 0.06) {
        stepText = "Standby: Route signals holding cross-traffic in RED HOLD state";
      } else if (next < 0.18) {
        stepText = "Signal #1 PREEMPTIVE GREEN activated (20s advance queue flush before arrival)";
      } else if (next < 0.22) {
        stepText = "Ambulance crossing Intersection #1 with solid green priority";
      } else if (next < 0.36) {
        stepText = "Intersection #1 safely crossed · Normal cycle restored · Approaching Link #2";
      } else if (next < 0.48) {
        stepText = "Signal #2 PREEMPTIVE GREEN activated (20s advance queue flush before arrival)";
      } else if (next < 0.52) {
        stepText = "Ambulance crossing Intersection #2 · Congested sections bypassed";
      } else if (next < 0.66) {
        stepText = "Intersection #2 safely crossed · Normal cycle restored · Approaching Hospital Link";
      } else if (next < 0.78) {
        stepText = "Signal #3 PREEMPTIVE GREEN activated (20s advance emergency corridor)";
      } else if (next < 0.82) {
        stepText = "Ambulance crossing Intersection #3 · Entering emergency bay entrance";
      } else if (next < 1.0) {
        stepText = "All signals safely cleared & restored · Final approach to trauma desk";
      } else {
        stepText = "Arrived at Destination: Trauma Hospital (Unit On Site)";
      }

      const currentVeh = vehicleStateRef.current;
      setTelemetry({
        speedKmh: currentSpeedKmh,
        headingDeg: Math.round(currentVeh?.bearing || 0),
        remainingKm,
        etaSec,
        currentStep: stepText,
      });

      const now = Date.now();
      if (activeDispatchedAmb && currentVeh && now - lastTelemetrySendRef.current > 1500) {
        lastTelemetrySendRef.current = now;
        sernApi.streamAmbulanceTelemetry(activeDispatchedAmb.id, {
          latitude: currentVeh.pos[0],
          longitude: currentVeh.pos[1],
          speed_kmh: currentSpeedKmh,
          heading_deg: Math.round(currentVeh.bearing),
          distance_remaining_km: remainingKm,
          eta_seconds: etaSec,
          status: "EN_ROUTE",
        }).catch(() => {});

        if (activeEmergency?.id) {
          sernApi.evaluatePredictiveSignals(activeEmergency.id, {
            current_lat: currentVeh.pos[0],
            current_lon: currentVeh.pos[1],
            speed_kmh: currentSpeedKmh
          }).catch(() => {});
        }
      }

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
    routeMode,
    activeEmergency?.id,
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

  const preemptAllSignals = () => {
    if (soundEnabled) playDispatchChime();
    setManualSignalOverrides({ 1: true, 2: true, 3: true });
  };

  const resetAllSignals = () => {
    setManualSignalOverrides({ 1: false, 2: false, 3: false });
  };

  // Custom DivIcon for Corridor Signals (Supports Predictive Green, Restored, and Red Hold)
  const createCorridorSignalIcon = (num, state) => {
    const isPreemptGreen = state === "PREEMPTIVE_GREEN" || state === true;
    const isRestored = state === "RESTORED_NORMAL";

    if (isPreemptGreen) {
      return L.divIcon({
        className: "",
        html: `
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 5px;
            background: #020617;
            border: 2px solid #10b981;
            border-radius: 6px;
            padding: 3px 8px;
            color: #34d399;
            font-weight: 800;
            font-size: 11px;
            box-shadow: 0 0 18px rgba(16, 185, 129, 0.85);
            letter-spacing: 0.5px;
            cursor: pointer;
          " title="Signal #${num}: PREEMPTIVE GREEN (20s Advance Clearance - Flushing Queue)">
            <span style="
              display: inline-flex;
              align-items: center;
              justify-content: center;
              border: 1.5px solid #10b981;
              border-radius: 3px;
              width: 13px;
              height: 13px;
              font-size: 9px;
              color: #34d399;
              font-weight: 900;
            ">✓</span>
            #${num} ADVANCE GREEN
          </div>
        `,
        iconSize: [120, 28],
        iconAnchor: [60, 14],
        popupAnchor: [0, -14],
      });
    } else if (isRestored) {
      return L.divIcon({
        className: "",
        html: `
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 5px;
            background: #0f172a;
            border: 1.5px solid #64748b;
            border-radius: 6px;
            padding: 3px 8px;
            color: #94a3b8;
            font-weight: 700;
            font-size: 11px;
            box-shadow: 0 0 8px rgba(100, 116, 139, 0.4);
            letter-spacing: 0.5px;
            cursor: pointer;
          " title="Signal #${num}: Normal cycle restored after ambulance clearance">
            <span style="
              display: inline-block;
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: #64748b;
            "></span>
            #${num} RESTORED
          </div>
        `,
        iconSize: [100, 28],
        iconAnchor: [50, 14],
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
          " title="Signal #${num}: RED HOLD (Holding cross-traffic)">
            <span style="
              display: inline-block;
              width: 9px;
              height: 9px;
              border-radius: 50%;
              background: #ef4444;
              box-shadow: 0 0 8px #ef4444;
            "></span>
            #${num} RED HOLD
          </div>
        `,
        iconSize: [95, 28],
        iconAnchor: [47, 14],
        popupAnchor: [0, -14],
      });
    }
  };

  // Custom DivIcon for Incident Marker
  const createIncidentIcon = (locationLabel = "Incident Site") => {
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
            ">ALERT</span>
            <span style="
              background: #020617;
              border: 1px solid #334155;
              color: #f8fafc;
              font-size: 11px;
              font-weight: 700;
              padding: 2px 8px;
              border-radius: 6px;
              white-space: nowrap;
            ">${locationLabel}</span>
          </div>
        </div>
      `,
      iconSize: [140, 60],
      iconAnchor: [70, 20],
      popupAnchor: [0, -25],
    });
  };

  // Custom DivIcon for Hospital
  const createHospitalIcon = (name) => {
    return L.divIcon({
      className: "",
      html: `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div style="
            width: 36px;
            height: 36px;
            background: #064e3b;
            border: 2px solid #10b981;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 16px rgba(16, 185, 129, 0.6);
          ">
            <span style="font-size: 19px;">🏥</span>
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
            ${name}
          </div>
        </div>
      `,
      iconSize: [130, 60],
      iconAnchor: [65, 20],
      popupAnchor: [0, -25],
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
        
        {/* A. STANDBY FLEET STATUS BAR (When No Ambulance is Dispatched) */}
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
                  {isCitizenRole ? "Public Safety & Incident Awareness Map" : "Bengaluru Fleet Standby & Incident Monitoring"}
                </strong>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                  {isCitizenRole
                    ? "Live public safety status · Emergency trauma centers & reported road incidents"
                    : nearestAmbulance && activeAccident
                    ? `⚠️ Collision candidate reported · Nearest unit: ${nearestAmbulance.registration_number} (${nearestAmbulance.distanceKm} km away)`
                    : `${ambulances.length || 6} Ambulances stationed across Bengaluru · Standby for operator dispatch`}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {isCitizenRole ? (
                <button
                  onClick={() => {
                    if (onOpenCitizenReport) onOpenCitizenReport();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 14px",
                    background: "#dc2626",
                    border: "none",
                    borderRadius: "6px",
                    color: "white",
                    fontSize: "11px",
                    fontWeight: "bold",
                    cursor: "pointer"
                  }}
                >
                  <ShieldAlert size={13} />
                  Report Emergency
                </button>
              ) : activeAccident ? (
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
                  Validate & Dispatch
                </button>
              ) : null}
            </div>
          </div>
        )}

        {/* B. LIVE GPS TELEMETRY & SMART SIGNAL CONTROL HUD OVERLAY (Shown ONLY After Ambulance Assignment) */}
        {isCorridorActive && !isCitizenRole && (
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Radio size={14} color="#38bdf8" />
                <strong style={{ fontSize: "12px", color: "#38bdf8", letterSpacing: "0.5px" }}>
                  LIVE GPS TELEMETRY
                </strong>
              </div>
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
            </div>

            {/* Active Dijkstra Strategy & Optimal Route Pill */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "6px",
              padding: "4px 8px",
              marginBottom: "8px",
              borderRadius: "5px",
              background: "rgba(56, 189, 248, 0.12)",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              fontSize: "10px",
              color: "#7dd3fc",
              fontWeight: "700"
            }}>
              <span>
                {activeCandidate?.is_optimal
                  ? `★ OPTIMAL ROUTE SELECTED: ${activeCandidate.strategy_title}`
                  : `ACTIVE ROUTE: ${activeCandidate?.strategy_title || routeMode}`}
              </span>
              {activeCandidate && (
                <span style={{ color: "#34d399" }}>
                  {activeCandidate.distance_km} km
                </span>
              )}
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

            {/* DYNAMIC PROACTIVE PREDICTIVE TRAFFIC PREEMPTION STATUS BANNER */}
            <div style={{
              background: (signal1State === "PREEMPTIVE_GREEN" || signal2State === "PREEMPTIVE_GREEN" || signal3State === "PREEMPTIVE_GREEN")
                ? "rgba(6, 78, 59, 0.7)"
                : (navProgress >= 0.82)
                ? "rgba(14, 116, 144, 0.6)"
                : "rgba(153, 27, 27, 0.6)",
              border: `1px solid ${
                (signal1State === "PREEMPTIVE_GREEN" || signal2State === "PREEMPTIVE_GREEN" || signal3State === "PREEMPTIVE_GREEN")
                  ? "rgba(16, 185, 129, 0.8)"
                  : (navProgress >= 0.82)
                  ? "rgba(56, 189, 248, 0.8)"
                  : "rgba(239, 68, 68, 0.7)"
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
                color: (signal1State === "PREEMPTIVE_GREEN" || signal2State === "PREEMPTIVE_GREEN" || signal3State === "PREEMPTIVE_GREEN" || navProgress >= 0.82) ? "#34d399" : "#f87171",
                fontWeight: "700"
              }}>
                <span style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: (signal1State === "PREEMPTIVE_GREEN" || signal2State === "PREEMPTIVE_GREEN" || signal3State === "PREEMPTIVE_GREEN" || navProgress >= 0.82) ? "#10b981" : "#ef4444",
                  boxShadow: (signal1State === "PREEMPTIVE_GREEN" || signal2State === "PREEMPTIVE_GREEN" || signal3State === "PREEMPTIVE_GREEN") ? "0 0 10px #10b981" : "0 0 6px #ef4444",
                }} />
                {signal1State === "PREEMPTIVE_GREEN"
                  ? "Signal #1 PREEMPTIVE GREEN (20s Advance Queue Flush)"
                  : signal2State === "PREEMPTIVE_GREEN"
                  ? "Signal #2 PREEMPTIVE GREEN (20s Advance Queue Flush)"
                  : signal3State === "PREEMPTIVE_GREEN"
                  ? "Signal #3 PREEMPTIVE GREEN (20s Advance Queue Flush)"
                  : navProgress >= 0.82
                  ? "All 3 Signals Cleared · Normal Traffic Cycles Restored"
                  : signal1State === "RESTORED_NORMAL" && signal2State === "HOLD_RED"
                  ? "Signal #1 Restored · Approaching Signal #2 (Holding RED)"
                  : "Signals in RED HOLD (Standby)"}
              </span>

              <span style={{
                fontSize: "10px",
                color: (signal1State === "PREEMPTIVE_GREEN" || signal2State === "PREEMPTIVE_GREEN" || signal3State === "PREEMPTIVE_GREEN") ? "#34d399" : navProgress >= 0.82 ? "#38bdf8" : "#fca5a5",
                fontWeight: "800",
                background: (signal1State === "PREEMPTIVE_GREEN" || signal2State === "PREEMPTIVE_GREEN" || signal3State === "PREEMPTIVE_GREEN") ? "rgba(16, 185, 129, 0.25)" : navProgress >= 0.82 ? "rgba(6, 182, 212, 0.25)" : "rgba(239, 68, 68, 0.25)",
                padding: "2px 6px",
                borderRadius: "4px"
              }}>
                {(signal1State === "PREEMPTIVE_GREEN" || signal2State === "PREEMPTIVE_GREEN" || signal3State === "PREEMPTIVE_GREEN") ? "PREEMPTIVE GREEN" : navProgress >= 0.82 ? "GREEN LOCK" : "RED HOLD"}
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
                  navProgressRef.current = val;
                  if (val < 1.0) arrivalFiredRef.current = false;
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
                  background: signal1State === "PREEMPTIVE_GREEN" ? "rgba(16, 185, 129, 0.25)" : signal1State === "RESTORED_NORMAL" ? "rgba(100, 116, 139, 0.25)" : "rgba(239, 68, 68, 0.2)",
                  border: `1px solid ${signal1State === "PREEMPTIVE_GREEN" ? "#10b981" : signal1State === "RESTORED_NORMAL" ? "#64748b" : "#ef4444"}`,
                  borderRadius: "4px",
                  color: signal1State === "PREEMPTIVE_GREEN" ? "#34d399" : signal1State === "RESTORED_NORMAL" ? "#94a3b8" : "#f87171",
                  fontSize: "10px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
                title="Click to toggle Signal #1"
              >
                #1 {signal1State === "PREEMPTIVE_GREEN" ? "🟢 ADVANCE" : signal1State === "RESTORED_NORMAL" ? "⚪ NORMAL" : "🔴 HOLD"}
              </button>

              <button
                onClick={() => toggleSignal(2)}
                style={{
                  padding: "4px 2px",
                  background: signal2State === "PREEMPTIVE_GREEN" ? "rgba(16, 185, 129, 0.25)" : signal2State === "RESTORED_NORMAL" ? "rgba(100, 116, 139, 0.25)" : "rgba(239, 68, 68, 0.2)",
                  border: `1px solid ${signal2State === "PREEMPTIVE_GREEN" ? "#10b981" : signal2State === "RESTORED_NORMAL" ? "#64748b" : "#ef4444"}`,
                  borderRadius: "4px",
                  color: signal2State === "PREEMPTIVE_GREEN" ? "#34d399" : signal2State === "RESTORED_NORMAL" ? "#94a3b8" : "#f87171",
                  fontSize: "10px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
                title="Click to toggle Signal #2"
              >
                #2 {signal2State === "PREEMPTIVE_GREEN" ? "🟢 ADVANCE" : signal2State === "RESTORED_NORMAL" ? "⚪ NORMAL" : "🔴 HOLD"}
              </button>

              <button
                onClick={() => toggleSignal(3)}
                style={{
                  padding: "4px 2px",
                  background: signal3State === "PREEMPTIVE_GREEN" ? "rgba(16, 185, 129, 0.25)" : signal3State === "RESTORED_NORMAL" ? "rgba(100, 116, 139, 0.25)" : "rgba(239, 68, 68, 0.2)",
                  border: `1px solid ${signal3State === "PREEMPTIVE_GREEN" ? "#10b981" : signal3State === "RESTORED_NORMAL" ? "#64748b" : "#ef4444"}`,
                  borderRadius: "4px",
                  color: signal3State === "PREEMPTIVE_GREEN" ? "#34d399" : signal3State === "RESTORED_NORMAL" ? "#94a3b8" : "#f87171",
                  fontSize: "10px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
                title="Click to toggle Signal #3"
              >
                #3 {signal3State === "PREEMPTIVE_GREEN" ? "🟢 ADVANCE" : signal3State === "RESTORED_NORMAL" ? "⚪ NORMAL" : "🔴 HOLD"}
              </button>
            </div>

            {/* MAIN INTERACTIVE SIMULATION CONTROLS */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
              <button
                onClick={() => {
                  if (navProgress >= 1.0) {
                    const routeId = selectedRoute?.emergency_id || selectedRoute?.id || activeEmergency?.id || loadedRouteIdRef.current;
                    if (routeId) arrivedRouteIdsRef.current.delete(routeId);
                    arrivalFiredRef.current = false;
                    navProgressRef.current = 0;
                    hasPlayedSirenRef.current = false;
                    lastPreemptRef.current = { 1: false, 2: false, 3: false };
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
                  const routeId = selectedRoute?.emergency_id || selectedRoute?.id || activeEmergency?.id || loadedRouteIdRef.current;
                  if (routeId) arrivedRouteIdsRef.current.delete(routeId);
                  arrivalFiredRef.current = false;
                  navProgressRef.current = 0;
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

        {/* C. LEAFLET MAP CONTAINER (Bengaluru City Overview) */}
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ width: "100%", height: "100%" }}
          scrollWheelZoom={true}
        >
          <MapController
            center={mapCenter}
            zoom={mapZoom}
            followVehicle={followVehicle}
            vehiclePos={vehicleState?.pos}
            routePoints={routePoints}
            isCorridorActive={isCorridorActive}
            routeKey={routeKey}
          />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* === 1. CORRIDOR & INCIDENT OVERLAYS (Active ONLY When an Ambulance is Dispatched) === */}
          {isCorridorActive && !isCitizenRole && (
            <>
              {/* Origin Incident Marker */}
              {activeAccident && (
                <Marker
                  position={[activeAccident.latitude, activeAccident.longitude]}
                  icon={createIncidentIcon(activeAccident.location_description || "Incident Site")}
                >
                  <Popup>
                    <div style={{ color: "#0f172a", minWidth: "180px" }}>
                      <strong style={{ color: "#dc2626", fontSize: "14px" }}>Reported Incident #{activeAccident.id}</strong>
                      <p style={{ margin: "4px 0", fontSize: "12px" }}>Location: {activeAccident.location_description || "Bengaluru Corridor"}</p>
                      <div style={{ fontSize: "11px", color: "#16a34a", fontWeight: "bold" }}>● Nearest Unit Dispatched</div>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Corridor Intersections with Proactive Predictive Red -> Preemptive Green -> Restored Simulation */}
              <Marker
                position={routePoints[1] || [12.9080, 77.5198]}
                icon={createCorridorSignalIcon(1, signal1State)}
                eventHandlers={{ click: () => toggleSignal(1) }}
              >
                <Popup>
                  <div style={{ color: "#0f172a", minWidth: "180px" }}>
                    <strong>Intersection #1: Arterial Junction</strong>
                    <p style={{ margin: "4px 0", fontSize: "12px" }}>
                      Signal State: <strong style={{ color: signal1State === "PREEMPTIVE_GREEN" ? "#16a34a" : signal1State === "RESTORED_NORMAL" ? "#64748b" : "#dc2626" }}>
                        {signal1State === "PREEMPTIVE_GREEN" ? "🟢 PREEMPTIVE GREEN (20s Advance)" : signal1State === "RESTORED_NORMAL" ? "⚪ RESTORED (Normal Cycle)" : "🔴 RED HOLD (Cross-traffic)"}
                      </strong>
                    </p>
                  </div>
                </Popup>
              </Marker>

              <Marker
                position={routePoints[2] || [12.9140, 77.5165]}
                icon={createCorridorSignalIcon(2, signal2State)}
                eventHandlers={{ click: () => toggleSignal(2) }}
              >
                <Popup>
                  <div style={{ color: "#0f172a", minWidth: "180px" }}>
                    <strong>Intersection #2: Corridor Link</strong>
                    <p style={{ margin: "4px 0", fontSize: "12px" }}>
                      Signal State: <strong style={{ color: signal2State === "PREEMPTIVE_GREEN" ? "#16a34a" : signal2State === "RESTORED_NORMAL" ? "#64748b" : "#dc2626" }}>
                        {signal2State === "PREEMPTIVE_GREEN" ? "🟢 PREEMPTIVE GREEN (20s Advance)" : signal2State === "RESTORED_NORMAL" ? "⚪ RESTORED (Normal Cycle)" : "🔴 RED HOLD (Cross-traffic)"}
                      </strong>
                    </p>
                  </div>
                </Popup>
              </Marker>

              <Marker
                position={routePoints[routePoints.length - 2] || [12.9285, 77.5180]}
                icon={createCorridorSignalIcon(3, signal3State)}
                eventHandlers={{ click: () => toggleSignal(3) }}
              >
                <Popup>
                  <div style={{ color: "#0f172a", minWidth: "180px" }}>
                    <strong>Intersection #3: Hospital Approach</strong>
                    <p style={{ margin: "4px 0", fontSize: "12px" }}>
                      Signal State: <strong style={{ color: signal3State === "PREEMPTIVE_GREEN" ? "#16a34a" : signal3State === "RESTORED_NORMAL" ? "#64748b" : "#dc2626" }}>
                        {signal3State === "PREEMPTIVE_GREEN" ? "🟢 PREEMPTIVE GREEN (20s Advance)" : signal3State === "RESTORED_NORMAL" ? "⚪ RESTORED (Normal Cycle)" : "🔴 RED HOLD (Cross-traffic)"}
                      </strong>
                    </p>
                  </div>
                </Popup>
              </Marker>

              {/* Alternative Candidate Routes (Shortest / Fastest / Congestion-Aware Comparison Polylines) */}
              {routeCandidates &&
                Object.entries(routeCandidates).map(([stratKey, cand]) => {
                  if (stratKey === routeMode || !cand?.route_geometry?.coordinates?.length) return null;
                  const altPositions = cand.route_geometry.coordinates.map((c) => [c[1], c[0]]);
                  const altColor =
                    stratKey === "SHORTEST" ? "#f59e0b" : stratKey === "FASTEST" ? "#818cf8" : "#10b981";
                  return (
                    <Polyline
                      key={`alt-route-${stratKey}`}
                      positions={altPositions}
                      color={altColor}
                      weight={4}
                      opacity={0.55}
                      dashArray="10, 8"
                    >
                      <Popup>
                        <div style={{ color: "#0f172a", minWidth: "180px" }}>
                          <strong>{cand.strategy_title}</strong>
                          <div style={{ fontSize: "11px", marginTop: "3px" }}>
                            Corridor: {cand.primary_corridor}
                          </div>
                          <div style={{ fontSize: "11px" }}>
                            Distance: <strong>{cand.distance_km} km</strong> · ETA:{" "}
                            <strong>{cand.estimated_duration_minutes} min</strong>
                          </div>
                          <div style={{ fontSize: "11px", color: "#dc2626" }}>
                            {cand.traffic_delay_label} ({cand.vs_active})
                          </div>
                        </div>
                      </Popup>
                    </Polyline>
                  );
                })}

              {/* Traveled Route Segment (Solid Green Corridor) */}
              {vehicleState && vehicleState.traveledPoints.length >= 2 && (
                <Polyline
                  positions={vehicleState.traveledPoints}
                  color="#10b981"
                  weight={7}
                  opacity={0.95}
                />
              )}

              {/* Remaining Route Ahead */}
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

          {/* === 2. FLEET STANDBY AMBULANCES (Hidden for Citizen Role to protect operational telemetry) === */}
          {!isCitizenRole && ambulances.map((amb) => {
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

          {/* === 3. ACCIDENT ALERTS (Always shown, tailored for citizen vs operator) === */}
          {accidents.map((acc) => {
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
                        ${isCitizenRole ? 'Public Safety Incident' : `Incident #${acc.id}`}
                      </div>
                    </div>
                  `,
                  iconSize: [140, 52],
                  iconAnchor: [70, 17],
                  popupAnchor: [0, -17],
                })}
              >
                <Popup>
                  <div style={{ minWidth: "180px", color: "#0f172a" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <ShieldAlert size={14} color="#dc2626" />
                      <strong style={{ color: "#dc2626" }}>Accident Collision Reported</strong>
                    </div>
                    <p style={{ margin: "4px 0", fontSize: "12px" }}>
                      Status: <strong>{acc.validation_status}</strong> · Vehicle: <strong>{acc.vehicle_type?.toUpperCase() || 'VEHICLE'}</strong>
                    </p>
                    {!isCitizenRole && nearestAmbulance && (
                      <div style={{ fontSize: "11px", color: "#0284c7", margin: "4px 0" }}>
                        Nearest Unit: <strong>{nearestAmbulance.registration_number}</strong> ({nearestAmbulance.distanceKm} km)
                      </div>
                    )}
                    {!isCitizenRole && (
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
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* === 4. PARTNER HOSPITALS (Shown to all roles) === */}
          {hospitals.map((hosp) => {
            return (
              <Marker
                key={`hosp-${hosp.id}`}
                position={[hosp.latitude, hosp.longitude]}
                icon={createHospitalIcon(hosp.name.split(" ")[0])}
              >
                <Popup>
                  <div style={{ minWidth: "170px", color: "#0f172a" }}>
                    <strong style={{ color: "#15803d" }}>{hosp.name}</strong>
                    <p style={{ margin: "4px 0", fontSize: "12px" }}>{hosp.address}</p>
                    <div style={{ fontSize: "11px", color: "#2563eb", fontWeight: "bold" }}>
                      Emergency Line: {hosp.contact_information || "108"}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* === 5. SECONDARY TRAFFIC INTERSECTIONS (Hidden for Citizen Role) === */}
          {!isCitizenRole && intersections.map((intNode) => {
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

      {/* 2. THREE ROUTE MODE CARDS & ALTERNATIVE ROUTE COMPARISON TABLE */}
      {/* Shown ONLY After Ambulance Assignment / Active Route when inline comparison is enabled */}
      {showComparisonPanel && isCorridorActive && !isCitizenRole && (
        <RouteComparisonPanel
          activeRouteType={routeMode}
          onRouteChange={(newMode) => {
            setRouteMode(newMode);
            arrivalFiredRef.current = false;
            navProgressRef.current = 0;
            setNavProgress(0);
            setIsNavigating(false);
            lastPreemptRef.current = { 1: false, 2: false, 3: false };
            setManualSignalOverrides({ 1: null, 2: null, 3: null });
          }}
          targetHospitalName={hospitals[0]?.name || "Partner Trauma Hospital"}
          candidates={routeCandidates}
        />
      )}
    </div>
  );
}
