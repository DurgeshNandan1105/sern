import { useState } from "react";
import {
  Activity,
  User,
  Mail,
  Phone,
  LockKeyhole,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Ambulance,
  Building2,
  KeyRound,
  CheckCircle2,
  RotateCcw,
  MessageSquare,
  X,
  BellRing
} from "lucide-react";
import { authService } from "./services/auth";
import { playSmsNotificationChime } from "./utils/sound";

function RegisterPage({ onRegister, onBack }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("Ambulance Staff");
  const [credentialId, setCredentialId] = useState("");

  // OTP Verification State
  const [otpInput, setOtpInput] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [pendingUser, setPendingUser] = useState(null);
  const [smsNotification, setSmsNotification] = useState(null);

  // Validate form and issue OTP
  const handleInitiateRegister = (e) => {
    e.preventDefault();
    setError("");

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

    // 2. Strict Mobile Number Validation
    const phoneCheck = authService.validateMobile(phone);
    if (!phoneCheck.valid) {
      setError(phoneCheck.error);
      return;
    }

    // 3. Password Validation
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    // 4. Role Authorization Credential Check
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

    // Prepare pending registration & Generate OTP
    const otpData = authService.generateOTP(phoneCheck.sanitized);
    setPendingUser({
      name: name.trim(),
      email: emailCheck.sanitized,
      phone: phoneCheck.sanitized,
      role,
      password,
      credentialId: credentialId.trim()
    });

    // Play chime and pop notification
    playSmsNotificationChime();
    setSmsNotification({
      otp: otpData.otp,
      sender: "SERN-AUTH (+91 98765-SERN)",
      time: "Just now"
    });

    setStep(2);
    setSuccessMsg(`SMS verification notification dispatched to +91 ${phoneCheck.sanitized.slice(0, 3)}****${phoneCheck.sanitized.slice(-3)}`);
  };

  // Complete registration upon OTP verification
  const handleVerifyRegisterOtp = (e) => {
    e.preventDefault();
    setError("");

    const verifyRes = authService.verifyOTP(otpInput);
    if (!verifyRes.verified) {
      setError(verifyRes.error || "Invalid OTP code. Please enter the exact 6-digit code shown in your notification.");
      return;
    }

    try {
      const newUser = authService.register(pendingUser);
      setSmsNotification(null);
      if (onRegister) {
        onRegister(newUser);
      }
    } catch (err) {
      setError(err.message || "Failed to complete registration.");
    }
  };

  const handleResendOtp = () => {
    if (pendingUser) {
      const otpData = authService.generateOTP(pendingUser.phone);
      playSmsNotificationChime();
      setSmsNotification({
        otp: otpData.otp,
        sender: "SERN-AUTH (+91 98765-SERN)",
        time: "Just now"
      });
      setSuccessMsg("Fresh OTP dispatched to notification banner!");
      setTimeout(() => setSuccessMsg(""), 4000);
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
              Your SERN account activation OTP is <strong className="sms-otp-highlight">{smsNotification.otp}</strong>. Enter this code to move forward.
            </p>
          </div>
          <button
            type="button"
            className="sms-use-btn"
            onClick={() => {
              setOtpInput(smsNotification.otp);
            }}
            title="Click to paste into form"
          >
            Insert {smsNotification.otp}
          </button>
          <button
            type="button"
            className="sms-close-btn"
            onClick={() => setSmsNotification(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="login-card register-card">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={18} /> Back to Sign In
        </button>

        <div className="login-logo">
          <Activity size={35} />
          <h2>SERN</h2>
          <p>Smart Emergency Response Network</p>
        </div>

        {step === 1 ? (
          <>
            <h2>Create Verified Personnel Account</h2>
            <p className="login-subtitle">
              Register your credentials to join the municipal emergency response network.
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

            <form onSubmit={handleInitiateRegister}>
              <label>Full Legal Name</label>
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

              <label>Mobile Number (For 2-Factor OTP)</label>
              <div className="login-input">
                <Phone size={18} />
                <input
                  type="tel"
                  placeholder="10-digit phone (e.g. 9876543210)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
                <option value="Public Citizen">👥 Citizen / Public User (Incident Reporting & Volunteer)</option>
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

              <button type="submit" className="login-submit">
                Send OTP & Pop Notification →
              </button>
            </form>
          </>
        ) : (
          /* STEP 2: REGISTRATION OTP VERIFICATION */
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

            <form onSubmit={handleVerifyRegisterOtp}>
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
                Verify & Activate Account →
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
                  ← Edit Form
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

        <div className="login-security">
          <ShieldCheck size={17} />
          SERN Municipal Identity & Credential Verification
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
