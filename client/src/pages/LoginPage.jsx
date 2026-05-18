import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { authStart, authSuccess, authError } from '../features/auth/authSlice'
import authService from '../services/authService'

function LoginPage() {
    // Form state
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    })
    const [validationErrors, setValidationErrors] = useState({})

    // Navigation and Redux
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // Handle input change
    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
        // Clear validation error for this field
        if (validationErrors[name]) {
            setValidationErrors(prev => ({
                ...prev,
                [name]: ''
            }))
        }
    }

    // Validate form
    const validateForm = () => {
        const errors = {}

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!formData.email.trim()) {
            errors.email = 'Email is required'
        } else if (!emailRegex.test(formData.email)) {
            errors.email = 'Invalid email format'
        }

        // Password validation
        if (!formData.password) {
            errors.password = 'Password is required'
        }

        return errors
    }

    // Handle login submission
    const handleSubmit = async (e) => {
        e.preventDefault()

        // Validate form
        const errors = validateForm()
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors)
            return
        }

        try {
            setLoading(true)
            setError(null)
            dispatch(authStart())

            // Call login API
            const response = await authService.login({
                email: formData.email,
                password: formData.password,
            })

            // Success - update Redux and navigate to dashboard
            dispatch(authSuccess({
                user: response.user,
                token: response.token,
            }))

            navigate('/dashboard')
        } catch (err) {
            // Error handling
            const errorMessage = err.message || 'Login failed. Please try again.'
            setError(errorMessage)
            dispatch(authError(errorMessage))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
            <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Welcome Back</h1>
                    <p className="text-gray-600 mt-2">Login to PrepForge Pro</p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-700 text-sm">{error}</p>
                    </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Email Field */}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                            Email Address
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${validationErrors.email ? 'border-red-500' : 'border-gray-300'
                                }`}
                            placeholder="you@example.com"
                            disabled={loading}
                        />
                        {validationErrors.email && (
                            <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>
                        )}
                    </div>

                    {/* Password Field */}
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${validationErrors.password ? 'border-red-500' : 'border-gray-300'
                                }`}
                            placeholder="••••••"
                            disabled={loading}
                        />
                        {validationErrors.password && (
                            <p className="text-red-500 text-xs mt-1">{validationErrors.password}</p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>

                {/* Register Link */}
                <p className="text-center text-gray-600 mt-6">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-blue-600 hover:text-blue-700 font-semibold">
                        Register here
                    </Link>
                </p>
            </div>
        </div>
    )
}

export default LoginPage
