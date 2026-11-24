import { useState } from "react";
import { AlertTriangle, Send, X, MapPin, Car, ShieldAlert } from "lucide-react";
import { sernApi } from "../services/api";

const BENGALURU_LOCATIONS = [
  { name: "MG Road Junction, Central Bengaluru", lat: 12.9716, lon: 77.5946 },
  { name: "Koramangala 80ft Road, Bengaluru", lat: 12.9352, lon: 77.6245 },
  { name: "Indiranagar 100ft Road, Bengaluru", lat: 12.9780, lon: 77.6400 },
  { name: "Whitefield Main Road, Bengaluru", lat: 12.9698, lon: 77.7499 },
  { name: "Yeshwanthpur Junction, Bengaluru", lat: 13.0280, lon: 77.5400 },
  { name: "Rajarajeshwari Nagar Gate, Bengaluru", lat: 12.9285, lon: 77.5180 },
];

export default function CitizenReportModal({ isOpen, onClose, onReportSubmitted, currentUser }) {
  const [selectedLocation, setSelectedLocation] = useState(BENGALURU_LOCATIONS[0]);
  const [vehicleType, setVehicleType] = useState("car");
  const [severity, setSeverity] = useState("SERIOUS");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!description.trim()) {
      setError("Please provide a brief description of the incident.");
      return;
    }

    setLoading(true);
    try {
      // Register accident with citizen source
      const payload = {
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lon,
        vehicle_size: vehicleType,
        sensor_data: {
          gsensor: severity === "CRITICAL" ? [[45.0, 35.0, 80.0], [55.0, 45.0, 88.0]] : [[20.0, 15.0, 40.0], [25.0, 20.0, 50.0]],
          gyro: [[5.0, 6.0, 7.0], [7.0, 8.0, 9.0]],
          gps_speed: [60.0, 0.0],
          vehiclesize: vehicleType,
          gyro_is_hd: true
        }
      };

      const response = await sernApi.registerAccident(payload);

      // Save to citizen's personal report history in localStorage
      const storageKey = `sern_citizen_reports_${currentUser?.email || "guest"}`;
      let existingReports = [];
      try {
        existingReports = JSON.parse(localStorage.getItem(storageKey) || "[]");
      } catch (e) {
        console.warn("Storage read error:", e);
      }

      const newReportRecord = {
        id: response.id || Date.now(),
        locationName: selectedLocation.name,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lon,
        vehicleType,
        severity,
        description: description.trim(),
        reporterName: currentUser?.name || "Citizen Observer",
        reporterEmail: currentUser?.email || "",
        reportedAt: new Date().toISOString(),
        status: "PENDING_OPERATOR_VERIFICATION",
      };

      existingReports.unshift(newReportRecord);
      localStorage.setItem(storageKey, JSON.stringify(existingReports));

      alert("Emergency incident report submitted successfully! City dispatch operators have received your report.");
      if (onReportSubmitted) {
        onReportSubmitted(response, newReportRecord);
      }
      onClose();
    } catch (err) {
      setError(err.message || "Failed to submit emergency report.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container" style={{ maxWidth: "520px" }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              background: "#ef444422",
              padding: "8px",
              borderRadius: "8px",
              color: "#ef4444"
            }}>
              <ShieldAlert size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: "18px", color: "#f8fafc" }}>Citizen Emergency Incident Report</h2>
              <p style={{ fontSize: "12px", color: "#94a3b8" }}>
                Report an active road accident or public safety hazard in Bengaluru
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "14px" }}>
          {error && (
            <div style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid #ef4444",
              borderRadius: "6px",
              padding: "10px",
              color: "#fca5a5",
              fontSize: "12px"
            }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ fontSize: "12px", color: "#cbd5e1", fontWeight: "600", display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
              <MapPin size={13} color="#38bdf8" /> Incident Location in Bengaluru
            </label>
            <select
              value={selectedLocation.name}
              onChange={(e) => {
                const found = BENGALURU_LOCATIONS.find((loc) => loc.name === e.target.value);
                if (found) setSelectedLocation(found);
              }}
              style={{
                width: "100%",
                padding: "9px 12px",
                background: "#0b1329",
                border: "1px solid #334155",
                borderRadius: "6px",
                color: "#f8fafc",
                fontSize: "13px"
              }}
            >
              {BENGALURU_LOCATIONS.map((loc) => (
                <option key={loc.name} value={loc.name}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "#cbd5e1", fontWeight: "600", display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
                <Car size={13} color="#f59e0b" /> Primary Vehicle Involved
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  background: "#0b1329",
                  border: "1px solid #334155",
                  borderRadius: "6px",
                  color: "#f8fafc",
                  fontSize: "13px"
                }}
              >
                <option value="car">Passenger Car</option>
                <option value="motorcycle">Two-Wheeler / Bike</option>
                <option value="auto">Auto Rickshaw</option>
                <option value="bus">BMTC / City Bus</option>
                <option value="truck">Commercial Truck</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "12px", color: "#cbd5e1", fontWeight: "600", display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
                <AlertTriangle size={13} color="#ef4444" /> Severity Level
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  background: "#0b1329",
                  border: "1px solid #334155",
                  borderRadius: "6px",
                  color: "#f8fafc",
                  fontSize: "13px"
                }}
              >
                <option value="MODERATE">Moderate (Traffic disruption)</option>
                <option value="SERIOUS">Serious (Injuries suspected)</option>
                <option value="CRITICAL">Critical (Immediate trauma dispatch required)</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: "12px", color: "#cbd5e1", fontWeight: "600", display: "block", marginBottom: "6px" }}>
              Situation & Details
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened, any trapped passengers, lane blockage..."
              style={{
                width: "100%",
                padding: "9px 12px",
                background: "#0b1329",
                border: "1px solid #334155",
                borderRadius: "6px",
                color: "#f8fafc",
                fontSize: "13px",
                resize: "none"
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                background: "#1e293b",
                border: "1px solid #334155",
                color: "#94a3b8",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 18px",
                background: "#dc2626",
                border: "none",
                borderRadius: "6px",
                color: "white",
                fontSize: "12px",
                fontWeight: "bold",
                cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.7 : 1
              }}
            >
              <Send size={14} />
              {loading ? "Submitting..." : "Submit Incident Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
