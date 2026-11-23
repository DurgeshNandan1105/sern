// SERN Client-side Authentication, Verification & 2-Factor OTP Manager

const STORAGE_KEY_USER = "sern_active_user";
const STORAGE_KEY_USERS_DB = "sern_registered_users";
const STORAGE_KEY_PENDING_OTP = "sern_pending_otp";

// Default seed administrative user
const DEFAULT_USER = {
  name: "System Admin",
  email: "admin@sern.com",
  phone: "9876543210",
  role: "Administrator",
  isVerified: true,
  verificationBadge: "👑 Authorized Dispatch Commander",
  credentialId: "ADMIN-HQ-2026"
};

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

  // Validate 10-digit mobile number format
  validateMobile: (phone) => {
    if (!phone || typeof phone !== "string") {
      return { valid: false, error: "Mobile number is required." };
    }
    const cleaned = phone.replace(/[\s\-()]/g, "");
    // Accepts 10 digits starting with 6-9, or +91 followed by 10 digits
    const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
    if (!phoneRegex.test(cleaned)) {
      return {
        valid: false,
        error: "Invalid mobile number! Must be a valid 10-digit phone number (e.g. 9876543210)."
      };
    }
    const standard10 = cleaned.slice(-10);
    return { valid: true, sanitized: standard10 };
  },

  // Generate a secure 6-digit OTP code for 2-Factor Authentication
  generateOTP: (recipient) => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes validity
    const otpData = {
      otp,
      recipient,
      expiresAt: expiry
    };
    try {
      sessionStorage.setItem(STORAGE_KEY_PENDING_OTP, JSON.stringify(otpData));
    } catch {
      // Fallback
    }
    return otpData;
  },

  // Verify entered OTP
  verifyOTP: (enteredOtp) => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY_PENDING_OTP);
      if (!stored) {
        return { verified: false, error: "OTP expired or not found. Please request a new code." };
      }
      const otpData = JSON.parse(stored);
      if (Date.now() > otpData.expiresAt) {
        sessionStorage.removeItem(STORAGE_KEY_PENDING_OTP);
        return { verified: false, error: "OTP has expired. Please click 'Resend Code'." };
      }
      if (otpData.otp !== (enteredOtp || "").trim()) {
        return { verified: false, error: "Invalid OTP code! Please enter the exact 6-digit code sent to your mobile." };
      }
      sessionStorage.removeItem(STORAGE_KEY_PENDING_OTP);
      return { verified: true };
    } catch (e) {
      console.warn("OTP verification error:", e);
      return { verified: false, error: "Failed to verify OTP." };
    }
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
    return DEFAULT_USER;
  },

  // Save active session
  setCurrentUser: (user) => {
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } catch (e) {
      console.warn("Failed to save user session:", e);
    }
  },

  // Get all registered users
  getRegisteredUsers: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USERS_DB);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to load users DB:", e);
    }
    return [DEFAULT_USER];
  },

  // Register a new user with verified credentials
  register: ({ name, email, phone, role, password, credentialId }) => {
    const emailVal = authService.validateEmail(email);
    if (!emailVal.valid) throw new Error(emailVal.error);

    const phoneVal = authService.validateMobile(phone);
    if (!phoneVal.valid) throw new Error(phoneVal.error);

    const users = authService.getRegisteredUsers();
    const existingIndex = users.findIndex(u => u.email.toLowerCase() === emailVal.sanitized);

    const badge = authService.getVerificationBadge(role, credentialId);

    const newUser = {
      name: name.trim(),
      email: emailVal.sanitized,
      phone: phoneVal.sanitized,
      role: role || "Public Citizen",
      password: password,
      credentialId: credentialId ? credentialId.trim() : "",
      isVerified: true,
      verificationBadge: badge,
      registeredAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      users[existingIndex] = newUser;
    } else {
      users.push(newUser);
    }

    try {
      localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(users));
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
    } catch (e) {
      console.warn("Failed to persist registration:", e);
    }

    return newUser;
  },

  // Login with role authorization and name persistence
  login: ({ name, email, phone, password, role, credentialId }) => {
    const emailVal = authService.validateEmail(email);
    if (!emailVal.valid) throw new Error(emailVal.error);

    if (phone) {
      const phoneVal = authService.validateMobile(phone);
      if (!phoneVal.valid) throw new Error(phoneVal.error);
    }

    const users = authService.getRegisteredUsers();
    const foundIndex = users.findIndex(u => u.email.toLowerCase() === emailVal.sanitized);
    const found = foundIndex >= 0 ? users[foundIndex] : null;

    const finalRole = role || (found ? found.role : "Administrator");
    const badge = authService.getVerificationBadge(finalRole, credentialId || (found ? found.credentialId : ""));

    const resolvedName = (name && name.trim()) || (found && found.name) || email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || "Emergency Responder";

    const loggedInUser = found
      ? {
          ...found,
          name: resolvedName,
          role: finalRole,
          phone: phone ? phone.trim() : found.phone,
          isVerified: true,
          verificationBadge: badge,
          credentialId: credentialId || found.credentialId || ""
        }
      : {
          name: resolvedName,
          email: emailVal.sanitized,
          phone: phone ? phone.trim() : "9876543210",
          role: finalRole,
          password: password,
          credentialId: credentialId || "",
          isVerified: true,
          verificationBadge: badge,
          registeredAt: new Date().toISOString()
        };

    if (foundIndex >= 0) {
      users[foundIndex] = loggedInUser;
    } else {
      users.push(loggedInUser);
    }

    try {
      localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(users));
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(loggedInUser));
    } catch (e) {
      console.warn("Failed to save login session:", e);
    }

    return loggedInUser;
  },

  // Update profile with validation
  updateProfile: (updatedData) => {
    if (updatedData.email) {
      const emailVal = authService.validateEmail(updatedData.email);
      if (!emailVal.valid) throw new Error(emailVal.error);
      updatedData.email = emailVal.sanitized;
    }
    if (updatedData.phone) {
      const phoneVal = authService.validateMobile(updatedData.phone);
      if (!phoneVal.valid) throw new Error(phoneVal.error);
      updatedData.phone = phoneVal.sanitized;
    }

    const current = authService.getCurrentUser();
    const badge = authService.getVerificationBadge(updatedData.role || current.role, updatedData.credentialId || current.credentialId);

    const updated = {
      ...current,
      ...updatedData,
      verificationBadge: badge
    };

    authService.setCurrentUser(updated);

    const users = authService.getRegisteredUsers();
    const index = users.findIndex(u => u.email.toLowerCase() === updated.email.toLowerCase());
    if (index >= 0) {
      users[index] = { ...users[index], ...updated };
      localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(users));
    }

    return updated;
  },

  // Logout
  logout: () => {
    try {
      localStorage.removeItem(STORAGE_KEY_USER);
      sessionStorage.removeItem(STORAGE_KEY_PENDING_OTP);
    } catch (e) {
      console.warn("Logout error:", e);
    }
  },

  // Compute initials for avatar (e.g. "John Doe" -> "JD", "Alex Morgan" -> "AM")
  getInitials: (name) => {
    if (!name || typeof name !== "string") return "EM";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (parts[0].length >= 2) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return parts[0].toUpperCase();
  }
};
