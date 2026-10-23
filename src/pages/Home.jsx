/**
 * Home — Modern Widescreen Product Discovery & AI-Assisted Storefront
 *
 * URL query params:
 *   ?n=<term>      → GET /user/product/search/?n=<term>&page=N
 *   ?ct=<cat>      → GET /user/product/search/?ct=<cat>&page=N
 *   ?b=<brand>     → GET /user/product/search/?b=<brand>&page=N
 *   ?price=<num>   → GET /user/product/search/?price=<num>&page=N
 *   ?deals=true    → Filters / highlights products under ₹2,000
 *   ?sort=<mode>   → Client-side sort ('newest', 'price_asc', 'price_desc', 'rating')
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import Header from '../components/Header'
import BannerCarousel from '../components/BannerCarousel'
import { SparkleIcon } from '../components/AIChatWidget'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useAIChat } from '../context/AIChatContext'

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
  electronic: '⚡',
  default: '✨',
}

function getCatIcon(name = '') {
  const lower = name.toLowerCase()
  for (const [key, emoji] of Object.entries(CAT_ICONS)) {
    if (key !== 'default' && lower.includes(key)) return emoji
  }
  return CAT_ICONS.default
}

const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.chatram.in'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function getProductId(product) {
  if (product?.id && !isNaN(Number(product.id))) return Number(product.id)
  const url = String(product?.product_detail ?? '')
  const parts = url.replace(/\/$/, '').split('/')
  const id = parseInt(parts[parts.length - 1], 10)
  return isNaN(id) ? null : id
}

function formatPrice(price) {
  const num = parseFloat(price)
  if (isNaN(num)) return price
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function pseudoColor(str = '') {
  const palette = ['#eef2ff', '#fae8ff', '#ecfdf5', '#fffbeb', '#f5f3ff', '#fff1f2', '#ecfeff', '#f8fafc']
  let h = 0
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) & 0xffffffff
  return palette[Math.abs(h) % palette.length]
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

function Pagination({ page, totalPages, totalCount, pageSize, hasNext, hasPrev, onPageChange, loading }) {
  if (!hasNext && !hasPrev && totalPages <= 1) return null

  const delta = 2
  const pages = []
  const start = Math.max(1, page - delta)
  const end = Math.min(totalPages || page + delta, page + delta)

  if (start > 1) {
    pages.push(1)
    if (start > 2) pages.push('…')
  }
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < (totalPages || page + delta)) {
    if (end < (totalPages || page + delta) - 1) pages.push('…')
    if (totalPages) pages.push(totalPages)
  }

  const from = totalCount ? (page - 1) * pageSize + 1 : null
  const to = totalCount ? Math.min(page * pageSize, totalCount) : null

  const base =
    'inline-flex items-center justify-center h-9 min-w-[2.25rem] px-3 rounded-xl text-xs font-semibold transition-all select-none'
  const active = 'bg-indigo-600 text-white shadow-xs cursor-default'
  const idle =
    'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 cursor-pointer'
  const disabled = 'bg-slate-50 border border-slate-200/60 text-slate-300 cursor-not-allowed'

  return (
    <div className="flex flex-col items-center gap-3 mt-10 mb-4">
      {totalCount > 0 && (
        <p className="text-xs text-slate-500">
          {from && to ? `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ` : ''}
          <span className="font-bold text-slate-700">{totalCount.toLocaleString()}</span> products
        </p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev || loading}
          className={`${base} gap-1 ${!hasPrev || loading ? disabled : idle}`}
        >
          ← Prev
        </button>

        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`el-${i}`} className="px-1 text-slate-400 text-sm">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => p !== page && onPageChange(p)}
              disabled={loading || p === page}
              className={`${base} ${p === page ? active : idle}`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext || loading}
          className={`${base} gap-1 ${!hasNext || loading ? disabled : idle}`}
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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#e11d48" className="w-4 h-4">
      <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 text-slate-600">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
    </svg>
  )
}

function ProductCard({ product, wishlisted, onWishlistToggle, onAddToCart, onAskAI }) {
  const navigate = useNavigate()
  const productId = getProductId(product)
  const bg = pseudoColor(product.product_name)
  const rawImgUrl = getPrimaryImageUrl(product)
  const imgSrc = resolveImg(rawImgUrl)

  const [imgError, setImgError] = useState(false)
  const [addingCart, setAddingCart] = useState(false)
  const [togglingWish, setTogglingWish] = useState(false)

  const showImg = !!imgSrc && !imgError
  const rating = Number(product.avg_rating || 0)
  const reviewCount = Number(product.review_count || 0)

  async function handleAddToCart(e) {
    e.stopPropagation()
    setAddingCart(true)
    try {
      await onAddToCart(productId)
    } finally {
      setAddingCart(false)
    }
  }

  async function handleWishlist(e) {
    e.stopPropagation()
    setTogglingWish(true)
    try {
      await onWishlistToggle(productId, wishlisted)
    } finally {
      setTogglingWish(false)
    }
  }

  function handleAskClick(e) {
    e.stopPropagation()
    onAskAI(product)
  }

  return (
    <div
      onClick={() => productId && navigate(`/product/${productId}`)}
      className="bg-white rounded-2xl border border-slate-200/80 flex flex-col overflow-hidden cursor-pointer group hover:shadow-xl hover:shadow-slate-900/5 hover:-translate-y-1 hover:border-indigo-200 transition-all duration-300"
    >
      {/* Image Canvas */}
      <div
        className="relative flex items-center justify-center h-44 sm:h-52 text-5xl font-bold text-slate-300 select-none overflow-hidden p-4 border-b border-slate-100"
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
          <span>{(product.product_name ?? '?')[0].toUpperCase()}</span>
        )}

        {/* Category pill badge (top-left) */}
        {product.category_name && (
          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-slate-900/75 backdrop-blur-xs text-white text-[10px] font-semibold capitalize">
            {product.category_name}
          </span>
        )}

        {/* Floating Action Buttons (top-right) */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5">
          <button
            onClick={handleWishlist}
            disabled={togglingWish}
            className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs hover:bg-white border border-slate-200/80 shadow-xs flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer"
            aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            title={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
          >
            <HeartIcon filled={wishlisted} />
          </button>

          <button
            onClick={handleAskClick}
            className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-200/80 shadow-xs flex items-center justify-center transition-all cursor-pointer"
            title={`Ask AI Copilot about ${product.product_name}`}
            aria-label={`Ask AI about ${product.product_name}`}
          >
            <SparkleIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Product Details */}
      <div className="flex flex-col flex-1 p-3.5 sm:p-4 gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
            {product.brand_name || 'Chatram Select'}
          </span>

          {rating > 0 ? (
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200/60 text-[11px] font-bold text-slate-800 shrink-0">
              <span className="text-amber-500">★</span>
              <span>{rating.toFixed(1)}</span>
              {reviewCount > 0 && (
                <span className="text-slate-400 font-normal">({reviewCount})</span>
              )}
            </div>
          ) : (
            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
              New
            </span>
          )}
        </div>

        <h3 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors">
          {product.product_name}
        </h3>

        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-base sm:text-lg font-extrabold font-mono text-slate-900 leading-none">
              {formatPrice(product.base_price)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Free delivery available</p>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={addingCart}
            className={[
              'px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0',
              'bg-slate-900 hover:bg-indigo-600 text-white shadow-2xs active:scale-95',
              'disabled:opacity-60 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            {addingCart ? 'Adding…' : '+ Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 flex flex-col overflow-hidden">
      <div className="h-44 sm:h-52 bg-slate-100 animate-pulse" />
      <div className="flex flex-col flex-1 p-4 gap-2.5">
        <div className="h-3 bg-slate-100 rounded-md w-1/3 animate-pulse" />
        <div className="h-4 bg-slate-100 rounded-md w-full animate-pulse" />
        <div className="h-4 bg-slate-100 rounded-md w-2/3 animate-pulse" />
        <div className="mt-auto pt-3 flex items-center justify-between">
          <div className="h-5 bg-slate-100 rounded-md w-1/3 animate-pulse" />
          <div className="h-8 bg-slate-100 rounded-xl w-20 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Home Component
// ---------------------------------------------------------------------------

export default function Home() {
  const { isAuthenticated, isBuyer, authReady } = useAuth()
  const { addToCart } = useCart()
  const { askAI, setPageContext } = useAIChat()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const searchTerm = searchParams.get('n') ?? ''
  const categoryFilter = searchParams.get('ct') ?? ''
  const brandFilter = searchParams.get('b') ?? ''
  const priceFilter = searchParams.get('price') ?? ''
  const sortParam = searchParams.get('sort') ?? ''
  const dealsOnly = searchParams.get('deals') === 'true'

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [wishlistIds, setWishlistIds] = useState(new Set())
  const [toast, setToast] = useState('')

  // Pagination
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [hasPrev, setHasPrev] = useState(false)
  const [pageSize, setPageSize] = useState(12)

  // Register current page context for the AI Copilot
  useEffect(() => {
    setPageContext({
      page: 'home',
      category: categoryFilter || null,
      searchQuery: searchTerm || null,
    })
  }, [categoryFilter, searchTerm, setPageContext])

  // Fetch categories for Category Showcase strip
  useEffect(() => {
    client
      .get('/user/product/categories/')
      .then(({ data }) => setCategories(Array.isArray(data) ? data : data?.results ?? []))
      .catch(() => {})
  }, [])

  // Fetch products
  const fetchProducts = useCallback(
    async (pageNum = 1) => {
      setLoading(true)
      setError('')
      setPage(pageNum)
      if (pageNum > 1) window.scrollTo({ top: 0, behavior: 'smooth' })

      try {
        const params = new URLSearchParams({ page: pageNum })
        if (searchTerm) params.set('n', searchTerm)
        if (categoryFilter) params.set('ct', categoryFilter)
        if (brandFilter) params.set('b', brandFilter)
        if (priceFilter) params.set('price', priceFilter)

        const isFiltered = Boolean(searchTerm || categoryFilter || brandFilter || priceFilter)
        const url = isFiltered
          ? `/user/product/search/?${params}`
          : `/user/products/?${params}`

        const { data } = await client.get(url)

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
          ? data.results
          : []
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
    },
    [searchTerm, categoryFilter, brandFilter, priceFilter]
  )

  useEffect(() => {
    fetchProducts(1)
  }, [fetchProducts])

  // Wishlist sync
  const fetchWishlist = useCallback(async () => {
    if (!authReady || !isBuyer) return
    try {
      const { data } = await client.get('/user/whishlist/')
      const raw = Array.isArray(data) ? data : data?.results ?? []
      const ids = new Set(raw.map((item) => getProductId(item.product)).filter(Boolean))
      setWishlistIds(ids)
    } catch {
      /* non-critical */
    }
  }, [authReady, isBuyer])

  useEffect(() => {
    fetchWishlist()
  }, [fetchWishlist])

  // Apply client-side sorting and deals filter
  const displayedProducts = useMemo(() => {
    let list = [...products]
    if (dealsOnly) {
      const under2k = list.filter((p) => parseFloat(p.base_price) <= 2500)
      if (under2k.length > 0) list = under2k
    }
    if (sortParam === 'price_asc') {
      list.sort((a, b) => parseFloat(a.base_price || 0) - parseFloat(b.base_price || 0))
    } else if (sortParam === 'price_desc') {
      list.sort((a, b) => parseFloat(b.base_price || 0) - parseFloat(a.base_price || 0))
    } else if (sortParam === 'rating') {
      list.sort((a, b) => Number(b.avg_rating || 0) - Number(a.avg_rating || 0))
    } else if (sortParam === 'newest') {
      list.sort((a, b) => (getProductId(b) || 0) - (getProductId(a) || 0))
    }
    return list
  }, [products, dealsOnly, sortParam])

  function requireBuyer() {
    if (!isAuthenticated) {
      navigate('/login')
      return false
    }
    if (!isBuyer) {
      showToast('Only buyer accounts can add items to cart or wishlist.')
      return false
    }
    return true
  }

  async function handleAddToCart(productId) {
    if (!requireBuyer()) return
    try {
      await addToCart(productId, 1)
      showToast('Added to cart!')
    } catch {
      showToast('Could not add to cart. Try again.')
    }
  }

  async function handleWishlistToggle(productId, currentlyWishlisted) {
    if (!requireBuyer()) return
    try {
      if (currentlyWishlisted) {
        await client.delete(`/user/whishlist/?q=${productId}`)
        setWishlistIds((prev) => {
          const s = new Set(prev)
          s.delete(productId)
          return s
        })
        showToast('Removed from wishlist.')
      } else {
        await client.post(`/user/whishlist/?q=${productId}`)
        setWishlistIds((prev) => new Set([...prev, productId]))
        showToast('Saved to wishlist!')
      }
    } catch {
      showToast('Could not update wishlist. Try again.')
    }
  }

  function handleAskAIAboutProduct(product) {
    const pid = getProductId(product)
    askAI(
      `Tell me about "${product.product_name}" (${formatPrice(product.base_price)}${pid ? `, ID ${pid}` : ''}) — what are its key highlights and is it worth buying?`
    )
  }

  function updateQueryParam(key, val) {
    const next = new URLSearchParams(searchParams)
    if (!val) next.delete(key)
    else next.set(key, val)
    setSearchParams(next)
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  const totalPages = pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0
  const hasActiveFilters = Boolean(
    searchTerm || categoryFilter || brandFilter || priceFilter || sortParam || dealsOnly
  )

  let heading = 'Featured Products'
  if (searchTerm) heading = `Search results for "${searchTerm}"`
  else if (categoryFilter) heading = `${categoryFilter}`
  else if (dealsOnly) heading = 'Value Deals & Under ₹2,500 Picks'
  else if (sortParam === 'rating') heading = 'Top Rated by Customers'
  else if (sortParam === 'newest') heading = 'Latest Arrivals'

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <Header />

      {/* Hero Carousel on unfiltered page 1 */}
      {!searchTerm && !categoryFilter && !brandFilter && page === 1 && <BannerCarousel />}

      <main className="flex-1 max-w-[1440px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* ── Category Showcase Strip ───────────────────────────────────── */}
        {categories.length > 0 && !searchTerm && page === 1 && (
          <section aria-label="Shop by Category">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Browse Categories
              </h2>
              {categoryFilter && (
                <button
                  onClick={() => navigate('/')}
                  className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                >
                  Reset category ✕
                </button>
              )}
            </div>
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => navigate('/')}
                className={[
                  'shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer',
                  !categoryFilter
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200/90 hover:border-indigo-300 hover:text-indigo-600',
                ].join(' ')}
              >
                <span>✨</span>
                <span>All Categories</span>
              </button>
              {categories.map((cat) => {
                const isSelected = categoryFilter.toLowerCase() === cat.name.toLowerCase()
                return (
                  <button
                    key={cat.name}
                    onClick={() =>
                      navigate(isSelected ? '/' : `/?ct=${encodeURIComponent(cat.name)}`)
                    }
                    className={[
                      'shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-bold capitalize transition-all cursor-pointer',
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200/90 hover:border-indigo-300 hover:text-indigo-600',
                    ].join(' ')}
                  >
                    <span className="text-base leading-none">{getCatIcon(cat.name)}</span>
                    <span>{cat.name}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* ── AI Shopping Copilot Discovery Banner ──────────────────────── */}
        {page === 1 && !searchTerm && (
          <section className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 shadow-md border border-indigo-500/20 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
                <SparkleIcon className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-extrabold text-white">
                    Not sure what to pick? Ask your AI-MCP Shopping Copilot
                  </h3>
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    Live Inventory
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-indigo-200/80 mt-0.5">
                  Compare specifications, find gifts under your budget, or add items directly to your cart with natural language.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto">
              <button
                onClick={() => askAI('Find the highest rated products in the store')}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                ★ Best Rated Picks
              </button>
              <button
                onClick={() => askAI('Show me the best products under ₹2000')}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                💰 Under ₹2,000
              </button>
              <button
                onClick={() => askAI('', { autoSend: false })}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Open Copilot →
              </button>
            </div>
          </section>
        )}

        {/* ── Filter & Sort Header Bar ──────────────────────────────────── */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 capitalize tracking-tight">
                  {heading}
                </h1>
                {!loading && totalCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200/70 text-slate-700">
                    { displayedProducts.length } shown
                  </span>
                )}
              </div>
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {searchTerm && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                      Search: "{searchTerm}"
                      <button onClick={() => updateQueryParam('n', '')} className="ml-1 hover:text-indigo-950 cursor-pointer">✕</button>
                    </span>
                  )}
                  {categoryFilter && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/60 capitalize">
                      Category: {categoryFilter}
                      <button onClick={() => updateQueryParam('ct', '')} className="ml-1 hover:text-indigo-950 cursor-pointer">✕</button>
                    </span>
                  )}
                  {dealsOnly && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      Under ₹2,500 Deals
                      <button onClick={() => updateQueryParam('deals', '')} className="ml-1 hover:text-emerald-950 cursor-pointer">✕</button>
                    </span>
                  )}
                  <Link
                    to="/"
                    className="text-xs font-semibold text-slate-500 hover:text-indigo-600 underline underline-offset-2 ml-1"
                  >
                    Clear all filters
                  </Link>
                </div>
              )}
            </div>

            {/* Sort & Quick Filter Controls */}
            <div className="flex items-center gap-2.5 self-start sm:self-auto">
              <label htmlFor="sort-select" className="text-xs font-semibold text-slate-500 shrink-0">
                Sort by:
              </label>
              <select
                id="sort-select"
                value={sortParam}
                onChange={(e) => updateQueryParam('sort', e.target.value)}
                className="px-3 py-2 rounded-xl bg-white border border-slate-200/90 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
              >
                <option value="">Featured</option>
                <option value="newest">Newest Arrivals</option>
                <option value="rating">Customer Rating</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 px-4 py-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-sm text-rose-700 flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => fetchProducts(page)}
                className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Product Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-5">
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => <ProductSkeleton key={i} />)
            ) : displayedProducts.length > 0 ? (
              displayedProducts.map((product, idx) => {
                const pid = getProductId(product)
                return (
                  <ProductCard
                    key={pid ?? idx}
                    product={product}
                    wishlisted={wishlistIds.has(pid)}
                    onWishlistToggle={handleWishlistToggle}
                    onAddToCart={handleAddToCart}
                    onAskAI={handleAskAIAboutProduct}
                  />
                )
              })
            ) : (
              !error && (
                <div className="col-span-full py-16 px-4 text-center bg-white rounded-3xl border border-slate-200/80 shadow-2xs">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3 text-2xl">
                    🔍
                  </div>
                  <p className="font-bold text-lg text-slate-900">No matching products found</p>
                  <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                    Try adjusting your filters, searching a different keyword, or let our AI Copilot find alternatives for you.
                  </p>
                  <div className="mt-5 flex items-center justify-center gap-3">
                    <Link
                      to="/"
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
                    >
                      View All Products
                    </Link>
                    <button
                      onClick={() =>
                        askAI(
                          searchTerm
                            ? `Help me find products similar to "${searchTerm}"`
                            : 'Show me your most popular products'
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-colors cursor-pointer"
                    >
                      <SparkleIcon className="w-3.5 h-3.5 text-amber-300" />
                      <span>Ask AI Copilot</span>
                    </button>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Pagination */}
          {!loading && !error && displayedProducts.length > 0 && (
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
        </section>
      </main>

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-slate-900 text-white text-xs font-semibold rounded-full shadow-xl border border-slate-700 flex items-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  )
}
