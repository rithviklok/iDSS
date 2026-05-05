import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, MapPin, TrendingUp, Wind, Radio, Clock, Navigation, FileText, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchIssueById, updateIssueStatus, fetchIssueSops } from '../services/api';
import type { LinkedSop } from '../services/api';
import { getIssueIcon, getIssueTypeLabel } from '../data/mockIssueData';
import { useAuth } from '../contexts/AuthContext';

function MiniMap({ lat, lng }: { lat: number; lng: number }) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);

    useEffect(() => {
        if (!mapRef.current) return;
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
        }
        const map = L.map(mapRef.current, {
            center: [lat, lng],
            zoom: 14,
            zoomControl: true,
            attributionControl: true,
            dragging: true,
            scrollWheelZoom: true,
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org">OpenStreetMap</a>',
        }).addTo(map);
        const icon = L.divIcon({
            className: '',
            html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 24 30">
                <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 18 12 18s12-9 12-18C24 5.4 18.6 0 12 0z" fill="#ef4444"/>
                <circle cx="12" cy="11" r="4.5" fill="white"/>
            </svg>`,
            iconSize: [32, 40],
            iconAnchor: [16, 40],
        });
        L.marker([lat, lng], { icon }).addTo(map);
        mapInstanceRef.current = map;

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, [lat, lng]);

    return <div ref={mapRef} style={{ width: '100%', height: '280px', borderRadius: '12px', overflow: 'hidden' }} />;
}

function getSeverityLabel(severity: string): string {
    return severity === 'high' ? 'High Priority' : severity === 'medium' ? 'Medium Priority' : 'Low Priority';
}

function getAQICategory(pm25: number): string {
    if (pm25 <= 30) return 'Good';
    if (pm25 <= 60) return 'Satisfactory';
    if (pm25 <= 90) return 'Moderate';
    if (pm25 <= 120) return 'Poor';
    if (pm25 <= 250) return 'Very Poor';
    return 'Severe';
}

export default function IssueDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { canPerformAction } = useAuth();
    const [actionError, setActionError] = useState<string | null>(null);

    const { data: issue } = useQuery({
        queryKey: ['issue', id],
        queryFn: () => fetchIssueById(id!),
        enabled: !!id,
    });

    const { data: linkedSops } = useQuery({
        queryKey: ['issue-sops', id],
        queryFn: () => fetchIssueSops(id!),
        enabled: !!id,
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ status }: { status: 'active' | 'done' | 'escalated' | 'rejected' }) =>
            updateIssueStatus(issue!.id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['issues'] });
            queryClient.invalidateQueries({ queryKey: ['issue', id] });
            navigate('/issues');
        },
        onError: (err) => {
            setActionError((err as Error).message || 'Failed to update status. Please try again.');
        },
    });

    const handleStatusChange = (status: 'active' | 'done' | 'escalated' | 'rejected') => {
        setActionError(null);
        if (issue) updateStatusMutation.mutate({ status });
    };

    if (!issue) {
        return (
            <div className="page-container">
                <div style={{ textAlign: 'center', padding: '60px' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-muted)' }}>Loading issue...</p>
                </div>
            </div>
        );
    }

    const reportedDate = new Date(issue.createdAt).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
    });

    const coordStr = `${issue.location.lat.toFixed(4)}°N, ${issue.location.lng.toFixed(4)}°E`;

    return (
        <div className="page-container" style={{ overflow: 'auto' }}>
            <div className="issue-detail-v2">
                {/* Top Bar */}
                <div className="idv2-topbar">
                    <div className="idv2-topbar-left">
                        <button className="idv2-back-btn" onClick={() => navigate(-1)}>
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <div className="idv2-issue-id">{issue.id}</div>
                            <div className="idv2-issue-type">{getIssueIcon(issue.type)} {getIssueTypeLabel(issue.type)}</div>
                        </div>
                    </div>
                    <div className="idv2-topbar-right">
                        <span className={`status-badge ${issue.status}`}>
                            {issue.status === 'done' ? 'Completed' : issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
                        </span>
                        <button className="idv2-share-btn"><Share2 size={16} /></button>
                    </div>
                </div>

                {/* Content */}
                <div className="idv2-content">
                    {/* Priority & Category */}
                    <div className="idv2-badges">
                        <span className={`idv2-priority-badge ${issue.severity}`}>
                            <AlertTriangle size={12} />
                            {getSeverityLabel(issue.severity)}
                        </span>
                        <span className="idv2-category-badge">{getAQICategory(issue.pm25)}</span>
                    </div>

                    {/* Title & Description */}
                    <h2 className="idv2-title">{issue.title}</h2>
                    <p className="idv2-description">
                        PM2.5 {issue.pm25} µg/m³ exceeds threshold ({getAQICategory(issue.pm25)}).
                    </p>

                    {/* Pollution Sources Breakdown */}
                    {issue.sourceContributors && issue.sourceContributors.length > 0 && (
                        <div className="idv2-sources-section">
                            <div className="idv2-sources-title">Pollution Sources</div>
                            <div className="idv2-sources-list">
                                {issue.sourceContributors
                                    .slice()
                                    .sort((a, b) => b.percentage - a.percentage)
                                    .map((sc, idx) => (
                                        <div key={sc.source} className="idv2-source-row">
                                            <div className="idv2-source-rank">#{idx + 1}</div>
                                            <div className="idv2-source-info">
                                                <span className="idv2-source-name">
                                                    {sc.source.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                                </span>
                                            </div>
                                            <div className="idv2-source-bar-wrap">
                                                <div
                                                    className="idv2-source-bar"
                                                    style={{ width: `${Math.round(sc.percentage)}%` }}
                                                />
                                            </div>
                                            <div className="idv2-source-pct">{Math.round(sc.percentage)}%</div>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    )}

                    {/* Info Cards Grid */}
                    <div className="idv2-info-grid">
                        <div className="idv2-info-card">
                            <MapPin size={16} className="idv2-info-icon blue" />
                            <div className="idv2-info-label">Zone / Ward</div>
                            <div className="idv2-info-value">
                                {issue.zoneName || `Zone ${issue.zone}`}
                                {issue.wardNames && issue.wardNames.length > 0
                                    ? ` • ${issue.wardNames.slice(0, 3).join(', ')}${issue.wardNames.length > 3 ? ` +${issue.wardNames.length - 3}` : ''}`
                                    : ` • Ward ${issue.ward}`}
                            </div>
                        </div>
                        <div className="idv2-info-card">
                            <TrendingUp size={16} className="idv2-info-icon red" />
                            <div className="idv2-info-label">PM2.5 Spike</div>
                            <div className="idv2-info-value">{issue.pm25} µg/m³</div>
                        </div>
                        <div className="idv2-info-card">
                            <Wind size={16} className="idv2-info-icon teal" />
                            <div className="idv2-info-label">Wind</div>
                            <div className="idv2-info-value">{issue.wind || 'N/A'}</div>
                        </div>
                        <div className="idv2-info-card">
                            <Radio size={16} className="idv2-info-icon orange" />
                            <div className="idv2-info-label">Detected By</div>
                            <div className="idv2-info-value">{issue.detectedBy || 'Monitoring Network'}</div>
                        </div>
                        <div className="idv2-info-card">
                            <Clock size={16} className="idv2-info-icon purple" />
                            <div className="idv2-info-label">Reported</div>
                            <div className="idv2-info-value">{reportedDate}</div>
                        </div>
                    </div>

                    {/* Coordinates */}
                    <div className="idv2-coordinates">
                        <div>
                            <div className="idv2-coord-label">Coordinates</div>
                            <div className="idv2-coord-value">{coordStr}</div>
                        </div>
                        <a
                            className="idv2-navigate-btn"
                            href={`https://www.google.com/maps/dir/?api=1&destination=${issue.location.lat},${issue.location.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Navigation size={14} />
                            Navigate
                        </a>
                    </div>

                    {/* Mini Map */}
                    <div className="idv2-minimap">
                        <MiniMap lat={issue.location.lat} lng={issue.location.lng} />
                    </div>

                    {/* Action Required */}
                    {canPerformAction('update_issue') && (issue.status === 'new' || issue.status === 'active') && (
                        <div className="idv2-action-required">
                            <div className="idv2-action-header">
                                <AlertTriangle size={18} />
                                <strong>Action Required</strong>
                            </div>
                            <p className="idv2-action-text">
                                {issue.status === 'new'
                                    ? 'This issue has been assigned to you. Please review and accept or reject.'
                                    : 'This issue is actively being worked on. Mark as done or escalate.'}
                            </p>
                            {actionError && (
                                <p style={{ color: 'var(--color-error, #ef4444)', fontSize: '13px', marginBottom: '8px' }}>
                                    {actionError}
                                </p>
                            )}
                            <div className="idv2-action-buttons">
                                {issue.status === 'new' && (
                                    <>
                                        <button
                                            className="idv2-btn accept"
                                            onClick={() => handleStatusChange('active')}
                                            disabled={updateStatusMutation.isPending}
                                        >
                                            <CheckCircle size={16} />
                                            {updateStatusMutation.isPending ? 'Processing…' : 'Complete Issue'}
                                        </button>
                                        <button
                                            className="idv2-btn reject"
                                            onClick={() => handleStatusChange('rejected')}
                                            disabled={updateStatusMutation.isPending}
                                        >
                                            <XCircle size={16} />
                                            {updateStatusMutation.isPending ? 'Processing…' : 'Reject Issue'}
                                        </button>
                                    </>
                                )}
                                {issue.status === 'active' && (
                                    <>
                                        <button
                                            className="idv2-btn accept"
                                            onClick={() => handleStatusChange('done')}
                                            disabled={updateStatusMutation.isPending}
                                        >
                                            <CheckCircle size={16} />
                                            {updateStatusMutation.isPending ? 'Processing…' : 'Mark as Done'}
                                        </button>
                                        <button
                                            className="idv2-btn escalate"
                                            onClick={() => handleStatusChange('escalated')}
                                            disabled={updateStatusMutation.isPending}
                                        >
                                            <TrendingUp size={16} />
                                            {updateStatusMutation.isPending ? 'Processing…' : 'Escalate'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Completed / Escalated status */}
                    {(issue.status === 'done' || issue.status === 'escalated' || issue.status === 'rejected') && (
                        <div className="idv2-status-info">
                            This issue has been <strong>{issue.status}</strong>. No further actions available.
                            {issue.assignedTo && <span> • Handled by: {issue.assignedTo}</span>}
                        </div>
                    )}

                    {/* Linked SOPs */}
                    {linkedSops && linkedSops.length > 0 && (
                        <div className="idv2-linked-sops">
                            <div className="idv2-linked-sops-header">
                                <FileText size={18} />
                                <span>Linked SOPs ({linkedSops.length})</span>
                            </div>
                            <div className="idv2-linked-sops-list">
                                {linkedSops.map((sop: LinkedSop) => (
                                    <div
                                        key={sop.id}
                                        className="idv2-sop-card"
                                        onClick={() => navigate(`/dss/triggers/${sop.id}`)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                navigate(`/dss/triggers/${sop.id}`);
                                            }
                                        }}
                                    >
                                        <div className="idv2-sop-card-top">
                                            <span className={`idv2-sop-status-dot ${sop.status}`} />
                                            <span className="idv2-sop-card-status">
                                                {sop.status === 'completed' ? 'Completed' : sop.status === 'rejected' ? 'Rejected' : sop.status === 'approved' ? 'Approved' : 'Pending'}
                                            </span>
                                            <span className="idv2-sop-card-type">{sop.sop_type}</span>
                                        </div>
                                        <div className="idv2-sop-card-dept">{sop.department}</div>
                                        {sop.pollutionSource && (
                                            <div className="idv2-sop-card-source">
                                                Source: {sop.pollutionSource.replace(/_/g, ' ')}
                                                {sop.pollutionSourcePct != null && ` (${Math.round(sop.pollutionSourcePct)}%)`}
                                            </div>
                                        )}
                                        <div className="idv2-sop-card-meta">
                                            <span>
                                                <Clock size={12} />
                                                {sop.slaDeadline
                                                    ? new Date(sop.slaDeadline).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
                                                    : 'No deadline'}
                                            </span>
                                            <span className="idv2-sop-card-arrow">→</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
