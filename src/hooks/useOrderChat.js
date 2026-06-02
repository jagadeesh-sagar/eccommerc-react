/**
 * useOrderChat(orderId, currentUser)
 *
 * Manages real-time order chat via WebSocket.
 *
 * WS event types received:
 *   history  → { type:"history", message:[...] }  — sent by server on connect
 *   message  → { type:"message", message, sender, sender_id, timestamp }
 *   typing   → { type:"typing",  user, is_typing }
 *   read     → { type:"read",    message_id, user }
 *
 * WS events sent:
 *   chat     → { message }
 *   typing   → { type:"typing", is_typing }
 *   read     → { type:"read",   message_id }
 *
 * History (load more) → GET /user/orders/:id/chat/
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import client from '../api/client'
import { getCSRF } from '../utils/csrf'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const WS_BASE  = API_BASE.replace(/^http/, 'ws')

// ── JWT helper (3-strategy fallback) ──────────────────────────────────────────

async function getWsToken() {
  const cookieMatch = document.cookie
    .split('; ')
    .find((r) => r.startsWith('access='))
  if (cookieMatch) return decodeURIComponent(cookieMatch.split('=').slice(1).join('='))

  try {
    const csrf = getCSRF()
    const res = await fetch(`${API_BASE}/api/refresh/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRFToken': csrf } : {}),
      },
    })
    if (res.ok) {
      const body = await res.json().catch(() => ({}))
      const tok = body.access || body.access_token || body.token
      if (tok) return tok
    }
  } catch { /* ignore */ }

  return null
}

// ── Normalise message from any source to consistent shape ─────────────────────

