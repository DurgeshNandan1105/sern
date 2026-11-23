import { useState } from "react";
import { Ambulance, X, Plus, RefreshCw } from "lucide-react";
import { sernApi } from "../services/api";

export default function AddAmbulanceModal({ isOpen, onClose, onAmbulanceAdded }) {
  const [regNo, setRegNo] = useState("");
  const [lat, setLat] = useState("12.9716");
  const [lon, setLon] = useState("77.5946");
  const [status, setStatus] = useState("AVAILABLE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!regNo.trim()) {
      setError("Please enter a valid registration number.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const newAmb = await sernApi.registerAmbulance({
        registration_number: regNo.trim().toUpperCase(),
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        status: status
      });
      if (onAmbulanceAdded) {
        onAmbulanceAdded(newAmb);
      }
      onClose();
    } catch (err) {
      setError(err.message || "Failed to register ambulance.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container" style={{ maxWidth: "450px" }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ background: "#2563eb22", padding: "8px", borderRadius: "8px", color: "#60a5fa" }}>
              <Ambulance size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: "17px", color: "#f8fafc" }}>Register New Ambulance</h2>
              <p style={{ fontSize: "12px", color: "#94a3b8" }}>Add an emergency response unit to fleet</p>
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
              Registration Number
            </label>
            <input
              type="text"
              placeholder="e.g. KA-01-EM-9999"
              value={regNo}
              onChange={(e) => setRegNo(e.target.value)}
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
              Initial Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", color: "white", padding: "9px 12px", borderRadius: "6px", fontSize: "13px" }}
            >
              <option value="AVAILABLE">Available (Ready for Dispatch)</option>
              <option value="UNAVAILABLE">Unavailable (Maintenance / Off-Duty)</option>
            </select>
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
              style={{ padding: "9px 18px", background: "#2563eb", color: "white", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}
            >
              {loading ? <RefreshCw size={15} className="spin" /> : <Plus size={15} />}
              Register Ambulance
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
