/**
 * Login Page — Modern Split-Screen / Card Layout for Chatram
 *
 * - POST /api/login/ → { username, password }
 * - Stores user in AuthContext on success and redirects to ?next= or /
 */

import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { SparkleIcon } from '../components/AIChatWidget'

function FormField({ id, label, type = 'text', value, onChange, error, autoComplete, placeholder }) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-xs font-bold text-slate-700 mb-1.5">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={[
          'w-full px-3.5 py-2.5 text-sm rounded-xl border bg-slate-50/50 focus:bg-white',
          'outline-none transition-all duration-150',
          'focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/15',
          error ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300',
        ].join(' ')}
      />
      {error && (
        <p className="mt-1.5 text-xs font-medium text-rose-600 flex items-start gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const redirectTo = new URLSearchParams(location.search).get('next') || '/'

  const [form, setForm] = useState({ username: '', password: '' })
  const [errors, setErrors] = useState({})
  const [globalError, setGlobalError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: '' }))
    setGlobalError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setErrors({})
    setGlobalError('')

    try {
      const { data } = await client.post('/api/login/', form)
      login(data.user)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      const data = err.response?.data
      if (!data) {
        setGlobalError('Something went wrong. Please try again.')
        return
      }

      const fieldErrors = {}
      let hasFieldErrors = false
      for (const [key, val] of Object.entries(data)) {
        if (['username', 'password'].includes(key)) {
          fieldErrors[key] = Array.isArray(val) ? val[0] : val
          hasFieldErrors = true
        }
      }
      if (hasFieldErrors) {
        setErrors(fieldErrors)
      }

      const global = data.error || data.detail || data.non_field_errors
      if (global) {
        setGlobalError(Array.isArray(global) ? global[0] : global)
      } else if (!hasFieldErrors) {
        setGlobalError('Sign in failed. Please check your credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col lg:flex-row">
      {/* Left Brand Showcase Panel (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-amber-500 p-[1px]">
              <div className="w-full h-full bg-slate-900 rounded-[11px] flex items-center justify-center">
                <span className="text-xl font-extrabold text-white">C</span>
              </div>
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-white">Chatram</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-md space-y-5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
            <SparkleIcon className="w-3.5 h-3.5 text-amber-300" />
            <span>AI-MCP Powered Commerce</span>
          </span>
          <h2 className="text-4xl font-extrabold tracking-tight leading-tight">
            Shop smarter with conversational intelligence.
          </h2>
          <p className="text-sm text-indigo-200/80 leading-relaxed">
            Sign in to unlock your personal AI Shopping Copilot, compare live inventory, track orders in real time, and chat directly with verified sellers.
          </p>
        </div>

        <div className="relative z-10 text-xs text-slate-400">
          © {new Date().getFullYear()} Chatram Commerce
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:px-8">
        {/* Mobile Brand Header */}
        <Link to="/" className="lg:hidden flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-extrabold text-white">
            C
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-slate-900">Chatram</span>
        </Link>

        <div className="bg-white border border-slate-200/90 rounded-3xl p-7 sm:p-9 w-full max-w-[420px] shadow-xl shadow-slate-900/5">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Welcome back</h1>
            <p className="text-xs text-slate-500 mt-1">
              Sign in to your Chatram account to continue
            </p>
          </div>

          {globalError && (
            <div className="mb-5 px-4 py-3 border border-rose-200 rounded-2xl bg-rose-50 text-xs font-medium text-rose-700">
              {globalError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <FormField
              id="username"
              label="Username"
              placeholder="Enter your username"
              value={form.username}
              onChange={handleChange}
              error={errors.username}
              autoComplete="username"
            />
            <FormField
              id="password"
              label="Password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              error={errors.password}
              autoComplete="current-password"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="px-3 text-xs text-slate-400 font-medium">New to Chatram?</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <Link
            to="/register"
            className="block w-full text-center py-2.5 px-4 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 transition-colors"
          >
            Create a Chatram Account
          </Link>
        </div>
      </div>
    </div>
  )
}
