import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Map, AlertTriangle, Bell, User, LogOut, Menu, X, Shield, UserPlus, Sun, Moon, Users, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { useTheme } from '../../contexts/ThemeContext';
import { mockNotifications } from '../../data/mockIssueData';
import { fetchWardsByDistrict } from '../../services/api';
import { isDummyDataMode } from '../../services/dummyMode';
import { getDistrictById } from '../../data/geography';
import type { UserRole } from '../../types';

function pm25BadgeColor(v: number | null): { bg: string; text: string } {
    if (v === null) return { bg: 'rgba(100,116,139,0.25)', text: '#94a3b8' };
    if (v <= 30)   return { bg: 'rgba(0,176,80,0.25)',    text: '#00b050' };
    if (v <= 60)   return { bg: 'rgba(146,208,80,0.25)',  text: '#92d050' };
    if (v <= 90)   return { bg: 'rgba(255,255,0,0.2)',    text: '#d4b800' };
    if (v <= 120)  return { bg: 'rgba(255,153,0,0.25)',   text: '#ff9900' };
    if (v <= 250)  return { bg: 'rgba(255,0,0,0.25)',     text: '#ff4444' };
    return { bg: 'rgba(128,0,0,0.35)', text: '#ff6b6b' };
}

interface AppShellProps { children: React.ReactNode }

