/**
 * Checkout — /checkout   (isBuyer only)
 *
 * 2-step wizard:
 *
 *   Step 1 – Address
 *     • Fetch saved addresses, radio-select shipping + billing
 *     • "Add new address" inline form
 *     • "Continue" → POST /user/orders/ { shipping_address_id, billing_address_id }
 *       returns { order_id, order_number, subtotal, shipping_cost, tax_amount,
 *                 total_amount, items }  → stored as currentOrder
 *
 *   Step 2 – Place Order  (two-column layout)
 *     Right sidebar  – items + real server totals from currentOrder
 *     Left panel     – delivery address summary + payment selector
 *
 *     COD:    POST /user/payments/cod/<order_id>/confirm/
 *     Online: POST /api/payments/create/ { order_id }
 *             → open Razorpay popup
 *             → POST /user/payments/verify/ { razorpay_* }
 *
 *     On success → refreshCart() + navigate('/order-confirmation', { state: { order } })
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Header from '../components/Header'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = ['Address', 'Place Order']

const ADDRESS_TYPE_OPTIONS = [
  { value: 'both',     label: 'Shipping & Billing' },
  { value: 'shipping', label: 'Shipping only' },
  { value: 'billing',  label: 'Billing only' },
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

/** Inject the Razorpay checkout.js script once; resolves true/false */
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return }
    const s   = document.createElement('script')
    s.src     = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload  = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center mb-8 select-none">
      {STEPS.map((label, idx) => {
        const step   = idx + 1
        const done   = step < current
        const active = step === current

        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={[
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all',
                done   ? 'bg-[#007600] border-[#007600] text-white'
                : active ? 'bg-[#131921] border-[#131921] text-[#febd69]'
                :          'bg-white border-gray-300 text-gray-400',
              ].join(' ')}>
                {done ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                ) : step}
              </div>
              <span className={[
                'text-xs font-medium whitespace-nowrap',
                active ? 'text-[#131921]' : done ? 'text-[#007600]' : 'text-gray-400',
              ].join(' ')}>{label}</span>
            </div>

            {idx < STEPS.length - 1 && (
              <div className={[
                'w-24 sm:w-40 h-0.5 mx-2 mb-5 transition-all',
                step < current ? 'bg-[#007600]' : 'bg-gray-300',
              ].join(' ')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Address card
// ─────────────────────────────────────────────────────────────────────────────

function AddressCard({ address, selected, onSelect }) {
  const id = address.id ?? address._localId
  return (
    <div
      onClick={() => onSelect(id)}
      className={[
        'border-2 rounded-lg p-4 cursor-pointer transition-all',
        selected ? 'border-[#e77600] bg-orange-50 shadow-sm' : 'border-gray-200 hover:border-gray-400 bg-white',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div className={[
          'mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
          selected ? 'border-[#e77600]' : 'border-gray-400',
        ].join(' ')}>
          {selected && <div className="w-2 h-2 rounded-full bg-[#e77600]" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 capitalize">
            {address.user ?? 'My address'}
            <span className="ml-2 text-[10px] font-medium text-white bg-gray-500 rounded px-1.5 py-0.5 uppercase tracking-wide">
              {address.address_type ?? 'both'}
            </span>
          </p>
          <p className="text-sm text-gray-600 mt-0.5 leading-snug">{formatAddressLine(address)}</p>
          {address.phone_number && (
            <p className="text-xs text-gray-400 mt-1">📞 {address.phone_number}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// New address form
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_ADDR = {
  house_no: '', street: '', city: '', state: '',
  country: 'India', postal_code: '', phone_number: '', address_type: 'both',
}

function AddressForm({ onSaved, onCancel }) {
  const [form, setForm]     = useState(EMPTY_ADDR)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [globalErr, setErr] = useState('')

  function field(name, label, type = 'text', required = false) {
    return (
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <input
          type={type}
          value={form[name]}
          onChange={(e) => { setForm(f => ({ ...f, [name]: e.target.value })); setErrors(er => ({ ...er, [name]: '' })) }}
          className={[
            'w-full px-3 py-2 text-sm border rounded outline-none transition-all',
            'focus:border-[#e77600] focus:ring-[3px] focus:ring-[rgba(228,121,17,0.5)]',
            errors[name] ? 'border-red-500' : 'border-gray-400',
          ].join(' ')}
        />
        {errors[name] && <p className="mt-0.5 text-xs text-red-600">⚠ {errors[name]}</p>}
      </div>
    )
  }

  async function handleSave(e) {
    e.preventDefault()
    const req  = ['city', 'state', 'country', 'phone_number']
    const errs = {}
    req.forEach(k => { if (!form[k]?.trim()) errs[k] = 'This field is required.' })
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true); setErr('')
    try {
      const payload = { ...form, postal_code: form.postal_code ? parseInt(form.postal_code, 10) : undefined }
      const { data } = await client.post('/user/address/', payload)
      onSaved({ ...data, _localId: Date.now() })
    } catch (err) {
      const d = err.response?.data ?? {}
      const fieldErrs = {}
      Object.keys(EMPTY_ADDR).forEach(k => { if (d[k]) fieldErrs[k] = Array.isArray(d[k]) ? d[k][0] : d[k] })
      if (Object.keys(fieldErrs).length) setErrors(fieldErrs)
      else setErr(d.detail || d.error || 'Could not save address. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="border-2 border-[#e77600] rounded-lg p-5 bg-orange-50 space-y-4">
      <p className="text-sm font-semibold text-gray-800">New delivery address</p>

      {globalErr && (
        <div className="px-3 py-2 border border-red-400 rounded bg-red-50 text-sm text-red-700">{globalErr}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('house_no', 'House / Flat No.')}
        {field('street', 'Street / Area')}
        {field('city', 'City', 'text', true)}
        {field('state', 'State', 'text', true)}
        {field('country', 'Country', 'text', true)}
        {field('postal_code', 'PIN / ZIP code', 'number')}
        {field('phone_number', 'Phone number', 'tel', true)}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Address type</label>
          <select
            value={form.address_type}
            onChange={(e) => setForm(f => ({ ...f, address_type: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-400 rounded outline-none focus:border-[#e77600] focus:ring-[3px] focus:ring-[rgba(228,121,17,0.5)]"
          >
            {ADDRESS_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={saving}
          className="px-5 py-2 rounded text-sm font-medium border border-[#a88734] bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b] hover:from-[#f5d78e] hover:to-[#eeb933] text-gray-900 disabled:opacity-60 transition-all"
        >
          {saving ? 'Saving…' : 'Use this address'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-5 py-2 rounded text-sm font-medium border border-gray-400 bg-white hover:bg-gray-50 text-gray-700 transition-all"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 – Address
// ─────────────────────────────────────────────────────────────────────────────

function StepAddress({
  addresses, setAddresses,
  selectedShipping, setSelectedShipping,
  selectedBilling, setSelectedBilling,
  sameBilling, setSameBilling,
  onNext, nextLoading, nextError,
}) {
  const [showForm, setShowForm] = useState(false)

  const shippingAddrs = addresses.filter(a =>
    !a.address_type || a.address_type === 'shipping' || a.address_type === 'both'
  )
  const billingAddrs  = addresses.filter(a =>
    !a.address_type || a.address_type === 'billing'  || a.address_type === 'both'
  )

  function handleNewAddress(saved) {
    const withId = saved.id ?? saved._localId ? saved : { ...saved, id: Date.now() }
    setAddresses(prev => [...prev, withId])
    const newId = withId.id ?? withId._localId
    setSelectedShipping(newId)
    if (sameBilling) setSelectedBilling(newId)
    setShowForm(false)
  }

  const canProceed = selectedShipping && (sameBilling || selectedBilling)

  return (
    <div className="space-y-6">
      {/* Shipping */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Delivery address</h2>

        {addresses.length === 0 && !showForm && (
          <p className="text-sm text-gray-500 mb-3">You have no saved addresses.</p>
        )}

        <div className="space-y-3">
          {shippingAddrs.map(addr => {
            const addrId = addr.id ?? addr._localId
            return (
              <AddressCard key={addrId} address={addr}
                selected={selectedShipping === addrId}
                onSelect={id => { setSelectedShipping(id); if (sameBilling) setSelectedBilling(id) }}
              />
            )
          })}
        </div>

        {!showForm ? (
          <button onClick={() => setShowForm(true)}
            className="mt-3 flex items-center gap-1.5 text-sm text-[#007185] hover:text-[#c7511f] font-medium transition-colors"
          >
            <span className="text-lg leading-none">+</span> Add a new address
          </button>
        ) : (
          <div className="mt-4">
            <AddressForm onSaved={handleNewAddress} onCancel={() => setShowForm(false)} />
          </div>
        )}
      </div>

      {/* Same-billing toggle */}
      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
        <input type="checkbox" checked={sameBilling}
          onChange={e => {
            setSameBilling(e.target.checked)
            if (e.target.checked) setSelectedBilling(selectedShipping)
            else setSelectedBilling(null)
          }}
          className="accent-[#e77600] w-4 h-4"
        />
        Use the same address for billing
      </label>

      {/* Separate billing */}
      {!sameBilling && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Billing address</h2>
          <div className="space-y-3">
            {billingAddrs.map(addr => {
              const addrId = addr.id ?? addr._localId
              return (
                <AddressCard key={addrId} address={addr}
                  selected={selectedBilling === addrId}
                  onSelect={setSelectedBilling}
                />
              )
            })}
          </div>
          {billingAddrs.length === 0 && (
            <p className="text-sm text-gray-500">No billing addresses found.</p>
          )}
        </div>
      )}

      {/* API error from order creation */}
      {nextError && (
        <div className="px-4 py-3 border border-red-400 rounded-lg bg-red-50 text-sm text-red-700">
          {nextError}
        </div>
      )}

      <button onClick={onNext} disabled={!canProceed || nextLoading}
        className={[
          'w-full sm:w-auto px-8 py-2.5 rounded-full text-sm font-medium transition-all shadow-sm',
          'border border-[#a88734] bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b]',
          'hover:from-[#f5d78e] hover:to-[#eeb933] text-gray-900',
          'focus:outline-none focus:ring-2 focus:ring-[#e77600]',
          'disabled:opacity-40 disabled:cursor-not-allowed',
        ].join(' ')}
      >
        {nextLoading ? (
          <span className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
            Creating order…
          </span>
        ) : 'Continue to payment'}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Order summary sidebar (uses server totals from currentOrder)
// ─────────────────────────────────────────────────────────────────────────────

function OrderSummaryPanel({ currentOrder }) {
  const items    = currentOrder.items ?? []
  const totalQty = items.reduce((s, i) => s + (i.quantity ?? 1), 0)

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-[#f0f2f2] border-b border-gray-200">
        <p className="text-sm font-bold text-gray-800">
          Order Summary
          <span className="ml-1.5 text-gray-500 font-normal">
            ({totalQty} {totalQty === 1 ? 'item' : 'items'})
          </span>
        </p>
      </div>

      {/* Items */}
      <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3 px-4 py-3">
            {/* Initial avatar */}
            <div className="w-10 h-10 rounded border border-gray-200 bg-gray-50 flex-shrink-0 flex items-center justify-center">
              <span className="text-sm font-bold text-gray-300">
                {(item.product_name ?? '?')[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">
                {item.product_name}
              </p>
              {item.product_variant && (
                <p className="text-[11px] text-gray-400 mt-0.5">Variant #{item.product_variant}</p>
              )}
              <p className="text-[11px] text-gray-500 mt-0.5">Qty: {item.quantity}</p>
            </div>
            <p className="text-sm font-semibold text-gray-900 flex-shrink-0">
              {item.item_total != null ? formatPrice(item.item_total) : '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Price breakdown — real server values */}
      <div className="px-4 py-4 border-t border-gray-200 space-y-1.5 bg-[#fafafa]">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal:</span>
          <span>{formatPrice(currentOrder.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Shipping:</span>
          <span className={parseFloat(currentOrder.shipping_cost ?? 0) === 0 ? 'text-[#007600] font-medium' : ''}>
            {parseFloat(currentOrder.shipping_cost ?? 0) === 0
              ? 'FREE'
              : formatPrice(currentOrder.shipping_cost)}
          </span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>GST (18%):</span>
          <span>{formatPrice(currentOrder.tax_amount)}</span>
        </div>
        {currentOrder.discount_amount && parseFloat(currentOrder.discount_amount) > 0 && (
          <div className="flex justify-between text-sm text-[#007600]">
            <span>Discount:</span>
            <span>− {formatPrice(currentOrder.discount_amount)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2 mt-1">
          <span>Order Total:</span>
          <span className="text-[#B12704]">{formatPrice(currentOrder.total_amount)}</span>
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
  addresses, selectedShipping, selectedBilling, sameBilling,
  paymentMethod, setPaymentMethod,
  onBack, onPlaceOrder, placing, orderError,
}) {
  const shipAddr = addresses.find(a => (a.id ?? a._localId) === selectedShipping)
  const billAddr = sameBilling
    ? shipAddr
    : addresses.find(a => (a.id ?? a._localId) === selectedBilling)

  const isCOD    = paymentMethod === 'cod'
  const isOnline = paymentMethod === 'online'

  return (
    <div className="flex flex-col lg:flex-row-reverse gap-6">

      {/* ── RIGHT: order summary sidebar ─────────────────────────── */}
      <div className="lg:w-72 xl:w-80 flex-shrink-0">
        <OrderSummaryPanel currentOrder={currentOrder} />
      </div>

      {/* ── LEFT: address + payment + CTA ────────────────────────── */}
      <div className="flex-1 space-y-5">

        {/* Delivery address summary */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-[#f0f2f2] border-b border-gray-200 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-800">Deliver to</p>
            <button onClick={onBack}
              className="text-xs text-[#007185] hover:text-[#c7511f] font-medium transition-colors"
            >
              Change
            </button>
          </div>
          <div className="px-4 py-3">
            {shipAddr ? (
              <>
                <p className="text-sm font-semibold text-gray-800 capitalize">{shipAddr.user}</p>
                <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{formatAddressLine(shipAddr)}</p>
                {shipAddr.phone_number && (
                  <p className="text-xs text-gray-400 mt-1">📞 {shipAddr.phone_number}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400">No address selected</p>
            )}
          </div>
          {billAddr && billAddr !== shipAddr && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Billing address
              </p>
              <p className="text-xs text-gray-600">{formatAddressLine(billAddr)}</p>
            </div>
          )}
        </div>

        {/* Order number badge */}
        {currentOrder.order_number && (
          <p className="text-xs text-gray-500">
            Order reference:{' '}
            <span className="font-mono font-semibold text-gray-700">{currentOrder.order_number}</span>
          </p>
        )}

        {/* Payment method */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-[#f0f2f2] border-b border-gray-200">
            <p className="text-sm font-bold text-gray-800">Payment method</p>
          </div>
          <div className="p-4 space-y-3">

            {/* Cash on Delivery */}
            <div
              onClick={() => setPaymentMethod('cod')}
              className={[
                'flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
                isCOD ? 'border-[#e77600] bg-orange-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300',
              ].join(' ')}
            >
              <div className={[
                'mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                isCOD ? 'border-[#e77600]' : 'border-gray-400',
              ].join(' ')}>
                {isCOD && <div className="w-2 h-2 rounded-full bg-[#e77600]" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">💵</span>
                  <p className="text-sm font-semibold text-gray-800">Cash on Delivery</p>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Pay in cash when your order arrives</p>
              </div>
            </div>

            {/* Online Payment (Razorpay) */}
            <div
              onClick={() => setPaymentMethod('online')}
              className={[
                'flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
                isOnline ? 'border-[#e77600] bg-orange-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300',
              ].join(' ')}
            >
              <div className={[
                'mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                isOnline ? 'border-[#e77600]' : 'border-gray-400',
              ].join(' ')}>
                {isOnline && <div className="w-2 h-2 rounded-full bg-[#e77600]" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl">💳</span>
                  <p className="text-sm font-semibold text-gray-800">Online Payment</p>
                  <span className="text-[10px] font-bold text-white bg-[#528FF0] rounded px-1.5 py-0.5 tracking-wide">
                    Razorpay
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  UPI · Cards · Net Banking · Wallets — all supported
                </p>
                {isOnline && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {['UPI', 'Visa', 'Mastercard', 'RuPay', 'Paytm'].map(m => (
                      <span key={m}
                        className="text-[10px] border border-gray-300 rounded px-1.5 py-0.5 text-gray-500 bg-white"
                      >{m}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {orderError && (
          <div className="px-4 py-3 border border-red-400 rounded-lg bg-red-50 text-sm text-red-700">
            {orderError}
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button
            onClick={onPlaceOrder}
            disabled={placing || !paymentMethod}
            className={[
              'flex-1 sm:flex-none px-10 py-3 rounded-full text-sm font-bold transition-all shadow-md',
              'border border-[#a88734] bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b]',
              'hover:from-[#f5d78e] hover:to-[#eeb933] text-gray-900',
              'focus:outline-none focus:ring-2 focus:ring-[#e77600]',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            {placing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                {isOnline ? 'Opening payment…' : 'Placing order…'}
              </span>
            ) : isOnline ? (
              <span className="flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M2.5 4A1.5 1.5 0 0 0 1 5.5V6h18v-.5A1.5 1.5 0 0 0 17.5 4h-15ZM19 8.5H1v6A1.5 1.5 0 0 0 2.5 16h15a1.5 1.5 0 0 0 1.5-1.5v-6ZM3 13.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm4.75-.75a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z" clipRule="evenodd" />
                </svg>
                Pay Now — {formatPrice(currentOrder.total_amount)}
              </span>
            ) : (
              `Place Order — ${formatPrice(currentOrder.total_amount)}`
            )}
          </button>
          <button onClick={onBack} disabled={placing}
            className="px-6 py-3 rounded-full text-sm font-medium border border-gray-400 bg-white hover:bg-gray-50 text-gray-700 transition-all disabled:opacity-40"
          >
            Back
          </button>
        </div>

        <p className="text-xs text-gray-400 max-w-sm">
          By placing your order, you agree to ShopZone's{' '}
          <a href="#" className="text-[#007185] hover:underline">Conditions of Use</a> and{' '}
          <a href="#" className="text-[#007185] hover:underline">Privacy Notice</a>.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function Checkout() {
  const navigate = useNavigate()
  const { isBuyer } = useAuth()
  const { refreshCart } = useCart()

  useEffect(() => {
    if (!isBuyer) navigate('/login?next=/checkout', { replace: true })
  }, [isBuyer, navigate])

  // ── Wizard state ──────────────────────────────────────────────────
  const [step, setStep] = useState(1)

  // Step 1 — address
  const [addresses,        setAddresses]        = useState([])
  const [addrLoading,      setAddrLoading]      = useState(true)
  const [selectedShipping, setSelectedShipping] = useState(null)
  const [selectedBilling,  setSelectedBilling]  = useState(null)
  const [sameBilling,      setSameBilling]      = useState(true)
  const [nextLoading,      setNextLoading]      = useState(false)
  const [nextError,        setNextError]        = useState('')

  // Order created at Step 1→2 transition
  const [currentOrder, setCurrentOrder] = useState(null)

  // Step 2 — payment
  const [paymentMethod, setPaymentMethod] = useState('')  // 'cod' | 'online'
  const [placing,       setPlacing]       = useState(false)
  const [orderError,    setOrderError]    = useState('')

  // ── Fetch addresses ───────────────────────────────────────────────
  const fetchAddresses = useCallback(async () => {
    setAddrLoading(true)
    try {
      const { data } = await client.get('/user/address/')
      const list   = Array.isArray(data) ? data : []
      const tagged = list.map((a, i) => ({ ...a, _localId: a.id ?? i + 1 }))
      setAddresses(tagged)
      if (tagged.length > 0) {
        const firstId = tagged[0].id ?? tagged[0]._localId
        setSelectedShipping(firstId)
        setSelectedBilling(firstId)
      }
    } catch (err) {
      if (err.response?.status === 401) navigate('/login?next=/checkout', { replace: true })
    } finally {
      setAddrLoading(false)
    }
  }, [navigate])

  useEffect(() => { fetchAddresses() }, [fetchAddresses])

  // ── Step 1 → 2: fetch cart, create order, then advance ───────────
  async function handleContinue() {
    setNextLoading(true)
    setNextError('')
    try {
      // 1. Fetch current cart to build the items payload
      const { data: cartData } = await client.get('/user/cart/')
      const cartItems = Array.isArray(cartData) ? cartData : []

      if (cartItems.length === 0) {
        setNextError('Your cart is empty. Add items before placing an order.')
        return
      }

      const items = cartItems.map(item => ({
        product:         item.product.id,
        product_variant: item.product_variant ?? null,
        quantity:        item.quantity,
      }))

      // 2. Create the order — field names match the serializer
      const { data } = await client.post('/user/order/', {
        shipping_address: selectedShipping,
        billing_address:  sameBilling ? selectedShipping : selectedBilling,
        coupon:           null,
        items,
      })

      setCurrentOrder(data)
      setStep(2)
    } catch (err) {
      const d   = err.response?.data ?? {}
      const msg =
        d.detail || d.error || d.non_field_errors?.[0] ||
        d.items?.[0] || 'Could not create order. Please try again.'
      setNextError(Array.isArray(msg) ? msg[0] : msg)
    } finally {
      setNextLoading(false)
    }
  }

  // ── Step 2: handle payment ────────────────────────────────────────
  async function handlePlaceOrder() {
    if (!currentOrder) return
    setPlacing(true)
    setOrderError('')

    try {
      // ── COD ───────────────────────────────────────────────────────
      if (paymentMethod === 'cod') {
        await client.post('/user/payments/cod/', { order_id: currentOrder.id })
        refreshCart()
        navigate('/order-confirmation', { state: { order: currentOrder }, replace: true })
        return
      }

      // ── Razorpay ──────────────────────────────────────────────────
      if (paymentMethod === 'online') {
        const loaded = await loadRazorpayScript()
        if (!loaded) {
          setOrderError('Could not load payment gateway. Check your connection and try again.')
          setPlacing(false)
          return
        }

        // Get Razorpay order from backend
        const { data: rpData } = await client.post('/user/payments/create/', {
          order_id: currentOrder.id,
        })

        // Open Razorpay popup; on success verify signature + update DB in one call
        let verifiedOrder = null
        await new Promise((resolve, reject) => {
          const options = {
            key:         rpData.key,
            amount:      rpData.amount,
            currency:    rpData.currency || 'INR',
            name:        'ShopZone',
            description: `Order #${rpData.order_number || currentOrder.order_number}`,
            order_id:    rpData.razorpay_order_id,
            theme:       { color: '#e77600' },

            handler: async (response) => {
              try {
                // Verify signature → backend also updates payment status,
                // order status, and deducts stock in one atomic transaction
                const { data: verifyData } = await client.post('/user/payments/verify/', {
                  razorpay_order_id:   response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature:  response.razorpay_signature,
                })
                verifiedOrder = verifyData   // { order_number, order_id, total_amount, payment_id }
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
          rzp.on('payment.failed', resp => {
            reject(new Error(resp.error?.description || 'Payment failed'))
          })
          rzp.open()
        })

        refreshCart()
        // Merge verified server data into currentOrder for the confirmation page
        navigate('/order-confirmation', {
          state: { order: { ...currentOrder, ...verifiedOrder } },
          replace: true,
        })
      }

    } catch (err) {
      if (err.message === 'Payment cancelled by user') {
        setOrderError('Payment was cancelled. Your order has not been confirmed.')
      } else {
        const d   = err.response?.data ?? {}
        const msg = d.detail || d.error || d.non_field_errors?.[0] || err.message || 'Something went wrong. Please try again.'
        setOrderError(Array.isArray(msg) ? msg[0] : msg)
      }
    } finally {
      setPlacing(false)
    }
  }

  // ── Back from Step 2 ──────────────────────────────────────────────
  function handleBack() {
    setCurrentOrder(null)
    setPaymentMethod('')
    setOrderError('')
    setStep(1)
  }

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#eaeded] flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto w-full px-3 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="text-2xl font-extrabold text-[#131921] font-serif tracking-tight">
            ShopZone
          </Link>
          <span className="text-gray-300 text-lg">|</span>
          <h1 className="text-xl font-semibold text-gray-800">Checkout</h1>
        </div>

        <StepIndicator current={step} />

        <div className="bg-white border border-gray-200 rounded-lg p-5 sm:p-7 shadow-sm min-h-[300px]">
          {addrLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-3">
                <div className="inline-block w-8 h-8 border-4 border-[#febd69] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500">Loading checkout…</p>
              </div>
            </div>
          ) : step === 1 ? (
            <StepAddress
              addresses={addresses} setAddresses={setAddresses}
              selectedShipping={selectedShipping}
              setSelectedShipping={id => { setSelectedShipping(id); if (sameBilling) setSelectedBilling(id) }}
              selectedBilling={selectedBilling} setSelectedBilling={setSelectedBilling}
              sameBilling={sameBilling} setSameBilling={setSameBilling}
              onNext={handleContinue} nextLoading={nextLoading} nextError={nextError}
            />
          ) : currentOrder ? (
            <StepPlaceOrder
              currentOrder={currentOrder}
              addresses={addresses}
              selectedShipping={selectedShipping} selectedBilling={selectedBilling}
              sameBilling={sameBilling}
              paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
              onBack={handleBack}
              onPlaceOrder={handlePlaceOrder}
              placing={placing} orderError={orderError}
            />
          ) : null}
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 mt-5 text-xs text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
          </svg>
          Safe and secure checkout — 256-bit SSL encryption
        </div>
      </main>
    </div>
  )
}
