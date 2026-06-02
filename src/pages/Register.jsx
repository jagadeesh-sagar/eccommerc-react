/**
 * Register Page
 *
 * Amazon-style white card on gray background.
 * - POST /api/register/ with all fields
 * - Stores user in AuthContext on success and redirects to /
 * - Displays all API validation errors inline next to the relevant field
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'

// ---------------------------------------------------------------------------
// Reusable sub-components
// ---------------------------------------------------------------------------

function FormField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  error,
  autoComplete,
  hint,
}) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-semibold text-gray-800 mb-1">
        {label}
      </label>
      {hint && <p className="text-xs text-gray-500 mb-1">{hint}</p>}
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

function RoleRadio({ value, onChange, error }) {
  return (
    <div className="mb-4">
      <p className="text-sm font-semibold text-gray-800 mb-2">I am a…</p>
      <div className="flex gap-6">
        {['buyer', 'seller'].map((role) => (
          <label
            key={role}
            className="flex items-center gap-2 cursor-pointer text-sm text-gray-800"
          >
            <input
              type="radio"
              name="role_model"
              value={role}
              checked={value === role}
              onChange={onChange}
              className="accent-[#e77600] w-4 h-4 cursor-pointer"
            />
            <span className="capitalize">{role}</span>
          </label>
        ))}
      </div>
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

const INITIAL_FORM = {
  username: '',
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  confirm_password: '',
  role_model: 'buyer',
}

// Fields that the API can return errors for
const API_FIELDS = [
  'username',
  'first_name',
  'last_name',
  'email',
  'password',
  'confirm_password',
  'role_model',
]

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm] = useState(INITIAL_FORM)
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

    // Basic client-side guard
    if (form.password !== form.confirm_password) {
      setErrors((prev) => ({ ...prev, confirm_password: 'Passwords do not match.' }))
      return
    }

    setLoading(true)
    setErrors({})
    setGlobalError('')

    try {
      const { data } = await client.post('/api/register/', form)
      // API returns { user: { id, username, email, role_model }, access, ... }
      login(data.user)
      navigate('/', { replace: true })
    } catch (err) {
      const data = err.response?.data
      if (!data) {
        setGlobalError('Something went wrong. Please try again.')
        return
      }

      // Map each API-returned field error
      const fieldErrors = {}
      let hasFieldErrors = false
      for (const field of API_FIELDS) {
        if (data[field]) {
          fieldErrors[field] = Array.isArray(data[field]) ? data[field][0] : data[field]
          hasFieldErrors = true
        }
      }
      if (hasFieldErrors) {
        setErrors(fieldErrors)
      }

      // Non-field errors
      const global = data.error || data.detail || data.non_field_errors
      if (global) {
        setGlobalError(Array.isArray(global) ? global[0] : global)
      } else if (!hasFieldErrors) {
        setGlobalError('Registration failed. Please check the form and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f3f3] flex flex-col items-center justify-start pt-10 px-4 pb-10">
      {/* Logo */}
      <div className="mb-6">
        <span className="text-[28px] font-bold tracking-tight text-gray-900 font-serif">
          🛒 ShopZone
        </span>
      </div>

      {/* Card */}
      <div
        className="bg-white border border-gray-300 rounded-lg px-8 pt-6 pb-7 w-full max-w-[400px]"
        style={{ boxShadow: '0 2px 4px rgba(0,0,0,.13), 0 1px 1px rgba(0,0,0,.08)' }}
      >
        <h1 className="text-2xl font-medium text-gray-900 mb-5">Create account</h1>

        {/* Global error banner */}
        {globalError && (
          <div className="mb-4 px-3 py-2 border border-red-400 rounded bg-red-50 text-sm text-red-700">
            {globalError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Name row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <FormField
                id="first_name"
                label="First name"
                value={form.first_name}
                onChange={handleChange}
                error={errors.first_name}
                autoComplete="given-name"
              />
            </div>
            <div className="flex-1">
              <FormField
                id="last_name"
                label="Last name"
                value={form.last_name}
                onChange={handleChange}
                error={errors.last_name}
                autoComplete="family-name"
              />
            </div>
          </div>

          <FormField
            id="username"
            label="Username"
            value={form.username}
            onChange={handleChange}
            error={errors.username}
            autoComplete="username"
          />

          <FormField
            id="email"
            label="Email"
            type="email"
            value={form.email}
            onChange={handleChange}
            error={errors.email}
            autoComplete="email"
          />

          <FormField
            id="password"
            label="Password"
            type="password"
            value={form.password}
            onChange={handleChange}
            error={errors.password}
            autoComplete="new-password"
            hint="At least 8 characters"
          />

          <FormField
            id="confirm_password"
            label="Re-enter password"
            type="password"
            value={form.confirm_password}
            onChange={handleChange}
            error={errors.confirm_password}
            autoComplete="new-password"
          />

          <RoleRadio
            value={form.role_model}
            onChange={handleChange}
            error={errors.role_model}
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
            {loading ? 'Creating account…' : 'Create your ShopZone account'}
          </button>
        </form>

        {/* Legal blurb */}
        <p className="mt-4 text-[11px] text-gray-600 leading-4">
          By creating an account, you agree to ShopZone's{' '}
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

      {/* Already have account */}
      <div className="mt-5 text-sm text-gray-700">
        Already have an account?{' '}
        <Link to="/login" className="text-[#0066c0] hover:text-[#c7511f] hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  )
}
