/**
 * Header — Amazon-style site-wide navigation bar.
 *
 * Row 1 (black #131921):
 *   [Logo]  [Search bar + orange button]  [Account]  [Returns & Orders]  [Cart]
 *
 * Row 2 (slightly lighter #232f3e):
 *   Category filter links fetched from GET /user/product/categories/
 *
 * Search navigates to /?n=<term>  (Home reads the query param)
 * Category links navigate to     /?ct=<name>
 */

import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import client from '../api/client'

// ---------------------------------------------------------------------------
// SVG Icons (inline — no extra dep)
// ---------------------------------------------------------------------------

function CartIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-7 h-7"
    >
      <path d="M2.25 2.25a.75.75 0 0 0 0 1.5h1.386c.17 0 .318.114.362.278l2.558 9.592a3.752 3.752 0 0 0-2.806 3.63c0 .414.336.75.75.75h15.75a.75.75 0 0 0 0-1.5H5.378A2.25 2.25 0 0 1 7.5 15h11.218a.75.75 0 0 0 .674-.421 60.358 60.358 0 0 0 2.96-7.228.75.75 0 0 0-.525-.965A60.864 60.864 0 0 0 5.68 4.509l-.232-.867A1.875 1.875 0 0 0 3.636 2.25H2.25ZM16.5 18a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM9 18a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-5 h-5"
    >
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className="w-4 h-4"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export default function Header() {
  const { user, isAuthenticated, isSeller, isBuyer, logout } = useAuth()
  const { cartCount } = useCart()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Search input — pre-fill from URL
  const [query, setQuery] = useState(searchParams.get('n') ?? '')

  // Categories for the second nav strip and sidebar
  const [categories, setCategories] = useState([])
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  const accountRef = useRef(null)

  // Close sidebar on Escape
  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  // Lock body scroll when sidebar is open
  useEffect(() => {
    if (isSidebarOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
  }, [isSidebarOpen])

  // Fetch categories once on mount
  useEffect(() => {
    client
      .get('/user/product/categories/')
      .then(({ data }) => setCategories(Array.isArray(data) ? data : (data?.results ?? [])))
      .catch(() => {})
  }, [])

  // Close account dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Sync search input with URL (e.g. when user presses browser back)
  useEffect(() => {
    setQuery(searchParams.get('n') ?? '')
  }, [searchParams])

  function handleSearch(e) {
    e.preventDefault()
    const term = query.trim()
    if (term) {
      navigate(`/?n=${encodeURIComponent(term)}`)
    } else {
      navigate('/')
    }
  }

  function handleCategoryClick(catName) {
    setSidebarOpen(false)
    navigate(`/?ct=${encodeURIComponent(catName)}`)
  }

  async function handleLogout() {
    setAccountMenuOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-50">
      {/* ── Row 1 (Desktop) / Rows 1 & 2 (Mobile) ────────────────────────── */}
      <div className="bg-[#131921] text-white px-3 py-2 flex flex-col gap-2">
        
        {/* Top Row: Logo, Search (hidden on mobile), Account, Orders, Cart */}
        <div className="flex items-center justify-between gap-2">
          
          {/* Logo */}
          <Link
            to="/"
            className="flex-shrink-0 border border-transparent hover:border-white rounded px-1 py-0.5 transition-colors mr-1"
          >
            <span className="text-[#ff9900] font-extrabold text-xl tracking-tight leading-none font-serif">
              Chatram
            </span>
            <span className="text-white text-[10px] block -mt-0.5 leading-none">
              
            </span>
          </Link>

          {/* Desktop Search bar */}
          <form
            onSubmit={handleSearch}
            className="hidden sm:flex flex-1 min-w-0 rounded overflow-hidden h-10"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, brands and more"
              className="flex-1 min-w-0 px-3 py-2 text-sm text-gray-900 bg-white outline-none"
            />
            <button
              type="submit"
              className="flex-shrink-0 w-12 flex items-center justify-center bg-[#febd69] hover:bg-[#f3a847] text-[#131921] transition-colors"
              aria-label="Search"
            >
              <SearchIcon />
            </button>
          </form>

          {/* Right side group: Account, Orders, Cart */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Account dropdown */}
        <div className="relative flex-shrink-0" ref={accountRef}>
          <button
            onClick={() =>
              isAuthenticated
                ? setAccountMenuOpen((o) => !o)
                : navigate('/login')
            }
            className="flex flex-col items-start border border-transparent hover:border-white rounded px-2 py-1 transition-colors text-left"
          >
            <span className="text-[11px] text-gray-300 leading-tight">
              Hello, {user?.username ?? 'sign in'}
            </span>
            <span className="text-sm font-bold leading-tight">
              Account &amp; Lists ▾
            </span>
          </button>

          {/* Dropdown */}
          {accountMenuOpen && isAuthenticated && (
            <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded shadow-xl z-50 text-gray-800 text-sm py-2">
              {/* Role badge */}
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-xs text-gray-400 uppercase tracking-wide">{user?.role_model}</p>
                <p className="text-sm font-semibold text-gray-800 truncate">{user?.username}</p>
              </div>

              {/* Buyer links */}
              {isBuyer && (
                <>
                  <Link to="/orders"   onClick={() => setAccountMenuOpen(false)} className="block px-4 py-2 hover:bg-gray-50">Your Orders</Link>
                  <Link to="/wishlist" onClick={() => setAccountMenuOpen(false)} className="block px-4 py-2 hover:bg-gray-50">Your Wishlist</Link>
                </>
              )}

              {/* Seller link */}
              {isSeller && (
                <Link
                  to="/seller"
                  onClick={() => setAccountMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-amber-50 text-[#c7511f] font-medium"
                >
                  <span>🏪</span> Seller Dashboard
                </Link>
              )}

              <div className="border-t border-gray-100 mt-1" />
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-red-600"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>

        {/* Returns & Orders */}
        <Link
          to="/orders"
          className="flex-shrink-0 flex flex-col items-start border border-transparent hover:border-white rounded px-2 py-1 transition-colors hidden sm:flex"
        >
          <span className="text-[11px] text-gray-300 leading-tight">Returns</span>
          <span className="text-sm font-bold leading-tight">&amp; Orders</span>
        </Link>

            {/* Cart */}
            <Link
              to="/cart"
              className="flex-shrink-0 flex items-end gap-1 border border-transparent hover:border-white rounded px-2 py-1 transition-colors"
            >
              <div className="relative">
                <CartIcon />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-[#ff9900] text-[#131921] text-[11px] font-extrabold rounded-full px-0.5 leading-none">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </div>
              <span className="text-sm font-bold hidden sm:inline">Cart</span>
            </Link>
          </div>
        </div>

        {/* Mobile Search bar */}
        <form
          onSubmit={handleSearch}
          className="flex sm:hidden w-full rounded overflow-hidden h-10"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, brands and more"
            className="flex-1 min-w-0 px-3 py-2 text-sm text-gray-900 bg-white outline-none"
          />
          <button
            type="submit"
            className="flex-shrink-0 w-12 flex items-center justify-center bg-[#febd69] hover:bg-[#f3a847] text-[#131921] transition-colors"
            aria-label="Search"
          >
            <SearchIcon />
          </button>
        </form>

      </div>

      {/* ── Row 2 — Category strip ────────────────────────────────────── */}
      <div className="bg-[#232f3e] text-white px-3 flex items-center gap-2 overflow-x-auto scrollbar-none h-10">
        {/* "All" hamburger */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1 text-sm font-bold hover:bg-white/10 rounded transition-colors whitespace-nowrap"
        >
          <MenuIcon />
          All
        </button>

        {/* Seller Dashboard pill — only visible to sellers */}
        {isSeller && (
          <Link
            to="/seller"
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1 my-1 rounded-full text-xs font-bold bg-[#febd69] text-[#131921] hover:bg-[#f3a847] transition-colors whitespace-nowrap"
          >
            🏪 Seller Hub
          </Link>
        )}
      </div>

      {/* ── Sidebar Drawer ────────────────────────────────────────────── */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[9999] flex">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 transition-opacity" 
            onClick={() => setSidebarOpen(false)}
          />
          
          {/* Drawer Panel */}
          <div className="relative w-80 max-w-[85vw] h-full bg-white flex flex-col shadow-2xl animate-slide-in-left">
            {/* Close button (outside panel on desktop, but inside flex container) */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute -right-12 top-4 w-10 h-10 flex items-center justify-center text-white hover:text-[#febd69] transition-colors"
              aria-label="Close Sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* User Hello Header */}
            <div className="bg-[#131921] text-white p-4 flex items-center gap-3 flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-lg font-bold">
                Hello, {user?.username ?? 'sign in'}
              </span>
            </div>

            {/* Scrollable Categories List */}
            <div className="flex-1 overflow-y-auto py-4">
              <div className="px-5 mb-2">
                <h3 className="text-lg font-bold text-gray-800">Shop By Category</h3>
              </div>
              <ul className="flex flex-col">
                <li key="all">
                  <button
                    onClick={() => { setSidebarOpen(false); navigate('/'); }}
                    className="w-full text-left px-5 py-3.5 text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-between group"
                  >
                    <span>All Products</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-400 group-hover:text-gray-800">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1.02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
                    </svg>
                  </button>
                </li>
                {categories.map((cat) => (
                  <li key={cat.name}>
                    <button
                      onClick={() => handleCategoryClick(cat.name)}
                      className="w-full text-left px-5 py-3.5 text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-between group"
                    >
                      <span className="capitalize">{cat.name}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-400 group-hover:text-gray-800">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1.02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
