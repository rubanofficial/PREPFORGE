function HomePage() {
    return (
        <div className="text-center py-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Welcome to PrepForge Pro
            </h1>
            <p className="text-lg text-gray-600 mb-8">
                Your intelligent placement preparation platform
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-xl font-semibold mb-2">📊 Track Problems</h3>
                    <p className="text-gray-600">Monitor your DSA progress</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-xl font-semibold mb-2">💡 Get Insights</h3>
                    <p className="text-gray-600">Analyze weak topics</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-xl font-semibold mb-2">🎯 Smart Recommendations</h3>
                    <p className="text-gray-600">Personalized study plans</p>
                </div>
            </div>
        </div>
    )
}

export default HomePage
