/**
 * OrderConfirmation — /order-confirmation
 *
 * Shown after a successful order placement (COD or Razorpay).
 * Receives the order object via navigate state:
 *   navigate('/order-confirmation', { state: { order: currentOrder } })
 *
 * currentOrder shape:
 *   { order_id, order_number, subtotal, shipping_cost, tax_amount, total_amount, items }
 */

import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Header from '../components/Header'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatPrice(val) {
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkmark animation (pure CSS, no library)
// ─────────────────────────────────────────────────────────────────────────────

function AnimatedCheck() {
  return (
    <div className="flex items-center justify-center mb-6">
      <div
        className="w-20 h-20 rounded-full bg-[#e7f4e4] border-4 border-[#5a9e5a] flex items-center justify-center"
        style={{ animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2d6a2d"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-10 h-10"
          style={{ animation: 'drawCheck 0.4s 0.25s ease-out both' }}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <style>{`
        @keyframes popIn {
          0%   { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes drawCheck {
          0%   { stroke-dasharray: 30; stroke-dashoffset: 30; opacity: 0; }
          30%  { opacity: 1; }
          100% { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function OrderConfirmation() {
  const location = useLocation()
  const navigate  = useNavigate()
  const order     = location.state?.order   // currentOrder passed from Checkout

  // If someone lands here directly (no state), bounce to orders
  useEffect(() => {
    if (!order) navigate('/orders', { replace: true })
  }, [order, navigate])

  if (!order) return null

  const items    = order.items ?? []
  const totalQty = items.reduce((s, i) => s + (i.quantity ?? 1), 0)

  return (
    <div className="min-h-screen bg-[#eaeded] flex flex-col">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto w-full px-3 sm:px-6 py-10">

        {/* ── Success card ─────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">

          {/* Green header banner */}
          <div className="bg-[#e7f4e4] border-b border-[#c3e6cb] px-6 py-5 text-center">
            <AnimatedCheck />

            <h1 className="text-2xl font-bold text-[#2d6a2d] mb-1">
              Order placed successfully!
            </h1>
            <p className="text-sm text-[#3a7a3a]">
              Thank you for shopping with ShopZone. We've received your order and will
              start processing it shortly.
            </p>
          </div>

          {/* Order meta */}
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50">
            <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
              {order.order_number && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Order number</p>
                  <p className="font-mono font-semibold text-gray-700">{order.order_number}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Items</p>
                <p className="font-semibold text-gray-700">{totalQty} {totalQty === 1 ? 'item' : 'items'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Order total</p>
                <p className="font-semibold text-[#B12704]">{formatPrice(order.total_amount)}</p>
              </div>
            </div>
          </div>

          {/* Items list */}
          {items.length > 0 && (
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Items ordered</p>
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded border border-gray-200 bg-gray-50 flex-shrink-0 flex items-center justify-center">
                      <span className="text-sm font-bold text-gray-300">
                        {(item.product_name ?? '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 line-clamp-1">{item.product_name}</p>
                      {item.product_variant && (
                        <p className="text-xs text-gray-400">Variant #{item.product_variant}</p>
                      )}
                    </div>
                    <span className="text-sm text-gray-500 flex-shrink-0">
                      Qty: <span className="font-semibold text-gray-700">{item.quantity}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Price summary */}
          <div className="px-6 py-4 border-b border-gray-100 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Shipping</span>
              <span className={parseFloat(order.shipping_cost ?? 0) === 0 ? 'text-[#007600] font-medium' : ''}>
                {parseFloat(order.shipping_cost ?? 0) === 0 ? 'FREE' : formatPrice(order.shipping_cost)}
              </span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>GST (18%)</span>
              <span>{formatPrice(order.tax_amount)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-100 pt-2 mt-1 text-base">
              <span>Total charged</span>
              <span className="text-[#B12704]">{formatPrice(order.total_amount)}</span>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="px-6 py-5 flex flex-col sm:flex-row gap-3">
            <Link
              to="/orders"
              className={[
                'flex-1 text-center py-2.5 rounded-full text-sm font-medium transition-all shadow-sm',
                'border border-[#a88734] bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b]',
                'hover:from-[#f5d78e] hover:to-[#eeb933] text-gray-900',
              ].join(' ')}
            >
              View your orders
            </Link>
            <Link
              to="/"
              className="flex-1 text-center py-2.5 rounded-full text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-all"
            >
              Continue shopping
            </Link>
          </div>
        </div>

        {/* Reassurance row */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center text-xs text-gray-500">
          {[
            { icon: '📦', title: 'Fast dispatch', desc: "We'll ship within 1–2 business days" },
            { icon: '🔒', title: 'Secure payment', desc: 'Your payment info is never stored' },
            { icon: '↩',  title: 'Easy returns',   desc: '10-day hassle-free return policy' },
          ].map(item => (
            <div key={item.title} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="text-2xl mb-1">{item.icon}</div>
              <p className="font-semibold text-gray-700 text-xs mb-0.5">{item.title}</p>
              <p className="text-gray-400 text-[11px]">{item.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
