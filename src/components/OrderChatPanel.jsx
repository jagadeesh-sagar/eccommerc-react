/**
 * OrderChatPanel
 *
 * Real-time order chat between buyer and seller.
 *
 * Features:
 *   • Blue bubbles (right) = you  |  Gray bubbles (left) = other party
 *   • Unread message divider
 *   • "Load older messages" button (fetches full REST history)
 *   • Typing indicator (requires backend fix — see below)
 *   • Read receipts (✓ sent / ✓✓ read)
 *   • Auto-mark messages as read when panel opens
 *   • Typing event sent with 400 ms debounce
 *
 * ⚠ Backend fix required in consumer `receive()` for typing + read events:
 *
 *   async def receive(self, text_data):
 *       data = json.loads(text_data)
 *       event_type = data.get("type", "message")
 *
 *       if event_type == "typing":
 *           await self.channel_layer.group_send(self.room_group_name, {
 *               "type": "typing_event",
 *               "user": self.user.username,
 *               "is_typing": data.get("is_typing", False),
 *           })
 *           return
 *
 *       if event_type == "read":
 *           message_id = data.get("message_id")
 *           if message_id:
 *               await self.mark_as_read(message_id)
 *               await self.channel_layer.group_send(self.room_group_name, {
 *                   "type": "read_event", "message_id": message_id, "user": self.user.username,
 *               })
 *           return
 *
 *       message = data.get("message", "").strip()
 *       if not message:
 *           return
 *       # ... rest of original code unchanged
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useOrderChat } from '../hooks/useOrderChat'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMsgTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth()    === now.getMonth()    &&
    d.getDate()     === now.getDate()
  return sameDay
    ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
      ' · ' +
      d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConnectionStatus({ status, onReconnect }) {
  const cfg = {
    connecting:   { dot: 'bg-yellow-400 animate-pulse', label: 'Connecting…',      color: 'text-yellow-600' },
    connected:    { dot: 'bg-green-500',                 label: 'Connected',        color: 'text-green-600'  },
    disconnected: { dot: 'bg-gray-400',                  label: 'Disconnected',     color: 'text-gray-500'   },
    error:        { dot: 'bg-red-500',                   label: 'Connection error', color: 'text-red-600'    },
  }[status] ?? { dot: 'bg-gray-400', label: status, color: 'text-gray-500' }

  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
      {(status === 'error' || status === 'disconnected') && (
        <button
          onClick={onReconnect}
          className="ml-1 text-xs font-medium text-[#007185] hover:text-[#c7511f] hover:underline"
        >
          Reconnect
        </button>
      )}
    </span>
  )
}

function RoleBadge({ role }) {
  const isBuyer = role === 'buyer'
  return (
    <span className={[
      'text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full',
      isBuyer ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700',
    ].join(' ')}>
      {isBuyer ? 'Buyer' : 'Seller'}
    </span>
  )
}

/** ✓ or ✓✓ tick for sent messages */
function ReadTick({ is_read }) {
  return (
    <span className={`text-[10px] ml-1 ${is_read ? 'text-blue-300' : 'text-white/50'}`}>
      {is_read ? '✓✓' : '✓'}
    </span>
  )
}

