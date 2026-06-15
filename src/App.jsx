import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { fetchCSRF } from './utils/csrf'

import Footer from './components/Footer'
import AIChatWidget from './components/AIChatWidget'

import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import Orders from './pages/Orders'
import OrderConfirmation from './pages/OrderConfirmation'
import Wishlist from './pages/Wishlist'
import SellerDashboard from './pages/SellerDashboard'

// ---------------------------------------------------------------------------
// Full-page loading spinner (shown while session restore is in-flight)
// ---------------------------------------------------------------------------

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-[#eaecf0] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Spinning ring */}
        <div className="w-12 h-12 rounded-full border-4 border-[#febd69] border-t-transparent animate-spin" />
        <p className="text-sm text-[#555]">Loading…</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Route guards
// ---------------------------------------------------------------------------

/**
 * ProtectedRoute — redirects unauthenticated users to /login.
 * Blocks rendering while auth state is still being determined.
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, authReady } = useAuth()
  const location = useLocation()

  if (!authReady) return <AuthLoadingScreen />
  if (!isAuthenticated) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  return children
}

/**
 * GuestRoute — bounces already-authenticated users back to /.
 */
function GuestRoute({ children }) {
  const { isAuthenticated, authReady } = useAuth()
  if (!authReady) return <AuthLoadingScreen />
  if (isAuthenticated) return <Navigate to="/" replace />
  return children
}

/**
 * BuyerRoute — accessible only to authenticated buyers.
 */
function BuyerRoute({ children }) {
  const { isAuthenticated, isBuyer, authReady } = useAuth()
  const location = useLocation()

  if (!authReady) return <AuthLoadingScreen />
  if (!isAuthenticated) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  if (!isBuyer) return <Navigate to="/" replace />
  return children
}

/**
 * SellerRoute — accessible only to authenticated sellers.
 */
function SellerRoute({ children }) {
  const { isAuthenticated, authReady } = useAuth()
  const location = useLocation()

  if (!authReady) return <AuthLoadingScreen />
  if (!isAuthenticated) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  
  // We don't block buyers here because SellerDashboard handles rendering the registration form.
  return children
}

// ---------------------------------------------------------------------------
// Layout wrapper — Header rendered by each page; Footer shown globally
// ---------------------------------------------------------------------------

function Layout({ children }) {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">{children}</main>
      <Footer />
      {/* AI Shopping Assistant — floats above all pages */}
      <AIChatWidget />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Route table — must be inside AuthProvider so guards can call useAuth()
// ---------------------------------------------------------------------------

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        {/* ── Auth pages (redirect away when already logged in) ── */}
        <Route
          path="/login"
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestRoute>
              <Register />
            </GuestRoute>
          }
        />

        {/* ── Public pages ── */}
        <Route path="/" element={<Home />} />
        <Route path="/product/:id" element={<ProductDetail />} />

        {/* ── Buyer-only pages ── */}
        <Route
          path="/cart"
          element={
            <BuyerRoute>
              <Cart />
            </BuyerRoute>
          }
        />
        <Route
          path="/checkout"
          element={
            <BuyerRoute>
              <Checkout />
            </BuyerRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <BuyerRoute>
              <Orders />
            </BuyerRoute>
          }
        />
        <Route
          path="/order-confirmation"
          element={
            <BuyerRoute>
              <OrderConfirmation />
            </BuyerRoute>
          }
        />
        <Route
          path="/wishlist"
          element={
            <BuyerRoute>
              <Wishlist />
            </BuyerRoute>
          }
        />

        {/* ── Seller-only pages ── */}
        <Route
          path="/seller"
          element={
            <SellerRoute>
              <SellerDashboard />
            </SellerRoute>
          }
        />

        {/* ── Catch-all ── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

// ---------------------------------------------------------------------------
// App root — fetch CSRF token once on mount before any API call can happen
// ---------------------------------------------------------------------------

export default function App() {
  useEffect(() => {
    fetchCSRF().catch((err) =>
      console.warn('[App] CSRF prefetch failed:', err)
    )
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <AppRoutes />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
