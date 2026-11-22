
import { useState } from "react";
import {
  Activity,
  LockKeyhole,
  Mail,
  ArrowLeft,
  ShieldCheck
} from "lucide-react";

function LoginPage({ onLogin, onBack, onRegister, onForgotPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Admin");

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin();
  };

  return (
    <div className="login-page">
      <div className="login-card">

        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={18} /> Back to Home
        </button>

        <div className="login-logo">
          <Activity size={35} />
          <h2>SERN</h2>
          <p>Smart Emergency Response Network</p>
        </div>

        <h2>Welcome Back!</h2>
        <p className="login-subtitle">
          Sign in to access the emergency dashboard.
        </p>

        <form onSubmit={handleSubmit}>

          <label>Email Address</label>
          <div className="login-input">
            <Mail size={18} />
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <label>Password</label>
          <div className="login-input">
            <LockKeyhole size={18} />
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <label>Select Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option>Admin</option>
            <option>Ambulance Staff</option>
            <option>Hospital Staff</option>
          </select>

          <button type="submit" className="login-submit">
            Sign In
          </button>

        </form>

        <p className="register-link">
            Don't have an account?{" "}
            <button type="button" onClick={onRegister}>
                Create Account
            </button>
        </p>
        <p className="forgot-link">
            <button type="button" onClick={onForgotPassword}>
                 Forgot Password?
            </button>
        </p>

        <div className="login-security">
          <ShieldCheck size={17} />
          Secure Emergency Response Access
        </div>

      </div>
    </div>
  );
}

export default LoginPage;
