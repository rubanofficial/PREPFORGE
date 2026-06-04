import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

console.log('API Client - API_URL:', API_URL);

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
