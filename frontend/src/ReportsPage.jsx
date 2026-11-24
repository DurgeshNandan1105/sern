import { useState, useMemo } from "react";
import {
  FileText,
  Ambulance,
  Building2,
  Download,
  Printer,
  Compass,
  Zap
} from "lucide-react";
import "./ReportsPage.css";

export default function ReportsPage({
  accidents = [],
  emergencies = [],
  ambulances = [],
  hospitals = [],
  wsStatus = "connected",
  onViewRoute = null,
  onNavigate = null
}) {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const totalAccidents = accidents.length;
  const validatedEmergencies = emergencies.length;
  const resolvedCases = emergencies.filter((e) => e.status === "COMPLETED").length;
  const activeDispatches = emergencies.filter((e) =>
    ["DISPATCHED", "ASSIGNED", "EN_ROUTE", "AT_SCENE", "TRANSPORTING"].includes(e.status)
  ).length;

  const resolutionRate = validatedEmergencies > 0
    ? Math.round((resolvedCases / validatedEmergencies) * 100)
    : 100;

  // Green Corridor stats
  const greenCorridorsCount = emergencies.filter(e =>
    ["DISPATCHED", "EN_ROUTE", "AT_SCENE", "COMPLETED"].includes(e.status)
  ).length;
  const totalMinutesSaved = +(greenCorridorsCount * 4.2).toFixed(1);

  // Filtered emergencies for audit log
  const filteredEmergencies = useMemo(() => {
    return emergencies.filter((em) => {
      if (statusFilter !== "ALL" && em.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const amb = ambulances.find((a) => a.id === em.assigned_ambulance_id);
        const hosp = hospitals.find((h) => h.id === em.hospital_id);
        const matchId = `emg-${em.id}`.toLowerCase().includes(q) || String(em.id).includes(q);
        const matchAcc = `accident #${em.accident_id}`.toLowerCase().includes(q);
        const matchAmb = amb && amb.registration_number.toLowerCase().includes(q);
        const matchHosp = hosp && hosp.name.toLowerCase().includes(q);
        return matchId || matchAcc || matchAmb || matchHosp;
      }
      return true;
    });
  }, [emergencies, statusFilter, searchQuery, ambulances, hospitals]);

  // Export to CSV functionality
  const handleExportCSV = () => {
    if (emergencies.length === 0) {
      alert("No emergency audit data available to export.");
      return;
    }

    const headers = [
      "Emergency ID",
      "Accident ID",
      "Assigned Ambulance",
      "Hospital Name",
      "Status",
      "Green Corridor Engaged",
      "Created At",
      "Notes"
    ];

    const rows = emergencies.map((em) => {
      const amb = ambulances.find((a) => a.id === em.assigned_ambulance_id);
      const hosp = hospitals.find((h) => h.id === em.hospital_id);
      return [
        `EMG-${em.id}`,
        `ACC-${em.accident_id}`,
        amb ? amb.registration_number : "Unassigned",
        hosp ? `"${hosp.name}"` : "Pending Admission",
        em.status,
        "YES",
        `"${new Date(em.created_at).toISOString()}"`,
        `"${(em.notes || "Operational dispatch logged").replace(/"/g, '""')}"`
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SERN_Emergency_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="reports-page">
      {/* HEADER */}
      <div className="reports-header">
        <div>
          <h2>
            <FileText size={26} color="#60a5fa" style={{ display: "inline", verticalAlign: "middle", marginRight: "10px" }} />
            System Performance & Operational Reports
          </h2>
          <p>
            Real-time audit metrics, emergency lifecycle traces, and smart green-corridor performance records
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <div className="traffic-status-pill" style={{ background: "rgba(96, 165, 250, 0.15)", borderColor: "rgba(96, 165, 250, 0.35)", color: "#60a5fa" }}>
            <span className="traffic-pulse-dot" />
            {wsStatus === "connected" ? "REAL-TIME AUDIT STREAM ACTIVE" : "SYNCING RECORDS..."}
          </div>

          <button className="filter-btn" onClick={handleExportCSV} title="Download CSV Audit Record">
            <Download size={14} />
            Export CSV
          </button>

          <button className="filter-btn" onClick={handlePrint} title="Print / PDF Operational Report">
            <Printer size={14} />
            Print Report
          </button>
        </div>
      </div>

      {/* METRICS STATS CARDS */}
      <div className="reports-stats">
        <div className="report-stat-card">
          <h3>Total Telemetry Records</h3>
          <h2>{totalAccidents}</h2>
          <p>Sensor events captured</p>
        </div>

        <div className="report-stat-card">
          <h3>Validated Emergencies</h3>
          <h2 style={{ color: "#f87171" }}>{validatedEmergencies}</h2>
          <p>Operator-confirmed collisions</p>
        </div>

        <div className="report-stat-card">
          <h3>Active Fleet Missions</h3>
          <h2 style={{ color: "#38bdf8" }}>{activeDispatches}</h2>
          <p>Units deployed & en-route</p>
        </div>

        <div className="report-stat-card">
          <h3>Green Corridors Engaged</h3>
          <h2 style={{ color: "#34d399" }}>{greenCorridorsCount}</h2>
          <p>{totalMinutesSaved} mins saved · {resolutionRate}% resolved</p>
        </div>
      </div>

      {/* AUDIT LOG TABLE PANEL */}
      <div style={{ marginTop: "24px" }} className="panel">
        <div className="panel-heading" style={{ flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h3>Emergency Operational Audit Log</h3>
            <p>Real-time lifecycle tracking: detection, validation, dispatch, signal preemption & completion</p>
          </div>

          {/* TABLE FILTERS & SEARCH */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <div className="toolbar-filters">
              <button
                className={`filter-btn ${statusFilter === "ALL" ? "active" : ""}`}
                onClick={() => setStatusFilter("ALL")}
              >
                All ({emergencies.length})
              </button>
              <button
                className={`filter-btn ${statusFilter === "DISPATCHED" ? "active" : ""}`}
                onClick={() => setStatusFilter("DISPATCHED")}
              >
                Dispatched
              </button>
              <button
                className={`filter-btn ${statusFilter === "EN_ROUTE" ? "active" : ""}`}
                onClick={() => setStatusFilter("EN_ROUTE")}
              >
                En Route
              </button>
              <button
                className={`filter-btn ${statusFilter === "COMPLETED" ? "active" : ""}`}
                onClick={() => setStatusFilter("COMPLETED")}
              >
                Completed ({resolvedCases})
              </button>
            </div>

            <input
              type="text"
              placeholder="Search emergency, ambulance..."
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

        {filteredEmergencies.length === 0 ? (
          <p style={{ padding: "28px", color: "#64748b", textAlign: "center" }}>
            No matching emergency operational records found.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginTop: "10px" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #1e293b", color: "#94a3b8" }}>
                  <th style={{ padding: "12px" }}>Emergency ID</th>
                  <th style={{ padding: "12px" }}>Accident Ref</th>
                  <th style={{ padding: "12px" }}>Assigned Ambulance</th>
                  <th style={{ padding: "12px" }}>Hospital Assigned</th>
                  <th style={{ padding: "12px" }}>Traffic Preemption</th>
                  <th style={{ padding: "12px" }}>Current Status</th>
                  <th style={{ padding: "12px" }}>Reported Time</th>
                  <th style={{ padding: "12px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmergencies.map((em) => {
                  const amb = ambulances.find((a) => a.id === em.assigned_ambulance_id);
                  const hosp = hospitals.find((h) => h.id === em.hospital_id);
                  const isDone = em.status === "COMPLETED";
                  const isDispatched = ["DISPATCHED", "ASSIGNED", "EN_ROUTE"].includes(em.status);

                  return (
                    <tr key={em.id} style={{ borderBottom: "1px solid #1e293b" }}>
                      <td style={{ padding: "14px 12px", fontWeight: "700", color: "#f8fafc" }}>
                        EMG-#{em.id}
                      </td>
                      <td style={{ padding: "14px 12px", color: "#60a5fa" }}>
                        Accident #{em.accident_id}
                      </td>
                      <td style={{ padding: "14px 12px" }}>
                        {amb ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <Ambulance size={14} color="#60a5fa" />
                            <strong>{amb.registration_number}</strong>
                          </span>
                        ) : (
                          <span style={{ color: "#64748b" }}>Unassigned</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 12px" }}>
                        {hosp ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#34d399" }}>
                            <Building2 size={14} />
                            {hosp.name}
                          </span>
                        ) : (
                          <span style={{ color: "#64748b" }}>Pending Admission</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 12px" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          fontSize: "11px",
                          fontWeight: "700",
                          color: isDispatched ? "#34d399" : "#94a3b8"
                        }}>
                          <Zap size={12} color={isDispatched ? "#34d399" : "#64748b"} />
                          {isDispatched ? "GREEN LOCKED" : "CLEARED"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 12px" }}>
                        <span className={`badge-tag ${isDone ? "badge-completed" : "badge-dispatched"}`}>
                          {em.status}
                        </span>
                      </td>
                      <td style={{ padding: "14px 12px", color: "#94a3b8" }}>
                        {new Date(em.created_at).toLocaleDateString()} {new Date(em.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td style={{ padding: "14px 12px" }}>
                        <button
                          className="btn-preempt"
                          style={{ padding: "5px 10px", fontSize: "11px" }}
                          onClick={() => {
                            if (onViewRoute) onViewRoute(em.id);
                            if (onNavigate) onNavigate("Dashboard");
                          }}
                        >
                          <Compass size={12} />
                          Map
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
