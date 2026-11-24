// SERN Personnel Authentication & Management Service
import { sernApi } from "./api";

const STORAGE_KEY_USER = "sern_active_user";
const STORAGE_KEY_USERS_DB = "sern_registered_users";

export const authService = {
  // Validate RFC-compliant email address format
  validateEmail: (email) => {
    if (!email || typeof email !== "string") {
      return { valid: false, error: "Email address is required." };
    }
    const trimmed = email.trim();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmed)) {
      return {
        valid: false,
        error: "Invalid email address! Must follow standard format (e.g. user@domain.com)."
      };
    }
    return { valid: true, sanitized: trimmed.toLowerCase() };
  },

  // Get user initials for display avatar (e.g. "John Doe" -> "JD", "Admin" -> "AD")
  getInitials: (name) => {
    if (!name || typeof name !== "string") return "AD";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "AD";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  },

  // Validate mobile number format (optional in profile or fallback)
  validateMobile: (phone) => {
    if (!phone) return { valid: true, sanitized: "" };
    const cleaned = String(phone).replace(/\D/g, "");
    if (cleaned.length === 10) return { valid: true, sanitized: cleaned };
    if (cleaned.length === 12 && cleaned.startsWith("91")) return { valid: true, sanitized: cleaned.slice(2) };
    return { valid: false, error: "Please enter a valid 10-digit mobile number." };
  },

  // Determine official verification badge based on role and credential
  getVerificationBadge: (role, credentialId) => {
    switch (role) {
      case "Ambulance Staff":
        return `✓ Verified Municipal Paramedic (${credentialId || "Fleet Unit KA-01"})`;
      case "Hospital Staff":
        return `✓ Certified Trauma Desk (${credentialId || "Partner Facility"})`;
      case "Administrator":
        return `👑 Authorized Dispatch Commander (${credentialId || "ADMIN-HQ-2026"})`;
      case "Public Citizen":
      default:
        return "🛡️ Registered Citizen Observer";
    }
  },

  // Get active session
  getCurrentUser: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USER);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to load user session:", e);
    }
    return null;
  },

  // Save active session
  setCurrentUser: (user) => {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEY_USER);
      }
    } catch (e) {
      console.warn("Failed to save user session:", e);
    }
  },

  // Get all registered users from local cache
  getRegisteredUsers: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USERS_DB);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to load users DB:", e);
    }
    return [];
  },

  // Check if an email is already registered
  isEmailRegistered: (email) => {
    if (!email) return false;
    const users = authService.getRegisteredUsers();
    return users.some(u => u.email.toLowerCase() === email.trim().toLowerCase());
  },

  // Register a new user with email and password
  register: async ({ name, email, role, password, credentialId }) => {
    const emailVal = authService.validateEmail(email);
    if (!emailVal.valid) throw new Error(emailVal.error);

    if (!name || name.trim().length < 2) {
      throw new Error("Full name is required (minimum 2 characters).");
    }
    if (!password || password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }

    const badge = authService.getVerificationBadge(role, credentialId);

    let serverUser = null;
    let token = null;

    try {
      const res = await sernApi.register({
        name: name.trim(),
        email: emailVal.sanitized,
        password,
        role: role || "Ambulance Staff",
        credential_id: credentialId ? credentialId.trim() : ""
      });
      if (res && res.user) {
        serverUser = res.user;
        token = res.token;
      }
    } catch (err) {
      console.warn("Backend registration notice:", err);
      if (err.message && err.message.toLowerCase().includes("already registered")) {
        throw new Error("An account is already registered with this email. Please sign in instead.", { cause: err });
      }
    }

    const newUser = {
      id: serverUser?.id || Date.now(),
      name: name.trim(),
      email: emailVal.sanitized,
      role: role || "Ambulance Staff",
      password: password,
      credentialId: credentialId ? credentialId.trim() : "",
      isVerified: true,
      verificationBadge: badge,
      registeredAt: new Date().toISOString()
    };

    const users = authService.getRegisteredUsers();
    const existingIndex = users.findIndex(u => u.email.toLowerCase() === emailVal.sanitized);
    if (existingIndex >= 0) {
      users[existingIndex] = newUser;
    } else {
      users.push(newUser);
    }

    try {
      localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(users));
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
      if (token) {
        localStorage.setItem("sern_auth_token", token);
      } else {
        localStorage.setItem("sern_auth_token", "sern-local-verified-token");
      }
    } catch (e) {
      console.warn("Failed to persist registration:", e);
    }

    return newUser;
  },

  // Login with email and password
  login: async ({ email, password }) => {
    const emailVal = authService.validateEmail(email);
    if (!emailVal.valid) throw new Error(emailVal.error);

    if (!password) {
      throw new Error("Please enter your password.");
    }

    // 1. Try Backend Authentication
    try {
      const res = await sernApi.login({
        email: emailVal.sanitized,
        password
      });

      if (res && res.user) {
        const badge = authService.getVerificationBadge(res.user.role, res.user.credential_id);
        const loggedInUser = {
          ...res.user,
          isVerified: true,
          verificationBadge: badge
        };
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(loggedInUser));
        if (res.token) {
          localStorage.setItem("sern_auth_token", res.token);
        }
        return loggedInUser;
      }
    } catch (err) {
      if (err.message && (err.message.includes("No account found") || err.message.includes("not found"))) {
        throw new Error("No account found with this email. Please sign up first to create your personnel account.", { cause: err });
      }
      if (err.message && err.message.includes("Incorrect password")) {
        throw err;
      }
    }

    // 2. Client-side database check (enforces sign-up first requirement)
    const users = authService.getRegisteredUsers();
    const found = users.find(u => u.email.toLowerCase() === emailVal.sanitized);

    if (!found) {
      throw new Error("No account found with this email. Please sign up first to create your personnel account.");
    }

    if (found.password && found.password !== password) {
      throw new Error("Incorrect password. Please verify your credentials and try again.");
    }

    const badge = authService.getVerificationBadge(found.role, found.credentialId);
    const loggedInUser = {
      ...found,
      isVerified: true,
      verificationBadge: badge
    };

    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(loggedInUser));
    return loggedInUser;
  },

  // Update profile
  updateProfile: ({ name, email, role, credentialId }) => {
    const current = authService.getCurrentUser() || {};
    const updated = {
      ...current,
      name: name || current.name,
      email: email || current.email,
      role: role || current.role,
      credentialId: credentialId !== undefined ? credentialId : current.credentialId,
      verificationBadge: authService.getVerificationBadge(role || current.role, credentialId !== undefined ? credentialId : current.credentialId)
    };
    authService.setCurrentUser(updated);

    const users = authService.getRegisteredUsers();
    const idx = users.findIndex(u => u.email.toLowerCase() === updated.email.toLowerCase());
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...updated };
      try {
        localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(users));
      } catch (e) {
        console.warn("Failed to persist user update:", e);
      }
    }
    return updated;
  },

  // Logout
  logout: () => {
    try {
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem("sern_auth_token");
    } catch (e) {
      console.warn("Logout error:", e);
    }
  }
};
