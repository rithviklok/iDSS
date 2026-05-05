/* eslint-disable react-refresh/only-export-components -- context file exports hook + provider */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { UserProfile, UserRole } from '../types';
import { isDummyDataMode } from '../services/dummyMode';
import {
    normalizeRole,
    permissionsForRole,
    roleDisplayName,
    canManageUsers as rbacCanManageUsers,
    canViewRegulatoryDssTabs,
    canManageSensorRegistry,
    isPublicRole,
    isWardScopedOfficer,
} from '../auth/rbac';

const DSS_API_BASE = import.meta.env.VITE_DSS_API_BASE || 'http://localhost:3000';

function buildDummyUser(username: string, role: UserRole): UserProfile {
    const wardScoped = role === 'ULB_Ward';
    const baseName = username.trim() || roleDisplayName(role);
    return {
        id: `dummy-${username}-${role}`,
        username: username.trim() || 'user',
        email: `${username.trim() || 'user'}@demo.local`,
        name: baseName,
        role,
        districtId: 'uttar-pradesh-lucknow',
        permissions: permissionsForRole(role),
        wardIds: wardScoped ? [18, 45] : undefined,
        supervisorId: null,
    };
}

function normalizeProfile(raw: UserProfile): UserProfile {
    const role = normalizeRole(raw.role as string);
    return {
        ...raw,
        role,
        permissions: raw.permissions?.length ? raw.permissions : permissionsForRole(role),
    };
}

interface AuthContextType {
    user: UserProfile | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (username: string, password: string, demoRole?: UserRole) => Promise<void>;
    signup: (username: string, password: string) => Promise<string>;
    createUser: (username: string, password: string, role: UserRole) => Promise<string>;
    logout: () => Promise<void>;
    hasRole: (...roles: UserRole[]) => boolean;
    canPerformAction: (action: string) => boolean;
    /** @deprecated use canViewRegulatoryDss — kept for gradual migration */
    isAdminOrSuper: boolean;
    canManageUsers: boolean;
    canViewRegulatoryDss: boolean;
    canManageSensorRegistry: boolean;
    isPublicUser: boolean;
    isWardScopedOfficer: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(() =>
        isDummyDataMode() ? buildDummyUser('demo', 'APPCB_Regional') : null,
    );
    const [isLoading, setIsLoading] = useState(() => !isDummyDataMode());

    useEffect(() => {
        if (isDummyDataMode()) return;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        fetch(`${DSS_API_BASE}/auth/profile`, { credentials: 'include', signal: controller.signal })
            .then(r => r.ok ? r.json() : Promise.reject())
            .then((profile: UserProfile) => setUser(normalizeProfile(profile)))
            .catch(() => setUser(null))
            .finally(() => {
                clearTimeout(timeoutId);
                setIsLoading(false);
            });
    }, []);

    const login = useCallback(async (username: string, password: string, demoRole?: UserRole) => {
        if (isDummyDataMode()) {
            void password;
            const role = demoRole ?? 'APPCB_Regional';
            setUser(buildDummyUser(username.trim() || 'user', role));
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
        setUser(normalizeProfile(data.user as UserProfile));
    }, []);

    const signup = useCallback(async (username: string, password: string): Promise<string> => {
        if (isDummyDataMode()) {
            void username;
            void password;
            return 'Dummy mode: use the demo persona selector (no backend).';
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

    const role = user?.role;
    const canManageUsersFlag = !!role && rbacCanManageUsers(role);
    const canViewRegulatoryDssFlag = !!role && canViewRegulatoryDssTabs(role);
    const canManageSensorRegistryFlag = !!role && canManageSensorRegistry(role);
    const isPublicUserFlag = !!role && isPublicRole(role);
    const isWardScopedFlag = !!role && isWardScopedOfficer(role);

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
            isAdminOrSuper: canViewRegulatoryDssFlag,
            canManageUsers: canManageUsersFlag,
            canViewRegulatoryDss: canViewRegulatoryDssFlag,
            canManageSensorRegistry: canManageSensorRegistryFlag,
            isPublicUser: isPublicUserFlag,
            isWardScopedOfficer: isWardScopedFlag,
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
