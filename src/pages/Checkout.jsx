/**
 * Checkout — /checkout   (isBuyer only)
 *
 * 2-step modern checkout wizard:
 *   Step 1 – Delivery & Billing Address (with Add & Edit via POST/PATCH /user/address/)
 *   Step 2 – Payment & Order Review (Cash on Delivery or Razorpay Online Payment)
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Header from '../components/Header'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useAIChat } from '../context/AIChatContext'

const STEPS = ['Delivery Address', 'Review & Payment']

const ADDRESS_TYPE_OPTIONS = [
  { value: 'both', label: 'Shipping & Billing' },
  { value: 'shipping', label: 'Shipping only' },
  { value: 'billing', label: 'Billing only' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatPrice(val) {
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

function formatAddressLine(addr) {
  return [addr.house_no, addr.street, addr.city, addr.state, addr.country, addr.postal_code]
    .filter(Boolean)
    .join(', ')
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true)
      return
    }
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Step Indicator
// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center mb-8 select-none">
      {STEPS.map((label, idx) => {
        const step = idx + 1
        const done = step < current
        const active = step === current

        return (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-2.5">
              <div
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold border-2 transition-all',
                  done
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : active
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-500/25'
                    : 'bg-white border-slate-300 text-slate-400',
                ].join(' ')}
              >
                {done ? '✓' : step}
              </div>
              <span
                className={[
                  'text-xs sm:text-sm font-bold whitespace-nowrap',
                  active ? 'text-slate-900' : done ? 'text-emerald-700' : 'text-slate-400',
                ].join(' ')}
              >
                {label}
              </span>
            </div>

            {idx < STEPS.length - 1 && (
              <div
                className={[
                  'w-12 sm:w-28 h-0.5 mx-3 sm:mx-4 transition-all rounded-full',
                  step < current ? 'bg-emerald-600' : 'bg-slate-200',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Address Card
// ─────────────────────────────────────────────────────────────────────────────

function AddressCard({ address, selected, onSelect, onEdit }) {
  const id = address.id ?? address._localId
  return (
    <div
      onClick={() => onSelect(id)}
      className={[
        'border-2 rounded-2xl p-4 cursor-pointer transition-all',
        selected
          ? 'border-indigo-600 bg-indigo-50/40 shadow-2xs'
          : 'border-slate-200/90 hover:border-slate-300 bg-white',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={[
              'mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
              selected ? 'border-indigo-600' : 'border-slate-400',
            ].join(' ')}
          >
            {selected && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-slate-900 capitalize">
                {address.user ?? 'Saved Address'}
              </p>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 rounded-full px-2 py-0.5 uppercase tracking-wider">
                {address.address_type ?? 'both'}
              </span>
              {address.is_default && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded-full px-2 py-0.5">
                  Default
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-snug">
              {formatAddressLine(address)}
            </p>
            {address.phone_number && (
              <p className="text-xs text-slate-400 mt-1 font-mono">📞 {address.phone_number}</p>
            )}
          </div>
        </div>

        {address.id && onEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(address)
            }}
            className="text-xs font-semibold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Address Form (Add or Edit via POST / PATCH /user/address/)
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_ADDR = {
  house_no: '',
  street: '',
  city: '',
  state: '',
  country: 'India',
  postal_code: '',
  phone_number: '',
  address_type: 'both',
}

function AddressForm({ initialAddress = null, onSaved, onCancel }) {
  const isEditing = Boolean(initialAddress?.id)
  const [form, setForm] = useState(() =>
    initialAddress
      ? {
          house_no: initialAddress.house_no ?? '',
          street: initialAddress.street ?? '',
          city: initialAddress.city ?? '',
          state: initialAddress.state ?? '',
          country: initialAddress.country ?? 'India',
          postal_code: initialAddress.postal_code ?? '',
          phone_number: initialAddress.phone_number ?? '',
          address_type: initialAddress.address_type ?? 'both',
        }
      : EMPTY_ADDR
  )
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [globalErr, setErr] = useState('')

  function field(name, label, type = 'text', required = false) {
    return (
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
        <input
          type={type}
          value={form[name]}
          onChange={(e) => {
            setForm((f) => ({ ...f, [name]: e.target.value }))
            setErrors((er) => ({ ...er, [name]: '' }))
          }}
          className={[
            'w-full px-3.5 py-2 text-sm bg-white border rounded-xl outline-none transition-all',
            'focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/15',
            errors[name] ? 'border-rose-500' : 'border-slate-300',
          ].join(' ')}
        />
        {errors[name] && <p className="mt-1 text-xs text-rose-600">⚠ {errors[name]}</p>}
      </div>
    )
  }

  async function handleSave(e) {
    e.preventDefault()
    const req = ['city', 'state', 'country', 'phone_number']
    const errs = {}
    req.forEach((k) => {
      if (!String(form[k] ?? '').trim()) errs[k] = 'This field is required.'
    })
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    setSaving(true)
    setErr('')
    try {
      const payload = {
        ...form,
        postal_code: form.postal_code ? parseInt(form.postal_code, 10) : undefined,
      }
      if (isEditing) {
        const { data } = await client.patch(`/user/address/?q=${initialAddress.id}`, payload)
        onSaved({ ...initialAddress, ...payload, ...data }, true)
      } else {
        const { data } = await client.post('/user/address/', payload)
        onSaved({ ...data, _localId: Date.now() }, false)
      }
    } catch (err) {
      const d = err.response?.data ?? {}
      const fieldErrs = {}
      Object.keys(EMPTY_ADDR).forEach((k) => {
        if (d[k]) fieldErrs[k] = Array.isArray(d[k]) ? d[k][0] : d[k]
      })
      if (Object.keys(fieldErrs).length) setErrors(fieldErrs)
      else setErr(d.detail || d.error || 'Could not save address. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="border-2 border-indigo-200 rounded-2xl p-5 bg-indigo-50/30 space-y-4"
    >
      <p className="text-sm font-bold text-slate-900">
        {isEditing ? 'Edit Delivery Address' : 'Add New Delivery Address'}
      </p>

      {globalErr && (
        <div className="px-3.5 py-2.5 border border-rose-300 rounded-xl bg-rose-50 text-xs font-medium text-rose-700">
          {globalErr}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('house_no', 'House / Flat / Building')}
        {field('street', 'Street / Locality')}
        {field('city', 'City', 'text', true)}
        {field('state', 'State', 'text', true)}
        {field('country', 'Country', 'text', true)}
        {field('postal_code', 'PIN / Postal Code', 'number')}
        {field('phone_number', 'Phone Number', 'tel', true)}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Address Type</label>
          <select
            value={form.address_type}
            onChange={(e) => setForm((f) => ({ ...f, address_type: e.target.value }))}
            className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-indigo-500"
          >
            {ADDRESS_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2.5 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-60 transition-colors cursor-pointer"
        >
          {saving ? 'Saving…' : isEditing ? 'Update Address' : 'Save & Use Address'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 – Address Selection
// ─────────────────────────────────────────────────────────────────────────────

function StepAddress({
  addresses,
  setAddresses,
  selectedShipping,
  setSelectedShipping,
  selectedBilling,
  setSelectedBilling,
  sameBilling,
  setSameBilling,
  onNext,
  nextLoading,
  nextError,
}) {
  const [showForm, setShowForm] = useState(false)
  const [editingAddr, setEditingAddr] = useState(null)

  const shippingAddrs = addresses.filter(
    (a) => !a.address_type || a.address_type === 'shipping' || a.address_type === 'both'
  )
  const billingAddrs = addresses.filter(
    (a) => !a.address_type || a.address_type === 'billing' || a.address_type === 'both'
  )

  function handleAddressSaved(saved, isEdit) {
    if (isEdit) {
      setAddresses((prev) => prev.map((a) => (a.id === saved.id ? { ...a, ...saved } : a)))
      setEditingAddr(null)
    } else {
      const withId = saved.id ?? saved._localId ? saved : { ...saved, id: Date.now() }
      setAddresses((prev) => [...prev, withId])
      const newId = withId.id ?? withId._localId
      setSelectedShipping(newId)
      if (sameBilling) setSelectedBilling(newId)
      setShowForm(false)
    }
  }

  const canProceed = selectedShipping && (sameBilling || selectedBilling)

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-extrabold text-slate-900">Select Delivery Address</h2>
          {!showForm && !editingAddr && (
            <button
              onClick={() => setShowForm(true)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              + Add New Address
            </button>
          )}
        </div>

        {addresses.length === 0 && !showForm && (
          <p className="text-sm text-slate-500 mb-3">
            You have no saved addresses yet. Add one below to continue.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {shippingAddrs.map((addr) => {
            const addrId = addr.id ?? addr._localId
            return (
              <AddressCard
                key={addrId}
                address={addr}
                selected={selectedShipping === addrId}
                onSelect={(id) => {
                  setSelectedShipping(id)
                  if (sameBilling) setSelectedBilling(id)
                }}
                onEdit={(a) => {
                  setShowForm(false)
                  setEditingAddr(a)
                }}
              />
            )
          })}
        </div>

        {(showForm || editingAddr) && (
          <div className="mt-4">
            <AddressForm
              initialAddress={editingAddr}
              onSaved={handleAddressSaved}
              onCancel={() => {
                setShowForm(false)
                setEditingAddr(null)
              }}
            />
          </div>
        )}
      </div>

      {/* Same billing toggle */}
      <label className="inline-flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-700 select-none">
        <input
          type="checkbox"
          checked={sameBilling}
          onChange={(e) => {
            setSameBilling(e.target.checked)
            if (e.target.checked) setSelectedBilling(selectedShipping)
            else setSelectedBilling(null)
          }}
          className="accent-indigo-600 w-4 h-4 rounded"
        />
        <span>Use the same address for billing</span>
      </label>

      {!sameBilling && (
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 mb-3">Select Billing Address</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {billingAddrs.map((addr) => {
              const addrId = addr.id ?? addr._localId
              return (
                <AddressCard
                  key={addrId}
                  address={addr}
                  selected={selectedBilling === addrId}
                  onSelect={setSelectedBilling}
                />
              )
            })}
          </div>
        </div>
      )}

      {nextError && (
        <div className="px-4 py-3 border border-rose-300 rounded-2xl bg-rose-50 text-sm text-rose-700">
          {nextError}
        </div>
      )}

      <div className="pt-2">
        <button
          onClick={onNext}
          disabled={!canProceed || nextLoading}
          className="w-full sm:w-auto px-8 py-3.5 rounded-2xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          {nextLoading ? 'Preparing Order…' : 'Continue to Payment →'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Summary Sidebar
