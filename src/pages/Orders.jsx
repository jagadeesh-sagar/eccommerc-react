/**
 * Orders — /orders   (isBuyer only)
 *
 * Fetches GET /user/order/ and renders each order card with:
 *   • 4-step visual status progress tracker (Pending → Processing → Shipped → Delivered)
 *   • Real-time WebSocket OrderChatPanel drawer ("Chat with Seller")
 *   • "Ask AI about this order" shortcut
 */

import { useState, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Header from '../components/Header'
import OrderChatPanel from '../components/OrderChatPanel'
import { SparkleIcon } from '../components/AIChatWidget'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useAIChat } from '../context/AIChatContext'

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: '🕐',
    stepIdx: 0,
  },
  processing: {
    label: 'Processing',
    dot: 'bg-indigo-500',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: '⚙️',
    stepIdx: 1,
  },
  shipped: {
    label: 'Shipped',
    dot: 'bg-violet-500',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
    icon: '🚚',
    stepIdx: 2,
  },
  delivered: {
    label: 'Delivered',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: '✅',
    stepIdx: 3,
  },
  cancelled: {
    label: 'Cancelled',
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: '✕',
    stepIdx: -1,
  },
  returned: {
    label: 'Returned',
    dot: 'bg-orange-500',
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: '↩',
    stepIdx: -1,
  },
}

const TRACK_STEPS = ['Confirmed', 'Processing', 'Shipped', 'Delivered']

