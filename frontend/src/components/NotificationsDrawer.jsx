import { Bell, X, CheckCircle, Clock } from "lucide-react";

export default function NotificationsDrawer({ isOpen, onClose, notifications = [] }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-container" style={{ maxWidth: "540px" }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ background: "#3b82f622", padding: "8px", borderRadius: "8px", color: "#60a5fa" }}>
              <Bell size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: "17px", color: "#f8fafc" }}>Emergency Notification Logs</h2>
              <p style={{ fontSize: "12px", color: "#94a3b8" }}>
                Hospital alerts & ambulance dispatch broadcast stream
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
          {notifications.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
              <Bell size={36} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
              <p>No notifications recorded yet.</p>
              <small>Simulated hospital alerts and dispatch dispatches will appear here.</small>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {notifications.map((notif) => {
                const isHospital = notif.notification_type === "HOSPITAL_ALERT";
                return (
                  <div
                    key={notif.id}
                    style={{
                      background: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: "8px",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{
                          fontSize: "11px",
                          fontWeight: "bold",
                          padding: "2px 7px",
                          borderRadius: "4px",
                          background: isHospital ? "#10b98122" : "#3b82f622",
                          color: isHospital ? "#34d399" : "#60a5fa"
                        }}>
                          {notif.notification_type}
                        </span>
                        <strong style={{ fontSize: "13px", color: "#f1f5f9" }}>
                          {notif.recipient}
                        </strong>
                      </div>
                      <span style={{ fontSize: "10px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={11} />
                        {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p style={{ fontSize: "12px", color: "#cbd5e1", margin: "2px 0" }}>
                      {notif.message}
                    </p>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "#64748b" }}>
                      <span>Ref Emergency #{notif.emergency_id || 'N/A'}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#10b981" }}>
                        <CheckCircle size={12} />
                        {notif.delivery_status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid #1e293b", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 16px", background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: "6px", fontSize: "13px" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
