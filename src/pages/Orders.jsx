/**
 * Orders — /orders   (isBuyer only)
 *
 * Fetches GET /user/order/ and renders each order as an Amazon-style card.
 *
 * Features:
 *   • Success banner when navigated from /checkout (state.orderPlaced)
 *   • Orders sorted newest → oldest by order_date
 *   • Color-coded status badge per order
 *   • Line-item list with product name, variant, quantity
 *   • Price breakdown: subtotal / tax / discount / total
 *   • Shipping address summary
 *   • Empty state illustration
 *   • Skeleton loading cards
 */

import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import Header from "../components/Header";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import OrderChatPanel from "../components/OrderChatPanel";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    dot: "bg-yellow-400",
    badge: "bg-yellow-50 text-yellow-700 border-yellow-300",
    icon: "🕐",
  },
  processing: {
    label: "Processing",
    dot: "bg-blue-400",
    badge: "bg-blue-50 text-blue-700 border-blue-300",
    icon: "⚙️",
  },
  shipped: {
    label: "Shipped",
    dot: "bg-purple-400",
    badge: "bg-purple-50 text-purple-700 border-purple-300",
    icon: "🚚",
  },
  delivered: {
    label: "Delivered",
    dot: "bg-green-500",
    badge: "bg-green-50 text-green-700 border-green-300",
    icon: "✅",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-red-400",
    badge: "bg-red-50 text-red-700 border-red-300",
    icon: "✕",
  },
  returned: {
    label: "Returned",
    dot: "bg-orange-400",
    badge: "bg-orange-50 text-orange-700 border-orange-300",
    icon: "↩",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatPrice(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return (
    "₹" +
    n.toLocaleString("en-IN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function addressOneLiner(addr) {
  if (!addr) return "—";
  return [
    addr.house_no,
    addr.street,
    addr.city,
    addr.state,
    addr.postal_code,
    addr.country,
  ]
    .filter(Boolean)
    .join(", ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    dot: "bg-gray-400",
    badge: "bg-gray-100 text-gray-600 border-gray-300",
    icon: "•",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${cfg.badge}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function OrderSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden animate-pulse">
      {/* Header bar */}
      <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex justify-between">
        <div className="space-y-1.5">
          <div className="h-3 bg-gray-200 rounded w-28" />
          <div className="h-3 bg-gray-200 rounded w-20" />
        </div>
        <div className="h-6 bg-gray-200 rounded-full w-20" />
      </div>
      {/* Body */}
      <div className="p-5 space-y-3">
        <div className="flex gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-2/3" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
          </div>
        </div>
        <div className="h-px bg-gray-100 mt-2" />
        <div className="flex justify-between pt-1">
          <div className="h-3 bg-gray-200 rounded w-24" />
          <div className="h-4 bg-gray-200 rounded w-20" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyOrders() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-6 py-20 text-center">
      {/* Inline SVG illustration */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 160"
        className="w-44 h-36 mx-auto mb-6"
        aria-hidden="true"
      >
        <circle cx="100" cy="80" r="70" fill="#f0f2f2" />
        {/* Box */}
        <rect
          x="55"
          y="60"
          width="90"
          height="70"
          rx="6"
          fill="#fff"
          stroke="#d5d9d9"
          strokeWidth="2"
        />
        {/* Lid */}
        <rect
          x="50"
          y="50"
          width="100"
          height="18"
          rx="4"
          fill="#febd69"
          stroke="#f0c14b"
          strokeWidth="1.5"
        />
        {/* Tape stripe */}
        <rect x="95" y="50" width="10" height="18" fill="#f0c14b" />
        {/* Lines inside box */}
        <line
          x1="70"
          y1="90"
          x2="130"
          y2="90"
          stroke="#e5e7eb"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="70"
          y1="102"
          x2="115"
          y2="102"
          stroke="#e5e7eb"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="70"
          y1="114"
          x2="120"
          y2="114"
          stroke="#e5e7eb"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Question mark */}
        <text
          x="100"
          y="86"
          textAnchor="middle"
          fontSize="26"
          fontWeight="bold"
          fill="#d1d5db"
        >
          ?
        </text>
      </svg>

      <h2 className="text-xl font-semibold text-gray-800 mb-2">
        No orders yet
      </h2>
      <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
        You haven't placed any orders yet. Start shopping and your orders will
        appear here.
      </p>
      <Link
        to="/"
        className="inline-block px-6 py-2.5 rounded text-sm font-medium border border-[#a88734] bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b] hover:from-[#f5d78e] hover:to-[#eeb933] text-gray-900 transition-all shadow-sm"
      >
        Start shopping
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single order card
// ─────────────────────────────────────────────────────────────────────────────

function OrderCard({ order, index, currentUser, onUpdateStatus }) {
  const [expanded, setExpanded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const items = order.items ?? [];
  const shipAddr = order.shipping_address;
  const status = order.status ?? "pending";
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const totalQty = items.reduce((s, i) => s + (i.quantity ?? 1), 0);

  // order.id is the PK returned by the API — used as the WebSocket room key
  const orderId = order.id ?? null

  // Fake display number from index
  const orderNum = String(index + 1).padStart(3, "0");

  const showDiscount =
    order.discount_amount && parseFloat(order.discount_amount) > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      {/* ── Card header ────────────────────────────────────────── */}
      <div className="bg-gray-50 border-b border-gray-200 px-5 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* Left — metadata */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
            <div>
              <p className="uppercase tracking-wide font-semibold text-gray-400 text-[10px]">
                Order placed
              </p>
              <p className="text-gray-700 font-medium">
                {formatDate(order.order_date)}
                {order.order_date && (
                  <span className="text-gray-400 ml-1">
                    {formatTime(order.order_date)}
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="uppercase tracking-wide font-semibold text-gray-400 text-[10px]">
                Total
              </p>
              <p className="text-gray-700 font-medium">
                {formatPrice(order.total_amount)}
              </p>
            </div>
            <div>
              <p className="uppercase tracking-wide font-semibold text-gray-400 text-[10px]">
                Items
              </p>
              <p className="text-gray-700 font-medium">
                {totalQty} {totalQty === 1 ? "item" : "items"}
              </p>
            </div>
            <div className="hidden sm:block">
              <p className="uppercase tracking-wide font-semibold text-gray-400 text-[10px]">
                Ship to
              </p>
              <p className="text-gray-700 font-medium truncate max-w-[180px]">
                {shipAddr?.user ?? "—"}
              </p>
            </div>
          </div>

          {/* Right — order number + status */}
          <div className="flex flex-col items-end gap-1.5">
            <p className="text-[11px] text-gray-400">
              Order{" "}
              <span className="font-mono font-medium text-gray-600">
                #{orderNum}
              </span>
            </p>
            <StatusBadge status={status} />
          </div>
        </div>
      </div>

      {/* ── Card body ──────────────────────────────────────────── */}
      <div className="px-5 py-4">
        {/* Status message bar */}
        <div
          className={`flex items-center gap-2 mb-4 text-sm font-medium ${STATUS_CONFIG[status]?.badge.replace("border-", "text-").split(" ")[1] ?? "text-gray-600"}`}
        >
          <span>{cfg.icon}</span>
          <span>
            {status === "delivered" && "Your order has been delivered."}
            {status === "shipped" && "Your order is on its way!"}
            {status === "processing" && "Your order is being prepared."}
            {status === "pending" &&
              "Your order is confirmed and awaiting processing."}
            {status === "cancelled" && "This order has been cancelled."}
            {status === "returned" && "This order has been returned."}
          </span>
        </div>

        {/* Items list */}
        <div className="space-y-3 mb-4">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-10 h-10 rounded border border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0">
                <span className="text-base font-bold text-gray-300 select-none">
                  {(item.product_name ?? "?")[0].toUpperCase()}
                </span>
              </div>

              {/* Name + variant */}
              <div className="flex-1 min-w-0">
                <Link
                  to={`/product/${item.product}`}
                  className="text-sm font-medium text-gray-800 hover:text-[#c7511f] hover:underline line-clamp-1"
                >
                  {item.product_name}
                </Link>
                {item.product_variant && (
                  <p className="text-xs text-gray-400">
                    Variant #{item.product_variant}
                  </p>
                )}
              </div>

              {/* Quantity & Status */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0 whitespace-nowrap">
                <span className="text-sm text-gray-500">
                  Qty:{" "}
                  <span className="font-semibold text-gray-700">
                    {item.quantity}
                  </span>
                </span>
                {item.status && item.status !== 'pending' && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border capitalize ${
                    item.status === 'delivered' ? 'text-green-700 bg-green-50 border-green-200' :
                    item.status === 'shipped' ? 'text-purple-700 bg-purple-50 border-purple-200' :
                    item.status === 'processing' ? 'text-blue-700 bg-blue-50 border-blue-200' :
                    'text-gray-600 bg-gray-50 border-gray-200'
                  }`}>
                    {item.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Expand / collapse toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-[#007185] hover:text-[#c7511f] hover:underline font-medium flex items-center gap-1 transition-colors mb-3"
        >
          {expanded ? (
            <>
              Hide order details <span className="text-[10px]">▲</span>
            </>
          ) : (
            <>
              View order details <span className="text-[10px]">▼</span>
            </>
          )}
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t border-gray-100 pt-4 space-y-4">
            {/* Price breakdown */}
            <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-1.5 text-sm">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Price details
              </p>

              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>

              {showDiscount && (
                <div className="flex justify-between text-[#007600]">
                  <span>Discount</span>
                  <span>− {formatPrice(order.discount_amount)}</span>
                </div>
              )}

              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span className="text-[#007600] font-medium">
                  {parseFloat(order.shipping_cost ?? 0) === 0
                    ? "FREE"
                    : formatPrice(order.shipping_cost)}
                </span>
              </div>

              <div className="flex justify-between text-gray-600">
                <span>GST (18%)</span>
                <span>{formatPrice(order.tax_amount)}</span>
              </div>

              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 mt-1 text-base">
                <span>Order Total</span>
                <span className="text-[#B12704]">
                  {formatPrice(order.total_amount)}
                </span>
              </div>
            </div>

            {/* Addresses */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Shipping */}
              <div className="border border-gray-200 rounded-lg p-3 bg-white">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  Delivered to
                </p>
                {shipAddr ? (
                  <>
                    <p className="text-sm font-semibold text-gray-700 capitalize mb-0.5">
                      {shipAddr.user}
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {addressOneLiner(shipAddr)}
                    </p>
                    {shipAddr.phone_number && (
                      <p className="text-xs text-gray-400 mt-1">
                        📞 {shipAddr.phone_number}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-gray-400">Address not available</p>
                )}
              </div>

              {/* Billing */}
              {order.billing_address && (
                <div className="border border-gray-200 rounded-lg p-3 bg-white">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                    Billed to
                  </p>
                  <p className="text-sm font-semibold text-gray-700 capitalize mb-0.5">
                    {order.billing_address.user}
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {addressOneLiner(order.billing_address)}
                  </p>
                </div>
              )}
            </div>
          </div>
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
            style={{ animation: 'chatSlideIn 0.25s ease-out' }}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <span className="text-sm font-semibold text-gray-800">💬 Order Chat</span>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Close chat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
            {/* Panel content */}
            <div className="flex-1 min-h-0">
              <OrderChatPanel
                orderId={orderId}
                currentUser={currentUser}
                otherPartyName="Seller"
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

      {/* ── Card footer ────────────────────────────────────────── */}
      <div className="bg-gray-50 border-t border-gray-200 px-5 py-2.5 flex flex-wrap gap-3 items-center justify-between">
        {/* Left — chat toggle */}
        <button
          onClick={() => setChatOpen((v) => !v)}
          disabled={!orderId}
          className={[
            "flex items-center gap-1.5 text-xs font-medium transition-colors",
            chatOpen ? "text-[#c7511f]" : "text-[#007185] hover:text-[#c7511f]",
            !orderId ? "opacity-40 cursor-not-allowed" : "",
          ].join(" ")}
          aria-expanded={chatOpen}
        >
          {/* Chat bubble icon */}
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
          {chatOpen ? "Hide chat" : "Chat with Seller"}
        </button>

        {/* Right — order actions */}
        <div className="flex flex-wrap gap-3">
          <Link
            to="/"
            className="text-xs text-[#007185] hover:text-[#c7511f] hover:underline font-medium transition-colors"
          >
            Buy again
          </Link>
          {status !== "cancelled" &&
            status !== "delivered" &&
            status !== "returned" && (
              <>
                <span className="text-gray-300 text-xs">|</span>
                <button className="text-xs text-[#007185] hover:text-[#c7511f] hover:underline font-medium transition-colors">
                  Cancel order
                </button>
              </>
            )}
          {status === "delivered" && (
            <>
              <span className="text-gray-300 text-xs">|</span>
              <Link
                to={`/product/${items[0]?.product}`}
                className="text-xs text-[#007185] hover:text-[#c7511f] hover:underline font-medium transition-colors"
              >
                Write a review
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function Orders() {
  const location = useLocation();
  const { user } = useAuth();
  const justOrdered = location.state?.orderPlaced === true;

  const [orders,     setOrders]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [showBanner, setShowBanner] = useState(justOrdered);

  // Pagination state
  const [totalCount, setTotalCount] = useState(0);
  const [nextUrl,    setNextUrl]    = useState(null);
  const [prevUrl,    setPrevUrl]    = useState(null);
  const [currentUrl, setCurrentUrl] = useState("/user/order/");

  const fetchOrders = useCallback(async (url) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await client.get(url);

      if (Array.isArray(data)) {
        // Non-paginated response
        setOrders(data);
        setTotalCount(data.length);
        setNextUrl(null);
        setPrevUrl(null);
      } else {
        // DRF paginated: { count, next, previous, results }
        const list = Array.isArray(data.results) ? data.results : [];
        setOrders(list);
        setTotalCount(data.count ?? list.length);
        // Strip the host from next/prev so axios baseURL isn't doubled
        setNextUrl(data.next ? data.next.replace(/^https?:\/\/[^/]+/, "") : null);
        setPrevUrl(data.previous ? data.previous.replace(/^https?:\/\/[^/]+/, "") : null);
      }
    } catch {
      setError("Failed to load orders. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpdateStatus = useCallback(async (orderId, newStatus) => {
    try {
      await client.patch(`/user/order/${orderId}/status/`, { status: newStatus });
      fetchOrders(currentUrl);
    } catch {
      alert("Failed to update status. Please try again.");
    }
  }, [currentUrl, fetchOrders]);

  useEffect(() => { fetchOrders(currentUrl); }, [currentUrl, fetchOrders]);

  // Auto-dismiss success banner after 6 seconds
  useEffect(() => {
    if (!showBanner) return;
    const t = setTimeout(() => setShowBanner(false), 6000);
    return () => clearTimeout(t);
  }, [showBanner]);

  function goTo(url) {
    if (!url) return;
    setCurrentUrl(url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-[#eaeded] flex flex-col">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-3 sm:px-6 py-6">
        {/* ── Order placed success banner ─────────────────────── */}
        {showBanner && (
          <div className="mb-5 flex items-start gap-3 px-5 py-4 bg-[#e7f4e4] border border-[#5a9e5a] rounded-lg shadow-sm">
            <span className="text-2xl flex-shrink-0">🎉</span>
            <div className="flex-1">
              <p className="font-semibold text-[#2d6a2d] text-sm">
                Order placed successfully!
              </p>
              <p className="text-xs text-[#3a7a3a] mt-0.5">
                Thank you for shopping with ShopZone. We'll send you an update
                once your order is processed.
              </p>
            </div>
            <button
              onClick={() => setShowBanner(false)}
              className="text-[#5a9e5a] hover:text-[#2d6a2d] text-lg leading-none flex-shrink-0"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* ── Page header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-semibold text-gray-900">Your Orders</h1>
          {!loading && totalCount > 0 && (
            <p className="text-sm text-gray-500">
              {totalCount} {totalCount === 1 ? "order" : "orders"}
            </p>
          )}
        </div>

        {/* ── Error ───────────────────────────────────────────── */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-300 rounded-lg text-sm text-red-700">
            {error}
            <button onClick={() => fetchOrders(currentUrl)} className="ml-3 underline font-medium">
              Retry
            </button>
          </div>
        )}

        {/* ── Content ─────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <OrderSkeleton key={i} />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyOrders />
        ) : (
          <>
            <div className="space-y-4">
              {orders.map((order, idx) => (
                <OrderCard
                  key={order.id ?? idx}
                  order={order}
                  index={idx}
                  currentUser={user}
                  onUpdateStatus={handleUpdateStatus}
                />
              ))}
            </div>

            {/* ── Pagination controls ──────────────────────────── */}
            {(prevUrl || nextUrl) && (
              <div className="flex items-center justify-between mt-6 px-1">
                <button
                  onClick={() => goTo(prevUrl)}
                  disabled={!prevUrl}
                  className={[
                    "flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium border transition-all",
                    prevUrl
                      ? "border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
                      : "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed",
                  ].join(" ")}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                  </svg>
                  Previous
                </button>

                <p className="text-xs text-gray-400">
                  Showing {orders.length} of {totalCount} orders
                </p>

                <button
                  onClick={() => goTo(nextUrl)}
                  disabled={!nextUrl}
                  className={[
                    "flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium border transition-all",
                    nextUrl
                      ? "border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
                      : "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed",
                  ].join(" ")}
                >
                  Next
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06L7.28 11.78a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