function formatPrice(val) {
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function addressOneLiner(addr) {
  if (!addr) return '—'
  return [addr.house_no, addr.street, addr.city, addr.state, addr.postal_code, addr.country]
    .filter(Boolean)
    .join(', ')
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-600 border-slate-300',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold capitalize ${cfg.badge}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function OrderProgressStepper({ status }) {
  const cfg = STATUS_CONFIG[status]
  if (!cfg || cfg.stepIdx < 0) return null
  const activeIdx = cfg.stepIdx

  return (
    <div className="py-3 mb-4">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 right-0 top-3 h-1 bg-slate-100 rounded-full -z-0" />
        <div
          className="absolute left-0 top-3 h-1 bg-indigo-600 rounded-full transition-all duration-500 -z-0"
          style={{ width: `${(activeIdx / (TRACK_STEPS.length - 1)) * 100}%` }}
        />

        {TRACK_STEPS.map((label, idx) => {
          const reached = idx <= activeIdx
          return (
            <div key={label} className="relative z-10 flex flex-col items-center gap-1.5">
              <div
                className={[
                  'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all',
                  reached
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                    : 'bg-white border-slate-300 text-slate-400',
                ].join(' ')}
              >
                {reached ? '✓' : idx + 1}
              </div>
              <span
                className={[
                  'text-[11px] font-semibold',
                  reached ? 'text-slate-900' : 'text-slate-400',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OrderSkeleton() {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden animate-pulse">
      <div className="bg-slate-50 border-b border-slate-200/80 px-5 py-4 flex justify-between">
        <div className="space-y-1.5">
          <div className="h-3 bg-slate-200 rounded w-28" />
          <div className="h-3 bg-slate-200 rounded w-20" />
        </div>
        <div className="h-6 bg-slate-200 rounded-full w-20" />
      </div>
      <div className="p-5 space-y-3">
        <div className="h-12 bg-slate-100 rounded-xl" />
        <div className="h-10 bg-slate-100 rounded-xl" />
      </div>
    </div>
  )
}

function EmptyOrders() {
  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl px-6 py-20 text-center shadow-2xs">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 text-3xl border border-indigo-100">
        📦
      </div>
      <h2 className="text-xl font-extrabold text-slate-900 mb-1.5">No orders placed yet</h2>
      <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto">
        Once you place an order on Chatram, you can track its real-time status and chat directly with sellers here.
      </p>
      <Link
        to="/"
        className="inline-block px-6 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-indigo-600 text-white transition-colors shadow-xs"
      >
        Start Shopping →
      </Link>
    </div>
  )
}

function OrderCard({ order, index, currentUser, onAskAI }) {
  const [expanded, setExpanded] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const items = order.items ?? []
  const shipAddr = order.shipping_address
  const status = order.status ?? 'pending'
  const totalQty = items.reduce((s, i) => s + (i.quantity ?? 1), 0)

  const orderId = order.id ?? null
  const orderNum = order.order_number || String(orderId || index + 1).padStart(3, '0')
  const showDiscount = order.discount_amount && parseFloat(order.discount_amount) > 0

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs hover:border-slate-300 transition-colors">
      {/* Card Header */}
      <div className="bg-slate-50/80 border-b border-slate-200/80 px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
            <div>
              <p className="uppercase tracking-wider font-bold text-slate-400 text-[10px]">
                Order Placed
              </p>
              <p className="text-slate-800 font-semibold">
                {formatDate(order.order_date)}
                {order.order_date && (
                  <span className="text-slate-400 ml-1">{formatTime(order.order_date)}</span>
                )}
              </p>
            </div>
            <div>
              <p className="uppercase tracking-wider font-bold text-slate-400 text-[10px]">Total</p>
              <p className="text-slate-900 font-mono font-bold">{formatPrice(order.total_amount)}</p>
            </div>
            <div>
              <p className="uppercase tracking-wider font-bold text-slate-400 text-[10px]">Items</p>
              <p className="text-slate-800 font-semibold">
                {totalQty} {totalQty === 1 ? 'item' : 'items'}
              </p>
            </div>
            <div className="hidden sm:block">
              <p className="uppercase tracking-wider font-bold text-slate-400 text-[10px]">
                Deliver To
              </p>
              <p className="text-slate-800 font-semibold truncate max-w-[180px]">
                {shipAddr?.user ?? '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-slate-500">#{orderNum}</span>
            <StatusBadge status={status} />
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="px-5 py-4">
        <OrderProgressStepper status={status} />

        {/* Line Items */}
        <div className="space-y-3 mb-4">
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 p-2.5 rounded-xl bg-slate-50/60 border border-slate-100"
            >
              <div className="w-11 h-11 rounded-xl border border-slate-200 bg-white flex items-center justify-center shrink-0">
                <span className="text-base font-extrabold text-slate-400 select-none">
                  {(item.product_name ?? '?')[0].toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <Link
                  to={`/product/${item.product}`}
                  className="text-sm font-bold text-slate-900 hover:text-indigo-600 line-clamp-1 transition-colors"
                >
                  {item.product_name}
                </Link>
                {item.product_variant && (
                  <p className="text-xs text-slate-400">Variant #{item.product_variant}</p>
                )}
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0 whitespace-nowrap">
                <span className="text-xs text-slate-500">
                  Qty: <strong className="text-slate-800">{item.quantity}</strong>
                </span>
                {item.status && item.status !== 'pending' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 capitalize">
                    {item.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Expand Details Toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors cursor-pointer"
        >
          {expanded ? 'Hide price & address breakdown ▲' : 'View price & address breakdown ▼'}
        </button>

        {expanded && (
          <div className="border-t border-slate-100 mt-4 pt-4 space-y-4">
            <div className="bg-slate-50 rounded-2xl px-4 py-3.5 space-y-1.5 text-xs sm:text-sm">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Invoice Breakdown
              </p>
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono">{formatPrice(order.subtotal)}</span>
              </div>
              {showDiscount && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount</span>
                  <span className="font-mono">− {formatPrice(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Shipping</span>
                <span className="text-emerald-600 font-bold">
                  {parseFloat(order.shipping_cost ?? 0) === 0
                    ? 'FREE'
                    : formatPrice(order.shipping_cost)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST (18%)</span>
                <span className="font-mono">{formatPrice(order.tax_amount)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-slate-900 border-t border-slate-200 pt-2 mt-1 text-base">
                <span>Order Total</span>
                <span className="font-mono text-indigo-600">{formatPrice(order.total_amount)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="border border-slate-200/80 rounded-2xl p-3.5 bg-white">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Shipping Address
                </p>
                {shipAddr ? (
                  <>
                    <p className="text-xs font-bold text-slate-800 capitalize mb-0.5">
                      {shipAddr.user}
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {addressOneLiner(shipAddr)}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400">Address not available</p>
                )}
              </div>
              {order.billing_address && (
                <div className="border border-slate-200/80 rounded-2xl p-3.5 bg-white">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Billing Address
                  </p>
                  <p className="text-xs font-bold text-slate-800 capitalize mb-0.5">
                    {order.billing_address.user}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {addressOneLiner(order.billing_address)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Slide-in Real-time Order Chat Drawer */}
      {chatOpen && orderId && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs"
            onClick={() => setChatOpen(false)}
          />
          <div className="fixed top-0 right-0 h-full z-50 w-full max-w-[380px] flex flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 bg-slate-900 text-white shrink-0">
              <span className="text-sm font-bold">💬 Seller Chat · Order #{orderNum}</span>
              <button
                onClick={() => setChatOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <OrderChatPanel
                orderId={orderId}
                currentUser={currentUser}
                otherPartyName="Seller"
              />
            </div>
          </div>
        </>
      )}

      {/* Card Footer */}
      <div className="bg-slate-50/80 border-t border-slate-200/80 px-5 py-3 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setChatOpen((v) => !v)}
            disabled={!orderId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-xs font-bold text-slate-700 hover:text-indigo-600 shadow-2xs transition-all cursor-pointer disabled:opacity-40"
          >
            <span>💬 Chat with Seller</span>
          </button>

          <button
            onClick={() => onAskAI(order)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200/80 text-xs font-bold transition-all cursor-pointer"
          >
            <SparkleIcon className="w-3.5 h-3.5" />
            <span>Ask AI Copilot</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {items[0]?.product && (
            <Link
              to={`/product/${items[0].product}`}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              {status === 'delivered' ? '★ Write a Review' : 'View Product →'}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Orders() {
  const location = useLocation()
  const { user } = useAuth()
  const { askAI, setPageContext } = useAIChat()
  const justOrdered = location.state?.orderPlaced === true

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showBanner, setShowBanner] = useState(justOrdered)

  const [totalCount, setTotalCount] = useState(0)
  const [nextUrl, setNextUrl] = useState(null)
  const [prevUrl, setPrevUrl] = useState(null)
  const [currentUrl, setCurrentUrl] = useState('/user/order/')

  useEffect(() => {
    setPageContext({ page: 'orders' })
  }, [setPageContext])

  const fetchOrders = useCallback(async (url) => {
    setLoading(true)
    setError('')
    try {
      const { data } = await client.get(url)
      if (Array.isArray(data)) {
        setOrders(data)
        setTotalCount(data.length)
        setNextUrl(null)
        setPrevUrl(null)
      } else {
        const list = Array.isArray(data.results) ? data.results : []
        setOrders(list)
        setTotalCount(data.count ?? list.length)
        setNextUrl(data.next ? data.next.replace(/^https?:\/\/[^/]+/, '') : null)
        setPrevUrl(data.previous ? data.previous.replace(/^https?:\/\/[^/]+/, '') : null)
      }
    } catch {
      setError('Failed to load orders. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders(currentUrl)
  }, [currentUrl, fetchOrders])

  useEffect(() => {
    if (!showBanner) return
    const t = setTimeout(() => setShowBanner(false), 6000)
    return () => clearTimeout(t)
  }, [showBanner])

  function goTo(url) {
    if (!url) return
    setCurrentUrl(url)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
        {showBanner && (
          <div className="mb-6 flex items-start gap-3 px-5 py-4 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-2xs">
            <span className="text-2xl shrink-0">🎉</span>
            <div className="flex-1">
              <p className="font-bold text-emerald-900 text-sm">Order placed successfully!</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Thank you for shopping with Chatram. Track your delivery progress below.
              </p>
            </div>
            <button
              onClick={() => setShowBanner(false)}
              className="text-emerald-600 hover:text-emerald-900 text-lg leading-none shrink-0 cursor-pointer"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Your Orders</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Track shipments, view invoices, or chat live with sellers
            </p>
          </div>
          {!loading && totalCount > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
              {totalCount} {totalCount === 1 ? 'order' : 'orders'}
            </span>
          )}
        </div>

        {error && (
          <div className="mb-6 px-4 py-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-sm text-rose-700">
            {error}
            <button
              onClick={() => fetchOrders(currentUrl)}
              className="ml-3 underline font-bold cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <OrderSkeleton key={i} />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyOrders />
        ) : (
          <>
            <div className="space-y-5">
              {orders.map((order, idx) => (
                <OrderCard
                  key={order.id ?? idx}
                  order={order}
                  index={idx}
                  currentUser={user}
                  onAskAI={(o) =>
                    askAI(
                      `Check the status and details of my Order #${o.order_number || o.id} (status: ${o.status}, total: ₹${o.total_amount}).`
                    )
                  }
                />
              ))}
            </div>

            {(prevUrl || nextUrl) && (
              <div className="flex items-center justify-between mt-8 px-1">
                <button
                  onClick={() => goTo(prevUrl)}
                  disabled={!prevUrl}
                  className={[
                    'px-4 py-2 rounded-xl text-xs font-bold border transition-all',
                    prevUrl
                      ? 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer'
                      : 'border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed',
                  ].join(' ')}
                >
                  ← Previous
                </button>
                <p className="text-xs text-slate-500">
                  Showing {orders.length} of {totalCount} orders
                </p>
                <button
                  onClick={() => goTo(nextUrl)}
                  disabled={!nextUrl}
                  className={[
                    'px-4 py-2 rounded-xl text-xs font-bold border transition-all',
                    nextUrl
                      ? 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer'
                      : 'border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed',
                  ].join(' ')}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
