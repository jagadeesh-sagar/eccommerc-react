import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { fetchCSRF } from './utils/csrf.js'

// Prime the CSRF token cache before the first render so all mutating
// requests have a valid token from the very start.
fetchCSRF().catch((err) => {
  console.warn('Could not fetch CSRF token on startup:', err.message)
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
