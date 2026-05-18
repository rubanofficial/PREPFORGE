import { useSelector } from 'react-redux'

function DashboardPage() {
    // Get user from Redux store
    const { user } = useSelector(state => state.auth)

    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-8 text-white">
                <h1 className="text-4xl font-bold mb-2">Welcome, {user?.name || 'User'}! 👋</h1>
                <p className="text-blue-100 text-lg">You're logged in to PrepForge Pro</p>
            </div>

            {/* User Info Card */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Profile</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 font-semibold">Full Name</p>
                        <p className="text-lg text-gray-900 font-medium mt-1">{user?.name}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 font-semibold">Email Address</p>
                        <p className="text-lg text-gray-900 font-medium mt-1">{user?.email}</p>
                    </div>
                </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Feature 1 */}
                <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
                    <div className="text-4xl mb-4">📊</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Track Problems</h3>
                    <p className="text-gray-600 text-sm">Monitor your DSA problem-solving progress</p>
                </div>

                {/* Feature 2 */}
                <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
                    <div className="text-4xl mb-4">💡</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Get Insights</h3>
                    <p className="text-gray-600 text-sm">Analyze your weak topics and gaps</p>
                </div>

                {/* Feature 3 */}
                <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
                    <div className="text-4xl mb-4">🎯</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Smart Recommendations</h3>
                    <p className="text-gray-600 text-sm">Get personalized problem recommendations</p>
                </div>
            </div>

            {/* Getting Started Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Getting Started</h3>
                <ul className="space-y-2 text-gray-700">
                    <li className="flex items-center">
                        <span className="inline-block w-2 h-2 bg-blue-600 rounded-full mr-3"></span>
                        Complete your profile information
                    </li>
                    <li className="flex items-center">
                        <span className="inline-block w-2 h-2 bg-blue-600 rounded-full mr-3"></span>
                        Start tracking DSA problems (coming soon)
                    </li>
                    <li className="flex items-center">
                        <span className="inline-block w-2 h-2 bg-blue-600 rounded-full mr-3"></span>
                        View your analytics and progress (coming soon)
                    </li>
                    <li className="flex items-center">
                        <span className="inline-block w-2 h-2 bg-blue-600 rounded-full mr-3"></span>
                        Get personalized recommendations (coming soon)
                    </li>
                </ul>
            </div>
        </div>
    )
}

export default DashboardPage
