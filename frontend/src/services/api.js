// SERN Frontend API Service Client
const sanitizeApiBase = () => {
  const raw = (import.meta.env.VITE_API_BASE_URL || '/api').trim();
  const noTrailing = raw.replace(/\/+$/, '');
  if (noTrailing.startsWith('http') && !noTrailing.endsWith('/api')) {
    return `${noTrailing}/api`;
  }
  return noTrailing;
};
const API_BASE = sanitizeApiBase();

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  let token = null;
  try {
    token = localStorage.getItem("sern_auth_token");
  } catch {
    // Local storage unavailable
  }
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  try {
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      let errorDetail = 'Request failed';
      try {
        const errorJson = await response.json();
        errorDetail = errorJson.detail || errorJson.error || JSON.stringify(errorJson);
      } catch {
        errorDetail = response.statusText || `HTTP Error ${response.status}`;
      }
      throw new Error(errorDetail);
    }
    return await response.json();
  } catch (error) {
    console.error(`API Error on ${options.method || 'GET'} ${endpoint}:`, error);
    throw error;
  }
}

export const sernApi = {
  // System Health
  getHealth: () => request('/health'),

  // Accidents
  getAccidents: (params = {}) => {
    const query = new URLSearchParams();
    if (params.validation_status) query.set('validation_status', params.validation_status);
    if (params.detected_only !== undefined) query.set('detected_only', params.detected_only);
    const qs = query.toString();
    return request(`/accidents${qs ? `?${qs}` : ''}`);
  },

  getAccident: (id) => request(`/accidents/${id}`),

  registerAccident: (payload) =>
    request('/accidents', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  validateAccident: (id, { confirmed, validation_notes, auto_dispatch }) =>
    request(`/accidents/${id}/validate`, {
      method: 'POST',
      body: JSON.stringify({
        confirmed,
        validation_notes,
        auto_dispatch
      })
    }),

  // Ambulances
  getAmbulances: (status) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return request(`/ambulances${qs}`);
  },

  getAmbulance: (id) => request(`/ambulances/${id}`),

  registerAmbulance: (payload) =>
    request('/ambulances', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  updateAmbulanceLocation: (id, { latitude, longitude }) =>
    request(`/ambulances/${id}/location`, {
      method: 'PATCH',
      body: JSON.stringify({ latitude, longitude })
    }),

  streamAmbulanceTelemetry: (id, telemetry) =>
    request(`/ambulances/${id}/telemetry`, {
      method: 'POST',
      body: JSON.stringify(telemetry)
    }),

  updateAmbulanceAvailability: (id, status) =>
    request(`/ambulances/${id}/availability`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),

  // Emergencies
  getEmergencies: (status) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return request(`/emergencies${qs}`);
  },

  getEmergency: (id) => request(`/emergencies/${id}`),

  dispatchAmbulance: (emergencyId) =>
    request(`/emergencies/${emergencyId}/dispatch`, {
      method: 'POST'
    }),

  updateEmergencyStatus: (emergencyId, status, notes = null) =>
    request(`/emergencies/${emergencyId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes })
    }),

  completeEmergency: (emergencyId) =>
    request(`/emergencies/${emergencyId}/complete`, {
      method: 'POST'
    }),

  cancelEmergency: (emergencyId) =>
    request(`/emergencies/${emergencyId}/cancel`, {
      method: 'POST'
    }),

  assignHospital: (emergencyId, hospitalId) =>
    request(`/emergencies/${emergencyId}/assign-hospital`, {
      method: 'POST',
      body: JSON.stringify({ hospital_id: hospitalId })
    }),

  // Hospitals
  getHospitals: (activeOnly = true) =>
    request(`/hospitals?active_only=${activeOnly}`),

  registerHospital: (payload) =>
    request('/hospitals', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Routing
  getRoute: (emergencyId) => request(`/routing/${emergencyId}`),

  generateMockRoute: (emergencyId) =>
    request(`/routing/${emergencyId}/mock`, {
      method: 'POST'
    }),

  postRoute: (emergencyId, payload) =>
    request(`/routing/${emergencyId}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Notifications
  getNotifications: (emergencyId = null) => {
    const qs = emergencyId ? `?emergency_id=${emergencyId}` : '';
    return request(`/notifications${qs}`);
  },

  createNotification: (payload) =>
    request('/notifications', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Authentication & Personnel Management
  register: (payload) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  login: (payload) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Legacy OTP Stubs
  sendOtp: (payload) =>
    request('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  verifyOtp: (payload) =>
    request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Dashboard Reset to Zero
  resetDashboard: () =>
    request('/accidents/reset', {
      method: 'POST'
    }),

  // Real-Time WebSocket Push Connection
  connectWebSocket: (onMessage, onStatusChange) => {
    let ws = null;
    let isExplicitlyClosed = false;
    let reconnectTimeout = null;
    let heartbeatInterval = null;

    const getWsUrl = () => {
      if (import.meta.env.VITE_WS_URL) {
        let customWs = import.meta.env.VITE_WS_URL.trim();
        if (customWs.startsWith('https://')) customWs = customWs.replace(/^https:\/\//, 'wss://');
        else if (customWs.startsWith('http://')) customWs = customWs.replace(/^http:\/\//, 'ws://');
        return customWs;
      }
      if (API_BASE.startsWith('http')) {
        return API_BASE.replace(/^http/, 'ws') + '/ws';
      }
      const loc = window.location;
      const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
      // In local development, always connect directly to FastAPI backend on port 8000
      if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') {
        return `${protocol}//${loc.hostname}:8000/api/ws`;
      }
      return `${protocol}//${loc.host}/api/ws`;
    };

    let retryDelay = 2000;

    const connect = () => {
      try {
        const wsUrl = getWsUrl();
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          retryDelay = 2000;
          if (onStatusChange) onStatusChange('connected');
          // Start heartbeat ping
          heartbeatInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send('ping');
            }
          }, 15000);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (onMessage) onMessage(data);
          } catch (e) {
            console.debug("WS parse error:", e);
          }
        };

        ws.onclose = () => {
          if (heartbeatInterval) clearInterval(heartbeatInterval);
          if (onStatusChange) onStatusChange('disconnected');
          if (!isExplicitlyClosed) {
            reconnectTimeout = setTimeout(connect, retryDelay);
            retryDelay = Math.min(30000, retryDelay * 1.5);
          }
        };

        ws.onerror = () => {
          try {
            ws.close();
          } catch {
            // Ignore close error
          }
        };
      } catch {
        if (onStatusChange) onStatusChange('error');
        if (!isExplicitlyClosed) {
          reconnectTimeout = setTimeout(connect, retryDelay);
          retryDelay = Math.min(30000, retryDelay * 1.5);
        }
      }
    };

    connect();

    return () => {
      isExplicitlyClosed = true;
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }
};
