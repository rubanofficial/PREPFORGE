import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Code2, ArrowRight } from 'lucide-react';

const RegisterPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleRegister = (e) => {
        e.preventDefault();
        // Mock register then redirect to login
        setTimeout(() => {
            navigate('/login');
        }, 500);
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
                            <button 
                                type="submit" 
                                className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primaryHover transition-colors focus:outline-none"
                            >
                                Register <ArrowRight size={16} />
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
