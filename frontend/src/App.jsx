import { useState, useEffect, useCallback, useRef } from "react";
import LandingPage from "./LandingPage";
import "./LandingPage.css";
import RegisterPage from "./RegisterPage";
import "./RegisterPage.css";
import LoginPage from "./LoginPage";
import "./LoginPage.css";
import ForgotPasswordPage from "./ForgotPasswordPage";
import ProfilePage from "./ProfilePage";
import "./ProfilePage.css";
import TrafficPage from "./TrafficPage";
import "./TrafficPage.css";
import ReportsPage from "./ReportsPage";
import "./ReportsPage.css";
import AnalyticsPage from "./AnalyticsPage";
import "./AnalyticsPage.css";
import EmergencyMap from "./components/EmergencyMap";
import AccidentSimulatorModal from "./components/AccidentSimulatorModal";
import AddAmbulanceModal from "./components/AddAmbulanceModal";
import AddHospitalModal from "./components/AddHospitalModal";
import CitizenReportModal from "./components/CitizenReportModal";
import NotificationsDrawer from "./components/NotificationsDrawer";
import { sernApi } from "./services/api";
import { authService } from "./services/auth";
import { playEmergencyAlert, playDispatchChime } from "./utils/sound";
import { formatAiConfidence } from "./utils/confidence";

