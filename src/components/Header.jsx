/**
 * Header — Modern Chatram Navigation Bar with Hybrid Search + AI Omnibox
 *
 * Row 1:
 *   [Brand Logo] [Hybrid Search + "✨ Ask AI" Omnibox] [Wishlist] [Orders] [Account] [Cart]
 *
 * Row 2:
 *   [≡ All Categories] [Dynamic Category Pills from /user/product/categories/] [Quick Filter Pills] [Seller Hub]
 */

import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useAIChat } from '../context/AIChatContext'
import { SparkleIcon } from './AIChatWidget'
import client from '../api/client'

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------

function CartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
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
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  )
}

function HeartNavIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Header Component
// ---------------------------------------------------------------------------

export default function Header() {
  const { user, isAuthenticated, isSeller, isBuyer, logout } = useAuth()
  const { cartCount } = useCart()
  const { askAI, setIsOpen } = useAIChat()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const activeCategory = searchParams.get('ct') ?? ''
  const activeSort = searchParams.get('sort') ?? ''
  const activeDeals = searchParams.get('deals') === 'true'

  const [query, setQuery] = useState(searchParams.get('n') ?? '')
  const [categories, setCategories] = useState([])
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const accountRef = useRef(null)

  // State-aware sticky header shadow on scroll
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close sidebar on Escape
  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') {
        setSidebarOpen(false)
        setAccountMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  // Lock body scroll when sidebar is open
  useEffect(() => {
    if (isSidebarOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isSidebarOpen])

  // Fetch categories once on mount
  useEffect(() => {
    client
      .get('/user/product/categories/')
      .then(({ data }) => setCategories(Array.isArray(data) ? data : data?.results ?? []))
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

  // Sync search input with URL
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  function handleAskAIFromSearch() {
    const term = query.trim()
    if (term) {
      askAI(term, { autoSend: true })
    } else {
      setIsOpen(true)
    }
  }

  function handleCategoryClick(catName) {
    setSidebarOpen(false)
    if (!catName) {
      navigate('/')
    } else {
      navigate(`/?ct=${encodeURIComponent(catName)}`)
    }
  }

  async function handleLogout() {
    setAccountMenuOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <header
      className={[
        'sticky top-0 z-50 transition-shadow duration-200',
        scrolled ? 'shadow-lg shadow-slate-950/15' : '',
      ].join(' ')}
    >
      {/* ── Row 1: Primary Navigation Bar ────────────────────────────────── */}
      <div className="bg-slate-900/95 backdrop-blur-md text-white border-b border-slate-800">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3 sm:gap-5">
            {/* Brand Logo */}
            <Link
              to="/"
              className="shrink-0 flex items-center gap-2.5 group focus:outline-none"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-amber-500 p-[1px] shadow-md shadow-indigo-500/20">
                <div className="w-full h-full bg-slate-900 rounded-[11px] flex items-center justify-center group-hover:bg-slate-900/80 transition-colors">
                  <span className="text-lg font-extrabold bg-gradient-to-br from-white via-indigo-200 to-amber-300 bg-clip-text text-transparent">
                    C
                  </span>
                </div>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-xl tracking-tight text-white">
                    Chatram
                  </span>
                  <span className="hidden xl:inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                    AI
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium -mt-0.5 hidden sm:block">
                  Smart Shopping
                </span>
              </div>
            </Link>

            {/* Desktop Hybrid Search + AI Omnibox */}
            <form
              onSubmit={handleSearch}
              className="hidden md:flex flex-1 max-w-2xl items-center bg-slate-800/90 hover:bg-slate-800 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500 rounded-xl border border-slate-700/80 focus-within:border-indigo-500 overflow-hidden transition-all h-11 group"
            >
              <div className="pl-3.5 pr-2 text-slate-400 group-focus-within:text-slate-500">
                <SearchIcon />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products, brands, or ask AI Copilot…"
                className="flex-1 min-w-0 py-2 text-sm text-white group-focus-within:text-slate-900 placeholder-slate-400 bg-transparent outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    if (searchParams.get('n')) navigate('/')
                  }}
                  className="px-2 text-slate-400 hover:text-slate-600 text-xs"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
              <button
                type="submit"
                className="shrink-0 h-8 px-3.5 my-1 mr-1 rounded-lg text-xs font-semibold bg-slate-700 group-focus-within:bg-slate-100 text-slate-200 group-focus-within:text-slate-700 hover:bg-slate-600 group-focus-within:hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Search
              </button>
              <button
                type="button"
                onClick={handleAskAIFromSearch}
                title="Ask Chatram AI Copilot (Ctrl+K)"
                className="shrink-0 h-8 px-3 my-1 mr-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <SparkleIcon className="w-3.5 h-3.5 text-amber-300" />
                <span>Ask AI</span>
              </button>
            </form>

            {/* Right Navigation Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Mobile Ask AI button */}
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="md:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold"
              >
                <SparkleIcon className="w-3.5 h-3.5 text-amber-300" />
                <span>AI</span>
              </button>

              {/* Wishlist link (buyers) */}
              {(!isAuthenticated || isBuyer) && (
                <Link
                  to="/wishlist"
                  title="Wishlist"
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors text-xs font-semibold"
                >
                  <HeartNavIcon />
                  <span className="hidden xl:inline">Wishlist</span>
                </Link>
              )}

              {/* Orders link */}
              <Link
                to="/orders"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors text-xs font-semibold"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
                <span className="hidden lg:inline">Orders</span>
              </Link>

              {/* Account Dropdown */}
              <div className="relative shrink-0" ref={accountRef}>
                <button
                  onClick={() =>
                    isAuthenticated ? setAccountMenuOpen((o) => !o) : navigate('/login')
                  }
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-800/80 border border-transparent hover:border-slate-700 transition-colors text-left cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white uppercase shadow-xs">
                    {user?.username ? user.username[0] : '👤'}
                  </div>
                  <div className="hidden sm:flex flex-col">
                    <span className="text-[10px] text-slate-400 leading-tight">
                      {isAuthenticated ? `Hi, ${user?.username}` : 'Welcome'}
                    </span>
                    <span className="text-xs font-bold text-white leading-tight flex items-center gap-1">
                      {isAuthenticated ? 'Account' : 'Sign In'}
                      <span className="text-[10px] text-slate-400">▾</span>
                    </span>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {accountMenuOpen && isAuthenticated && (
                  <div className="absolute right-0 mt-2 w-60 bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 text-slate-800 text-sm py-2 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/60 mb-1">
                        {user?.role_model || 'Member'}
                      </span>
                      <p className="text-sm font-bold text-slate-900 truncate">{user?.username}</p>
                      {user?.email && (
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      )}
                    </div>

                    <div className="py-1">
                      {isBuyer && (
                        <>
                          <Link
                            to="/orders"
                            onClick={() => setAccountMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                          >
                            <span>📦</span> Your Orders
                          </Link>
                          <Link
                            to="/wishlist"
                            onClick={() => setAccountMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                          >
                            <span>❤️</span> Your Wishlist
                          </Link>
                          <Link
                            to="/cart"
                            onClick={() => setAccountMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                          >
                            <span>🛒</span> Shopping Cart ({cartCount})
                          </Link>
                        </>
                      )}

                      {isSeller && (
                        <Link
                          to="/seller"
                          onClick={() => setAccountMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                        >
                          <span>🏪</span> Seller Hub Dashboard
                        </Link>
                      )}

                      <button
                        onClick={() => {
                          setAccountMenuOpen(false)
                          setIsOpen(true)
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50/70 text-left cursor-pointer"
                      >
                        <SparkleIcon className="w-4 h-4 text-indigo-600" />
                        <span>Open AI Shopping Copilot</span>
                      </button>
                    </div>

                    <div className="border-t border-slate-100 mt-1 pt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Cart Button */}
              <Link
                to="/cart"
                className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xs transition-all"
              >
                <div className="relative">
                  <CartIcon />
                </div>
                <span className="hidden sm:inline">Cart</span>
                <span className="px-1.5 py-0.5 rounded-full bg-slate-950 text-amber-400 font-mono text-[11px] font-bold leading-none">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              </Link>
            </div>
          </div>

          {/* Mobile Search Bar */}
          <form
            onSubmit={handleSearch}
            className="flex md:hidden items-center bg-slate-800 focus-within:bg-white rounded-xl border border-slate-700 focus-within:border-indigo-500 overflow-hidden h-10 group"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products or ask AI…"
              className="flex-1 min-w-0 px-3 py-2 text-sm text-white group-focus-within:text-slate-900 placeholder-slate-400 bg-transparent outline-none"
            />
            <button
              type="submit"
              className="shrink-0 px-3 h-full flex items-center justify-center text-slate-300 group-focus-within:text-slate-700"
              aria-label="Search"
            >
              <SearchIcon />
            </button>
            <button
              type="button"
              onClick={handleAskAIFromSearch}
              className="shrink-0 h-8 px-2.5 mr-1 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center gap-1"
            >
              <SparkleIcon className="w-3.5 h-3.5 text-amber-300" />
              <span>AI</span>
            </button>
          </form>
        </div>
      </div>

      {/* ── Row 2: Category & Quick-Filter Strip ─────────────────────────── */}
      <div className="bg-slate-900 text-slate-300 border-b border-slate-800/80">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar h-10">
          <div className="flex items-center gap-1.5">
            {/* Categories Drawer Trigger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/80 transition-colors cursor-pointer"
            >
              <MenuIcon />
              <span>Categories</span>
            </button>

            <div className="h-4 w-[1px] bg-slate-800 mx-1 shrink-0" />

            {/* All Products Pill */}
            <button
              onClick={() => navigate('/')}
              className={[
                'shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
                !activeCategory && !activeSort && !activeDeals
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold'
                  : 'hover:bg-slate-800 hover:text-white',
              ].join(' ')}
            >
              All Products
            </button>

            {/* Dynamic Category Pills from Backend */}
            {categories.map((cat) => {
              const isSelected = activeCategory.toLowerCase() === cat.name.toLowerCase()
              return (
                <button
                  key={cat.name}
                  onClick={() => handleCategoryClick(cat.name)}
                  className={[
                    'shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors whitespace-nowrap cursor-pointer',
                    isSelected
                      ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
                      : 'hover:bg-slate-800 hover:text-white',
                  ].join(' ')}
                >
                  {cat.name}
                </button>
              )
            })}

            <div className="h-4 w-[1px] bg-slate-800 mx-1 shrink-0" />

            {/* Quick Smart Filters */}
            <button
              onClick={() => navigate('/?sort=rating')}
              className={[
                'shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
                activeSort === 'rating'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold'
                  : 'hover:bg-slate-800 hover:text-white',
              ].join(' ')}
            >
              ★ Top Rated
            </button>

            <button
              onClick={() => navigate('/?deals=true')}
              className={[
                'shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
                activeDeals
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
                  : 'hover:bg-slate-800 hover:text-white',
              ].join(' ')}
            >
              ⚡ Under ₹2,000
            </button>

            <button
              onClick={() => navigate('/?sort=newest')}
              className={[
                'shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
                activeSort === 'newest'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold'
                  : 'hover:bg-slate-800 hover:text-white',
              ].join(' ')}
            >
              🆕 New Releases
            </button>
          </div>

          {/* Right side of Row 2: Seller Hub or AI Finder trigger */}
          <div className="flex items-center gap-2 shrink-0">
            {isSeller && (
              <Link
                to="/seller"
                className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors whitespace-nowrap"
              >
                🏪 Seller Hub
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Slide-Over Category & Navigation Drawer ──────────────────────── */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[9999] flex">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />

          <div className="relative w-80 max-w-[85vw] h-full bg-white flex flex-col shadow-2xl">
            {/* Drawer Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white shadow-sm shrink-0">
                  {user?.username ? user.username[0].toUpperCase() : 'C'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Welcome to Chatram</p>
                  <p className="text-sm font-bold text-white truncate">
                    {user?.username ? `Hello, ${user.username}` : 'Hello, Sign in'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close Sidebar"
              >
                ✕
              </button>
            </div>

            {/* AI Copilot Callout inside Drawer */}
            <div className="p-4 border-b border-slate-100 bg-indigo-50/50">
              <button
                onClick={() => {
                  setSidebarOpen(false)
                  setIsOpen(true)
                }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <SparkleIcon className="w-4 h-4 text-amber-300" />
                  <span>Ask AI Shopping Copilot</span>
                </span>
                <span>→</span>
              </button>
            </div>

            {/* Scrollable Categories */}
            <div className="flex-1 overflow-y-auto scrollbar-thin py-4">
              <div className="px-5 mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Shop By Category
                </h3>
              </div>
              <ul className="flex flex-col px-2 space-y-0.5">
                <li>
                  <button
                    onClick={() => handleCategoryClick('')}
                    className={[
                      'w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-between cursor-pointer',
                      !activeCategory
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100',
                    ].join(' ')}
                  >
                    <span>All Products</span>
                    <span className="text-xs text-slate-400">→</span>
                  </button>
                </li>
                {categories.map((cat) => {
                  const isSelected = activeCategory.toLowerCase() === cat.name.toLowerCase()
                  return (
                    <li key={cat.name}>
                      <button
                        onClick={() => handleCategoryClick(cat.name)}
                        className={[
                          'w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium capitalize transition-colors flex items-center justify-between cursor-pointer',
                          isSelected
                            ? 'bg-indigo-50 text-indigo-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-100',
                        ].join(' ')}
                      >
                        <span>{cat.name}</span>
                        <span className="text-xs text-slate-400">→</span>
                      </button>
                    </li>
                  )
                })}
              </ul>

              <div className="border-t border-slate-100 my-4" />

              <div className="px-5 mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Quick Navigation
                </h3>
              </div>
              <ul className="flex flex-col px-2 space-y-0.5 text-sm">
                <li>
                  <Link
                    to="/orders"
                    onClick={() => setSidebarOpen(false)}
                    className="block px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100 font-medium"
                  >
                    📦 Returns &amp; Orders
                  </Link>
                </li>
                <li>
                  <Link
                    to="/wishlist"
                    onClick={() => setSidebarOpen(false)}
                    className="block px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100 font-medium"
                  >
                    ❤️ Your Wishlist
                  </Link>
                </li>
                <li>
                  <Link
                    to="/cart"
                    onClick={() => setSidebarOpen(false)}
                    className="block px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100 font-medium"
                  >
                    🛒 Shopping Cart ({cartCount})
                  </Link>
                </li>
                {isSeller && (
                  <li>
                    <Link
                      to="/seller"
                      onClick={() => setSidebarOpen(false)}
                      className="block px-3.5 py-2.5 rounded-xl text-amber-700 hover:bg-amber-50 font-semibold"
                    >
                      🏪 Seller Hub
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
