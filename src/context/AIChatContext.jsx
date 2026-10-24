/**
 * AIChatContext
 *
 * Global state and orchestration for the Chatram AI-MCP Shopping Copilot.
 * Allows any component (Header omnibox, ProductDetail, Home cards, Cart, Orders, Footer)
 * to open the assistant, pass page/product context, and trigger AI-MCP queries.
 * Also registers client-side WebMCP tools via `document.modelContext` when supported.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react'
import client from '../api/client'
import { useAuth } from './AuthContext'
import { useCart } from './CartContext'

const AIChatContext = createContext(null)

const DOCK_STORAGE_KEY = 'chatram_ai_docked'

let _msgCounter = 0
function nextId() {
  return ++_msgCounter
}

/**
 * Extract product IDs or product names mentioned in AI response text
 * and match against cached storefront products so we can render interactive
 * ProductsRow cards right underneath the assistant's text reply.
 */
function matchProductsInReply(replyText, catalog) {
  if (!replyText || !Array.isArray(catalog) || catalog.length === 0) return []
  const matched = []
  const seenIds = new Set()

  // 1. Check explicit product URL patterns like /product/12 or /user/products/12
  const idRegex = /\/products?\/(\d+)/gi
  let match
  while ((match = idRegex.exec(replyText)) !== null) {
    const pid = Number(match[1])
    if (pid && !seenIds.has(pid)) {
      const found = catalog.find((p) => {
        const id = p.id || Number(String(p.product_detail || '').replace(/\/$/, '').split('/').pop())
        return id === pid
      })
      if (found) {
        seenIds.add(pid)
        matched.push(found)
      }
    }
  }

  // 2. Match by product_name (case-insensitive substring match for names >= 4 chars)
  const lowerReply = replyText.toLowerCase()
  for (const prod of catalog) {
    const name = (prod.product_name || '').trim()
    if (name.length < 4) continue
    const pid = prod.id || Number(String(prod.product_detail || '').replace(/\/$/, '').split('/').pop())
    if (seenIds.has(pid)) continue
    if (lowerReply.includes(name.toLowerCase())) {
      seenIds.add(pid)
      matched.push(prod)
    }
  }

  return matched.slice(0, 6)
}