export default function AppShell({ children }: AppShellProps) {
    const navigate = useNavigate();
    const routerLocation = useRouterLocation();
    const { user, logout, isAdminOrSuper, createUser } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const {
        selectedDistrict, setDistrictById, selectedWard, setSelectedWard,
        allDistricts, allStates, isLoadingGeography,
        livePm25, liveSensorCount, isLoadingPm25,
    } = useLocation();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [cuUsername, setCuUsername] = useState('');
    const [cuPassword, setCuPassword] = useState('');
    const [cuRole, setCuRole] = useState<UserRole>('Officer');
    const [cuMsg, setCuMsg] = useState('');
    const [cuErr, setCuErr] = useState('');
    const [cuLoading, setCuLoading] = useState(false);

    const unreadNotifications = mockNotifications.filter(n => !n.isRead).length;
    const badgeColors = pm25BadgeColor(livePm25);
    const badgeLabel = isLoadingPm25 ? '…' : livePm25 !== null ? String(livePm25) : 'N/A';
    const badgeTooltip = isLoadingPm25
        ? 'Loading sensor data…'
        : liveSensorCount === 0
            ? 'No active sensors reporting'
            : `Avg of ${liveSensorCount} active sensor${liveSensorCount === 1 ? '' : 's'}${selectedWard != null ? ` in ward ${selectedWard}` : ''}`;
    const { data: wardsFromApi = [] } = useQuery({
        queryKey: ['wards', selectedDistrict.id],
        queryFn: () => fetchWardsByDistrict(selectedDistrict.id),
        enabled: !!selectedDistrict.id,
    });
    const staticWards = getDistrictById(selectedDistrict.id)?.wards ?? [];
    const allWardList = wardsFromApi.length > 0
        ? wardsFromApi
        : (selectedDistrict.wards?.length ?? 0) > 0
            ? selectedDistrict.wards
            : staticWards.length > 0
                ? staticWards
                : Array.from({ length: 50 }, (_, i) => ({
                    id: `${selectedDistrict.id}-w${i + 1}`,
                    name: `Ward ${i + 1}`,
                    number: i + 1,
                }));

    // JE/AE: filter ward list to only their assigned wards
    const isJeOrAe = user && ['JE', 'AE'].includes(user.role);
    const wardList = isJeOrAe && user?.wardIds && user.wardIds.length > 0
        ? allWardList.filter(w => user.wardIds!.includes(w.number))
        : allWardList;

    const wardLabel = selectedWard != null
        ? wardList.find(w => w.number === selectedWard)?.name ?? `Ward ${selectedWard}`
        : null;
    const districtsForState = allDistricts.filter(d => d.state === selectedDistrict.state);

    const navItems = [
        { path: '/', icon: <Map size={18} />, label: 'Map View', roles: ['SuperAdmin', 'Admin', 'Officer', 'AE', 'JE'] },
        { path: '/dss', icon: <Shield size={18} />, label: 'Triggers', roles: ['SuperAdmin', 'Admin', 'Officer', 'AE', 'JE'] },
        { path: '/issues', icon: <AlertTriangle size={18} />, label: 'Issues', roles: ['SuperAdmin', 'Admin', 'Officer', 'AE', 'JE'] },
        { path: '/notifications', icon: <Bell size={18} />, label: 'Notifications', badge: unreadNotifications || undefined, roles: ['SuperAdmin', 'Admin', 'Officer', 'AE', 'JE'] },
        ...(user?.role === 'AE' ? [{ path: '/dss', icon: <Users size={18} />, label: 'My Team', roles: ['AE'] }] : []),
        { path: '/configurator', icon: <Settings size={18} />, label: 'Configurator', roles: ['SuperAdmin', 'Admin', 'Officer', 'AE', 'JE'] },
    ];

    const visibleNav = navItems.filter(item => !user || item.roles.includes(user.role));

    const currentDate = new Date().toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short',
    });

    useEffect(() => {
        setDrawerOpen(false);
    }, [routerLocation.pathname]);

    const buildAppTargetPath = (path: string) => {
        const normalizedPath = path === '/' ? '' : path;
        const runtimeBase = window.location.pathname.startsWith('/dss') ? '/dss' : '';
        const envBaseRaw = import.meta.env.BASE_URL || '/';
        const envBase = envBaseRaw === '/' ? '' : envBaseRaw.replace(/\/$/, '');
        const base = runtimeBase || envBase;
        return `${base}${normalizedPath}` || '/';
    };

    const handleStateChange = (state: string) => {
        const firstDistrict = allDistricts.find(d => d.state === state);
        if (firstDistrict) setDistrictById(firstDistrict.id);
    };

    const forceDocumentNavigation = (path: string) => {
        const targetPath = buildAppTargetPath(path);

        if (window.location.pathname !== targetPath) {
            window.location.assign(targetPath);
            return true;
        }

        return false;
    };

    const handleNavClick = (path: string) => {
        setDrawerOpen(false);

        if (forceDocumentNavigation(path)) return;

        navigate(path);
    };

    const handleLogout = async () => {
        await logout();
        if (forceDocumentNavigation('/login')) return;
        navigate('/login');
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setCuMsg('');
        setCuErr('');
        setCuLoading(true);
        try {
            const msg = await createUser(cuUsername, cuPassword, cuRole);
            setCuMsg(msg);
            setCuUsername('');
            setCuPassword('');
            setCuRole('Officer');
        } catch (err) {
            setCuErr((err as Error).message);
        } finally {
            setCuLoading(false);
        }
    };

    return (
        <div className="app-layout">
            {isDummyDataMode() && (
                <div
                    style={{
                        padding: '8px 16px',
                        textAlign: 'center',
                        fontSize: 13,
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: 'var(--text-primary, #e2e8f0)',
                        borderBottom: '1px solid rgba(245, 158, 11, 0.35)',
                    }}
                >
                    Local dummy mode — no DSS backend. Data comes from bundled mocks.
                </div>
            )}
            {drawerOpen && <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />}

            <aside className={`sidebar sidebar-drawer ${drawerOpen ? 'open' : ''}`}>
                <div className="sidebar-brand">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h1>iDSS</h1>
                        <button className="drawer-close-btn" onClick={() => setDrawerOpen(false)}>
                            <X size={20} />
                        </button>
                    </div>
                    <p>Implementation Portal</p>
                </div>

                <nav className="sidebar-nav">
                    <div className="sidebar-section-title">Operations</div>
                    {visibleNav.map(item => (
                        <button
                            key={item.path + item.label}
                            className={`sidebar-link ${
                                item.path === '/configurator'
                                    ? routerLocation.pathname.startsWith('/configurator') ? 'active' : ''
                                    : routerLocation.pathname === item.path ? 'active' : ''
                            }`}
                            onClick={() => handleNavClick(item.path)}
                        >
                            {item.icon}
                            {item.label}
                            {item.badge && <span className="badge">{item.badge}</span>}
                        </button>
                    ))}

                    <div className="sidebar-section-title">Account</div>
                    <button
                        className={`sidebar-link ${routerLocation.pathname === '/profile' ? 'active' : ''}`}
                        onClick={() => handleNavClick('/profile')}
                    >
                        <User size={18} /> Profile
                    </button>

                    {isAdminOrSuper && (
                        <button
                            className="sidebar-link"
                            onClick={() => { setShowCreateUser(!showCreateUser); setDrawerOpen(false); }}
                        >
                            <UserPlus size={18} /> Create User
                        </button>
                    )}
                </nav>

                {user && (
                    <div className="sidebar-user">
                        <div className="sidebar-user-avatar">
                            {user.name.split(' ').map(w => w[0]).join('')}
                        </div>
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">{user.name}</div>
                            <div className="sidebar-user-role">{user.role}</div>
                        </div>
                        <button
                            className="sidebar-link"
                            style={{ width: 'auto', padding: '6px' }}
                            onClick={handleLogout}
                            title="Logout"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                )}
            </aside>

            <div className="main-content">
                <header className="top-header">
                    <div className="top-header-left">
                        <button className="hamburger-btn" onClick={() => setDrawerOpen(true)}>
                            <Menu size={22} />
                        </button>
                        <div className="top-header-location">
                            <h2>iDSS GOVERNANCE OS</h2>
                            <div className="live-indicator">
                                <span className="live-dot" />
                                Live System • {currentDate}
                            </div>
                        </div>
                    </div>

                    <div className="top-header-right">
                        <div className="header-filters">
                            <div className="header-filter-group">
                                <span className="header-filter-label">State</span>
                                <select
                                    className="header-filter-select"
                                    value={selectedDistrict.state}
                                    onChange={(e) => handleStateChange(e.target.value)}
                                    disabled={isLoadingGeography && allStates.length === 0}
                                >
                                    {isLoadingGeography && allStates.length === 0 ? (
                                        <option>Loading...</option>
                                    ) : (
                                        allStates.map(s => <option key={s} value={s}>{s}</option>)
                                    )}
                                </select>
                            </div>
                            <div className="header-filter-group">
                                <span className="header-filter-label">District</span>
                                <select
                                    className="header-filter-select"
                                    value={selectedDistrict.id}
                                    onChange={(e) => setDistrictById(e.target.value)}
                                    disabled={isLoadingGeography && districtsForState.length === 0}
                                >
                                    {isLoadingGeography && districtsForState.length === 0 ? (
                                        <option>Loading...</option>
                                    ) : (
                                        districtsForState.map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                                    )}
                                </select>
                            </div>
                            <div className="header-filter-group">
                                <span className="header-filter-label">Ward</span>
                                <select
                                    className="header-filter-select"
                                    value={selectedWard ?? 'all'}
                                    onChange={(e) => setSelectedWard(e.target.value === 'all' ? null : Number(e.target.value))}
                                >
                                    <option value="all">{isJeOrAe ? `All My Wards (${wardList.length})` : 'All Wards'}</option>
                                    {wardList.map(w => (
                                        <option key={w.id} value={w.number}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div
                            className="aqi-badge"
                            title={badgeTooltip}
                            style={{ background: badgeColors.bg, borderColor: badgeColors.text + '55', cursor: 'default' }}
                        >
                            <div>
                                <div className="label" style={{ color: badgeColors.text, opacity: 0.8 }}>
                                    PM2.5{wardLabel ? ` · ${wardLabel}` : ''}
                                </div>
                                <div className="value" style={{ color: badgeColors.text }}>
                                    {badgeLabel}
                                    {!isLoadingPm25 && liveSensorCount === 1 && (
                                        <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.7, marginLeft: 3 }}>1 sensor</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button
                            className={`dss-toggle-btn ${routerLocation.pathname === '/dss' ? 'active' : ''}`}
                            onClick={() => {
                                if (forceDocumentNavigation('/dss')) return;
                                navigate('/dss');
                            }}
                            title="Decision Support System"
                        >
                            <Shield size={18} />
                            <span>DSS</span>
                        </button>

                        {user && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '4px' }}>
                                <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</div>
                                    <span style={{
                                        display: 'inline-block', padding: '1px 8px', borderRadius: 10,
                                        fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
                                        background: user.role === 'SuperAdmin' || user.role === 'Admin' ? 'rgba(239,68,68,0.15)' : user.role === 'AE' ? 'rgba(99,102,241,0.15)' : user.role === 'JE' ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                                        color: user.role === 'SuperAdmin' || user.role === 'Admin' ? '#ef4444' : user.role === 'AE' ? '#818cf8' : user.role === 'JE' ? '#10b981' : '#94a3b8',
                                    }}>{user.role}</span>
                                </div>
                            </div>
                        )}

                        <button
                            className="theme-toggle-btn"
                            onClick={toggleTheme}
                            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                        >
                            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                        </button>

                        <button className="notification-btn" onClick={() => navigate('/notifications')}>
                            <Bell size={20} />
                            {unreadNotifications > 0 && <span className="dot" />}
                        </button>
                    </div>
                </header>

                {/* Create User Modal */}
                {showCreateUser && isAdminOrSuper && (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 1000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.6)',
                    }} onClick={() => setShowCreateUser(false)}>
                        <div
                            style={{
                                background: 'var(--bg-card, #1e293b)', borderRadius: '12px', padding: '24px',
                                width: '380px', maxWidth: '90vw',
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)' }}>
                                <UserPlus size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                                Create User
                            </h3>
                            <form onSubmit={handleCreateUser}>
                                <div className="form-group">
                                    <label style={{ color: 'var(--text-secondary)' }}>Username</label>
                                    <input
                                        type="text" required value={cuUsername}
                                        onChange={e => setCuUsername(e.target.value)}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color, #334155)', background: 'var(--bg-primary, #0f1729)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ color: 'var(--text-secondary)' }}>Password</label>
                                    <input
                                        type="password" required value={cuPassword}
                                        onChange={e => setCuPassword(e.target.value)}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color, #334155)', background: 'var(--bg-primary, #0f1729)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ color: 'var(--text-secondary)' }}>Role</label>
                                    <select
                                        value={cuRole} onChange={e => setCuRole(e.target.value as UserRole)}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color, #334155)', background: 'var(--bg-primary, #0f1729)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="Officer">Officer</option>
                                        <option value="JE">JE (Junior Engineer)</option>
                                        <option value="AE">AE (Assistant Engineer)</option>
                                        <option value="Admin">Admin</option>
                                        <option value="SuperAdmin">SuperAdmin</option>
                                    </select>
                                </div>
                                {cuErr && <p style={{ color: '#ef4444', fontSize: '12px' }}>{cuErr}</p>}
                                {cuMsg && <p style={{ color: '#10b981', fontSize: '12px' }}>{cuMsg}</p>}
                                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                    <button type="submit" className="btn btn-primary" disabled={cuLoading} style={{ flex: 1 }}>
                                        {cuLoading ? 'Creating...' : 'Create User'}
                                    </button>
                                    <button type="button" className="btn" onClick={() => setShowCreateUser(false)}
                                        style={{ flex: 1, background: 'var(--bg-secondary, #334155)', color: 'var(--text-primary)', border: 'none', borderRadius: '6px', padding: '8px', cursor: 'pointer' }}>
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {children}
            </div>
        </div>
    );
}
