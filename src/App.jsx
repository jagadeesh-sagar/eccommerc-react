import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { AIChatProvider, useAIChat } from './context/AIChatContext'
import { fetchCSRF } from './utils/csrf'

import Footer from './components/Footer'
import AIChatWidget from './components/AIChatWidget'

// Lazy-load all pages so each becomes its own chunk — reduces initial JS bundle
const Login             = lazy(() => import('./pages/Login'))
const Register          = lazy(() => import('./pages/Register'))
const Home              = lazy(() => import('./pages/Home'))
const ProductDetail     = lazy(() => import('./pages/ProductDetail'))
const Cart              = lazy(() => import('./pages/Cart'))
const Checkout          = lazy(() => import('./pages/Checkout'))
const Orders            = lazy(() => import('./pages/Orders'))
const OrderConfirmation = lazy(() => import('./pages/OrderConfirmation'))
const Wishlist          = lazy(() => import('./pages/Wishlist'))
const SellerDashboard   = lazy(() => import('./pages/SellerDashboard'))

// ---------------------------------------------------------------------------
// Full-page loading spinner (shown while session restore is in-flight)
// ---------------------------------------------------------------------------

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-[#f7f6f2] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-stone-200" />
          <div className="absolute inset-0 rounded-full border-4 border-stone-900 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-medium text-stone-500">Loading Chatram…</p>
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
// Layout wrapper — Header rendered by pages; Footer & AI Copilot shown globally
// ---------------------------------------------------------------------------

function Layout({ children }) {
  const { isOpen, isDocked } = useAIChat()
  const location = useLocation()
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register'

  return (
    <div
      className={[
        'flex flex-col min-h-screen bg-[#f7f6f2] text-stone-900 transition-[padding] duration-300',
        isOpen && isDocked ? 'lg:pr-[420px]' : '',
      ].join(' ')}
    >
      <main className="flex-1 flex flex-col">{children}</main>
      {!isAuthPage && <Footer />}
      {/* AI-MCP Shopping Copilot — floating popover or docked sidebar */}
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
      <Suspense fallback={<AuthLoadingScreen />}>
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
      </Suspense>
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
          <AIChatProvider>
            <AppRoutes />
          </AIChatProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
