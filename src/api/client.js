/**
 * Axios Client
 *
 * Pre-configured axios instance for the Django REST API.
 *
 * Key behaviours
 * ──────────────
 * • withCredentials: true
 *     The browser automatically attaches every cookie that belongs to the
 *     target origin (including HttpOnly JWT cookies) to each request.
 *     You never need to read or set those cookies in JavaScript.
 *
 * • Async request interceptor
 *     Ensures the CSRF token is fetched (once, then cached) before any
 *     mutating request fires, then attaches it as X-CSRFToken.
 *
 * • Response interceptor — silent JWT refresh on 401
 *     When any non-auth endpoint returns 401, the interceptor tries
 *     POST /api/refresh/ once.  If that succeeds the original request is
 *     retried transparently.  If the refresh itself fails (token truly
 *     expired) a global `session:expired` CustomEvent is dispatched so
 *     AuthContext can clear state without a circular import.
 *
 * • Auth endpoints are excluded from the retry loop
 *     Login / register / logout / refresh returning 401 just means bad
 *     credentials or an expired token — never trigger a recursive refresh.
 */

import axios from "axios";
import { getCSRF, fetchCSRF } from "../utils/csrf";

// ---------------------------------------------------------------------------
// Instance
// ---------------------------------------------------------------------------

const client = axios.create({
  baseURL: "https://api.chatram.in",
  withCredentials: true, // sends HttpOnly JWT cookies automatically
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ---------------------------------------------------------------------------
// Request interceptor — attach CSRF token to every mutating request
// ---------------------------------------------------------------------------

const MUTATING = new Set(["post", "patch", "put", "delete"]);

client.interceptors.request.use(
  async (config) => {
    if (MUTATING.has(config.method?.toLowerCase())) {
      let token = getCSRF();
      if (!token) {
        try {
          token = await fetchCSRF();
        } catch (e) {
          console.warn("[client] CSRF fetch failed:", e);
        }
      }
      if (token) config.headers["X-CSRFToken"] = token;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// Response interceptor — transparent JWT refresh on 401
// ---------------------------------------------------------------------------

let isRefreshing = false;
let pendingQueue = [];

function processQueue(error) {
  pendingQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(),
  );
  pendingQueue = [];
}

/**
 * These endpoints returning 401 means bad credentials / expired token —
 * never attempt a silent refresh for them (prevents infinite recursion).
 */
const NO_REFRESH_URLS = [
  "/api/login/",
  "/api/register/",
  "/api/logout/",
  "/api/refresh/",
];

function isAuthEndpoint(url = "") {
  return NO_REFRESH_URLS.some((ep) => url.includes(ep));
}

client.interceptors.response.use(
  (response) => response,

  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (status === 401 && !isAuthEndpoint(original?.url) && !original?._retry) {
      if (isRefreshing) {
        // Another request is already refreshing — queue this one.
        return new Promise((resolve, reject) =>
          pendingQueue.push({ resolve, reject }),
        )
          .then(() => client(original))
          .catch((err) => Promise.reject(err));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        // refresh_token HttpOnly cookie is sent automatically by the browser.
        // No body needed — Django reads the cookie directly.
        await client.post("/api/refresh/");
        await fetchCSRF(true); // re-fetch CSRF for the new session
        processQueue(null);
        return client(original); // retry the original request
      } catch (refreshError) {
        processQueue(refreshError);

        // Refresh token is expired or revoked.
        // Dispatch an event so AuthContext can log out without a circular import.
        window.dispatchEvent(new CustomEvent("session:expired"));

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default client;
