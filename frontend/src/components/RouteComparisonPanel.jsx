import { useMemo } from "react";
import { ShieldAlert, GitFork, Check, Sparkles } from "lucide-react";
import "./RouteComparisonPanel.css";

const STRATEGY_METADATA = [
  {
    id: "SHORTEST",
    title: "Shortest Route",
    subtitle: "Minimum Travel Distance",
    desc: "Uses Dijkstra distance weights to select the most direct road corridor with minimum km.",
  },
  {
    id: "FASTEST",
    title: "Fastest Route",
    subtitle: "Highest Free-Flow Road Speed",
    desc: "Uses Dijkstra free-flow time weights to prioritize major arterials and flyovers.",
  },
  {
    id: "CONGESTION_AWARE",
    title: "Congestion-Aware Route",
    subtitle: "Traffic-Adjusted Optimal ETA",
    desc: "Accounts for live intersection congestion to bypass delays and minimize arrival time.",
  },
];

function formatDurationMinutes(durationMin) {
  const safeMin = Math.max(0.1, Number(durationMin) || 0);
  const mins = Math.floor(safeMin);
  const secs = Math.round((safeMin - mins) * 60);
  if (secs === 60) {
    return `${mins + 1}m 00s`;
  }
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

export default function RouteComparisonPanel({
  activeRouteType = "CONGESTION_AWARE",
  onRouteChange = null,
  targetHospitalName = "Partner Trauma Hospital",
  candidates = null,
}) {
  const routeOptions = useMemo(() => {
    if (!candidates || Object.keys(candidates).length === 0) {
      return [];
    }

    const activeCand = candidates[activeRouteType] || candidates.CONGESTION_AWARE || candidates.FASTEST || candidates.SHORTEST;
    const activeEta = activeCand?.estimated_duration_minutes ?? 0;

    return STRATEGY_METADATA.map((meta) => {
      const cand = candidates[meta.id];
      if (!cand) return null;

      const dur = Number(cand.estimated_duration_minutes || 0);
      const delayMins = Number(cand.traffic_delay_minutes || 0);
      const isOptimal = Boolean(cand.is_optimal);
      const isSelected = activeRouteType === meta.id;

      // Calculate live comparison vs currently active route
      let vsActiveText = cand.vs_active || "Computed";
      if (isSelected) {
        vsActiveText = isOptimal ? "Selected (Optimal)" : "Currently Active";
      } else if (activeEta > 0) {
        const diff = dur - activeEta;
        if (Math.abs(diff) < 0.08) {
          vsActiveText = delayMins > 0.4 ? "Equal ETA (Higher delay)" : "Same ETA";
        } else if (diff > 0) {
          vsActiveText = `+${formatDurationMinutes(diff)} slower`;
        } else {
          vsActiveText = `${formatDurationMinutes(Math.abs(diff))} faster`;
        }
      }

      const fullCorridor = cand.primary_corridor || "Bengaluru Arterial Road Network";
      const shortCorridor = fullCorridor.length > 34 ? `${fullCorridor.slice(0, 34)}...` : fullCorridor;
      const hasDelayed = Array.isArray(cand.delayed_road_sections) && cand.delayed_road_sections.length > 0;

      const etaColor = isOptimal || delayMins < 0.5 ? "#10b981" : delayMins >= 2.0 ? "#f59e0b" : "#38bdf8";
      const delayColor = delayMins >= 0.4 ? "#ef4444" : "#10b981";

      return {
        ...meta,
        primaryCorridor: shortCorridor,
        fullCorridor,
        distanceKm: Number(cand.distance_km || 0),
        etaText: formatDurationMinutes(dur),
        etaColor,
        avgSpeedText: `${cand.average_speed_kmh || 30} km/h`,
        delayText: cand.traffic_delay_label || "No delay",
        delayColor,
        vsActive: vsActiveText,
        delayedSection: hasDelayed ? cand.delayed_road_sections.join(" · ") : null,
        hasDelayedSection: hasDelayed,
        isOptimal,
        optimalBadge: cand.optimal_badge || (isOptimal ? "OPTIMAL ROUTE SELECTED" : null),
      };
    }).filter(Boolean);
  }, [candidates, activeRouteType]);

  if (routeOptions.length === 0) {
    return null;
  }

  return (
    <div className="route-comparison-container">
      {/* 1. THREE LIVE DIJKSTRA ROUTE MODE CARDS */}
      <div className="route-cards-grid">
        {routeOptions.map((route) => {
          const isActive = activeRouteType === route.id;

          return (
            <div
              key={route.id}
              className={`route-card ${isActive ? "active-route" : ""}`}
            >
              <div>
                {route.isOptimal && (
                  <div className="route-card-badge-optimal">
                    <Sparkles size={11} /> {route.optimalBadge || "OPTIMAL ROUTE SELECTED"}
                  </div>
                )}

                <div className="route-card-header">
                  <h3>{route.title}</h3>
                  {isActive && (
                    <span className="route-card-badge-active">
                      <Check size={12} /> Active
                    </span>
                  )}
                </div>

                <div className="route-card-subtitle">{route.subtitle}</div>
                <p className="route-card-desc">{route.desc}</p>

                <div className="route-card-details">
                  <div className="route-detail-row">
                    <span>Primary Corridor</span>
                    <strong title={route.fullCorridor}>{route.primaryCorridor}</strong>
                  </div>

                  <div className="route-detail-row">
                    <span>Estimated Distance</span>
                    <strong>{route.distanceKm.toFixed(2)} km</strong>
                  </div>

                  <div className="route-detail-row">
                    <span>Estimated Arrival Time</span>
                    <strong style={{ color: route.etaColor }}>{route.etaText}</strong>
                  </div>

                  <div className="route-detail-row">
                    <span>Average Travel Speed</span>
                    <strong>{route.avgSpeedText}</strong>
                  </div>

                  <div className="route-detail-row">
                    <span>Traffic Delay</span>
                    <strong style={{ color: route.delayColor }}>{route.delayText}</strong>
                  </div>
                </div>

                {route.hasDelayedSection && (
                  <div className="route-delay-banner">
                    <div className="route-delay-banner-title">
                      <ShieldAlert size={14} /> Delayed Road Sections
                    </div>
                    <div className="route-delay-banner-text">
                      {route.delayedSection}
                    </div>
                  </div>
                )}
              </div>

              <button
                className={`btn-route-action ${isActive ? "btn-route-active" : ""}`}
                onClick={() => {
                  if (!isActive && onRouteChange) onRouteChange(route.id);
                }}
              >
                {isActive ? <>Currently Active</> : <>Select {route.title}</>}
              </button>
            </div>
          );
        })}
      </div>

      {/* 2. LIVE ALTERNATIVE ROUTE COMPARISON TABLE */}
      <div className="route-table-panel">
        <div className="route-table-header">
          <h3>
            <GitFork size={20} color="#38bdf8" />
            Alternative Route Comparison (Live Dijkstra Engine)
          </h3>
          <div className="route-table-meta">
            Live comparison to {targetHospitalName}
          </div>
        </div>

        <div className="route-table-wrapper">
          <table className="route-comparison-table">
            <thead>
              <tr>
                <th>Route Type</th>
                <th>Corridor</th>
                <th>Distance</th>
                <th>Arrival Time</th>
                <th>vs Active Route</th>
                <th>Traffic Status</th>
                <th>Avg Speed</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {routeOptions.map((route) => {
                const isActive = activeRouteType === route.id;

                return (
                  <tr key={route.id} className={isActive ? "table-active-row" : ""}>
                    <td className="route-name-cell">
                      <strong>{route.title}</strong>
                      {route.isOptimal && (
                        <span className="table-badge-active" style={{ background: "rgba(56, 189, 248, 0.16)", color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.4)" }}>
                          Optimal
                        </span>
                      )}
                      {isActive && <span className="table-badge-active">Active</span>}
                    </td>

                    <td className="corridor-cell">{route.fullCorridor}</td>

                    <td>{route.distanceKm.toFixed(2)} km</td>

                    <td style={{ color: route.etaColor, fontWeight: "bold" }}>
                      {route.etaText}
                    </td>

                    <td style={{ color: isActive ? "#34d399" : "#fbbf24", fontWeight: "600" }}>
                      {route.vsActive}
                    </td>

                    <td>
                      <span style={{ color: route.delayColor, fontWeight: "600" }}>
                        {route.delayText === "No delay" ? "Clear" : route.delayText}
                      </span>
                    </td>

                    <td>{route.avgSpeedText}</td>

                    <td>
                      {isActive ? (
                        <span style={{ color: "#34d399", fontWeight: "700" }}>Active</span>
                      ) : (
                        <button
                          className="btn-table-switch"
                          onClick={() => {
                            if (onRouteChange) onRouteChange(route.id);
                          }}
                        >
                          Switch
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
