/**
 * AIChatWidget — Chatram MCP Shopping Assistant
 *
 * Available on every page in two modes:
 *   1. Floating Popover Mode (bottom-left, resizable, auto-hides when Seller Chat is active)
 *   2. Docked Side-Panel Mode (full-height right sidebar on desktop)
 *
 * Features:
 *   - Context-aware prompts (knows active product/category via AIChatContext)
 *   - Automatically yields screen space when Seller Chat (OrderChatPanel) is open
 *   - Editorial Warm Obsidian, Terracotta & Forest Emerald design (no purple/indigo AI slop)
 *   - Rich Markdown rendering + interactive ProductsRow & OrderConfirmedCard
 *   - Automatic CartContext synchronization when MCP tools mutate cart/orders
 *   - IME-safe Enter key submission & CSS `field-sizing: content` auto-growing input
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useAIChat } from '../context/AIChatContext'

// ─── Suggestions ─────────────────────────────────────────────────────────────

const DEFAULT_SUGGESTIONS = [
  { label: 'New arrivals in store', prompt: 'Show me the latest products in the store' },
  { label: 'Best picks under ₹2,000', prompt: 'Find the best products under ₹2000' },
  { label: 'Review my shopping cart', prompt: "What's currently in my shopping cart?" },
  { label: 'Track my recent orders', prompt: 'Show my recent orders and their status' },
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

// ─── Markdown Renderer ───────────────────────────────────────────────────────

function ExternalLinkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="inline w-3 h-3 ml-0.5 align-middle shrink-0"
    >
      <path d="M6.22 8.72a.75.75 0 0 0 1.06 1.06l5.22-5.22v1.69a.75.75 0 0 0 1.5 0v-3.5a.75.75 0 0 0-.75-.75h-3.5a.75.75 0 0 0 0 1.5h1.69L6.22 8.72Z" />
      <path d="M3.5 6.75c0-.69.56-1.25 1.25-1.25H7A.75.75 0 0 0 7 4H4.75A2.75 2.75 0 0 0 2 6.75v4.5A2.75 2.75 0 0 0 4.75 14h4.5A2.75 2.75 0 0 0 12 11.25V9a.75.75 0 0 0-1.5 0v2.25c0 .69-.56 1.25-1.25 1.25h-4.5c-.69 0-1.25-.56-1.25-1.25v-4.5Z" />
    </svg>
  )
}

function renderInline(text, navigate, key = 0) {
  const pattern =
    /(!\[([^\]]*?)\]\(([^)]+?)\)|\[([^\]]+?)\]\(([^)]+?)\)|\*\*([^*]+?)\*\*|\*([^*]+?)\*)|(https?:\/\/[^\s<>"'`)\]]+)/g
  const parts = []
  let last = 0
  let match
  let idx = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const full = match[0]
    if (full.startsWith('![')) {
      const alt = match[2]
      const src = match[3]
      parts.push(
        <span key={idx++} className="block my-2">
          <img
            src={src}
            alt={alt}
            className="max-w-full rounded-xl border border-stone-200/90 bg-white p-1 shadow-xs"
            style={{ maxHeight: 190, objectFit: 'contain' }}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          {alt && <span className="block text-[11px] text-stone-400 mt-1">{alt}</span>}
        </span>
      )
    } else if (full.startsWith('[')) {
      const label = match[4]
      const href = match[5]
      const internalProductMatch = href.match(/\/product\/(\d+)/)
      parts.push(
        <a
          key={idx++}
          href={href}
          target={internalProductMatch ? undefined : '_blank'}
          rel={internalProductMatch ? undefined : 'noreferrer noopener'}
          onClick={(e) => {
            e.stopPropagation()
            if (internalProductMatch && navigate) {
              e.preventDefault()
              navigate(`/product/${internalProductMatch[1]}`)
            }
          }}
          className="inline-flex items-center gap-0.5 font-semibold text-teal-800 hover:text-teal-950 bg-teal-50 hover:bg-teal-100/80 px-1.5 py-0.5 rounded-md underline decoration-teal-300 underline-offset-2 transition-colors break-all"
        >
          {label}
          <ExternalLinkIcon />
        </a>
      )
    } else if (full.startsWith('**')) {
      parts.push(
        <strong key={idx++} className="font-semibold text-stone-900">
          {match[6]}
        </strong>
      )
    } else if (full.startsWith('*')) {
      parts.push(
        <em key={idx++} className="italic text-stone-700">
          {match[7]}
        </em>
      )
    } else if (match[8]) {
      const url = match[8]
      let displayUrl = url
      try {
        const u = new URL(url)
        displayUrl =
          u.hostname + (u.pathname.length > 20 ? u.pathname.slice(0, 20) + '…' : u.pathname)
      } catch {
        // Ignore invalid URL formatting
      }
      const internalProductMatch = url.match(/\/product\/(\d+)/)
      parts.push(
        <a
          key={idx++}
          href={url}
          target={internalProductMatch ? undefined : '_blank'}
          rel={internalProductMatch ? undefined : 'noreferrer noopener'}
          onClick={(e) => {
            e.stopPropagation()
            if (internalProductMatch && navigate) {
              e.preventDefault()
              navigate(`/product/${internalProductMatch[1]}`)
            }
          }}
          title={url}
          className="inline-flex items-center gap-0.5 font-semibold text-teal-800 hover:text-teal-950 bg-teal-50 hover:bg-teal-100/80 px-1.5 py-0.5 rounded-md underline decoration-teal-300 underline-offset-2 transition-colors break-all"
        >
          {displayUrl}
          <ExternalLinkIcon />
        </a>
      )
    }
    last = match.index + full.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 1 && typeof parts[0] === 'string' ? (
    parts[0]
  ) : (
    <span key={key}>{parts}</span>
  )
}

function renderMarkdown(text, navigate) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let listItems = []
  let listType = null
  let elemIdx = 0

  function flushList() {
    if (!listItems.length) return
    if (listType === 'ol') {
      elements.push(
        <ol key={elemIdx++} className="list-decimal list-outside pl-5 my-1.5 space-y-1">
          {listItems}
        </ol>
      )
    } else {
      elements.push(
        <ul key={elemIdx++} className="list-disc list-outside pl-5 my-1.5 space-y-1">
          {listItems}
        </ul>
      )
    }
    listItems = []
    listType = null
  }

  lines.forEach((raw) => {
    const line = raw
    if (/^[-*_]{3,}$/.test(line.trim())) {
      flushList()
      elements.push(<hr key={elemIdx++} className="my-2.5 border-stone-200" />)
      return
    }
    const standaloneImg = line.trim().match(/^!\[([^\]]*?)\]\(([^)]+?)\)$/)
    if (standaloneImg) {
      flushList()
      const alt = standaloneImg[1]
      const src = standaloneImg[2]
      elements.push(
        <div key={elemIdx++} className="my-2">
          <img
            src={src}
            alt={alt}
            className="max-w-full rounded-xl border border-stone-200/90 bg-white p-1.5 shadow-xs"
            style={{ maxHeight: 210, objectFit: 'contain' }}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          {alt && <p className="text-[11px] text-stone-400 mt-1 text-center">{alt}</p>}
        </div>
      )
      return
    }
    if (line.startsWith('### ')) {
      flushList()
      elements.push(
        <h3 key={elemIdx++} className="text-sm font-bold text-stone-900 mt-2.5 mb-1">
          {renderInline(line.slice(4), navigate)}
        </h3>
      )
      return
    }
    if (line.startsWith('## ')) {
      flushList()
      elements.push(
        <h2 key={elemIdx++} className="text-sm font-bold text-stone-900 mt-2.5 mb-1">
          {renderInline(line.slice(3), navigate)}
        </h2>
      )
      return
    }
    if (line.startsWith('# ')) {
      flushList()
      elements.push(
        <h1 key={elemIdx++} className="text-base font-bold text-stone-900 mt-2.5 mb-1">
          {renderInline(line.slice(2), navigate)}
        </h1>
      )
      return
    }
    const olMatch = line.match(/^(\d+)\. (.+)/)
    if (olMatch) {
      if (listType !== 'ol') {
        flushList()
        listType = 'ol'
      }
      listItems.push(
        <li key={listItems.length} className="text-[13.5px] text-stone-700 leading-relaxed">
          {renderInline(olMatch[2], navigate)}
        </li>
      )
      return
    }
    const ulMatch = line.match(/^[-*+] (.+)/)
    if (ulMatch) {
      if (listType !== 'ul') {
        flushList()
        listType = 'ul'
      }
      listItems.push(
        <li key={listItems.length} className="text-[13.5px] text-stone-700 leading-relaxed">
          {renderInline(ulMatch[1], navigate)}
        </li>
      )
      return
    }
    if (line.trim() === '') {
      flushList()
      elements.push(<div key={elemIdx++} className="h-1.5" />)
      return
    }
    flushList()
    elements.push(
      <p key={elemIdx++} className="text-[13.5px] text-stone-700 leading-relaxed">
        {renderInline(line, navigate)}
      </p>
    )
  })
  flushList()
  return <>{elements}</>
}

// ─── Icons (AI Sparkle Icon) ─────────────────────────────────────────────────

export function SparkleIcon({ className = 'w-5 h-5' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0 1 16.5 15Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function BotAvatarIcon() {
  return (
    <div className="w-7 h-7 rounded-lg bg-[#141413] border border-stone-700 flex items-center justify-center shrink-0 shadow-2xs">
      <SparkleIcon className="w-4 h-4 text-amber-400" />
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

// ─── Subcomponents ───────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="flex items-start gap-2.5 px-1 py-1">
      <BotAvatarIcon />
      <div className="flex items-center gap-2 bg-white border border-stone-200/90 rounded-2xl rounded-tl-xs px-4 py-2.5 shadow-2xs">
        <span className="text-xs font-medium text-stone-600">Checking live catalog</span>
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-teal-700 inline-block"
              style={{
                animation: 'ai-bounce 1.2s infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function SuggestionChips({ onSelect, pageContext }) {
  const product = pageContext?.product
  const dynamicSuggestions = product
    ? [
        {
          label: `Key pros & review summary for ${product.name.slice(0, 18)}…`,
          prompt: `Tell me the key pros, specs, and customer review summary for ${product.name}.`,
        },
        {
          label: 'Compare with similar items',
          prompt: `Compare ${product.name} with other similar products in the store.`,
        },
        {
          label: 'Add 1 unit to my cart',
          prompt: `Add 1 unit of ${product.name} (ID ${product.id}) to my cart.`,
        },
        {
          label: 'Check my recent orders',
          prompt: 'Show my recent orders',
        },
      ]
    : DEFAULT_SUGGESTIONS

  return (
    <div className="flex flex-col items-center justify-center min-h-[320px] gap-6 px-4 py-6">
      <div className="flex flex-col items-center gap-3 text-center max-w-[290px]">
        <div className="w-12 h-12 rounded-2xl bg-[#141413] text-stone-100 flex items-center justify-center shadow-md border border-stone-800">
          <SparkleIcon className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-200/80 text-stone-700 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            MCP-Powered Assistant
          </span>
          <h3 className="font-bold text-stone-900 text-base">Chatram AI Copilot</h3>
          <p className="text-xs text-stone-500 mt-1 leading-relaxed">
            Search live inventory, compare product specs, manage your cart, or check order status directly.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
        {dynamicSuggestions.map((s) => (
          <button
            key={s.label}
            onClick={() => onSelect(s.prompt)}
            className="text-left text-xs font-medium text-stone-700 bg-white border border-stone-200/90 hover:border-stone-900 hover:text-stone-950 hover:bg-stone-50 rounded-xl px-3.5 py-2.5 transition-all leading-snug shadow-2xs active:scale-[0.98] cursor-pointer"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

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
    } catch {
      /* non-critical */
    }
    setTimeout(() => setAdding((prev) => ({ ...prev, [pid]: false })), 1200)
  }

  if (!products?.length) return null

  return (
    <div className="mt-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5 px-0.5">
        Matched Storefront Items
      </p>
      <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
        {products.map((product, i) => {
          const pid = extractProductId(product)
          const images = product.images ?? []
          const primaryImg = images.find((img) => img.is_primary) ?? images[0] ?? null
          const isAdding = adding[pid]

          return (
            <div
              key={pid || i}
              className="shrink-0 w-40 bg-white border border-stone-200/90 rounded-xl overflow-hidden shadow-xs hover:shadow-md hover:border-stone-400 transition-all cursor-pointer flex flex-col"
              onClick={() => pid && navigate(`/product/${pid}`)}
            >
              <div className="h-24 bg-stone-50 p-2 flex items-center justify-center overflow-hidden relative">
                {primaryImg?.image_url ? (
                  <img
                    src={primaryImg.image_url}
                    alt={product.product_name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-2xl font-bold text-stone-300 select-none">
                    {(product.product_name ?? '?')[0].toUpperCase()}
                  </span>
                )}
                {Number(product.avg_rating) > 0 && (
                  <span className="absolute top-1.5 right-1.5 bg-white/90 backdrop-blur-xs border border-stone-200/80 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-stone-700 flex items-center gap-0.5">
                    <span className="text-amber-500">★</span> {Number(product.avg_rating).toFixed(1)}
                  </span>
                )}
              </div>

              <div className="p-2.5 flex-1 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold text-stone-800 line-clamp-2 leading-snug mb-1">
                    {product.product_name}
                  </p>
                  <p className="text-xs font-bold font-mono text-stone-900 mb-2">
                    {formatPrice(product.base_price)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAdd(product)
                  }}
                  disabled={!pid || isAdding}
                  className={[
                    'w-full text-[11px] font-semibold py-1.5 rounded-lg transition-all cursor-pointer',
                    isAdding
                      ? 'bg-emerald-700 text-white'
                      : 'bg-stone-900 text-white hover:bg-stone-800',
                    !pid ? 'opacity-40 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  {isAdding ? '✓ Added' : '+ Add to Cart'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OrderConfirmedCard({ data }) {
  const navigate = useNavigate()
  return (
    <div className="mt-2 bg-emerald-50/90 border border-emerald-200 rounded-xl p-3.5 shadow-xs">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-lg">✓</span>
        <p className="font-bold text-emerald-950 text-sm">Order Confirmed</p>
      </div>
      {data?.id && (
        <p className="text-xs text-emerald-900 mb-0.5">
          Order ID: <span className="font-mono font-bold">#{data.id}</span>
        </p>
      )}
      {data?.total_amount && (
        <p className="text-xs text-emerald-900 mb-2">
          Total: <span className="font-mono font-bold">{formatPrice(data.total_amount)}</span>
        </p>
      )}
      <button
        onClick={() => navigate('/orders')}
        className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline underline-offset-2 cursor-pointer"
      >
        Track your order →
      </button>
    </div>
  )
}

function AssistantBubble({ message, isCurrentlyStreaming, navigate }) {
  const hasContent = message.parts.length > 0

  return (
    <div className="flex items-start gap-2.5 max-w-full">
      <BotAvatarIcon />
      <div className="flex-1 min-w-0 space-y-2">
        {message.parts.map((part, i) => {
          if (part.type === 'text') {
            return (
              <div
                key={i}
                className="bg-white border border-stone-200/90 rounded-2xl rounded-tl-xs px-4 py-3 shadow-2xs"
              >
                {renderMarkdown(part.content, navigate)}
                {isCurrentlyStreaming && i === message.parts.length - 1 && (
                  <span className="inline-block w-1.5 h-3.5 bg-teal-700 ml-1 align-middle animate-pulse rounded-full" />
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
              <div
                key={i}
                className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5"
              >
                ⚠ {part.content || 'Something went wrong. Please try again.'}
              </div>
            )
          }
          return null
        })}

        {isCurrentlyStreaming && !hasContent && (
          <div className="bg-white border border-stone-200/90 rounded-2xl rounded-tl-xs px-4 py-3 shadow-2xs inline-flex items-center gap-2">
            <span className="text-xs font-medium text-stone-500">Thinking</span>
            <div className="flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-teal-700 inline-block"
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
    <div className="flex flex-col items-end gap-1">
      {message.contextBadge && (
        <span className="text-[10px] font-medium text-stone-600 bg-stone-200/70 border border-stone-300/80 px-2 py-0.5 rounded-full max-w-[75%] truncate">
          Viewing: {message.contextBadge}
        </span>
      )}
      <div className="max-w-[80%] bg-[#141413] text-stone-50 rounded-2xl rounded-br-xs px-4 py-2.5 text-[13.5px] leading-relaxed shadow-xs whitespace-pre-wrap">
        {message.content}
      </div>
    </div>
  )
}

// ─── Main AIChatWidget ────────────────────────────────────────────────────────

export default function AIChatWidget() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const {
    isOpen,
    setIsOpen,
    isDocked,
    setIsDocked,
    unread,
    messages,
    streaming,
    draftInput,
    setDraftInput,
    pageContext,
    sellerChatOpen,
    sendMessage,
    clearChat,
  } = useAIChat()

  // Resizable floating panel dimensions
  const [panelW, setPanelW] = useState(() =>
    typeof window !== 'undefined' ? Math.min(430, Math.floor(window.innerWidth * 0.92)) : 410
  )
  const [panelH, setPanelH] = useState(() =>
    typeof window !== 'undefined' ? Math.min(620, Math.floor(window.innerHeight * 0.76)) : 580
  )
  const resizingRef = useRef(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [isOpen])

  // Top-right corner resize grip (since floating panel is anchored at bottom-left)
  function startResize(e) {
    if (isDocked) return
    e.preventDefault()
    resizingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: panelW,
      startH: panelH,
    }
    const onMove = (ev) => {
      if (!resizingRef.current) return
      const dx = ev.clientX - resizingRef.current.startX // drag right = wider
      const dy = resizingRef.current.startY - ev.clientY // drag up = taller
      const newW = Math.max(340, Math.min(window.innerWidth * 0.75, resizingRef.current.startW + dx))
      const newH = Math.max(380, Math.min(window.innerHeight * 0.88, resizingRef.current.startH + dy))
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

  // IME-safe Enter key submission
  function handleKeyDown(e) {
    if (e.nativeEvent?.isComposing || e.isComposing || e.keyCode === 229) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(draftInput)
    }
  }

  // Never render floating widget when Seller Chat is active so it never obstructs Seller Chat typing space
  if (sellerChatOpen && !isOpen) {
    return null
  }

  const canSend = !streaming && draftInput.trim().length > 0
  const activeProduct = pageContext?.product

  return (
    <>
      <style>{`
        @keyframes ai-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 1; }
          30%            { transform: translateY(-4px); opacity: .65; }
        }
      `}</style>

      {/* ─────────────────── Chat Panel (Floating Bottom-Left or Docked Right) ─────────────────── */}
      {isOpen && (
        <aside
          style={
            !isDocked
              ? {
                  '--panel-w': `${panelW}px`,
                  '--panel-h': `${panelH}px`,
                }
              : undefined
          }
          className={
            isDocked
              ? 'fixed top-0 right-0 bottom-0 z-[60] w-full sm:w-[420px] bg-white border-l border-stone-200/90 shadow-2xl flex flex-col overflow-hidden'
              : [
                  'fixed z-[60]',
                  'bottom-0 sm:bottom-20',
                  'left-0 sm:left-5',
                  'w-full sm:w-[var(--panel-w)]',
                  'h-[85dvh] sm:h-[var(--panel-h)]',
                  'bg-white sm:rounded-2xl shadow-2xl sm:border border-stone-200/90',
                  'flex flex-col overflow-hidden',
                ].join(' ')
          }
          role="dialog"
          aria-label="Chatram AI Copilot"
        >
          {/* ── Top-right resize handle (in floating bottom-left mode) ── */}
          {!isDocked && (
            <div
              onMouseDown={startResize}
              title="Drag top-right corner to resize"
              className="hidden sm:flex absolute top-0 right-0 w-4 h-4 cursor-nesw-resize z-20 items-start justify-end p-0.5 opacity-40 hover:opacity-100 transition-opacity"
            >
              <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 text-stone-400" fill="currentColor">
                <path d="M0 0 L10 0 L10 10 Z" />
              </svg>
            </div>
          )}

          {/* ── Panel Header (Matte Obsidian + AI Sparkle) ─────────── */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#141413] text-stone-100 border-b border-stone-800 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center shrink-0">
                <SparkleIcon className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-white truncate">Chatram AI Copilot</p>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
                <p className="text-[11px] text-stone-400 leading-tight truncate">
                  {streaming ? 'Querying store catalog…' : 'Live Catalog & Order Assistant'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  title="Clear conversation"
                  className="px-2 py-1 rounded-lg text-[11px] font-medium text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}

              {/* Dock / Float toggle button (desktop) */}
              <button
                onClick={() => setIsDocked((d) => !d)}
                title={isDocked ? 'Switch to floating window' : 'Dock to right sidebar'}
                className="hidden lg:flex w-7 h-7 rounded-lg items-center justify-center text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
              >
                {isDocked ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z" />
                  </svg>
                )}
              </button>

              {/* Close button */}
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close AI Copilot"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Active Product Context Bar (when viewing a product) ──────────── */}
          {activeProduct && (
            <div className="bg-stone-100 border-b border-stone-200 px-3.5 py-2 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-teal-700 shrink-0" />
                <p className="text-xs font-medium text-stone-800 truncate">
                  Viewing: <span className="font-semibold text-stone-950">{activeProduct.name}</span>
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() =>
                    sendMessage(`Summarize customer reviews and specs for ${activeProduct.name}`)
                  }
                  disabled={streaming || !isAuthenticated}
                  className="text-[11px] font-semibold bg-white text-stone-800 hover:bg-stone-900 hover:text-white border border-stone-300 rounded-md px-2 py-0.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Reviews
                </button>
                <button
                  onClick={() =>
                    sendMessage(`Find products similar to ${activeProduct.name}`)
                  }
                  disabled={streaming || !isAuthenticated}
                  className="text-[11px] font-semibold bg-white text-stone-800 hover:bg-stone-900 hover:text-white border border-stone-300 rounded-md px-2 py-0.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Similar
                </button>
              </div>
            </div>
          )}

          {/* ── Messages Feed ────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto scrollbar-thin px-3.5 py-4 space-y-3.5 bg-[#f8f7f4]">
            {messages.length === 0 && !streaming ? (
              <SuggestionChips
                onSelect={(prompt) => sendMessage(prompt)}
                pageContext={pageContext}
              />
            ) : (
              messages.map((msg, i) =>
                msg.role === 'user' ? (
                  <UserBubble key={msg.id} message={msg} />
                ) : (
                  <AssistantBubble
                    key={msg.id}
                    message={msg}
                    isCurrentlyStreaming={streaming && i === messages.length - 1}
                    navigate={navigate}
                  />
                )
              )
            )}

            {streaming &&
              messages.length > 0 &&
              messages[messages.length - 1]?.role === 'assistant' &&
              messages[messages.length - 1]?.parts.length === 0 && <ThinkingDots />}

            <div ref={bottomRef} />
          </div>

          {/* ── Input Bar ────────────────────────────────────────────────────── */}
          <div className="shrink-0 px-3.5 py-3 bg-white border-t border-stone-200/90">
            {!isAuthenticated && (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2 mb-2.5 text-xs text-amber-900">
                <span>Sign in to use Chatram AI Copilot</span>
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="font-bold text-stone-900 hover:underline ml-2 shrink-0"
                >
                  Sign In →
                </Link>
              </div>
            )}

            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={draftInput}
                onChange={(e) => setDraftInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  !isAuthenticated
                    ? 'Sign in to chat with Chatram…'
                    : streaming
                    ? 'Checking catalog…'
                    : activeProduct
                    ? `Ask about ${activeProduct.name.slice(0, 24)}…`
                    : 'Ask to find products, compare specs, or check cart…'
                }
                disabled={!isAuthenticated || streaming}
                className={[
                  'auto-grow-textarea flex-1 px-3.5 py-2.5 text-sm rounded-xl border resize-none leading-snug outline-none transition-all scrollbar-thin',
                  isAuthenticated && !streaming
                    ? 'border-stone-300 bg-stone-50/70 focus:bg-white focus:border-stone-900 focus:ring-3 focus:ring-stone-900/10 text-stone-900'
                    : 'border-stone-200 bg-stone-100 text-stone-400 cursor-not-allowed',
                ].join(' ')}
              />
              <button
                onClick={() => sendMessage(draftInput)}
                disabled={!canSend || !isAuthenticated}
                aria-label="Send message"
                className={[
                  'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer',
                  canSend && isAuthenticated
                    ? 'bg-[#141413] hover:bg-stone-800 text-white shadow-xs active:scale-95'
                    : 'bg-stone-100 text-stone-400 cursor-not-allowed',
                ].join(' ')}
              >
                <SendIcon />
              </button>
            </div>
            <div className="flex items-center justify-between mt-1.5 px-1">
              <p className="text-[10px] text-stone-400">
                Enter to send · Shift+Enter for new line
              </p>
              <p className="text-[10px] text-stone-400 hidden sm:block">
                Shortcut: <kbd className="font-mono bg-stone-100 px-1 py-0.5 rounded border border-stone-200">Ctrl+K</kbd>
              </p>
            </div>
          </div>
        </aside>
      )}

      {/* ─────────────────── Floating Trigger Pill (Bottom-Left, Matte Obsidian) ─────────────────── */}
      {!sellerChatOpen && (!isOpen || !isDocked) && (
        <button
          onClick={() => setIsOpen((v) => !v)}
          aria-label={isOpen ? 'Close Chatram AI Copilot' : 'Open Chatram AI Copilot'}
          aria-expanded={isOpen}
          className={[
            'fixed bottom-5 left-5 z-[45]',
            'flex items-center gap-2 pl-3.5 pr-4 h-11 rounded-full',
            'font-semibold text-xs tracking-wide transition-all duration-200 cursor-pointer border',
            isOpen
              ? 'bg-stone-900 text-stone-100 border-stone-700 shadow-lg scale-95'
              : 'bg-[#141413] hover:bg-stone-800 text-stone-100 border-stone-700/90 ai-glow-pill hover:-translate-y-0.5 active:scale-95',
          ].join(' ')}
        >
          <SparkleIcon className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{isOpen ? 'Close Copilot' : 'Chatram AI Copilot'}</span>

          {unread > 0 && !isOpen && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      )}
    </>
  )
}
