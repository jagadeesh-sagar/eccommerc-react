/**
 * Login Page
 *
 * Amazon-style white card on gray background.
 * - POST /api/login/ → { username, password }
 * - Stores user in AuthContext on success and redirects to /
 * - Displays field-level and non-field errors inline
 */

import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'

// ---------------------------------------------------------------------------
// Reusable sub-components
// ---------------------------------------------------------------------------

function FormField({ id, label, type = 'text', value, onChange, error, autoComplete }) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-semibold text-gray-800 mb-1">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        className={[
          'w-full px-3 py-2 text-sm rounded border bg-white',
          'outline-none transition-all duration-150',
          'focus:border-[#e77600] focus:ring-[3px] focus:ring-[rgba(228,121,17,0.5)]',
          error ? 'border-red-600' : 'border-gray-400',
        ].join(' ')}
      />
      {error && (
        <p className="mt-1 text-xs text-red-600 flex items-start gap-1">
          <span className="mt-px">⚠</span> {error}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  // Where to go after a successful login — honours ?next= query param
  const redirectTo = new URLSearchParams(location.search).get('next') || '/'

  const [form, setForm] = useState({ username: '', password: '' })
  const [errors, setErrors] = useState({})
  const [globalError, setGlobalError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    // Clear the error for the field being edited
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
      // API returns { user: { id, username, email, role_model }, access, ... }
      login(data.user)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      const data = err.response?.data
      if (!data) {
        setGlobalError('Something went wrong. Please try again.')
        return
      }

      // Map API field-level errors
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

      // Non-field / global errors
      const global = data.error || data.detail || data.non_field_errors
      if (global) {
        setGlobalError(Array.isArray(global) ? global[0] : global)
      } else if (!hasFieldErrors) {
        setGlobalError('Login failed. Please check your credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f3f3] flex flex-col items-center justify-start pt-10 px-4">
      {/* Logo */}
      <div className="mb-6">
        <span className="text-[28px] font-bold tracking-tight text-gray-900 font-serif">
          🛒 ShopZone
        </span>
      </div>

      {/* Card */}
      <div
        className="bg-white border border-gray-300 rounded-lg px-8 pt-6 pb-7 w-full max-w-[350px]"
        style={{ boxShadow: '0 2px 4px rgba(0,0,0,.13), 0 1px 1px rgba(0,0,0,.08)' }}
      >
        <h1 className="text-2xl font-medium text-gray-900 mb-5">Sign in</h1>

        {/* Global / non-field error banner */}
        {globalError && (
          <div className="mb-4 px-3 py-2 border border-red-400 rounded bg-red-50 text-sm text-red-700">
            {globalError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <FormField
            id="username"
            label="Username"
            value={form.username}
            onChange={handleChange}
            error={errors.username}
            autoComplete="username"
          />
          <FormField
            id="password"
            label="Password"
            type="password"
            value={form.password}
            onChange={handleChange}
            error={errors.password}
            autoComplete="current-password"
          />

          <button
            type="submit"
            disabled={loading}
            className={[
              'w-full mt-1 py-2 px-4 rounded text-sm font-medium',
              'border border-[#a88734] border-b-[#8d6e01]',
              'bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b]',
              'text-gray-900 cursor-pointer',
              'hover:bg-gradient-to-b hover:from-[#f5d78e] hover:to-[#eeb933]',
              'active:shadow-inner',
              'focus:outline-none focus:ring-2 focus:ring-[#e77600]',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              'transition-all duration-100',
            ].join(' ')}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Legal blurb — mimics Amazon */}
        <p className="mt-4 text-[11px] text-gray-600 leading-4">
          By continuing, you agree to ShopZone's{' '}
          <a href="#" className="text-[#0066c0] hover:text-[#c7511f] hover:underline">
            Conditions of Use
          </a>{' '}
          and{' '}
          <a href="#" className="text-[#0066c0] hover:text-[#c7511f] hover:underline">
            Privacy Notice
          </a>
          .
        </p>
      </div>

      {/* Divider */}
      <div className="w-full max-w-[350px] flex items-center my-5">
        <div className="flex-1 h-px bg-gray-300" />
        <span className="px-3 text-xs text-gray-500 font-medium">New to ShopZone?</span>
        <div className="flex-1 h-px bg-gray-300" />
      </div>

      {/* Create account card */}
      <div className="w-full max-w-[350px]">
        <Link
          to="/register"
          className={[
            'block w-full text-center py-2 px-4 rounded text-sm font-medium',
            'border border-gray-400 bg-gradient-to-b from-[#f7f8f8] to-[#e7e9ec]',
            'text-gray-900 hover:bg-gradient-to-b hover:from-[#e7e9ec] hover:to-[#d9dce1]',
            'focus:outline-none focus:ring-2 focus:ring-[#e77600]',
            'transition-all duration-100',
          ].join(' ')}
        >
          Create your ShopZone account
        </Link>
      </div>
    </div>
  )
}
