import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { roleDisplayName } from '../auth/rbac';

export default function ProfilePage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    if (!user) {
        return (
            <div className="page-container">
                <p style={{ color: 'var(--text-muted)' }}>Not logged in.</p>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="issues-header">
                <h1>Profile</h1>
                <p className="subtitle">Manage your account settings</p>
            </div>

            <div className="profile-card">
                <div className="profile-avatar">
                    {user.name.split(' ').map(w => w[0]).join('')}
                </div>

                <div className="profile-field">
                    <div className="label">Username</div>
                    <div className="value">{user.username}</div>
                </div>

                <div className="profile-field">
                    <div className="label">Full Name</div>
                    <div className="value">{user.name}</div>
                </div>

                <div className="profile-field">
                    <div className="label">Email</div>
                    <div className="value">{user.email || '—'}</div>
                </div>

                <div className="profile-field">
                    <div className="label">Role</div>
                    <div className="value">
                        <span className="role-badge">{roleDisplayName(user.role)}</span>
                    </div>
                </div>

                <div className="profile-field">
                    <div className="label">Assigned District</div>
                    <div className="value" style={{ textTransform: 'capitalize' }}>{user.districtId}</div>
                </div>

                <div className="profile-field">
                    <div className="label">User ID</div>
                    <div className="value" style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {user.id}
                    </div>
                </div>

                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                    <button className="btn btn-danger btn-sm" onClick={handleLogout}>
                        <LogOut size={14} style={{ marginRight: '6px', display: 'inline' }} />
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}