function normalizeMsg(raw) {
  return {
    id:        raw.id        ?? null,
    message:   raw.message   ?? '',
    sender:    raw.sender    ?? raw.sender_username ?? '',
    sender_id: raw.sender_id ?? null,
    timestamp: raw.timestamp ?? null,
    is_read:   raw.is_read   ?? false,
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * @param {number|string|null} orderId
 * @param {{ id, username } | null} currentUser
 */
export function useOrderChat(orderId, currentUser) {
  const [messages,       setMessages]       = useState([])
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [otherTyping,    setOtherTyping]    = useState(false)
  const [unreadCount,    setUnreadCount]    = useState(0)
  const [hasMore,        setHasMore]        = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const wsRef          = useRef(null)
  const timerRef       = useRef(null)
  const typingTimer    = useRef(null)
  const hadErrorRef    = useRef(false)
  // Keep current user in a ref so WS callbacks always see the latest value
  const meRef          = useRef(currentUser)
  useEffect(() => { meRef.current = currentUser }, [currentUser])

  // ── Helper: is this message mine? ────────────────────────────────────────────
  function isFromMe(msg) {
    const me = meRef.current
    if (!me) return false
    if (msg.sender_id && me.id)       return msg.sender_id === me.id
    if (msg.sender    && me.username) return msg.sender    === me.username
    return false
  }

  // ── Connect ──────────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!orderId) return

    clearTimeout(timerRef.current)

    if (wsRef.current) {
      wsRef.current.onclose = null
      wsRef.current.onerror = null
      wsRef.current.close()
      wsRef.current = null
    }

    hadErrorRef.current = false
    setConnectionStatus('connecting')
    setMessages([])
    setUnreadCount(0)
    setHasMore(false)

    const token = await getWsToken()
    const wsUrl = token
      ? `${WS_BASE}/ws/chat/${orderId}/?token=${encodeURIComponent(token)}`
      : `${WS_BASE}/ws/chat/${orderId}/`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      hadErrorRef.current = false
      setConnectionStatus('connected')
    }

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data)

        // ── history (sent by server on connect) ─────────────────────────────
        if (data.type === 'history') {
          const msgs = (Array.isArray(data.message) ? data.message : []).map(normalizeMsg)
          setMessages(msgs)
          const unread = msgs.filter((m) => !m.is_read && !isFromMe(m)).length
          setUnreadCount(unread)
          // Server sends last 20 — if we got 20, there may be more
          setHasMore(msgs.length >= 20)
          return
        }

        // ── new chat message ─────────────────────────────────────────────────
        if (data.type === 'message') {
          const msg = normalizeMsg(data)
          setMessages((prev) => {
            // Deduplicate by sender+timestamp
            const isDup = msg.timestamp &&
              prev.some((m) => m.sender === msg.sender && m.timestamp === msg.timestamp)
            if (isDup) return prev
            return [...prev, msg]
          })
          if (!isFromMe(msg)) setUnreadCount((u) => u + 1)
          return
        }

        // ── typing indicator ─────────────────────────────────────────────────
        if (data.type === 'typing') {
          if (data.user !== meRef.current?.username) {
            setOtherTyping(!!data.is_typing)
            clearTimeout(typingTimer.current)
            if (data.is_typing) {
              typingTimer.current = setTimeout(() => setOtherTyping(false), 3000)
            }
          }
          return
        }

        // ── read receipt ─────────────────────────────────────────────────────
        if (data.type === 'read') {
          setMessages((prev) =>
            prev.map((m) => m.id === data.message_id ? { ...m, is_read: true } : m)
          )
          return
        }
      } catch { /* malformed frame */ }
    }

    ws.onerror = () => {
      hadErrorRef.current = true
      setConnectionStatus('error')
    }

    ws.onclose = (evt) => {
      wsRef.current = null
      if (hadErrorRef.current) {
        setConnectionStatus('error')
      } else if (evt.code !== 1000 && evt.code !== 1001) {
        setConnectionStatus('disconnected')
      } else {
        setConnectionStatus('disconnected')
      }
    }
  }, [orderId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  useEffect(() => {
    connect()
    return () => {
      clearTimeout(timerRef.current)
      clearTimeout(typingTimer.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.onerror = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  // ── sendMessage ──────────────────────────────────────────────────────────────
  const sendMessage = useCallback((text) => {
    if (!text?.trim()) return
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ message: text.trim() }))
  }, [])

  // ── sendTyping ───────────────────────────────────────────────────────────────
  // Requires backend fix — see comment in OrderChatPanel
  const sendTyping = useCallback((isTyping) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'typing', is_typing: isTyping }))
  }, [])

  // ── markRead ─────────────────────────────────────────────────────────────────
  const markRead = useCallback((messageId) => {
    if (!messageId) return
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'read', message_id: messageId }))
    // Optimistic local update
    setMessages((prev) =>
      prev.map((m) => m.id === messageId ? { ...m, is_read: true } : m)
    )
  }, [])

  // ── clearUnread ──────────────────────────────────────────────────────────────
  const clearUnread = useCallback(() => setUnreadCount(0), [])

  // ── loadMoreHistory ──────────────────────────────────────────────────────────
  const loadMoreHistory = useCallback(async () => {
    if (!orderId || loadingHistory) return
    setLoadingHistory(true)
    try {
      const { data } = await client.get(`/user/orders/${orderId}/chat/`)
      const raw = Array.isArray(data)
        ? data
        : (Array.isArray(data?.results) ? data.results : [])
      const all = raw.map(normalizeMsg)

      setMessages((prev) => {
        // Merge REST messages (which have IDs) with live WS messages (which may not)
        const liveById = new Map(prev.filter((m) => m.id).map((m) => [m.id, m]))
        const merged = all.map((m) => liveById.get(m.id) ?? m)
        // Add any live messages not in REST (very recent, not yet persisted)
        const allIds = new Set(all.filter((m) => m.id).map((m) => m.id))
        const liveOnly = prev.filter((m) => !m.id || !allIds.has(m.id))
        return [...merged, ...liveOnly].sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        )
      })
      setHasMore(false) // full history loaded
    } catch { /* non-critical */ }
    finally { setLoadingHistory(false) }
  }, [orderId, loadingHistory])

  return {
    messages,
    sendMessage,
    sendTyping,
    markRead,
    clearUnread,
    loadMoreHistory,
    connectionStatus,
    reconnect: connect,
    otherTyping,
    unreadCount,
    hasMore,
    loadingHistory,
  }
}