function MessageBubble({ msg, isMine }) {
  return (
    <div className={`flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
      {/* Sender name + role badge */}
      {!isMine && (
        <div className="flex items-center gap-1.5 px-1">
          <span className="text-[11px] font-semibold text-gray-500 truncate max-w-[120px]">
            {msg.sender}
          </span>
          {msg.sender_role && <RoleBadge role={msg.sender_role} />}
        </div>
      )}

      {/* Bubble */}
      <div className={[
        'max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed shadow-sm break-words',
        isMine
          ? 'bg-[#1a73e8] text-white rounded-br-none'
          : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none',
      ].join(' ')}>
        {msg.message}
        {isMine && <ReadTick is_read={msg.is_read} />}
      </div>

      {/* Timestamp */}
      <span className="text-[10px] text-gray-400 px-1">
        {formatMsgTime(msg.timestamp)}
      </span>
    </div>
  )
}

function UnreadDivider({ count }) {
  return (
    <div className="flex items-center gap-2 my-1">
      <div className="flex-1 h-px bg-blue-200" />
      <span className="text-[10px] font-semibold text-blue-500 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full whitespace-nowrap">
        {count} unread {count === 1 ? 'message' : 'messages'}
      </span>
      <div className="flex-1 h-px bg-blue-200" />
    </div>
  )
}

function TypingIndicator({ name }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <div className="flex gap-1 items-center bg-white border border-gray-200 rounded-2xl rounded-bl-none px-3 py-2 shadow-sm">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block"
            style={{ animation: 'typing-dot 1.2s infinite', animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
      <span className="text-[10px] text-gray-400">{name} is typing…</span>
      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: .4; }
          30%            { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function EmptyChat({ otherPartyName }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 select-none text-center px-4">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-10 h-10 opacity-20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 8h40v26H27l-3 6-3-6H4V8Z" />
      </svg>
      <p className="text-xs text-gray-400">No messages yet. Say hello to <b>{otherPartyName}</b>!</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OrderChatPanel({ orderId, currentUser, otherPartyName }) {
  const {
    messages,
    sendMessage,
    sendTyping,
    markRead,
    clearUnread,
    loadMoreHistory,
    connectionStatus,
    reconnect,
    otherTyping,
    unreadCount,
    hasMore,
    loadingHistory,
  } = useOrderChat(orderId, currentUser)

  const [inputText, setInputText] = useState('')
  const bottomRef    = useRef(null)
  const inputRef     = useRef(null)
  const typingDebRef = useRef(null)        // debounce timer for typing events
  const isTypingRef  = useRef(false)       // track if we already sent isTyping=true
  const markedIdsRef = useRef(new Set())   // IDs already sent to markRead — avoids duplicate WS frames

  // ── Figure out where unread starts ───────────────────────────────────────────
  // Find first message from other party that is not read
  const myUsername = currentUser?.username ?? currentUser?.user_name ?? ''
  const myId       = currentUser?.id ?? null

  function isFromMe(msg) {
    if (myId && msg.sender_id)     return msg.sender_id === myId
    if (myUsername && msg.sender)  return msg.sender    === myUsername
    return false
  }

  const firstUnreadIdx = messages.findIndex((m) => !m.is_read && !isFromMe(m))

  // ── Auto-scroll to bottom on new messages ────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, otherTyping])

  // ── Focus input when panel opens ────────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [])

  // ── Mark ALL unread messages as read whenever messages update ─────────────────
  // Runs on every messages change (initial history load, new incoming messages).
  // markedIdsRef prevents sending duplicate WS markRead frames for the same ID.
  useEffect(() => {
    if (messages.length === 0) return
    let didMark = false
    messages.forEach((m) => {
      if (!m.is_read && !isFromMe(m) && m.id && !markedIdsRef.current.has(m.id)) {
        markRead(m.id)
        markedIdsRef.current.add(m.id)
        didMark = true
      }
    })
    if (didMark) clearUnread()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  // ── Send ─────────────────────────────────────────────────────────────────────
  function handleSend() {
    const text = inputText.trim()
    if (!text) return
    sendMessage(text)
    setInputText('')
    // Stop typing indicator
    sendTyping(false)
    isTypingRef.current = false
    clearTimeout(typingDebRef.current)
    inputRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Typing events (debounced 400 ms) ─────────────────────────────────────────
  function handleInput(e) {
    setInputText(e.target.value)
    // Auto-grow
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px'

    // Send typing = true if not already sent
    if (!isTypingRef.current) {
      sendTyping(true)
      isTypingRef.current = true
    }
    // Auto-stop after 1.5 s of no typing
    clearTimeout(typingDebRef.current)
    typingDebRef.current = setTimeout(() => {
      sendTyping(false)
      isTypingRef.current = false
    }, 1500)
  }

  const canSend = connectionStatus === 'connected' && inputText.trim().length > 0

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full border border-gray-200 rounded-xl overflow-hidden bg-gray-50 shadow-sm">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#e77600" className="w-4 h-4 flex-shrink-0">
            <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.671 2.43 2.902.848.138 1.705.248 2.57.33v3.194l3.52-3.52A22.08 22.08 0 0 0 10 13.5c2.236 0 4.43-.18 6.57-.524C17.993 12.745 19 11.487 19 10.074V5.426c0-1.413-.993-2.671-2.43-2.902A41.102 41.102 0 0 0 10 2Z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-semibold text-gray-800">Chat with {otherPartyName}</span>
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500 text-white">
              {unreadCount}
            </span>
          )}
        </div>
        <ConnectionStatus status={connectionStatus} onReconnect={reconnect} />
      </div>

      {/* Load older messages */}
      {hasMore && (
        <div className="flex justify-center py-2 bg-white border-b border-gray-100">
          <button
            onClick={loadMoreHistory}
            disabled={loadingHistory}
            className="text-xs text-[#007185] hover:text-[#c7511f] hover:underline font-medium disabled:opacity-50 flex items-center gap-1"
          >
            {loadingHistory
              ? <><span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> Loading…</>
              : '↑ Load older messages'
            }
          </button>
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <EmptyChat otherPartyName={otherPartyName} />
        ) : (
          messages.map((msg, i) => {
            const mine = isFromMe(msg)
            const showUnreadDivider = i === firstUnreadIdx && firstUnreadIdx > 0

            return (
              <div key={msg.id ?? `${msg.sender}-${msg.timestamp}-${i}`}>
                {showUnreadDivider && <UnreadDivider count={unreadCount} />}
                <MessageBubble msg={msg} isMine={mine} />
              </div>
            )
          })
        )}

        {/* Typing indicator */}
        {otherTyping && <TypingIndicator name={otherPartyName} />}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-3 py-2.5 bg-white border-t border-gray-200 flex items-end gap-2 flex-shrink-0">
        <textarea
          ref={inputRef}
          rows={1}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            connectionStatus === 'connected'
              ? `Message ${otherPartyName}…`
              : connectionStatus === 'connecting'
              ? 'Connecting…'
              : 'Reconnect to send messages'
          }
          disabled={connectionStatus !== 'connected'}
          className={[
            'flex-1 px-3 py-2 text-sm rounded-lg border resize-none leading-snug outline-none transition-colors',
            connectionStatus === 'connected'
              ? 'border-gray-300 focus:border-[#e77600] focus:ring-2 focus:ring-[rgba(228,121,17,0.25)]'
              : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed',
          ].join(' ')}
          style={{ maxHeight: 96, overflowY: 'auto' }}
        />

        <button
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          className={[
            'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all',
            canSend
              ? 'bg-[#e77600] hover:bg-[#c96800] text-white shadow-sm active:scale-95'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed',
          ].join(' ')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.288Z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
