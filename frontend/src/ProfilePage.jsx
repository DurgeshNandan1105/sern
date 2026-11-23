import { useState } from "react";
import { Activity, User, Mail, Phone, ShieldCheck, Save, Pencil, CheckCircle2 } from "lucide-react";
import { authService } from "./services/auth";
import "./ProfilePage.css";

function ProfilePage({ currentUser, onUpdateProfile }) {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState(() => {
    return currentUser || authService.getCurrentUser();
  });
  const [prevUser, setPrevUser] = useState(currentUser);
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (currentUser && currentUser !== prevUser) {
    setPrevUser(currentUser);
    setProfile(currentUser);
  }

  const handleChange = (e) => {
    setProfile({
      ...profile,
      [e.target.name]: e.target.value
    });
  };

  const handleSave = () => {
    setErrorMessage("");
    // Strict email check
    const emailCheck = authService.validateEmail(profile.email);
    if (!emailCheck.valid) {
      setErrorMessage(emailCheck.error);
      return;
    }

    // Strict mobile check
    const phoneCheck = authService.validateMobile(profile.phone);
    if (!phoneCheck.valid) {
      setErrorMessage(phoneCheck.error);
      return;
    }

    try {
      const updated = authService.updateProfile({
        ...profile,
        email: emailCheck.sanitized,
        phone: phoneCheck.sanitized
      });
      setProfile(updated);
      setIsEditing(false);
      if (onUpdateProfile) {
        onUpdateProfile(updated);
      }
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } catch (err) {
      setErrorMessage(err.message || "Failed to update profile.");
    }
  };

  const initials = authService.getInitials(profile.name);

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div>
          <h2>Operator Profile & Personnel Settings</h2>
          <p>Manage your identity, role assignment, and emergency contact details</p>
        </div>
        <Activity size={28} color="#60a5fa" />
      </div>

      <div className="profile-card">
        <div className="profile-avatar">
          <span style={{ fontSize: "28px", fontWeight: "bold", color: "white" }}>
            {initials}
          </span>
        </div>

        <h3 style={{ fontSize: "20px", color: "#f8fafc" }}>{profile.name}</h3>
        <p style={{ color: "#60a5fa", fontWeight: "600", fontSize: "13px" }}>{profile.role}</p>
        <div style={{
          padding: "4px 12px",
          background: "rgba(56, 189, 248, 0.15)",
          border: "1px solid rgba(56, 189, 248, 0.4)",
          color: "#38bdf8",
          borderRadius: "20px",
          fontSize: "11px",
          fontWeight: "bold",
          display: "inline-block",
          marginTop: "6px"
        }}>
          {profile.verificationBadge || "✓ Verified Emergency Responder"}
        </div>

        {savedNotice && (
          <div style={{
            background: "#10b98122",
            border: "1px solid #10b981",
            color: "#34d399",
            padding: "8px 12px",
            borderRadius: "6px",
            fontSize: "12px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            margin: "15px 0 5px"
          }}>
            <CheckCircle2 size={15} /> Profile updated across topbar and system!
          </div>
        )}

        {errorMessage && (
          <div style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid #ef4444",
            color: "#fca5a5",
            padding: "8px 12px",
            borderRadius: "6px",
            fontSize: "12px",
            margin: "15px 0 5px"
          }}>
            {errorMessage}
          </div>
        )}

        <div className="profile-form">
          <label>Full Name</label>
          <div className="profile-input">
            <User size={18} />
            <input
              name="name"
              value={profile.name || ""}
              onChange={handleChange}
              disabled={!isEditing}
              placeholder="Your Full Name"
            />
          </div>

          <label>Email Address</label>
          <div className="profile-input">
            <Mail size={18} />
            <input
              name="email"
              type="email"
              value={profile.email || ""}
              onChange={handleChange}
              disabled={!isEditing}
              placeholder="Your Email Address"
            />
          </div>

          <label>Phone Number</label>
          <div className="profile-input">
            <Phone size={18} />
            <input
              name="phone"
              value={profile.phone || ""}
              onChange={handleChange}
              disabled={!isEditing}
              placeholder="Emergency Contact Phone"
            />
          </div>

          <label>Assigned Role</label>
          <div className="profile-input">
            <ShieldCheck size={18} />
            {isEditing ? (
              <select
                name="role"
                value={profile.role || "Administrator"}
                onChange={handleChange}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  width: "100%",
                  fontSize: "14px",
                  outline: "none"
                }}
              >
                <option value="Administrator">Administrator (HQ Dispatch)</option>
                <option value="Ambulance Staff">Ambulance Paramedic / Staff</option>
                <option value="Hospital Staff">Hospital Trauma Unit Desk</option>
                <option value="Public Citizen">Public Citizen / Observer</option>
                <option value="Traffic Controller">Traffic Systems Coordinator</option>
              </select>
            ) : (
              <input value={profile.role || ""} disabled />
            )}
          </div>

          {isEditing ? (
            <button className="profile-button" onClick={handleSave}>
              <Save size={17} /> Save Changes & Update Profile
            </button>
          ) : (
            <button
              className="profile-button"
              onClick={() => setIsEditing(true)}
            >
              <Pencil size={17} /> Edit Profile Details
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
