/**
 * utils/api.js
 * Central API client for Kernexa.
 *
 * - Attaches Bearer token from memory to every request
 * - On 401: attempts token refresh via httpOnly cookie
 * - On refresh failure: redirects to /login
 * - Exposes setToken() so LoginPage can inject the token after login
 */

const BASE = "";
export const API_BASE = BASE;

// ── In-memory token store ─────────────────────────────────────────────────────
// Never stored in localStorage — lives only in JS memory for security.
// Lost on page refresh → auto-refreshed via httpOnly cookie on next request.

let _accessToken = null;
let _refreshing  = null;   // pending refresh promise — prevents parallel refresh calls
let _onLogout    = null;   // callback set by App to handle forced logout

export function setToken(token) {
  _accessToken = token;
}

export function getToken() {
  return _accessToken;
}

export function clearToken() {
  _accessToken = null;
}

export function setLogoutCallback(fn) {
  _onLogout = fn;
}

// ── Token refresh ─────────────────────────────────────────────────────────────

async function _refresh() {
  // Deduplicate parallel refresh calls
  if (_refreshing) return _refreshing;

  _refreshing = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method:      "POST",
        credentials: "include",   // sends httpOnly refresh_token cookie
      });
      if (!res.ok) throw new Error("refresh failed");
      const data = await res.json();
      _accessToken = data.access_token;
      return true;
    } catch {
      _accessToken = null;
      if (_onLogout) _onLogout();
      return false;
    } finally {
      _refreshing = null;
    }
  })();

  return _refreshing;
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function _fetch(path, options = {}, retry = true) {
  const headers = {
    ...(options.headers || {}),
  };

  // Don't set Content-Type for FormData — browser sets it with boundary
  if (!(options.body instanceof FormData) && options.body && typeof options.body === "string") {
    headers["Content-Type"] = "application/json";
  }

  if (_accessToken) {
    headers["Authorization"] = `Bearer ${_accessToken}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  // On 401 — try to refresh once, then retry original request
  if (res.status === 401 && retry) {
    const refreshed = await _refresh();
    if (refreshed) {
      return _fetch(path, options, false);  // retry once after refresh
    }
    // Refresh failed — user is logged out, redirect handled by _refresh()
    throw new Error("Session expired — please log in again");
  }

  return res;
}

// ── Public API helpers ────────────────────────────────────────────────────────

export async function apiFetch(path, options = {}) {
  const res = await _fetch(path, options);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") {
        detail = data.detail;
      } else if (Array.isArray(data.detail)) {
        // FastAPI validation errors: array of { loc, msg, type }
        detail = data.detail.map(e => e.msg || JSON.stringify(e)).join("; ");
      } else if (data.detail) {
        detail = JSON.stringify(data.detail);
      }
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export async function apiPost(path, body, options = {}) {
  return apiFetch(path, {
    ...options,
    method: "POST",
    body:   JSON.stringify(body),
  });
}

export async function apiDelete(path, options = {}) {
  return apiFetch(path, { ...options, method: "DELETE" });
}

export async function apiPut(path, body, options = {}) {
  return apiFetch(path, {
    ...options,
    method: "PUT",
    body:   JSON.stringify(body),
  });
}

// ── Upload helper (FormData) ──────────────────────────────────────────────────

export async function apiUpload(path, formData) {
  const res = await _fetch(path, {
    method: "POST",
    body:   formData,
    // No Content-Type header — browser sets multipart/form-data with boundary
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") {
        detail = data.detail;
      } else if (Array.isArray(data.detail)) {
        detail = data.detail.map(e => e.msg || JSON.stringify(e)).join("; ");
      } else if (data.detail) {
        detail = JSON.stringify(data.detail);
      }
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

export async function login(username, password) {
  const res = await fetch("/api/auth/login", {
    method:      "POST",
    headers:     { "Content-Type": "application/json" },
    credentials: "include",
    body:        JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Login failed (${res.status})`);
  }
  const data = await res.json();
  _accessToken = data.access_token;
  return data;   // { access_token, user: { id, username, role } }
}

export async function logout() {
  try {
    await fetch("/api/auth/logout", {
      method:      "POST",
      credentials: "include",
    });
  } finally {
    _accessToken = null;
  }
}

export async function tryRefreshOnLoad() {
  /**
   * Called once on app startup.
   * If the user has a valid refresh_token cookie from a previous session,
   * this silently gets a new access token so they don't have to log in again.
   * Returns true if refreshed, false if they need to log in.
   */
  try {
    const res = await fetch("/api/auth/refresh", {
      method:      "POST",
      credentials: "include",
    });
    if (!res.ok) {
      console.debug("[auth] refresh failed:", res.status);
      return false;
    }
    const data = await res.json();
    _accessToken = data.access_token;
    console.debug("[auth] session restored via refresh cookie");
    return true;
  } catch (e) {
    console.debug("[auth] refresh error:", e.message);
    return false;
  }
}