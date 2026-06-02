/**
 * Wishlist — /wishlist   (isBuyer only)
 *
 * Fetches GET /user/whishlist/ and renders an Amazon-style product grid.
 *
 * Per card:
 *   • Image placeholder (pastel letter-avatar)
 *   • Product name, brand, category, price
 *   • "Move to Cart"  → POST /user/cart/ then DELETE /user/whishlist/?q=<id>
 *   • "Remove"        → DELETE /user/whishlist/?q=<id>
 *   • "View Product"  → /product/:id
 *
 * Empty state: illustration + "Your Wishlist is empty" + link home.
 *
 * Wishlist response shape:
 *   [{ product: { product_name, brand_name, category_name,
 *                 base_price, description, product_detail } }]
 * Product ID is extracted from the product_detail URL.
 */

import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import client from '../api/client'
import { useCart } from '../context/CartContext'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatPrice(val) {
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function extractId(url = '') {
  const parts = String(url).replace(/\/$/, '').split('/')
  const id = parseInt(parts[parts.length - 1], 10)
  return isNaN(id) ? null : id
}

function pseudoColor(str = '') {
  const palette = [
    '#dbeafe', '#fce7f3', '#d1fae5', '#fef3c7',
    '#ede9fe', '#fee2e2', '#cffafe', '#f3f4f6',
  ]
  let h = 0
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return palette[Math.abs(h) % palette.length]
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyWishlist() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {/* SVG heart illustration */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 160"
        className="w-44 h-36 mx-auto mb-6"
        aria-hidden="true"
      >
        <circle cx="100" cy="80" r="72" fill="#f0f2f2" />
        {/* Outer heart (gray outline) */}
        <path
          d="M100 115 C100 115 55 85 55 58 C55 43 65 35 78 35 C88 35 96 41 100 47 C104 41 112 35 122 35 C135 35 145 43 145 58 C145 85 100 115 100 115 Z"
          fill="none" stroke="#d1d5db" strokeWidth="3"
        />
        {/* Inner heart (warm fill) */}
        <path
          d="M100 108 C100 108 62 82 62 59 C62 47 70 41 80 41 C89 41 96 47 100 52 C104 47 111 41 120 41 C130 41 138 47 138 59 C138 82 100 108 100 108 Z"
          fill="#fecaca"
        />
        {/* Small question mark */}
        <text x="100" y="79" textAnchor="middle" fontSize="22" fontWeight="bold" fill="#f87171">?</text>
      </svg>

      <h2 className="text-2xl font-semibold text-gray-800 mb-2">Your Wishlist is empty</h2>
      <p className="text-sm text-gray-500 mb-7 max-w-xs">
        Save items you love and come back to them anytime. Start exploring!
      </p>
      <Link
        to="/"
        className="px-6 py-2.5 rounded text-sm font-medium border border-[#a88734] bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b] hover:from-[#f5d78e] hover:to-[#eeb933] text-gray-900 transition-all shadow-sm"
      >
        Continue Shopping
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function WishlistSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 overflow-hidden animate-pulse">
          <div className="h-44 bg-gray-200" />
          <div className="p-4 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-200 rounded w-2/3" />
            <div className="h-4 bg-gray-200 rounded w-1/3 mt-3" />
            <div className="h-8 bg-gray-200 rounded mt-3" />
            <div className="h-7 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Wishlist product card
// ─────────────────────────────────────────────────────────────────────────────

function WishlistCard({ item, onRemove, onMoveToCart }) {
  const product   = item.product ?? {}
  const productId = extractId(product.product_detail)
  const bg        = pseudoColor(product.product_name ?? '')

  const [movingToCart, setMovingToCart] = useState(false)
  const [removing,     setRemoving]     = useState(false)

  async function handleMoveToCart() {
    if (!productId) return
    setMovingToCart(true)
    try {
      await onMoveToCart(productId)
    } finally {
      setMovingToCart(false)
    }
  }

  async function handleRemove() {
    if (!productId) return
    setRemoving(true)
    try {
      await onRemove(productId)
    } finally {
      setRemoving(false)
    }
  }

  const busy = movingToCart || removing

  return (
    <div
      className={[
        'bg-white rounded-lg border border-gray-200 flex flex-col overflow-hidden',
        'transition-all duration-200 hover:shadow-md',
        busy ? 'opacity-60 pointer-events-none' : '',
      ].join(' ')}
    >
      {/* Image / placeholder */}
      <div
        className="h-44 flex items-center justify-center relative select-none"
        style={{ backgroundColor: bg }}
      >
        <span className="text-6xl font-extrabold text-white/60">
          {(product.product_name ?? '?')[0].toUpperCase()}
        </span>

        {/* Heart badge */}
        <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#e53e3e" className="w-4 h-4">
            <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
          </svg>
        </div>
      </div>

      {/* Details */}
      <div className="flex flex-col flex-1 p-4">
        {/* Name */}
        <Link
          to={productId ? `/product/${productId}` : '#'}
          className="text-sm font-medium text-gray-800 hover:text-[#c7511f] line-clamp-2 leading-snug mb-1 transition-colors"
        >
          {product.product_name ?? 'Unknown product'}
        </Link>

        {/* Brand · Category */}
        <p className="text-xs text-gray-400 mb-0.5">
          {product.brand_name}
          {product.category_name && (
            <> · <span className="text-[#007185]">{product.category_name}</span></>
          )}
        </p>

        {/* Price */}
        <p className="text-lg font-bold text-[#B12704] mt-auto pt-2">
          {formatPrice(product.base_price)}
        </p>

        {/* Action buttons */}
        <div className="mt-3 flex flex-col gap-2">
          {/* Move to Cart */}
          <button
            onClick={handleMoveToCart}
            disabled={busy}
            className={[
              'w-full py-2 px-3 rounded text-sm font-medium transition-all duration-100',
              'border border-[#a88734]',
              'bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b]',
              'hover:from-[#f5d78e] hover:to-[#eeb933]',
              'text-gray-900 active:shadow-inner',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            {movingToCart ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-3 h-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                Moving…
              </span>
            ) : '🛒  Move to Cart'}
          </button>

          {/* Bottom row: View + Remove */}
          <div className="flex gap-2">
            {productId && (
              <Link
                to={`/product/${productId}`}
                className={[
                  'flex-1 py-1.5 px-2 rounded text-xs font-medium text-center transition-all',
                  'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700',
                ].join(' ')}
              >
                View product
              </Link>
            )}
            <button
              onClick={handleRemove}
              disabled={busy}
              className={[
                'flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all',
                'border border-gray-300 bg-white',
                'hover:border-red-300 hover:text-red-600 hover:bg-red-50',
                'text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed',
              ].join(' ')}
            >
              {removing ? '…' : 'Remove'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function Wishlist() {
  const navigate = useNavigate()
  const { addToCart } = useCart()

  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [toast,   setToast]   = useState({ msg: '', type: 'success' })

  // ── Fetch ────────────────────────────────────────────────────────
  const fetchWishlist = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await client.get('/user/whishlist/')
      // Handle both plain-array and DRF paginated { count, next, previous, results }
      const raw = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
      setItems(raw)
    } catch (err) {
      if (err.response?.status === 401) {
        navigate('/login?next=/wishlist', { replace: true })
      } else {
        setError('Failed to load wishlist. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => { fetchWishlist() }, [fetchWishlist])

  // ── Toast ────────────────────────────────────────────────────────
  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: 'success' }), 2500)
  }

  // ── Remove from wishlist ──────────────────────────────────────────
  async function handleRemove(productId) {
    try {
      await client.delete(`/user/whishlist/?q=${productId}`)
      setItems(prev =>
        prev.filter(item => extractId(item.product?.product_detail) !== productId)
      )
      showToast('Removed from wishlist.')
    } catch {
      showToast('Could not remove item. Try again.', 'error')
    }
  }

  // ── Move to Cart: add → then remove from wishlist ─────────────────
  async function handleMoveToCart(productId) {
    try {
      await addToCart(productId, 1)
      await client.delete(`/user/whishlist/?q=${productId}`)
      setItems(prev =>
        prev.filter(item => extractId(item.product?.product_detail) !== productId)
      )
      showToast('Moved to cart!')
    } catch {
      showToast('Could not move to cart. Try again.', 'error')
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#eaeded] flex flex-col">
      <Header />

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-3 sm:px-6 py-6">

        {/* Page header */}
        {!loading && (
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-2xl font-semibold text-gray-900">
              Your Wishlist
              {items.length > 0 && (
                <span className="ml-2 text-base font-normal text-gray-400">
                  ({items.length} {items.length === 1 ? 'item' : 'items'})
                </span>
              )}
            </h1>
            {items.length > 0 && (
              <Link to="/" className="text-sm text-[#007185] hover:text-[#c7511f] hover:underline">
                Continue shopping
              </Link>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-300 rounded-lg text-sm text-red-700 flex justify-between">
            <span>{error}</span>
            <button onClick={fetchWishlist} className="underline font-medium ml-3">Retry</button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <WishlistSkeleton />
        ) : items.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <EmptyWishlist />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((item, idx) => {
              const productId = extractId(item.product?.product_detail)
              return (
                <WishlistCard
                  key={productId ?? idx}
                  item={item}
                  onRemove={handleRemove}
                  onMoveToCart={handleMoveToCart}
                />
              )
            })}
          </div>
        )}
      </main>

      {/* Toast */}
      {toast.msg && (
        <div
          className={[
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
            'px-5 py-3 rounded-full shadow-xl text-sm font-medium',
            'transition-all animate-bounce-in',
            toast.type === 'error' ? 'bg-red-700 text-white' : 'bg-gray-900 text-white',
          ].join(' ')}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
