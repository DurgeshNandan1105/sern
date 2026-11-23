import { useState } from "react";
import { Building2, X, Plus, RefreshCw } from "lucide-react";
import { sernApi } from "../services/api";

export default function AddHospitalModal({ isOpen, onClose, onHospitalAdded }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("12.9716");
  const [lon, setLon] = useState("77.5946");
  const [contact, setContact] = useState("+91-80-");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      setError("Please provide a hospital name and physical address.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const newHosp = await sernApi.registerHospital({
        name: name.trim(),
        address: address.trim(),
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        contact_information: contact.trim(),
        is_active: true
      });
      if (onHospitalAdded) {
        onHospitalAdded(newHosp);
      }
      onClose();
    } catch (err) {
      setError(err.message || "Failed to register hospital.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container" style={{ maxWidth: "480px" }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ background: "#10b98122", padding: "8px", borderRadius: "8px", color: "#10b981" }}>
              <Building2 size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: "17px", color: "#f8fafc" }}>Register Partner Hospital</h2>
              <p style={{ fontSize: "12px", color: "#94a3b8" }}>Add healthcare facility to emergency network</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && (
            <div style={{ background: "#ef444422", border: "1px solid #ef4444", color: "#fca5a5", padding: "10px", borderRadius: "6px", fontSize: "12px", marginBottom: "14px" }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
              Hospital Name
            </label>
            <input
              type="text"
              placeholder="e.g. St. John's Medical College Hospital"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", color: "white", padding: "9px 12px", borderRadius: "6px", fontSize: "13px" }}
            />
          </div>

          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
              Full Address
            </label>
            <input
              type="text"
              placeholder="e.g. Sarjapur Road, John Nagar, Koramangala, Bengaluru"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", color: "white", padding: "9px 12px", borderRadius: "6px", fontSize: "13px" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                Latitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                required
                style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", color: "white", padding: "9px 12px", borderRadius: "6px", fontSize: "13px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                Longitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                required
                style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", color: "white", padding: "9px 12px", borderRadius: "6px", fontSize: "13px" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
              Emergency Desk Phone / Contact
            </label>
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              required
              style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", color: "white", padding: "9px 12px", borderRadius: "6px", fontSize: "13px" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "9px 16px", background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: "6px", fontSize: "13px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{ padding: "9px 18px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}
            >
              {loading ? <RefreshCw size={15} className="spin" /> : <Plus size={15} />}
              Register Hospital
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
