/**
 * Home — product listing page with pagination.
 *
 * URL query params (set by Header):
 *   ?n=<term>   → GET /user/product/search/?n=<term>&page=N
 *   ?ct=<cat>   → GET /user/product/search/?ct=<cat>&page=N
 *   (none)      → GET /user/products/?page=N
 *
 * Images are returned directly by both endpoints — no detail-fetch needed.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import Header from '../components/Header'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

// Emoji icons mapped to common category keywords (case-insensitive)
const CAT_ICONS = {
  phone: '📱', mobile: '📱', smartphone: '📱',
  laptop: '💻', computer: '🖥️', pc: '🖥️',
  tablet: '📲', ipad: '📲',
  tv: '📺', television: '📺',
  camera: '📷', photo: '📷',
  audio: '🎧', headphone: '🎧', speaker: '🔊',
  gaming: '🎮', game: '🎮',
  appliance: '🏠', kitchen: '🍳', home: '🏠',
  fashion: '👗', clothing: '👕', apparel: '👚', wear: '👕',
  shoe: '👟', footwear: '👟',
  watch: '⌚', jewel: '💍',
  book: '📚', stationery: '✏️',
  toy: '🧸', kids: '🧸', baby: '🍼',
  sport: '⚽', fitness: '🏋️', gym: '🏋️',
  beauty: '💄', cosmetic: '💄', skin: '🧴',
  food: '🍎', grocery: '🛒', health: '💊',
  car: '🚗', auto: '🚗', vehicle: '🚗',
  furniture: '🛋️',
  pet: '🐾',
  bag: '👜', luggage: '🧳',
  tool: '🔧', hardware: '🔧',
  default: '🏷️',
}

function getCatIcon(name = '') {
  const lower = name.toLowerCase()
  for (const [key, emoji] of Object.entries(CAT_ICONS)) {
    if (key !== 'default' && lower.includes(key)) return emoji
  }
  return CAT_ICONS.default
}

// Category card background colours (cycles through)
const CAT_BG = [
  'from-blue-500 to-blue-600',
  'from-purple-500 to-purple-600',
  'from-pink-500 to-rose-500',
  'from-amber-500 to-orange-500',
  'from-teal-500 to-cyan-500',
  'from-green-500 to-emerald-500',
  'from-red-500 to-red-600',
  'from-indigo-500 to-violet-500',
  'from-yellow-500 to-amber-400',
  'from-sky-500 to-blue-400',
]

const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.chatram.in'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Make relative media paths absolute (React dev-server doesn't serve /media/) */
function resolveImg(url) {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) return url
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`
}

/**
 * Pull the primary image URL from a product object.
 * Handles multiple shapes the API might return:
 *   • product.image_url          — single string
 *   • product.thumbnail          — single string
 *   • product.images             — array of { image_url, is_primary } objects
 *                                  OR array of plain URL strings
 */
function getPrimaryImageUrl(product) {
  if (!product) return null

  // ── single-field shapes ────────────────────────────────────────────────────
  if (product.image_url)  return product.image_url
  if (product.thumbnail)  return product.thumbnail

  // ── array shape ────────────────────────────────────────────────────────────
  const arr = product.images
  if (Array.isArray(arr) && arr.length > 0) {
    // Array of objects with image_url / is_primary
    if (typeof arr[0] === 'object' && arr[0] !== null) {
      const primary = arr.find(i => i.is_primary) ?? arr[0]
      return primary?.image_url ?? primary?.url ?? null
    }
    // Array of plain strings
    if (typeof arr[0] === 'string') return arr[0]
  }

  return null
}

/** Get numeric product ID — tries direct id field first, then parses product_detail URL */
function getProductId(product) {
  if (product?.id && !isNaN(Number(product.id))) return Number(product.id)
  // Fallback: parse from URL like "http://.../detail/42"
  const url   = String(product?.product_detail ?? '')
  const parts = url.replace(/\/$/, '').split('/')
  const id    = parseInt(parts[parts.length - 1], 10)
  return isNaN(id) ? null : id
}

/** Format price as Indian rupees */
function formatPrice(price) {
  const num = parseFloat(price)
  if (isNaN(num)) return price
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

/** Stable pastel colour for image placeholder */
function pseudoColor(str = '') {
  const palette = ['#dbeafe','#fce7f3','#d1fae5','#fef3c7','#ede9fe','#fee2e2','#cffafe','#f3f4f6']
  let h = 0
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) & 0xffffffff
  return palette[Math.abs(h) % palette.length]
}

// ---------------------------------------------------------------------------
// Categories section
// ---------------------------------------------------------------------------

function CategoriesSection({ activeCategory }) {
  const navigate    = useNavigate()
  const [cats, setCats]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get('/user/product/categories/')
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : (data?.results ?? [])
        setCats(list)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleClick(name) {
    if (activeCategory === name) {
      navigate('/')           // deselect — go back to all products
    } else {
      navigate(`/?ct=${encodeURIComponent(name)}`)
    }
  }

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-24 h-28 rounded-xl bg-gray-200 animate-pulse" />
        ))}
      </div>
    )
  }

  if (cats.length === 0) return null

  return (
    <section className="bg-white border-b border-gray-200 py-5 px-3">
      <div className="max-w-screen-xl mx-auto">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Shop by Category</h2>

        {/* Scrollable row */}
        <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2 -mx-1 px-1">
          {/* "All" chip */}
          <button
            onClick={() => navigate('/')}
            className={[
              'flex-shrink-0 flex flex-col items-center justify-center gap-2 w-24 h-28 rounded-xl border-2 transition-all duration-150',
              !activeCategory
                ? 'border-[#e77600] bg-orange-50 shadow-md'
                : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:shadow-sm',
            ].join(' ')}
          >
            <span className="text-3xl">🏪</span>
            <span className={`text-xs font-semibold text-center leading-tight px-1 ${!activeCategory ? 'text-[#c7511f]' : 'text-gray-600'}`}>
              All
            </span>
          </button>

          {cats.map((cat, idx) => {
            const name     = cat.name ?? cat.category_name ?? String(cat)
            const icon     = getCatIcon(name)
            const gradient = CAT_BG[idx % CAT_BG.length]
            const isActive = activeCategory === name

            return (
              <button
                key={cat.id ?? name}
                onClick={() => handleClick(name)}
                className={[
                  'flex-shrink-0 flex flex-col items-center justify-end gap-0 w-24 h-28 rounded-xl overflow-hidden border-2 transition-all duration-150 group',
                  isActive
                    ? 'border-[#e77600] shadow-lg scale-105'
                    : 'border-transparent hover:shadow-md hover:scale-[1.03]',
                ].join(' ')}
              >
                {/* Coloured card body */}
                <div className={`w-full flex-1 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                  <span className="text-3xl drop-shadow">{icon}</span>
                </div>

                {/* Label */}
                <div className={[
                  'w-full py-1.5 px-1 text-center',
                  isActive ? 'bg-orange-50' : 'bg-white',
                ].join(' ')}>
                  <span className={`text-[11px] font-semibold leading-tight line-clamp-2 ${isActive ? 'text-[#c7511f]' : 'text-gray-700 group-hover:text-gray-900'}`}>
                    {name}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

