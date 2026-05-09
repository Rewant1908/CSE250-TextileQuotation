// api.js — Axios instance for all KT IMPEX API calls
//
// Priority order for base URL:
//   1. VITE_API_URL env var (set this in production)
//   2. http://localhost:5000 (local dev fallback — works with Live Server, Vite, or any static server)
//
// NOTE: The Vite proxy (/api → localhost:5000) only works when running through
// `npm run dev`. When opening via Live Server or file://, we must use the full URL.

import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL + '/api'
    : 'http://localhost:5000/api'

const API = axios.create({
    baseURL: BASE,
    headers: { 'Content-Type': 'application/json' }
})

// ── Request interceptor: attach JWT ────────────────────────────────────────────
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('kt_impex_token')
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
})

// ── Response interceptor: handle 401 session expiry ────────────────────────────
// The login route itself is excluded — a wrong password also returns 401
// and should NOT trigger the session-expired flow.
API.interceptors.response.use(
    (response) => response,
    (error) => {
        const status   = error?.response?.status
        const url      = error?.config?.url || ''
        const isLogin  = url.includes('/login') || url.includes('/signup')

        if (status === 401 && !isLogin) {
            localStorage.removeItem('kt_impex_token')
            localStorage.removeItem('kt_impex_user')
            window.dispatchEvent(new CustomEvent('kt:session-expired'))
        }

        return Promise.reject(error)
    }
)

export default API
