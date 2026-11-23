import { useState } from "react";
import {
  Activity,
  LockKeyhole,
  Mail,
  Phone,
  User,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  CheckCircle2,
  Ambulance,
  Building2,
  RotateCcw,
  MessageSquare,
  X,
  BellRing
} from "lucide-react";
import { authService } from "./services/auth";
import { playSmsNotificationChime } from "./utils/sound";

function LoginPage({ onLogin, onBack, onRegister, onForgotPassword }) {
  const activeUser = authService.getCurrentUser();
  // Step 1: Credentials | Step 2: 2FA OTP
  const [step, setStep] = useState(1);
  const [name, setName] = useState(() => (activeUser?.name ? activeUser.name : "System Admin"));
  const [email, setEmail] = useState(() => (activeUser?.email ? activeUser.email : "admin@sern.com"));
  const [phone, setPhone] = useState(() => activeUser?.phone || "9876543210");
  const [password, setPassword] = useState("admin123");
  const [role, setRole] = useState(() => activeUser?.role || "Administrator");
  const [credentialId, setCredentialId] = useState(() => activeUser?.credentialId || "ADMIN-HQ-2026");

  // OTP State
  const [otpInput, setOtpInput] = useState("");
  const [pendingUserPayload, setPendingUserPayload] = useState(null);
  const [smsNotification, setSmsNotification] = useState(null);

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Validate credentials and request OTP
  const handleInitiateLogin = (e) => {
    e.preventDefault();
    setError("");

    // 1. Strict Email Validation
    const emailCheck = authService.validateEmail(email);
    if (!emailCheck.valid) {
      setError(emailCheck.error);
      return;
    }

    // 2. Strict Mobile Number Validation
    const phoneCheck = authService.validateMobile(phone);
    if (!phoneCheck.valid) {
      setError(phoneCheck.error);
      return;
    }

    // 3. Password Check
    if (!password || password.length < 4) {
      setError("Please enter a valid password.");
      return;
    }

    // 4. Role Authorization Credential Check
    if (role === "Ambulance Staff" && !credentialId.trim()) {
      setError("Ambulance staff must provide a Vehicle Registration or Paramedic Badge ID.");
      return;
    }
    if (role === "Hospital Staff" && !credentialId.trim()) {
      setError("Hospital personnel must provide a Trauma Center Facility License ID.");
      return;
    }

    // Save pending payload & Generate 6-digit OTP
    const otpData = authService.generateOTP(phoneCheck.sanitized);
    setPendingUserPayload({
      name: name.trim() || "Verified User",
      email: emailCheck.sanitized,
      phone: phoneCheck.sanitized,
      password,
      role,
      credentialId: credentialId.trim()
    });

    // Trigger authentic SMS chime and pop-up notification banner
    playSmsNotificationChime();
    setSmsNotification({
      otp: otpData.otp,
      sender: "SERN-AUTH (+91 98765-SERN)",
      time: "Just now"
    });

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        try {
          new Notification("💬 New SMS: SERN-AUTH", {
            body: `Your OTP is ${otpData.otp}. Enter this code to move forward.`,
            icon: "/favicon.svg"
          });
        } catch {
          // Ignore
        }
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission();
      }
    }

    setStep(2);
    setSuccessMsg(`SMS Notification sent to +91 ${phoneCheck.sanitized.slice(0, 3)}****${phoneCheck.sanitized.slice(-3)}`);
  };

  // Verify entered OTP and log in
  const handleVerifyOtp = (e) => {
    e.preventDefault();
    setError("");

    const verifyRes = authService.verifyOTP(otpInput);
    if (!verifyRes.verified) {
      setError(verifyRes.error || "Invalid OTP code. Please check your notification and enter the exact 6-digit code.");
      return;
    }

    // Log in verified user
    try {
      const user = authService.login(pendingUserPayload);
      setSmsNotification(null);
      if (onLogin) {
        onLogin(user);
      }
    } catch (err) {
      setError(err.message || "Failed to complete authentication.");
    }
  };

  const handleResendOtp = () => {
    if (pendingUserPayload) {
      const otpData = authService.generateOTP(pendingUserPayload.phone);
      playSmsNotificationChime();
      setSmsNotification({
        otp: otpData.otp,
        sender: "SERN-AUTH (+91 98765-SERN)",
        time: "Just now"
      });
      setSuccessMsg("Fresh OTP code dispatched to notification banner!");
      setTimeout(() => setSuccessMsg(""), 4000);
    }
  };

  // Quick preset selector for testing all user roles
  const handleQuickDemo = (demoRole) => {
    setRole(demoRole);
    setError("");
    const isCustomName = name && !["System Admin", "Rajesh Kumar", "Dr. Ananya Sharma", "Verified User"].includes(name);

    if (demoRole === "Administrator") {
      if (!isCustomName) setName("System Admin");
      setEmail(isCustomName ? email : "admin@sern.com");
      setPhone("9876543210");
      setCredentialId("ADMIN-HQ-2026");
    } else if (demoRole === "Ambulance Staff") {
      if (!isCustomName) setName("Rajesh Kumar");
      setEmail(isCustomName ? email : "paramedic@sern.com");
      setPhone("9812345678");
      setCredentialId("KA-01-EM-1080");
    } else if (demoRole === "Hospital Staff") {
      if (!isCustomName) setName("Dr. Ananya Sharma");
      setEmail(isCustomName ? email : "trauma@victoria-hospital.org");
      setPhone("9845012345");
      setCredentialId("HOSP-VICTORIA-ICU");
    } else if (demoRole === "Public Citizen") {
      if (!isCustomName) setName("Alex Morgan");
      setEmail(isCustomName ? email : "citizen@sern.com");
      setPhone("9876543210");
      setCredentialId("");
    }
  };

  return (
    <div className="login-page">
      {/* REAL MOBILE SMS PUSH NOTIFICATION POP-UP BANNER */}
      {smsNotification && (
        <div className="sms-popup-banner">
          <div className="sms-popup-icon">
            <MessageSquare size={20} />
            <span className="sms-badge">1</span>
          </div>
          <div className="sms-popup-content">
            <div className="sms-popup-header">
              <strong>MESSAGES · {smsNotification.sender}</strong>
              <span>{smsNotification.time}</span>
            </div>
            <p className="sms-popup-body">
              Your one-time verification OTP is <strong className="sms-otp-highlight">{smsNotification.otp}</strong>. Enter this code to move forward.
            </p>
          </div>
          <button
            type="button"
            className="sms-use-btn"
            onClick={() => {
              setOtpInput(smsNotification.otp);
            }}
            title="Click to copy and fill OTP into form"
          >
            Insert {smsNotification.otp}
          </button>
          <button
            type="button"
            className="sms-close-btn"
            onClick={() => setSmsNotification(null)}
            title="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="login-card">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={18} /> Back to Home
        </button>

        <div className="login-logo">
          <Activity size={35} />
          <h2>SERN</h2>
          <p>Smart Emergency Response Network</p>
        </div>

        {step === 1 ? (
          <>
            <h2>Sign In to SERN</h2>
            <p className="login-subtitle">
              Enter your credentials to receive your SMS verification code.
            </p>

            {/* Quick Demo Persona Switcher */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => handleQuickDemo("Administrator")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "bold",
                  background: role === "Administrator" ? "#0284c7" : "rgba(30, 41, 59, 0.7)",
                  color: "white",
                  border: "1px solid",
                  borderColor: role === "Administrator" ? "#38bdf8" : "#334155",
                  cursor: "pointer"
                }}
              >
                👑 Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo("Ambulance Staff")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "bold",
                  background: role === "Ambulance Staff" ? "#d97706" : "rgba(30, 41, 59, 0.7)",
                  color: "white",
                  border: "1px solid",
                  borderColor: role === "Ambulance Staff" ? "#f59e0b" : "#334155",
                  cursor: "pointer"
                }}
              >
                🚑 Paramedic
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo("Hospital Staff")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "bold",
                  background: role === "Hospital Staff" ? "#059669" : "rgba(30, 41, 59, 0.7)",
                  color: "white",
                  border: "1px solid",
                  borderColor: role === "Hospital Staff" ? "#10b981" : "#334155",
                  cursor: "pointer"
                }}
              >
                🏥 Trauma Desk
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo("Public Citizen")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "bold",
                  background: role === "Public Citizen" ? "#7c3aed" : "rgba(30, 41, 59, 0.7)",
                  color: "white",
                  border: "1px solid",
                  borderColor: role === "Public Citizen" ? "#a855f7" : "#334155",
                  cursor: "pointer"
                }}
              >
                👥 Citizen
              </button>
            </div>

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

            <form onSubmit={handleInitiateLogin}>
              <label>Select Role</label>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  if (e.target.value === "Ambulance Staff") setCredentialId("KA-01-EM-1080");
                  else if (e.target.value === "Hospital Staff") setCredentialId("HOSP-VICTORIA-ICU");
                  else if (e.target.value === "Administrator") setCredentialId("ADMIN-HQ-2026");
                  else if (e.target.value === "Public Citizen") setCredentialId("");
                }}
              >
                <option value="Administrator">👑 Administrator (HQ Dispatch Command)</option>
                <option value="Ambulance Staff">🚑 Ambulance Paramedic / Fleet Staff</option>
                <option value="Hospital Staff">🏥 Hospital Trauma Unit Desk</option>
                <option value="Public Citizen">👥 Citizen / Public User (Incident Reporting)</option>
              </select>

              <label>Your Full Name</label>
              <div className="login-input">
                <User size={18} />
                <input
                  type="text"
                  placeholder="e.g. Alex Morgan or John Doe"
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
                  placeholder="e.g. user@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <label>Mobile Number (For 2-Factor OTP)</label>
              <div className="login-input">
                <Phone size={18} />
                <input
                  type="tel"
                  placeholder="10-digit mobile number (e.g. 9876543210)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              {role === "Ambulance Staff" && (
                <>
                  <label>Vehicle Plate No. or Paramedic Badge ID</label>
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
                  <label>Trauma Facility License Code</label>
                  <div className="login-input">
                    <Building2 size={18} />
                    <input
                      type="text"
                      placeholder="e.g. HOSP-VICTORIA-ICU or BLR-MED-88"
                      value={credentialId}
                      onChange={(e) => setCredentialId(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              {role === "Administrator" && (
                <>
                  <label>HQ Security Master Key</label>
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

              <label>Password</label>
              <div className="login-input">
                <LockKeyhole size={18} />
                <input
                  type="password"
                  placeholder="Enter your account password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="login-submit">
                Send OTP & Pop Notification →
              </button>
            </form>
          </>
        ) : (
          /* STEP 2: 2-FACTOR OTP AUTHENTICATION SCREEN */
          <div style={{ animation: "fadeIn 0.2s ease-in" }}>
            <div style={{
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid #10b981",
              borderRadius: "8px",
              padding: "10px 14px",
              color: "#34d399",
              fontSize: "12px",
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              <CheckCircle2 size={18} />
              <span>{successMsg}</span>
            </div>

            {/* Notification instruction box */}
            <div style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid #1e293b",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              gap: "12px"
            }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "rgba(56, 189, 248, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#38bdf8",
                flexShrink: 0
              }}>
                <BellRing size={20} />
              </div>
              <div>
                <strong style={{ color: "#f8fafc", fontSize: "13px", display: "block" }}>
                  Check Incoming SMS Notification
                </strong>
                <p style={{ color: "#94a3b8", fontSize: "12px", margin: "2px 0 0", lineHeight: "1.3" }}>
                  A verification notification popped up at the top of your screen. Look for your 6-digit OTP and enter it below to move forward.
                </p>
              </div>
            </div>

            {error && (
              <div style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid #ef4444",
                color: "#fca5a5",
                padding: "10px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                marginBottom: "14px",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                <ShieldAlert size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp}>
              <label>Enter 6-Digit OTP from Notification</label>
              <div className="login-input">
                <KeyRound size={18} />
                <input
                  type="text"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                  required
                  style={{
                    letterSpacing: "6px",
                    fontSize: "20px",
                    fontWeight: "bold",
                    textAlign: "center"
                  }}
                />
              </div>

              <button type="submit" className="login-submit" style={{ background: "#10b981", marginTop: "18px" }}>
                Verify OTP & Move Forward →
              </button>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px" }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  ← Edit Credentials
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#38bdf8",
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <RotateCcw size={12} /> Re-pop Notification
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="login-footer">
          <p>
            Don't have an account?{" "}
            <button onClick={onRegister} className="register-link">
              Register New Personnel
            </button>
          </p>
          <p style={{ marginTop: "6px" }}>
            <button onClick={onForgotPassword} className="forgot-link">
              Forgot Password?
            </button>
          </p>
        </div>

        <div className="login-security">
          <ShieldCheck size={16} />
          2FA Authenticated Municipal Gateway
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
