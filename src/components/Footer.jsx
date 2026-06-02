import { Link } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Column data
// ---------------------------------------------------------------------------

const COLUMNS = [
  {
    heading: 'Get to Know Us',
    links: [
      { label: 'About Us', to: '/' },
      { label: 'Careers', to: '/' },
      { label: 'Press Releases', to: '/' },
      { label: 'Amazon Science', to: '/' },
    ],
  },
  {
    heading: 'Connect with Us',
    links: [
      { label: 'Facebook', to: '/' },
      { label: 'Twitter', to: '/' },
      { label: 'Instagram', to: '/' },
    ],
  },
  {
    heading: 'Make Money with Us',
    links: [
      { label: 'Sell on ShopNest', to: '/register' },
      { label: 'Become an Affiliate', to: '/' },
      { label: 'Advertise Your Products', to: '/' },
      { label: 'Self-Publish with Us', to: '/' },
    ],
  },
  {
    heading: 'Let Us Help You',
    links: [
      { label: 'Your Account', to: '/' },
      { label: 'Returns Centre', to: '/' },
      { label: 'Recalls and Product Safety Alerts', to: '/' },
      { label: '100% Purchase Protection', to: '/' },
      { label: 'Help', to: '/' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Back-to-top button
// ---------------------------------------------------------------------------

function BackToTop() {
  function handleClick() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <button
      onClick={handleClick}
      className="w-full py-3 text-sm font-medium text-white bg-[#37475a] hover:bg-[#485769] transition-colors cursor-pointer select-none"
    >
      Back to top
    </button>
  )
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-[#232f3e] text-white mt-auto">
      {/* ── Back to top ── */}
      <BackToTop />

      {/* ── Link columns ── */}
      <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-8">
        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <h3 className="text-sm font-bold text-white mb-3">{col.heading}</h3>
            <ul className="space-y-2">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-[#ddd] text-sm hover:text-white hover:underline transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-[#3a4553]" />

      {/* ── Logo + country + copyright ── */}
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col items-center gap-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-1 select-none">
          <span className="text-xl font-extrabold tracking-tight text-white">
            shop
          </span>
          <span className="text-xl font-extrabold tracking-tight text-[#febd69]">
            nest
          </span>
          <span className="text-[#febd69] text-lg leading-none">▾</span>
        </Link>

        {/* Country chip */}
        <button className="flex items-center gap-2 px-4 py-1.5 border border-[#6b7280] rounded text-sm text-[#ddd] hover:border-white transition-colors cursor-pointer">
          {/* Globe icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.6 9h16.8M3.6 15h16.8M12 3c-2.4 3-3.8 5.8-3.8 9s1.4 6 3.8 9M12 3c2.4 3 3.8 5.8 3.8 9s-1.4 6-3.8 9"
            />
          </svg>
          <span>English</span>
        </button>

        {/* Legal links */}
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          {[
            'Conditions of Use',
            'Privacy Notice',
            'Consumer Health Data Privacy Disclosure',
            'Your Ads Privacy Choices',
          ].map((label) => (
            <Link
              key={label}
              to="/"
              className="text-xs text-[#aaa] hover:text-white hover:underline transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Copyright */}
        <p className="text-xs text-[#aaa] text-center">
          © 1996–{year}, ShopNest, Inc. or its affiliates
        </p>
      </div>
    </footer>
  )
}
