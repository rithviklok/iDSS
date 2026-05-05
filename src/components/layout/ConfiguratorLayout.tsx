import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    Activity, Settings, Radio, Grid3X3, Zap, ShieldOff, FileText,
    BookOpen, GitBranch, UserCheck, Clock,
    Users, MapPin, RefreshCw, BellRing, Heart, ChevronLeft
} from 'lucide-react';

interface NavItem {
    path: string;
    icon: React.ReactNode;
    label: string;
}

interface NavSection {
    title: string;
    icon: React.ReactNode;
    items: NavItem[];
}

const sections: NavSection[] = [
    {
        title: 'SENSOR MANAGEMENT',
        icon: <Radio size={14} />,
        items: [
            { path: '/configurator', icon: <Activity size={16} />, label: 'Sensor Health Monitor' },
            { path: '/configurator/sensors', icon: <Settings size={16} />, label: 'Manage Sensors' },
        ],
    },
    {
        title: 'ALERT CONFIGURATION',
        icon: <Zap size={14} />,
        items: [
            { path: '/configurator/decision-matrix', icon: <Grid3X3 size={16} />, label: 'Decision Matrix' },
            { path: '/configurator/trigger-rules', icon: <Zap size={16} />, label: 'Alert Trigger Rules' },
            { path: '/configurator/suppression', icon: <ShieldOff size={16} />, label: 'Alert Suppression' },
            { path: '/configurator/audit-trail', icon: <FileText size={16} />, label: 'Alert Audit Trail' },
        ],
    },
    {
        title: 'INTERVENTION / SOP',
        icon: <BookOpen size={14} />,
        items: [
            { path: '/configurator/sop-library', icon: <BookOpen size={16} />, label: 'SOP Library' },
            { path: '/configurator/source-sop-mapping', icon: <GitBranch size={16} />, label: 'Source → SOP Mapping' },
            { path: '/configurator/authority-mapping', icon: <UserCheck size={16} />, label: 'Authority Mapping' },
            { path: '/configurator/sla-config', icon: <Clock size={16} />, label: 'SLA Configuration' },
        ],
    },
    {
        title: 'USER & ROLES',
        icon: <Users size={14} />,
        items: [
            { path: '/configurator/users', icon: <Users size={16} />, label: 'User List' },
            { path: '/configurator/zone-ward-assignment', icon: <MapPin size={16} />, label: 'Zone / Ward Assignment' },
            { path: '/configurator/delegation', icon: <RefreshCw size={16} />, label: 'Delegation / Backup' },
            { path: '/configurator/notification-prefs', icon: <BellRing size={16} />, label: 'Notification Prefs' },
        ],
    },
    {
        title: 'SYSTEM HEALTH',
        icon: <Heart size={14} />,
        items: [],
    },
];

export default function ConfiguratorLayout({ children }: { children: React.ReactNode }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { canManageSensorRegistry } = useAuth();

    const sectionsForUser = useMemo(
        () =>
            sections.map(section => ({
                ...section,
                items: section.items.filter(item => {
                    if (item.path === '/configurator/sensors') return canManageSensorRegistry;
                    return true;
                }),
            })),
        [canManageSensorRegistry],
    );

    const buildAppTargetPath = (path: string) => {
        const normalizedPath = path === '/' ? '' : path;
        const runtimeBase = window.location.pathname.startsWith('/dss') ? '/dss' : '';
        const envBaseRaw = import.meta.env.BASE_URL || '/';
        const envBase = envBaseRaw === '/' ? '' : envBaseRaw.replace(/\/$/, '');
        const base = runtimeBase || envBase;
        return `${base}${normalizedPath}` || '/';
    };

    const goTo = (path: string) => {
        const targetPath = buildAppTargetPath(path);
        if (window.location.pathname !== targetPath) {
            window.location.assign(targetPath);
            return;
        }

        navigate(path);
    };

    return (
        <div className="configurator-layout">
            <aside className="configurator-sidebar">
                <div className="configurator-sidebar-header">
                    <button className="configurator-back-btn" onClick={() => goTo('/')}>
                        <ChevronLeft size={16} />
                    </button>
                    <Settings size={18} />
                    <span>Configurator</span>
                </div>

                <nav className="configurator-nav">
                    {sectionsForUser.map((section) => (
                        <div key={section.title} className="configurator-nav-section">
                            <div className="configurator-nav-section-title">
                                {section.icon}
                                {section.title}
                            </div>
                            {section.items.map((item) => (
                                <button
                                    key={item.path}
                                    className={`configurator-nav-item ${location.pathname === item.path ? 'active' : ''}`}
                                    onClick={() => goTo(item.path)}
                                >
                                    {item.icon}
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    ))}
                </nav>
            </aside>

            <main className="configurator-main">
                {children}
            </main>
        </div>
    );
}