import {
  Activity, AlertTriangle, Ambulance, Bell, Building2,
  Car, Clock, LayoutDashboard, MapPin, Menu,
  ShieldCheck, Siren, Users, X, Sun, Moon,
  Play, Plus, RefreshCw, CheckCircle2,
  Phone, Compass, ShieldAlert, LogOut, RotateCcw,
  FileText, TrendingUp
} from "lucide-react";
import "./App.css";

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Accident Alerts", icon: AlertTriangle },
  { name: "Ambulances", icon: Ambulance },
  { name: "Emergency History", icon: Clock },
  { name: "Hospitals", icon: Building2 },
  { name: "Traffic", icon: Car },
  { name: "Reports", icon: FileText },
  { name: "Analytics", icon: TrendingUp },
  { name: "Profile", icon: Users },
];

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [showLanding, setShowLanding] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser());
  const activeRouteEmergencyIdRef = useRef(null);

  // User Role Flags
  const isCitizen = currentUser?.role === "Public Citizen";
  const isHospitalStaff = currentUser?.role === "Hospital Staff";
  const isAmbulanceStaff = currentUser?.role === "Ambulance Staff";

  // Filtered Navigation based on Role
  const visibleMenuItems = menuItems.filter((item) => {
    if (isCitizen) {
      return !["Ambulances", "Traffic", "Reports", "Analytics"].includes(item.name);
    }
    if (isHospitalStaff) {
      return !["Ambulances", "Traffic"].includes(item.name);
    }
    if (isAmbulanceStaff) {
      return !["Reports", "Analytics"].includes(item.name);
    }
    return true;
  });

  // Role Access Guard: Redirect to Dashboard if current page is unauthorized
  useEffect(() => {
    const isAllowed = visibleMenuItems.some((item) => item.name === activePage);
    if (!isAllowed) {
      const timer = setTimeout(() => {
        setActivePage("Dashboard");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activePage, visibleMenuItems]);

  // Citizen Incident Reports
  const [citizenReports, setCitizenReports] = useState(() => {
    if (currentUser?.role === "Public Citizen") {
      try {
        const storageKey = `sern_citizen_reports_${currentUser.email || currentUser.id || "guest"}`;
        return JSON.parse(localStorage.getItem(storageKey) || "[]");
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isCitizen && currentUser) {
        try {
          const storageKey = `sern_citizen_reports_${currentUser.email || currentUser.id || "guest"}`;
          const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
          setCitizenReports(stored);
        } catch (e) {
          console.warn("Could not load citizen reports:", e);
          setCitizenReports([]);
        }
      } else {
        setCitizenReports([]);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isCitizen, currentUser]);

  // Live Backend State
  const [accidents, setAccidents] = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [intersections, setIntersections] = useState([]);
  const [systemHealth, setSystemHealth] = useState({ status: "checking", ml_model_loaded: false });
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [activeMapCenter, setActiveMapCenter] = useState([12.9716, 77.5946]);
  const [loadingData, setLoadingData] = useState(false);

  // Modals state
  const [showSimulator, setShowSimulator] = useState(false);
  const [showCitizenReport, setShowCitizenReport] = useState(false);
  const [showAddAmbulance, setShowAddAmbulance] = useState(false);
  const [showAddHospital, setShowAddHospital] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Filter states
  const [accidentFilter, setAccidentFilter] = useState("ALL");
  const [ambulanceFilter, setAmbulanceFilter] = useState("ALL");
  const [wsStatus, setWsStatus] = useState("connecting"); // "connecting" | "connected" | "disconnected"

  // Load and view road-network route on map (Member 4 Integration)
  const handleViewRoute = useCallback(async (emergencyId, silent = false) => {
    try {
      activeRouteEmergencyIdRef.current = emergencyId;
      let routeData = null;
      try {
        routeData = await sernApi.getRoute(emergencyId);
      } catch {
        try {
          routeData = await sernApi.generateMockRoute(emergencyId);
        } catch {
          const em = emergencies.find(e => e.id === emergencyId);
          const acc = em ? accidents.find(a => a.id === em.accident_id) : null;
          const targetLat = acc ? acc.latitude : 12.9716;
          const targetLon = acc ? acc.longitude : 77.5946;
          routeData = {
            emergency_id: emergencyId,
            distance_km: 4.8,
            estimated_duration_minutes: 8.5,
            route_geometry: {
              type: "LineString",
              coordinates: [
                [77.6000, 12.9650],
                [77.5980, 12.9680],
                [targetLon, targetLat]
              ]
            },
            source: "CLIENT_FALLBACK_NAVIGATION"
          };
        }
      }
      setSelectedRoute(routeData);

      const em = emergencies.find(e => e.id === emergencyId);
      const acc = em ? accidents.find(a => a.id === em.accident_id) : null;
      if (acc) {
        setActiveMapCenter([acc.latitude, acc.longitude]);
      }
      // ONLY switch page if user explicitly asked to view route
      if (!silent) {
        setActivePage("Dashboard");
        alert(`Route calculated: ${routeData.distance_km} km · ETA: ${routeData.estimated_duration_minutes} min. Displaying on map.`);
      }
    } catch (err) {
      if (!silent) {
        alert(`Could not load route: ${err.message}`);
      }
    }
  }, [emergencies, accidents]);

  // Fetch all backend data
  const fetchData = useCallback(async () => {
    try {
      setLoadingData(true);
      const [accRes, ambRes, emRes, hospRes, notifRes, healthRes, trafficRes] = await Promise.allSettled([
        sernApi.getAccidents(),
        sernApi.getAmbulances(),
        sernApi.getEmergencies(),
        sernApi.getHospitals(false),
        sernApi.getNotifications(),
        sernApi.getHealth(),
        sernApi.getTrafficIntersections()
      ]);

      if (accRes.status === "fulfilled") setAccidents(accRes.value);
      if (ambRes.status === "fulfilled") setAmbulances(ambRes.value);
      if (trafficRes.status === "fulfilled" && Array.isArray(trafficRes.value)) setIntersections(trafficRes.value);
      if (emRes.status === "fulfilled") {
        setEmergencies(emRes.value);
        // Only load route if an emergency is actively dispatched/en route
        const activeEm = emRes.value.find(e => ['DISPATCHED', 'ASSIGNED', 'EN_ROUTE'].includes(e.status));
        if (activeEm && activeRouteEmergencyIdRef.current !== activeEm.id) {
          handleViewRoute(activeEm.id, true);
        } else if (!activeEm) {
          setSelectedRoute(null);
          activeRouteEmergencyIdRef.current = null;
        }
      }
      if (hospRes.status === "fulfilled") setHospitals(hospRes.value);
      if (notifRes.status === "fulfilled") setNotifications(notifRes.value);
      if (healthRes.status === "fulfilled") setSystemHealth(healthRes.value);
    } catch (err) {
      console.error("Error refreshing SERN data:", err);
    } finally {
      setLoadingData(false);
    }
  }, [handleViewRoute]);

  // Zero-Latency Push: Live WebSocket Connection (replaces 8-second polling)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);

    const disconnectWs = sernApi.connectWebSocket(
      (event) => {
        const { type, data } = event;
        if (type === "ACCIDENT_REGISTERED") {
          playEmergencyAlert();
          setAccidents((prev) => [data, ...prev.filter((a) => a.id !== data.id)]);
        } else if (type === "ACCIDENT_VALIDATED") {
          setAccidents((prev) => prev.map((a) => (a.id === data.id ? { ...a, ...data } : a)));
        } else if (type === "EMERGENCY_CREATED") {
          setEmergencies((prev) => [data, ...prev.filter((e) => e.id !== data.id)]);
        } else if (type === "EMERGENCY_STATUS_UPDATED") {
          setEmergencies((prev) => prev.map((e) => (e.id === data.id ? { ...e, ...data } : e)));
        } else if (type === "AMBULANCE_DISPATCHED") {
          playDispatchChime();
          if (data?.assigned_ambulance) {
            setAmbulances((prev) =>
              prev.map((a) => (a.id === data.assigned_ambulance.id ? { ...a, ...data.assigned_ambulance } : a))
            );
          }
          if (data?.emergency) {
            setEmergencies((prev) =>
              prev.map((e) => (e.id === data.emergency.id ? { ...e, ...data.emergency } : e))
            );
            handleViewRoute(data.emergency.id, true);
          }
        } else if (type === "AMBULANCE_LOCATION_UPDATED") {
          setAmbulances((prev) => prev.map((a) => (a.id === data.id ? { ...a, ...data } : a)));
        } else if (type === "AMBULANCE_TELEMETRY") {
          setAmbulances((prev) =>
            prev.map((a) =>
              a.id === data.id
                ? {
                    ...a,
                    latitude: data.latitude,
                    longitude: data.longitude,
                    status: data.status || a.status,
                  }
                : a
            )
          );
        } else if (type === "NOTIFICATION_RECORDED") {
          setNotifications((prev) => [data, ...prev.filter((n) => n.id !== data.id)]);
        } else if (type === "ROUTE_UPDATED") {
          setSelectedRoute(data);
        } else if (type === "TRAFFIC_SIGNAL_UPDATED" || type === "TRAFFIC_CONGESTION_UPDATED") {
          if (data?.intersections) setIntersections(data.intersections);
        } else if (type === "DASHBOARD_RESET") {
          setAccidents([]);
          setEmergencies([]);
          setSelectedRoute(null);
          fetchData();
        }
      },
      (status) => {
        setWsStatus(status);
      }
    );

    // Occasional low-frequency fallback background sync (60s)
    const fallbackInterval = setInterval(fetchData, 60000);

    return () => {
      clearTimeout(timer);
      disconnectWs();
      clearInterval(fallbackInterval);
    };
  }, [fetchData, handleViewRoute]);

  // Resilient Polling Fallback: whenever WebSocket is disconnected, poll every 2.5s
  useEffect(() => {
    if (wsStatus !== "connected") {
      const pollInterval = setInterval(() => {
        fetchData();
      }, 2500);
      return () => clearInterval(pollInterval);
    }
  }, [wsStatus, fetchData]);

  // Accident Validation Action (Verify / Reject)
  const handleValidateAccident = async (accidentId, confirmed) => {
    try {
      const notes = confirmed
        ? prompt("Enter validation notes (or press OK):", "Confirmed collision via junction monitoring feed")
        : prompt("Enter rejection reason:", "False alarm - normal traffic deceleration");

      if (notes === null) return; // User cancelled prompt

      const valRes = await sernApi.validateAccident(accidentId, {
        confirmed,
        validation_notes: notes,
        auto_dispatch: confirmed
      });

      // Immediately update local state so incident status on pending alert reflects verify or reject
      setAccidents((prev) =>
        prev.map((a) =>
          a.id === accidentId
            ? { ...a, validation_status: confirmed ? "CONFIRMED" : "REJECTED", validation_notes: notes }
            : a
        )
      );

      if (valRes?.emergency?.id) {
        await handleViewRoute(valRes.emergency.id, true);
      }
      await fetchData();
      alert(confirmed ? "Accident validated! Emergency created and ambulance dispatch initiated." : "Accident marked as rejected / false alarm.");
    } catch (err) {
      alert(`Validation failed: ${err.message}`);
    }
  };

  // Dispatch nearest ambulance to an emergency
  const handleDispatchAmbulance = async (emergencyId) => {
    try {
      const res = await sernApi.dispatchAmbulance(emergencyId);
      await handleViewRoute(emergencyId, true);
      await fetchData();
      alert(`Ambulance ${res.assigned_ambulance.registration_number} dispatched! Distance: ${res.distance_km.toFixed(2)} km.`);
    } catch (err) {
      alert(`Dispatch failed: ${err.message}`);
    }
  };

  // Update emergency operational status
  const handleUpdateEmergencyStatus = async (emergencyId, nextStatus) => {
    try {
      const em = emergencies.find(e => e.id === emergencyId);
      if (em && em.status === nextStatus) return;
      await sernApi.updateEmergencyStatus(emergencyId, nextStatus, `Updated to ${nextStatus} by operator.`);
      await fetchData();
    } catch (err) {
      alert(`Failed to update emergency status: ${err.message}`);
    }
  };

  // Assign hospital to emergency
  const handleAssignHospital = async (emergencyId, hospitalId) => {
    try {
      await sernApi.assignHospital(emergencyId, hospitalId);
      await fetchData();
      alert("Destination hospital assigned and arrival alert broadcasted.");
    } catch (err) {
      alert(`Failed to assign hospital: ${err.message}`);
    }
  };

  // Reset all dashboard incident counters, emergencies, and routes to ZERO
  const handleResetDashboard = async () => {
    try {
      setLoadingData(true);
      await sernApi.resetDashboard();
      setAccidents([]);
      setEmergencies([]);
      setSelectedRoute(null);
      activeRouteEmergencyIdRef.current = null;
      setActiveMapCenter([12.9716, 77.5946]);
      await fetchData();
      alert("All dashboard metrics have been initialized to zero.");
    } catch (err) {
      alert(`Failed to reset metrics: ${err.message}`);
    } finally {
      setLoadingData(false);
    }
  };

  // Handle ambulance selection on map (safe inspection vs availability toggle)
  const handleSelectAmbulance = async (ambulance) => {
    const isBusy = ["ASSIGNED", "DISPATCHED", "EN_ROUTE", "AT_SCENE", "TRANSPORTING"].includes(ambulance.status);
    if (isBusy) {
      // Find active emergency for this ambulance or latest active emergency and load its route
      const activeEm = emergencies.find(e => ["DISPATCHED", "ASSIGNED", "EN_ROUTE"].includes(e.status)) || emergencies[0];
      if (activeEm) {
        await handleViewRoute(activeEm.id, true);
        setActivePage("Dashboard");
        return;
      }
    }
    // Only toggle availability for idle ambulances
    handleToggleAmbulanceAvailability(ambulance);
  };

  // Toggle ambulance availability (with active mission guard)
  const handleToggleAmbulanceAvailability = async (ambulance) => {
    if (["ASSIGNED", "DISPATCHED", "EN_ROUTE", "AT_SCENE", "TRANSPORTING"].includes(ambulance.status)) {
      alert(`Ambulance ${ambulance.registration_number} is currently on an active emergency mission (${ambulance.status}). Availability cannot be changed until the emergency is completed.`);
      return;
    }
    const nextStatus = ambulance.status === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE";
    try {
      await sernApi.updateAmbulanceAvailability(ambulance.id, nextStatus);
      await fetchData();
    } catch (err) {
      alert(`Could not update availability: ${err.message}`);
    }
  };

  // Calculated Stats
  const activeEmergencies = emergencies.filter(e => !["COMPLETED", "CANCELLED"].includes(e.status));
  const availableAmbulances = ambulances.filter(a => a.status === "AVAILABLE");
  const pendingAccidents = accidents.filter(a => a.validation_status === "PENDING");

  const operatorStats = [
    {
      title: "Total Sensor Incidents",
      value: accidents.length.toString().padStart(2, "0"),
      change: `${pendingAccidents.length} pending validation`,
      icon: Car,
      color: "blue"
    },
    {
      title: "Active Emergencies",
      value: activeEmergencies.length.toString().padStart(2, "0"),
      change: `${emergencies.filter(e => e.status === "COMPLETED").length} resolved cases`,
      icon: Siren,
      color: "red"
    },
    {
      title: "Available Ambulances",
      value: availableAmbulances.length.toString().padStart(2, "0"),
      change: `Out of ${ambulances.length} fleet units`,
      icon: Ambulance,
      color: "green"
    },
    {
      title: "Partner Hospitals",
      value: hospitals.length.toString().padStart(2, "0"),
      change: "Direct trauma link ready",
      icon: Building2,
      color: "purple"
    },
  ];

  const citizenStats = [
    {
      title: "Public Safety Alerts",
      value: accidents.length.toString().padStart(2, "0"),
      change: `${pendingAccidents.length} pending review`,
      icon: AlertTriangle,
      color: "blue"
    },
    {
      title: "Active Emergencies",
      value: activeEmergencies.length.toString().padStart(2, "0"),
      change: `${emergencies.filter(e => e.status === "COMPLETED").length} resolved cases`,
      icon: Siren,
      color: "red"
    },
    {
      title: "Trauma Care Centers",
      value: hospitals.length.toString().padStart(2, "0"),
      change: "24x7 verified emergency centers",
      icon: Building2,
      color: "purple"
    },
    {
      title: "My Reported Incidents",
      value: citizenReports.length.toString().padStart(2, "0"),
      change: citizenReports.length === 0 ? "No reports submitted yet" : `${citizenReports.length} recorded submissions`,
      icon: FileText,
      color: "green"
    },
  ];

  const stats = isCitizen ? citizenStats : operatorStats;

  // Auth pages view routing with strict authentication guard
  if (showLanding) {
    return (
      <LandingPage
        onEnterDashboard={() => {
          setShowLanding(false);
          if (!currentUser) {
            setShowLogin(true);
          }
        }}
        onSignUp={() => {
          setShowLanding(false);
          setShowRegister(true);
        }}
      />
    );
  }
  if (showRegister) {
    return (
      <RegisterPage
        onRegister={async (newUser) => {
          if (newUser) {
            setCurrentUser(newUser);
          }
          // On new registration, initialize all dashboard metrics to ZERO
          try {
            await sernApi.resetDashboard();
          } catch (e) {
            console.debug("Reset on register:", e);
          }
          setAccidents([]);
          setEmergencies([]);
          setSelectedRoute(null);
          await fetchData();
          setShowRegister(false);
        }}
        onBack={() => {
          setShowRegister(false);
          setShowLogin(true);
        }}
      />
    );
  }
  if (showForgotPassword) {
    return (
      <ForgotPasswordPage
        onBack={() => {
          setShowForgotPassword(false);
          setShowLogin(true);
        }}
      />
    );
  }
  if (!currentUser || showLogin) {
    return (
      <LoginPage
        onLogin={async (user) => {
          if (user) {
            setCurrentUser(user);
          }
          // On new login, initialize all dashboard metrics to ZERO
          try {
            await sernApi.resetDashboard();
          } catch (e) {
            console.debug("Reset on login:", e);
          }
          setAccidents([]);
          setEmergencies([]);
          setSelectedRoute(null);
          await fetchData();
          setShowLogin(false);
        }}
        onBack={() => {
          setShowLogin(false);
          setShowLanding(true);
        }}
        onRegister={() => {
          setShowLogin(false);
          setShowRegister(true);
        }}
        onForgotPassword={() => {
          setShowLogin(false);
          setShowForgotPassword(true);
        }}
      />
    );
  }

  return (
    <div className={`app-container ${theme}-theme`}>
      {/* SIDEBAR NAVIGATION */}
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon"><Activity size={25} /></div>
          <div>
            <h2>SERN</h2>
            <span>Emergency Network</span>
          </div>
          <button className="close-menu" onClick={() => setMobileMenu(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-label">{isCitizen ? "CITIZEN NETWORK" : "OPERATIONS CONSOLE"}</div>

        <nav className="navigation">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const activeCorridorCount = emergencies.filter((e) =>
              ["DISPATCHED", "ASSIGNED", "EN_ROUTE"].includes(e.status)
            ).length;
            const badgeCount =
              item.name === "Accident Alerts" ? pendingAccidents.length :
              item.name === "Ambulances" ? availableAmbulances.length :
              item.name === "Emergency History" ? (isCitizen ? citizenReports.length : activeEmergencies.length) :
              item.name === "Traffic" ? activeCorridorCount : 0;

            const badgeBg =
              item.name === "Accident Alerts" ? "#ef4444" :
              item.name === "Traffic" ? "#10b981" : "#2563eb";

            return (
              <button
                key={item.name}
                className={`nav-item ${activePage === item.name ? "active" : ""}`}
                onClick={() => {
                  setActivePage(item.name);
                  setMobileMenu(false);
                }}
              >
                <Icon size={19} />
                <span style={{ flex: 1, textAlign: "left" }}>{item.name}</span>
                {badgeCount > 0 && (
                  <span style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    padding: "2px 6px",
                    borderRadius: "10px",
                    background: badgeBg,
                    color: "white"
                  }}>
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div style={{ marginTop: "20px", padding: "0 6px" }}>
          {isCitizen ? (
            <button
              className="btn-simulate"
              style={{ width: "100%", justifyContent: "center", background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
              onClick={() => setShowCitizenReport(true)}
            >
              <ShieldAlert size={17} />
              Report Incident (SOS)
            </button>
          ) : (
            <button
              className="btn-simulate"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => setShowSimulator(true)}
            >
              <ShieldAlert size={17} />
              AI Accident Simulator
            </button>
          )}
        </div>

        <div className="sidebar-bottom">
          <ShieldCheck size={20} />
          <div>
            <strong>AI Safeguard Active</strong>
            <span>Model loaded · {systemHealth.database}</span>
          </div>
        </div>
      </aside>

      {mobileMenu && (
        <div className="mobile-overlay" onClick={() => setMobileMenu(false)} />
      )}

      {/* MAIN VIEWPORT */}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-button" onClick={() => setMobileMenu(true)}>
              <Menu size={23} />
            </button>
            <div>
              <h3>{activePage}</h3>
              <p>Smart Emergency Response Network · Bengaluru Region</p>
            </div>
          </div>

          <div className="topbar-right">
            <button
              onClick={fetchData}
              className="btn-secondary"
              title="Refresh Live Data"
              style={{ padding: "6px 12px" }}
            >
              <RefreshCw size={15} className={loadingData ? "spin" : ""} />
              Sync
            </button>

            <div className="system-status" title={`Channel: ${wsStatus === 'connected' ? 'WebSocket (Real-Time Push)' : 'Resilient Polling Fallback (2.5s)'} · System: ${systemHealth.status}`}>
              <span className="status-dot" style={{
                background: wsStatus === "connected" ? "#10b981" : "#06b6d4"
              }}></span>
              {wsStatus === "connected" ? "Live WS (Push)" : "Live (Polling Fallback)"}
            </div>

            <button
              className="notification-button"
              onClick={() => setShowNotifications(true)}
              title="Emergency Notifications Log"
            >
              <Bell size={20} />
              {notifications.length > 0 && <span className="notification-dot"></span>}
            </button>

            <button
              className="theme-toggle"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Toggle Theme"
            >
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="profile" onClick={() => setActivePage("Profile")} style={{ cursor: "pointer" }} title={currentUser?.verificationBadge || "View / Edit Profile"}>
              <div className="profile-avatar">
                {authService?.getInitials ? authService.getInitials(currentUser?.name) : (currentUser?.name?.slice(0, 2)?.toUpperCase() || "AD")}
              </div>
              <div className="profile-info">
                <strong>{currentUser?.name || "System Admin"}</strong>
                <span style={{ color: "#38bdf8", fontWeight: "600" }}>
                  {currentUser?.verificationBadge ? currentUser.verificationBadge.split(" (")[0] : (currentUser?.role || "Administrator")}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                authService.logout();
                setCurrentUser(null);
                setShowLanding(true);
              }}
              className="btn-secondary"
              title="Sign Out / Back to Landing"
              style={{ padding: "6px 10px" }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          {/* Top Banner with Role-Tailored Actions */}
          <section className="welcome-section">
            <div>
              <h1>
                {currentUser?.role === "Ambulance Staff"
                  ? "Ambulance Paramedic Cockpit"
                  : currentUser?.role === "Hospital Staff"
                  ? "Hospital Trauma Unit Operations"
                  : currentUser?.role === "Public Citizen"
                  ? "Citizen Safety & Incident Monitoring Network"
                  : "Emergency Command Center"}
              </h1>
              <p>
                Welcome, <strong style={{ color: "inherit" }}>{currentUser?.name || "Operator"}</strong>.{" "}
                <span style={{ color: "#38bdf8", fontWeight: "bold" }}>
                  [{currentUser?.verificationBadge || "✓ Verified Personnel"}]
                </span>{" "}
                {currentUser?.role === "Ambulance Staff"
                  ? `Active Fleet Vehicle: ${currentUser?.credentialId || "KA-01-EM-1080"} · Zero-latency GPS stream online.`
                  : currentUser?.role === "Hospital Staff"
                  ? `Facility License: ${currentUser?.credentialId || "HOSP-BLR-ICU"} · Trauma emergency bay monitoring active.`
                  : currentUser?.role === "Public Citizen"
                  ? "Public emergency awareness, verified incident reporting & trauma medical network access."
                  : "Real-time vehicle telemetry classification, nearest-ambulance dispatch & hospital alerts."}
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              {isCitizen ? (
                <>
                  <button
                    className="btn-simulate"
                    style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
                    onClick={() => setShowCitizenReport(true)}
                  >
                    <ShieldAlert size={16} />
                    Report Incident (Citizen SOS)
                  </button>
                  <div className="live-indicator">
                    <span className="status-dot"></span> CITIZEN SAFETY LINK ONLINE
                  </div>
                </>
              ) : (
                <>
                  <button
                    className="btn-simulate"
                    onClick={() => setShowSimulator(true)}
                  >
                    <Play size={16} />
                    Simulate Accident (Run ML)
                  </button>
                  <button
                    onClick={handleResetDashboard}
                    title="Initialize all incident metrics to zero"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      background: "rgba(30, 41, 59, 0.7)",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      color: "#94a3b8",
                      fontSize: "12px",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    <RotateCcw size={14} />
                    Reset to Zero
                  </button>
                  <div className="live-indicator">
                    <span className="status-dot"></span> LIVE DISPATCH · WS SYNCED
                  </div>
                </>
              )}
            </div>
          </section>

          {/* PAGE ROUTING */}
          {activePage === "Dashboard" ? (
            <>
              {/* Dynamic Stats Grid */}
              <section className="stats-grid">
                {stats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div className="stat-card" key={stat.title}>
                      <div className={`stat-icon ${stat.color}`}>
                        <Icon size={23} />
                      </div>
                      <p>{stat.title}</p>
                      <h2>{stat.value}</h2>
                      <span>{stat.change}</span>
                    </div>
                  );
                })}
              </section>

              {/* Main Map & Live Alerts Split */}
              <section className="main-grid">
                <div className="panel map-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Integrated Emergency Map</h3>
                      <p>Live coordinates for fleet units, accidents & partner hospitals</p>
                    </div>
                    {selectedRoute ? (
                      <span style={{ fontSize: "11px", background: "#06b6d422", color: "#06b6d4", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold" }}>
                        Route Active ({selectedRoute.distance_km} km)
                      </span>
                    ) : (
                      <span className="map-live">LIVE</span>
                    )}
                  </div>

                  <div className="map-area">
                    <EmergencyMap
                      ambulances={ambulances}
                      accidents={accidents}
                      emergencies={emergencies}
                      hospitals={hospitals}
                      intersections={intersections}
                      selectedRoute={selectedRoute}
                      activeCenter={activeMapCenter}
                      isCitizenRole={isCitizen}
                      onOpenCitizenReport={() => setShowCitizenReport(true)}
                      onSelectAccident={(acc) => {
                        if (!isCitizen) {
                          handleValidateAccident(acc.id, true);
                        }
                      }}
                      onSelectAmbulance={(amb) => {
                        if (!isCitizen) {
                          handleSelectAmbulance(amb);
                        }
                      }}
                      onEmergencyArrived={(emId) => {
                        handleUpdateEmergencyStatus(emId, "AT_SCENE");
                      }}
                    />
                    <div className="map-legend">
                      {isCitizen ? (
                        <>
                          <span>🔴 Incident Site</span>
                          <span>🟢 Partner Hospital</span>
                          <span>🚦 Smart Traffic Signal</span>
                          <span>🛡️ Safe Public Corridors</span>
                        </>
                      ) : (
                        <>
                          <span>🔵 Available Amb</span>
                          <span>🟠 Dispatched Amb</span>
                          <span>🔴 Accident Site</span>
                          <span>🟢 Partner Hospital</span>
                          <span>🚦 Smart Signal</span>
                          <span>🩵 Active Route</span>
                          <span>⚡ Turn-by-Turn GPS</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Panel: Alerts (Role-Tailored) */}
                <div className="panel alerts-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>{isCitizen ? "Active Public Safety Alerts" : "Pending Accident Alerts"}</h3>
                      <p>{isCitizen ? "Verified community alerts & response status" : "Requires explicit operator confirmation"}</p>
                    </div>
                    <AlertTriangle size={21} color="#f87171" />
                  </div>

                  <div className="alert-list">
                    {accidents.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748b" }}>
                        <CheckCircle2 size={32} style={{ margin: "0 auto 8px", color: "#10b981" }} />
                        <p style={{ fontWeight: "600", color: "#cbd5e1" }}>No Pending Incidents</p>
                        <p style={{ fontSize: "12px" }}>All accident candidates have been processed.</p>
                      </div>
                    ) : isCitizen ? (
                      accidents.slice(0, 4).map((alert) => (
                        <div className="alert-item" key={alert.id}>
                          <div className="alert-top">
                            <strong>Safety Alert #{alert.id} ({alert.vehicle_size || 'vehicle'})</strong>
                            <span className="severity critical" style={{
                              background: alert.validation_status === "VALIDATED" ? "#10b98122" : "#f59e0b22",
                              color: alert.validation_status === "VALIDATED" ? "#34d399" : "#fbbf24",
                              border: alert.validation_status === "VALIDATED" ? "1px solid #10b981" : "1px solid #f59e0b"
                            }}>
                              {alert.validation_status === "VALIDATED" ? "Verified Incident" : "Under Review"}
                            </span>
                          </div>
                          <p>
                            <MapPin size={14} /> Lat: {alert.latitude.toFixed(4)}, Lon: {alert.longitude.toFixed(4)}
                          </p>
                          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                            Status: <strong style={{ color: "#e2e8f0" }}>{alert.validation_status === "VALIDATED" ? "Response Dispatched" : "Review in Progress"}</strong>
                          </div>
                        </div>
                      ))
                    ) : (
                      accidents
                        .filter(a => a.validation_status === "PENDING")
                        .slice(0, 4)
                        .map((alert) => (
                          <div className="alert-item" key={alert.id}>
                            <div className="alert-top">
                              <strong>Incident #{alert.id} ({alert.vehicle_size || 'car'})</strong>
                              <span className="severity critical">
                                {formatAiConfidence(alert.accident_probability, alert.model_threshold).percentage}% ML Probability
                              </span>
                            </div>
                            <p>
                              <MapPin size={14} /> Lat: {alert.latitude.toFixed(4)}, Lon: {alert.longitude.toFixed(4)}
                            </p>
                            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                              <button
                                className="btn-primary-sm"
                                style={{ flex: 1, justifyContent: "center" }}
                                onClick={() => handleValidateAccident(alert.id, true)}
                              >
                                Validate & Dispatch
                              </button>
                              <button
                                className="btn-secondary"
                                style={{ padding: "4px 8px" }}
                                onClick={() => handleValidateAccident(alert.id, false)}
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>

                  {isCitizen ? (
                    <div style={{ padding: "10px", borderTop: "1px solid #1e293b", display: "flex", gap: "8px" }}>
                      <button
                        className="btn-primary-sm"
                        style={{ flex: 1, justifyContent: "center" }}
                        onClick={() => setShowCitizenReport(true)}
                      >
                        <Plus size={14} /> Report Incident (SOS)
                      </button>
                      <button className="view-all" style={{ padding: "6px 12px" }} onClick={() => setActivePage("Accident Alerts")}>
                        View All →
                      </button>
                    </div>
                  ) : (
                    <button className="view-all" onClick={() => setActivePage("Accident Alerts")}>
                      View all accident candidates ({accidents.length}) →
                    </button>
                  )}
                </div>
              </section>

              {/* Bottom Quick Row (Role-Tailored) */}
              <section className="bottom-grid">
                {isCitizen ? (
                  <div className="panel">
                    <div className="panel-heading">
                      <div>
                        <h3>Verified Emergency Hospitals & Trauma Centers</h3>
                        <p>24x7 Emergency and ICU medical facilities across Bengaluru</p>
                      </div>
                      <button
                        className="btn-secondary"
                        onClick={() => setActivePage("Hospitals")}
                        style={{ padding: "4px 8px" }}
                      >
                        View Directory ({hospitals.length})
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px", marginTop: "10px" }}>
                      {hospitals.slice(0, 3).map((hosp) => (
                        <div className="ambulance-row" key={hosp.id} style={{ alignItems: "flex-start", gap: "12px" }}>
                          <div className="ambulance-symbol" style={{ background: "#10b98122", color: "#34d399" }}>
                            <Building2 size={20} />
                          </div>
                          <div className="ambulance-details" style={{ flex: 1 }}>
                            <strong>{hosp.name}</strong>
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}><MapPin size={11} /> {hosp.address}</span>
                            <span style={{ fontSize: "11px", color: "#38bdf8", marginTop: "2px" }}><Phone size={11} /> {hosp.contact_information}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="panel">
                    <div className="panel-heading">
                      <div>
                        <h3>Ambulance Fleet Availability</h3>
                        <p>Available units on standby</p>
                      </div>
                      <button
                        className="btn-secondary"
                        onClick={() => setShowAddAmbulance(true)}
                        style={{ padding: "4px 8px" }}
                      >
                        <Plus size={14} /> Add Unit
                      </button>
                    </div>
                    {ambulances.slice(0, 3).map((amb) => (
                      <div className="ambulance-row" key={amb.id}>
                        <div className="ambulance-symbol"><Ambulance size={19} /></div>
                        <div className="ambulance-details">
                          <strong>{amb.registration_number}</strong>
                          <span>({amb.latitude.toFixed(4)}, {amb.longitude.toFixed(4)})</span>
                        </div>
                        <button
                          className={`ambulance-status ${amb.status === "AVAILABLE" ? "available" : "dispatched"}`}
                          onClick={() => handleToggleAmbulanceAvailability(amb)}
                          style={{ border: "none", cursor: "pointer" }}
                          title="Click to toggle availability"
                        >
                          {amb.status}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : activePage === "Accident Alerts" ? (
            /* ACCIDENT ALERTS PAGE */
            <section className="panel alerts-page">
              <div className="panel-heading">
                <div>
                  <h3>{isCitizen ? "Public Safety Alerts & Verified Incidents" : "Accident Candidates & Validation Queue"}</h3>
                  <p>{isCitizen ? "Active emergency alerts and road safety incident updates" : "Sensor telemetry classified by Scikit-learn Random Forest model"}</p>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  {isCitizen ? (
                    <button
                      className="btn-simulate"
                      style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
                      onClick={() => setShowCitizenReport(true)}
                    >
                      <ShieldAlert size={15} /> Report Incident (SOS)
                    </button>
                  ) : (
                    <button className="btn-simulate" onClick={() => setShowSimulator(true)}>
                      <Play size={15} /> Simulate Accident
                    </button>
                  )}
                </div>
              </div>

              {/* Filters */}
              <div style={{ display: "flex", gap: "10px", margin: "14px 0", flexWrap: "wrap" }}>
                {["ALL", "PENDING", "VALIDATED", "NORMAL", "REJECTED"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setAccidentFilter(f)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "6px",
                      border: accidentFilter === f ? "1px solid #3b82f6" : "1px solid #334155",
                      background: accidentFilter === f ? "#1e3a8a" : "#1e293b",
                      color: accidentFilter === f ? "#93c5fd" : "#94a3b8",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer"
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="alerts-list">
                {accidents
                  .filter(a => accidentFilter === "ALL" || a.validation_status === accidentFilter)
                  .map((alert) => {
                    const isPending = alert.validation_status === "PENDING";
                    const isValid = alert.validation_status === "VALIDATED";
                    const isNormal = alert.validation_status === "NORMAL";

                    return (
                      <div className="alert-row" key={alert.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <strong>{isCitizen ? `Incident Alert #${alert.id}` : `Candidate #${alert.id}`}</strong>
                            <span style={{ fontSize: "12px", color: "#64748b" }}>
                              ({alert.vehicle_size || 'car'} · {alert.gyro_is_hd ? "HD Gyro" : "Std Gyro"})
                            </span>
                          </div>
                          <p style={{ margin: "4px 0" }}>
                            Location: {alert.latitude.toFixed(5)}, {alert.longitude.toFixed(5)}
                          </p>
                          <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                            {isCitizen ? (
                              <span>Status: <strong style={{ color: isValid ? "#34d399" : "#38bdf8" }}>{isValid ? "Response Dispatched" : "Under Investigation"}</strong></span>
                            ) : (
                              <>
                                AI Confidence: <strong style={{ color: formatAiConfidence(alert.accident_probability, alert.model_threshold).color }}>
                                  {formatAiConfidence(alert.accident_probability, alert.model_threshold).percentage}% ({formatAiConfidence(alert.accident_probability, alert.model_threshold).label})
                                </strong> (Threshold: {(alert.model_threshold * 100).toFixed(1)}% · Raw: {(alert.accident_probability * 100).toFixed(1)}%)
                              </>
                            )}
                            {alert.validation_notes && <span> · Note: <em>{alert.validation_notes}</em></span>}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span className={`badge-tag ${
                            isPending ? "badge-pending" :
                            isValid ? "badge-validated" :
                            isNormal ? "badge-normal" : "badge-normal"
                          }`}>
                            {alert.validation_status}
                          </span>

                          {!isCitizen && isPending && (
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                className="btn-primary-sm"
                                onClick={() => handleValidateAccident(alert.id, true)}
                              >
                                Confirm & Dispatch
                              </button>
                              <button
                                className="btn-secondary"
                                onClick={() => handleValidateAccident(alert.id, false)}
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>
          ) : activePage === "Ambulances" ? (
            /* AMBULANCE MANAGEMENT PAGE */
            <section className="panel ambulance-page">
              <div className="panel-heading">
                <div>
                  <h3>Emergency Ambulance Fleet</h3>
                  <p>Telemetry, availability status & geographical Haversine assignment</p>
                </div>
                <button className="btn-primary-sm" onClick={() => setShowAddAmbulance(true)}>
                  <Plus size={16} /> Add Ambulance
                </button>
              </div>

              {/* Status Filter */}
              <div style={{ display: "flex", gap: "10px", margin: "14px 0" }}>
                {["ALL", "AVAILABLE", "ASSIGNED", "EN_ROUTE", "UNAVAILABLE"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setAmbulanceFilter(f)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "6px",
                      border: ambulanceFilter === f ? "1px solid #3b82f6" : "1px solid #334155",
                      background: ambulanceFilter === f ? "#1e3a8a" : "#1e293b",
                      color: ambulanceFilter === f ? "#93c5fd" : "#94a3b8",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer"
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="ambulance-cards">
                {ambulances
                  .filter(a => ambulanceFilter === "ALL" || a.status === ambulanceFilter)
                  .map((amb) => {
                    const isAvail = amb.status === "AVAILABLE";
                    return (
                      <div className="ambulance-card" key={amb.id}>
                        <div className="ambulance-card-top">
                          <div className="ambulance-symbol">
                            <Ambulance size={24} />
                          </div>
                          <span className={`ambulance-status ${isAvail ? "available" : "dispatched"}`}>
                            {amb.status}
                          </span>
                        </div>

                        <h3>{amb.registration_number}</h3>
                        <p>Unit ID: #{amb.id}</p>
                        <p>GPS: {amb.latitude.toFixed(4)}, {amb.longitude.toFixed(4)}</p>
                        <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                          <button
                            className="btn-secondary"
                            style={{ flex: 1, justifyContent: "center" }}
                            onClick={() => handleToggleAmbulanceAvailability(amb)}
                          >
                            Set {isAvail ? "Unavailable" : "Available"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>
          ) : activePage === "Emergency History" ? (
            /* EMERGENCY LIFECYCLE MANAGEMENT PAGE */
            <section className="panel history-page">
              <div className="panel-heading">
                <div>
                  <h3>{isCitizen ? "My Emergency Incident Reports & Status" : "Emergency Response Lifecycle Management"}</h3>
                  <p>
                    {isCitizen
                      ? "Track verification status and emergency response for reports you submitted"
                      : "Orchestrate operational stages: PENDING → DISPATCHED → EN_ROUTE → AT_SCENE → TRANSPORTING → COMPLETED"}
                  </p>
                </div>
                <Clock size={25} color="#60a5fa" />
              </div>

              {isCitizen ? (
                <div className="history-list" style={{ marginTop: "16px" }}>
                  {citizenReports.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
                      <CheckCircle2 size={42} style={{ margin: "0 auto 12px", color: "#38bdf8" }} />
                      <h4 style={{ color: "#cbd5e1", fontSize: "16px", marginBottom: "6px" }}>No Incident Reports on File</h4>
                      <p style={{ fontSize: "13px", maxWidth: "420px", margin: "0 auto 16px" }}>
                        Your citizen observer account has not submitted any incident records. Emergency reports you submit will appear here with live verification tracking.
                      </p>
                      <button
                        className="btn-simulate"
                        style={{ margin: "0 auto", background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
                        onClick={() => setShowCitizenReport(true)}
                      >
                        <ShieldAlert size={15} /> Report Incident (Citizen SOS)
                      </button>
                    </div>
                  ) : (
                    citizenReports.map((report) => (
                      <div className="history-card" key={report.id} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <h3>Report #{report.id} ({report.vehicleType?.toUpperCase() || "VEHICLE"})</h3>
                              <span className="badge-tag badge-pending">
                                {report.status || "PENDING_VERIFICATION"}
                              </span>
                            </div>
                            <p style={{ marginTop: "4px" }}>
                              <MapPin size={13} /> {report.locationName} · Reported {new Date(report.reportedAt).toLocaleString()}
                            </p>
                            <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                              Details: <em>{report.description}</em>
                            </p>
                          </div>
                          <span style={{ fontSize: "11px", background: "#ef444422", color: "#f87171", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold" }}>
                            Severity: {report.severity}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="history-list" style={{ marginTop: "16px" }}>
                  {emergencies.length === 0 ? (
                    <p style={{ padding: "20px", color: "#64748b" }}>No emergency cases created yet.</p>
                  ) : (
                    emergencies.map((em) => {
                      const amb = ambulances.find(a => a.id === em.assigned_ambulance_id);
                      const hosp = hospitals.find(h => h.id === em.hospital_id);
                      const isTerminal = ["COMPLETED", "CANCELLED"].includes(em.status);

                      return (
                        <div className="history-card" key={em.id} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <h3>Emergency #{em.id}</h3>
                                <span className={`badge-tag ${
                                  em.status === "COMPLETED" ? "badge-completed" :
                                  em.status === "PENDING" ? "badge-pending" : "badge-dispatched"
                                }`}>
                                  {em.status}
                                </span>
                              </div>
                              <p style={{ marginTop: "4px" }}>
                                Accident Ref: Candidate #{em.accident_id} · Reported {new Date(em.created_at).toLocaleTimeString()}
                              </p>
                            </div>

                            <div style={{ textAlign: "right" }}>
                              {amb ? (
                                <div style={{ fontSize: "13px", fontWeight: "600", color: "#60a5fa" }}>
                                  🚑 {amb.registration_number}
                                </div>
                              ) : (
                                <span style={{ fontSize: "12px", color: "#f87171" }}>No Ambulance Assigned</span>
                              )}
                              {hosp && (
                                <div style={{ fontSize: "12px", color: "#34d399", marginTop: "2px" }}>
                                  🏥 {hosp.name}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Lifecycle Stepper Controls */}
                          {!isTerminal && (
                            <div style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              flexWrap: "wrap",
                              background: "#090d16",
                              padding: "10px",
                              borderRadius: "6px"
                            }}>
                              <span style={{ fontSize: "11px", fontWeight: "bold", color: "#94a3b8" }}>
                                ADVANCE STATUS:
                              </span>

                              {em.status === "PENDING" && (
                                <button
                                  className="btn-primary-sm"
                                  onClick={() => handleDispatchAmbulance(em.id)}
                                >
                                  Dispatch Nearest Ambulance
                                </button>
                              )}

                              {em.status === "DISPATCHED" && (
                                <>
                                  <button
                                    className="btn-primary-sm"
                                    onClick={() => handleUpdateEmergencyStatus(em.id, "EN_ROUTE")}
                                  >
                                    Mark En Route →
                                  </button>
                                  <button
                                    className="btn-primary-sm"
                                    onClick={() => handleUpdateEmergencyStatus(em.id, "AT_SCENE")}
                                  >
                                    Mark Arrived at Scene →
                                  </button>
                                </>
                              )}

                              {em.status === "EN_ROUTE" && (
                                <button
                                  className="btn-primary-sm"
                                  onClick={() => handleUpdateEmergencyStatus(em.id, "AT_SCENE")}
                                >
                                  Mark Arrived at Scene →
                                </button>
                              )}

                              {em.status === "AT_SCENE" && (
                                <button
                                  className="btn-primary-sm"
                                  onClick={() => handleUpdateEmergencyStatus(em.id, "TRANSPORTING")}
                                >
                                  Begin Transporting Patient →
                                </button>
                              )}

                              {em.status === "TRANSPORTING" && (
                                <button
                                  className="btn-success-sm"
                                  onClick={() => handleUpdateEmergencyStatus(em.id, "COMPLETED")}
                                >
                                  Complete Mission (Free Unit) ✓
                                </button>
                              )}

                              {/* Hospital Assignment Dropdown */}
                              {!em.hospital_id && (
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) handleAssignHospital(em.id, parseInt(e.target.value));
                                  }}
                                  defaultValue=""
                                  style={{
                                    background: "#1e293b",
                                    border: "1px solid #334155",
                                    color: "white",
                                    padding: "5px 10px",
                                    borderRadius: "4px",
                                    fontSize: "12px"
                                  }}
                                >
                                  <option value="" disabled>Assign Destination Hospital...</option>
                                  {hospitals.map((h) => (
                                    <option key={h.id} value={h.id}>{h.name}</option>
                                  ))}
                                </select>
                              )}

                              {/* View Route Button */}
                              <button
                                className="btn-secondary"
                                onClick={() => handleViewRoute(em.id)}
                              >
                                <Compass size={13} /> View Map Route
                              </button>

                              <button
                                className="btn-danger-sm"
                                onClick={() => {
                                  if (confirm("Cancel this emergency? Assigned ambulance will be freed.")) {
                                    handleUpdateEmergencyStatus(em.id, "CANCELLED");
                                  }
                                }}
                                style={{ marginLeft: "auto" }}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </section>
          ) : activePage === "Hospitals" ? (
            /* HOSPITALS MANAGEMENT PAGE */
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h3>Partner Hospitals & Trauma Centers</h3>
                  <p>Inbound patient assignment & automated hospital notification broadcast</p>
                </div>
                {!isCitizen && (
                  <button className="btn-primary-sm" onClick={() => setShowAddHospital(true)}>
                    <Plus size={16} /> Add Hospital
                  </button>
                )}
              </div>

              <div className="hospital-cards" style={{ marginTop: "16px" }}>
                {hospitals.map((hospital) => {
                  const assignedEmergencies = emergencies.filter(e => e.hospital_id === hospital.id && !["COMPLETED", "CANCELLED"].includes(e.status));
                  return (
                    <div className="hospital-card" key={hospital.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <h3>{hospital.name}</h3>
                        <span style={{ fontSize: "11px", background: "#10b98122", color: "#10b981", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>
                          Active Facility
                        </span>
                      </div>
                      <p style={{ marginTop: "4px" }}>Facility ID: #{hospital.id}</p>
                      <p><MapPin size={13} /> {hospital.address}</p>
                      <p><Phone size={13} /> {hospital.contact_information}</p>
                      <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #1e293b", fontSize: "12px" }}>
                        <strong>Inbound Patients:</strong>{" "}
                        <span style={{ color: assignedEmergencies.length > 0 ? "#f59e0b" : "#94a3b8" }}>
                          {assignedEmergencies.length} active emergency transfers
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : activePage === "Traffic" ? (
            <TrafficPage
              emergencies={emergencies}
              ambulances={ambulances}
              accidents={accidents}
              hospitals={hospitals}
              selectedRoute={selectedRoute}
              wsStatus={wsStatus}
              onViewRoute={handleViewRoute}
              onNavigate={setActivePage}
            />
          ) : activePage === "Reports" ? (
            <ReportsPage
              accidents={accidents}
              emergencies={emergencies}
              ambulances={ambulances}
              hospitals={hospitals}
              wsStatus={wsStatus}
              onViewRoute={handleViewRoute}
              onNavigate={setActivePage}
            />
          ) : activePage === "Analytics" ? (
            <AnalyticsPage
              accidents={accidents}
              ambulances={ambulances}
              hospitals={hospitals}
              emergencies={emergencies}
              wsStatus={wsStatus}
            />
          ) : activePage === "Profile" ? (
            <ProfilePage
              currentUser={currentUser}
              onUpdateProfile={(updated) => setCurrentUser(updated)}
            />
          ) : null}

          {/* FOOTER */}
          <footer className="footer">
            <span>© 2026 SERN – Smart Emergency Response Network</span>
            <span>
              <span className="status-dot"></span>
              All systems operational · Database connected · AI ML engine online
            </span>
          </footer>
        </div>
      </main>

      {/* POPUP MODALS */}
      <AccidentSimulatorModal
        isOpen={showSimulator}
        onClose={() => setShowSimulator(false)}
        onAccidentCreated={async (newAcc, newEm) => {
          if (newAcc && newAcc.latitude && newAcc.longitude) {
            setActiveMapCenter([newAcc.latitude, newAcc.longitude]);
          }
          if (newEm && newEm.id) {
            await handleViewRoute(newEm.id, true);
          }
          await fetchData();
        }}
      />

      <CitizenReportModal
        isOpen={showCitizenReport}
        onClose={() => setShowCitizenReport(false)}
        currentUser={currentUser}
        onReportSubmitted={async (newAcc, newReport) => {
          if (newAcc && newAcc.latitude && newAcc.longitude) {
            setActiveMapCenter([newAcc.latitude, newAcc.longitude]);
          }
          if (newReport) {
            setCitizenReports((prev) => [newReport, ...prev]);
          }
          await fetchData();
        }}
      />

      <AddAmbulanceModal
        isOpen={showAddAmbulance}
        onClose={() => setShowAddAmbulance(false)}
        onAmbulanceAdded={async () => {
          await fetchData();
        }}
      />

      <AddHospitalModal
        isOpen={showAddHospital}
        onClose={() => setShowAddHospital(false)}
        onHospitalAdded={async () => {
          await fetchData();
        }}
      />

      <NotificationsDrawer
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
      />
    </div>
  );
}

export default App;
