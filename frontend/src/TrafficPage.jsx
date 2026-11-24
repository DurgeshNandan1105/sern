import { useState, useEffect, useCallback } from "react";
import {
  Navigation,
  Activity,
  Zap,
  RotateCcw,
  RefreshCw,
  Radio,
  CheckCircle2,
  Clock,
  Compass
} from "lucide-react";
import { sernApi } from "./services/api";
import RouteComparisonPanel from "./components/RouteComparisonPanel";
import "./TrafficPage.css";

export default function TrafficPage({
  emergencies = [],
  ambulances = [],
  hospitals = [],
  selectedRoute = null,
  routeMode = null,
  onRouteModeChange = null,
  wsStatus = "connected",
  onViewRoute = null,
  onNavigate = null,
}) {
  const [intersections, setIntersections] = useState([]);
  const [activeCorridors, setActiveCorridors] = useState({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("ALL"); // ALL, PREEMPTED, CONGESTED
  const [searchQuery, setSearchQuery] = useState("");
  const [autoOptimizing, setAutoOptimizing] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Active Dispatched Emergency
  const activeEmergency = emergencies.find((e) =>
    ["DISPATCHED", "ASSIGNED", "EN_ROUTE", "AT_SCENE", "TRANSPORTING"].includes(e.status)
  );
  const activeAmbulance = ambulances.find((a) =>
    ["DISPATCHED", "ASSIGNED", "EN_ROUTE", "AT_SCENE", "TRANSPORTING"].includes(a.status)
  );
  const targetHospitalName =
    hospitals.find((h) => h.id === activeEmergency?.hospital_id)?.name ||
    hospitals[0]?.name ||
    "Partner Trauma Hospital";

  // Fetch Intersections & Corridors
  const fetchTrafficData = useCallback(async () => {
    try {
      setLoading(true);
      const [intRes, corrRes] = await Promise.allSettled([
        sernApi.getTrafficIntersections(),
        sernApi.getTrafficCorridors()
      ]);
      if (intRes.status === "fulfilled" && Array.isArray(intRes.value)) {
        setIntersections(intRes.value);
      }
      if (corrRes.status === "fulfilled" && corrRes.value) {
        setActiveCorridors(corrRes.value);
      }
    } catch (err) {
      console.debug("Failed to load traffic data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    sernApi.getTrafficIntersections().then((res) => {
      if (isMounted && Array.isArray(res)) setIntersections(res);
    }).catch(() => {});
    sernApi.getTrafficCorridors().then((res) => {
      if (isMounted && res) setActiveCorridors(res);
    }).catch(() => {});

    const interval = setInterval(fetchTrafficData, 10000); // 10s auto-refresh
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchTrafficData]);

  // Real-Time 1-second Countdown Ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setIntersections((prevList) =>
        prevList.map((item) => {
          if (item.signal_state === "GREEN_PREEMPTION") {
            // Held green for corridor
            return item;
          }
          const nextSec = (item.countdown_seconds || 30) - 1;
          if (nextSec <= 0) {
            // Cycle signal state
            const nextState =
              item.signal_state === "NORMAL_CYCLE" ? "CAUTION_AMBER" :
              item.signal_state === "CAUTION_AMBER" ? "HOLD_RED" : "NORMAL_CYCLE";
            return {
              ...item,
              signal_state: nextState,
              countdown_seconds: item.cycle_duration || 60,
            };
          }
          return { ...item, countdown_seconds: nextSec };
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Preemption Toggle
  const handleTogglePreemption = async (intId) => {
    try {
      const res = await sernApi.preemptTrafficSignal({
        intersection_id: intId,
        action: "TOGGLE"
      });
      setIntersections((prev) =>
        prev.map((item) => (item.id === intId ? { ...item, ...res } : item))
      );
      showNotice(`Signal for ${res.name} updated to ${res.signal_state}`);
    } catch (err) {
      alert(`Preemption update failed: ${err.message}`);
    }
  };

  // Congestion Level Adjustment (Simulate Traffic Surge or Clearing)
  const handleCongestionChange = async (intId, newCongestion) => {
    try {
      const res = await sernApi.updateTrafficCongestion({
        intersection_id: intId,
        congestion_index: newCongestion,
        recalculate_active_routes: true
      });
      setIntersections((prev) =>
        prev.map((item) => (item.id === intId ? { ...item, ...res.node } : item))
      );
      if (res.recalculated_routes_count > 0) {
        showNotice(`Traffic surge applied! Dynamic router re-optimized ${res.recalculated_routes_count} active emergency route(s) to avoid delay.`);
      } else {
        showNotice(`Congestion on ${res.node.name} updated to ${newCongestion}%.`);
      }
    } catch (err) {
      alert(`Congestion update failed: ${err.message}`);
    }
  };

  // Force Dynamic Route Recalculation
  const handleRecalculateRoute = async (emId) => {
    try {
      setAutoOptimizing(true);
      const res = await sernApi.recalculateRoute(emId, true);
      showNotice(`Dynamic OpenStreetMap route recalculated: ${res.distance_km} km in ${res.estimated_duration_minutes} mins (green corridor active).`);
      if (onViewRoute) {
        onViewRoute(emId, true);
      }
      fetchTrafficData();
    } catch (err) {
      alert(`Rerouting failed: ${err.message}`);
    } finally {
      setAutoOptimizing(false);
    }
  };

  // Reset All Signals
  const handleResetSignals = async () => {
    try {
      await sernApi.resetTrafficSignals();
      await fetchTrafficData();
      showNotice("All city signals restored to standard cycles.");
    } catch (err) {
      alert(`Reset failed: ${err.message}`);
    }
  };

  const showNotice = (msg) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4500);
  };

  // Metrics Calculations
  const totalIntersections = intersections.length;
  const preemptedCount = intersections.filter(
    (i) => i.signal_state === "GREEN_PREEMPTION" || i.green_corridor_active
  ).length;
  const avgCongestion = totalIntersections > 0
    ? Math.round(intersections.reduce((acc, c) => acc + (c.congestion_index || 0), 0) / totalIntersections)
    : 34;

  // Filtered List
  const filteredIntersections = intersections.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.roads && item.roads.some((r) => r.toLowerCase().includes(searchQuery.toLowerCase())));
    if (!matchesSearch) return false;

    if (filter === "PREEMPTED") return item.signal_state === "GREEN_PREEMPTION";
    if (filter === "CONGESTED") return (item.congestion_index || 0) >= 50;
    return true;
  });

  return (
    <div className="traffic-page-container">
      {/* HEADER */}
      <div className="traffic-header">
        <div>
          <h2>
            <Navigation size={26} color="#38bdf8" />
            Intelligent Traffic & Smart Signal Prioritization
          </h2>
          <p>
            OpenStreetMap road-network routing, dynamic congestion evaluation, and automated green corridor preemption
          </p>
        </div>

        <div className="traffic-header-actions">
          <div className={`traffic-status-pill ${wsStatus !== "connected" ? "connecting" : ""}`}>
            <span className="traffic-pulse-dot" />
            {wsStatus === "connected" ? "REAL-TIME TELEMETRY CONNECTED" : "RECONNECTING WS FEED..."}
          </div>

          <button
            className="filter-btn"
            onClick={fetchTrafficData}
            title="Refresh traffic status"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            Sync
          </button>

          <button
            className="filter-btn"
            onClick={handleResetSignals}
            title="Reset all signals to normal cycle"
          >
            <RotateCcw size={14} />
            Reset Cycles
          </button>
        </div>
      </div>

      {/* STATUS BANNER NOTIFICATION */}
      {statusMessage && (
        <div style={{
          background: "#1e3a8a",
          border: "1px solid #3b82f6",
          padding: "10px 16px",
          borderRadius: "8px",
          fontSize: "13px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: "#93c5fd"
        }}>
          <CheckCircle2 size={16} color="#60a5fa" />
          {statusMessage}
        </div>
      )}

      {/* ACTIVE EMERGENCY GREEN CORRIDOR BANNER */}
      <div className={`corridor-banner ${activeEmergency ? "active-corridor" : ""}`}>
        <div>
          <div className="corridor-banner-title">
            <Radio size={22} color={activeEmergency ? "#34d399" : "#60a5fa"} />
            <h3>
              {activeEmergency
                ? `Green Corridor Active: Emergency #EMG-${activeEmergency.id}`
                : "Signal Prioritization Network: Standby Readiness"}
            </h3>
          </div>

          <p style={{ color: "#94a3b8", fontSize: "13px" }}>
            {activeEmergency
              ? `Automated preemption locks signals along the route green for ambulance ${activeAmbulance ? activeAmbulance.registration_number : "unit"}, holding cross-traffic until clearance.`
              : "All 12 intersection controllers are synchronized with CAD dispatch. Fast-track corridors engage automatically upon operator accident validation."}
          </p>

          {activeEmergency && (
            <div className="corridor-banner-meta">
              <span>Ambulance: <strong>{activeAmbulance ? activeAmbulance.registration_number : "Assigned"}</strong></span>
              <span>Route Distance: <strong>{selectedRoute?.distance_km || "4.8"} km</strong></span>
              <span>Estimated Travel Time: <strong>{selectedRoute?.estimated_duration_minutes || "8.5"} min</strong></span>
              <span>Active Corridors: <strong>{Object.keys(activeCorridors).length || 1}</strong></span>
              <span>Time Saved: <strong style={{ color: "#34d399" }}>~4.2 mins</strong></span>
            </div>
          )}
        </div>

        {activeEmergency && (
          <div className="corridor-banner-actions">
            <button
              className="btn-preempt"
              style={{ padding: "10px 18px", fontSize: "13px" }}
              onClick={() => {
                if (onViewRoute) onViewRoute(activeEmergency.id);
                if (onNavigate) onNavigate("Dashboard");
              }}
            >
              <Compass size={16} />
              View on Live Map
            </button>

            <button
              className="filter-btn"
              style={{ background: "#0f172a", borderColor: "#3b82f6", color: "#60a5fa" }}
              onClick={() => handleRecalculateRoute(activeEmergency.id)}
              disabled={autoOptimizing}
            >
              <Activity size={14} className={autoOptimizing ? "spin" : ""} />
              {autoOptimizing ? "Rerouting..." : "Avoid Congestion & Reroute"}
            </button>
          </div>
        )}
      </div>

      {/* ALTERNATIVE ROUTE COMPARISON (Shown during active emergency) */}
      {activeEmergency && (selectedRoute?.candidates || selectedRoute?.route_geometry?.candidates) && (
        <RouteComparisonPanel
          activeRouteType={routeMode || selectedRoute?.selected_strategy || selectedRoute?.route_geometry?.selected_candidate || "CONGESTION_AWARE"}
          onRouteChange={(newMode) => {
            if (onRouteModeChange) {
              onRouteModeChange(newMode);
            } else {
              handleRecalculateRoute(activeEmergency.id);
            }
          }}
          targetHospitalName={targetHospitalName}
          candidates={selectedRoute?.candidates || selectedRoute?.route_geometry?.candidates}
        />
      )}

      {/* METRIC CARDS */}
      <div className="traffic-metrics-grid">
        <div className="traffic-metric-card">
          <h4>Monitored Intersections</h4>
          <div className="metric-val">{totalIntersections}</div>
          <p>Bengaluru Arterial Grid (OSM)</p>
        </div>

        <div className="traffic-metric-card">
          <h4>Green Preemptions Active</h4>
          <div className="metric-val" style={{ color: preemptedCount > 0 ? "#34d399" : "#60a5fa" }}>
            {preemptedCount}
          </div>
          <p>{preemptedCount > 0 ? "Fast-track corridor locked" : "All standard urban cycles"}</p>
        </div>

        <div className="traffic-metric-card">
          <h4>Network Avg Congestion</h4>
          <div className="metric-val" style={{ color: avgCongestion > 50 ? "#f87171" : "#34d399" }}>
            {avgCongestion}%
          </div>
          <p>{avgCongestion > 50 ? "Elevated peak volume" : "Smooth arterial flow"}</p>
        </div>

        <div className="traffic-metric-card">
          <h4>Avg Preemption Time Saved</h4>
          <div className="metric-val" style={{ color: "#38bdf8" }}>38.5%</div>
          <p>~4.2 min response latency drop</p>
        </div>
      </div>

      {/* INTERSECTIONS CONTROL PANEL */}
      <div className="traffic-control-panel">
        <div className="panel-toolbar">
          <div className="toolbar-filters">
            <button
              className={`filter-btn ${filter === "ALL" ? "active" : ""}`}
              onClick={() => setFilter("ALL")}
            >
              All Intersections ({intersections.length})
            </button>
            <button
              className={`filter-btn ${filter === "PREEMPTED" ? "active" : ""}`}
              onClick={() => setFilter("PREEMPTED")}
            >
              Green Corridors ({preemptedCount})
            </button>
            <button
              className={`filter-btn ${filter === "CONGESTED" ? "active" : ""}`}
              onClick={() => setFilter("CONGESTED")}
            >
              Congested {'>'}50%
            </button>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              placeholder="Search intersection or road..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid #334155",
                background: "#090d16",
                color: "#e2e8f0",
                fontSize: "13px"
              }}
            />
          </div>
        </div>

        {/* INTERSECTION CARDS */}
        <div className="intersections-grid">
          {filteredIntersections.map((intNode) => {
            const isPreempted =
              intNode.signal_state === "GREEN_PREEMPTION" || intNode.green_corridor_active;
            const isRed = intNode.signal_state === "HOLD_RED";
            const isAmber = intNode.signal_state === "CAUTION_AMBER";
            const congestion = intNode.congestion_index || 0;

            const stateClass = isPreempted
              ? "state-green"
              : isRed
              ? "state-red"
              : isAmber
              ? "state-amber"
              : "state-green";

            return (
              <div
                key={intNode.id}
                className={`intersection-card ${isPreempted ? "preempted" : ""}`}
              >
                <div className="intersection-card-header">
                  <div>
                    <h4>{intNode.name}</h4>
                    <div className="intersection-roads">
                      {intNode.roads ? intNode.roads.join(" · ") : "Arterial Link"}
                    </div>
                  </div>

                  <div className={`mini-traffic-light ${stateClass}`}>
                    <div className="signal-bulb red" />
                    <div className="signal-bulb amber" />
                    <div className="signal-bulb green" />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    className={`signal-badge ${
                      isPreempted ? "badge-green" : isRed ? "badge-red" : isAmber ? "badge-amber" : "badge-green"
                    }`}
                  >
                    {isPreempted ? "● GREEN PREEMPTION" : isRed ? "● HOLD RED" : isAmber ? "● CAUTION AMBER" : "● NORMAL CYCLE"}
                  </span>

                  <span style={{ fontSize: "12px", color: "#cbd5e1", fontWeight: "600" }}>
                    <Clock size={12} style={{ display: "inline", marginRight: "4px" }} />
                    {isPreempted ? "LOCKED" : `${intNode.countdown_seconds || 30}s`}
                  </span>
                </div>

                {/* Congestion Meter */}
                <div className="congestion-bar-container">
                  <div className="congestion-label">
                    <span>Congestion Level</span>
                    <strong style={{ color: congestion > 65 ? "#f87171" : congestion > 40 ? "#fbbf24" : "#34d399" }}>
                      {congestion}% {congestion > 65 ? "(Heavy)" : congestion > 40 ? "(Moderate)" : "(Clear)"}
                    </strong>
                  </div>
                  <div className="congestion-track">
                    <div
                      className="congestion-fill"
                      style={{
                        width: `${congestion}%`,
                        background: congestion > 65 ? "#ef4444" : congestion > 40 ? "#f59e0b" : "#10b981"
                      }}
                    />
                  </div>
                </div>

                {/* Footer Flow Stats */}
                <div className="card-footer-stats">
                  <span>Flow: {intNode.flow_rate_vph || 1400} vph</span>
                  <span>Avg Speed: {intNode.avg_speed_kmh || 38} km/h</span>
                </div>

                {/* Control Actions */}
                <div className="card-actions">
                  <button
                    className={`btn-preempt ${isPreempted ? "preempt-active" : ""}`}
                    onClick={() => handleTogglePreemption(intNode.id)}
                  >
                    <Zap size={14} />
                    {isPreempted ? "Clear Preemption" : "Force Green Light"}
                  </button>

                  <button
                    className="btn-congestion-test"
                    onClick={() => handleCongestionChange(intNode.id, congestion > 60 ? 25 : 85)}
                    title="Toggle simulated congestion spike to test dynamic rerouting"
                  >
                    {congestion > 60 ? "Clear Jam" : "Simulate Jam"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
