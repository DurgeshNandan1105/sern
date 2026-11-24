import { useState } from "react";
import {
  Activity,
  LockKeyhole,
  Mail,
  ArrowLeft,
  ShieldAlert,
  UserPlus,
  LogIn
} from "lucide-react";
import { authService } from "./services/auth";

function LoginPage({ onLogin, onBack, onRegister, onForgotPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [isNotRegistered, setIsNotRegistered] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsNotRegistered(false);

    // 1. Strict Email Validation
    const emailCheck = authService.validateEmail(email);
    if (!emailCheck.valid) {
      setError(emailCheck.error);
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await authService.login({
        email: emailCheck.sanitized,
        password
      });

      if (onLogin) {
        onLogin(user);
      }
    } catch (err) {
      const msg = err.message || "Failed to sign in.";
      setError(msg);
      if (
        msg.toLowerCase().includes("no account found") ||
        msg.toLowerCase().includes("sign up first") ||
        msg.toLowerCase().includes("not registered")
      ) {
        setIsNotRegistered(true);
      }
    } finally {
      setIsSubmitting(false);
    }
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

        <h2>Personnel Sign In</h2>
        <p className="login-subtitle">
          Sign in with your verified email and password to access the operations console.
        </p>

        {/* Prominent Banner if user has not signed up yet */}
        {isNotRegistered && (
          <div style={{
            background: "rgba(245, 158, 11, 0.15)",
            border: "1px solid #f59e0b",
            color: "#fde68a",
            padding: "14px",
            borderRadius: "10px",
            marginBottom: "18px",
            fontSize: "13px"
          }}>
            <strong style={{ display: "block", color: "#fbbf24", marginBottom: "6px" }}>
              ⚠️ Account Not Found — Sign Up Required
            </strong>
            <p style={{ margin: "0 0 10px 0", lineHeight: "1.4" }}>
              No personnel account exists for <strong>{email}</strong>. In SERN, all new users must complete registration first before being granted system access.
            </p>
            <button
              type="button"
              onClick={onRegister}
              style={{
                background: "#f59e0b",
                color: "#0f172a",
                border: "none",
                borderRadius: "6px",
                padding: "8px 14px",
                fontWeight: "bold",
                fontSize: "12px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <UserPlus size={15} /> Sign Up & Register Account Now →
            </button>
          </div>
        )}

        {error && !isNotRegistered && (
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

        <form onSubmit={handleLogin}>
          <label>Official Email Address</label>
          <div className="login-input">
            <Mail size={18} />
            <input
              type="email"
              placeholder="e.g. name@domain.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setIsNotRegistered(false);
              }}
              required
              autoFocus
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

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "14px" }}>
            {onForgotPassword && (
              <button
                type="button"
                onClick={onForgotPassword}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#38bdf8",
                  fontSize: "12px",
                  cursor: "pointer"
                }}
              >
                Forgot Password?
              </button>
            )}
          </div>

          <button type="submit" className="login-submit" disabled={isSubmitting}>
            {isSubmitting ? (
              "Authenticating..."
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <LogIn size={16} /> Sign In to Console →
              </span>
            )}
          </button>
        </form>

        <div className="login-footer" style={{ marginTop: "20px", textAlign: "center" }}>
          <p style={{ color: "#94a3b8", fontSize: "13px" }}>
            New to SERN?{" "}
            <button
              type="button"
              className="register-link"
              onClick={onRegister}
              style={{
                background: "none",
                border: "none",
                color: "#38bdf8",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "13px"
              }}
            >
              Sign Up & Create Account →
            </button>
          </p>
          <p style={{ fontSize: "11px", color: "#64748b", marginTop: "8px" }}>
            🔒 Unauthorized access is strictly prohibited. Registration is verified before console privileges are granted.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
