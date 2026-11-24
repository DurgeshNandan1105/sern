import { useState } from "react";
import { AlertTriangle, Play, CheckCircle2, ShieldAlert, RefreshCw, X } from "lucide-react";
import { sernApi } from "../services/api";
import { formatAiConfidence } from "../utils/confidence";

const PRESETS = [
  {
    id: "rnsit_crash",
    title: "RNSIT Campus Collision (RR Nagar Corridor)",
    desc: "Speed drops from 80 to 0 km/h on Dr. Vishnuvardhan Rd with high G-force. Demonstrates Congestion-Aware Green Corridor vs 80ft Rd delay.",
    locationName: "RNSIT Campus, RR Nagar, Bengaluru",
    lat: 12.9015,
    lon: 77.5192,
    vehicleSize: "car",
    speed: [80.0, 0.0],
    gsensor: [[48.0, 38.0, 82.0], [60.0, 48.0, 89.0]],
    gyro: [[6.2, 7.1, 8.4], [9.1, 10.2, 11.5]],
    gyro_is_hd: true
  },
  {
    id: "severe_crash",
    title: "Severe High-Speed Collision",
    desc: "Speed drops from 95 to 0 km/h with heavy G-force impact and rotational spike.",
    locationName: "MG Road Junction, Bengaluru",
    lat: 12.9716,
    lon: 77.5946,
    vehicleSize: "car",
    speed: [95.0, 0.0],
    gsensor: [[52.0, 41.0, 85.0], [64.0, 52.0, 92.0]],
    gyro: [[5.5, 6.2, 7.8], [8.2, 9.4, 10.5]],
    gyro_is_hd: true
  },
  {
    id: "rollover",
    title: "Rollover Crash",
    desc: "Excessive angular velocity across all three gyroscope axes and high lateral acceleration.",
    locationName: "Koramangala 80ft Road, Bengaluru",
    lat: 12.9352,
    lon: 77.6245,
    vehicleSize: "car",
    speed: [70.0, 5.0],
    gsensor: [[35.0, 45.0, 95.0], [42.0, 50.0, 110.0]],
    gyro: [[12.0, 15.0, 18.0], [14.0, 17.0, 20.0]],
    gyro_is_hd: true
  },
  {
    id: "normal_driving",
    title: "Normal Smooth Driving",
    desc: "Smooth velocity and typical standard gravity (1G ~ 9.8 m/s²) on Z-axis.",
    locationName: "Indiranagar 100ft Road, Bengaluru",
    lat: 12.9780,
    lon: 77.6400,
    vehicleSize: "car",
    speed: [45.0, 42.0],
    gsensor: [[0.2, 0.1, 9.8], [0.3, 0.2, 9.7]],
    gyro: [[0.02, 0.01, 0.03], [0.03, 0.02, 0.04]],
    gyro_is_hd: true
  },
  {
    id: "hard_braking",
    title: "Sudden Hard Braking (Near-Miss)",
    desc: "Rapid speed reduction without destructive impact force or vehicle rollover.",
    locationName: "Whitefield Main Road, Bengaluru",
    lat: 12.9698,
    lon: 77.7499,
    vehicleSize: "car",
    speed: [60.0, 12.0],
    gsensor: [[2.8, 0.4, 9.8], [3.2, 0.6, 9.7]],
    gyro: [[0.1, 0.05, 0.1], [0.15, 0.08, 0.12]],
    gyro_is_hd: true
  }
];

