/**
 * CartContext
 *
 * Provides app-wide cart state so any component (Header badge, product
 * cards) can read / mutate the cart without prop-drilling.
 *
 * Context value:
 *   cartCount          – total number of items (sum of quantities)
 *   cartItems          – raw cart array from the API
 *   addToCart(id, qty) – POST /user/cart/ then refreshes count
 *   removeFromCart(id) – DELETE /user/cart/ then refreshes count
 *   refreshCart()      – force re-fetch (call after any mutation)
 *   cartLoading        – true while the initial fetch is in flight
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react'
import client from '../api/client'
import { useAuth } from './AuthContext'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const { isAuthenticated, authReady } = useAuth()
  const [cartItems, setCartItems] = useState([])
  const [cartLoading, setCartLoading] = useState(false)

  const fetchCart = useCallback(async () => {
    // Don't fetch until auth state has been read from localStorage.
    if (!authReady || !isAuthenticated) {
      setCartItems([])
      return
    }
    setCartLoading(true)
    try {
      const { data } = await client.get('/user/cart/')
      setCartItems(Array.isArray(data) ? data : [])
    } catch {
      setCartItems([])
    } finally {
      setCartLoading(false)
    }
  }, [isAuthenticated, authReady])

  // Reload cart whenever auth state changes (login / logout / session restore)
  useEffect(() => {
    fetchCart()
  }, [fetchCart])

  /**
   * Add a product to the cart.
   * @param {number|string} productId
   * @param {number}        quantity  defaults to 1
   */
  const addToCart = useCallback(
    async (productId, quantity = 1) => {
      await client.post('/user/cart/', { product: productId, quantity })
      await fetchCart()
    },
    [fetchCart]
  )

  /**
   * Remove a product from the cart entirely.
   * @param {number|string} productId
   * @param {number|string} variantId  pass 0 when no variant
   */
  const removeFromCart = useCallback(
    async (productId, variantId = 0) => {
      await client.delete(`/user/cart/?product=${productId}&variant=${variantId}`)
      await fetchCart()
    },
    [fetchCart]
  )

  // Total quantity across all line items
  const cartCount = cartItems.reduce((sum, item) => sum + (item.quantity ?? 1), 0)

  const value = {
    cartItems,
    cartCount,
    cartLoading,
    addToCart,
    removeFromCart,
    refreshCart: fetchCart,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}

export default CartContext
