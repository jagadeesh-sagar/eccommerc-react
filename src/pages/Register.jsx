/**
 * Register Page — Editorial Split-Screen / Card Layout for Chatram
 *
 * - POST /api/register/ with all fields + Buyer/Seller role selection cards
 * - Stores user in AuthContext on success and redirects to /
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { SparkleIcon } from '../components/AIChatWidget'

function FormField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  error,
  autoComplete,
  hint,
  placeholder,
}) {
  return (
    <div className="mb-3.5">
      <label htmlFor={id} className="block text-xs font-bold text-stone-700 mb-1">
        {label}
      </label>
      {hint && <p className="text-[11px] text-stone-400 mb-1">{hint}</p>}
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={[
          'w-full px-3.5 py-2 text-sm rounded-xl border bg-stone-50/70 focus:bg-white',
          'outline-none transition-all duration-150',
          'focus:border-stone-900 focus:ring-3 focus:ring-stone-900/10',
          error ? 'border-rose-500 bg-rose-50/30' : 'border-stone-300',
        ].join(' ')}
      />
      {error && (
        <p className="mt-1 text-xs font-medium text-rose-600 flex items-start gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  )
}

function RoleSelector({ value, onChange, error }) {
  const roles = [
    {
      id: 'buyer',
      icon: '🛍️',
      title: 'Shopper (Buyer)',
      desc: 'Browse products, use Chatram AI Copilot & place orders',
    },
    {
      id: 'seller',
      icon: '🏪',
      title: 'Merchant (Seller)',
      desc: 'List products, manage inventory & fulfil orders',
    },
  ]

  return (
    <div className="mb-4">
      <p className="text-xs font-bold text-stone-700 mb-2">Choose your account type</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {roles.map((r) => {
          const active = value === r.id
          return (
            <label
              key={r.id}
              className={[
                'flex items-start gap-2.5 p-3 rounded-2xl border-2 cursor-pointer transition-all',
                active
                  ? 'border-stone-900 bg-stone-50 shadow-2xs'
                  : 'border-stone-200 hover:border-stone-300 bg-white',
              ].join(' ')}
            >
              <input
                type="radio"
                name="role_model"
                value={r.id}
                checked={active}
                onChange={onChange}
                className="sr-only"
              />
              <span className="text-lg leading-none mt-0.5">{r.icon}</span>
              <div>
                <p className="text-xs font-bold text-stone-900">{r.title}</p>
                <p className="text-[10px] text-stone-500 leading-snug mt-0.5">{r.desc}</p>
              </div>
            </label>
          )
        })}
      </div>
      {error && (
        <p className="mt-1 text-xs font-medium text-rose-600 flex items-start gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  )
}

const INITIAL_FORM = {
  username: '',
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  confirm_password: '',
  role_model: 'buyer',
}

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

    if (form.password !== form.confirm_password) {
      setErrors((prev) => ({ ...prev, confirm_password: 'Passwords do not match.' }))
      return
    }

    setLoading(true)
    setErrors({})
    setGlobalError('')

    try {
      const { data } = await client.post('/api/register/', form)
      login(data.user)
      navigate('/', { replace: true })
    } catch (err) {
      const data = err.response?.data
      if (!data) {
        setGlobalError('Something went wrong. Please try again.')
        return
      }

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
    <div className="min-h-screen bg-[#f7f6f2] flex flex-col lg:flex-row">
      {/* Left Brand Showcase Panel */}
      <div className="hidden lg:flex lg:w-5/12 bg-[#141413] text-white p-12 flex-col justify-between">
        <div>
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center">
              <span className="text-xl font-extrabold text-white">C</span>
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-white">Chatram</span>
          </Link>
        </div>

        <div className="max-w-md space-y-5">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-stone-800 text-stone-200 border border-stone-700">
            <SparkleIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>Join Chatram Today</span>
          </span>
          <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-tight">
            One platform for curated shopping &amp; merchant growth.
          </h2>
          <p className="text-sm text-stone-400 leading-relaxed">
            Create a shopper account to browse and compare inventory, or register as a seller to launch your store in minutes.
          </p>
        </div>

        <div className="text-xs text-stone-500">
          © {new Date().getFullYear()} Chatram Marketplace
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <Link to="/" className="lg:hidden flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center font-extrabold text-white">
            C
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-stone-900">Chatram</span>
        </Link>

        <div className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 w-full max-w-[480px] shadow-xl shadow-stone-900/5">
          <div className="mb-5">
            <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight">
              Create your account
            </h1>
            <p className="text-xs text-stone-500 mt-1">
              Get started with Chatram in seconds
            </p>
          </div>

          {globalError && (
            <div className="mb-4 px-4 py-3 border border-rose-200 rounded-2xl bg-rose-50 text-xs font-medium text-rose-700">
              {globalError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <RoleSelector
              value={form.role_model}
              onChange={handleChange}
              error={errors.role_model}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                id="first_name"
                label="First name"
                value={form.first_name}
                onChange={handleChange}
                error={errors.first_name}
                autoComplete="given-name"
              />
              <FormField
                id="last_name"
                label="Last name"
                value={form.last_name}
                onChange={handleChange}
                error={errors.last_name}
                autoComplete="family-name"
              />
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
              label="Email address"
              type="email"
              value={form.email}
              onChange={handleChange}
              error={errors.email}
              autoComplete="email"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                id="password"
                label="Password"
                type="password"
                value={form.password}
                onChange={handleChange}
                error={errors.password}
                autoComplete="new-password"
                hint="Min. 8 characters"
              />
              <FormField
                id="confirm_password"
                label="Confirm password"
                type="password"
                value={form.confirm_password}
                onChange={handleChange}
                error={errors.confirm_password}
                autoComplete="new-password"
                hint="Must match"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl text-sm font-bold bg-stone-900 hover:bg-stone-800 text-white shadow-xs disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {loading ? 'Creating account…' : 'Create Chatram Account'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-stone-500">
            Already have an account?{' '}
            <Link to="/login" className="text-stone-900 font-bold hover:underline">
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
