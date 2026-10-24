/**
 * OrderChatPanel
 *
 * Real-time WebSocket order chat between buyer and seller.
 * Automatically suppresses floating AI Copilot while active so it never obstructs typing space.
 * Includes IME-safe Enter handling and CSS `field-sizing: content`.
 */

import { useState, useEffect, useRef } from 'react'
import { useOrderChat } from '../hooks/useOrderChat'
import { useAIChat } from '../context/AIChatContext'

function formatMsgTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  return sameDay
    ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
        ' · ' +
        d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function ConnectionStatus({ status, onReconnect }) {
  const cfg =
    {
      connecting: {
        dot: 'bg-amber-400 animate-pulse',
        label: 'Connecting…',
        color: 'text-amber-600',
      },
      connected: { dot: 'bg-emerald-500', label: 'Live', color: 'text-emerald-600' },
      disconnected: { dot: 'bg-stone-400', label: 'Offline', color: 'text-stone-500' },
      error: { dot: 'bg-rose-500', label: 'Connection error', color: 'text-rose-600' },
    }[status] ?? { dot: 'bg-stone-400', label: status, color: 'text-stone-500' }

  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
      <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
      {(status === 'error' || status === 'disconnected') && (
        <button
          onClick={onReconnect}
          className="ml-1 text-xs font-bold text-orange-600 hover:underline cursor-pointer"
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
    <span
      className={[
        'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full',
        isBuyer ? 'bg-amber-100 text-amber-800' : 'bg-teal-100 text-teal-800',
      ].join(' ')}
    >
      {isBuyer ? 'Buyer' : 'Seller'}
    </span>
  )
}

function ReadTick({ is_read }) {
  return (
    <span className={`text-[10px] ml-1.5 ${is_read ? 'text-emerald-400' : 'text-stone-400'}`}>
      {is_read ? '✓✓' : '✓'}
    </span>
  )
}

function MessageBubble({ msg, isMine }) {
  return (
    <div className={`flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
      {!isMine && (
        <div className="flex items-center gap-1.5 px-1">
          <span className="text-[11px] font-semibold text-stone-500 truncate max-w-[120px]">
            {msg.sender}
          </span>
          {msg.sender_role && <RoleBadge role={msg.sender_role} />}
        </div>
      )}

      <div
        className={[
          'max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed shadow-2xs break-words',
          isMine
            ? 'bg-stone-900 text-stone-50 rounded-br-xs'
            : 'bg-white border border-stone-200/90 text-stone-800 rounded-bl-xs',
        ].join(' ')}
      >
        {msg.message}
        {isMine && <ReadTick is_read={msg.is_read} />}
      </div>

      <span className="text-[10px] text-stone-400 px-1">{formatMsgTime(msg.timestamp)}</span>
    </div>
  )
}

function UnreadDivider({ count }) {
  return (
    <div className="flex items-center gap-2 my-1">
      <div className="flex-1 h-px bg-amber-200" />
      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full whitespace-nowrap">
        {count} unread {count === 1 ? 'message' : 'messages'}
      </span>
      <div className="flex-1 h-px bg-amber-200" />
    </div>
  )
}

function TypingIndicator({ name }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <div className="flex gap-1 items-center bg-white border border-stone-200 rounded-2xl rounded-bl-xs px-3 py-2 shadow-2xs">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-teal-600 inline-block"
            style={{ animation: 'typing-dot 1.2s infinite', animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
      <span className="text-[11px] text-stone-400">{name} is typing…</span>
      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: .4; }
          30%            { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function EmptyChat({ otherPartyName }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 select-none text-center px-4">
      <div className="w-12 h-12 rounded-2xl bg-stone-100 border border-stone-200 text-stone-600 flex items-center justify-center text-xl">
        💬
      </div>
      <p className="text-xs text-stone-500">
        No messages yet. Start a direct conversation with <strong>{otherPartyName}</strong>.
      </p>
    </div>
  )
}

export default function OrderChatPanel({ orderId, currentUser, otherPartyName }) {
  const { setSellerChatOpen } = useAIChat()

  // Notify AIChatContext while Seller Chat is mounted so the floating AI Copilot never obstructs the input bar
  useEffect(() => {
    setSellerChatOpen(true)
    return () => setSellerChatOpen(false)
  }, [setSellerChatOpen])

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
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const typingDebRef = useRef(null)
  const isTypingRef = useRef(false)
  const markedIdsRef = useRef(new Set())

  const myUsername = currentUser?.username ?? currentUser?.user_name ?? ''
  const myId = currentUser?.id ?? null

  function isFromMe(msg) {
    if (myId && msg.sender_id) return msg.sender_id === myId
    if (myUsername && msg.sender) return msg.sender === myUsername
    return false
  }

  const firstUnreadIdx = messages.findIndex((m) => !m.is_read && !isFromMe(m))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, otherTyping])

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [])

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

  function handleSend() {
    const text = inputText.trim()
    if (!text) return
    sendMessage(text)
    setInputText('')
    sendTyping(false)
    isTypingRef.current = false
    clearTimeout(typingDebRef.current)
    inputRef.current?.focus()
  }

  // IME-safe Enter key submission
  function handleKeyDown(e) {
    if (e.nativeEvent?.isComposing || e.isComposing || e.keyCode === 229) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleInput(e) {
    setInputText(e.target.value)

    if (!isTypingRef.current) {
      sendTyping(true)
      isTypingRef.current = true
    }
    clearTimeout(typingDebRef.current)
    typingDebRef.current = setTimeout(() => {
      sendTyping(false)
      isTypingRef.current = false
    }, 1500)
  }

  const canSend = connectionStatus === 'connected' && inputText.trim().length > 0

  return (
    <div className="flex flex-col h-full border border-stone-200/90 rounded-2xl overflow-hidden bg-[#f8f7f4] shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-stone-200/80 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-stone-900">Chat with {otherPartyName}</span>
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-600 text-white">
              {unreadCount}
            </span>
          )}
        </div>
        <ConnectionStatus status={connectionStatus} onReconnect={reconnect} />
      </div>

      {hasMore && (
        <div className="flex justify-center py-2 bg-white border-b border-stone-100">
          <button
            onClick={loadMoreHistory}
            disabled={loadingHistory}
            className="text-xs text-stone-700 hover:text-stone-900 hover:underline font-semibold disabled:opacity-50 cursor-pointer"
          >
            {loadingHistory ? 'Loading…' : '↑ Load older messages'}
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-3 min-h-0">
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

        {otherTyping && <TypingIndicator name={otherPartyName} />}
        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div className="px-3 py-2.5 bg-white border-t border-stone-200/90 flex items-end gap-2 shrink-0">
        <textarea
          ref={inputRef}
          rows={1}
          value={inputText}
          onChange={handleInput}
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
            'auto-grow-textarea flex-1 px-3.5 py-2 text-sm rounded-xl border resize-none leading-snug outline-none transition-all scrollbar-thin',
            connectionStatus === 'connected'
              ? 'border-stone-300 bg-stone-50/70 focus:bg-white focus:border-stone-900 focus:ring-3 focus:ring-stone-900/10'
              : 'border-stone-200 bg-stone-100 text-stone-400 cursor-not-allowed',
          ].join(' ')}
        />

        <button
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          className={[
            'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer',
            canSend
              ? 'bg-stone-900 hover:bg-stone-800 text-white shadow-xs active:scale-95'
              : 'bg-stone-100 text-stone-400 cursor-not-allowed',
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
