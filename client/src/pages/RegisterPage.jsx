import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Code2, ArrowRight } from 'lucide-react';
import authService from '../services/authService';

const RegisterPage = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const body = { name, email, username, password, passwordConfirm };
            console.log('Starting registration with:', { ...body, password: '***', passwordConfirm: '***' });
            const res = await authService.register(body);
            console.log('Registration successful:', res);

            if (res && res.success) {
                navigate('/login');
            } else {
                const errorMsg = res?.message || 'Registration failed';
                console.warn('Registration returned non-success:', errorMsg);
                setError(errorMsg);
            }
        } catch (err) {
            console.error('Registration error caught:', err);
            const errorMsg = err?.message || err?.error || JSON.stringify(err) || 'Registration failed';
            console.error('Setting error message:', errorMsg);
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center text-primary mb-4">
                    <Code2 size={40} />
                </div>
                <h2 className="text-center text-3xl font-extrabold text-textMain tracking-tight">
                    Create an account
                </h2>
                <p className="mt-2 text-center text-sm text-textMuted">
                    Join PrepForge <span className="text-primary font-mono">PRO</span>
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-surface py-8 px-4 shadow-xl border border-border sm:rounded-lg sm:px-10">
                    <form className="space-y-6" onSubmit={handleRegister}>
                        {error && <div className="text-sm text-red-600">{error}</div>}

                        <div>
                            <label className="block text-sm font-medium text-textMuted mb-1">Full name</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-background border border-border rounded-md px-4 py-2 text-sm text-textMain focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-textMuted mb-1">Username</label>
                            <input
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-background border border-border rounded-md px-4 py-2 text-sm text-textMain focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-textMuted mb-1">Email address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-background border border-border rounded-md px-4 py-2 text-sm text-textMain focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-textMuted mb-1">Password</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-background border border-border rounded-md px-4 py-2 text-sm text-textMain focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-textMuted mb-1">Confirm password</label>
                            <input
                                type="password"
                                required
                                value={passwordConfirm}
                                onChange={(e) => setPasswordConfirm(e.target.value)}
                                className="w-full bg-background border border-border rounded-md px-4 py-2 text-sm text-textMain focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primaryHover transition-colors focus:outline-none disabled:opacity-60"
                            >
                                {loading ? 'Registering...' : 'Register'} <ArrowRight size={16} />
                            </button>
                        </div>
                    </form>

                    <div className="mt-6 text-center text-sm text-textMuted">
                        Already have an account? <Link to="/login" className="text-primary hover:text-primaryHover font-medium transition-colors">Sign in</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
