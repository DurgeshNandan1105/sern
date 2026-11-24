import { useMemo } from "react";
import { ShieldAlert, GitFork, Check } from "lucide-react";
import "./RouteComparisonPanel.css";

const DEFAULT_ROUTE_OPTIONS = [
  {
    id: "SHORTEST",
    title: "Shortest Route",
    subtitle: "Minimum Travel Distance",
    desc: "Selects the most direct road corridor to keep total travel distance as short as possible.",
    primaryCorridor: "Dr. Vishnuvardhan Rd -> RR Nagar...",
    fullCorridor: "Dr. Vishnuvardhan Rd -> RR Nagar Double Rd -> Ideal Homes Arterial",
    distanceKm: 5.29,
    etaText: "19m 49s",
    etaColor: "#f59e0b",
    avgSpeedText: "16 km/h",
    delayText: "+7m 50s",
    delayColor: "#ef4444",
    vsActive: "+5m 02s slower",
    delayedSection: "Jawaharlal Nehru Rd (BEML 5th Stage - Ideal Homes) (HIGH)",
    hasDelayedSection: true,
  },
  {
    id: "FASTEST",
    title: "Fastest Route",
    subtitle: "Highest Free-Flow Road Speed",
    desc: "Prioritizes major arterial roads and highways for higher ambulance cruising speeds.",
    primaryCorridor: "Dr. Vishnuvardhan Rd -> RR Nagar...",
    fullCorridor: "Dr. Vishnuvardhan Rd -> RR Nagar Double Rd -> Ideal Homes Arterial",
    distanceKm: 5.29,
    etaText: "19m 49s",
    etaColor: "#f59e0b",
    avgSpeedText: "16 km/h",
    delayText: "+7m 50s",
    delayColor: "#ef4444",
    vsActive: "+5m 02s slower",
    delayedSection: "Jawaharlal Nehru Rd (BEML 5th Stage - Ideal Homes) (HIGH)",
    hasDelayedSection: true,
  },
  {
    id: "CONGESTION_AWARE",
    title: "Congestion-Aware Route",
    subtitle: "Traffic-Adjusted Optimal ETA",
    desc: "Accounts for live simulated road congestion to bypass delays and minimize arrival time.",
    primaryCorridor: "Dr. Vishnuvardhan Rd -> Kenchen...",
    fullCorridor: "Dr. Vishnuvardhan Rd -> Kenchenahalli Main Rd -> Ideal Homes Arterial",
    distanceKm: 6.87,
    etaText: "14m 47s",
    etaColor: "#10b981",
    avgSpeedText: "27.9 km/h",
    delayText: "No delay",
    delayColor: "#10b981",
    vsActive: "Selected",
    delayedSection: null,
    hasDelayedSection: false,
  }
];

export default function RouteComparisonPanel({
  activeRouteType = "CONGESTION_AWARE",
  onRouteChange = null,
  targetHospitalName = "SPARSH RR Nagar",
  candidates = null
}) {
  const routeOptions = useMemo(() => {
    if (!candidates) return DEFAULT_ROUTE_OPTIONS;
    return DEFAULT_ROUTE_OPTIONS.map((def) => {
      const cand = candidates[def.id];
      if (!cand) return def;
      const dur = cand.estimated_duration_minutes || 14.8;
      const min = Math.floor(dur);
      const sec = Math.round((dur % 1) * 60);
      return {
        ...def,
        primaryCorridor: cand.primary_corridor || def.primaryCorridor,
        fullCorridor: cand.primary_corridor || def.fullCorridor,
        distanceKm: cand.distance_km || def.distanceKm,
        etaText: `${min}m ${sec.toString().padStart(2, "0")}s`,
        avgSpeedText: `${cand.average_speed_kmh || 25} km/h`,
        delayText: cand.traffic_delay_label || def.delayText,
        delayedSection: cand.delayed_road_sections?.join(", ") || def.delayedSection,
        hasDelayedSection: Boolean(cand.delayed_road_sections && cand.delayed_road_sections.length > 0),
      };
    });
  }, [candidates]);

  return (
    <div className="route-comparison-container">
      {/* 1. THREE ROUTE MODE CARDS (Image 2) */}
      <div className="route-cards-grid">
        {routeOptions.map((route) => {
          const isActive = activeRouteType === route.id;

          return (
            <div
              key={route.id}
              className={`route-card ${isActive ? "active-route" : ""}`}
            >
              <div>
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
                    <strong>{route.primaryCorridor}</strong>
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
                {isActive ? (
                  <>Currently Active</>
                ) : (
                  <>Select {route.title}</>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* 2. ALTERNATIVE ROUTE COMPARISON TABLE (Image 3) */}
      <div className="route-table-panel">
        <div className="route-table-header">
          <h3>
            <GitFork size={20} color="#38bdf8" />
            Alternative Route Comparison
          </h3>
          <div className="route-table-meta">
            Live comparison for {targetHospitalName}
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
                      {isActive && <span className="table-badge-active">Active</span>}
                    </td>

                    <td className="corridor-cell">
                      {route.fullCorridor}
                    </td>

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
