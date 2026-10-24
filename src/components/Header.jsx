/**
 * Header — Editorial Warm Obsidian & Terracotta Storefront Navigation
 *
 * Features:
 *   - Row 1: Chatram Brand Mark, Unified Search + Concierge Input, Wishlist, Orders, Account Menu, Cart
 *   - Row 2: Dynamic Category Pills + Curated Quick Filters (Top Rated, Under ₹2,000, New Arrivals)
 *   - Slide-over Category & Account Drawer for mobile & desktop
 */

import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useAIChat } from '../context/AIChatContext'
import { SparkleIcon } from './AIChatWidget'
import client from '../api/client'

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-4 h-4"
    >
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function CartIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      className="w-5 h-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
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

function HeartNavIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      className="w-5 h-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
      />
    </svg>
  )
}

export default function Header() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isAuthenticated, isBuyer, isSeller, logout } = useAuth()
  const { cartCount } = useCart()
  const { askAI, setIsOpen } = useAIChat()

  const activeCategory = searchParams.get('ct') ?? ''
  const activeSort = searchParams.get('sort') ?? ''
  const activeDeals = searchParams.get('deals') ?? ''

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
        scrolled ? 'shadow-md shadow-stone-950/15' : '',
      ].join(' ')}
    >
      {/* ── Row 1: Primary Navigation Bar (Matte Obsidian) ───────────────── */}
      <div className="bg-[#141413] text-stone-100 border-b border-stone-800">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3 sm:gap-6">
            {/* Brand Logo */}
            <Link
              to="/"
              className="shrink-0 flex items-center gap-2.5 group focus:outline-none"
            >
              <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center shadow-xs group-hover:bg-orange-500 transition-colors">
                <span className="text-lg font-extrabold text-white tracking-tight">
                  C
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-xl tracking-tight text-white leading-none">
                  Chatram
                </span>
                <span className="text-[10px] text-stone-400 font-medium tracking-wider uppercase mt-0.5 hidden sm:block">
                  Marketplace
                </span>
              </div>
            </Link>

            {/* Desktop Unified Search + AI Copilot Bar */}
            <form
              onSubmit={handleSearch}
              className="hidden md:flex flex-1 max-w-2xl items-center bg-stone-800/90 hover:bg-stone-800 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-500/40 rounded-xl border border-stone-700/90 focus-within:border-stone-300 overflow-hidden transition-all h-10.5 group"
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products, brands, or ask Chatram AI Copilot…"
                className="flex-1 min-w-0 pl-4 pr-2 py-2 text-sm text-stone-100 group-focus-within:text-stone-900 placeholder-stone-400 bg-transparent outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    if (searchParams.get('n')) navigate('/')
                  }}
                  className="px-2 text-stone-400 hover:text-stone-600 text-xs cursor-pointer"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}

              {/* Primary Search Submit Button */}
              <button
                type="submit"
                aria-label="Search"
                className="shrink-0 h-8 px-3.5 mr-1 rounded-lg text-xs font-semibold bg-stone-700 hover:bg-stone-600 group-focus-within:bg-stone-900 group-focus-within:hover:bg-stone-800 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <SearchIcon />
                <span>Search</span>
              </button>

              {/* Ask AI Copilot Action inside Search Bar */}
              <button
                type="button"
                onClick={handleAskAIFromSearch}
                title="Ask AI Copilot (Ctrl+K)"
                className="shrink-0 h-8 px-3 mr-1 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <SparkleIcon className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                <span>Ask AI Copilot</span>
              </button>
            </form>

            {/* Right Navigation Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Mobile Ask AI Copilot button */}
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-stone-800 border border-stone-700 text-stone-100 text-xs font-semibold"
              >
                <SparkleIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>Ask AI</span>
              </button>

              {/* Wishlist link (buyers) */}
              {(!isAuthenticated || isBuyer) && (
                <Link
                  to="/wishlist"
                  title="Wishlist"
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-stone-300 hover:text-white hover:bg-stone-800 transition-colors text-xs font-semibold"
                >
                  <HeartNavIcon />
                  <span className="hidden xl:inline">Wishlist</span>
                </Link>
              )}

              {/* Orders link */}
              <Link
                to="/orders"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-stone-300 hover:text-white hover:bg-stone-800 transition-colors text-xs font-semibold"
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
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-stone-800 border border-transparent hover:border-stone-700 transition-colors text-left cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-stone-800 border border-stone-600 flex items-center justify-center text-xs font-bold text-amber-400 uppercase">
                    {user?.username ? user.username[0] : '👤'}
                  </div>
                  <div className="hidden sm:flex flex-col">
                    <span className="text-[10px] text-stone-400 leading-tight">
                      {isAuthenticated ? `Hi, ${user?.username}` : 'Welcome'}
                    </span>
                    <span className="text-xs font-bold text-white leading-tight flex items-center gap-1">
                      {isAuthenticated ? 'Account' : 'Sign In'}
                      <span className="text-[10px] text-stone-400">▾</span>
                    </span>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {accountMenuOpen && isAuthenticated && (
                  <div className="absolute right-0 mt-2 w-60 bg-white border border-stone-200/90 rounded-2xl shadow-xl z-50 text-stone-800 text-sm py-2 overflow-hidden">
                    <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-100">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-200 text-stone-800 mb-1">
                        {user?.role_model || 'Member'}
                      </span>
                      <p className="text-sm font-bold text-stone-900 truncate">{user?.username}</p>
                      {user?.email && (
                        <p className="text-xs text-stone-500 truncate">{user.email}</p>
                      )}
                    </div>

                    <div className="py-1">
                      {isBuyer && (
                        <>
                          <Link
                            to="/orders"
                            onClick={() => setAccountMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 hover:text-stone-950"
                          >
                            <span>📦</span> Your Orders
                          </Link>
                          <Link
                            to="/wishlist"
                            onClick={() => setAccountMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 hover:text-stone-950"
                          >
                            <span>❤️</span> Your Wishlist
                          </Link>
                          <Link
                            to="/cart"
                            onClick={() => setAccountMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 hover:text-stone-950"
                          >
                            <span>🛒</span> Shopping Cart ({cartCount})
                          </Link>
                        </>
                      )}

                      {isSeller && (
                        <Link
                          to="/seller"
                          onClick={() => setAccountMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-50"
                        >
                          <span>🏪</span> Seller Hub Dashboard
                        </Link>
                      )}

                      <button
                        onClick={() => {
                          setAccountMenuOpen(false)
                          setIsOpen(true)
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50/70 text-left cursor-pointer"
                      >
                        <SparkleIcon className="w-4 h-4 text-amber-500" />
                        <span>Chatram AI Copilot</span>
                      </button>
                    </div>

                    <div className="border-t border-stone-100 mt-1 pt-1">
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
                className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-xs transition-all"
              >
                <div className="relative">
                  <CartIcon />
                </div>
                <span className="hidden sm:inline">Cart</span>
                <span className="px-1.5 py-0.5 rounded-full bg-stone-950 text-amber-400 font-mono text-[11px] font-bold leading-none">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              </Link>
            </div>
          </div>

          {/* Mobile Search Bar */}
          <form
            onSubmit={handleSearch}
            className="flex md:hidden items-center bg-stone-800 focus-within:bg-white rounded-xl border border-stone-700 focus-within:border-stone-400 overflow-hidden h-10 group"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products or ask AI Copilot…"
              className="flex-1 min-w-0 px-3 py-2 text-sm text-white group-focus-within:text-stone-900 placeholder-stone-400 bg-transparent outline-none"
            />
            <button
              type="button"
              onClick={handleAskAIFromSearch}
              className="shrink-0 h-7 px-2.5 mr-1 rounded-lg bg-orange-600 text-white text-[11px] font-semibold flex items-center gap-1"
            >
              <SparkleIcon className="w-3 h-3 text-amber-200" />
              <span>Ask AI</span>
            </button>
            <button
              type="submit"
              className="shrink-0 px-3 h-full flex items-center justify-center bg-stone-700 text-white"
              aria-label="Search"
            >
              <SearchIcon />
            </button>
          </form>
        </div>
      </div>

      {/* ── Row 2: Category & Quick-Filter Strip ─────────────────────────── */}
      <div className="bg-[#1c1b19] text-stone-300 border-b border-stone-800/90">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar h-10">
          <div className="flex items-center gap-1.5">
            {/* Categories Drawer Trigger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-stone-100 bg-stone-800 hover:bg-stone-700 border border-stone-700 transition-colors cursor-pointer"
            >
              <MenuIcon />
              <span>Categories</span>
            </button>

            <div className="h-4 w-[1px] bg-stone-800 mx-1 shrink-0" />

            {/* All Products Pill */}
            <button
              onClick={() => navigate('/')}
              className={[
                'shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
                !activeCategory && !activeSort && !activeDeals
                  ? 'bg-stone-100 text-stone-950 font-semibold'
                  : 'hover:bg-stone-800 hover:text-white',
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
                      ? 'bg-orange-600 text-white font-semibold shadow-2xs'
                      : 'hover:bg-stone-800 hover:text-white',
                  ].join(' ')}
                >
                  {cat.name}
                </button>
              )
            })}

            <div className="h-4 w-[1px] bg-stone-800 mx-1 shrink-0" />

            {/* Quick Curated Filters */}
            <button
              onClick={() => navigate('/?sort=rating')}
              className={[
                'shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
                activeSort === 'rating'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold'
                  : 'hover:bg-stone-800 hover:text-white',
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
                  : 'hover:bg-stone-800 hover:text-white',
              ].join(' ')}
            >
              Under ₹2,000
            </button>

            <button
              onClick={() => navigate('/?sort=newest')}
              className={[
                'shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
                activeSort === 'newest'
                  ? 'bg-stone-100 text-stone-950 font-semibold'
                  : 'hover:bg-stone-800 hover:text-white',
              ].join(' ')}
            >
              New Arrivals
            </button>
          </div>

          {/* Right side of Row 2: Seller Hub */}
          <div className="flex items-center gap-2 shrink-0">
            {isSeller && (
              <Link
                to="/seller"
                className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors whitespace-nowrap"
              >
                Seller Hub
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Slide-Over Category & Navigation Drawer ──────────────────────── */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[9999] flex">
          <div
            className="absolute inset-0 bg-stone-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />

          <div className="relative w-80 max-w-[85vw] h-full bg-white flex flex-col shadow-2xl">
            {/* Drawer Header */}
            <div className="bg-[#141413] text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center font-bold text-white shadow-sm shrink-0">
                  {user?.username ? user.username[0].toUpperCase() : 'C'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-stone-400">Welcome to Chatram</p>
                  <p className="text-sm font-bold text-white truncate">
                    {user?.username ? `Hello, ${user.username}` : 'Hello, Sign in'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close Sidebar"
              >
                ✕
              </button>
            </div>

            {/* AI Copilot Callout inside Drawer */}
            <div className="p-4 border-b border-stone-100 bg-stone-50">
              <button
                onClick={() => {
                  setSidebarOpen(false)
                  setIsOpen(true)
                }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#141413] hover:bg-stone-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <SparkleIcon className="w-4 h-4 text-amber-400" />
                  <span>Chatram AI Copilot</span>
                </span>
                <span>→</span>
              </button>
            </div>

            {/* Scrollable Categories */}
            <div className="flex-1 overflow-y-auto scrollbar-thin py-4">
              <div className="px-5 mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
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
                        ? 'bg-stone-100 text-stone-950 font-semibold'
                        : 'text-stone-700 hover:bg-stone-50',
                    ].join(' ')}
                  >
                    <span>All Products</span>
                    <span className="text-xs text-stone-400">→</span>
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
                            ? 'bg-orange-50 text-orange-800 font-semibold'
                            : 'text-stone-700 hover:bg-stone-50',
                        ].join(' ')}
                      >
                        <span>{cat.name}</span>
                        <span className="text-xs text-stone-400">→</span>
                      </button>
                    </li>
                  )
                })}
              </ul>

              <div className="border-t border-stone-100 my-4" />

              <div className="px-5 mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Quick Navigation
                </h3>
              </div>
              <ul className="flex flex-col px-2 space-y-0.5 text-sm">
                <li>
                  <Link
                    to="/orders"
                    onClick={() => setSidebarOpen(false)}
                    className="block px-3.5 py-2.5 rounded-xl text-stone-700 hover:bg-stone-50 font-medium"
                  >
                    📦 Returns &amp; Orders
                  </Link>
                </li>
                <li>
                  <Link
                    to="/wishlist"
                    onClick={() => setSidebarOpen(false)}
                    className="block px-3.5 py-2.5 rounded-xl text-stone-700 hover:bg-stone-50 font-medium"
                  >
                    ❤️ Your Wishlist
                  </Link>
                </li>
                <li>
                  <Link
                    to="/cart"
                    onClick={() => setSidebarOpen(false)}
                    className="block px-3.5 py-2.5 rounded-xl text-stone-700 hover:bg-stone-50 font-medium"
                  >
                    🛒 Shopping Cart ({cartCount})
                  </Link>
                </li>
                {isSeller && (
                  <li>
                    <Link
                      to="/seller"
                      onClick={() => setSidebarOpen(false)}
                      className="block px-3.5 py-2.5 rounded-xl text-orange-700 hover:bg-orange-50 font-semibold"
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
