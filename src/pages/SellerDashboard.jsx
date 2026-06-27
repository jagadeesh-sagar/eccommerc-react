/**
 * SellerDashboard — /seller  (isSeller only)
 *
 * Four tabs:
 *
 *  Products      — GET /user/products/ list, link to detail
 *  Create Product— Full form with dynamic variants + S3 image upload
 *  Brands        — GET /user/brand/ list + POST /user/brand/
 *  Q&A           — Fetch questions per product via product detail;
 *                  answer via PATCH /user/product/seller-ans/<qnaId>
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import client from "../api/client";
import OrderChatPanel from "../components/OrderChatPanel";
import { useAuth } from "../context/AuthContext";
import SellerRegistrationForm from "../components/SellerRegistrationForm";

// ─────────────────────────────────────────────────────────────────────────────
// SearchableSelect — dropdown with live search for brands / categories
// Props: items [{id, name}], value (name string), onChange(name), placeholder
// ─────────────────────────────────────────────────────────────────────────────
function SearchableSelect({ items = [], searchUrl, value, onChange, placeholder = "Search…", error }) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState("");
  const wrapRef             = useRef(null);

  // Dynamic search/pagination states
  const [dynamicItems, setDynamicItems] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [nextPage, setNextPage]         = useState(1);
  const [hasMore, setHasMore]           = useState(false);

  // Determine active item list
  const activeItems = searchUrl ? dynamicItems : items;

  // Client-side filtering when searchUrl is not used
  const filtered = !searchUrl && query.trim()
    ? activeItems.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
    : activeItems;

  const selectedLabel = value
    ? (activeItems.find((i) => i.name === value)?.name ?? value)
    : null;

  // Fetch function for searchUrl
  const fetchDynamicItems = useCallback((searchQuery, pageNum, append = false) => {
    if (!searchUrl) return;
    setLoading(true);
    client.get(searchUrl, { params: { search: searchQuery.trim(), page: pageNum } })
      .then(({ data }) => {
        let results = [];
        let nextUrl = null;
        if (Array.isArray(data)) {
          results = data;
        } else if (Array.isArray(data?.results)) {
          results = data.results;
          nextUrl = data.next;
        }
        
        setDynamicItems(prev => append ? [...prev, ...results] : results);
        setHasMore(!!nextUrl);
        setNextPage(pageNum + 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [searchUrl]);

  // Query change debouncing
  useEffect(() => {
    if (!open || !searchUrl) return;
    const delayDebounceFn = setTimeout(() => {
      fetchDynamicItems(query, 1, false);
    }, 250);
    return () => clearTimeout(delayDebounceFn);
  }, [open, query, searchUrl, fetchDynamicItems]);

  // Fetch initial page on open
  useEffect(() => {
    if (open && searchUrl && dynamicItems.length === 0) {
      fetchDynamicItems("", 1, false);
    }
  }, [open, searchUrl, dynamicItems.length, fetchDynamicItems]);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false); setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function pick(name) {
    onChange(name); setOpen(false); setQuery("");
  }

  const border = error ? "border-red-400 ring-1 ring-red-300" : "border-gray-300";

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setTimeout(() => wrapRef.current?.querySelector("input")?.focus(), 50); }}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded border ${border} bg-white text-left transition focus:outline-none focus:ring-2 focus:ring-[#e77600]`}
      >
        <span className={selectedLabel ? "text-gray-900" : "text-gray-400"}>
          {selectedLabel ?? placeholder}
        </span>
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: "absolute", zIndex: 9999, top: "calc(100% + 4px)",
            left: 0, right: 0,
            background: "#fff", border: "1px solid #d1d5db",
            borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            overflow: "hidden",
          }}
        >
          {/* Search box */}
          <div style={{ padding: "8px 8px 4px" }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search…"
              style={{
                width: "100%", padding: "6px 10px", fontSize: 13,
                border: "1px solid #d1d5db", borderRadius: 6, outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          {/* Option list */}
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {(!searchUrl ? filtered.length === 0 : activeItems.length === 0) && !loading ? (
              <p style={{ padding: "10px 12px", fontSize: 12, color: "#9ca3af" }}>No results</p>
            ) : (
              <>
                {(!searchUrl ? filtered : activeItems).map((item) => (
                  <button
                    key={item.id ?? item.name}
                    type="button"
                    onClick={() => pick(item.name)}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "8px 12px", fontSize: 13, cursor: "pointer",
                      background: item.name === value ? "#fff7ed" : "transparent",
                      color: item.name === value ? "#c2410c" : "#111827",
                      fontWeight: item.name === value ? 600 : 400,
                      border: "none",
                    }}
                    onMouseEnter={(e) => { if (item.name !== value) e.currentTarget.style.background = "#f9fafb"; }}
                    onMouseLeave={(e) => { if (item.name !== value) e.currentTarget.style.background = "transparent"; }}
                  >
                    {item.name}
                  </button>
                ))}
                {loading && (
                  <p style={{ padding: "8px 12px", fontSize: 12, color: "#9ca3af" }} className="animate-pulse">Loading…</p>
                )}
                {hasMore && !loading && (
                  <button
                    type="button"
                    onClick={() => fetchDynamicItems(query, nextPage, true)}
                    style={{
                      display: "block", width: "100%", textAlign: "center",
                      padding: "8px 12px", fontSize: 12, cursor: "pointer",
                      background: "#f9fafb", color: "#007185", fontWeight: 500,
                      border: "none", borderTop: "1px solid #e5e7eb"
                    }}
                  >
                    Load more
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiny shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(val) {
  const n = parseFloat(val);
  return isNaN(n)
    ? "—"
    : "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function extractId(url = "") {
  const parts = String(url).replace(/\/$/, "").split("/");
  const id = parseInt(parts[parts.length - 1], 10);
  return isNaN(id) ? null : id;
}

function pseudoColor(str = "") {
  const p = [
    "#dbeafe",
    "#fce7f3",
    "#d1fae5",
    "#fef3c7",
    "#ede9fe",
    "#fee2e2",
    "#cffafe",
    "#f3f4f6",
  ];
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return p[Math.abs(h) % p.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable form field
// ─────────────────────────────────────────────────────────────────────────────

function Field({ label, error, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-0.5 text-xs text-red-600">⚠ {error}</p>}
    </div>
  );
}

const inputCls = (err) =>
  [
    "w-full px-3 py-2 text-sm border rounded outline-none transition-all",
    "focus:border-[#e77600] focus:ring-[3px] focus:ring-[rgba(228,121,17,0.5)]",
    err ? "border-red-500" : "border-gray-400",
  ].join(" ");

function useSellerCheck() {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    client
      .get("/seller/registration/")
      .then(({ data }) => {
        let isSeller = false;
        if (Array.isArray(data)) {
          isSeller = data.length > 0;
        } else if (data && Array.isArray(data.results)) {
          isSeller = data.results.length > 0;
        } else if (data && Object.keys(data).length > 0) {
          isSeller = true;
        }
        setStatus(isSeller ? "exists" : "none");
      })
      .catch(() => {
        setStatus("none");
      });
  }, []);

  return status;
}
// ─────────────────────────────────────────────────────────────────────────────
// Tab bar
// ─────────────────────────────────────────────────────────────────────────────

const TABS = ["Products", "Create Product", "Brands", "Q&A", "Orders"];

function TabBar({ active, onChange }) {
  return (
    <div className="flex overflow-x-auto scrollbar-none border-b border-gray-200 mb-6">
      {TABS.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={[
            "flex-shrink-0 px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
            active === t
              ? "border-[#e77600] text-[#c7511f]"
              : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300",
          ].join(" ")}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Tab 1: Products ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

function ProductDeleteModal({ product, onClose, onSuccess }) {
  const RESEND_SECONDS = 60;

  // step: 'confirm' | 'otp'
  const [step, setStep] = useState("confirm");
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);   // requesting OTP
  const [verifying, setVerifying] = useState(false); // confirming delete
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  const timerRef = useRef(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  function startCountdown() {
    setCountdown(RESEND_SECONDS);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  const pid = extractId(product.product_detail);

  async function handleRequestOtp() {
    setSending(true);
    setError("");
    try {
      // variant=0 means we're deleting the full product, not a variant
      await client.post(`/user/product/request-delete-otp/${pid}/0/`);
      setStep("otp");
      startCountdown();
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to send OTP. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    setOtp("");
    setError("");
    await handleRequestOtp();
  }

  async function handleVerify(e) {
    e.preventDefault();
    if (!otp.trim()) { setError("Please enter the OTP."); return; }
    setVerifying(true);
    setError("");
    try {
      await client.post(`/user/product/confirm-delete/${pid}/0/`, { otp: otp.trim() });
      clearInterval(timerRef.current);
      onSuccess(product);
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.error || "Invalid or expired OTP.";
      setError(detail);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-red-600 px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="white" className="w-4 h-4">
              <path fillRule="evenodd" d="M9 2a1 1 0 0 0-.894.553L7.382 4H4a1 1 0 0 0 0 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a1 1 0 1 0 0-2h-3.382l-.724-1.447A1 1 0 0 0 11 2H9ZM7 8a1 1 0 0 1 2 0v6a1 1 0 1 1-2 0V8Zm5-1a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1Z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold text-base leading-tight">Delete Product</h3>
            <p className="text-red-100 text-xs mt-0.5">This action cannot be undone</p>
          </div>
        </div>

        <div className="p-5">
          {/* ── STEP 1: Confirmation ─────────────────── */}
          {step === "confirm" && (
            <>
              <p className="text-sm text-gray-600 mb-1">
                You are about to permanently delete:
              </p>
              <p className="text-sm font-semibold text-gray-900 mb-4 line-clamp-2">
                {product.product_name}
              </p>
              <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
                ⚠️ A one-time password (OTP) will be sent to your registered email address to confirm this deletion.
              </p>
              {error && <p className="text-xs text-red-600 mb-3 bg-red-50 p-2 rounded">{error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={sending}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestOtp}
                  disabled={sending}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  {sending && <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {sending ? "Sending OTP…" : "Send OTP"}
                </button>
              </div>
            </>
          )}

          {/* ── STEP 2: OTP Entry ───────────────────── */}
          {step === "otp" && (
            <form onSubmit={handleVerify}>
              <p className="text-sm text-gray-600 mb-1">
                An OTP was sent to your email. Enter it below to confirm deletion of:
              </p>
              <p className="text-sm font-semibold text-gray-900 mb-5 line-clamp-2">
                {product.product_name}
              </p>

              {/* OTP Input */}
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Enter OTP
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={otp}
                onChange={e => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }}
                placeholder="e.g. 123456"
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent mb-1.5"
              />

              {/* Error */}
              {error && <p className="text-xs text-red-600 mb-3 bg-red-50 p-2 rounded">{error}</p>}

              {/* Resend row */}
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs text-gray-400">
                  {countdown > 0 ? `Resend in ${countdown}s` : "Didn't receive it?"}
                </span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={countdown > 0 || sending}
                  className={[
                    "text-xs font-medium transition-colors",
                    countdown > 0 || sending
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-red-600 hover:text-red-800 underline cursor-pointer",
                  ].join(" ")}
                >
                  {sending ? "Resending…" : "Resend OTP"}
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={verifying}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying || !otp.trim()}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {verifying && <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {verifying ? "Deleting…" : "Confirm Delete"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function ManageMediaModal({ product, onClose }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState(null);

  useEffect(() => {
    const pid = extractId(product.product_detail);
    if (!pid) {
      setError("Invalid product ID.");
      setLoading(false);
      return;
    }
    client.get(`/user/product/detail/${pid}`)
      .then(({ data }) => {
        setMedia(data.images || []);
      })
      .catch(() => setError("Failed to load media."))
      .finally(() => setLoading(false));
  }, [product]);

  async function handleDeleteMedia(mediaId) {
    setDeletingId(mediaId);
    try {
      await client.delete('/user/product/image/', { data: { image_id: mediaId } });
      setMedia(prev => prev.filter(m => m.id !== mediaId));
    } catch (err) {
      alert("Failed to delete media.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSetPrimary(m) {
    if (m.is_primary) return;
    setSettingPrimaryId(m.id);
    try {
      const payload = {
        product_id: extractId(product.product_detail),
        is_primary: true,
        display_order: 1,
      };
      if (m.video_url) {
        payload.video_url = m.video_url;
        payload.image_url = "";
      } else {
        payload.image_url = m.image_url;
        payload.video_url = "";
      }
      await client.post('/user/product/image/', payload);
      // Optimistically update
      setMedia(prev => prev.map(img => ({ ...img, is_primary: img.id === m.id })));
    } catch (err) {
      alert("Failed to set primary.");
    } finally {
      setSettingPrimaryId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Manage Media: {product.product_name}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-[200px] pr-2">
          {loading ? (
            <div className="flex justify-center items-center h-full"><span className="inline-block w-6 h-6 border-2 border-[#e77600] border-t-transparent rounded-full animate-spin" /></div>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : media.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No images or videos found for this product.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {media.map(m => {
                const isVideo = !!m.video_url;
                const url = m.image_url || m.video_url;
                return (
                  <div key={m.id} className="relative border rounded overflow-hidden group bg-gray-50">
                    {isVideo && !m.image_url ? (
                      <div className="w-full h-32 flex items-center justify-center bg-gray-800 text-white font-medium">Video</div>
                    ) : (
                      <img src={url} alt="product media" className="w-full h-32 object-cover" />
                    )}

                    {m.is_primary && (
                      <div className="absolute top-1 left-1 bg-[#ffd814] text-xs font-bold px-2 py-0.5 rounded shadow-sm text-black">
                        Primary
                      </div>
                    )}

                    <div className="absolute top-1 right-1 flex flex-col gap-1">
                      <button
                        onClick={() => handleDeleteMedia(m.id)}
                        disabled={deletingId === m.id}
                        className="bg-white/90 hover:bg-red-50 text-red-600 rounded p-1.5 shadow backdrop-blur transition-colors disabled:opacity-50"
                        title="Delete media"
                      >
                        {deletingId === m.id ? (
                           <span className="inline-block w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        )}
                      </button>
                    </div>

                    {!m.is_primary && (
                      <div className="absolute bottom-1 left-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleSetPrimary(m)}
                          disabled={settingPrimaryId === m.id}
                          className="w-full bg-white/90 hover:bg-[#ffd814] text-gray-800 text-xs font-semibold py-1 rounded shadow backdrop-blur transition-colors"
                        >
                          {settingPrimaryId === m.id ? "Setting..." : "Set Primary"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [nextUrl, setNextUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [deleteProduct, setDeleteProduct] = useState(null);
  const [manageMediaProduct, setManageMediaProduct] = useState(null);
  const [toastMsg, setToastMsg] = useState("");

  const fetchProducts = (url) => {
    if (url) setLoadingMore(true);
    else setLoading(true);

    let fetchUrl = url || "/user/products/";
    if (typeof fetchUrl === 'string' && fetchUrl.startsWith('http')) {
      const obj = new URL(fetchUrl);
      fetchUrl = obj.pathname + obj.search;
    }

    client
      .get(fetchUrl)
      .then(({ data }) => {
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : [];
        setProducts(prev => url ? [...prev, ...list] : list);
        setNextUrl(data?.next || null);
      })
      .catch(() => setError("Failed to load products."))
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  function handleDeleted(prod) {
    setProducts(prev => prev.filter(p => p !== prod));
    setDeleteProduct(null);
    setToastMsg(`Product "${prod.product_name}" deleted.`);
    setTimeout(() => setToastMsg(""), 4000);
  }

  if (loading)
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );

  if (error) return <p className="text-sm text-red-600">{error}</p>;

  if (products.length === 0)
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-4xl mb-3">📦</p>
        <p className="font-medium">No products found.</p>
        <p className="text-sm mt-1">
          Switch to the <strong>Create Product</strong> tab to add one.
        </p>
      </div>
    );

  return (
    <div className="space-y-3 relative">
      {toastMsg && (
        <div className="absolute top-0 right-0 px-4 py-2 bg-green-50 text-green-700 text-sm border border-green-200 rounded shadow-sm z-10 transition-all">
          ✓ {toastMsg}
        </div>
      )}
      <p className="text-xs text-gray-400 mb-4">
        Showing all active products on the platform. Use <em>Create Product</em>{" "}
        to add yours.
      </p>
      {products.map((p, i) => {
        const pid = extractId(p.product_detail);
        const bg = pseudoColor(p.product_name);
        return (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
          >
            {/* Avatar */}
            <div
              className="w-10 h-10 rounded flex items-center justify-center text-lg font-bold text-gray-300 flex-shrink-0"
              style={{ backgroundColor: bg }}
            >
              {(p.product_name ?? "?")[0].toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {p.product_name}
              </p>
              <p className="text-xs text-gray-400">
                {p.brand_name} · {p.category_name}
              </p>
            </div>

            {/* Price */}
            <p className="text-sm font-bold text-[#B12704] flex-shrink-0">
              {fmt(p.base_price)}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-3 flex-shrink-0 ml-2">
              <button
                onClick={() => setManageMediaProduct(p)}
                className="text-xs text-orange-600 hover:text-orange-800 hover:underline font-medium"
              >
                Manage Media
              </button>
              {pid && (
                <Link
                  to={`/product/${pid}`}
                  className="text-xs text-[#007185] hover:text-[#c7511f] hover:underline font-medium"
                >
                  View
                </Link>
              )}
              <button
                onClick={() => setDeleteProduct(p)}
                className="text-xs text-red-600 hover:text-red-800 hover:underline font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}
      {nextUrl && (
        <div className="flex justify-center mt-6 mb-4">
          <button 
            onClick={() => fetchProducts(nextUrl)} 
            disabled={loadingMore}
            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load More Products"}
          </button>
        </div>
      )}
      {deleteProduct && (
        <ProductDeleteModal
          product={deleteProduct}
          onClose={() => setDeleteProduct(null)}
          onSuccess={handleDeleted}
        />
      )}
      {manageMediaProduct && (
        <ManageMediaModal
          product={manageMediaProduct}
          onClose={() => setManageMediaProduct(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Tab 2: Create Product ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_VARIANT = {
  color: "",
  size: "",
  price: "",
  stock_qty: "",
  sku: "",
};

// ─────────────────────────────────────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  const steps = [
    { n: 1, label: "Product Details" },
    { n: 2, label: "Upload Images" },
  ];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, idx) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={[
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all",
                step > s.n
                  ? "bg-green-500 border-green-500 text-white"
                  : step === s.n
                    ? "bg-[#e77600] border-[#e77600] text-white"
                    : "bg-white border-gray-300 text-gray-400",
              ].join(" ")}
            >
              {step > s.n ? "✓" : s.n}
            </div>
            <span
              className={[
                "text-xs mt-1 whitespace-nowrap font-medium",
                step === s.n
                  ? "text-[#c7511f]"
                  : step > s.n
                    ? "text-green-600"
                    : "text-gray-400",
              ].join(" ")}
            >
              {s.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div
              className={[
                "h-0.5 w-16 sm:w-28 mx-2 mb-4 transition-all",
                step > 1 ? "bg-green-400" : "bg-gray-200",
              ].join(" ")}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Media uploader — Step 2 of product creation (images + videos)
//
// Flow per file:
//   1. GET /user/product/image/?file_name=&file_type=images|videos&product_id=
//      → { upload_url, file_url, bucket, key }
//   2. PUT <upload_url>  (direct to S3 — no Django auth headers)
//   3. POST /user/product/image/  { product_id, image_url|video_url, is_primary, ... }
//
// For image files → file_type='images', saved to image_url
// For video files → file_type='videos', saved to video_url
// ─────────────────────────────────────────────────────────────────────────────

// Accepted MIME types for the file input
const ACCEPTED_MEDIA = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/mpeg",
  "video/3gpp",
  "video/x-matroska",
].join(",");

function VideoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="white"
      className="w-6 h-6"
    >
      <path
        fillRule="evenodd"
        d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ImageUploadStep({ productId, productName, onCreateAnother, onGoToDashboard }) {
  const fileRef = useRef(null);
  // entry shape: { id, file, isVideo, status, url, error, isPrimary }
  const [uploads, setUploads] = useState([]);
  const [busy, setBusy] = useState(false);

  /**
   * Sanitize a filename before sending to the S3 pre-sign endpoint.
   * S3 object keys with spaces or special chars break pre-signed PUT URLs
   * because the key is URL-encoded in the signature but sent raw in the PUT.
   * Replace every unsafe character with an underscore.
   */
  function sanitizeFilename(file) {
    const safeName = file.name
      .replace(/\s+/g, '_')          // spaces → underscore
      .replace(/[%#+?&=<>{}|\\^~\[\]`]/g, '_') // other S3-unsafe chars
      .replace(/_+/g, '_')           // collapse consecutive underscores
      .replace(/^_|_$/g, '')         // strip leading/trailing underscores
    if (safeName === file.name) return file  // no change needed
    return new File([file], safeName, { type: file.type, lastModified: file.lastModified })
  }

  function patch(id, delta) {
    setUploads((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...delta } : u)),
    );
  }

  async function uploadOne(entry, doneCountAtStart) {
    const { id, file, isVideo } = entry;
    patch(id, { status: "presign" });

    try {
      // ── Step 1: get presigned URL from Django ──────────────────────────
      const { data: presign } = await client.get("/user/product/image/", {
        params: {
          file_name: file.name,
          file_type: isVideo ? "videos" : "images", // ← key difference
          product_id: productId,
        },
      });

      patch(id, { status: "s3" });

      // ── Step 2: PUT file directly to S3 (no Django cookies/CSRF) ──────
      const putRes = await fetch(presign.upload_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!putRes.ok) throw new Error(`S3 upload failed (${putRes.status})`);

      patch(id, { status: "saving" });

      // ── Step 3: tell Django to persist the S3 URL ──────────────────────
      // Videos → video_url field; Images → image_url field
      const isPrimary = doneCountAtStart === 0;
      const payload = {
        product_id: productId,
        alt_text: file.name.replace(/\.[^.]+$/, ""),
        is_primary: isPrimary,
        display_order: doneCountAtStart + 1,
      };
      if (isVideo) {
        payload.video_url = presign.file_url;
        payload.image_url = ""; // required field — send empty for video-only entries
      } else {
        payload.image_url = presign.file_url;
        payload.video_url = "";
      }

      await client.post("/user/product/image/", payload);
      patch(id, { status: "done", url: presign.file_url, isPrimary });
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        "Upload failed";
      patch(id, { status: "error", error: msg });
    }
  }

  async function handleFiles(e) {
    const rawFiles = Array.from(e.target.files ?? []);
    if (!rawFiles.length) return;
    if (fileRef.current) fileRef.current.value = "";

    // Sanitize filenames — replace spaces and S3-unsafe chars with "_"
    const files = rawFiles.map(sanitizeFilename);

    const newEntries = files.map((file) => ({
      id: Math.random().toString(36).slice(2),
      file,
      isVideo: file.type.startsWith("video/"),
      status: "queued",
      url: null,
      error: null,
      isPrimary: false,
    }));

    setUploads((prev) => [...prev, ...newEntries]);
    setBusy(true);

    // Upload sequentially so isPrimary tracking is correct
    let doneCount = uploads.filter((u) => u.status === "done").length;
    for (const entry of newEntries) {
      await uploadOne(entry, doneCount);
      doneCount++;
    }
    setBusy(false);
  }

  async function markPrimary(id) {
    setUploads((prev) => prev.map((u) => ({ ...u, isPrimary: u.id === id })));
    const target = uploads.find((u) => u.id === id);
    if (!target?.url) return;
    try {
      const payload = {
        product_id: productId,
        is_primary: true,
        display_order: 1,
      };
      if (target.isVideo) {
        payload.video_url = target.url;
        payload.image_url = "";
      } else {
        payload.image_url = target.url;
        payload.video_url = "";
      }
      await client.post("/user/product/image/", payload);
    } catch {
      // non-critical
    }
  }

  const doneCount = uploads.filter((u) => u.status === "done").length;
  const videoCount = uploads.filter(
    (u) => u.status === "done" && u.isVideo,
  ).length;
  const imgCount = doneCount - videoCount;

  const statusLabel = {
    queued: "Waiting…",
    presign: "Getting URL…",
    s3: "Uploading to S3…",
    saving: "Saving…",
    done: "Done ✓",
    error: "Failed",
  };
  const statusColor = {
    queued: "text-gray-400",
    presign: "text-blue-500",
    s3: "text-blue-500",
    saving: "text-amber-500",
    done: "text-green-600",
    error: "text-red-500",
  };

  return (
    <div className="max-w-2xl">
      {/* Product name banner */}
      <div className="flex items-center gap-3 mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <span className="text-green-600 text-xl">✓</span>
        <div>
          <p className="font-semibold text-green-800">Product created!</p>
          <p className="text-sm text-gray-600">{productName}</p>
        </div>
      </div>

      {/* Upload drop zone */}
      <div
        onClick={() => !busy && fileRef.current?.click()}
        className={[
          "border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 transition-all cursor-pointer select-none",
          busy
            ? "border-gray-200 bg-gray-50 cursor-not-allowed"
            : "border-[#e77600] bg-orange-50 hover:bg-orange-100",
        ].join(" ")}
      >
        <div className="flex gap-2 text-3xl">📷 🎬</div>
        <p className="text-sm font-semibold text-gray-700">
          {busy ? "Upload in progress…" : "Click to add images or videos"}
        </p>
        <p className="text-xs text-gray-400 text-center">
          Images: JPEG, PNG, WebP, GIF &nbsp;·&nbsp; Videos: MP4, MOV, WebM,
          MKV, AVI
          <br />
          Multiple files allowed
        </p>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_MEDIA}
          multiple
          className="hidden"
          onChange={handleFiles}
          disabled={busy}
        />
      </div>

      {/* Upload queue */}
      {uploads.length > 0 && (
        <div className="mt-5 space-y-2">
          {uploads.map((u) => (
            <div
              key={u.id}
              className={[
                "flex items-center gap-3 p-3 rounded-lg border transition-all",
                u.status === "done"
                  ? "border-green-200 bg-green-50"
                  : u.status === "error"
                    ? "border-red-200  bg-red-50"
                    : "border-gray-200 bg-white",
              ].join(" ")}
            >
              {/* Thumbnail / video icon / spinner */}
              <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200">
                {u.status === "error" ? (
                  <span className="text-red-400 text-xl">✗</span>
                ) : u.url && !u.isVideo ? (
                  <img
                    src={u.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : u.url && u.isVideo ? (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800">
                    <VideoIcon />
                  </div>
                ) : (
                  <span className="inline-block w-5 h-5 border-2 border-[#e77600] border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              {/* File name + type badge + status */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-xs font-medium text-gray-800 truncate">
                    {u.file.name}
                  </p>
                  <span
                    className={[
                      "flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                      u.isVideo
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700",
                    ].join(" ")}
                  >
                    {u.isVideo ? "video" : "image"}
                  </span>
                </div>
                <p
                  className={`text-xs ${statusColor[u.status] ?? "text-gray-400"}`}
                >
                  {u.status === "error"
                    ? `⚠ ${u.error}`
                    : statusLabel[u.status]}
                </p>
              </div>

              {/* Primary badge / Set primary button */}
              {u.status === "done" &&
                (u.isPrimary ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#febd69] text-[#131921] flex-shrink-0">
                    PRIMARY
                  </span>
                ) : (
                  <button
                    onClick={() => markPrimary(u.id)}
                    className="text-[10px] text-[#007185] hover:underline flex-shrink-0"
                  >
                    Set primary
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}

      {/* Upload summary */}
      {doneCount > 0 && !busy && (
        <p className="mt-3 text-sm text-green-700 font-medium">
          ✓
          {imgCount > 0 ? ` ${imgCount} image${imgCount !== 1 ? "s" : ""}` : ""}
          {imgCount > 0 && videoCount > 0 ? " +" : ""}
          {videoCount > 0
            ? ` ${videoCount} video${videoCount !== 1 ? "s" : ""}`
            : ""}{" "}
          uploaded successfully.
        </p>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => !busy && fileRef.current?.click()}
          disabled={busy}
          className="px-5 py-2 rounded-full text-sm font-medium border border-[#a88734] bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b] hover:from-[#f5d78e] hover:to-[#eeb933] text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add more images / videos
        </button>
        <button
          type="button"
          onClick={onCreateAnother}
          disabled={busy}
          className="px-5 py-2 rounded-full text-sm font-medium text-[#007185] border border-[#007185] hover:bg-[#007185] hover:text-white transition-colors disabled:opacity-50"
        >
          Create another product
        </button>
        <button
          type="button"
          onClick={onGoToDashboard}
          disabled={busy}
          className="px-5 py-2 rounded-full text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          Finish & Go to Dashboard
        </button>
      </div>
    </div>
  );
}

function VariantRow({ variant, index, onChange, onRemove }) {
  function update(field, val) {
    onChange(index, { ...variant, [field]: val });
  }

  const inp = (field, placeholder, type = "text") => (
    <input
      type={type}
      placeholder={placeholder}
      value={variant[field]}
      onChange={(e) => update(field, e.target.value)}
      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded outline-none focus:border-[#e77600]"
    />
  );

  return (
    <div className="grid grid-cols-6 gap-2 items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div>{inp("color", "Color")}</div>
      <div>{inp("size", "Size")}</div>
      <div>{inp("price", "Price", "number")}</div>
      <div>{inp("stock_qty", "Stock", "number")}</div>
      <div>{inp("sku", "SKU")}</div>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-red-400 hover:text-red-600 text-lg leading-none transition-colors"
          aria-label="Remove variant"
        >
          ×
        </button>
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  product_name: "",
  description: "",
  base_price: "",
  stock_qty: "",
  category: "",
  brand: "",
  sku: "",
  is_active: true,
};

function CreateProductTab({ onGoToDashboard }) {
  // ── Wizard state ─────────────────────────────────────────────────────────
  const [step, setStep] = useState(1); // 1 | 2
  const [created, setCreated] = useState(null); // { id, name }

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState(EMPTY_FORM);
  const [variants, setVariants] = useState([]);
  const [errors, setErrors] = useState({});
  const [globalErr, setGlobalErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    // fetch ALL categories and brands (pagination disabled on backend)
    client.get("/user/product/categories/").then(({ data }) => {
      setCategories(
        Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : [],
      );
    });
    client.get("/user/brand/").then(({ data }) => {
      setBrands(
        Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : [],
      );
    });
  }, []);

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
    setErrors((e) => ({ ...e, [field]: "" }));
  }

  function addVariant() {
    setVariants((v) => [...v, { ...EMPTY_VARIANT }]);
  }
  function updateVariant(i, updated) {
    setVariants((v) => v.map((r, idx) => (idx === i ? updated : r)));
  }
  function removeVariant(i) {
    setVariants((v) => v.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const req = [
      "product_name",
      "base_price",
      "stock_qty",
      "category",
      "brand",
    ];
    const errs = {};
    req.forEach((k) => {
      if (!String(form[k]).trim()) errs[k] = "Required.";
    });
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    setGlobalErr("");
    setErrors({});

    const payload = {
      product_name: form.product_name,
      description: form.description,
      base_price: parseFloat(form.base_price),
      stock_qty: parseInt(form.stock_qty, 10),
      category: form.category,
      brand: form.brand,
      sku: form.sku || undefined,
      is_active: form.is_active,
      ...(variants.length > 0
        ? {
            variants: variants
              .filter((v) => v.price && v.stock_qty)
              .map((v) => ({
                color: v.color || undefined,
                size: v.size || undefined,
                price: v.price,
                stock_qty: parseInt(v.stock_qty, 10),
                sku: v.sku || undefined,
              })),
          }
        : {}),
    };

    try {
      const { data } = await client.post("/user/product/create/", payload);
      // Product created → advance to Step 2
      setCreated({ id: data.id, name: data.product_name ?? form.product_name });
      setStep(2);
      setForm(EMPTY_FORM);
      setVariants([]);
    } catch (err) {
      const d = err.response?.data ?? {};
      const mapped = {};
      Object.keys(EMPTY_FORM).forEach((k) => {
        if (d[k]) mapped[k] = Array.isArray(d[k]) ? d[k][0] : d[k];
      });
      if (Object.keys(mapped).length) {
        setErrors(mapped);
      } else {
        setGlobalErr(
          d.detail ||
            d.error ||
            d.non_field_errors?.[0] ||
            "Could not create product.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleCreateAnother() {
    setCreated(null);
    setStep(1);
    setForm(EMPTY_FORM);
    setVariants([]);
    setErrors({});
    setGlobalErr("");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: Image upload
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 2 && created) {
    return (
      <div>
        <StepIndicator step={2} />
        <ImageUploadStep
          productId={created.id}
          productName={created.name}
          onCreateAnother={handleCreateAnother}
          onGoToDashboard={() => {
            handleCreateAnother();
            if (onGoToDashboard) onGoToDashboard();
          }}
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: Product details form
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <StepIndicator step={1} />
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        {globalErr && (
          <div className="px-4 py-3 bg-red-50 border border-red-300 rounded text-sm text-red-700">
            {globalErr}
          </div>
        )}

        {/* ── Basic info ────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Product name" error={errors.product_name} required>
              <input
                className={inputCls(errors.product_name)}
                value={form.product_name}
                onChange={(e) => set("product_name", e.target.value)}
                placeholder="e.g. Samsung Galaxy S24"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Description" error={errors.description}>
              <textarea
                rows={3}
                className={inputCls(errors.description) + " resize-none"}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Describe your product…"
              />
            </Field>
          </div>

          <Field label="Base price (₹)" error={errors.base_price} required>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls(errors.base_price)}
              value={form.base_price}
              onChange={(e) => set("base_price", e.target.value)}
              placeholder="0.00"
            />
          </Field>

          <Field label="Stock quantity" error={errors.stock_qty} required>
            <input
              type="number"
              min="0"
              className={inputCls(errors.stock_qty)}
              value={form.stock_qty}
              onChange={(e) => set("stock_qty", e.target.value)}
              placeholder="e.g. 100"
            />
          </Field>

          <Field label="SKU" error={errors.sku}>
            <input
              className={inputCls(errors.sku)}
              value={form.sku}
              onChange={(e) => set("sku", e.target.value)}
              placeholder="Unique stock-keeping unit"
            />
          </Field>

          <Field label="Category" error={errors.category} required>
            <SearchableSelect
              searchUrl="/user/product/categories/"
              items={categories}
              value={form.category}
              onChange={(val) => set("category", val)}
              placeholder="— Select category —"
              error={errors.category}
            />
          </Field>

          <Field label="Brand" error={errors.brand} required>
            <SearchableSelect
              searchUrl="/user/brand/"
              items={brands}
              value={form.brand}
              onChange={(val) => set("brand", val)}
              placeholder="— Select brand —"
              error={errors.brand}
            />
          </Field>

          {/* is_active toggle */}
          <div className="sm:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => set("is_active", !form.is_active)}
                className={[
                  "relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer",
                  form.is_active ? "bg-[#e77600]" : "bg-gray-300",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                    form.is_active ? "translate-x-5" : "translate-x-0",
                  ].join(" ")}
                />
              </div>
              <span className="text-sm font-medium text-gray-700">
                {form.is_active
                  ? "Active (visible to buyers)"
                  : "Inactive (hidden from buyers)"}
              </span>
            </label>
          </div>
        </div>

        {/* ── Variants ─────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">
              Variants{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </p>
            <button
              type="button"
              onClick={addVariant}
              className="text-xs px-3 py-1.5 rounded border border-[#a88734] bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b] hover:from-[#f5d78e] hover:to-[#eeb933] text-gray-800 font-medium transition-all"
            >
              + Add variant
            </button>
          </div>

          {variants.length > 0 && (
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-6 gap-2 px-3">
                {["Color", "Size", "Price", "Stock", "SKU", ""].map((h) => (
                  <p
                    key={h}
                    className="text-[10px] font-bold text-gray-400 uppercase tracking-wide"
                  >
                    {h}
                  </p>
                ))}
              </div>
              {variants.map((v, i) => (
                <VariantRow
                  key={i}
                  variant={v}
                  index={i}
                  onChange={updateVariant}
                  onRemove={removeVariant}
                />
              ))}
            </div>
          )}

          {variants.length === 0 && (
            <p className="text-xs text-gray-400 italic">
              No variants added. The product will use the base price and a
              single stock pool.
            </p>
          )}
        </div>

        {/* ── Submit ───────────────────────────────── */}
        <button
          type="submit"
          disabled={submitting}
          className={[
            "px-8 py-2.5 rounded-full text-sm font-bold transition-all shadow-sm",
            "border border-[#a88734] bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b]",
            "hover:from-[#f5d78e] hover:to-[#eeb933] text-gray-900",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "focus:outline-none focus:ring-2 focus:ring-[#e77600]",
          ].join(" ")}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
              Creating…
            </span>
          ) : (
            "Create product →  Next: Upload images"
          )}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Tab 3: Brands ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_BRAND = { name: "", description: "", logo: "", is_active: true };

function BrandsTab() {
  const BACKEND_PAGE_SIZE = 2;
  const [brands, setBrands]       = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_BRAND);
  const [errors, setErrors]       = useState({});
  const [globalErr, setGlobalErr] = useState("");
  const [saving, setSaving]       = useState(false);
  const [success, setSuccess]     = useState("");
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);

  const fetchBrands = useCallback(() => {
    setLoading(true);
    client
      .get("/user/brand/", { params: { page, search: search.trim() } })
      .then(({ data }) => {
        if (Array.isArray(data)) {
          setBrands(data);
          setTotalCount(data.length);
        } else if (Array.isArray(data?.results)) {
          setBrands(data.results);
          setTotalCount(data.count ?? data.results.length);
        } else {
          setBrands([]);
          setTotalCount(0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { fetchBrands(); }, [fetchBrands]);
  // reset to page 1 when search changes
  useEffect(() => { setPage(1); }, [search]);

  function setField(f, v) {
    setForm((p) => ({ ...p, [f]: v }));
    setErrors((e) => ({ ...e, [f]: "" }));
  }

  // server-side filter + paginate
  const totalPages  = Math.max(1, Math.ceil(totalCount / BACKEND_PAGE_SIZE));
  const paginated   = brands;

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrors({ name: "Brand name is required." });
      return;
    }
    setSaving(true);
    setGlobalErr("");
    setSuccess("");
    try {
      await client.post("/user/brand/", form);
      setSuccess(`Brand "${form.name}" created!`);
      setForm(EMPTY_BRAND);
      setShowForm(false);
      fetchBrands();
    } catch (err) {
      const d = err.response?.data ?? {};
      if (d.name) {
        setErrors({ name: Array.isArray(d.name) ? d.name[0] : d.name });
      } else {
        setGlobalErr(d.detail || d.error || "Could not create brand.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Success toast */}
      {success && (
        <div className="px-4 py-2.5 bg-green-50 border border-green-300 rounded text-sm text-green-700 flex justify-between">
          <span>✓ {success}</span>
          <button onClick={() => setSuccess("")} className="text-green-500 hover:text-green-700">×</button>
        </div>
      )}

      {/* Search + Add */}
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search brands…"
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e77600]"
        />
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-[#a88734] bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b] text-gray-900 font-medium hover:from-[#f5d78e] transition-all"
          >
            <span className="text-lg leading-none">+</span> Add brand
          </button>
        )}
      </div>

      {/* Add brand form */}
      {showForm && (
        <form
          onSubmit={handleSave}
          className="border-2 border-[#e77600] rounded-lg p-5 bg-orange-50 space-y-4"
        >
          <p className="text-sm font-semibold text-gray-800">New brand</p>
          {globalErr && <p className="text-xs text-red-600">{globalErr}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Brand name" error={errors.name} required>
              <input
                className={inputCls(errors.name)}
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="e.g. Samsung"
              />
            </Field>
            <Field label="Logo URL" error={errors.logo}>
              <input
                className={inputCls(errors.logo)}
                value={form.logo}
                onChange={(e) => setField("logo", e.target.value)}
                placeholder="https://…"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description" error={errors.description}>
                <textarea
                  rows={2}
                  className={inputCls(errors.description) + " resize-none"}
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="Short brand description…"
                />
              </Field>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setField("is_active", e.target.checked)}
                  className="accent-[#e77600] w-4 h-4"
                />
                Active
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded text-sm font-medium border border-[#a88734] bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b] hover:from-[#f5d78e] hover:to-[#eeb933] text-gray-900 disabled:opacity-60 transition-all"
            >
              {saving ? "Saving…" : "Save brand"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setErrors({});
              }}
              className="px-5 py-2 rounded text-sm font-medium border border-gray-400 bg-white hover:bg-gray-50 text-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Brand list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : paginated.length === 0 ? (
        <p className="text-sm text-gray-500 italic">
          {search ? `No brands matching "${search}".` : "No brands yet. Add one above."}
        </p>
      ) : (
        <div className="space-y-2">
          {paginated.map((b, i) => (
            <div
              key={b.id ?? i}
              className="flex items-center gap-4 px-4 py-3 bg-white border border-gray-200 rounded-lg"
            >
              {b.logo ? (
                <img
                  src={b.logo}
                  alt={b.name}
                  className="w-10 h-10 object-contain rounded border border-gray-100"
                />
              ) : (
                <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-base font-bold text-gray-300">
                  {(b.name ?? "?")[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{b.name}</p>
                {b.description && (
                  <p className="text-xs text-gray-400 truncate">
                    {b.description}
                  </p>
                )}
              </div>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                  b.is_active
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-gray-100 text-gray-500 border-gray-200"
                }`}
              >
                {b.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Pagination controls */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            ← Previous
          </button>
          <span className="text-xs text-gray-500">
            Page {page} of {totalPages} &nbsp;·&nbsp; {totalCount} brand{totalCount !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// ── Tab 4: Q&A ────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch product detail for each product to collect questions.
 * Each question carries an endpoint URL like:
 *   "http://127.0.0.1:8000/user/product/seller-ans/3"
 * We extract the QnA ID from it to call PATCH.
 */

function AnswerBox({ question, qnaId, onAnswered }) {
  const [text, setText] = useState(question.answer ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(!!question.answer);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) {
      setError("Answer cannot be empty.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await client.patch(`/user/product/seller-ans/${qnaId}`, {
        answer: text.trim(),
      });
      setSaved(true);
      onAnswered?.();
    } catch (err) {
      const d = err.response?.data ?? {};
      setError(
        d.answer?.[0] || d.detail || d.error || "Could not save answer.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex gap-2 items-start">
      <textarea
        rows={2}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError("");
        }}
        placeholder="Write your answer…"
        className={[
          "flex-1 px-3 py-2 text-sm border rounded outline-none resize-none transition-all",
          "focus:border-[#e77600] focus:ring-[3px] focus:ring-[rgba(228,121,17,0.5)]",
          error ? "border-red-500" : "border-gray-300",
        ].join(" ")}
      />
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 rounded text-xs font-medium border border-[#a88734] bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b] hover:from-[#f5d78e] hover:to-[#eeb933] text-gray-900 disabled:opacity-60 whitespace-nowrap"
        >
          {saving ? "…" : saved ? "Update" : "Post answer"}
        </button>
        {error && <p className="text-[10px] text-red-600">⚠ {error}</p>}
        {saved && !saving && !error && (
          <p className="text-[10px] text-green-600 text-center">✓ Saved</p>
        )}
      </div>
    </form>
  );
}

function QATab() {
  const [productQAs, setProductQAs] = useState([]); // [{ productName, productId, questions: [{...}] }]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadQA = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // 1. Get all products (handle paginated or plain-array response)
      const { data: products } = await client.get("/user/products/");
      const list = Array.isArray(products)
        ? products
        : Array.isArray(products?.results)
          ? products.results
          : [];

      // 2. For each product, fetch detail to get questions
      const results = await Promise.allSettled(
        list.map(async (p) => {
          const pid = extractId(p.product_detail);
          if (!pid) return null;
          try {
            const { data: detail } = await client.get(
              `/user/product/detail/${pid}`,
            );
            const questions = (detail.questions ?? []).map((q) => ({
              question: q.question,
              answer: q.answer,
              qnaId: extractId(q.endpoint),
              endpoint: q.endpoint,
            }));
            return {
              productName: p.product_name,
              productId: pid,
              questions,
            };
          } catch {
            return null;
          }
        }),
      );

      const merged = results
        .filter((r) => r.status === "fulfilled" && r.value !== null)
        .map((r) => r.value)
        .filter((r) => r.questions.length > 0); // only show products that have questions

      setProductQAs(merged);
    } catch {
      setError("Failed to load Q&A data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQA();
  }, [loadQA]);

  if (loading)
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );

  if (error)
    return (
      <div className="text-sm text-red-600">
        {error}{" "}
        <button onClick={loadQA} className="ml-2 underline">
          Retry
        </button>
      </div>
    );

  if (productQAs.length === 0)
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-4xl mb-3">💬</p>
        <p className="font-medium text-gray-700">No customer questions yet.</p>
        <p className="text-sm mt-1">
          Questions from buyers will appear here once they start asking.
        </p>
      </div>
    );

  const totalUnanswered = productQAs.reduce(
    (s, pg) => s + pg.questions.filter((q) => !q.answer).length,
    0,
  );

  return (
    <div className="max-w-3xl space-y-6">
      {/* Summary */}
      {totalUnanswered > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-50 border border-yellow-300 rounded-lg text-sm">
          <span className="text-yellow-500 text-lg">⚠</span>
          <span className="text-yellow-800 font-medium">
            {totalUnanswered} unanswered{" "}
            {totalUnanswered === 1 ? "question" : "questions"} need your
            attention.
          </span>
        </div>
      )}

      {productQAs.map((pg) => {
        const unanswered = pg.questions.filter((q) => !q.answer).length;
        return (
          <div
            key={pg.productId}
            className="bg-white border border-gray-200 rounded-lg overflow-hidden"
          >
            {/* Product header */}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded flex items-center justify-center text-sm font-bold text-gray-300 flex-shrink-0"
                  style={{ backgroundColor: pseudoColor(pg.productName) }}
                >
                  {(pg.productName ?? "?")[0].toUpperCase()}
                </div>
                <div>
                  <Link
                    to={`/product/${pg.productId}`}
                    className="text-sm font-semibold text-gray-800 hover:text-[#c7511f] hover:underline"
                  >
                    {pg.productName}
                  </Link>
                  <p className="text-[10px] text-gray-400">
                    {pg.questions.length}{" "}
                    {pg.questions.length === 1 ? "question" : "questions"}
                  </p>
                </div>
              </div>
              {unanswered > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300">
                  {unanswered} unanswered
                </span>
              )}
            </div>

            {/* Questions */}
            <div className="divide-y divide-gray-100">
              {pg.questions.map((q, qi) => {
                const isUnanswered = !q.answer;
                return (
                  <div
                    key={qi}
                    className={[
                      "px-5 py-4",
                      isUnanswered ? "bg-yellow-50/40" : "",
                    ].join(" ")}
                  >
                    {/* Question */}
                    <div className="flex items-start gap-2 mb-2">
                      <span className="flex-shrink-0 text-[11px] font-bold text-[#c7511f] bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 uppercase tracking-wide mt-0.5">
                        Q
                      </span>
                      <p className="text-sm text-gray-800">{q.question}</p>
                      {isUnanswered && (
                        <span className="flex-shrink-0 ml-auto text-[10px] font-semibold text-yellow-700 bg-yellow-100 border border-yellow-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          Needs answer
                        </span>
                      )}
                    </div>

                    {/* Existing answer */}
                    {q.answer && (
                      <div className="flex items-start gap-2 mb-3">
                        <span className="flex-shrink-0 text-[11px] font-bold text-[#007600] bg-green-50 border border-green-200 rounded px-1.5 py-0.5 uppercase tracking-wide mt-0.5">
                          A
                        </span>
                        <p className="text-sm text-gray-700">{q.answer}</p>
                      </div>
                    )}

                    {/* Answer form */}
                    {q.qnaId && (
                      <AnswerBox
                        question={q}
                        qnaId={q.qnaId}
                        onAnswered={loadQA}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Tab 5: Seller Orders (with buyer chat) ────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

const ORDER_STATUS = {
  pending: {
    label: "Pending",
    dot: "bg-yellow-400",
    badge: "bg-yellow-50 text-yellow-700 border-yellow-300",
  },
  processing: {
    label: "Processing",
    dot: "bg-blue-400",
    badge: "bg-blue-50 text-blue-700 border-blue-300",
  },
  shipped: {
    label: "Shipped",
    dot: "bg-purple-400",
    badge: "bg-purple-50 text-purple-700 border-purple-300",
  },
  delivered: {
    label: "Delivered",
    dot: "bg-green-500",
    badge: "bg-green-50 text-green-700 border-green-300",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-red-400",
    badge: "bg-red-50 text-red-700 border-red-300",
  },
  returned: {
    label: "Returned",
    dot: "bg-orange-400",
    badge: "bg-orange-50 text-orange-700 border-orange-300",
  },
};

function formatOrderDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d)
    ? iso
    : d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function SellerOrderCard({ order, currentUser, onUpdateStatus }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const status = order.status ?? "pending";
  const cfg = ORDER_STATUS[status] ?? ORDER_STATUS.pending;
  const items = order.items ?? [];
  const orderId = order.id ?? null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              Order date
            </p>
            <p className="text-gray-700 font-medium">
              {formatOrderDate(order.order_date)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              Buyer
            </p>
            <p className="text-gray-700 font-medium">
              {order.buyer_name ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              Total
            </p>
            <p className="text-gray-700 font-medium">
              {fmt(order.total_amount)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              Items
            </p>
            <p className="text-gray-700 font-medium">{items.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {orderId && (
            <span className="text-[11px] text-gray-400 font-mono">
              #{orderId}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${cfg.badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Items preview */}
      <div className="px-5 py-4">
        <div className="space-y-2 mb-3">
          {items.slice(0, expanded ? undefined : 2).map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded border border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-gray-300">
                  {(item.product_name ?? "?")[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {item.product_name}
                </p>
                {item.product_variant && (
                  <p className="text-xs text-gray-400">
                    Variant #{item.product_variant}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-xs text-gray-500">
                  Qty: <b>{item.quantity}</b>
                </span>
                {item.status === 'delivered' ? (
                  <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                    Delivered
                  </span>
                ) : (
                  <button
                    onClick={() => onUpdateStatus?.(item.id, "delivered")}
                    className="text-[10px] px-2 py-1 rounded border border-green-500 bg-white hover:bg-green-50 text-green-700 transition-all shadow-sm"
                  >
                    Mark Delivered
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {items.length > 2 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-[#007185] hover:underline mb-3"
          >
            {expanded
              ? "▲ Show less"
              : `▼ Show ${items.length - 2} more item${items.length - 2 > 1 ? "s" : ""}`}
          </button>
        )}

        {/* Shipping info */}
        {order.shipping_address && (
          <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
            📦 Ship to:{" "}
            {[
              order.shipping_address.house_no,
              order.shipping_address.street,
              order.shipping_address.city,
              order.shipping_address.state,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
        )}
      </div>

      {/* ── Chat drawer (fixed right-side panel) ──────────────── */}
      {chatOpen && orderId && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setChatOpen(false)}
          />
          {/* Slide-in panel */}
          <div
            className="fixed top-0 right-0 h-full z-50 w-[360px] flex flex-col bg-white shadow-2xl"
            style={{ animation: "chatSlideIn 0.25s ease-out" }}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <span className="text-sm font-semibold text-gray-800">
                💬 Chat with {order.buyer_name ?? "Buyer"}
              </span>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Close chat"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
            {/* Panel content */}
            <div className="flex-1 min-h-0">
              <OrderChatPanel
                orderId={orderId}
                currentUser={currentUser}
                otherPartyName={order.buyer_name ?? "Buyer"}
              />
            </div>
          </div>
          <style>{`
            @keyframes chatSlideIn {
              from { transform: translateX(100%); }
              to   { transform: translateX(0); }
            }
          `}</style>
        </>
      )}

      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-200 px-5 py-2.5 flex items-center justify-between">
        <button
          onClick={() => setChatOpen((v) => !v)}
          disabled={!orderId}
          className={[
            "flex items-center gap-1.5 text-xs font-medium transition-colors",
            chatOpen ? "text-[#c7511f]" : "text-[#007185] hover:text-[#c7511f]",
            !orderId ? "opacity-40 cursor-not-allowed" : "",
          ].join(" ")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="w-3.5 h-3.5"
          >
            <path
              fillRule="evenodd"
              d="M1 8.74c0 .983.713 1.825 1.69 1.943.764.092 1.534.163 2.31.21v2.607l3.918-2.606c.38.02.763.03 1.145.03 1.44 0 2.788-.233 3.985-.661.29-.104.549-.384.549-.743V5.26c0-.36-.26-.64-.55-.743A14.497 14.497 0 0 0 10.063 4H5.937A14.5 14.5 0 0 0 2.69 4.517C1.713 4.635 1 5.477 1 6.46v2.28Z"
              clipRule="evenodd"
            />
          </svg>
          {chatOpen ? "Hide chat" : `Chat with ${order.buyer_name ?? "Buyer"}`}
        </button>
        <span className="text-xs text-gray-400">{fmt(order.total_amount)}</span>
      </div>
    </div>
  );
}

function SellerOrdersTab() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await client.get("/user/seller/orders/");
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? data.results
          : [];
      setOrders(list);
    } catch {
      setError("Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpdateStatus = useCallback(async (itemId, newStatus) => {
    try {
      await client.patch(`/user/order-item/${itemId}/status/`, { status: newStatus });
      fetchOrders();
    } catch {
      alert("Failed to update status. Please try again.");
    }
  }, [fetchOrders]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  if (loading)
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );

  if (error)
    return (
      <div className="text-sm text-red-600">
        {error}{" "}
        <button onClick={fetchOrders} className="ml-2 underline">
          Retry
        </button>
      </div>
    );

  if (orders.length === 0)
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-4xl mb-3">📦</p>
        <p className="font-medium text-gray-700">No orders yet.</p>
        <p className="text-sm mt-1">
          Orders containing your products will appear here.
        </p>
      </div>
    );

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-xs text-gray-400">
        {orders.length} order{orders.length !== 1 ? "s" : ""} containing your
        products
      </p>
      {orders.map((order, idx) => (
        <SellerOrderCard
          key={order.id ?? idx}
          order={order}
          currentUser={user}
          onUpdateStatus={handleUpdateStatus}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page shell
// ─────────────────────────────────────────────────────────────────────────────
export default function SellerDashboard() {
  const [activeTab, setActiveTab] = useState("Products");
  const sellerStatus = useSellerCheck();

  if (sellerStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (sellerStatus === "none") {
    return (
      <div className="min-h-screen bg-[#eaeded]">
        <Header />

        <div className="max-w-xl mx-auto mt-10 bg-white p-6 rounded-lg shadow">
          <h1 className="text-2xl font-semibold mb-4">Become a Seller</h1>

          <p className="text-gray-600 mb-6">
            Register your business before creating products.
          </p>

          <SellerRegistrationForm onSuccess={() => window.location.reload()} />
        </div>
      </div>
    );
  }

  // ← KEEP YOUR ORIGINAL DASHBOARD RETURN HERE

  return (
    <div className="min-h-screen bg-[#eaeded] flex flex-col">
      <Header />

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-3 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Seller Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage your products, brands, and customer Q&A
            </p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 min-h-[500px]">
          <TabBar active={activeTab} onChange={setActiveTab} />

          {activeTab === "Products" && <ProductsTab />}
          {activeTab === "Create Product" && <CreateProductTab onGoToDashboard={() => setActiveTab("Products")} />}
          {activeTab === "Brands" && <BrandsTab />}
          {activeTab === "Q&A" && <QATab />}
          {activeTab === "Orders" && <SellerOrdersTab />}
        </div>
      </main>
    </div>
  );
}
