/**
 * Cart — /cart  (protected: buyers only)
 *
 * Amazon-style two-column layout:
 *   Left  (flex-1) — list of cart line-items with quantity stepper + delete
 *   Right (sidebar) — sticky Order Summary with subtotal + Proceed to Buy
 *
 * Empty state: illustration + "Your ShoppingCart is empty" + Continue shopping
 *
 * API calls:
 *   GET    /user/cart/
 *   PATCH  /user/cart/                             ← update quantity
 *   DELETE /user/cart/?product=<id>&variant=<id>   ← remove item
 */

import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import client from '../api/client'
import { useCart } from '../context/CartContext'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatPrice(num) {
  if (num == null || isNaN(num)) return '—'
  return '₹' + Number(num).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function pseudoColor(str = '') {
  const palette = ['#dbeafe', '#fce7f3', '#d1fae5', '#fef3c7', '#ede9fe', '#fee2e2', '#cffafe']
  let h = 0
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return palette[Math.abs(h) % palette.length]
}

/**
 * Resolve total line price for a cart item.
 * Uses server-supplied `cartprice` (already price × qty).
 * Falls back to variant price × quantity when cartprice is absent.
 */
function resolveCartPrice(item) {
  // Backend field is `cartprice` (no underscore)
  if (item.cartprice != null) return parseFloat(item.cartprice)
  const variants = item.product?.variants ?? []
  if (item.product_variant) {
    const v = variants.find((v) => v.id === item.product_variant)
    if (v) return parseFloat(v.price) * item.quantity
  }
  if (variants.length > 0) return parseFloat(variants[0].price) * item.quantity
  return null
}

/** Unit price = line total ÷ qty (for the "₹X each" sub-label) */
function resolveUnitPrice(item) {
  const lineTotal = resolveCartPrice(item)
  if (lineTotal == null) return null
  return lineTotal / (item.quantity || 1)
}

/**
 * Get the human-readable variant label for a line-item, e.g. "Blue / XL".
 */
function variantLabel(item) {
  const variants = item.product?.variants ?? []
  if (!item.product_variant) return null
  const v = variants.find((v) => v.id === item.product_variant)
  if (!v) return null
  return [v.color, v.size].filter(Boolean).join(' / ')
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function CartSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 p-4 bg-white rounded-lg border border-gray-200">
          <div className="w-24 h-24 bg-gray-200 rounded flex-shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-gray-200 rounded w-2/3" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
            <div className="h-5 bg-gray-200 rounded w-1/4 mt-3" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty-cart illustration
// ─────────────────────────────────────────────────────────────────────────────

function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {/* SVG shopping cart illustration */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 240 180"
        className="w-52 h-40 mb-6"
        aria-hidden="true"
      >
        {/* Background circle */}
        <circle cx="120" cy="90" r="80" fill="#f0f2f2" />
        {/* Cart body */}
        <rect x="70" y="70" width="100" height="60" rx="8" fill="#fff" stroke="#d5d9d9" strokeWidth="2" />
        {/* Cart handle */}
        <path d="M55 55 L70 70" stroke="#adb5bd" strokeWidth="3" strokeLinecap="round" />
        <circle cx="52" cy="52" r="5" fill="#adb5bd" />
        {/* Wheels */}
        <circle cx="90" cy="136" r="8" fill="#fff" stroke="#d5d9d9" strokeWidth="2" />
        <circle cx="150" cy="136" r="8" fill="#fff" stroke="#d5d9d9" strokeWidth="2" />
        {/* Items inside */}
        <rect x="85" y="82" width="28" height="32" rx="4" fill="#febd69" opacity="0.7" />
        <rect x="120" y="88" width="36" height="26" rx="4" fill="#ff9900" opacity="0.5" />
        {/* Sad face */}
        <circle cx="120" cy="55" r="14" fill="#fff" stroke="#d5d9d9" strokeWidth="1.5" />
        <circle cx="115" cy="52" r="1.5" fill="#6c757d" />
        <circle cx="125" cy="52" r="1.5" fill="#6c757d" />
        <path d="M115 60 Q120 56 125 60" stroke="#6c757d" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>

      <h2 className="text-2xl font-semibold text-gray-800 mb-1">
        Your Shopping Cart is empty
      </h2>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">
        You have no items in your cart. Start adding products you love!
      </p>
      <Link
        to="/"
        className="px-6 py-2.5 rounded text-sm font-medium border border-[#a88734] bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b] hover:from-[#f5d78e] hover:to-[#eeb933] text-gray-900 transition-all shadow-sm"
      >
        Continue Shopping
      </Link>

      {/* Sign-in prompt (Amazon shows this too) */}
      <div className="mt-8 border-t border-gray-200 pt-6 w-full max-w-sm text-center">
        <p className="text-sm text-gray-600">
          Have an account?{' '}
          <Link to="/login" className="text-[#007185] hover:text-[#c7511f] hover:underline font-medium">
            Sign in
          </Link>{' '}
          to see your saved items.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Cart line-item
// ─────────────────────────────────────────────────────────────────────────────

function CartItem({ item, onQuantityChange, onDelete }) {
  const product    = item.product ?? {}
  const lineTotal  = resolveCartPrice(item)   // total for this line (from cart_price)
  const unitPrice  = resolveUnitPrice(item)   // per-unit price (lineTotal / qty)
  const label      = variantLabel(item)
  const bg        = pseudoColor(product.product_name ?? '')
  const primaryImg = (product.images ?? []).find((i) => i.is_primary) ?? (product.images ?? [])[0]

  const [qty, setQty]             = useState(item.quantity)
  const [updatingQty, setUpdQty]  = useState(false)
  const [deleting, setDeleting]   = useState(false)

  // Sync when parent refreshes
  useEffect(() => { setQty(item.quantity) }, [item.quantity])

  async function handleQtyChange(newQty) {
    if (newQty < 1 || newQty === qty || updatingQty) return
    setUpdQty(true)
    const prev = qty
    setQty(newQty)          // optimistic
    try {
      await onQuantityChange(item, newQty)
    } catch {
      setQty(prev)           // rollback on error
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
        'flex gap-4 p-4 bg-white rounded-lg border transition-opacity',
        deleting ? 'opacity-40 pointer-events-none border-gray-200' : 'border-gray-200',
      ].join(' ')}
    >
      {/* Thumbnail */}
      <Link to={`/product/${product.id}`} className="flex-shrink-0">
        <div
          className="w-24 h-24 sm:w-28 sm:h-28 rounded border border-gray-100 flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: primaryImg ? '#fff' : bg }}
        >
          {primaryImg ? (
            <img
              src={primaryImg.image_url}
              alt={primaryImg.alt_text || product.product_name}
              className="w-full h-full object-contain"
            />
          ) : (
            <span className="text-3xl font-extrabold text-gray-300 select-none">
              {(product.product_name ?? '?')[0].toUpperCase()}
            </span>
          )}
        </div>
      </Link>

      {/* Details */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Name */}
        <Link
          to={`/product/${product.id}`}
          className="text-sm font-medium text-gray-800 hover:text-[#c7511f] line-clamp-2 leading-snug mb-1"
        >
          {product.product_name}
        </Link>

        {/* Brand / Category */}
        <p className="text-xs text-gray-400 mb-0.5">
          {product.brand_name}
          {product.category_name && <> · {product.category_name}</>}
        </p>

        {/* Variant label */}
        {label && (
          <p className="text-xs text-gray-500 mb-1">
            <span className="font-medium">Variant:</span> {label}
          </p>
        )}

        {/* Seller */}
        {product.seller_name && (
          <p className="text-xs text-gray-400 mb-2">
            Sold by <span className="text-[#007185]">{product.seller_name}</span>
          </p>
        )}

        {/* Stock hint */}
        <p className="text-xs text-[#007600] font-medium mb-3">In Stock</p>

        {/* Controls row */}
        <div className="flex items-center flex-wrap gap-3 mt-auto">
          {/* Quantity stepper */}
          <div className="flex items-center rounded border border-gray-300 overflow-hidden h-8 text-sm select-none">
            <button
              onClick={() => handleQtyChange(qty - 1)}
              disabled={qty <= 1 || updatingQty}
              aria-label="Decrease quantity"
              className="px-3 h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 border-r border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-bold text-base"
            >
              −
            </button>
            <span className="px-4 h-full flex items-center justify-center min-w-[3rem] font-medium text-gray-800 bg-white">
              {updatingQty ? (
                <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : qty}
            </span>
            <button
              onClick={() => handleQtyChange(qty + 1)}
              disabled={updatingQty}
              aria-label="Increase quantity"
              className="px-3 h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 border-l border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-bold text-base"
            >
              +
            </button>
          </div>

          {/* Separator */}
          <span className="text-gray-300 text-sm">|</span>

          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm text-[#007185] hover:text-[#c7511f] hover:underline disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Removing…' : 'Delete'}
          </button>

          {/* Separator */}
          <span className="text-gray-300 text-sm hidden sm:inline">|</span>

          {/* Save for later (visual-only, Amazon pattern) */}
          <button className="text-sm text-[#007185] hover:text-[#c7511f] hover:underline hidden sm:inline transition-colors">
            Save for later
          </button>
        </div>
      </div>

      {/* Line total price (right-aligned) */}
      <div className="flex-shrink-0 text-right">
        <p className="text-base font-bold text-gray-900">
          {lineTotal != null ? formatPrice(lineTotal) : '—'}
        </p>
        {qty > 1 && unitPrice != null && (
          <p className="text-xs text-gray-400 mt-0.5">{formatPrice(unitPrice)} each</p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Summary sidebar
// ─────────────────────────────────────────────────────────────────────────────

function OrderSummary({ items, onProceed }) {
  const subtotal = items.reduce((sum, item) => {
    const price = resolveCartPrice(item)
    return sum + (price != null ? price : 0)
  }, 0)

  const totalItems = items.reduce((s, item) => s + item.quantity, 0)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 sticky top-[120px]">
      {/* Subtotal header */}
      <p className="text-lg font-medium text-gray-900 mb-1">
        Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'items'}):
        <span className="font-bold text-gray-900 ml-2">{formatPrice(subtotal)}</span>
      </p>

      {/* Gift option (visual, Amazon pattern) */}
      <label className="flex items-center gap-2 text-xs text-gray-600 mb-4 cursor-pointer">
        <input type="checkbox" className="accent-[#e77600]" />
        This order contains a gift
      </label>

      {/* Proceed to Buy */}
      <button
        onClick={onProceed}
        className={[
          'w-full py-2.5 px-4 rounded-full text-sm font-medium transition-all shadow-sm',
          'border border-[#a88734]',
          'bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b]',
          'hover:from-[#f5d78e] hover:to-[#eeb933]',
          'text-gray-900',
          'focus:outline-none focus:ring-2 focus:ring-[#e77600]',
        ].join(' ')}
      >
        Proceed to Buy
      </button>

      {/* Savings line */}
      <div className="mt-4 pt-4 border-t border-gray-100 space-y-1 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Items ({totalItems}):</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Delivery:</span>
          <span className="text-[#007600] font-medium">FREE</span>
        </div>
        <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-100 mt-2">
          <span>Order Total:</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
      </div>

      {/* EMI teaser */}
      <p className="mt-3 text-xs text-gray-400 text-center">
        EMI available on orders above ₹3,000
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function Cart() {
  const navigate = useNavigate()
  const { refreshCart } = useCart()

  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [toast, setToast]     = useState('')

  // ── Fetch ────────────────────────────────────────────────────────────
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

  useEffect(() => { fetchCart() }, [fetchCart])

  // ── Handlers ─────────────────────────────────────────────────────────

  /**
   * PATCH /user/cart/ — update quantity for a line-item.
   * Optimistic update is handled inside CartItem; we just do the network call.
   */
  async function handleQuantityChange(item, newQty) {
    await client.patch('/user/cart/', {
      product: item.product.id,
      quantity: newQty,
      ...(item.product_variant ? { product_variant: item.product_variant } : {}),
    })
    // Update local state without a full re-fetch for snappiness.
    // Also recalculate cartprice proportionally so subtotals stay accurate:
    //   unitPrice = cartprice / oldQty  →  newCartprice = unitPrice × newQty
    setItems((prev) =>
      prev.map((i) => {
        if (
          i.product?.id === item.product?.id &&
          i.product_variant === item.product_variant
        ) {
          const unitPrice =
            i.cartprice != null ? parseFloat(i.cartprice) / i.quantity : null
          return {
            ...i,
            quantity: newQty,
            cartprice: unitPrice != null ? unitPrice * newQty : i.cartprice,
          }
        }
        return i
      })
    )
    // Sync the header badge
    refreshCart()
  }

  /**
   * DELETE /user/cart/?product=<id>&variant=<id>
   */
  async function handleDelete(item) {
    const variantId = item.product_variant ?? 0
    await client.delete(
      `/user/cart/?product=${item.product.id}&variant=${variantId}`
    )
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

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const totalItems = items.reduce((s, i) => s + i.quantity, 0)

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#eaeded] flex flex-col">
      <Header />

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-3 sm:px-6 py-6">
        {/* Page title */}
        {!loading && (
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            {items.length > 0
              ? `Shopping Cart`
              : 'Shopping Cart'}
          </h1>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-300 rounded text-sm text-red-700">
            {error}
            <button onClick={fetchCart} className="ml-3 underline font-medium">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          /* Loading skeleton */
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <CartSkeleton />
            </div>
            <div className="lg:w-72 xl:w-80 flex-shrink-0">
              <div className="h-56 bg-white rounded-lg border border-gray-200 animate-pulse" />
            </div>
          </div>
        ) : items.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-lg border border-gray-200 px-6">
            <EmptyCart />
          </div>
        ) : (
          /* Cart content */
          <div className="flex flex-col lg:flex-row gap-6 items-start">

            {/* ── Left: Item list ──────────────────────────────────── */}
            <div className="flex-1 min-w-0">
              {/* "Deselect all" header bar — Amazon pattern */}
              <div className="flex items-center justify-between bg-white rounded-t-lg border border-b-0 border-gray-200 px-4 py-2">
                <p className="text-xs text-gray-500">
                  Price
                </p>
              </div>

              {/* Item list */}
              <div className="space-y-px">
                {items.map((item, idx) => (
                  <CartItem
                    key={`${item.product?.id}-${item.product_variant ?? 'base'}-${idx}`}
                    item={item}
                    onQuantityChange={handleQuantityChange}
                    onDelete={handleDelete}
                  />
                ))}
              </div>

              {/* Subtotal footer bar */}
              <div className="bg-white rounded-b-lg border border-t-0 border-gray-200 px-4 py-3 text-right">
                <p className="text-base text-gray-800">
                  Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'items'}):
                  <span className="font-bold ml-2">
                    {formatPrice(
                      items.reduce((sum, item) => {
                        const price = resolveCartPrice(item)
                        return sum + (price != null ? price : 0)
                      }, 0)
                    )}
                  </span>
                </p>
              </div>
            </div>

            {/* ── Right: Order summary ─────────────────────────────── */}
            <div className="lg:w-72 xl:w-80 flex-shrink-0 w-full">
              <OrderSummary
                items={items}
                onProceed={() => navigate('/checkout')}
              />
            </div>
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full shadow-xl bg-gray-900 text-white text-sm font-medium">
          {toast}
        </div>
      )}
    </div>
  )
}
