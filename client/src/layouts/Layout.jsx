import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '../features/auth/authSlice'

function Layout() {
    // Get auth state from Redux
    const { isAuthenticated, user } = useSelector(state => state.auth)
    const dispatch = useDispatch()
    const navigate = useNavigate()

    // Handle logout
    const handleLogout = () => {
        dispatch(logout())
        navigate('/')
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navbar */}
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo/Brand */}
                        <Link to="/" className="flex-shrink-0">
                            <h1 className="text-2xl font-bold text-blue-600 hover:text-blue-700">
                                PrepForge Pro
                            </h1>
                        </Link>

                        {/* Navigation Links */}
                        <div className="flex items-center space-x-4">
                            {/* If user is NOT authenticated */}
                            {!isAuthenticated ? (
                                <>
                                    <Link
                                        to="/"
                                        className="text-gray-700 hover:text-blue-600 font-medium transition"
                                    >
                                        Home
                                    </Link>
                                    <Link
                                        to="/login"
                                        className="text-gray-700 hover:text-blue-600 font-medium transition"
                                    >
                                        Login
                                    </Link>
                                    <Link
                                        to="/register"
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
                                    >
                                        Register
                                    </Link>
                                </>
                            ) : (
                                // If user IS authenticated
                                <>
                                    <Link
                                        to="/dashboard"
                                        className="text-gray-700 hover:text-blue-600 font-medium transition"
                                    >
                                        Dashboard
                                    </Link>
                                    <div className="flex items-center space-x-4">
                                        <span className="text-gray-700 font-medium">
                                            {user?.name}
                                        </span>
                                        <button
                                            onClick={handleLogout}
                                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition"
                                        >
                                            Logout
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Outlet />
            </main>
        </div>
    )
}

export default Layout
