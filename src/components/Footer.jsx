import { Link } from 'react-router-dom'
import { useAIChat } from '../context/AIChatContext'
import { SparkleIcon } from './AIChatWidget'

const COLUMNS = [
  {
    heading: 'Shop & Explore',
    links: [
      { label: 'All Products', to: '/' },
      { label: 'New Arrivals', to: '/?sort=newest' },
      { label: 'Top Rated Picks', to: '/?sort=rating' },
      { label: 'Deals Under ₹2,000', to: '/?deals=true' },
    ],
  },
  {
    heading: 'Your Account',
    links: [
      { label: 'Your Orders', to: '/orders' },
      { label: 'Shopping Cart', to: '/cart' },
      { label: 'Saved Wishlist', to: '/wishlist' },
      { label: 'Sign In / Register', to: '/login' },
    ],
  },
  {
    heading: 'Partner With Chatram',
    links: [
      { label: 'Sell on Chatram', to: '/seller' },
      { label: 'Seller Hub Dashboard', to: '/seller' },
      { label: 'Merchant Fulfilment', to: '/seller' },
    ],
  },
]

function BackToTop() {
  function handleClick() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <button
      onClick={handleClick}
      className="w-full py-3 text-xs font-semibold uppercase tracking-wider text-slate-300 bg-slate-800/90 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer select-none border-b border-slate-800"
    >
      ↑ Back to top
    </button>
  )
}

export default function Footer() {
  const year = new Date().getFullYear()
  const { setIsOpen, askAI } = useAIChat()

  return (
    <footer className="bg-slate-900 text-slate-300 mt-auto border-t border-slate-800 cv-auto">
      <BackToTop />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
        {/* Brand + AI Copilot Callout (2 cols on lg) */}
        <div className="lg:col-span-2 space-y-4">
          <Link to="/" className="inline-flex items-center gap-2.5 select-none">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-amber-500 p-[1px]">
              <div className="w-full h-full bg-slate-900 rounded-[11px] flex items-center justify-center">
                <span className="text-lg font-extrabold text-white">C</span>
              </div>
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white">Chatram</span>
          </Link>

          <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
            Next-generation commerce powered by an integrated AI-MCP Shopping Copilot. Discover, compare, and order with conversational intelligence.
          </p>

          <div className="pt-1 flex flex-wrap gap-2">
            <button
              onClick={() => setIsOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <SparkleIcon className="w-4 h-4 text-amber-300" />
              <span>Launch AI Copilot</span>
            </button>
            <button
              onClick={() => askAI('Recommend the best-rated products in the store')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
            >
              <span>✨ Get AI Recommendations</span>
            </button>
          </div>
        </div>

        {/* Navigation Columns */}
        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
              {col.heading}
            </h3>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-slate-400 text-sm hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-800/80">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {year} Chatram Commerce. Built with React, Django &amp; Anthropic MCP.</p>
          <div className="flex items-center gap-6">
            <Link to="/" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <Link to="/" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
            <Link to="/orders" className="hover:text-slate-300 transition-colors">Order Support</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
