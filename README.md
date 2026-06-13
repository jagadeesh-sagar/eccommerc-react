# Chatram — E-Commerce Frontend

> **Live:** [https://ecommerce.chatram.in](https://ecommerce.chatram.in)  
> **Backend repo:** [django-ecommerce-app](https://github.com/jagadeesh-sagar/django-ecommerce-app)

A full-featured e-commerce storefront built with React 19 and Vite. Supports buyer and seller flows with JWT cookie auth, real-time order chat, S3 image uploads, and a multi-tab seller dashboard.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS 4 |
| Routing | React Router DOM 7 |
| HTTP Client | Axios |
| Auth | JWT (HttpOnly cookies via Django backend) |

---

## Features

### Buyer
- Browse and search products with category/brand filters
- Product detail page with image gallery, variants, and Q&A
- Cart management (add, update quantity, remove)
- Address management and checkout flow
- Order history with real-time chat with seller per order
- Review and rating submission

### Seller
- Seller registration gate — redirects unregistered users to `/seller/registration/`
- Multi-tab Seller Dashboard:
  - **Products** — view all listed products
  - **Create Product** — 2-step wizard (details → S3 image/video upload)
  - **Brands** — create and manage brands
  - **Q&A** — answer customer questions per product
  - **Orders** — view orders with slide-in buyer chat panel
- Dynamic product variants (color, size, SKU, price, stock)
- Direct-to-S3 presigned URL uploads for images and videos

### Auth
- JWT stored in HttpOnly cookies (no `localStorage`)
- `AuthContext` for global user state
- Protected routes for buyer and seller pages

---

## Project Structure

```
src/
├── api/
│   └── client.js              # Axios instance with base URL + credentials
├── components/
│   ├── Header.jsx
│   ├── OrderChatPanel.jsx     # WebSocket/polling chat panel
│   └── ...
├── context/
│   └── AuthContext.jsx        # Global auth state
├── pages/
│   ├── Home.jsx
│   ├── ProductDetail.jsx
│   ├── Cart.jsx
│   ├── Checkout.jsx
│   ├── Orders.jsx
│   ├── SellerDashboard.jsx    # Main seller interface
│   ├── SellerRegistration.jsx
│   └── ...
└── main.jsx
```

---

## Local Setup

**Prerequisites:** Node.js 18+, npm

### 1. Clone and install

```bash
git clone https://github.com/jagadeesh-sagar/eccommerc-react.git
cd eccommerc-react
npm install
```

### 2. Configure the API base URL

Open `src/api/client.js` and set `baseURL` to your backend:

```js
// src/api/client.js
import axios from 'axios'

const client = axios.create({
  baseURL: 'http://127.0.0.1:8000',   // local Django backend
  withCredentials: true,               // send JWT cookies
})

export default client
```

For production, change `baseURL` to your deployed backend URL.

### 3. Run dev server

```bash
npm run dev
```

App runs at `http://localhost:5173`.

---

## Build & Deploy

```bash
# Production build
npm run build

# Preview production build locally
npm run preview
```

The `dist/` folder is the deployable output. This project is deployed on **Cloudflare Pages** (or any static host).

### Vite config note

If deploying under a sub-path, update `vite.config.js`:

```js
export default defineConfig({
  base: '/',   // change if hosted at /app/ etc.
  plugins: [react()],
})
```

---

## Environment / CORS

The frontend uses `withCredentials: true` on all Axios requests so JWT cookies are sent cross-origin. Your Django backend must have:

```python
# settings.py
CORS_ALLOWED_ORIGINS = ['https://ecommerce.chatram.in']
CORS_ALLOW_CREDENTIALS = True
SESSION_COOKIE_SAMESITE = 'None'
SESSION_COOKIE_SECURE = True
```

---

## Key Routes

| Path | Page | Access |
|---|---|---|
| `/` | Home / product listing | Public |
| `/product/:id` | Product detail | Public |
| `/cart` | Cart | Buyer |
| `/checkout` | Checkout | Buyer |
| `/orders` | Order history | Buyer |
| `/seller` | Seller dashboard | Seller (gate-checked) |
| `/seller/registration/` | Seller registration | Authenticated user |
| `/login` | Login | Public |
| `/register` | Register | Public |

---

## Scripts

```bash
npm run dev       # Start dev server (HMR)
npm run build     # Production build → dist/
npm run preview   # Serve dist/ locally
npm run lint      # ESLint check
```

---

## Related

- **Backend:** [jagadeesh-sagar/django-ecommerce-app](https://github.com/jagadeesh-sagar/django-ecommerce-app) — Django + DRF + PostgreSQL + Celery + Redis + AWS S3
- **Live site:** [https://ecommerce.chatram.in](https://ecommerce.chatram.in)
