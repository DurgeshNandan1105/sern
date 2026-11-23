import {
  Activity,
  ArrowRight,
  Ambulance,
  MapPin,
  ShieldCheck,
  Siren,
  HeartPulse
} from "lucide-react";

function LandingPage({ onEnterDashboard }) {
  return (
    <div className="landing-page">

      <nav className="landing-navbar">
        <div className="landing-logo">
          <Activity size={30} />
          <div>
            <h2>SERN</h2>
            <span>Emergency Network</span>
          </div>
        </div>

        <div className="landing-nav-links">
          <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#features">Features</a>
        </div>

        <div>
          <button
            className="landing-login-btn"
            onClick={onEnterDashboard}
          >
            Personnel Sign In <ArrowRight size={17} />
          </button>
        </div>
      </nav>

      <section className="landing-hero" id="home">
        <div className="hero-content">
          <span className="hero-tag">
            <ShieldCheck size={16} />
            MUNICIPAL INTELLIGENT DISPATCH NETWORK
          </span>

          <h1>
            Faster Response.
            <span> Safer Lives.</span>
          </h1>

          <p>
            SERN bridges AI vehicle telemetry accident classification,
            nearest-ambulance Haversine dispatch, green traffic corridors, and hospital trauma desk coordination
            into one zero-latency emergency ecosystem.
          </p>

          <div style={{ display: "flex", gap: "12px", marginTop: "10px", flexWrap: "wrap" }}>
            <button
              className="hero-btn"
              style={{ background: "#0284c7", border: "none" }}
              onClick={onEnterDashboard}
            >
              🛡️ Launch Emergency Command Center <ArrowRight size={19} />
            </button>
          </div>

          <div className="hero-note">
            <Activity size={16} />
            Two-Factor Verified · PostGIS Indexed · WebSockets Synced
          </div>
        </div>

        <div className="hero-visual">
          <div className="visual-card">
            <div className="visual-heading">
              <Activity size={22} />
              <span>Emergency Overview</span>
            </div>

            <div className="visual-alert">
              <Siren size={25} />
              <div>
                <strong>Emergency Alerts</strong>
                <p>Monitor reported incidents</p>
              </div>
            </div>

            <div className="visual-item">
              <Ambulance size={23} />
              <div>
                <strong>Ambulance Tracking</strong>
                <p>Live Turn-by-Turn GPS</p>
              </div>
            </div>

            <div className="visual-item">
              <MapPin size={23} />
              <div>
                <strong>Traffic Preemption</strong>
                <p>Green corridor signals</p>
              </div>
            </div>

            <div className="visual-item">
              <HeartPulse size={23} />
              <div>
                <strong>Hospital Coordination</strong>
                <p>Trauma bed availability</p>
              </div>
            </div>

            <span className="demo-label">
              LIVE MUNICIPAL CONSOLE
            </span>
          </div>
        </div>
      </section>

      <section className="landing-about" id="about">
        <h2>About SERN</h2>
        <p>
          SERN (Smart Emergency Response Network) is an integrated platform designed
          to detect accidents using Machine Learning, dispatch the nearest available
          ambulance using spatial routing, and alert hospitals in real-time.
        </p>
      </section>

      <section className="landing-features" id="features">
        <h2>Key Platform Capabilities</h2>

        <div className="features-grid">
          <div className="feature-card">
            <Activity size={32} />
            <h3>AI Accident Classification</h3>
            <p>
              Scikit-learn Random Forest classifier detects collision signatures from accelerometer
              and gyroscope telemetry with sub-second inference.
            </p>
          </div>

          <div className="feature-card">
            <Ambulance size={32} />
            <h3>Intelligent Dispatch & GPS</h3>
            <p>
              Automated Haversine spatial indexing pairs incidents with the nearest available unit
              and streams live turn-by-turn navigation telemetry.
            </p>
          </div>

          <div className="feature-card">
            <HeartPulse size={32} />
            <h3>Trauma Center Coordination</h3>
            <p>
              Instant bi-directional alerts to emergency trauma rooms with patient condition,
              inbound vehicle telemetry, and dynamic ETA estimation.
            </p>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <p>© 2026 SERN - Smart Emergency Response Network. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default LandingPage;
