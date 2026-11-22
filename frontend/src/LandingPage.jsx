
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

        <button
          className="landing-login-btn"
          onClick={onEnterDashboard}
        >
          Enter Dashboard <ArrowRight size={17} />
        </button>
      </nav>

      <section className="landing-hero" id="home">
        <div className="hero-content">
          <span className="hero-tag">
            <ShieldCheck size={16} />
            SMART EMERGENCY RESPONSE
          </span>

          <h1>
            Faster Response.
            <span> Safer Lives.</span>
          </h1>

          <p>
            SERN connects emergency alerts, ambulance services,
            traffic monitoring and hospitals through one
            intelligent response platform.
          </p>

          <button
            className="hero-btn"
            onClick={onEnterDashboard}
          >
            Explore Dashboard <ArrowRight size={19} />
          </button>

          <div className="hero-note">
            <Activity size={16} />
            Emergency coordination made smarter
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
                <p>Monitor unit locations</p>
              </div>
            </div>

            <div className="visual-item">
              <MapPin size={23} />
              <div>
                <strong>Traffic Monitoring</strong>
                <p>View traffic conditions</p>
              </div>
            </div>

            <div className="visual-item">
              <HeartPulse size={23} />
              <div>
                <strong>Hospital Coordination</strong>
                <p>View hospital availability</p>
              </div>
            </div>

            <span className="demo-label">
              DEMONSTRATION PREVIEW
            </span>
          </div>
        </div>
      </section>

      <section className="landing-about" id="about">
        <h2>About SERN</h2>
        <p>
          SERN is an emergency response coordination platform
          designed to bring emergency information, ambulance
          services, traffic updates and hospital coordination
          together in one place.
        </p>
      </section>

      <section className="landing-features" id="features">
        <h2>Our Key Features</h2>

        <div className="feature-grid">
          <div className="feature-card">
            <Siren size={30} />
            <h3>Accident Alerts</h3>
            <p>View and monitor emergency incidents.</p>
          </div>

          <div className="feature-card">
            <Ambulance size={30} />
            <h3>Ambulance Tracking</h3>
            <p>Monitor ambulance locations and status.</p>
          </div>

          <div className="feature-card">
            <MapPin size={30} />
            <h3>Traffic Monitoring</h3>
            <p>Visualize traffic conditions and road status.</p>
          </div>

          <div className="feature-card">
            <HeartPulse size={30} />
            <h3>Hospital Coordination</h3>
            <p>View hospital information and bed availability.</p>
          </div>
        </div>
      </section>

      <footer className="landing-footer" id="contact">
        <h3>SERN – Smart Emergency Response Network</h3>
        <p>Technology for faster emergency coordination.</p>
        <span>© 2026 SERN. All rights reserved.</span>
      </footer>

    </div>
  );
}

export default LandingPage;
