/**
 * AIChatWidget
 *
 * Floating AI Shopping Assistant — available on every page.
 *
 * Architecture:
 *   FloatingTrigger  — fixed button, bottom-right
 *   ChatPanel        — slides up above the button
 *     Header
 *     MessageList
 *       UserBubble / AssistantBubble
 *         TextPart, ProductsRow, OrderConfirmedCard, ErrorPart
 *       ThinkingDots (while streaming, before first chunk)
 *       SuggestionChips (empty state)
 *     InputBar
 *
 * SSE streaming via Fetch + ReadableStream — no external libraries.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth }    from '../context/AuthContext'
import { useCart }    from '../context/CartContext'
import client         from '../api/client'

// ─── Config ──────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.chatram.in'

const SUGGESTIONS = [
  'Show me the latest products',
  'Find products under ₹2000',
  "What's in my cart?",
  'Show my recent orders',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractProductId(product) {
  if (product?.id) return Number(product.id)
  const url = product?.product_detail ?? ''
  const parts = String(url).replace(/\/$/, '').split('/')
  const id = parseInt(parts[parts.length - 1], 10)
  return isNaN(id) ? null : id
}

function formatPrice(val) {
  const n = parseFloat(val)
  if (isNaN(n)) return String(val)
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

// ─── Full Markdown Renderer ────────────────────────────────────────────────────
// Handles: ### ## headings, **bold**, *italic*, [link](url), ![img](url),
// --- dividers, numbered lists, bullet lists, plain newlines

function renderInline(text, key = 0) {
  // Split on bold, italic, link, image
  const pattern = /(!\[([^\]]*?)\]\(([^)]+?)\)|\[([^\]]+?)\]\(([^)]+?)\)|\*\*([^*]+?)\*\*|\*([^*]+?)\*)/g
  const parts = []
  let last = 0, match, idx = 0
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const full = match[0]
    if (full.startsWith('![')) {
      // image — skip rendering in chat bubbles (show alt text instead)
      parts.push(<span key={idx++} className="italic text-gray-400">[image: {match[2]}]</span>)
    } else if (full.startsWith('[')) {
      parts.push(<a key={idx++} href={match[5]} target="_blank" rel="noreferrer" className="text-blue-600 underline hover:text-blue-800">{match[4]}</a>)
    } else if (full.startsWith('**')) {
      parts.push(<strong key={idx++} className="font-semibold text-gray-900">{match[6]}</strong>)
    } else if (full.startsWith('*')) {
      parts.push(<em key={idx++} className="italic">{match[7]}</em>)
    }
    last = match.index + full.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <span key={key}>{parts}</span>
}

function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let listItems = []
  let listType = null // 'ul' | 'ol'
  let elemIdx = 0

  function flushList() {
    if (!listItems.length) return
    if (listType === 'ol') {
      elements.push(<ol key={elemIdx++} className="list-decimal list-outside pl-5 my-1 space-y-0.5">{listItems}</ol>)
    } else {
      elements.push(<ul key={elemIdx++} className="list-disc list-outside pl-5 my-1 space-y-0.5">{listItems}</ul>)
    }
    listItems = []; listType = null
  }

  lines.forEach((raw, i) => {
    const line = raw
    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      flushList()
      elements.push(<hr key={elemIdx++} className="my-2 border-gray-200" />)
      return
    }
    // H3
    if (line.startsWith('### ')) {
      flushList()
      elements.push(<h3 key={elemIdx++} className="text-sm font-bold text-gray-900 mt-2 mb-0.5">{renderInline(line.slice(4))}</h3>)
      return
    }
    // H2
    if (line.startsWith('## ')) {
      flushList()
      elements.push(<h2 key={elemIdx++} className="text-sm font-bold text-gray-900 mt-2 mb-0.5">{renderInline(line.slice(3))}</h2>)
      return
    }
    // H1
    if (line.startsWith('# ')) {
      flushList()
      elements.push(<h1 key={elemIdx++} className="text-base font-bold text-gray-900 mt-2 mb-1">{renderInline(line.slice(2))}</h1>)
      return
    }
    // Numbered list
    const olMatch = line.match(/^(\d+)\. (.+)/)
    if (olMatch) {
      if (listType !== 'ol') { flushList(); listType = 'ol' }
      listItems.push(<li key={listItems.length} className="text-sm text-gray-800">{renderInline(olMatch[2])}</li>)
      return
    }
    // Bullet list (-, *, +)
    const ulMatch = line.match(/^[-*+] (.+)/)
    if (ulMatch) {
      if (listType !== 'ul') { flushList(); listType = 'ul' }
      listItems.push(<li key={listItems.length} className="text-sm text-gray-800">{renderInline(ulMatch[1])}</li>)
      return
    }
    // Empty line → paragraph break
    if (line.trim() === '') {
      flushList()
      elements.push(<div key={elemIdx++} className="h-1" />)
      return
    }
    // Normal paragraph
    flushList()
    elements.push(<p key={elemIdx++} className="text-sm text-gray-800 leading-relaxed">{renderInline(line)}</p>)
  })
  flushList()
  return <>{elements}</>
}

let _msgCounter = 0
function nextId() { return ++_msgCounter }

// ─── Icons ───────────────────────────────────────────────────────────────────

function SparkleIcon({ className = 'w-5 h-5' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5Z" clipRule="evenodd" />
    </svg>
  )
}

function BotAvatarIcon() {
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#232f3e] to-[#131921] flex items-center justify-center flex-shrink-0 shadow-sm">
      <SparkleIcon className="w-3.5 h-3.5 text-[#febd69]" />
    </div>
  )
}

function SendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.288Z" />
    </svg>
  )
}

// ─── ThinkingDots ─────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <BotAvatarIcon />
      <div className="ml-2 flex items-center gap-1 bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm">
        <span className="text-xs text-gray-400 mr-1.5">AI is thinking</span>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#e77600] inline-block"
            style={{
              animation: 'ai-bounce 1.2s infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes ai-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30%            { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}

// ─── SuggestionChips ─────────────────────────────────────────────────────────

function SuggestionChips({ onSelect }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-4 pb-2">
      {/* Bot avatar + greeting */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#232f3e] to-[#131921] flex items-center justify-center shadow-lg">
          <SparkleIcon className="w-7 h-7 text-[#febd69]" />
        </div>
        <div>
          <p className="font-semibold text-gray-800 text-sm">Hi! I'm your AI Shopping Assistant.</p>
          <p className="text-xs text-gray-500 mt-0.5">Ask me anything about products, orders, or your cart.</p>
        </div>
      </div>

      {/* Chips grid */}
      <div className="grid grid-cols-2 gap-2 w-full">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className="text-left text-xs text-gray-700 bg-white border border-gray-200 hover:border-[#e77600] hover:text-[#c7511f] hover:bg-orange-50 rounded-xl px-3 py-2.5 transition-all leading-snug shadow-sm active:scale-95"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── ProductsRow ─────────────────────────────────────────────────────────────

