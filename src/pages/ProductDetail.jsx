/**
 * ProductDetail — /product/:id
 *
 * Modern widescreen two-column layout:
 *   Left   — interactive media gallery (images + videos + fullscreen lightbox)
 *   Right  — product info, variant selectors, Add to Cart, Wishlist, and
 *            an embedded "Ask AI Copilot about this product" action card.
 *
 * Below the fold (optimized with .cv-auto content-visibility):
 *   Reviews section  — rating breakdown + customer review cards + S3 media upload form
 *   Q&A section      — community questions & answers + ask-a-question form
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Header from '../components/Header'
import { SparkleIcon } from '../components/AIChatWidget'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useAIChat } from '../context/AIChatContext'

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatPrice(price) {
  const n = parseFloat(price)
  if (isNaN(n)) return price
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function pseudoColor(str = '') {
  const palette = ['#eef2ff', '#fae8ff', '#ecfdf5', '#fffbeb', '#f5f3ff', '#fff1f2', '#ecfeff']
  let h = 0
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return palette[Math.abs(h) % palette.length]
}

// ─────────────────────────────────────────────────────────────────────────────
// Star icons
// ─────────────────────────────────────────────────────────────────────────────

function StarFilled({ className = 'w-4 h-4' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#f59e0b" className={className}>
      <path
        fillRule="evenodd"
        d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function StarEmpty({ className = 'w-4 h-4' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20" strokeWidth={1.5} stroke="#f59e0b" className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 0 0-1.037 0l-1.83 4.401-4.753.381c-.385.031-.54.507-.248.75l3.619 3.102-1.106 4.637a.563.563 0 0 0 .836.627L10 15.3l4.07 2.197a.563.563 0 0 0 .836-.628l-1.106-4.636 3.618-3.103a.563.563 0 0 0-.247-.75l-4.753-.38-1.83-4.402Z"
      />
    </svg>
  )
}

function StarRating({ rating, max = 5, size = 'w-4 h-4' }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) =>
        i < Math.round(rating) ? <StarFilled key={i} className={size} /> : <StarEmpty key={i} className={size} />
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
          className="focus:outline-none cursor-pointer"
        >
          {n <= display ? <StarFilled className="w-6 h-6" /> : <StarEmpty className="w-6 h-6" />}
        </button>
      ))}
      {value > 0 && <span className="text-xs font-semibold text-slate-500 ml-1.5">{value} / 5</span>}
    </span>
  )
}

function sanitizeFilename(file) {
  if (!file) return file
  const safeName = file.name
    .replace(/\s+/g, '_')
    .replace(/[%#+?&=<>{}|\\^~[\]`]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  if (safeName === file.name) return file
  return new File([file], safeName, { type: file.type, lastModified: file.lastModified })
}

function ShareButton({ productName, showToast }) {
  const handleShare = async () => {
    const shareData = {
      title: productName,
      text: `Check out ${productName} on Chatram!`,
      url: window.location.href,
    }

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData)
        showToast('Shared successfully!', 'success')
      } catch (err) {
        if (err.name !== 'AbortError') {
          copyToClipboard()
        }
      }
    } else {
      copyToClipboard()
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => showToast('Link copied to clipboard!', 'success'))
      .catch(() => showToast('Failed to copy link.', 'error'))
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="w-9 h-9 text-stone-500 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all border border-stone-200/90 shadow-2xs flex items-center justify-center bg-white shrink-0 cursor-pointer"
      title="Share product"
      aria-label="Share product"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
        />
      </svg>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 animate-pulse">
      <div className="flex flex-col lg:flex-row gap-10">
        <div className="lg:w-[480px] shrink-0 h-[440px] bg-slate-100 rounded-2xl" />
        <div className="flex-1 space-y-4 py-2">
          <div className="h-4 bg-slate-100 rounded-md w-1/4" />
          <div className="h-8 bg-slate-100 rounded-md w-4/5" />
          <div className="h-4 bg-slate-100 rounded-md w-1/3" />
          <div className="h-10 bg-slate-100 rounded-md w-1/4" />
          <div className="h-24 bg-slate-100 rounded-xl" />
          <div className="h-12 bg-slate-100 rounded-xl w-2/3" />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────────────────────────────────────

function Section({ title, subtitle, children }) {
  return (
    <section className="border-t border-slate-200/80 pt-8 mt-10 cv-auto">
      <div className="mb-6">
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Reviews
// ─────────────────────────────────────────────────────────────────────────────

function ReviewCard({ review, currentUser, onDelete, onUpdate }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [modalMedia, setModalMedia] = useState(null)

  const [isEditing, setIsEditing] = useState(false)
  const [editRating, setEditRating] = useState(review?.rating || 0)
  const [editText, setEditText] = useState(review?.review_text || '')
  const [isUpdating, setIsUpdating] = useState(false)

  if (!review) return null

  const safeMedia = Array.isArray(review.media) ? review.media : []
  const mediaImages = safeMedia.filter((m) => m && m.media_type === 'image')
  const mediaVideo = safeMedia.find((m) => m && m.media_type === 'video')

  const allMedia = [...mediaImages]
  if (mediaVideo) allMedia.push(mediaVideo)

  if (allMedia.length === 0) {
    if (review.review_image) allMedia.push({ id: 'img', url: review.review_image, media_type: 'image' })
    if (review.review_video) allMedia.push({ id: 'vid', url: review.review_video, media_type: 'video' })
  }

  const isOwner = Boolean(
    currentUser &&
      ((review.user && currentUser.id === review.user?.id) ||
        currentUser.username === review.user ||
        currentUser.email === review.user)
  )

  async function handleDelete() {
    if (!window.confirm('Are you sure you want to delete your review?')) return
    setIsDeleting(true)
    try {
      await onDelete(review)
    } catch {
      alert('Failed to delete review.')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleUpdateSubmit() {
    if (!editRating || !editText.trim()) {
      alert('Rating and text are required.')
      return
    }
    setIsUpdating(true)
    try {
      await onUpdate(editText, editRating)
      setIsEditing(false)
    } catch {
      // handled by parent
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="border border-slate-200/80 rounded-2xl p-4 sm:p-5 bg-white space-y-2.5 shadow-2xs relative">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          {isEditing ? (
            <StarPicker value={editRating} onChange={setEditRating} />
          ) : (
            <StarRating rating={review.rating || 0} />
          )}
          {review.is_verified_purchase && !isEditing && (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/80">
              ✓ Verified Purchase
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {review.created_at && !isEditing && (
            <span className="text-xs text-slate-400">
              {new Date(review.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          )}
          {isOwner && onUpdate && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-orange-600 hover:bg-orange-50 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              title="Edit Review"
            >
              Edit
            </button>
          )}
          {isOwner && onDelete && !isEditing && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
              title="Delete Review"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="w-4 h-4">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2.5 mt-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full border border-stone-300 rounded-xl p-3 text-sm focus:ring-3 focus:ring-stone-900/15 focus:border-stone-900 outline-none"
            rows="3"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setIsEditing(false)
                setEditText(review?.review_text || '')
                setEditRating(review?.rating || 0)
              }}
              className="px-3.5 py-1.5 text-xs text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateSubmit}
              disabled={isUpdating}
              className="px-4 py-1.5 text-xs bg-stone-900 hover:bg-orange-600 text-white rounded-xl font-semibold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isUpdating ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      ) : (
        review.review_text && <p className="text-sm text-slate-700 leading-relaxed">{review.review_text}</p>
      )}

      {allMedia.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {allMedia.slice(0, 4).map((m, i) => {
            if (!m) return null
            const isVideo = m.media_type === 'video'
            const isLastVisible = i === 3 && allMedia.length > 4
            return (
              <div
                key={m.id || `media-${i}`}
                className="relative h-20 w-20 shrink-0 cursor-pointer rounded-xl overflow-hidden border border-slate-200 hover:opacity-90 transition-opacity"
                onClick={() => setModalMedia(m)}
              >
                {isVideo ? (
                  <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white opacity-80">
                      <path
                        fillRule="evenodd"
                        d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                ) : (
                  <img src={m.url || ''} alt="Customer review" className="w-full h-full object-cover" loading="lazy" />
                )}

                {isLastVisible && (
                  <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">+{allMedia.length - 4}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modalMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4"
          onClick={() => setModalMedia(null)}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex justify-center" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute -top-10 right-0 text-white hover:text-slate-300 cursor-pointer"
              onClick={() => setModalMedia(null)}
            >
              ✕ Close
            </button>
            {modalMedia.media_type === 'video' ? (
              <video src={modalMedia.url} controls autoPlay className="max-w-full max-h-[85vh] rounded-2xl" />
            ) : (
              <img src={modalMedia.url} alt="Full view" className="max-w-full max-h-[85vh] object-contain rounded-2xl" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const ACCEPTED_REVIEW_MEDIA =
  'image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime'

function WriteReviewForm({ productId, onSuccess }) {
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [mediaFiles, setMediaFiles] = useState([])
  const fileRef = useRef(null)

  function addFiles(e) {
    const picked = Array.from(e.target.files ?? []).map(sanitizeFilename)
    if (fileRef.current) fileRef.current.value = ''
    setMediaFiles((prev) => {
      const next = [...prev]
      for (const file of picked) {
        const isVid = file.type.startsWith('video/')
        const imgs = next.filter((f) => !f.file.type.startsWith('video/')).length
        const vids = next.filter((f) => f.file.type.startsWith('video/')).length
        if (isVid && vids >= 1) {
          setError('Only 1 video allowed per review.')
          continue
        }
        if (!isVid && imgs >= 5) {
          setError('Maximum 5 images per review.')
          continue
        }
        next.push({ id: Math.random().toString(36).slice(2), file, status: 'queued', error: null })
      }
      return next
    })
    setError('')
  }

  function removeFile(id) {
    setMediaFiles((prev) => prev.filter((f) => f.id !== id))
  }

  function patchFile(id, delta) {
    setMediaFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...delta } : f)))
  }

  async function uploadMedia(file, reviewId, order) {
    const isVideo = file.type.startsWith('video/')
    const fileType = isVideo ? 'videos' : 'images'
    const { data: presign } = await client.get('/user/review/media/', {
      params: { file_name: file.name, file_type: fileType, review_id: reviewId },
    })
    const putRes = await fetch(presign.upload_url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    })
    if (!putRes.ok) throw new Error(`S3 upload failed (${putRes.status})`)
    await client.post('/user/review/media/', {
      review_id: reviewId,
      url: presign.file_url,
      media_type: isVideo ? 'video' : 'image',
      display_order: order,
    })
    return presign.file_url
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (rating === 0) {
      setError('Please select a star rating.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data: reviewData } = await client.post(
        `/user/product/detail/review/?q=${productId}`,
        { rating, review_text: text }
      )
      const reviewId = reviewData.id
      for (let i = 0; i < mediaFiles.length; i++) {
        const entry = mediaFiles[i]
        patchFile(entry.id, { status: 'uploading' })
        try {
          await uploadMedia(entry.file, reviewId, i + 1)
          patchFile(entry.id, { status: 'done' })
        } catch (uploadErr) {
          patchFile(entry.id, { status: 'error', error: uploadErr.message })
        }
      }
      setSuccess(true)
      setRating(0)
      setText('')
      setMediaFiles([])
      onSuccess?.()
    } catch (err) {
      const data = err.response?.data
      const msg =
        data?.non_field_errors?.[0] || data?.detail || data?.error || 'Could not submit review.'
      setError(Array.isArray(msg) ? msg[0] : msg)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3.5 text-sm text-emerald-800 font-semibold">
        ✓ Thank you! Your review has been published.
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4"
    >
      <p className="font-bold text-slate-900 text-sm">Write a Customer Review</p>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Overall rating</label>
        <StarPicker value={rating} onChange={setRating} />
      </div>

      <div>
        <label className="block text-xs font-semibold text-stone-600 mb-1.5">
          Your review (optional)
        </label>
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What did you like or dislike about this product?"
          className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-xl outline-none focus:border-stone-900 focus:ring-3 focus:ring-stone-900/15 resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
          Add photos or video
        </label>
        <div className="flex flex-col gap-2">
          <input
            type="file"
            ref={fileRef}
            onChange={addFiles}
            multiple
            accept={ACCEPTED_REVIEW_MEDIA}
            className="hidden"
            id="review-media-input"
          />
          <label
            htmlFor="review-media-input"
            className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-all w-fit"
          >
            <span>📷 Upload Photos / Video</span>
          </label>
          <p className="text-[11px] text-slate-400">
            Up to 5 images and 1 video (JPG, PNG, WEBP, MP4, WEBM)
          </p>
        </div>

        {mediaFiles.length > 0 && (
          <div className="mt-3 space-y-2">
            {mediaFiles.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between border border-slate-200 rounded-xl p-2.5 bg-white text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="font-semibold text-slate-700 truncate max-w-[200px]">
                    {m.file.name}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({(m.file.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {m.status === 'queued' && <span className="text-slate-400 font-medium">Queued</span>}
                  {m.status === 'uploading' && (
                    <span className="text-amber-600 font-medium animate-pulse">Uploading…</span>
                  )}
                  {m.status === 'done' && <span className="text-emerald-600 font-medium">✓ Ready</span>}
                  {m.status === 'error' && (
                    <span className="text-rose-600 font-medium" title={m.error}>
                      ⚠ Error
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(m.id)}
                    disabled={loading}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-xs font-medium text-rose-600">⚠ {error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="px-5 py-2.5 rounded-xl text-xs font-bold bg-stone-900 hover:bg-orange-600 text-white disabled:opacity-60 transition-colors cursor-pointer"
      >
        {loading ? 'Submitting…' : 'Publish Review'}
      </button>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Q&A
// ─────────────────────────────────────────────────────────────────────────────

function QuestionCard({ qa }) {
  return (
    <div className="border border-stone-200/80 rounded-2xl p-4 bg-white space-y-2 shadow-2xs">
      <div className="flex items-start gap-2.5">
        <span className="shrink-0 mt-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-700 bg-orange-50 border border-orange-200/60 rounded-md px-2 py-0.5">
          Q
        </span>
        <p className="text-sm font-semibold text-stone-900">{qa.question}</p>
      </div>
      {qa.answer ? (
        <div className="flex items-start gap-2.5 pl-0.5">
          <span className="shrink-0 mt-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded-md px-2 py-0.5">
            A
          </span>
          <p className="text-sm text-stone-700 leading-relaxed">{qa.answer}</p>
        </div>
      ) : (
        <p className="text-xs text-stone-400 pl-8 italic">Awaiting seller or community response</p>
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
    if (!question.trim()) {
      setError('Please enter a question.')
      return
    }
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
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800 font-semibold">
        ✓ Your question was submitted!
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
      <input
        type="text"
        value={question}
        onChange={(e) => {
          setQuestion(e.target.value)
          setError('')
        }}
        placeholder="Have a question about specifications, warranty, or compatibility?"
        className={[
          'flex-1 px-4 py-2.5 text-sm bg-white border rounded-xl outline-none transition-all',
          'focus:border-stone-900 focus:ring-3 focus:ring-stone-900/15',
          error ? 'border-rose-500' : 'border-stone-300',
        ].join(' ')}
      />
      <button
        type="submit"
        disabled={loading}
        className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-bold bg-stone-900 hover:bg-orange-600 text-white disabled:opacity-60 transition-colors cursor-pointer"
      >
        {loading ? 'Posting…' : 'Post Question'}
      </button>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ProductDetail Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated, isBuyer, authReady } = useAuth()
  const { addToCart } = useCart()
  const { askAI, setPageContext } = useAIChat()

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedColor, setSelectedColor] = useState(null)
  const [selectedSize, setSelectedSize] = useState(null)

  const [wishlisted, setWishlisted] = useState(false)
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const [cartLoading, setCartLoading] = useState(false)
  const [toast, setToast] = useState({ msg: '', type: 'success' })

  const [selectedMedia, setSelectedMedia] = useState(null)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

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

  const handleDeleteReview = async () => {
    try {
      await client.delete(`/user/product/detail/review/?q=${id}`)
      fetchProduct()
    } catch {
      alert('Failed to delete review.')
    }
  }

  const handleUpdateReview = async (review_text, rating) => {
    try {
      await client.patch(`/user/product/detail/review/?q=${id}`, { review_text, rating })
      fetchProduct()
    } catch (err) {
      alert('Failed to update review.')
      throw err
    }
  }

  useEffect(() => {
    fetchProduct()
  }, [fetchProduct])

  // Check wishlist status
  useEffect(() => {
    if (!authReady || !isBuyer || !id) return
    client
      .get('/user/whishlist/')
      .then(({ data }) => {
        const ids = (Array.isArray(data) ? data : []).map((item) => {
          if (item.product?.id) return Number(item.product.id)
          const url = item.product_detail ?? item.product?.product_detail ?? ''
          const parts = String(url).replace(/\/$/, '').split('/')
          return parseInt(parts[parts.length - 1], 10)
        })
        setWishlisted(ids.includes(Number(id)))
      })
      .catch(() => {})
  }, [authReady, isBuyer, id])

  const variants = product?.variants ?? []
  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))]
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))]

  const matchedVariant =
    variants.find((v) => {
      const colorOk = colors.length === 0 || !selectedColor || v.color === selectedColor
      const sizeOk = sizes.length === 0 || !selectedSize || v.size === selectedSize
      return colorOk && sizeOk
    }) ?? null

  const displayPrice = matchedVariant?.price ?? product?.base_price
  const displayStock = matchedVariant?.stock_qty ?? product?.stock_qty

  const reviews = product?.reviews ?? []
  const avgRating =
    reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0

  // Sync active product with AIChatContext so the AI Copilot is context-aware
  useEffect(() => {
    if (!product) return
    setPageContext({
      page: 'product_detail',
      product: {
        id: Number(id),
        name: product.product_name,
        brand: product.brand_name,
        price: displayPrice,
        category: product.category_name,
        avg_rating: avgRating ? Number(avgRating.toFixed(1)) : null,
        review_count: reviews.length,
      },
    })
  }, [product, id, displayPrice, avgRating, reviews.length, setPageContext])

  function requireBuyer() {
    if (!isAuthenticated) {
      navigate(`/login?next=/product/${id}`)
      return false
    }
    if (!isBuyer) {
      showToast('Only buyers can perform this action.', 'error')
      return false
    }
    return true
  }

  async function handleAddToCart() {
    if (!requireBuyer()) return
    setCartLoading(true)
    try {
      await addToCart(Number(id), 1)
      showToast('Added to cart!', 'success')
    } catch {
      showToast('Could not add to cart. Try again.', 'error')
    } finally {
      setCartLoading(false)
    }
  }

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
        showToast('Saved to wishlist!', 'success')
      }
    } catch {
      showToast('Could not update wishlist.', 'error')
    } finally {
      setWishlistLoading(false)
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: 'success' }), 2600)
  }

  const productImages = product?.images ?? []
  const allMedia = [...productImages].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1
    if (!a.is_primary && b.is_primary) return 1
    return 0
  })

  const primaryImage = allMedia[0] ?? null

  useEffect(() => {
    if (primaryImage) {
      setSelectedMedia(primaryImage)
    }
  }, [primaryImage])

  return (
    <div className="min-h-screen bg-[#f7f6f2] flex flex-col">
      <Header />

      <main className="flex-1 max-w-[1440px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <nav className="text-xs font-medium text-stone-500 mb-5 flex items-center gap-1.5 flex-wrap">
          <Link to="/" className="hover:text-orange-600 transition-colors">
            Storefront
          </Link>
          <span className="text-stone-300">/</span>
          {product?.category_name && (
            <>
              <Link
                to={`/?ct=${encodeURIComponent(product.category_name)}`}
                className="hover:text-orange-600 capitalize transition-colors"
              >
                {product.category_name}
              </Link>
              <span className="text-stone-300">/</span>
            </>
          )}
          <span className="text-stone-800 font-semibold truncate max-w-[280px]">
            {product?.product_name}
          </span>
        </nav>

        {loading && <Skeleton />}

        {!loading && error && (
          <div className="py-20 text-center bg-white rounded-3xl border border-stone-200/80 shadow-2xs">
            <p className="text-4xl mb-3">😕</p>
            <p className="text-lg font-bold text-stone-800 mb-2">{error}</p>
            <Link
              to="/"
              className="inline-block mt-2 px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-orange-600 transition-colors"
            >
              ← Back to Storefront
            </Link>
          </div>
        )}

        {!loading && !error && product && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-8 lg:p-10 shadow-2xs">
            {/* Two-column Product Hero */}
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
              {/* ── Left: Media Gallery ────────────────────────────────── */}
              <div className="lg:w-[480px] xl:w-[540px] shrink-0">
                <div
                  className="relative rounded-2xl overflow-hidden border border-slate-200/80 flex items-center justify-center group transition-all duration-300 p-4"
                  style={{
                    height: 460,
                    backgroundColor:
                      selectedMedia?.image_url || selectedMedia?.video_url
                        ? '#ffffff'
                        : pseudoColor(product.product_name),
                  }}
                >
                  {selectedMedia?.video_url ? (
                    <video
                      key={selectedMedia.video_url}
                      src={selectedMedia.video_url}
                      controls
                      className="w-full h-full object-contain"
                    />
                  ) : selectedMedia?.image_url ? (
                    <img
                      src={selectedMedia.image_url}
                      alt={selectedMedia.alt_text || product.product_name}
                      fetchPriority="high"
                      className="w-full h-full object-contain cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.02]"
                      onClick={() => setFullscreen(true)}
                    />
                  ) : (
                    <span className="text-8xl font-extrabold text-slate-300 select-none">
                      {(product.product_name ?? '?')[0].toUpperCase()}
                    </span>
                  )}

                  {selectedMedia?.image_url && !selectedMedia?.video_url && (
                    <button
                      onClick={() => setFullscreen(true)}
                      className="absolute top-3 right-3 px-2.5 py-1.5 rounded-xl bg-slate-900/70 text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-900 flex items-center gap-1 cursor-pointer"
                      aria-label="View fullscreen"
                    >
                      <span>⤢ Zoom</span>
                    </button>
                  )}
                </div>

                {/* Thumbnail Strip */}
                {allMedia.length > 0 && (
                  <div className="flex gap-2.5 mt-3.5 overflow-x-auto pb-1 scrollbar-thin">
                    {allMedia.map((media, i) => {
                      const isSelected =
                        selectedMedia === media ||
                        (selectedMedia?.image_url === media.image_url &&
                          selectedMedia?.video_url === media.video_url)
                      const isVideo = !!media.video_url && !media.image_url
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedMedia(media)}
                          onMouseEnter={() => setSelectedMedia(media)}
                          className={[
                            'shrink-0 w-16 h-16 rounded-xl border-2 overflow-hidden focus:outline-none transition-all cursor-pointer bg-white p-1',
                            isSelected
                              ? 'border-stone-900 shadow-xs ring-2 ring-stone-900/15'
                              : 'border-stone-200 hover:border-stone-400',
                          ].join(' ')}
                          aria-label={isVideo ? 'Play video' : `View image ${i + 1}`}
                        >
                          <div className="relative w-full h-full rounded-lg overflow-hidden bg-slate-50">
                            {media.image_url ? (
                              <img
                                src={media.image_url}
                                alt={media.alt_text || `Thumbnail ${i + 1}`}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white text-xs">
                                ▶
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Fullscreen Lightbox */}
              {fullscreen && selectedMedia?.image_url && (
                <div
                  className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4"
                  onClick={() => setFullscreen(false)}
                >
                  <button
                    className="absolute top-5 right-5 text-white/80 hover:text-white px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold transition-colors cursor-pointer"
                    onClick={() => setFullscreen(false)}
                  >
                    ✕ Close
                  </button>
                  <img
                    src={selectedMedia.image_url}
                    alt={selectedMedia.alt_text || product.product_name}
                    className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}

              {/* ── Right: Product Details & Buy Box ──────────────────── */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {product.brand_name && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-200/70">
                        {product.brand_name}
                      </span>
                    )}
                    {product.category_name && (
                      <Link
                        to={`/?ct=${encodeURIComponent(product.category_name)}`}
                        className="px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                      >
                        {product.category_name}
                      </Link>
                    )}
                  </div>
                  <ShareButton productName={product.product_name} showToast={showToast} />
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug mb-2">
                  {product.product_name}
                </h1>

                {/* Seller & Rating Row */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-5">
                  {product.seller_name && (
                    <span>
                      Sold by <strong className="text-slate-800">{product.seller_name}</strong>
                    </span>
                  )}
                  {reviews.length > 0 && (
                    <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200/70 px-2.5 py-1 rounded-lg">
                      <StarRating rating={avgRating} size="w-4 h-4" />
                      <span className="font-bold text-slate-800">{avgRating.toFixed(1)}</span>
                      <span className="text-slate-500">
                        ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
                      </span>
                    </div>
                  )}
                </div>

                {/* Price & Stock Box */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 mb-6 flex flex-wrap items-baseline justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Price
                    </p>
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl sm:text-4xl font-extrabold font-mono text-slate-900">
                        {formatPrice(displayPrice)}
                      </span>
                      {matchedVariant && product.base_price !== matchedVariant.price && (
                        <span className="text-sm font-mono text-slate-400 line-through">
                          {formatPrice(product.base_price)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Inclusive of all taxes</p>
                  </div>

                  <div>
                    {displayStock > 10 ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        In Stock
                      </span>
                    ) : displayStock > 0 ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        Only {displayStock} left in stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        Out of Stock
                      </span>
                    )}
                  </div>
                </div>

                {/* Variant Selectors */}
                {colors.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                      Color: <span className="text-stone-900">{selectedColor ?? 'Default'}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {colors.map((color) => (
                        <button
                          key={color}
                          onClick={() => setSelectedColor(color === selectedColor ? null : color)}
                          className={[
                            'px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer',
                            selectedColor === color
                              ? 'border-stone-900 bg-stone-900 text-white shadow-2xs'
                              : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400',
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
                    <p className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                      Size: <span className="text-stone-900">{selectedSize ?? 'Standard'}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {sizes.map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(size === selectedSize ? null : size)}
                          className={[
                            'px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer',
                            selectedSize === size
                              ? 'border-stone-900 bg-stone-900 text-white shadow-2xs'
                              : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400',
                          ].join(' ')}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Product Description */}
                {product.description && (
                  <div className="mb-6">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                      About this item
                    </h3>
                    <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">
                      {product.description}
                    </p>
                  </div>
                )}

                {/* Primary CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <button
                    onClick={handleAddToCart}
                    disabled={cartLoading || displayStock === 0}
                    className={[
                      'flex-1 py-3.5 px-6 rounded-2xl text-sm font-bold transition-all cursor-pointer shadow-sm',
                      'bg-stone-900 hover:bg-orange-600 text-white active:scale-[0.99]',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    ].join(' ')}
                  >
                    {cartLoading ? 'Adding to Cart…' : displayStock === 0 ? 'Out of Stock' : 'Add to Cart'}
                  </button>

                  <button
                    onClick={handleWishlistToggle}
                    disabled={wishlistLoading}
                    className={[
                      'py-3.5 px-6 rounded-2xl text-sm font-bold transition-all border cursor-pointer',
                      wishlisted
                        ? 'border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100'
                        : 'border-stone-200 bg-white text-stone-800 hover:bg-stone-50 hover:border-stone-300',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    ].join(' ')}
                  >
                    {wishlistLoading ? '…' : wishlisted ? '♥ Saved in Wishlist' : '♡ Save to Wishlist'}
                  </button>
                </div>

                {/* ── Embedded "Chatram AI Copilot" Card ─── */}
                <div className="rounded-2xl bg-[#f8f7f4] border border-stone-200/90 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center shrink-0">
                        <SparkleIcon className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                          Ask Chatram AI Copilot about this product
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        </p>
                        <p className="text-[11px] text-stone-500">
                          Instant review synthesis, spec comparisons &amp; quick cart actions via MCP
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={() =>
                        askAI(
                          `Summarize the key pros, cons, and customer reviews for ${product.product_name}.`
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-stone-900 text-stone-700 hover:text-white border border-stone-200/90 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                    >
                      Summarize reviews &amp; specs
                    </button>
                    <button
                      onClick={() =>
                        askAI(
                          `Compare ${product.product_name} (${formatPrice(displayPrice)}) with other alternatives in the store.`
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-stone-900 text-stone-700 hover:text-white border border-stone-200/90 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                    >
                      Compare alternatives
                    </button>
                    <button
                      onClick={() =>
                        askAI(
                          `Is ${product.product_name} worth buying at ${formatPrice(displayPrice)}?`
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-stone-900 text-stone-700 hover:text-white border border-stone-200/90 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                    >
                      Worth the price?
                    </button>
                  </div>
                </div>

                {/* Trust Badges */}
                <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-100 text-center">
                  <div className="p-2 rounded-xl bg-slate-50/70">
                    <p className="text-xs font-bold text-slate-800">🛡️ Genuine</p>
                    <p className="text-[10px] text-slate-500">100% Verified</p>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50/70">
                    <p className="text-xs font-bold text-slate-800">🚚 Fast Dispatch</p>
                    <p className="text-[10px] text-slate-500">Tracked Delivery</p>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50/70">
                    <p className="text-xs font-bold text-slate-800">💬 Live Support</p>
                    <p className="text-[10px] text-slate-500">Order Chat &amp; AI</p>
                  </div>
                </div>

                {product.sku && (
                  <p className="mt-3 text-[11px] font-mono text-slate-400">SKU: {product.sku}</p>
                )}
              </div>
            </div>

            {/* ── Customer Reviews Section ────────────────────────────── */}
            <Section
              title={`Customer Reviews (${reviews.length})`}
              subtitle="Verified ratings and media from Chatram shoppers"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Rating Summary + Write Review */}
                <div className="space-y-5">
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-4xl font-extrabold font-mono text-slate-900">
                        {avgRating > 0 ? avgRating.toFixed(1) : '—'}
                      </span>
                      <div>
                        <StarRating rating={avgRating} size="w-5 h-5" />
                        <p className="text-xs text-slate-500 mt-0.5">
                          Based on {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {isBuyer && product.can_review && (
                    <WriteReviewForm productId={id} onSuccess={fetchProduct} />
                  )}

                  {isBuyer && !product.can_review && (
                    <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-900 leading-relaxed">
                      💡 <strong>Purchased this product?</strong> You can submit a verified review once your order is marked as <strong>delivered</strong>.
                    </div>
                  )}

                  {!isAuthenticated && (
                    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 text-xs text-stone-600">
                      <Link
                        to={`/login?next=/product/${id}`}
                        className="text-orange-600 hover:underline font-bold"
                      >
                        Sign in
                      </Link>{' '}
                      to share your review with other shoppers.
                    </div>
                  )}
                </div>

                {/* Right 2 Columns: Review Feed */}
                <div className="lg:col-span-2">
                  {reviews.length > 0 ? (
                    <div className="space-y-3.5">
                      {reviews.map((r, i) => (
                        <ReviewCard
                          key={i}
                          review={r}
                          currentUser={user}
                          onDelete={handleDeleteReview}
                          onUpdate={handleUpdateReview}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 rounded-2xl border border-dashed border-stone-200 text-center text-stone-500 text-sm">
                      No customer reviews yet. Be the first to review this product!
                    </div>
                  )}
                </div>
              </div>
            </Section>

            {/* ── Questions & Answers Section ─────────────────────────── */}
            <Section
              title="Customer Questions & Answers"
              subtitle="Ask the seller or community about specifications and usage"
            >
              <div className="max-w-3xl space-y-5">
                {isBuyer && <AskQuestionForm productId={id} onSuccess={fetchProduct} />}

                {!isAuthenticated && (
                  <p className="text-xs text-stone-500">
                    <Link
                      to={`/login?next=/product/${id}`}
                      className="text-orange-600 hover:underline font-bold"
                    >
                      Sign in
                    </Link>{' '}
                    to post a question.
                  </p>
                )}

                {(product.questions ?? []).length > 0 ? (
                  <div className="space-y-3">
                    {product.questions.map((qa, i) => (
                      <QuestionCard key={i} qa={qa} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-stone-500">
                    No questions asked yet. Need an instant answer? Click{' '}
                    <button
                      onClick={() =>
                        askAI(`Tell me all the details about ${product.product_name}`)
                      }
                      className="text-orange-600 font-semibold hover:underline cursor-pointer"
                    >
                      Ask Chatram AI Copilot
                    </button>{' '}
                    above!
                  </p>
                )}
              </div>
            </Section>
          </div>
        )}
      </main>

      {/* Toast */}
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
