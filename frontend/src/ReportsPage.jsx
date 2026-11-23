import { FileText, ShieldCheck, Ambulance, Building2 } from "lucide-react";

function ReportsPage({ accidents = [], emergencies = [], ambulances = [], hospitals = [] }) {
  const totalAccidents = accidents.length;
  const validatedEmergencies = emergencies.length;
  const resolvedCases = emergencies.filter(e => e.status === "COMPLETED").length;
  const activeDispatches = emergencies.filter(e =>
    ["DISPATCHED", "EN_ROUTE", "AT_SCENE", "TRANSPORTING"].includes(e.status)
  ).length;
  const resolutionRate = validatedEmergencies > 0
    ? Math.round((resolvedCases / validatedEmergencies) * 100)
    : 100;

  return (
    <div className="reports-page">
      <div className="reports-header">
        <div>
          <h2>System Performance & Operational Reports</h2>
          <p>Real-time audit metrics derived from live SQLite database records</p>
        </div>
        <FileText size={28} />
      </div>

      <div className="reports-stats">
        <div className="report-stat-card">
          <h3>Total Telemetry Records</h3>
          <h2>{totalAccidents}</h2>
          <p>Sensor events analyzed</p>
        </div>

        <div className="report-stat-card">
          <h3>Validated Emergencies</h3>
          <h2>{validatedEmergencies}</h2>
          <p>Confirmed incidents</p>
        </div>

        <div className="report-stat-card">
          <h3>Active Fleet Missions</h3>
          <h2>{activeDispatches}</h2>
          <p>Units currently deployed</p>
        </div>

        <div className="report-stat-card">
          <h3>Resolved Cases</h3>
          <h2>{resolvedCases}</h2>
          <p>{resolutionRate}% resolution rate</p>
        </div>
      </div>

      <div style={{ marginTop: "24px" }} className="panel">
        <div className="panel-heading">
          <div>
            <h3>Emergency Operational Audit Log</h3>
            <p>Chronological incident lifecycle tracking</p>
          </div>
          <ShieldCheck size={22} color="#10b981" />
        </div>

        {emergencies.length === 0 ? (
          <p style={{ padding: "20px", color: "#64748b" }}>No emergency lifecycle records found in database.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginTop: "10px" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #1e293b", color: "#94a3b8" }}>
                  <th style={{ padding: "10px 12px" }}>Emergency ID</th>
                  <th style={{ padding: "10px 12px" }}>Accident Ref</th>
                  <th style={{ padding: "10px 12px" }}>Assigned Ambulance</th>
                  <th style={{ padding: "10px 12px" }}>Hospital Assigned</th>
                  <th style={{ padding: "10px 12px" }}>Current Status</th>
                  <th style={{ padding: "10px 12px" }}>Reported Time</th>
                </tr>
              </thead>
              <tbody>
                {emergencies.map((em) => {
                  const amb = ambulances.find(a => a.id === em.assigned_ambulance_id);
                  const hosp = hospitals.find(h => h.id === em.hospital_id);
                  const isDone = em.status === "COMPLETED";

                  return (
                    <tr key={em.id} style={{ borderBottom: "1px solid #1e293b" }}>
                      <td style={{ padding: "12px", fontWeight: "600" }}>EMG-#{em.id}</td>
                      <td style={{ padding: "12px", color: "#60a5fa" }}>Accident #{em.accident_id}</td>
                      <td style={{ padding: "12px" }}>
                        {amb ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <Ambulance size={14} color="#60a5fa" />
                            {amb.registration_number}
                          </span>
                        ) : (
                          <span style={{ color: "#64748b" }}>Unassigned</span>
                        )}
                      </td>
                      <td style={{ padding: "12px" }}>
                        {hosp ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#34d399" }}>
                            <Building2 size={14} />
                            {hosp.name}
                          </span>
                        ) : (
                          <span style={{ color: "#64748b" }}>Pending Admission</span>
                        )}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span className={`badge-tag ${
                          isDone ? "badge-completed" : "badge-dispatched"
                        }`}>
                          {em.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px", color: "#94a3b8" }}>
                        {new Date(em.created_at).toLocaleDateString()} {new Date(em.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

export default ReportsPage;
