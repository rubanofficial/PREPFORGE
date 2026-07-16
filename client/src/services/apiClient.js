import axios from 'axios'

// ── API Base URL Resolution ───────────────────────────────────────────────
// DEV:  VITE_API_URL is unset → falls back to '/api' → Vite proxy forwards to localhost:5000
// PROD: VITE_API_URL must be set in Vercel dashboard: https://prepforge-hvgs.onrender.com/api
//       OR rely on vercel.json rewrite rules to forward /api/* to Render (no env var needed).
const API_URL = import.meta.env.VITE_API_URL || '/api';

const isProduction = typeof window !== 'undefined' &&
    !window.location.hostname.includes('localhost') &&
    !window.location.hostname.includes('127.0.0.1');

if (isProduction) {
    console.log(`[PrepForge] API baseURL: ${API_URL}`);
    if (!import.meta.env.VITE_API_URL) {
        console.log(
            '[PrepForge] Using "/api" fallback — requests proxied through vercel.json rewrites to Render.'
        );
    }
} else {
    console.log('[PrepForge] API baseURL (dev):', API_URL, '— proxied by Vite to localhost:5000');
}

const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Add token to requests if available
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    console.log('API Request:', config.method.toUpperCase(), config.url);
    return config
}, (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
})

// Handle response errors
apiClient.interceptors.response.use(
    (response) => {
        console.log('API Response:', response.status, response.config.url, response.data);
        return response;
    },
    (error) => {
        console.error('API Error Response:', {
            status: error.response?.status,
            url: error.config?.url,
            data: error.response?.data,
            message: error.message
        });

        if (error.response?.status === 401) {
            // Don't redirect on login/register 401s — those are "wrong credentials" errors,
            // not "session expired" errors. Let the calling code handle the error message.
            const url = error.config?.url || ''
            const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/register')
            if (!isAuthRoute) {
                localStorage.removeItem('token')
                window.location.href = '/login'
            }
        }
        return Promise.reject(error)
    }
)

export default apiClient
