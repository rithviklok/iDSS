import { useState, useEffect } from 'react';
import { AlertTriangle, Bell, Zap, Info } from 'lucide-react';
import { fetchNotifications } from '../services/api';
import type { AppNotification } from '../types';

function getNotifIcon(type: string) {
    switch (type) {
        case 'issue_new': return <AlertTriangle size={16} />;
        case 'issue_update': return <Zap size={16} />;
        case 'threshold_breach': return <Bell size={16} />;
        default: return <Info size={16} />;
    }
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor(diff / (1000 * 60));
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return 'Just now';
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);

    useEffect(() => {
        fetchNotifications().then(setNotifications);
    }, []);

    const markAsRead = (id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, isRead: true } : n)
        );
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="page-container">
            <div className="issues-header">
                <h1>Notifications</h1>
                <p className="subtitle">
                    {notifications.length} notifications • {unreadCount} unread
                </p>
            </div>

            {notifications.length === 0 ? (
                <div className="empty-state">
                    <div className="icon">🔔</div>
                    <h3>No notifications</h3>
                    <p>You're all caught up!</p>
                </div>
            ) : (
                notifications.map(notif => (
                    <div
                        key={notif.id}
                        className={`notification-card ${!notif.isRead ? 'unread' : ''}`}
                        onClick={() => markAsRead(notif.id)}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className={`notification-icon ${notif.type}`}>
                            {getNotifIcon(notif.type)}
                        </div>
                        <div className="notification-body" style={{ flex: 1 }}>
                            <h4>{notif.title}</h4>
                            <p>{notif.message}</p>
                            <div className="notification-time">{timeAgo(notif.createdAt)}</div>
                        </div>
                        {!notif.isRead && (
                            <div style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: 'var(--accent-primary)', flexShrink: 0, marginTop: '6px',
                            }} />
                        )}
                    </div>
                ))
            )}
        </div>
    );
}
