/* eslint-disable react-refresh/only-export-components -- context file exports hook + provider */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { UserProfile, UserRole } from '../types';
import { isDummyDataMode } from '../services/dummyMode';

const DSS_API_BASE = import.meta.env.VITE_DSS_API_BASE || 'http://localhost:3000';

const DUMMY_USER: UserProfile = {
    id: 'local-dummy-user',
    username: 'demo',
    email: 'demo@local.test',
    name: 'Demo Officer',
    role: 'SuperAdmin',
    districtId: 'uttar-pradesh-lucknow',
    permissions: ['view_all', 'manage_issues', 'manage_triggers', 'configure_sensors'],
};

interface AuthContextType {
    user: UserProfile | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<void>;
    signup: (username: string, password: string) => Promise<string>;
    createUser: (username: string, password: string, role: UserRole) => Promise<string>;
    logout: () => Promise<void>;
    hasRole: (...roles: UserRole[]) => boolean;
    canPerformAction: (action: string) => boolean;
    isAdminOrSuper: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(() =>
        isDummyDataMode() ? DUMMY_USER : null,
    );
    const [isLoading, setIsLoading] = useState(() => !isDummyDataMode());

    // Restore session on mount (with timeout to avoid stuck loading)
    useEffect(() => {
        if (isDummyDataMode()) return;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        fetch(`${DSS_API_BASE}/auth/profile`, { credentials: 'include', signal: controller.signal })
            .then(r => r.ok ? r.json() : Promise.reject())
            .then((profile: UserProfile) => setUser(profile))
            .catch(() => setUser(null))
            .finally(() => {
                clearTimeout(timeoutId);
                setIsLoading(false);
            });
    }, []);

    const login = useCallback(async (username: string, password: string) => {
        if (isDummyDataMode()) {
            void password;
            setUser({ ...DUMMY_USER, username: username || DUMMY_USER.username, name: username || DUMMY_USER.name });
            return;
        }
        const res = await fetch(`${DSS_API_BASE}/auth/login`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Login failed');
        setUser(data.user as UserProfile);
    }, []);

    const signup = useCallback(async (username: string, password: string): Promise<string> => {
        if (isDummyDataMode()) {
            void username;
            void password;
            return 'Dummy mode: use the pre-filled demo session (no backend).';
        }
        const res = await fetch(`${DSS_API_BASE}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Sign up failed');
        return data.message as string;
    }, []);

    const createUser = useCallback(async (username: string, password: string, role: UserRole): Promise<string> => {
        if (isDummyDataMode()) {
            void username;
            void password;
            void role;
            return 'Dummy mode: user creation is not persisted (no backend).';
        }
        const res = await fetch(`${DSS_API_BASE}/auth/create-user`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to create user');
        return data.message as string;
    }, []);

    const logout = useCallback(async () => {
        if (!isDummyDataMode()) {
            await fetch(`${DSS_API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
        }
        setUser(null);
    }, []);

    const hasRole = useCallback((...roles: UserRole[]) => {
        if (!user) return false;
        return roles.includes(user.role);
    }, [user]);

    const canPerformAction = useCallback((action: string) => {
        if (!user) return false;
        return user.permissions?.includes(action) ?? false;
    }, [user]);

    const isAdminOrSuper = !!user && (user.role === 'SuperAdmin' || user.role === 'Admin');

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isLoading,
            login,
            signup,
            createUser,
            logout,
            hasRole,
            canPerformAction,
            isAdminOrSuper,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