function ProductsRow({ products }) {
  const navigate = useNavigate()
  const { addToCart } = useCart()
  const [adding, setAdding] = useState({})

  async function handleAdd(product) {
    const pid = extractProductId(product)
    if (!pid) return
    setAdding((prev) => ({ ...prev, [pid]: true }))
    try {
      await addToCart(pid, 1)
    } catch { /* non-critical */ }
    setTimeout(() => setAdding((prev) => ({ ...prev, [pid]: false })), 1200)
  }

  if (!products?.length) return null

  return (
    <div className="mt-2">
      <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
        {products.map((product, i) => {
          const pid = extractProductId(product)
          const images = product.images ?? []
          const primaryImg = images.find((img) => img.is_primary) ?? images[0] ?? null
          const isAdding = adding[pid]

          return (
            <div
              key={i}
              className="flex-shrink-0 w-36 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => pid && navigate(`/product/${pid}`)}
            >
              {/* Image */}
              <div className="h-24 bg-gray-50 flex items-center justify-center overflow-hidden">
                {primaryImg?.image_url ? (
                  <img
                    src={primaryImg.image_url}
                    alt={product.product_name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-3xl font-bold text-gray-200 select-none">
                    {(product.product_name ?? '?')[0].toUpperCase()}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-2">
                <p className="text-[11px] font-medium text-gray-800 line-clamp-2 leading-tight mb-1">
                  {product.product_name}
                </p>
                <p className="text-xs font-bold text-[#B12704] mb-1.5">
                  {formatPrice(product.base_price)}
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); handleAdd(product) }}
                  disabled={!pid || isAdding}
                  className={[
                    'w-full text-[10px] font-medium py-1 rounded-lg transition-all',
                    isAdding
                      ? 'bg-green-500 text-white'
                      : 'bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b] border border-[#a88734] text-gray-900 hover:from-[#f5d78e] hover:to-[#eeb933]',
                    !pid ? 'opacity-40 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  {isAdding ? '✓ Added' : 'Add to Cart'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── OrderConfirmedCard ───────────────────────────────────────────────────────

function OrderConfirmedCard({ data }) {
  const navigate = useNavigate()
  return (
    <div className="mt-2 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">🎉</span>
        <p className="font-semibold text-green-800 text-sm">Order Confirmed!</p>
      </div>
      {data?.id && (
        <p className="text-xs text-green-700 mb-0.5">
          Order ID: <span className="font-mono font-bold">#{data.id}</span>
        </p>
      )}
      {data?.total_amount && (
        <p className="text-xs text-green-700 mb-2">
          Total: <span className="font-bold">{formatPrice(data.total_amount)}</span>
        </p>
      )}
      <button
        onClick={() => navigate('/orders')}
        className="text-[11px] font-medium text-[#007185] hover:text-[#c7511f] hover:underline transition-colors"
      >
        View your orders →
      </button>
    </div>
  )
}

// ─── Message bubble parts ─────────────────────────────────────────────────────

function AssistantBubble({ message, isCurrentlyStreaming }) {
  const hasContent = message.parts.length > 0

  return (
    <div className="flex items-start gap-2 max-w-full">
      <BotAvatarIcon />
      <div className="flex-1 min-w-0 space-y-1.5">
        {message.parts.map((part, i) => {
          if (part.type === 'text') {
            return (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm"
              >
                {renderMarkdown(part.content)}
                {/* Blinking cursor while this is the last text part and still streaming */}
                {isCurrentlyStreaming && i === message.parts.length - 1 && part.type === 'text' && (
                  <span className="inline-block w-0.5 h-3.5 bg-gray-400 ml-0.5 align-middle animate-pulse" />
                )}
              </div>
            )
          }
          if (part.type === 'products') {
            return <ProductsRow key={i} products={part.data} />
          }
          if (part.type === 'order_confirmed') {
            return <OrderConfirmedCard key={i} data={part.data} />
          }
          if (part.type === 'error') {
            return (
              <div key={i} className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                ⚠ {part.content || 'Something went wrong. Please try again.'}
              </div>
            )
          }
          return null
        })}

        {/* Show thinking dots if streaming and no content yet */}
        {isCurrentlyStreaming && !hasContent && (
          <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3.5 py-2.5 shadow-sm">
            <div className="flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[#e77600] inline-block"
                  style={{ animation: 'ai-bounce 1.2s infinite', animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function UserBubble({ message }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] bg-[#1a73e8] text-white rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm leading-relaxed shadow-sm whitespace-pre-wrap">
        {message.content}
      </div>
    </div>
  )
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export default function AIChatWidget() {
  const { isAuthenticated } = useAuth()
  const [isOpen,    setIsOpen]    = useState(false)
  const [unread,    setUnread]    = useState(0)
  const [messages,  setMessages]  = useState([])
  const [streaming, setStreaming] = useState(false)
  const [inputText, setInputText] = useState('')

  // ── Resizable panel state ──────────────────────────────────────────────────
  const DEFAULT_W = Math.min(480, Math.floor(window.innerWidth * 0.38))
  const DEFAULT_H = Math.min(700, Math.floor(window.innerHeight * 0.78))
  const [panelW, setPanelW] = useState(DEFAULT_W)
  const [panelH, setPanelH] = useState(DEFAULT_H)
  const resizingRef = useRef(null) // { startX, startY, startW, startH }

  const bottomRef     = useRef(null)
  const inputRef      = useRef(null)
  const abortRef      = useRef(null)   // AbortController for current SSE fetch
  const streamingIdRef = useRef(null)  // id of the current assistant message

  // ── Auto-scroll on new content ──────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Reset unread when opening ───────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setUnread(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // ── Cleanup SSE on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  // ── Drag-to-resize logic ───────────────────────────────────────────────────
  function startResize(e) {
    e.preventDefault()
    resizingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: panelW,
      startH: panelH,
    }
    const onMove = (ev) => {
      const dx = resizingRef.current.startX - ev.clientX // drag left = wider
      const dy = resizingRef.current.startY - ev.clientY // drag up  = taller
      const newW = Math.max(320, Math.min(window.innerWidth * 0.7, resizingRef.current.startW + dx))
      const newH = Math.max(300, Math.min(window.innerHeight * 0.92, resizingRef.current.startH + dy))
      setPanelW(Math.round(newW))
      setPanelH(Math.round(newH))
    }
    const onUp = () => {
      resizingRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── handleSseEvent — updates the current assistant message ────────────────
  const handleSseEvent = useCallback((evt, assistantId) => {
    setMessages((prev) => {
      const idx = prev.findLastIndex((m) => m.id === assistantId)
      if (idx === -1) return prev

      const msg   = prev[idx]
      const parts = msg.parts

      let newParts
      switch (evt.type) {
        case 'text': {
          const last = parts[parts.length - 1]
          if (last?.type === 'text') {
            // Append to existing text part for typewriter effect
            newParts = [
              ...parts.slice(0, -1),
              { type: 'text', content: last.content + evt.content },
            ]
          } else {
            newParts = [...parts, { type: 'text', content: evt.content }]
          }
          break
        }
        case 'products':
          newParts = [...parts, { type: 'products', data: evt.data ?? [] }]
          break
        case 'order_confirmed':
          newParts = [...parts, { type: 'order_confirmed', data: evt.data ?? {} }]
          break
        case 'error':
          newParts = [...parts, { type: 'error', content: evt.content }]
          break
        default:
          return prev
      }

      const updated = [...prev]
      updated[idx] = { ...msg, parts: newParts }
      return updated
    })
  }, [])

  // ── sendMessage — POST prompt, receive plain JSON response ─────────────────
  const sendMessage = useCallback(async (text) => {
    const trimmed = text?.trim()
    if (!trimmed || streaming) return

    // Cancel any previous in-flight request
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const userMsg     = { id: nextId(), role: 'user', content: trimmed }
    const assistantId = nextId()
    const assistantMsg = { id: assistantId, role: 'assistant', parts: [] }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInputText('')
    setStreaming(true)
    streamingIdRef.current = assistantId

    try {
      const response = await client.post('/user/ai/', 
        { prompt: trimmed },
        { signal: abortRef.current.signal }
      )

      const data = response.data || {}
      const replyText = data.response ?? 'No response received.'

      // Render the reply as a single text part
      setMessages((prev) => {
        const idx = prev.findLastIndex((m) => m.id === assistantId)
        if (idx === -1) return prev
        const updated = [...prev]
        updated[idx] = {
          ...updated[idx],
          parts: [{ type: 'text', content: replyText }],
        }
        return updated
      })

      if (!isOpen) setUnread((u) => u + 1)

    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return

      const errorMsg = err.response?.data?.error ?? err.response?.data?.detail ?? err.message ?? 'Connection failed. Please try again.'

      setMessages((prev) => {
        const idx = prev.findLastIndex((m) => m.id === assistantId)
        if (idx === -1) return prev
        const updated = [...prev]
        updated[idx] = {
          ...updated[idx],
          parts: [{ type: 'error', content: errorMsg }],
        }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }, [streaming, isOpen])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputText)
    }
  }

  const canSend = !streaming && inputText.trim().length > 0

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Keyframe for dots ── */}
      <style>{`
        @keyframes ai-bounce {
          0%, 60%, 100% { transform: translateY(0);   opacity: 1; }
          30%            { transform: translateY(-5px); opacity: .7; }
        }
      `}</style>

      {/* ─────────────────── Chat panel ──────────────────────────── */}
      {isOpen && (
        <div
          style={{ width: panelW, height: panelH }}
          className={[
            'fixed z-[9998]',
            'bottom-[84px] left-6',
            'bg-white rounded-2xl shadow-2xl border border-gray-200',
            'flex flex-col overflow-hidden',
          ].join(' ')}
          role="dialog"
          aria-label="AI Shopping Assistant"
        >
          {/* ── Resize handle — drag the top-right corner ─── */}
          <div
            onMouseDown={startResize}
            title="Drag to resize"
            className="absolute top-0 right-0 w-6 h-6 cursor-nwse-resize z-10 flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"
          >
            <svg viewBox="0 0 10 10" className="w-3 h-3 text-gray-400" fill="currentColor">
              <path d="M0 10 L10 0 L10 10 Z" opacity="0.5"/>
            </svg>
          </div>
          {/* ── Panel header ──────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#131921] to-[#232f3e] flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#febd69]/20 flex items-center justify-center">
                <SparkleIcon className="w-4 h-4 text-[#febd69]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">AI Shopping Assistant</p>
                <p className="text-[10px] text-gray-400 leading-tight">
                  {streaming ? 'Typing…' : 'Powered by Claude'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close assistant"
              className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>

          {/* ── Messages ──────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-gray-50">
            {messages.length === 0 && !streaming ? (
              <SuggestionChips onSelect={(s) => sendMessage(s)} />
            ) : (
              <>
                {messages.map((msg, i) =>
                  msg.role === 'user' ? (
                    <UserBubble key={msg.id} message={msg} />
                  ) : (
                    <AssistantBubble
                      key={msg.id}
                      message={msg}
                      isCurrentlyStreaming={streaming && i === messages.length - 1}
                    />
                  )
                )}
              </>
            )}

            {/* Extra thinking dots when streaming but last msg already has content */}
            {streaming &&
              messages.length > 0 &&
              messages[messages.length - 1]?.role === 'assistant' &&
              messages[messages.length - 1]?.parts.length === 0 && (
                <ThinkingDots />
              )}

            <div ref={bottomRef} />
          </div>

          {/* ── Input bar ─────────────────────────────────────────── */}
          <div className="flex-shrink-0 px-3 py-2.5 bg-white border-t border-gray-200">
            {!isAuthenticated && (
              <p className="text-xs text-center text-gray-400 mb-2">
                <a href="/login" className="text-[#007185] hover:underline">Log in</a> to use the AI assistant
              </p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  !isAuthenticated
                    ? 'Log in to chat…'
                    : streaming
                    ? 'AI is responding…'
                    : 'Ask anything about products, orders…'
                }
                disabled={!isAuthenticated || streaming}
                className={[
                  'flex-1 px-3 py-2 text-sm rounded-xl border resize-none leading-snug outline-none transition-colors',
                  isAuthenticated && !streaming
                    ? 'border-gray-300 focus:border-[#e77600] focus:ring-2 focus:ring-[rgba(228,121,17,0.25)]'
                    : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed',
                ].join(' ')}
                style={{ maxHeight: 96, overflowY: 'auto' }}
                onInput={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px'
                }}
              />
              <button
                onClick={() => sendMessage(inputText)}
                disabled={!canSend || !isAuthenticated}
                aria-label="Send"
                className={[
                  'flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all',
                  canSend && isAuthenticated
                    ? 'bg-[#e77600] hover:bg-[#c96800] text-white shadow-sm active:scale-95'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed',
                ].join(' ')}
              >
                <SendIcon />
              </button>
            </div>
            <p className="text-[10px] text-center text-gray-300 mt-1.5">
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}

      {/* ─────────────────── Floating trigger button ──────────────── */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'Close AI assistant' : 'Open AI assistant'}
        aria-expanded={isOpen}
        className={[
          'fixed bottom-6 left-6 z-[9999]',
          'flex items-center gap-2 pl-3.5 pr-4 h-12 rounded-full shadow-xl',
          'font-semibold text-sm transition-all duration-200',
          isOpen
            ? 'bg-[#131921] text-white scale-95'
            : 'bg-gradient-to-r from-[#131921] to-[#232f3e] text-white hover:shadow-2xl hover:scale-105 active:scale-95',
        ].join(' ')}
      >
        {/* Amber glow ring */}
        <span className="relative flex-shrink-0">
          <span className="absolute inset-0 rounded-full bg-[#febd69]/30 animate-ping" />
          <SparkleIcon className="w-5 h-5 text-[#febd69] relative" />
        </span>

        <span>{isOpen ? 'Close' : 'Ask AI'}</span>

        {/* Unread badge */}
        {unread > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </>
  )
}