// ─────────────────────────────────────────────────────────────────────────────

function OrderSummaryPanel({ currentOrder }) {
  const items = currentOrder.items ?? []
  const totalQty = items.reduce((s, i) => s + (i.quantity ?? 1), 0)

  return (
    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 bg-white border-b border-slate-200/80">
        <p className="text-sm font-extrabold text-slate-900">
          Order Summary{' '}
          <span className="ml-1 text-slate-400 font-semibold">
            ({totalQty} {totalQty === 1 ? 'item' : 'items'})
          </span>
        </p>
      </div>

      <div className="divide-y divide-slate-200/60 max-h-64 overflow-y-auto scrollbar-thin bg-white">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3 px-5 py-3">
            <div className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 shrink-0 flex items-center justify-center">
              <span className="text-sm font-bold text-slate-400">
                {(item.product_name ?? '?')[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">
                {item.product_name}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Qty: {item.quantity}</p>
            </div>
            <p className="text-xs font-bold font-mono text-slate-900 shrink-0">
              {item.item_total != null ? formatPrice(item.item_total) : '—'}
            </p>
          </div>
        ))}
      </div>

      <div className="px-5 py-4 border-t border-slate-200/80 space-y-2 text-xs sm:text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Subtotal</span>
          <span className="font-mono">{formatPrice(currentOrder.subtotal)}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Shipping</span>
          <span
            className={
              parseFloat(currentOrder.shipping_cost ?? 0) === 0
                ? 'text-emerald-600 font-bold'
                : 'font-mono'
            }
          >
            {parseFloat(currentOrder.shipping_cost ?? 0) === 0
              ? 'FREE'
              : formatPrice(currentOrder.shipping_cost)}
          </span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>GST (18%)</span>
          <span className="font-mono">{formatPrice(currentOrder.tax_amount)}</span>
        </div>
        {currentOrder.discount_amount && parseFloat(currentOrder.discount_amount) > 0 && (
          <div className="flex justify-between text-emerald-600 font-semibold">
            <span>Discount</span>
            <span className="font-mono">− {formatPrice(currentOrder.discount_amount)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-extrabold text-slate-900 border-t border-slate-200 pt-2.5 mt-1">
          <span>Order Total</span>
          <span className="font-mono text-indigo-600">{formatPrice(currentOrder.total_amount)}</span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 – Place Order
// ─────────────────────────────────────────────────────────────────────────────

function StepPlaceOrder({
  currentOrder,
  addresses,
  selectedShipping,
  selectedBilling,
  sameBilling,
  paymentMethod,
  setPaymentMethod,
  onBack,
  onPlaceOrder,
  placing,
  orderError,
}) {
  const shipAddr = addresses.find((a) => (a.id ?? a._localId) === selectedShipping)
  const billAddr = sameBilling
    ? shipAddr
    : addresses.find((a) => (a.id ?? a._localId) === selectedBilling)

  const isCOD = paymentMethod === 'cod'
  const isOnline = paymentMethod === 'online'

  return (
    <div className="flex flex-col lg:flex-row-reverse gap-8">
      <div className="lg:w-80 xl:w-96 shrink-0">
        <OrderSummaryPanel currentOrder={currentOrder} />
      </div>

      <div className="flex-1 space-y-6">
        {/* Address Summary */}
        <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Delivery Address
            </p>
            <button
              onClick={onBack}
              className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
            >
              Change
            </button>
          </div>
          <div className="px-5 py-4">
            {shipAddr ? (
              <>
                <p className="text-sm font-bold text-slate-900 capitalize">{shipAddr.user}</p>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5 leading-relaxed">
                  {formatAddressLine(shipAddr)}
                </p>
                {shipAddr.phone_number && (
                  <p className="text-xs font-mono text-slate-400 mt-1">📞 {shipAddr.phone_number}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">No address selected</p>
            )}
          </div>
          {billAddr && billAddr !== shipAddr && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                Billing Address
              </p>
              <p className="text-xs text-slate-600">{formatAddressLine(billAddr)}</p>
            </div>
          )}
        </div>

        {/* Payment Method Selection */}
        <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200/80">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Select Payment Method
            </p>
          </div>
          <div className="p-5 space-y-3.5">
            {/* COD */}
            <div
              onClick={() => setPaymentMethod('cod')}
              className={[
                'flex items-start gap-3.5 p-4 rounded-2xl border-2 cursor-pointer transition-all',
                isCOD
                  ? 'border-indigo-600 bg-indigo-50/40 shadow-2xs'
                  : 'border-slate-200/90 bg-white hover:border-slate-300',
              ].join(' ')}
            >
              <div
                className={[
                  'mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                  isCOD ? 'border-indigo-600' : 'border-slate-400',
                ].join(' ')}
              >
                {isCOD && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">💵</span>
                  <p className="text-sm font-bold text-slate-900">Cash on Delivery (COD)</p>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pay in cash or UPI at the doorstep when your order arrives
                </p>
              </div>
            </div>

            {/* Online Payment (Razorpay) */}
            <div
              onClick={() => setPaymentMethod('online')}
              className={[
                'flex items-start gap-3.5 p-4 rounded-2xl border-2 cursor-pointer transition-all',
                isOnline
                  ? 'border-indigo-600 bg-indigo-50/40 shadow-2xs'
                  : 'border-slate-200/90 bg-white hover:border-slate-300',
              ].join(' ')}
            >
              <div
                className={[
                  'mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                  isOnline ? 'border-indigo-600' : 'border-slate-400',
                ].join(' ')}
              >
                {isOnline && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg">💳</span>
                  <p className="text-sm font-bold text-slate-900">Online Payment</p>
                  <span className="text-[10px] font-bold text-white bg-indigo-600 rounded-md px-2 py-0.5">
                    Razorpay Secure
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Instant payment via UPI, Credit/Debit Cards, NetBanking &amp; Wallets
                </p>
              </div>
            </div>
          </div>
        </div>

        {orderError && (
          <div className="px-4 py-3 border border-rose-300 rounded-2xl bg-rose-50 text-sm text-rose-700">
            {orderError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button
            onClick={onPlaceOrder}
            disabled={placing || !paymentMethod}
            className="flex-1 sm:flex-none px-10 py-3.5 rounded-2xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {placing
              ? isOnline
                ? 'Opening Razorpay…'
                : 'Placing Order…'
              : isOnline
              ? `Pay Now — ${formatPrice(currentOrder.total_amount)}`
              : `Confirm Order — ${formatPrice(currentOrder.total_amount)}`}
          </button>
          <button
            onClick={onBack}
            disabled={placing}
            className="px-6 py-3.5 rounded-2xl text-sm font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-40 cursor-pointer"
          >
            ← Back
          </button>
        </div>

        <p className="text-xs text-slate-400">
          By placing your order, you agree to Chatram&apos;s Conditions of Use and Privacy Policy.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Checkout Page
// ─────────────────────────────────────────────────────────────────────────────

export default function Checkout() {
  const navigate = useNavigate()
  const { isBuyer } = useAuth()
  const { refreshCart } = useCart()
  const { setPageContext } = useAIChat()

  useEffect(() => {
    setPageContext({ page: 'checkout' })
  }, [setPageContext])

  useEffect(() => {
    if (!isBuyer) navigate('/login?next=/checkout', { replace: true })
  }, [isBuyer, navigate])

  const [step, setStep] = useState(1)
  const [addresses, setAddresses] = useState([])
  const [addrLoading, setAddrLoading] = useState(true)
  const [selectedShipping, setSelectedShipping] = useState(null)
  const [selectedBilling, setSelectedBilling] = useState(null)
  const [sameBilling, setSameBilling] = useState(true)
  const [nextLoading, setNextLoading] = useState(false)
  const [nextError, setNextError] = useState('')

  const [currentOrder, setCurrentOrder] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [placing, setPlacing] = useState(false)
  const [orderError, setOrderError] = useState('')

  const fetchAddresses = useCallback(async () => {
    setAddrLoading(true)
    try {
      const { data } = await client.get('/user/address/')
      const list = Array.isArray(data) ? data : []
      const tagged = list.map((a, i) => ({ ...a, _localId: a.id ?? i + 1 }))
      setAddresses(tagged)
      if (tagged.length > 0) {
        const def = tagged.find((a) => a.is_default) ?? tagged[0]
        const firstId = def.id ?? def._localId
        setSelectedShipping(firstId)
        setSelectedBilling(firstId)
      }
    } catch (err) {
      if (err.response?.status === 401) navigate('/login?next=/checkout', { replace: true })
    } finally {
      setAddrLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    fetchAddresses()
  }, [fetchAddresses])

  async function handleContinue() {
    setNextLoading(true)
    setNextError('')
    try {
      const { data: cartData } = await client.get('/user/cart/')
      const cartItems = Array.isArray(cartData) ? cartData : []

      if (cartItems.length === 0) {
        setNextError('Your cart is empty. Add items before placing an order.')
        return
      }

      const items = cartItems.map((item) => ({
        product: item.product.id,
        product_variant: item.product_variant ?? null,
        quantity: item.quantity,
      }))

      const { data } = await client.post('/user/order/', {
        shipping_address: selectedShipping,
        billing_address: sameBilling ? selectedShipping : selectedBilling,
        coupon: null,
        items,
      })

      setCurrentOrder(data)
      setStep(2)
    } catch (err) {
      const d = err.response?.data ?? {}
      const msg =
        d.detail ||
        d.error ||
        d.non_field_errors?.[0] ||
        d.items?.[0] ||
        'Could not create order. Please try again.'
      setNextError(Array.isArray(msg) ? msg[0] : msg)
    } finally {
      setNextLoading(false)
    }
  }

  async function handlePlaceOrder() {
    if (!currentOrder) return
    setPlacing(true)
    setOrderError('')

    try {
      if (paymentMethod === 'cod') {
        await client.post('/user/payments/cod/', { order_id: currentOrder.id })
        refreshCart()
        navigate('/order-confirmation', { state: { order: currentOrder }, replace: true })
        return
      }

      if (paymentMethod === 'online') {
        const loaded = await loadRazorpayScript()
        if (!loaded) {
          setOrderError('Could not load payment gateway. Check your connection and try again.')
          setPlacing(false)
          return
        }

        const { data: rpData } = await client.post('/user/payments/create/', {
          order_id: currentOrder.id,
        })

        let verifiedOrder = null
        await new Promise((resolve, reject) => {
          const options = {
            key: rpData.key,
            amount: rpData.amount,
            currency: rpData.currency || 'INR',
            name: 'Chatram',
            description: `Order #${rpData.order_number || currentOrder.order_number}`,
            order_id: rpData.razorpay_order_id,
            theme: { color: '#4f46e5' },

            handler: async (response) => {
              try {
                const { data: verifyData } = await client.post('/user/payments/verify/', {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                })
                verifiedOrder = verifyData
                resolve()
              } catch (verifyErr) {
                reject(verifyErr)
              }
            },

            modal: {
              ondismiss: () => reject(new Error('Payment cancelled by user')),
            },
          }

          const rzp = new window.Razorpay(options)
          rzp.on('payment.failed', (resp) => {
            reject(new Error(resp.error?.description || 'Payment failed'))
          })
          rzp.open()
        })

        refreshCart()
        navigate('/order-confirmation', {
          state: { order: { ...currentOrder, ...verifiedOrder } },
          replace: true,
        })
      }
    } catch (err) {
      if (err.message === 'Payment cancelled by user') {
        setOrderError('Payment was cancelled. Your order has not been confirmed.')
      } else {
        const d = err.response?.data ?? {}
        const msg =
          d.detail ||
          d.error ||
          d.non_field_errors?.[0] ||
          err.message ||
          'Something went wrong. Please try again.'
        setOrderError(Array.isArray(msg) ? msg[0] : msg)
      }
    } finally {
      setPlacing(false)
    }
  }

  function handleBack() {
    setCurrentOrder(null)
    setPaymentMethod('')
    setOrderError('')
    setStep(1)
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Secure Checkout
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete your Chatram order in two simple steps
            </p>
          </div>
          <Link to="/cart" className="text-xs font-semibold text-indigo-600 hover:underline">
            ← Back to Cart
          </Link>
        </div>

        <StepIndicator current={step} />

        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-8 shadow-2xs min-h-[320px]">
          {addrLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-3">
                <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-semibold text-slate-500">Loading your addresses…</p>
              </div>
            </div>
          ) : step === 1 ? (
            <StepAddress
              addresses={addresses}
              setAddresses={setAddresses}
              selectedShipping={selectedShipping}
              setSelectedShipping={(id) => {
                setSelectedShipping(id)
                if (sameBilling) setSelectedBilling(id)
              }}
              selectedBilling={selectedBilling}
              setSelectedBilling={setSelectedBilling}
              sameBilling={sameBilling}
              setSameBilling={setSameBilling}
              onNext={handleContinue}
              nextLoading={nextLoading}
              nextError={nextError}
            />
          ) : currentOrder ? (
            <StepPlaceOrder
              currentOrder={currentOrder}
              addresses={addresses}
              selectedShipping={selectedShipping}
              selectedBilling={selectedBilling}
              sameBilling={sameBilling}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              onBack={handleBack}
              onPlaceOrder={handlePlaceOrder}
              placing={placing}
              orderError={orderError}
            />
          ) : null}
        </div>
      </main>
    </div>
  )
}
