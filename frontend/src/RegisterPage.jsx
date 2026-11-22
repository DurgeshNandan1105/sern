
import { useState } from "react";
import {
  Activity,
  User,
  Mail,
  Phone,
  LockKeyhole,
  ArrowLeft,
  ShieldCheck
} from "lucide-react";

function RegisterPage({ onRegister, onBack }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("Ambulance Staff");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    onRegister();
  };

  return (
    <div className="login-page">
      <div className="login-card register-card">

        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={18} /> Back to Login
        </button>

        <div className="login-logo">
          <Activity size={35} />
          <h2>SERN</h2>
          <p>Smart Emergency Response Network</p>
        </div>

        <h2>Create Account</h2>
        <p className="login-subtitle">
          Register to access the SERN platform.
        </p>

        <form onSubmit={handleSubmit}>

          <label>Full Name</label>
          <div className="login-input">
            <User size={18} />
            <input
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

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

          <label>Phone Number</label>
          <div className="login-input">
            <Phone size={18} />
            <input
              type="tel"
              placeholder="Enter your phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <label>Password</label>
          <div className="login-input">
            <LockKeyhole size={18} />
            <input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <label>Confirm Password</label>
          <div className="login-input">
            <LockKeyhole size={18} />
            <input
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <label>Select Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option>Ambulance Staff</option>
            <option>Hospital Staff</option>
          </select>

          <button type="submit" className="login-submit">
            Create Account
          </button>

        </form>

        <div className="login-security">
          <ShieldCheck size={17} />
          SERN Secure Registration
        </div>

      </div>
    </div>
  );
}

export default RegisterPage;