function Pagination({ page, totalPages, totalCount, pageSize, hasNext, hasPrev, onPageChange, loading }) {
  if (!hasNext && !hasPrev && totalPages <= 1) return null

  const delta = 2
  const pages = []
  const start = Math.max(1, page - delta)
  const end   = Math.min(totalPages || page + delta, page + delta)

  if (start > 1) { pages.push(1); if (start > 2) pages.push('…') }
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < (totalPages || page + delta)) {
    if (end < (totalPages || page + delta) - 1) pages.push('…')
    if (totalPages) pages.push(totalPages)
  }

  const from = totalCount ? (page - 1) * pageSize + 1 : null
  const to   = totalCount ? Math.min(page * pageSize, totalCount) : null

  const base     = 'inline-flex items-center justify-center h-9 min-w-[2.25rem] px-2.5 rounded text-sm font-medium transition-all select-none'
  const active   = 'bg-[#e77600] text-white shadow-sm cursor-default'
  const idle     = 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 cursor-pointer'
  const disabled = 'bg-white border border-gray-200 text-gray-300 cursor-not-allowed'

  return (
    <div className="flex flex-col items-center gap-3 mt-8 mb-4">
      {totalCount > 0 && (
        <p className="text-xs text-gray-500">
          {from && to ? `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ` : ''}
          <b>{totalCount.toLocaleString()}</b> products
        </p>
      )}

      <div className="flex items-center gap-1 flex-wrap justify-center">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev || loading}
          className={`${base} px-3 gap-1 ${!hasPrev || loading ? disabled : idle}`}
        >
          ← Prev
        </button>

        {pages.map((p, i) =>
          p === '…'
            ? <span key={`el-${i}`} className="px-1 text-gray-400 text-sm">…</span>
            : <button
                key={p}
                onClick={() => p !== page && onPageChange(p)}
                disabled={loading || p === page}
                className={`${base} ${p === page ? active : idle}`}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext || loading}
          className={`${base} px-3 gap-1 ${!hasNext || loading ? disabled : idle}`}
        >
          Next →
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProductCard
// ---------------------------------------------------------------------------

function HeartIcon({ filled }) {
  return filled ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#e53e3e" className="w-5 h-5">
      <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#718096" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
    </svg>
  )
}

