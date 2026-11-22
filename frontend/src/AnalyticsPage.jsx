import { Activity, TrendingUp } from "lucide-react";
import "./AnalyticsPage.css";

function AnalyticsPage() {
  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div>
          <h2>Emergency Analytics</h2>
          <p>Analyze emergency response performance and trends</p>
        </div>
        <TrendingUp size={28} />
      </div>
      <div className="analytics-stats">
  <div className="analytics-card">
    <h3>Total Emergencies</h3>
    <h2>128</h2>
    <p>Reported incidents</p>
  </div>

  <div className="analytics-card">
    <h3>Road Accidents</h3>
    <h2>64</h2>
    <p>50% of emergencies</p>
  </div>

  <div className="analytics-card">
    <h3>Medical Emergencies</h3>
    <h2>42</h2>
    <p>33% of emergencies</p>
  </div>

  <div className="analytics-card">
    <h3>Other Emergencies</h3>
    <h2>22</h2>
    <p>17% of emergencies</p>
  </div>
</div>
    </div>
  );
}

export default AnalyticsPage;