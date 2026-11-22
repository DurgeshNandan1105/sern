
import { useState } from "react";
import { Activity, User, Mail, Phone, ShieldCheck, Save, Pencil } from "lucide-react";
import "./ReportsPage.css";

function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState(() => {
  const savedProfile = localStorage.getItem("sernProfile");

  return savedProfile
    ? JSON.parse(savedProfile)
    : {
        name: "Admin User",
        email: "admin@sern.com",
        phone: "9876543210",
        role: "Admin"
      };
});

  const handleChange = (e) => {
    setProfile({
      ...profile,
      [e.target.name]: e.target.value
    });
  };
const handleSave = () => {
  localStorage.setItem("sernProfile", JSON.stringify(profile));
  setIsEditing(false);
  alert("Profile updated successfully!");
};

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div>
          <h2>My Profile</h2>
          <p>View and manage your personal information</p>
        </div>
        <Activity size={28} />
      </div>

      <div className="profile-card">
        <div className="profile-avatar">
          <User size={38} />
        </div>

        <h3>{profile.name}</h3>
        <p>{profile.role}</p>

        <div className="profile-form">
          <label>Full Name</label>
          <div className="profile-input">
            <User size={18} />
            <input
              name="name"
              value={profile.name}
              onChange={handleChange}
              disabled={!isEditing}
            />
          </div>

          <label>Email Address</label>
          <div className="profile-input">
            <Mail size={18} />
            <input
              name="email"
              type="email"
              value={profile.email}
              onChange={handleChange}
              disabled={!isEditing}
            />
          </div>

          <label>Phone Number</label>
          <div className="profile-input">
            <Phone size={18} />
            <input
              name="phone"
              value={profile.phone}
              onChange={handleChange}
              disabled={!isEditing}
            />
          </div>

          <label>Role</label>
          <div className="profile-input">
            <ShieldCheck size={18} />
            <input value={profile.role} disabled />
          </div>

          {isEditing ? (
            <button className="profile-button" onClick={handleSave}>
              <Save size={17} /> Save Changes
            </button>
          ) : (
            <button
              className="profile-button"
              onClick={() => setIsEditing(true)}
            >
              <Pencil size={17} /> Edit Profile
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
