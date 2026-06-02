/**
 * ProductDetail — /product/:id
 *
 * Amazon-style two-column layout:
 *   Left   — image gallery (primary image or placeholder)
 *   Right  — product info, variant chips, Add to Cart, Add to Wishlist
 *
 * Below the fold:
 *   Reviews section  — star ratings, write-review form (buyers only)
 *   Q&A section      — question list, ask-a-question form (buyers only)
 *
 * API: GET /user/product/detail/:id  (requires IsAuthenticated)
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Header from '../components/Header'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatPrice(price) {
  const n = parseFloat(price)
  if (isNaN(n)) return price
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function pseudoColor(str = '') {
  const palette = ['#dbeafe', '#fce7f3', '#d1fae5', '#fef3c7', '#ede9fe', '#fee2e2', '#cffafe']
  let h = 0
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return palette[Math.abs(h) % palette.length]
}

// ─────────────────────────────────────────────────────────────────────────────
// Star icons
// ─────────────────────────────────────────────────────────────────────────────

function StarFilled({ className = 'w-4 h-4' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#FF9900" className={className}>
      <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clipRule="evenodd" />
    </svg>
  )
}

function StarEmpty({ className = 'w-4 h-4' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20" strokeWidth={1.5} stroke="#FF9900" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 0-1.037 0l-1.83 4.401-4.753.381c-.385.031-.54.507-.248.75l3.619 3.102-1.106 4.637a.563.563 0 0 0 .836.627L10 15.3l4.07 2.197a.563.563 0 0 0 .836-.628l-1.106-4.636 3.618-3.103a.563.563 0 0 0-.247-.75l-4.753-.38-1.83-4.402Z" />
    </svg>
  )
}

function StarRating({ rating, max = 5, size = 'w-4 h-4' }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) =>
        i < Math.round(rating)
          ? <StarFilled key={i} className={size} />
          : <StarEmpty key={i} className={size} />
      )}
    </span>
  )
}

/** Interactive star picker for the review form */
function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(0)
  const display = hovered || value
  return (
    <span className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          aria-label={`${n} star`}
          className="focus:outline-none"
        >
          {n <= display
            ? <StarFilled className="w-6 h-6 cursor-pointer" />
            : <StarEmpty className="w-6 h-6 cursor-pointer" />}
        </button>
      ))}
      {value > 0 && (
        <span className="text-sm text-gray-500 ml-1">{value} / 5</span>
      )}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-[420px] flex-shrink-0 h-96 bg-gray-200 rounded-lg" />
        <div className="flex-1 space-y-4 py-2">
          <div className="h-5 bg-gray-200 rounded w-1/3" />
          <div className="h-8 bg-gray-200 rounded w-4/5" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-10 bg-gray-200 rounded w-1/3" />
          <div className="h-20 bg-gray-200 rounded" />
          <div className="h-12 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section wrapper (reused for Reviews and Q&A)
// ─────────────────────────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="border-t border-gray-200 pt-8 mt-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-5">{title}</h2>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Reviews
// ─────────────────────────────────────────────────────────────────────────────

function ReviewCard({ review }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-1">
        <StarRating rating={review.rating} />
        {review.is_verified_purchase && (
          <span className="text-[11px] font-medium text-[#007600] bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
            ✓ Verified Purchase
          </span>
        )}
      </div>
      {review.review_text && (
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">{review.review_text}</p>
      )}
      {review.review_image && (
        <img
          src={review.review_image}
          alt="Review"
          className="mt-2 max-h-32 rounded border border-gray-200 object-cover"
        />
      )}
    </div>
  )
}

