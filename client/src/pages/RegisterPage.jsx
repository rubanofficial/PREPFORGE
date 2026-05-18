import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { authStart, authSuccess, authError } from '../features/auth/authSlice'
import authService from '../services/authService'

function RegisterPage() {
    // Form state
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
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

        // Name validation
        if (!formData.name.trim()) {
            errors.name = 'Name is required'
        } else if (formData.name.trim().length < 2) {
            errors.name = 'Name must be at least 2 characters'
        }

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
        } else if (formData.password.length < 6) {
            errors.password = 'Password must be at least 6 characters'
        }

        // Confirm password validation
        if (!formData.confirmPassword) {
            errors.confirmPassword = 'Please confirm password'
        } else if (formData.password !== formData.confirmPassword) {
            errors.confirmPassword = 'Passwords do not match'
        }

        return errors
    }

    // Handle registration submission
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

            // Call register API
            const response = await authService.register({
                name: formData.name,
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
            const errorMessage = err.message || 'Registration failed. Please try again.'
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
                    <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
                    <p className="text-gray-600 mt-2">Join PrepForge Pro today</p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-700 text-sm">{error}</p>
                    </div>
                )}

                {/* Registration Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Name Field */}
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                            Full Name
                        </label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${validationErrors.name ? 'border-red-500' : 'border-gray-300'
                                }`}
                            placeholder="John Doe"
                            disabled={loading}
                        />
                        {validationErrors.name && (
                            <p className="text-red-500 text-xs mt-1">{validationErrors.name}</p>
                        )}
                    </div>

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

                    {/* Confirm Password Field */}
                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${validationErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                                }`}
                            placeholder="••••••"
                            disabled={loading}
                        />
                        {validationErrors.confirmPassword && (
                            <p className="text-red-500 text-xs mt-1">{validationErrors.confirmPassword}</p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                    >
                        {loading ? 'Creating Account...' : 'Register'}
                    </button>
                </form>

                {/* Login Link */}
                <p className="text-center text-gray-600 mt-6">
                    Already have an account?{' '}
                    <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
                        Login here
                    </Link>
                </p>
            </div>
        </div>
    )
}

export default RegisterPage
