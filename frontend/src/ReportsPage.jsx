import { Activity, FileText } from "lucide-react";

function ReportsPage() {
  return (
    <div className="reports-page">
      <div className="reports-header">
        <div>
          <h2>Reports & Analytics</h2>
          <p>Monitor emergency response performance and statistics</p>
        </div>
        <FileText size={28} />
      </div>
            <div className="reports-stats">
        <div className="report-stat-card">
          <h3>Total Emergencies</h3>
          <h2>128</h2>
          <p>Incidents reported</p>
        </div>

        <div className="report-stat-card">
          <h3>Resolved Cases</h3>
          <h2>96</h2>
          <p>Successfully resolved</p>
        </div>

        <div className="report-stat-card">
          <h3>Ambulance Dispatches</h3>
          <h2>84</h2>
          <p>Units dispatched</p>
        </div>

        <div className="report-stat-card">
          <h3>Hospital Admissions</h3>
          <h2>52</h2>
          <p>Patients admitted</p>
        </div>
      </div>
    </div>
  );
}

export default ReportsPage;