export default function AccidentSimulatorModal({ isOpen, onClose, onAccidentCreated }) {
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0]);
  const [latitude, setLatitude] = useState(PRESETS[0].lat);
  const [longitude, setLongitude] = useState(PRESETS[0].lon);
  const [vehicleSize, setVehicleSize] = useState(PRESETS[0].vehicleSize);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [validating, setValidating] = useState(false);

  if (!isOpen) return null;

  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
    setLatitude(preset.lat);
    setLongitude(preset.lon);
    setVehicleSize(preset.vehicleSize);
    setResult(null);
    setError(null);
  };

  const handleRunSimulation = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    const payload = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      sensor_data: {
        gsensor: selectedPreset.gsensor,
        gyro: selectedPreset.gyro,
        gps_speed: selectedPreset.speed,
        vehiclesize: vehicleSize,
        gyro_is_hd: selectedPreset.gyro_is_hd
      }
    };

    try {
      const response = await sernApi.registerAccident(payload);
      setResult(response);
      if (onAccidentCreated) {
        onAccidentCreated(response);
      }
    } catch (err) {
      setError(err.message || "Failed to execute accident prediction simulation.");
    } finally {
      setLoading(false);
    }
  };

  const handleValidateAndDispatch = async () => {
    if (!result || !result.id) return;
    setValidating(true);
    try {
      // Validate accident with auto_dispatch: true
      const valResponse = await sernApi.validateAccident(result.id, {
        confirmed: true,
        validation_notes: "Validated via Emergency Command Center Simulator.",
        auto_dispatch: true
      });

      // If auto-dispatch didn't dispatch (or returned emergency in pending), trigger dispatch explicitly
      if (valResponse.emergency && valResponse.emergency.status === "PENDING") {
        try {
          await sernApi.dispatchAmbulance(valResponse.emergency.id);
        } catch (dispatchErr) {
          console.warn("Manual dispatch follow-up:", dispatchErr);
        }
      }

      alert("Accident successfully validated and nearest ambulance dispatched!");
      if (onAccidentCreated) {
        onAccidentCreated(valResponse.accident);
      }
      onClose();
    } catch (err) {
      alert(`Validation error: ${err.message}`);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container">
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
              <h2 style={{ fontSize: "18px", color: "#f8fafc" }}>AI Accident Detection Simulator</h2>
              <p style={{ fontSize: "12px", color: "#94a3b8" }}>
                Test the Random Forest ML classifier with vehicle sensor telemetry
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Preset Selector */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "8px", fontWeight: "600" }}>
              SELECT SIMULATION SCENARIO
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {PRESETS.map((preset) => {
                const isSelected = selectedPreset.id === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handlePresetChange(preset)}
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      background: isSelected ? "#1e293b" : "#0f172a",
                      border: isSelected ? "2px solid #3b82f6" : "1px solid #334155",
                      cursor: "pointer",
                      transition: "0.2s"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <strong style={{ fontSize: "13px", color: isSelected ? "#60a5fa" : "#f1f5f9" }}>
                        {preset.title}
                      </strong>
                      {preset.id.includes("crash") || preset.id === "rollover" ? (
                        <span style={{ fontSize: "10px", color: "#ef4444", background: "#ef444422", padding: "2px 6px", borderRadius: "4px" }}>
                          Crash
                        </span>
                      ) : (
                        <span style={{ fontSize: "10px", color: "#10b981", background: "#10b98122", padding: "2px 6px", borderRadius: "4px" }}>
                          Safe
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                      {preset.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Location & Vehicle Configuration */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "12px",
            background: "#0f172a",
            padding: "14px",
            borderRadius: "8px",
            border: "1px solid #1e293b",
            marginBottom: "16px"
          }}>
            <div>
              <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>
                Latitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                style={{
                  width: "100%",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  color: "white",
                  padding: "8px",
                  borderRadius: "6px",
                  fontSize: "13px"
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>
                Longitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                style={{
                  width: "100%",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  color: "white",
                  padding: "8px",
                  borderRadius: "6px",
                  fontSize: "13px"
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>
                Vehicle Size
              </label>
              <select
                value={vehicleSize}
                onChange={(e) => setVehicleSize(e.target.value)}
                style={{
                  width: "100%",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  color: "white",
                  padding: "8px",
                  borderRadius: "6px",
                  fontSize: "13px"
                }}
              >
                <option value="car">Passenger Car</option>
                <option value="van">Van / SUV</option>
                <option value="bus">Commercial Bus</option>
                <option value="truck">Heavy Truck</option>
              </select>
            </div>
          </div>

          {/* Telemetry Inspection */}
          <div style={{
            background: "#090d16",
            border: "1px solid #1e293b",
            borderRadius: "6px",
            padding: "10px 14px",
            marginBottom: "16px",
            fontSize: "11px",
            color: "#64748b",
            display: "flex",
            justifyContent: "space-between"
          }}>
            <span><strong>Speeds:</strong> [{selectedPreset.speed.join(" → ")} km/h]</span>
            <span><strong>G-Force Triples:</strong> {selectedPreset.gsensor.length} frames</span>
            <span><strong>Gyro Triples:</strong> {selectedPreset.gyro.length} frames</span>
            <span><strong>HD Gyro:</strong> {selectedPreset.gyro_is_hd ? "Active" : "No"}</span>
          </div>

          {/* Result Card */}
          {error && (
            <div style={{
              background: "#ef444422",
              border: "1px solid #ef4444",
              color: "#fca5a5",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "16px",
              fontSize: "13px"
            }}>
              {error}
            </div>
          )}

          {result && (
            <div style={{
              background: result.accident_prediction ? "#450a0a33" : "#064e3b33",
              border: `1px solid ${result.accident_prediction ? "#ef4444" : "#10b981"}`,
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "16px"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {result.accident_prediction ? (
                    <AlertTriangle color="#ef4444" size={24} />
                  ) : (
                    <CheckCircle2 color="#10b981" size={24} />
                  )}
                  <div>
                    <h3 style={{
                      fontSize: "16px",
                      color: result.accident_prediction ? "#ef4444" : "#10b981"
                    }}>
                      {result.accident_prediction ? "ACCIDENT DETECTED BY AI" : "NORMAL DRIVING (NO ACCIDENT)"}
                    </h3>
                    <p style={{ fontSize: "12px", color: "#94a3b8" }}>
                      Incident ID: #{result.id} · Status: <strong>{result.validation_status}</strong>
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "20px", fontWeight: "bold", color: formatAiConfidence(result.accident_probability, result.model_threshold).color }}>
                    {formatAiConfidence(result.accident_probability, result.model_threshold).percentage}% Probability
                  </span>
                  <p style={{ fontSize: "11px", color: "#94a3b8" }}>
                    {formatAiConfidence(result.accident_probability, result.model_threshold).label}
                  </p>
                  <p style={{ fontSize: "10px", color: "#64748b" }}>
                    Decision Threshold: {(result.model_threshold * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Probability meter */}
              <div style={{
                height: "8px",
                width: "100%",
                background: "#1e293b",
                borderRadius: "4px",
                margin: "12px 0 8px",
                overflow: "hidden"
              }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(100, formatAiConfidence(result.accident_probability, result.model_threshold).percentage)}%`,
                  background: result.accident_prediction ? "linear-gradient(90deg, #f59e0b, #ef4444)" : "#10b981"
                }} />
              </div>

              {result.accident_prediction && result.validation_status === "PENDING" && (
                <div style={{ marginTop: "14px", display: "flex", gap: "10px" }}>
                  <button
                    onClick={handleValidateAndDispatch}
                    disabled={validating}
                    style={{
                      flex: 1,
                      padding: "10px 16px",
                      background: "#2563eb",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: "600",
                      fontSize: "13px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      cursor: "pointer"
                    }}
                  >
                    {validating ? <RefreshCw size={16} className="spin" /> : <Play size={16} />}
                    Validate Incident & Dispatch Nearest Ambulance
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Trigger */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              onClick={onClose}
              style={{
                padding: "10px 18px",
                background: "#1e293b",
                color: "#94a3b8",
                border: "1px solid #334155",
                borderRadius: "6px",
                fontWeight: "600",
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              Close
            </button>
            <button
              onClick={handleRunSimulation}
              disabled={loading}
              style={{
                padding: "10px 20px",
                background: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "600",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer"
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  Running AI Model...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Transmit Sensor Data & Run AI Model
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
