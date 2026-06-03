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
      .get("/user/seller/registration/")
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        setStatus(list.length > 0 ? "exists" : "none");
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

function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    client
      .get("/user/products/")
      .then(({ data }) => {
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : [];
        setProducts(list);
      })
      .catch(() => setError("Failed to load products."))
      .finally(() => setLoading(false));
  }, []);

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
    <div className="space-y-3">
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

            {/* Link */}
            {pid && (
              <Link
                to={`/product/${pid}`}
                className="flex-shrink-0 text-xs text-[#007185] hover:text-[#c7511f] hover:underline font-medium"
              >
                View →
              </Link>
            )}
          </div>
        );
      })}
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

function ImageUploadStep({ productId, productName, onCreateAnother }) {
  const fileRef = useRef(null);
  // entry shape: { id, file, isVideo, status, url, error, isPrimary }
  const [uploads, setUploads] = useState([]);
  const [busy, setBusy] = useState(false);

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
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (fileRef.current) fileRef.current.value = "";

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

function CreateProductTab() {
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
            <select
              className={inputCls(errors.category) + " bg-white"}
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              <option value="">— Select category —</option>
              {categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Brand" error={errors.brand} required>
            <select
              className={inputCls(errors.brand) + " bg-white"}
              value={form.brand}
              onChange={(e) => set("brand", e.target.value)}
            >
              <option value="">— Select brand —</option>
              {brands.map((b) => (
                <option key={b.name ?? b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
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
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_BRAND);
  const [errors, setErrors] = useState({});
  const [globalErr, setGlobalErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  const fetchBrands = useCallback(() => {
    setLoading(true);
    client
      .get("/user/brand/")
      .then(({ data }) => {
        setBrands(
          Array.isArray(data)
            ? data
            : Array.isArray(data?.results)
              ? data.results
              : [],
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  function setField(f, v) {
    setForm((p) => ({ ...p, [f]: v }));
    setErrors((e) => ({ ...e, [f]: "" }));
  }

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
          <button
            onClick={() => setSuccess("")}
            className="text-green-500 hover:text-green-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Add brand button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm text-[#007185] hover:text-[#c7511f] font-medium transition-colors"
        >
          <span className="text-lg leading-none">+</span> Add new brand
        </button>
      )}

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
      ) : brands.length === 0 ? (
        <p className="text-sm text-gray-500 italic">
          No brands yet. Add one above.
        </p>
      ) : (
        <div className="space-y-2">
          {brands.map((b, i) => (
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

function SellerOrderCard({ order, currentUser }) {
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
        <div className="flex items-center gap-2">
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
              <span className="text-xs text-gray-500 flex-shrink-0">
                Qty: <b>{item.quantity}</b>
              </span>
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
          {activeTab === "Create Product" && <CreateProductTab />}
          {activeTab === "Brands" && <BrandsTab />}
          {activeTab === "Q&A" && <QATab />}
          {activeTab === "Orders" && <SellerOrdersTab />}
        </div>
      </main>
    </div>
  );
}
