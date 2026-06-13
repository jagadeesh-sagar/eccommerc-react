/**
 * CSRF Token Utility
 *
 * Django sets a 'csrftoken' cookie automatically on every response when
 * CSRF_COOKIE_HTTPONLY = False (which is already set in settings.py).
 * Because it's not HttpOnly, JavaScript can read it directly — no separate
 * API call is needed in the happy path.
 *
 * fetchCSRF() is still provided so App.jsx can prime the cookie on boot
 * (in case no Django request has fired yet), and so the axios interceptor
 * can force-refresh it after a token rotation.
 */

const API_BASE = 'https://api.chatram.in'

/**
 * Read the current CSRF token from the csrftoken cookie.
 * Returns null if the cookie hasn't been set yet.
 */
export function getCSRF() {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith('csrftoken='))
  return match ? decodeURIComponent(match.split('=')[1]) : null
}

/**
 * Ensure the csrftoken cookie is set by making a lightweight GET to the
 * CSRF endpoint.  After the response Django will have set the cookie and
 * getCSRF() will return the token.
 *
 * Safe to call multiple times — skips the network hit if the cookie is
 * already present (unless force=true).
 *
 * @param {boolean} [force=false]  Force a fresh GET even if cookie exists.
 * @returns {Promise<string|null>} The CSRF token, or null on failure.
 */
export async function fetchCSRF(force = false) {
  if (!force && getCSRF()) return getCSRF()

  try {
    // GET /api/csrf-token/ triggers ensure_csrf_cookie on the server,
    // which sets the csrftoken cookie in the response.
    await fetch(`${API_BASE}/api/csrf-token/`, {
      credentials: 'include',   // must include cookies so Django can tie
                                 // the CSRF token to the session
    })
  } catch (e) {
    console.warn('[csrf] Prefetch failed — will retry on first mutating request:', e)
  }

  return getCSRF()
}