export function AIChatProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const { refreshCart } = useCart()

  const [isOpen, setIsOpen] = useState(false)
  const [isDocked, setIsDockedState] = useState(() => {
    try {
      return localStorage.getItem(DOCK_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [unread, setUnread] = useState(0)
  const [messages, setMessages] = useState([])
  const [streaming, setStreaming] = useState(false)
  const [draftInput, setDraftInput] = useState('')
  const [pageContext, setPageContext] = useState(null)
  const [sellerChatCount, setSellerChatCount] = useState(0)

  const setSellerChatOpen = useCallback((open) => {
    setSellerChatCount((c) => (open ? c + 1 : Math.max(0, c - 1)))
    if (open) {
      setIsOpen(false)
    }
  }, [])
  const sellerChatOpen = sellerChatCount > 0

  const abortRef = useRef(null)
  const catalogCacheRef = useRef(null)

  const setIsDocked = useCallback((val) => {
    setIsDockedState((prev) => {
      const next = typeof val === 'function' ? val(prev) : Boolean(val)
      try {
        localStorage.setItem(DOCK_STORAGE_KEY, String(next))
      } catch {
        // Ignore storage errors
      }
      return next
    })
  }, [])

  // Pre-warm lightweight product catalog cache so AI replies can render rich product cards
  const ensureCatalog = useCallback(async () => {
    if (catalogCacheRef.current) return catalogCacheRef.current
    try {
      const { data } = await client.get('/user/products/')
      const list = Array.isArray(data) ? data : data?.results ?? []
      catalogCacheRef.current = list
      return list
    } catch {
      return []
    }
  }, [])

  // Reset unread count when panel opens
  useEffect(() => {
    if (isOpen) {
      setUnread(0)
    }
  }, [isOpen])

  // Global keyboard shortcut: Cmd/Ctrl + K toggles AI Copilot
  useEffect(() => {
    function handleGlobalKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // Cleanup any in-flight request on unmount
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const clearChat = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
    setMessages([])
  }, [])

  /**
   * Send a user message to `/user/ai/` with contextual enrichment.
   */
  const sendMessage = useCallback(
    async (rawText, options = {}) => {
      const trimmed = rawText?.trim()
      if (!trimmed || streaming) return

      abortRef.current?.abort()
      abortRef.current = new AbortController()

      const userMsg = {
        id: nextId(),
        role: 'user',
        content: trimmed,
        contextBadge: pageContext?.product?.name || null,
      }
      const assistantId = nextId()
      const assistantMsg = { id: assistantId, role: 'assistant', parts: [] }

      // Build contextual prompt for the backend MCP agent
      const contextLines = []
      if (pageContext?.product) {
        const p = pageContext.product
        contextLines.push(
          `[Active Product Context: ID=${p.id}, Name="${p.name}", Brand="${p.brand || 'N/A'}", Price=₹${p.price}, Category="${p.category || 'N/A'}", Rating=${p.avg_rating ?? 'N/A'}]`
        )
      } else if (pageContext?.category) {
        contextLines.push(`[Active Category Filter: "${pageContext.category}"]`)
      }

      // Include last 2 exchanges so follow-up questions ("add it to my cart", "compare them") work seamlessly
      const recentTurns = messages.slice(-4).map((m) => {
        if (m.role === 'user') return `User: ${m.content}`
        const txt = (m.parts || [])
          .filter((pt) => pt.type === 'text')
          .map((pt) => pt.content)
          .join(' ')
          .slice(0, 350)
        return txt ? `Assistant: ${txt}` : null
      }).filter(Boolean)

      let enrichedPrompt = trimmed
      if (contextLines.length > 0 || recentTurns.length > 0) {
        const header = [
          ...contextLines,
          recentTurns.length > 0 ? `[Recent Conversation:\n${recentTurns.join('\n')}]` : '',
        ]
          .filter(Boolean)
          .join('\n')
        enrichedPrompt = `${header}\n\nUser request: ${trimmed}`
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      if (!options.preserveDraft) setDraftInput('')
      setStreaming(true)

      try {
        const response = await client.post(
          '/user/ai/',
          {
            prompt: enrichedPrompt,
            user_prompt: trimmed,
            context: pageContext,
          },
          { signal: abortRef.current.signal }
        )

        const data = response.data || {}
        const replyText = data.response ?? 'No response received.'

        const newParts = [{ type: 'text', content: replyText }]

        // Match products mentioned in the reply so we can render interactive product cards
        const catalog = await ensureCatalog()
        const matchedProducts = Array.isArray(data.products) && data.products.length > 0
          ? data.products
          : matchProductsInReply(replyText, catalog)

        if (matchedProducts.length > 0) {
          newParts.push({ type: 'products', data: matchedProducts })
        }

        if (data.order_confirmed) {
          newParts.push({ type: 'order_confirmed', data: data.order_confirmed })
        }

        // If the prompt or reply relates to cart/order mutations, refresh CartContext
        const lowerCombined = `${trimmed} ${replyText}`.toLowerCase()
        if (
          lowerCombined.includes('cart') ||
          lowerCombined.includes('added') ||
          lowerCombined.includes('removed') ||
          lowerCombined.includes('order')
        ) {
          refreshCart?.()
        }

        setMessages((prev) => {
          const idx = prev.findLastIndex((m) => m.id === assistantId)
          if (idx === -1) return prev
          const updated = [...prev]
          updated[idx] = {
            ...updated[idx],
            parts: newParts,
          }
          return updated
        })

        if (!isOpen) setUnread((u) => u + 1)
      } catch (err) {
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return

        const errorMsg =
          err.response?.data?.error ??
          err.response?.data?.detail ??
          err.message ??
          'Connection failed. Please try again.'

        setMessages((prev) => {
          const idx = prev.findLastIndex((m) => m.id === assistantId)
          if (idx === -1) return prev
          const updated = [...prev]
          updated[idx] = {
            ...updated[idx],
            parts: [{ type: 'error', content: errorMsg }],
          }
          return updated
        })
      } finally {
        setStreaming(false)
      }
    },
    [streaming, pageContext, messages, ensureCatalog, refreshCart, isOpen]
  )

  /**
   * Open the AI Copilot and either immediately send a prompt or pre-fill the input.
   */
  const askAI = useCallback(
    (prompt, options = { autoSend: true }) => {
      setIsOpen(true)
      if (!prompt) return
      if (options.autoSend === false || !isAuthenticated) {
        setDraftInput(prompt)
      } else {
        sendMessage(prompt)
      }
    },
    [isAuthenticated, sendMessage]
  )

  // Register client-side WebMCP tools when supported by the browser
  useEffect(() => {
    if (
      typeof document === 'undefined' ||
      !('modelContext' in document) ||
      typeof document.modelContext?.registerTool !== 'function'
    ) {
      return
    }

    const controller = new AbortController()
    try {
      document.modelContext.registerTool(
        {
          name: 'ask_chatram_copilot',
          description: 'Open the Chatram AI-MCP Shopping Copilot and send a shopping query.',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'Natural language question about products, cart, or orders.',
              },
            },
            required: ['prompt'],
          },
          execute: async ({ prompt }) => {
            askAI(prompt, { autoSend: true })
            return {
              content: [{ type: 'text', text: `Sent prompt to Chatram Copilot: "${prompt}"` }],
            }
          },
        },
        { signal: controller.signal }
      )
    } catch {
      // Ignore if browser modelContext implementation differs
    }

    return () => controller.abort()
  }, [askAI])

  const value = {
    isOpen,
    setIsOpen,
    isDocked,
    setIsDocked,
    unread,
    setUnread,
    messages,
    setMessages,
    streaming,
    draftInput,
    setDraftInput,
    pageContext,
    setPageContext,
    sellerChatOpen,
    setSellerChatOpen,
    sendMessage,
    askAI,
    clearChat,
  }

  return <AIChatContext.Provider value={value}>{children}</AIChatContext.Provider>
}

/* eslint-disable-next-line react-refresh/only-export-components */
export function useAIChat() {
  const ctx = useContext(AIChatContext)
  if (!ctx) throw new Error('useAIChat must be used inside <AIChatProvider>')
  return ctx
}

export default AIChatContext
