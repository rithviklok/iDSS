import React, { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

type AuthMode = 'signin' | 'signup';

export default function LoginPage() {
    const { login, signup } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [mode, setMode] = useState<AuthMode>('signin');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const resetForm = () => {
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setError('');
        setSuccess('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (mode === 'signup' && password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            if (mode === 'signin') {
                await login(username, password);
            } else {
                const msg = await signup(username, password);
                setSuccess(msg);
                resetForm();
                setMode('signin');
            }
        } catch (err) {
            setError((err as Error).message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    const toggleMode = () => {
        setMode(m => m === 'signin' ? 'signup' : 'signin');
        setError('');
        setSuccess('');
    };

    return (
        <div className="login-page">
            <button
                className="theme-toggle-btn theme-toggle-login"
                onClick={toggleTheme}
                title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <div className="login-card">
                <h1>iDSS</h1>
                <p className="subtitle">
                    {mode === 'signin' ? 'SIGN IN TO YOUR ACCOUNT' : 'CREATE AN ACCOUNT'}
                </p>

                {success && (
                    <p style={{ color: '#10b981', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{success}</p>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username"
                            required
                            autoComplete="username"
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            required
                            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                        />
                    </div>

                    {mode === 'signup' && (
                        <div className="form-group">
                            <label>Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm password"
                                required
                                autoComplete="new-password"
                            />
                        </div>
                    )}

                    {error && (
                        <p style={{ color: 'var(--accent-danger, #ef4444)', fontSize: '12px', marginBottom: '12px' }}>{error}</p>
                    )}

                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading
                            ? (mode === 'signin' ? 'Signing in...' : 'Creating account...')
                            : (mode === 'signin' ? 'Sign In' : 'Sign Up')
                        }
                    </button>
                </form>

                <div className="demo-hint" style={{ cursor: 'pointer' }} onClick={toggleMode}>
                    {mode === 'signin' ? (
                        <>Don't have an account? <strong>Sign Up</strong></>
                    ) : (
                        <>Already have an account? <strong>Sign In</strong></>
                    )}
                </div>

                {mode === 'signin' && (
                    <div className="demo-hint" style={{ marginTop: '8px', opacity: 0.7, fontSize: '11px' }}>
                        <strong>Default Accounts:</strong><br />
                        superAdmin / superAdmin123# &nbsp;|&nbsp; admin / admin123# &nbsp;|&nbsp; officer / officer123#<br />
                        ae.priya / ae123# &nbsp;|&nbsp; je.ramesh / je123#
                    </div>
                )}
            </div>
        </div>
    );
}
