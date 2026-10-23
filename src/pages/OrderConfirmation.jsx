/**
 * OrderConfirmation — /order-confirmation
 *
 * Shown after a successful order placement (COD or Razorpay).
 */

import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Header from '../components/Header'

function formatPrice(val) {
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

function AnimatedCheck() {
  return (
    <div className="flex items-center justify-center mb-5">
      <div
        className="w-18 h-18 rounded-2xl bg-emerald-100 border-2 border-emerald-400 flex items-center justify-center shadow-sm"
        style={{ animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#059669"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-9 h-9"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <style>{`
        @keyframes popIn {
          0%   { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export default function OrderConfirmation() {
  const location = useLocation()
  const navigate = useNavigate()
  const order = location.state?.order

  useEffect(() => {
    if (!order) navigate('/orders', { replace: true })
  }, [order, navigate])

  if (!order) return null

  const items = order.items ?? []
  const totalQty = items.reduce((s, i) => s + (i.quantity ?? 1), 0)

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-10">
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xs overflow-hidden">
          {/* Header Banner */}
          <div className="bg-gradient-to-b from-emerald-50/90 to-white border-b border-slate-100 px-6 py-8 text-center">
            <AnimatedCheck />
            <span className="inline-block px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 mb-2">
              Order Confirmed
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-1.5">
              Thank you for your order!
            </h1>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Your Chatram order has been received and our merchant partner is preparing it for dispatch.
            </p>
          </div>

          {/* Order Meta */}
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70">
            <div className="flex flex-wrap justify-between gap-4 text-sm">
              {order.order_number && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Order Number
                  </p>
                  <p className="font-mono font-bold text-slate-900">{order.order_number}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Items
                </p>
                <p className="font-bold text-slate-900">
                  {totalQty} {totalQty === 1 ? 'item' : 'items'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Amount Charged
                </p>
                <p className="font-mono font-extrabold text-indigo-600">
                  {formatPrice(order.total_amount)}
                </p>
              </div>
            </div>
          </div>

          {/* Ordered Items */}
          {items.length > 0 && (
            <div className="px-6 py-5 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Items in this order
              </p>
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 shrink-0 flex items-center justify-center">
                      <span className="text-sm font-bold text-slate-400">
                        {(item.product_name ?? '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 line-clamp-1">
                        {item.product_name}
                      </p>
                      {item.product_variant && (
                        <p className="text-xs text-slate-400">Variant #{item.product_variant}</p>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-slate-500 shrink-0">
                      Qty: <strong className="text-slate-900">{item.quantity}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Price Breakdown */}
          <div className="px-6 py-5 border-b border-slate-100 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-mono">{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Shipping</span>
              <span
                className={
                  parseFloat(order.shipping_cost ?? 0) === 0
                    ? 'text-emerald-600 font-bold'
                    : 'font-mono'
                }
              >
                {parseFloat(order.shipping_cost ?? 0) === 0
                  ? 'FREE'
                  : formatPrice(order.shipping_cost)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>GST (18%)</span>
              <span className="font-mono">{formatPrice(order.tax_amount)}</span>
            </div>
            <div className="flex justify-between font-extrabold text-slate-900 border-t border-slate-100 pt-2.5 mt-1 text-base">
              <span>Total</span>
              <span className="font-mono text-indigo-600">{formatPrice(order.total_amount)}</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="px-6 py-5 flex flex-col sm:flex-row gap-3">
            <Link
              to="/orders"
              className="flex-1 text-center py-3 rounded-2xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors"
            >
              Track Your Order →
            </Link>
            <Link
              to="/"
              className="flex-1 text-center py-3 rounded-2xl text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
