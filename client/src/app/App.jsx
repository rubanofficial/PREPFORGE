import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import MainLayout from '../layouts/MainLayout';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import DashboardPage from '../pages/DashboardPage';
import SyncPage from '../pages/SyncPage';
import ProblemsPage from '../pages/ProblemsPage';
import AnalyticsPage from '../pages/AnalyticsPage';
import SettingsPage from '../pages/SettingsPage';
import ProtectedRoute from '../components/ProtectedRoute';
import { useSyncSocket } from '../hooks/useSyncSocket';

/**
 * SyncSocketProvider mounts inside <Provider> so it has Redux access.
 * It activates the socket listener for the entire authenticated session
 * without being tied to any single page/route.
 */
function SyncSocketProvider() {
    useSyncSocket();
    return null;
}

function App() {
    return (
        <Provider store={store}>
            {/* Mounts socket listener for the entire session — no page dependency */}
            <SyncSocketProvider />
            <Router>
                <Routes>
                    {/* Public Routes */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />

                    {/* Protected Dashboard Routes */}
                    <Route element={<ProtectedRoute />}>
                        <Route element={<MainLayout />}>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={<DashboardPage />} />
                            <Route path="/sync" element={<SyncPage />} />
                            <Route path="/problems" element={<ProblemsPage />} />
                            <Route path="/analytics" element={<AnalyticsPage />} />
                            <Route path="/settings" element={<SettingsPage />} />
                        </Route>
                    </Route>
                    
                    {/* Catch all */}
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </Router>
        </Provider>
    );
}

export default App;
