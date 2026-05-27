import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import authService from '../services/authService';
import { setUser, logout } from '../features/auth/authSlice';

const MainLayout = () => {
    const dispatch = useDispatch();
    const { token, user } = useSelector((state) => state.auth);

    useEffect(() => {
        let cancelled = false;

        const loadProfile = async () => {
            if (!token) return;

            try {
                const response = await authService.getProfile();
                const profile = response?.data || response?.user || response;

                if (!cancelled && profile) {
                    dispatch(setUser(profile));
                }
            } catch (error) {
                if (!cancelled && error?.response?.status === 401) {
                    dispatch(logout());
                }
            }
        };

        if (!user) {
            loadProfile();
        }

        return () => {
            cancelled = true;
        };
    }, [dispatch, token, user]);

    return (
        <div className="flex h-screen bg-background text-textMain overflow-hidden font-sans">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden relative">
                <Navbar />
                <main className="flex-1 overflow-y-auto p-6 md:p-8">
                    <div className="max-w-7xl mx-auto space-y-6">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
