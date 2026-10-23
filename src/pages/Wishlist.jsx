/**
 * Wishlist — /wishlist   (isBuyer only)
 *
 * Fetches GET /user/whishlist/ and renders a modern product grid with real
 * product images, ratings, Move to Cart, Remove, and AI comparison triggers.
 */

import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { SparkleIcon } from '../components/AIChatWidget'
import client from '../api/client'
import { useCart } from '../context/CartContext'
import { useAIChat } from '../context/AIChatContext'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.chatram.in'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatPrice(val) {
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function extractId(product = {}) {
  if (product?.id && !isNaN(Number(product.id))) return Number(product.id)
  const url = product?.product_detail ?? ''
  const parts = String(url).replace(/\/$/, '').split('/')
  const id = parseInt(parts[parts.length - 1], 10)
  return isNaN(id) ? null : id
}

function resolveImg(url) {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) return url
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`
}

function getPrimaryImageUrl(product) {
  if (!product) return null
  if (product.image_url) return product.image_url
  if (product.thumbnail) return product.thumbnail
  const arr = product.images
  if (Array.isArray(arr) && arr.length > 0) {
    if (typeof arr[0] === 'object' && arr[0] !== null) {
      const primary = arr.find((i) => i.is_primary) ?? arr[0]
      return primary?.image_url ?? primary?.url ?? null
    }
    if (typeof arr[0] === 'string') return arr[0]
  }
  return null
}

function pseudoColor(str = '') {
  const palette = ['#eef2ff', '#fae8ff', '#ecfdf5', '#fffbeb', '#f5f3ff', '#fff1f2', '#ecfeff']
  let h = 0
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return palette[Math.abs(h) % palette.length]
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyWishlist() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-4 text-3xl shadow-2xs border border-rose-100">
        ♥
      </div>
      <h2 className="text-xl font-extrabold text-slate-900 mb-1.5">Your Wishlist is empty</h2>
      <p className="text-sm text-slate-500 mb-6 max-w-sm">
        Save products you love while browsing and compare them anytime with Chatram AI Copilot.
      </p>
      <Link
        to="/"
        className="px-6 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-indigo-600 text-white transition-colors shadow-xs"
      >
        Explore Storefront →
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function WishlistSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden animate-pulse">
          <div className="h-48 bg-slate-100" />
          <div className="p-4 space-y-2.5">
            <div className="h-3 bg-slate-100 rounded-md w-1/3" />
            <div className="h-4 bg-slate-100 rounded-md w-full" />
            <div className="h-5 bg-slate-100 rounded-md w-1/3 mt-3" />
            <div className="h-9 bg-slate-100 rounded-xl mt-3" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Wishlist Card
// ─────────────────────────────────────────────────────────────────────────────

function WishlistCard({ item, onRemove, onMoveToCart }) {
  const product = item.product ?? {}
  const productId = extractId(product)
  const bg = pseudoColor(product.product_name ?? '')
  const imgSrc = resolveImg(getPrimaryImageUrl(product))

  const [imgError, setImgError] = useState(false)
  const [movingToCart, setMovingToCart] = useState(false)
  const [removing, setRemoving] = useState(false)

  const showImg = !!imgSrc && !imgError
  const rating = Number(product.avg_rating || 0)

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
        'bg-white rounded-2xl border border-slate-200/80 flex flex-col overflow-hidden group',
        'transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/5 hover:border-indigo-200',
        busy ? 'opacity-60 pointer-events-none' : '',
      ].join(' ')}
    >
      {/* Product Image */}
      <Link
        to={productId ? `/product/${productId}` : '#'}
        className="h-48 flex items-center justify-center relative select-none p-4 border-b border-slate-100 overflow-hidden"
        style={{ backgroundColor: showImg ? '#ffffff' : bg }}
      >
        {showImg ? (
          <img
            src={imgSrc}
            alt={product.product_name}
            loading="lazy"
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-5xl font-extrabold text-slate-300">
            {(product.product_name ?? '?')[0].toUpperCase()}
          </span>
        )}

        <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-rose-50 border border-rose-200/80 flex items-center justify-center shadow-2xs">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#e11d48" className="w-4 h-4">
            <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
          </svg>
        </div>
      </Link>

      {/* Details */}
      <div className="flex flex-col flex-1 p-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
            {product.brand_name || 'Chatram'}
          </span>
          {rating > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-slate-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded-md">
              <span className="text-amber-500">★</span> {rating.toFixed(1)}
            </span>
          )}
        </div>

        <Link
          to={productId ? `/product/${productId}` : '#'}
          className="text-sm font-bold text-slate-900 hover:text-indigo-600 line-clamp-2 leading-snug mb-2 transition-colors"
        >
          {product.product_name ?? 'Unknown product'}
        </Link>

        <p className="text-lg font-extrabold font-mono text-slate-900 mt-auto pt-2">
          {formatPrice(product.base_price)}
        </p>

        <div className="mt-3.5 flex flex-col gap-2">
          <button
            onClick={handleMoveToCart}
            disabled={busy}
            className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            {movingToCart ? 'Moving to Cart…' : '🛒 Move to Cart'}
          </button>

          <div className="flex gap-2">
            {productId && (
              <Link
                to={`/product/${productId}`}
                className="flex-1 py-2 px-2 rounded-xl text-xs font-semibold text-center border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
              >
                View Details
              </Link>
            )}
            <button
              onClick={handleRemove}
              disabled={busy}
              className="flex-1 py-2 px-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white hover:border-rose-200 hover:text-rose-600 hover:bg-rose-50 text-slate-500 transition-colors cursor-pointer"
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
// Main Wishlist Page
// ─────────────────────────────────────────────────────────────────────────────

export default function Wishlist() {
  const navigate = useNavigate()
  const { addToCart } = useCart()
  const { askAI, setPageContext } = useAIChat()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState({ msg: '', type: 'success' })

  useEffect(() => {
    setPageContext({ page: 'wishlist' })
  }, [setPageContext])

  const fetchWishlist = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await client.get('/user/whishlist/')
      const raw = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : []
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

  useEffect(() => {
    fetchWishlist()
  }, [fetchWishlist])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: 'success' }), 2600)
  }

  async function handleRemove(productId) {
    try {
      await client.delete(`/user/whishlist/?q=${productId}`)
      setItems((prev) => prev.filter((item) => extractId(item.product) !== productId))
      showToast('Removed from wishlist.')
    } catch {
      showToast('Could not remove item. Try again.', 'error')
    }
  }

  async function handleMoveToCart(productId) {
    try {
      await addToCart(productId, 1)
      await client.delete(`/user/whishlist/?q=${productId}`)
      setItems((prev) => prev.filter((item) => extractId(item.product) !== productId))
      showToast('Moved to cart!')
    } catch {
      showToast('Could not move to cart. Try again.', 'error')
    }
  }

  function handleCompareWithAI() {
    const names = items
      .map((i) => i.product?.product_name)
      .filter(Boolean)
      .slice(0, 5)
    if (names.length === 0) return
    askAI(`Compare these items from my wishlist and help me decide which to buy: ${names.join(', ')}`)
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <Header />

      <main className="flex-1 max-w-[1440px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {!loading && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Saved Wishlist
                {items.length > 0 && (
                  <span className="ml-2.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Keep track of your favorite finds and move them to your cart anytime.
              </p>
            </div>

            {items.length > 0 && (
              <div className="flex items-center gap-2.5">
                {items.length > 1 && (
                  <button
                    onClick={handleCompareWithAI}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 text-xs font-bold transition-all cursor-pointer"
                  >
                    <SparkleIcon className="w-3.5 h-3.5" />
                    <span>Compare Wishlist with AI</span>
                  </button>
                )}
                <Link
                  to="/"
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Continue Shopping
                </Link>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mb-6 px-4 py-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-sm text-rose-700 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={fetchWishlist} className="underline font-bold ml-3 cursor-pointer">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <WishlistSkeleton />
        ) : items.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs">
            <EmptyWishlist />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {items.map((item, idx) => {
              const productId = extractId(item.product)
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

      {toast.msg && (
        <div
          role="status"
          aria-live="polite"
          className={[
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full shadow-xl text-xs font-semibold transition-all',
            toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white',
          ].join(' ')}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