function ProductCard({ product, wishlisted, onWishlistToggle, onAddToCart }) {
  const navigate    = useNavigate()
  const productId   = getProductId(product)
  const bg          = pseudoColor(product.product_name)
  const rawImgUrl   = getPrimaryImageUrl(product)
  const imgSrc      = resolveImg(rawImgUrl)

  const [imgError,     setImgError]     = useState(false)
  const [addingCart,   setAddingCart]   = useState(false)
  const [togglingWish, setTogglingWish] = useState(false)

  const showImg = !!imgSrc && !imgError

  async function handleAddToCart(e) {
    e.stopPropagation()
    setAddingCart(true)
    try { await onAddToCart(productId) } finally { setAddingCart(false) }
  }

  async function handleWishlist(e) {
    e.stopPropagation()
    setTogglingWish(true)
    try { await onWishlistToggle(productId, wishlisted) } finally { setTogglingWish(false) }
  }

  return (
    <div
      onClick={() => productId && navigate(`/product/${productId}`)}
      className="bg-white rounded border border-gray-200 flex flex-col overflow-hidden cursor-pointer group hover:shadow-lg transition-shadow duration-200"
    >
      {/* Image */}
      <div
        className="relative flex items-center justify-center h-48 text-5xl font-bold text-gray-300 select-none overflow-hidden"
        style={{ backgroundColor: showImg ? '#fff' : bg }}
      >
        {showImg
          ? <img src={imgSrc} alt={product.product_name} className="w-full h-full object-contain" onError={() => setImgError(true)} />
          : <span>{(product.product_name ?? '?')[0].toUpperCase()}</span>
        }

        {/* Wishlist heart */}
        <button
          onClick={handleWishlist}
          disabled={togglingWish}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white shadow-sm transition-all disabled:opacity-50"
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <HeartIcon filled={wishlisted} />
        </button>
      </div>

      {/* Details */}
      <div className="flex flex-col flex-1 p-3 gap-1">
        <p className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug group-hover:text-[#c7511f] transition-colors">
          {product.product_name}
        </p>
        <p className="text-xs text-gray-500">{product.brand_name}</p>
        <p className="text-xs text-[#007185]">{product.category_name}</p>
        <p className="text-lg font-bold text-[#B12704] mt-auto pt-1">
          {formatPrice(product.base_price)}
        </p>
        <button
          onClick={handleAddToCart}
          disabled={addingCart}
          className={[
            'mt-1 w-full py-1.5 px-3 rounded text-sm font-medium',
            'border border-[#a88734]',
            'bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b]',
            'hover:from-[#f5d78e] hover:to-[#eeb933]',
            'text-gray-900 transition-all duration-100',
            'disabled:opacity-60 disabled:cursor-not-allowed active:shadow-inner',
          ].join(' ')}
        >
          {addingCart ? 'Adding…' : 'Add to Cart'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ProductSkeleton() {
  return (
    <div className="bg-white rounded border border-gray-200 overflow-hidden animate-pulse">
      <div className="h-48 bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-2/3" />
        <div className="h-4 bg-gray-200 rounded w-1/3 mt-3" />
        <div className="h-8 bg-gray-200 rounded mt-2" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  const { isAuthenticated, isBuyer, authReady } = useAuth()
  const { addToCart }   = useCart()
  const navigate        = useNavigate()
  const [searchParams]  = useSearchParams()

  const searchTerm     = searchParams.get('n')  ?? ''
  const categoryFilter = searchParams.get('ct') ?? ''

  const [products,   setProducts]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [wishlistIds, setWishlistIds] = useState(new Set())
  const [toast,      setToast]      = useState('')

  // Pagination
  const [page,       setPage]       = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [hasNext,    setHasNext]    = useState(false)
  const [hasPrev,    setHasPrev]    = useState(false)
  const [pageSize,   setPageSize]   = useState(12)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async (pageNum = 1) => {
    setLoading(true)
    setError('')
    setPage(pageNum)
    if (pageNum > 1) window.scrollTo({ top: 0, behavior: 'smooth' })

    try {
      const params = new URLSearchParams({ page: pageNum })
      if (searchTerm)     params.set('n',  searchTerm)
      if (categoryFilter) params.set('ct', categoryFilter)

      const url = (searchTerm || categoryFilter)
        ? `/user/product/search/?${params}`
        : `/user/products/?${params}`

      const { data } = await client.get(url)

      const list  = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
      const count = data?.count ?? list.length

      setProducts(list)
      setTotalCount(count)
      setHasNext(!!data?.next)
      setHasPrev(!!data?.previous)
      if (pageNum === 1 && list.length > 0) setPageSize(list.length)

    } catch {
      setError('Failed to load products. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, categoryFilter])

  // Re-fetch (page 1) whenever search term or category changes
  useEffect(() => { fetchProducts(1) }, [fetchProducts])

  // ── Wishlist ───────────────────────────────────────────────────────────────
  const fetchWishlist = useCallback(async () => {
    if (!authReady || !isBuyer) return
    try {
      const { data } = await client.get('/user/whishlist/')
      const raw = Array.isArray(data) ? data : (data?.results ?? [])
      const ids = new Set(
        raw.map(item => getProductId(item.product)).filter(Boolean)
      )
      setWishlistIds(ids)
    } catch { /* non-critical */ }
  }, [authReady, isBuyer])

  useEffect(() => { fetchWishlist() }, [fetchWishlist])

  // ── Handlers ───────────────────────────────────────────────────────────────
  function requireBuyer() {
    if (!isAuthenticated) { navigate('/login'); return false }
    if (!isBuyer) { showToast('Only buyers can perform this action.'); return false }
    return true
  }

  async function handleAddToCart(productId) {
    if (!requireBuyer()) return
    try { await addToCart(productId, 1); showToast('Added to cart!') }
    catch { showToast('Could not add to cart. Try again.') }
  }

  async function handleWishlistToggle(productId, currentlyWishlisted) {
    if (!requireBuyer()) return
    try {
      if (currentlyWishlisted) {
        await client.delete(`/user/whishlist/?q=${productId}`)
        setWishlistIds(prev => { const s = new Set(prev); s.delete(productId); return s })
        showToast('Removed from wishlist.')
      } else {
        await client.post(`/user/whishlist/?q=${productId}`)
        setWishlistIds(prev => new Set([...prev, productId]))
        showToast('Added to wishlist!')
      }
    } catch { showToast('Could not update wishlist. Try again.') }
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalPages = pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0
  let heading = 'All Products'
  if (searchTerm)     heading = `Results for "${searchTerm}"`
  else if (categoryFilter) heading = `Category: ${categoryFilter}`

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#eaeded] flex flex-col">
      <Header />

      {/* Hero — only on unfiltered home, page 1 */}
      {!searchTerm && page === 1 && (
        <div className="relative overflow-hidden bg-gradient-to-r from-[#131921] via-[#232f3e] to-[#131921] text-white py-12 px-6 text-center select-none">
          <div className="max-w-2xl mx-auto">
            <p className="text-xs uppercase tracking-widest text-[#febd69] mb-2">Welcome to ShopZone</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold mb-3 leading-tight">
              Find anything.<br /><span className="text-[#febd69]">Delivered fast.</span>
            </h1>
            <p className="text-gray-300 text-sm">Millions of products from top brands — all in one place.</p>
          </div>
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#febd69]/10 rounded-full blur-3xl" />
          </div>
        </div>
      )}

      {/* Categories — always visible (below hero when no search, always when category/search active) */}
      {!searchTerm && (
        <CategoriesSection activeCategory={categoryFilter} />
      )}

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-3 py-5">

        {/* Heading row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{heading}</h2>
            {!loading && totalCount > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">{totalCount.toLocaleString()} products found</p>
            )}
          </div>
          {(searchTerm || categoryFilter) && (
            <Link to="/" className="text-sm text-[#007185] hover:text-[#c7511f] hover:underline">
              ← All products
            </Link>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-300 rounded text-sm text-red-700">
            {error}
            <button onClick={() => fetchProducts(page)} className="ml-3 underline font-medium">Retry</button>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)
            : products.length > 0
            ? products.map((product, idx) => {
                const pid = getProductId(product)
                return (
                  <ProductCard
                    key={pid ?? idx}
                    product={product}
                    wishlisted={wishlistIds.has(pid)}
                    onWishlistToggle={handleWishlistToggle}
                    onAddToCart={handleAddToCart}
                  />
                )
              })
            : !error && (
                <div className="col-span-full py-16 text-center text-gray-500">
                  <p className="text-4xl mb-3">🔍</p>
                  <p className="font-medium text-lg text-gray-700">No products found.</p>
                  <p className="text-sm mt-1">
                    Try a different search term or{' '}
                    <Link to="/" className="text-[#007185] hover:underline">browse all products</Link>.
                  </p>
                </div>
              )
          }
        </div>

        {/* Pagination */}
        {!loading && !error && products.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            hasNext={hasNext}
            hasPrev={hasPrev}
            onPageChange={fetchProducts}
            loading={loading}
          />
        )}

      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-gray-900 text-white text-sm rounded-full shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}
