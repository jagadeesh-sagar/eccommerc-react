/**
 * Cart — /cart  (protected: buyers only)
 *
 * Modern two-column layout:
 *   Left  (flex-1) — list of cart line-items with pill quantity stepper + delete + save to wishlist
 *   Right (sidebar) — sticky Order Summary with subtotal + Proceed to Checkout + Shopping Guide Review
 */

import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { SparkleIcon } from '../components/AIChatWidget'
import client from '../api/client'
import { useCart } from '../context/CartContext'
import { useAIChat } from '../context/AIChatContext'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatPrice(num) {
  if (num == null || isNaN(num)) return '—'
  return '₹' + Number(num).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function pseudoColor(str = '') {
  const palette = ['#f5f5f4', '#fef3c7', '#ecfdf5', '#ffedd5', '#f3f4f6', '#fae8ff', '#e0f2fe']
  let h = 0
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return palette[Math.abs(h) % palette.length]
}

function resolveCartPrice(item) {
  if (item.cartprice != null) return parseFloat(item.cartprice)
  const variants = item.product?.variants ?? []
  if (item.product_variant) {
    const v = variants.find((v) => v.id === item.product_variant)
    if (v) return parseFloat(v.price) * item.quantity
  }
  if (variants.length > 0) return parseFloat(variants[0].price) * item.quantity
  if (item.product?.base_price) return parseFloat(item.product.base_price) * item.quantity
  return null
}

function resolveUnitPrice(item) {
  const lineTotal = resolveCartPrice(item)
  if (lineTotal == null) return null
  return lineTotal / (item.quantity || 1)
}

function variantLabel(item) {
  const variants = item.product?.variants ?? []
  if (!item.product_variant) return null
  const v = variants.find((v) => v.id === item.product_variant)
  if (!v) return null
  return [v.color, v.size].filter(Boolean).join(' / ')
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton & Empty State
// ─────────────────────────────────────────────────────────────────────────────

function CartSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 p-5 bg-white rounded-2xl border border-stone-200/80">
          <div className="w-24 h-24 bg-stone-100 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2.5 py-1">
            <div className="h-4 bg-stone-100 rounded-md w-2/3" />
            <div className="h-3 bg-stone-100 rounded-md w-1/3" />
            <div className="h-5 bg-stone-100 rounded-md w-1/4 mt-3" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyCart({ onAskAI }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-stone-100 text-stone-700 flex items-center justify-center mb-4 text-3xl border border-stone-200">
        🛒
      </div>
      <h2 className="text-xl font-extrabold text-stone-900 mb-1.5">Your Shopping Cart is empty</h2>
      <p className="text-sm text-stone-500 mb-6 max-w-sm">
        Browse our storefront or ask Chatram AI Copilot to recommend products for your budget.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="px-6 py-2.5 rounded-xl text-xs font-bold bg-stone-900 hover:bg-stone-800 text-white transition-colors shadow-xs"
        >
          Browse Products →
        </Link>
        <button
          onClick={onAskAI}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 transition-colors cursor-pointer"
        >
          <SparkleIcon className="w-3.5 h-3.5 text-amber-500" />
          <span>Ask Chatram AI Copilot</span>
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Cart Line Item
// ─────────────────────────────────────────────────────────────────────────────

function CartItem({ item, onQuantityChange, onDelete, onSaveForLater }) {
  const product = item.product ?? {}
  const lineTotal = resolveCartPrice(item)
  const unitPrice = resolveUnitPrice(item)
  const label = variantLabel(item)
  const bg = pseudoColor(product.product_name ?? '')
  const primaryImg = (product.images ?? []).find((i) => i.is_primary) ?? (product.images ?? [])[0]

  const [qty, setQty] = useState(item.quantity)
  const [updatingQty, setUpdQty] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setQty(item.quantity)
  }, [item.quantity])

  async function handleQtyChange(newQty) {
    if (newQty < 1 || newQty === qty || updatingQty) return
    setUpdQty(true)
    const prev = qty
    setQty(newQty)
    try {
      await onQuantityChange(item, newQty)
    } catch {
      setQty(prev)
    } finally {
      setUpdQty(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await onDelete(item)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className={[
        'flex flex-col sm:flex-row gap-4 p-4 sm:p-5 bg-white rounded-2xl border border-stone-200/90 shadow-2xs transition-all',
        deleting ? 'opacity-40 pointer-events-none' : 'hover:border-stone-300',
      ].join(' ')}
    >
      <div className="flex gap-4 flex-1 min-w-0">
        {/* Thumbnail */}
        <Link to={`/product/${product.id}`} className="shrink-0">
          <div
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl border border-stone-100 flex items-center justify-center overflow-hidden p-2"
            style={{ backgroundColor: primaryImg ? '#ffffff' : bg }}
          >
            {primaryImg ? (
              <img
                src={primaryImg.image_url}
                alt={primaryImg.alt_text || product.product_name}
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-3xl font-extrabold text-stone-300 select-none">
                {(product.product_name ?? '?')[0].toUpperCase()}
              </span>
            )}
          </div>
        </Link>

        {/* Details */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            {product.brand_name && (
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                {product.brand_name}
              </span>
            )}
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              In Stock
            </span>
          </div>

          <Link
            to={`/product/${product.id}`}
            className="text-sm sm:text-base font-bold text-stone-900 hover:text-orange-700 line-clamp-2 leading-snug mb-1 transition-colors"
          >
            {product.product_name}
          </Link>

          {label && (
            <p className="text-xs text-stone-500 mb-1">
              <span className="font-semibold text-stone-700">Option:</span> {label}
            </p>
          )}

          {product.seller_name && (
            <p className="text-xs text-stone-400 mb-3">
              Sold by <span className="text-stone-600 font-medium">{product.seller_name}</span>
            </p>
          )}

          {/* Controls Row */}
          <div className="flex items-center flex-wrap gap-3 mt-auto pt-1">
            {/* Pill Stepper */}
            <div className="inline-flex items-center rounded-xl border border-stone-200 bg-stone-50 p-0.5 h-8 text-xs select-none">
              <button
                onClick={() => handleQtyChange(qty - 1)}
                disabled={qty <= 1 || updatingQty}
                aria-label="Decrease quantity"
                className="w-7 h-full rounded-lg flex items-center justify-center hover:bg-white text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-bold cursor-pointer"
              >
                −
              </button>
              <span className="px-3 h-full flex items-center justify-center min-w-[2.25rem] font-mono font-bold text-stone-900">
                {updatingQty ? '…' : qty}
              </span>
              <button
                onClick={() => handleQtyChange(qty + 1)}
                disabled={updatingQty}
                aria-label="Increase quantity"
                className="w-7 h-full rounded-lg flex items-center justify-center hover:bg-white text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-bold cursor-pointer"
              >
                +
              </button>
            </div>

            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              {deleting ? 'Removing…' : 'Remove'}
            </button>

            <button
              onClick={() => onSaveForLater(item)}
              className="text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              ♡ Move to Wishlist
            </button>
          </div>
        </div>
      </div>

      {/* Line Total Price */}
      <div className="sm:text-right flex sm:flex-col items-baseline sm:items-end justify-between border-t sm:border-t-0 border-stone-100 pt-2 sm:pt-0 shrink-0">
        <p className="text-lg font-extrabold font-mono text-stone-900">
          {lineTotal != null ? formatPrice(lineTotal) : '—'}
        </p>
        {qty > 1 && unitPrice != null && (
          <p className="text-xs font-mono text-stone-400 mt-0.5">{formatPrice(unitPrice)} each</p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Summary Sidebar
// ─────────────────────────────────────────────────────────────────────────────

function OrderSummary({ items, onProceed, onAskAIReview }) {
  const subtotal = items.reduce((sum, item) => {
    const price = resolveCartPrice(item)
    return sum + (price != null ? price : 0)
  }, 0)

  const totalItems = items.reduce((s, item) => s + item.quantity, 0)

  return (
    <div className="bg-white border border-stone-200/90 rounded-3xl p-6 shadow-2xs sticky top-28 space-y-5">
      <div>
        <h2 className="text-base font-extrabold text-stone-900 mb-1">Order Summary</h2>
        <p className="text-xs text-stone-500">
          {totalItems} {totalItems === 1 ? 'item' : 'items'} in your cart
        </p>
      </div>

      <div className="space-y-2.5 text-sm text-stone-600 border-t border-stone-100 pt-4">
        <div className="flex justify-between">
          <span>Items Subtotal</span>
          <span className="font-mono font-semibold text-stone-800">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Standard Delivery</span>
          <span className="text-emerald-700 font-bold">FREE</span>
        </div>
        <div className="flex justify-between items-baseline font-extrabold text-stone-900 text-lg pt-3 border-t border-stone-200/80">
          <span>Estimated Total</span>
          <span className="font-mono text-xl">{formatPrice(subtotal)}</span>
        </div>
      </div>

      <button
        onClick={onProceed}
        className="w-full py-3.5 px-5 rounded-2xl text-sm font-bold bg-stone-900 hover:bg-stone-800 text-white shadow-xs transition-all active:scale-[0.99] cursor-pointer"
      >
        Proceed to Checkout →
      </button>

      <button
        onClick={onAskAIReview}
        className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-stone-50 hover:bg-stone-100 text-stone-800 border border-stone-200/90 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
      >
        <SparkleIcon className="w-3.5 h-3.5 text-amber-500" />
        <span>Review cart with Chatram AI Copilot</span>
      </button>

      <div className="pt-2 border-t border-stone-100 text-[11px] text-stone-400 text-center space-y-1">
        <p>🔒 256-bit SSL encrypted checkout</p>
        <p>Supports UPI, Cards, NetBanking &amp; Cash on Delivery</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Cart Page
// ─────────────────────────────────────────────────────────────────────────────

export default function Cart() {
  const navigate = useNavigate()
  const { refreshCart } = useCart()
  const { askAI, setPageContext } = useAIChat()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    setPageContext({ page: 'cart' })
  }, [setPageContext])

  const fetchCart = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await client.get('/user/cart/')
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      if (err.response?.status === 401) {
        navigate('/login?next=/cart', { replace: true })
      } else {
        setError('Failed to load cart. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    fetchCart()
  }, [fetchCart])

  async function handleQuantityChange(item, newQty) {
    await client.patch('/user/cart/', {
      product: item.product.id,
      quantity: newQty,
      ...(item.product_variant ? { product_variant: item.product_variant } : {}),
    })
    setItems((prev) =>
      prev.map((i) => {
        if (
          i.product?.id === item.product?.id &&
          i.product_variant === item.product_variant
        ) {
          const unitPrice = i.cartprice != null ? parseFloat(i.cartprice) / i.quantity : null
          return {
            ...i,
            quantity: newQty,
            cartprice: unitPrice != null ? unitPrice * newQty : i.cartprice,
          }
        }
        return i
      })
    )
    refreshCart()
  }

  async function handleDelete(item) {
    const variantId = item.product_variant ?? 0
    await client.delete(`/user/cart/?product=${item.product.id}&variant=${variantId}`)
    setItems((prev) =>
      prev.filter(
        (i) =>
          !(
            i.product?.id === item.product?.id &&
            i.product_variant === item.product_variant
          )
      )
    )
    refreshCart()
    showToast('Item removed from cart.')
  }

  async function handleSaveForLater(item) {
    const pid = item.product?.id
    if (!pid) return
    try {
      await client.post(`/user/whishlist/?q=${pid}`)
      await handleDelete(item)
      showToast('Moved to your Wishlist!')
    } catch {
      showToast('Could not move to wishlist.')
    }
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  return (
    <div className="min-h-screen bg-[#f7f6f2] flex flex-col">
      <Header />

      <main className="flex-1 max-w-[1440px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {!loading && (
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight">
                Shopping Cart
              </h1>
              <p className="text-xs text-stone-500 mt-0.5">
                Review your items and proceed to secure checkout
              </p>
            </div>
            <Link
              to="/"
              className="text-xs font-semibold text-stone-700 hover:text-stone-950 hover:underline"
            >
              ← Continue shopping
            </Link>
          </div>
        )}

        {error && (
          <div className="mb-6 px-4 py-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-sm text-rose-700 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={fetchCart} className="underline font-bold ml-3 cursor-pointer">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1">
              <CartSkeleton />
            </div>
            <div className="lg:w-80 xl:w-96 shrink-0">
              <div className="h-64 bg-white rounded-3xl border border-stone-200/80 animate-pulse" />
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-3xl border border-stone-200/90 shadow-2xs">
            <EmptyCart onAskAI={() => askAI('Recommend the best products to add to my cart')} />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Left: Cart Items */}
            <div className="flex-1 min-w-0 w-full space-y-3.5">
              {items.map((item, idx) => (
                <CartItem
                  key={`${item.product?.id}-${item.product_variant ?? 'base'}-${idx}`}
                  item={item}
                  onQuantityChange={handleQuantityChange}
                  onDelete={handleDelete}
                  onSaveForLater={handleSaveForLater}
                />
              ))}
            </div>

            {/* Right: Sticky Summary */}
            <div className="lg:w-80 xl:w-96 shrink-0 w-full">
              <OrderSummary
                items={items}
                onProceed={() => navigate('/checkout')}
                onAskAIReview={() =>
                  askAI("Review what's currently in my cart and tell me if I'm getting good value.")
                }
              />
            </div>
          </div>
        )}
      </main>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full shadow-xl bg-[#141413] text-white text-xs font-semibold"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
