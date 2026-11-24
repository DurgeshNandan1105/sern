import React from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("SERN Error Boundary captured an unhandled error:", error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem("sern_active_user");
      localStorage.removeItem("sern_auth_token");
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1329",
          color: "#f8fafc",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          padding: "20px"
        }}>
          <div style={{
            maxWidth: "480px",
            width: "100%",
            background: "#131d3b",
            border: "1px solid #334155",
            borderRadius: "14px",
            padding: "32px",
            textAlign: "center",
            boxShadow: "0 20px 40px rgba(0,0,0,0.5)"
          }}>
            <div style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.15)",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px"
            }}>
              <AlertTriangle size={30} />
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>
              Something went wrong
            </h2>
            <p style={{ color: "#94a3b8", fontSize: "13px", lineHeight: "1.5", marginBottom: "20px" }}>
              The application encountered an unexpected error. You can reload the page or reset the local session to recover.
            </p>
            {this.state.error?.message && (
              <div style={{
                background: "#080e21",
                border: "1px solid #1e293b",
                borderRadius: "8px",
                padding: "10px",
                fontSize: "12px",
                color: "#f87171",
                textAlign: "left",
                fontFamily: "monospace",
                marginBottom: "20px",
                wordBreak: "break-all"
              }}>
                {this.state.error.message}
              </div>
            )}
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 18px",
                  background: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "13px",
                  cursor: "pointer"
                }}
              >
                <RotateCcw size={15} /> Reload Page
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 18px",
                  background: "transparent",
                  color: "#94a3b8",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "13px",
                  cursor: "pointer"
                }}
              >
                <Home size={15} /> Reset Session
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
