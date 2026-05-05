import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Radio, Activity, AlertTriangle, WifiOff, Search } from 'lucide-react';
import { fetchSensorHealth } from '../services/configuratorApi';
import type { HealthSensor } from '../services/configuratorApi';
import { useLocation } from '../contexts/LocationContext';

function timeAgo(dateStr: string | null): string {
    if (!dateStr) return 'N/A';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, { bg: string; text: string; dot: string }> = {
        Active: { bg: 'rgba(16,185,129,0.12)', text: '#10b981', dot: '#10b981' },
        Anomalous: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', dot: '#f59e0b' },
        Offline: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', dot: '#ef4444' },
    };
    const c = colors[status] || colors.Active;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, background: c.bg, color: c.text, fontSize: '0.78rem', fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot }} />
            {status}
        </span>
    );
}

function UptimeBar({ pct }: { pct: number }) {
    const color = pct >= 90 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(100,116,139,0.15)', overflow: 'hidden', minWidth: 60 }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: color, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color, minWidth: 40, textAlign: 'right' }}>{pct}%</span>
        </div>
    );
}

function NetworkBadge({ network }: { network: string }) {
    const colors: Record<string, { bg: string; text: string }> = {
        CAAQMS: { bg: 'rgba(99,102,241,0.12)', text: '#6366f1' },
        'Low-cost PM2.5': { bg: 'rgba(16,185,129,0.12)', text: '#10b981' },
        AWS: { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6' },
    };
    const c = colors[network] || { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8' };
    return (
        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: c.bg, color: c.text, fontSize: '0.72rem', fontWeight: 600 }}>
            {network}
        </span>
    );
}

export default function SensorHealthMonitor() {
    const { selectedDistrict } = useLocation();
    const [networkFilter, setNetworkFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [zoneFilter, setZoneFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['sensor-health', selectedDistrict.id, networkFilter, statusFilter, zoneFilter, searchQuery],
        queryFn: () =>
            fetchSensorHealth({
                districtId: selectedDistrict.id,
                network: networkFilter || undefined,
                status: statusFilter || undefined,
                zone: zoneFilter || undefined,
                search: searchQuery || undefined,
            }),
        refetchInterval: 60000,
    });

    const summary = data?.summary || { total: 0, active: 0, anomalous: 0, offline: 0 };
    const sensors: HealthSensor[] = data?.sensors || [];

    const zones = [...new Set(sensors.map((s) => s.zone).filter(Boolean))] as string[];

    return (
        <div className="cfg-page">
            <div className="cfg-page-header">
                <div>
                    <h1 className="cfg-page-title">Sensor Health Monitor</h1>
                    <p className="cfg-page-subtitle">Real-time overview of all deployed sensors</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="cfg-summary-cards">
                <div className="cfg-summary-card">
                    <div className="cfg-summary-icon" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
                        <Radio size={22} />
                    </div>
                    <div className="cfg-summary-value">{summary.total}</div>
                    <div className="cfg-summary-label">TOTAL SENSORS</div>
                </div>
                <div className="cfg-summary-card">
                    <div className="cfg-summary-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                        <Activity size={22} />
                    </div>
                    <div className="cfg-summary-value">{summary.active}</div>
                    <div className="cfg-summary-label">ACTIVE</div>
                </div>
                <div className="cfg-summary-card">
                    <div className="cfg-summary-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                        <AlertTriangle size={22} />
                    </div>
                    <div className="cfg-summary-value">{summary.anomalous}</div>
                    <div className="cfg-summary-label">ANOMALOUS</div>
                </div>
                <div className="cfg-summary-card">
                    <div className="cfg-summary-icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                        <WifiOff size={22} />
                    </div>
                    <div className="cfg-summary-value">{summary.offline}</div>
                    <div className="cfg-summary-label">OFFLINE / INACTIVE</div>
                </div>
            </div>

            {/* Filters */}
            <div className="cfg-filters">
                <select className="cfg-filter-select" value={networkFilter} onChange={(e) => setNetworkFilter(e.target.value)}>
                    <option value="">All Networks</option>
                    <option value="CAAQMS">CAAQMS</option>
                    <option value="Low-cost PM2.5">Low-cost PM2.5</option>
                    <option value="AWS">AWS</option>
                </select>
                <select className="cfg-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">All Status</option>
                    <option value="Active">Active</option>
                    <option value="Anomalous">Anomalous</option>
                    <option value="Offline">Offline</option>
                </select>
                <select className="cfg-filter-select" value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}>
                    <option value="">All Zones</option>
                    {zones.map((z) => (
                        <option key={z} value={z}>{z}</option>
                    ))}
                </select>
                <div className="cfg-search-box">
                    <Search size={14} />
                    <input
                        type="text"
                        placeholder="Search sensors..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="cfg-table-wrap">
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
                ) : (
                    <table className="cfg-table">
                        <thead>
                            <tr>
                                <th>SENSOR ID</th>
                                <th>NAME</th>
                                <th>NETWORK</th>
                                <th>STATE / DIST</th>
                                <th>ZONE / WARD</th>
                                <th>STATUS</th>
                                <th>UPTIME %</th>
                                <th>LAST DATA</th>
                                <th>COMPLETENESS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sensors.map((s, idx) => (
                                <tr key={s.id}>
                                    <td className="cfg-cell-id">SEN-{String(idx + 1).padStart(3, '0')}</td>
                                    <td className="cfg-cell-name">{s.name}</td>
                                    <td><NetworkBadge network={s.network} /></td>
                                    <td>{s.state} / {s.district}</td>
                                    <td>{s.zone || 'N/A'} / {s.ward || 'N/A'}</td>
                                    <td>
                                        <StatusBadge status={s.status} />
                                        {s.status === 'Anomalous' && s.failedChecks?.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                                                {s.failedChecks.map((check) => (
                                                    <span key={check} style={{
                                                        fontSize: '0.68rem',
                                                        fontWeight: 600,
                                                        padding: '1px 5px',
                                                        borderRadius: '4px',
                                                        background: 'rgba(245,158,11,0.15)',
                                                        color: '#b45309',
                                                        border: '1px solid rgba(245,158,11,0.35)',
                                                        whiteSpace: 'nowrap',
                                                    }}>{check}</span>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ minWidth: 120 }}><UptimeBar pct={s.uptimePct} /></td>
                                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{timeAgo(s.lastDataAt)}</td>
                                    <td style={{ fontSize: '0.85rem', fontWeight: 600, color: s.completenessPct >= 90 ? '#10b981' : s.completenessPct >= 70 ? '#f59e0b' : '#ef4444' }}>
                                        {s.completenessPct}%
                                    </td>
                                </tr>
                            ))}
                            {sensors.length === 0 && (
                                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No sensors found</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
