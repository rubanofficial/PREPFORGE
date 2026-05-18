import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

// Protected Route Component
// Wraps routes that require authentication
function ProtectedRoute({ children }) {
    // Get auth state from Redux
    const { isAuthenticated, loading } = useSelector(state => state.auth)

    // Show loading state while checking authentication
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
                    <p className="text-gray-600 mt-4">Loading...</p>
                </div>
            </div>
        )
    }

    // If not authenticated, redirect to login
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    // If authenticated, show the component
    return children
}

export default ProtectedRoute