function WriteReviewForm({ productId, onSuccess }) {
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (rating === 0) { setError('Please select a star rating.'); return }
    setLoading(true)
    setError('')
    try {
      await client.post(`/user/product/detail/review/?q=${productId}`, {
        rating,
        review_text: text,
      })
      setSuccess(true)
      setRating(0)
      setText('')
      onSuccess?.()
    } catch (err) {
      const data = err.response?.data
      const msg = data?.non_field_errors?.[0]
        || data?.detail
        || data?.error
        || 'Could not submit review. Try again.'
      setError(Array.isArray(msg) ? msg[0] : msg)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-300 rounded-lg px-4 py-3 text-sm text-green-800 font-medium">
        ✓ Your review was submitted!
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3"
    >
      <p className="font-semibold text-gray-800 text-sm">Write a customer review</p>

      <div>
        <label className="block text-xs text-gray-600 mb-1 font-medium">Overall rating</label>
        <StarPicker value={rating} onChange={setRating} />
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1 font-medium">Review (optional)</label>
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What did you like or dislike?"
          className="w-full px-3 py-2 text-sm border border-gray-400 rounded outline-none focus:border-[#e77600] focus:ring-[3px] focus:ring-[rgba(228,121,17,0.5)] resize-none"
        />
      </div>

      {error && <p className="text-xs text-red-600">⚠ {error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="px-5 py-2 rounded text-sm font-medium border border-[#a88734] bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b] hover:from-[#f5d78e] hover:to-[#eeb933] text-gray-900 disabled:opacity-60 transition-all"
      >
        {loading ? 'Submitting…' : 'Submit review'}
      </button>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Q&A
// ─────────────────────────────────────────────────────────────────────────────

function QuestionCard({ qa }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-2">
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 mt-0.5 text-[11px] font-bold uppercase tracking-wide text-[#c7511f] bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">Q</span>
        <p className="text-sm text-gray-800">{qa.question}</p>
      </div>
      {qa.answer ? (
        <div className="flex items-start gap-2 pl-1">
          <span className="flex-shrink-0 mt-0.5 text-[11px] font-bold uppercase tracking-wide text-[#007600] bg-green-50 border border-green-200 rounded px-1.5 py-0.5">A</span>
          <p className="text-sm text-gray-700">{qa.answer}</p>
        </div>
      ) : (
        <p className="text-xs text-gray-400 pl-6 italic">No answer yet</p>
      )}
    </div>
  )
}

function AskQuestionForm({ productId, onSuccess }) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!question.trim()) { setError('Please enter a question.'); return }
    setLoading(true)
    setError('')
    try {
      await client.post(`/user/product/customer-qxn/?q=${productId}`, {
        question: question.trim(),
      })
      setSuccess(true)
      setQuestion('')
      onSuccess?.()
    } catch (err) {
      const data = err.response?.data
      setError(data?.detail || data?.error || 'Could not submit question. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-300 rounded-lg px-4 py-3 text-sm text-green-800 font-medium">
        ✓ Your question was submitted!
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={question}
        onChange={(e) => { setQuestion(e.target.value); setError('') }}
        placeholder="Ask something about this product…"
        className={[
          'flex-1 px-3 py-2 text-sm border rounded outline-none',
          'focus:border-[#e77600] focus:ring-[3px] focus:ring-[rgba(228,121,17,0.5)]',
          error ? 'border-red-500' : 'border-gray-400',
        ].join(' ')}
      />
      <button
        type="submit"
        disabled={loading}
        className="flex-shrink-0 px-4 py-2 rounded text-sm font-medium border border-[#a88734] bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b] hover:from-[#f5d78e] hover:to-[#eeb933] text-gray-900 disabled:opacity-60 transition-all whitespace-nowrap"
      >
        {loading ? '…' : 'Ask'}
      </button>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, isBuyer, authReady } = useAuth()
  const { addToCart } = useCart()

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Variant selection
  const [selectedColor, setSelectedColor] = useState(null)
  const [selectedSize, setSelectedSize] = useState(null)

  // Wishlist toggle state
  const [wishlisted, setWishlisted] = useState(false)
  const [wishlistLoading, setWishlistLoading] = useState(false)

  // Cart action
  const [cartLoading, setCartLoading] = useState(false)

  // Toast
  const [toast, setToast] = useState({ msg: '', type: 'success' })

  // Gallery state
  const [selectedMedia, setSelectedMedia] = useState(null) // { image_url, video_url, alt_text }
  const [fullscreen, setFullscreen] = useState(false)

  // ── Fetch product ──────────────────────────────────────────────────
  const fetchProduct = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await client.get(`/user/product/detail/${id}`)
      setProduct(data)
    } catch (err) {
      if (err.response?.status === 401) {
        navigate(`/login?next=/product/${id}`, { replace: true })
      } else if (err.response?.status === 404) {
        setError('Product not found.')
      } else {
        setError('Failed to load product. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    fetchProduct()
  }, [fetchProduct])

  // ── Check wishlist status (buyers only, after auth is ready) ──────
  useEffect(() => {
    if (!authReady || !isBuyer || !id) return
    client
      .get('/user/whishlist/')
      .then(({ data }) => {
        const ids = (Array.isArray(data) ? data : []).map((item) => {
          const url = item.product_detail ?? item.product ?? ''
          const parts = String(url).split('/')
          return parseInt(parts[parts.length - 1], 10)
        })
        setWishlisted(ids.includes(Number(id)))
      })
      .catch(() => {})
  }, [authReady, isBuyer, id])

  // ── Variant helpers ────────────────────────────────────────────────

  const variants = product?.variants ?? []

  // Distinct colors and sizes from variant list
  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))]
  const sizes  = [...new Set(variants.map((v) => v.size).filter(Boolean))]

  /**
   * Find the variant that matches the current color+size selection.
   * Falls back gracefully when only one dimension exists.
   */
  const matchedVariant = variants.find((v) => {
    const colorOk = colors.length === 0 || !selectedColor || v.color === selectedColor
    const sizeOk  = sizes.length === 0  || !selectedSize  || v.size  === selectedSize
    return colorOk && sizeOk
  }) ?? null

  const displayPrice = matchedVariant?.price ?? product?.base_price
  const displayStock = matchedVariant?.stock_qty ?? product?.stock_qty

  // ── Cart action ────────────────────────────────────────────────────

  function requireBuyer() {
    if (!isAuthenticated) { navigate(`/login?next=/product/${id}`); return false }
    if (!isBuyer) { showToast('Only buyers can perform this action.', 'error'); return false }
    return true
  }

  async function handleAddToCart() {
    if (!requireBuyer()) return
    setCartLoading(true)
    try {
      const payload = {
        product: Number(id),
        quantity: 1,
        ...(matchedVariant ? { product_variant: matchedVariant.id } : {}),
      }
      await addToCart(payload.product, payload.quantity)
      showToast('Added to cart!', 'success')
    } catch {
      showToast('Could not add to cart. Try again.', 'error')
    } finally {
      setCartLoading(false)
    }
  }

  // ── Wishlist action ────────────────────────────────────────────────

  async function handleWishlistToggle() {
    if (!requireBuyer()) return
    setWishlistLoading(true)
    try {
      if (wishlisted) {
        await client.delete(`/user/whishlist/?q=${id}`)
        setWishlisted(false)
        showToast('Removed from wishlist.', 'success')
      } else {
        await client.post(`/user/whishlist/?q=${id}`)
        setWishlisted(true)
        showToast('Added to wishlist!', 'success')
      }
    } catch {
      showToast('Could not update wishlist.', 'error')
    } finally {
      setWishlistLoading(false)
    }
  }

  // ── Toast ──────────────────────────────────────────────────────────

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: 'success' }), 2500)
  }

  // ── Primary image / gallery init ───────────────────────────────────

  const allMedia = product?.images ?? []
  const primaryImage =
    allMedia.find((i) => i.is_primary) ?? allMedia[0] ?? null

  // Initialise selectedMedia once when the product first loads
  useEffect(() => {
    if (primaryImage && !selectedMedia) {
      setSelectedMedia(primaryImage)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryImage])

  // ── Average rating ─────────────────────────────────────────────────

  const reviews = product?.reviews ?? []
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#eaeded] flex flex-col">
      <Header />

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-3 sm:px-6 py-6">
        {/* Breadcrumb */}
        <nav className="text-xs text-gray-500 mb-4 flex items-center gap-1">
          <Link to="/" className="hover:text-[#c7511f] hover:underline">Home</Link>
          <span>›</span>
          {product?.category_name && (
            <>
              <Link
                to={`/?ct=${encodeURIComponent(product.category_name)}`}
                className="hover:text-[#c7511f] hover:underline"
              >
                {product.category_name}
              </Link>
              <span>›</span>
            </>
          )}
          <span className="text-gray-700 truncate max-w-[200px]">{product?.product_name}</span>
        </nav>

        {/* Loading skeleton */}
        {loading && <Skeleton />}

        {/* Error state */}
        {!loading && error && (
          <div className="py-20 text-center">
            <p className="text-4xl mb-3">😕</p>
            <p className="text-lg font-semibold text-gray-700 mb-2">{error}</p>
            <Link to="/" className="text-sm text-[#007185] hover:underline">← Back to home</Link>
          </div>
        )}

        {/* ── Product detail ───────────────────────────────────────── */}
        {!loading && !error && product && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            {/* Two-column grid */}
            <div className="flex flex-col lg:flex-row gap-10">

              {/* ── Left: Image gallery ──────────────────────────── */}
              <div className="lg:w-[420px] flex-shrink-0">

                {/* Main frame */}
                <div
                  className="relative rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center group"
                  style={{
                    height: 420,
                    backgroundColor: selectedMedia?.image_url || selectedMedia?.video_url
                      ? '#fff'
                      : pseudoColor(product.product_name),
                  }}
                >
                  {/* Video player */}
                  {selectedMedia?.video_url ? (
                    <video
                      key={selectedMedia.video_url}
                      src={selectedMedia.video_url}
                      controls
                      className="w-full h-full object-contain"
                    />
                  ) : selectedMedia?.image_url ? (
                    /* Product image — click to fullscreen */
                    <img
                      src={selectedMedia.image_url}
                      alt={selectedMedia.alt_text || product.product_name}
                      className="w-full h-full object-contain cursor-zoom-in"
                      onClick={() => setFullscreen(true)}
                    />
                  ) : (
                    /* Letter placeholder */
                    <span className="text-8xl font-extrabold text-gray-300 select-none">
                      {(product.product_name ?? '?')[0].toUpperCase()}
                    </span>
                  )}

                  {/* Fullscreen button (top-right, appears on hover) */}
                  {selectedMedia?.image_url && !selectedMedia?.video_url && (
                    <button
                      onClick={() => setFullscreen(true)}
                      className="absolute top-2 right-2 p-1.5 rounded bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
                      aria-label="View fullscreen"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M1 3.5A1.5 1.5 0 0 1 2.5 2h4A1.5 1.5 0 0 1 8 3.5v1A1.5 1.5 0 0 1 6.5 6h-4A1.5 1.5 0 0 1 1 4.5v-1ZM12 3.5A1.5 1.5 0 0 1 13.5 2h4A1.5 1.5 0 0 1 19 3.5v1A1.5 1.5 0 0 1 17.5 6h-4A1.5 1.5 0 0 1 12 4.5v-1ZM1 13.5A1.5 1.5 0 0 1 2.5 12h4a1.5 1.5 0 0 1 1.5 1.5v1A1.5 1.5 0 0 1 6.5 18h-4A1.5 1.5 0 0 1 1 16.5v-1ZM12 13.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-1Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Thumbnail strip */}
                {allMedia.length > 0 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-thin">
                    {allMedia.map((media, i) => {
                      const isSelected = selectedMedia === media ||
                        (selectedMedia?.image_url === media.image_url && selectedMedia?.video_url === media.video_url)
                      const isVideo = !!media.video_url && !media.image_url
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedMedia(media)}
                          className={[
                            'flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden focus:outline-none transition-all',
                            isSelected
                              ? 'border-[#e77600] shadow-md'
                              : 'border-gray-200 hover:border-[#e77600]/60',
                          ].join(' ')}
                          aria-label={isVideo ? 'Play video' : `View image ${i + 1}`}
                        >
                          <div className="relative w-full h-full bg-gray-100">
                            {media.image_url ? (
                              <img
                                src={media.image_url}
                                alt={media.alt_text || `Image ${i + 1}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-7 h-7 opacity-80">
                                  <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                            {/* Video play overlay on image thumbnails that have video */}
                            {media.video_url && media.image_url && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                                  <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── Fullscreen modal ──────────────────────────────── */}
              {fullscreen && selectedMedia?.image_url && (
                <div
                  className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
                  onClick={() => setFullscreen(false)}
                >
                  <button
                    className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
                    onClick={() => setFullscreen(false)}
                    aria-label="Close fullscreen"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                      <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <img
                    src={selectedMedia.image_url}
                    alt={selectedMedia.alt_text || product.product_name}
                    className="max-w-full max-h-full object-contain rounded shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}

              {/* ── Right: Info ──────────────────────────────────── */}
              <div className="flex-1 min-w-0">

                {/* Seller */}
                <p className="text-xs text-gray-500 mb-1">
                  by{' '}
                  <span className="text-[#007185] font-medium">{product.seller_name}</span>
                </p>

                {/* Product name */}
                <h1 className="text-2xl font-semibold text-gray-900 leading-snug mb-2">
                  {product.product_name}
                </h1>

                {/* Brand · Category */}
                <p className="text-sm text-gray-500 mb-3">
                  <span className="font-medium text-gray-700">{product.brand_name}</span>
                  {product.category_name && (
                    <> &nbsp;·&nbsp;
                      <Link
                        to={`/?ct=${encodeURIComponent(product.category_name)}`}
                        className="text-[#007185] hover:underline"
                      >
                        {product.category_name}
                      </Link>
                    </>
                  )}
                </p>

                {/* Rating summary */}
                {reviews.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <StarRating rating={avgRating} size="w-5 h-5" />
                    <span className="text-sm text-[#007185]">
                      {avgRating.toFixed(1)} ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
                    </span>
                  </div>
                )}

                <hr className="border-gray-200 mb-4" />

                {/* Price */}
                <div className="mb-4">
                  <span className="text-3xl font-semibold text-[#B12704]">
                    {formatPrice(displayPrice)}
                  </span>
                  {matchedVariant && product.base_price !== matchedVariant.price && (
                    <span className="ml-3 text-sm text-gray-400 line-through">
                      {formatPrice(product.base_price)}
                    </span>
                  )}
                </div>

                {/* Stock badge */}
                <div className="mb-5">
                  {displayStock > 10 ? (
                    <span className="text-[#007600] font-medium text-sm">In Stock</span>
                  ) : displayStock > 0 ? (
                    <span className="text-[#c7511f] font-medium text-sm">
                      Only {displayStock} left in stock — order soon.
                    </span>
                  ) : (
                    <span className="text-red-600 font-medium text-sm">Out of Stock</span>
                  )}
                </div>

                {/* ── Variant selectors ─────────────────────── */}
                {colors.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      Color:{' '}
                      <span className="font-normal text-gray-500">
                        {selectedColor ?? 'Select a color'}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {colors.map((color) => (
                        <button
                          key={color}
                          onClick={() => setSelectedColor(color === selectedColor ? null : color)}
                          className={[
                            'px-3 py-1.5 rounded border text-sm transition-all',
                            selectedColor === color
                              ? 'border-[#e77600] bg-orange-50 text-[#c7511f] font-medium ring-2 ring-[#e77600]/30'
                              : 'border-gray-300 text-gray-700 hover:border-[#e77600] hover:text-[#c7511f]',
                          ].join(' ')}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {sizes.length > 0 && (
                  <div className="mb-5">
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      Size:{' '}
                      <span className="font-normal text-gray-500">
                        {selectedSize ?? 'Select a size'}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {sizes.map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(size === selectedSize ? null : size)}
                          className={[
                            'px-3 py-1.5 rounded border text-sm transition-all',
                            selectedSize === size
                              ? 'border-[#e77600] bg-orange-50 text-[#c7511f] font-medium ring-2 ring-[#e77600]/30'
                              : 'border-gray-300 text-gray-700 hover:border-[#e77600] hover:text-[#c7511f]',
                          ].join(' ')}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {product.description && (
                  <p className="text-sm text-gray-600 leading-relaxed mb-6 border-t border-gray-100 pt-4">
                    {product.description}
                  </p>
                )}

                {/* ── CTA buttons ───────────────────────────── */}
                <div className="flex flex-col sm:flex-row gap-3 max-w-sm">
                  {/* Add to Cart */}
                  <button
                    onClick={handleAddToCart}
                    disabled={cartLoading || displayStock === 0}
                    className={[
                      'flex-1 py-3 px-6 rounded-full text-sm font-medium transition-all',
                      'border border-[#a88734]',
                      'bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b]',
                      'hover:from-[#f5d78e] hover:to-[#eeb933]',
                      'text-gray-900 shadow-sm',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'focus:outline-none focus:ring-2 focus:ring-[#e77600]',
                    ].join(' ')}
                  >
                    {cartLoading ? 'Adding…' : displayStock === 0 ? 'Out of Stock' : 'Add to Cart'}
                  </button>

                  {/* Add to Wishlist */}
                  <button
                    onClick={handleWishlistToggle}
                    disabled={wishlistLoading}
                    className={[
                      'flex-1 py-3 px-6 rounded-full text-sm font-medium transition-all',
                      'border shadow-sm',
                      wishlisted
                        ? 'border-red-400 bg-red-50 text-red-600 hover:bg-red-100'
                        : 'border-gray-400 bg-gradient-to-b from-[#f7f8f8] to-[#e7e9ec] text-gray-900 hover:from-[#e7e9ec] hover:to-[#d9dce1]',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'focus:outline-none focus:ring-2 focus:ring-[#e77600]',
                    ].join(' ')}
                  >
                    {wishlistLoading
                      ? '…'
                      : wishlisted
                      ? '♥ Wishlisted'
                      : '♡ Add to Wishlist'}
                  </button>
                </div>

                {/* SKU */}
                {product.sku && (
                  <p className="mt-4 text-xs text-gray-400">SKU: {product.sku}</p>
                )}
              </div>
            </div>

            {/* ── Reviews ───────────────────────────────────────────── */}
            <Section title={`Customer Reviews${reviews.length > 0 ? ` (${reviews.length})` : ''}`}>
              {reviews.length > 0 ? (
                <div className="space-y-3 mb-6">
                  {reviews.map((r, i) => <ReviewCard key={i} review={r} />)}
                </div>
              ) : (
                <p className="text-sm text-gray-500 mb-5">
                  No reviews yet. Be the first to review this product!
                </p>
              )}

              {isBuyer && (
                <WriteReviewForm
                  productId={id}
                  onSuccess={fetchProduct}
                />
              )}

              {!isAuthenticated && (
                <p className="text-sm text-gray-500">
                  <Link to={`/login?next=/product/${id}`} className="text-[#007185] hover:underline font-medium">
                    Sign in
                  </Link>{' '}
                  to write a review.
                </p>
              )}
            </Section>

            {/* ── Q&A ───────────────────────────────────────────────── */}
            <Section title="Questions & Answers">
              {(product.questions ?? []).length > 0 ? (
                <div className="space-y-3 mb-6">
                  {product.questions.map((qa, i) => (
                    <QuestionCard key={i} qa={qa} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 mb-5">
                  No questions yet. Have something to ask?
                </p>
              )}

              {isBuyer && (
                <div className="mt-2">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Ask a question</p>
                  <AskQuestionForm productId={id} onSuccess={fetchProduct} />
                </div>
              )}

              {!isAuthenticated && (
                <p className="text-sm text-gray-500">
                  <Link to={`/login?next=/product/${id}`} className="text-[#007185] hover:underline font-medium">
                    Sign in
                  </Link>{' '}
                  to ask a question.
                </p>
              )}
            </Section>
          </div>
        )}
      </main>

      {/* Toast */}
      {toast.msg && (
        <div
          className={[
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full shadow-xl text-sm font-medium transition-all',
            toast.type === 'error'
              ? 'bg-red-700 text-white'
              : 'bg-gray-900 text-white',
          ].join(' ')}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
