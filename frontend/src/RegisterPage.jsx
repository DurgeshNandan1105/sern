import { useState } from "react";
import {
  Activity,
  User,
  Mail,
  LockKeyhole,
  ArrowLeft,
  ShieldAlert,
  Ambulance,
  Building2,
  KeyRound,
  CheckCircle2
} from "lucide-react";
import { authService } from "./services/auth";

function RegisterPage({ onRegister, onBack }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("Ambulance Staff");
  const [credentialId, setCredentialId] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    // 1. Strict Email Validation
    const emailCheck = authService.validateEmail(email);
    if (!emailCheck.valid) {
      setError(emailCheck.error);
      return;
    }

    // 2. Password Validation
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    // 3. Role Authorization Credential Check
    if (role === "Ambulance Staff" && !credentialId.trim()) {
      setError("Ambulance staff must provide an Ambulance Plate No. or Paramedic Badge ID.");
      return;
    }
    if (role === "Hospital Staff" && !credentialId.trim()) {
      setError("Hospital staff must provide a Trauma Facility License Code.");
      return;
    }
    if (role === "Administrator" && !credentialId.trim()) {
      setError("System Administrator registration requires an HQ Security Passcode.");
      return;
    }

    setIsSubmitting(true);
    try {
      const newUser = await authService.register({
        name: name.trim(),
        email: emailCheck.sanitized,
        role,
        password,
        credentialId: credentialId.trim()
      });

      setSuccessMsg("Account registered successfully! Redirecting to command console...");
      setTimeout(() => {
        if (onRegister) {
          onRegister(newUser);
        }
      }, 700);
    } catch (err) {
      setError(err.message || "Failed to complete registration.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card register-card">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={18} /> Back to Sign In
        </button>

        <div className="login-logo">
          <Activity size={35} />
          <h2>SERN</h2>
          <p>Smart Emergency Response Network</p>
        </div>

        <h2>Create Personnel Account</h2>
        <p className="login-subtitle">
          Sign up with your official email to join the municipal emergency response network.
        </p>

        {error && (
          <div style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid #ef4444",
            color: "#fca5a5",
            padding: "10px 12px",
            borderRadius: "8px",
            fontSize: "12px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            background: "rgba(16, 185, 129, 0.15)",
            border: "1px solid #10b981",
            color: "#6ee7b7",
            padding: "10px 12px",
            borderRadius: "8px",
            fontSize: "12px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleRegister}>
          <label>Full Legal Name</label>
          <div className="login-input">
            <User size={18} />
            <input
              type="text"
              placeholder="e.g. Alex Morgan or Dr. Rajesh Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <label>Official Email Address</label>
          <div className="login-input">
            <Mail size={18} />
            <input
              type="email"
              placeholder="name@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <label>Network Role</label>
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setCredentialId("");
            }}
          >
            <option value="Ambulance Staff">🚑 Ambulance Paramedic / Fleet Staff</option>
            <option value="Hospital Staff">🏥 Hospital Trauma Unit Desk</option>
            <option value="Administrator">👑 Administrator (HQ Dispatch Command)</option>
            <option value="Public Citizen">👥 Citizen / Public Observer</option>
          </select>

          {/* Role Verification Credential Inputs */}
          {role === "Ambulance Staff" && (
            <>
              <label>Ambulance Plate No. / Paramedic Badge ID</label>
              <div className="login-input">
                <Ambulance size={18} />
                <input
                  type="text"
                  placeholder="e.g. KA-01-EM-1080 or BLR-AMB-402"
                  value={credentialId}
                  onChange={(e) => setCredentialId(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          {role === "Hospital Staff" && (
            <>
              <label>Hospital Facility License / Trauma ID</label>
              <div className="login-input">
                <Building2 size={18} />
                <input
                  type="text"
                  placeholder="e.g. HOSP-VICTORIA-ICU"
                  value={credentialId}
                  onChange={(e) => setCredentialId(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          {role === "Administrator" && (
            <>
              <label>HQ Dispatcher Security Passcode</label>
              <div className="login-input">
                <KeyRound size={18} />
                <input
                  type="text"
                  placeholder="e.g. ADMIN-HQ-2026"
                  value={credentialId}
                  onChange={(e) => setCredentialId(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <label>Create Password</label>
          <div className="login-input">
            <LockKeyhole size={18} />
            <input
              type="password"
              placeholder="Minimum 6 characters"
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
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login-submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating Account..." : "Create Account & Sign In →"}
          </button>
        </form>

        <div className="login-footer">
          <p>
            Already have an account?{" "}
            <button
              type="button"
              className="register-link"
              onClick={onBack}
              style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontWeight: "bold" }}
            >
              Sign In here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
