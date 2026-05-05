import type { UserRole } from '../types';

/** Maps legacy API roles to current DSS personas (backward compatible). */
const LEGACY_ROLE_MAP: Record<string, UserRole> = {
    SuperAdmin: 'APPCB_Regional',
    Admin: 'APPCB_Field',
    Officer: 'ULB_City',
    AE: 'ULB_Ward',
    JE: 'ULB_Ward',
};

export const ALL_ROLES: UserRole[] = [
    'APPCB_Regional',
    'APPCB_Field',
    'ULB_City',
    'ULB_Ward',
    'Public',
];

export function normalizeRole(role: string | undefined | null): UserRole {
    if (!role) return 'Public';
    if (ALL_ROLES.includes(role as UserRole)) return role as UserRole;
    return LEGACY_ROLE_MAP[role] ?? 'ULB_City';
}

export function roleDisplayName(role: UserRole): string {
    const labels: Record<UserRole, string> = {
        APPCB_Regional: 'APPCB — Regional',
        APPCB_Field: 'APPCB — Field',
        ULB_City: 'ULB — City',
        ULB_Ward: 'ULB — Ward',
        Public: 'Public',
    };
    return labels[role] ?? role;
}

export function permissionsForRole(role: UserRole): string[] {
    switch (role) {
        case 'Public':
            return ['view_map'];
        case 'APPCB_Regional':
            return [
                'view_map',
                'view_all',
                'manage_issues',
                'manage_triggers',
                'configure_sensors',
                'manage_sensors',
                'manage_users',
                'view_rules',
                'view_capacity',
            ];
        case 'APPCB_Field':
            return [
                'view_map',
                'view_all',
                'manage_issues',
                'manage_triggers',
                'configure_sensors',
                'manage_sensors',
                'view_rules',
                'view_capacity',
            ];
        case 'ULB_City':
            return [
                'view_map',
                'view_all',
                'manage_issues',
                'manage_triggers',
                'configure_sensors',
                'manage_sensors',
            ];
        case 'ULB_Ward':
            return ['view_map', 'manage_issues', 'manage_triggers'];
        default:
            return ['view_map'];
    }
}

export function isPublicRole(role: UserRole): boolean {
    return role === 'Public';
}

/** APPCB Regional: user administration + full regulatory DSS tabs */
export function canManageUsers(role: UserRole): boolean {
    return role === 'APPCB_Regional';
}

/** DSS tabs that show rule logic, simulations, capacity (regulatory) */
export function canViewRegulatoryDssTabs(role: UserRole): boolean {
    return role === 'APPCB_Regional' || role === 'APPCB_Field';
}

/** DSS “Sensor Health” tab — APPCB regulatory view + ULB city sensor administration */
export function canViewDssSensorHealthTab(role: UserRole): boolean {
    return canViewRegulatoryDssTabs(role) || role === 'ULB_City';
}

/** Sensor registry CRUD (manage sensors page) */
export function canManageSensorRegistry(role: UserRole): boolean {
    return role === 'APPCB_Regional' || role === 'APPCB_Field' || role === 'ULB_City';
}

/** Configurator health / any configurator route */
export function canAccessConfigurator(role: UserRole): boolean {
    return role !== 'Public';
}

export function canAccessOperationalDss(role: UserRole): boolean {
    return role !== 'Public';
}

export function canAccessIssues(role: UserRole): boolean {
    return role !== 'Public';
}

export function canAccessNotifications(role: UserRole): boolean {
    return role !== 'Public';
}

/** Ward-scoped ULB officers (former JE/AE behaviour) */
export function isWardScopedOfficer(role: UserRole): boolean {
    return role === 'ULB_Ward';
}

/** Sidebar / chip styling */
export function roleBadgeStyle(role: UserRole): { background: string; color: string } {
    switch (role) {
        case 'APPCB_Regional':
            return { background: 'rgba(239,68,68,0.15)', color: '#ef4444' };
        case 'APPCB_Field':
            return { background: 'rgba(249,115,22,0.15)', color: '#fb923c' };
        case 'ULB_City':
            return { background: 'rgba(59,130,246,0.15)', color: '#60a5fa' };
        case 'ULB_Ward':
            return { background: 'rgba(16,185,129,0.15)', color: '#10b981' };
        case 'Public':
        default:
            return { background: 'rgba(100,116,139,0.15)', color: '#94a3b8' };
    }
}
