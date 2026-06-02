/**
 * AuthContext
 *
 * WHY we don't read the JWT cookie with document.cookie
 * ──────────────────────────────────────────────────────
 * Django sets `access` and `refresh_token` as HttpOnly cookies.
 * HttpOnly cookies are invisible to JavaScript by design — document.cookie
 * will never contain them. The browser sends them automatically on every
 * HTTP request; we never need to touch them in JS code.
 *
 * HOW session persistence works
 * ──────────────────────────────
 * 1. On login/register, the API response body includes a `user` object
 *    (id, username, email, role_model). We persist ONLY this display data
 *    in localStorage — never the token itself.
 * 2. On every page load we restore that object synchronously from
 *    localStorage. No extra network call needed — the browser will send the
 *    HttpOnly cookies on the next real API request, and the interceptor will
 *    silently refresh them if they've expired.
 * 3. If the refresh token itself has expired (interceptor catches it), the
 *    interceptor fires a global `session:expired` CustomEvent.
 *    AuthProvider listens for that event and clears state automatically.
 *
 * Context value
 * ──────────────
 *   user            – { id, username, email, role_model } | null
 *   isAuthenticated – boolean
 *   isBuyer         – boolean (role_model === 'buyer')
 *   isSeller        – boolean (role_model === 'seller')
 *   authReady       – true once the initial localStorage restore is done
 *   login(userData) – call after a successful API login/register
 *   logout()        – ends the session
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react'
import client from '../api/client'

// ---------------------------------------------------------------------------
// localStorage helpers  (only non-sensitive display data — NOT the JWT)
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'shopnest_user'

export function persistUser(userData) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(userData)) } catch {}
}

export function loadPersistedUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function clearPersistedUser() {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // Restore synchronously from localStorage — no loading spinner needed.
  const [user, setUser] = useState(() => loadPersistedUser())

  // authReady flips to true after the first render so route guards can
  // distinguish "not yet hydrated" from "definitely not logged in".
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    setAuthReady(true)
  }, [])

  // ── Listen for forced logout triggered by the axios interceptor ───────────
  // When the refresh token itself is expired, the interceptor can't auto-
  // recover. It dispatches 'session:expired' so we clear state here without
  // creating a circular dependency between client.js and AuthContext.

  useEffect(() => {
    function onSessionExpired() {
      clearPersistedUser()
      setUser(null)
    }
    window.addEventListener('session:expired', onSessionExpired)
    return () => window.removeEventListener('session:expired', onSessionExpired)
  }, [])

  // ── Sync across tabs ───────────────────────────────────────────────────────
  // If another tab logs out (clears localStorage), mirror that here.

  useEffect(() => {
    function onStorage(e) {
      if (e.key === STORAGE_KEY) {
        const updated = e.newValue ? JSON.parse(e.newValue) : null
        setUser(updated)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // ── Public actions ────────────────────────────────────────────────────────

  const login = useCallback((userData) => {
    persistUser(userData)
    setUser(userData)
  }, [])

  const logout = useCallback(async () => {
    try { await client.post('/api/logout/') } catch {}
    clearPersistedUser()
    setUser(null)
  }, [])

  const value = {
    user,
    isAuthenticated: user !== null,
    isBuyer:  user?.role_model === 'buyer',
    isSeller: user?.role_model === 'seller',
    authReady,   // use this instead of authLoading — it's always false on first render, true after
    login,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export default AuthContext
