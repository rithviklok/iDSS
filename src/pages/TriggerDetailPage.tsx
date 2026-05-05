import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft, Share2, MapPin, TrendingUp, Wind, Radio, Clock,
    Navigation, FileText, AlertTriangle, CheckCircle, XCircle, ChevronDown, Edit2, X, Camera
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TriggeredRule } from '../types/dss';
import { fetchTriggerById, updateInterventionStatus, completeSop, fetchTriggerIssue } from '../services/api';
import type { TriggerLinkedIssue } from '../services/api';

// Mock timeline and responsible party for interventions
const MOCK_TIMELINES = ['15 mins', '10 mins', '30 mins', '20 mins', '45 mins'];
const MOCK_RESPONSIBLE = ['Traffic Police • Field', 'Control Room • Admin', 'Field Officer • Site'];

type InterventionActionStatus = 'pending' | 'completed' | 'rejected' | 'modified';

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
    return severity === 'severe' ? 'High Priority' : severity === 'moderate' ? 'Medium Priority' : 'Low Priority';
}

function getAQICategoryFromReading(reading: string): string {
    const m = reading.match(/PM:\s*([\d.]+)/);
    const pm = m ? parseFloat(m[1]) : 0;
    if (pm <= 30) return 'Good';
    if (pm <= 60) return 'Satisfactory';
    if (pm <= 90) return 'Moderate';
    if (pm <= 120) return 'Poor';
    if (pm <= 250) return 'Very Poor';
    return 'Severe';
}

function toTriggeredRule(t: Record<string, unknown>): TriggeredRule {
    const r = t as Record<string, unknown>;
    return {
        id: String(r.id ?? ''),
        ruleId: String(r.ruleId ?? ''),
        ruleName: String(r.ruleName ?? ''),
        severity: (r.severity ?? 'advisory') as TriggeredRule['severity'],
        sources: Array.isArray(r.sources) ? r.sources as string[] : [],
        activatedAt: String(r.activatedAt ?? ''),
        ward: String(r.ward ?? ''),
        currentReading: String(r.currentReading ?? ''),
        timeExceeded: String(r.timeExceeded ?? ''),
        suggestedInterventions: Array.isArray(r.suggestedInterventions)
            ? (r.suggestedInterventions as string[]).filter((s): s is string => typeof s === 'string')
            : typeof r.suggestedInterventions === 'string'
                ? r.suggestedInterventions.split(';').map(s => s.trim()).filter(Boolean)
                : [],
        department: String(r.department ?? ''),
        slaDeadline: String(r.slaDeadline ?? ''),
        status: (r.status ?? 'awaiting_approval') as TriggeredRule['status'],
        approvalChain: Array.isArray(r.approvalChain) ? r.approvalChain as TriggeredRule['approvalChain'] : [],
        budgetImpact: Number(r.budgetImpact ?? 0),
        capacityNote: String(r.capacityNote ?? ''),
        affectedWards: Array.isArray(r.affectedWards) ? r.affectedWards as string[] : [],
        zoneName: (r.zoneName as string) || null,
        wardNames: Array.isArray(r.wardNames) ? r.wardNames as string[] : [],
        wind: (r.wind as string) || null,
        detectedBy: (r.detectedBy as string) || null,
    };
}

export default function TriggerDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const stateTrigger = (location.state as { trigger?: TriggeredRule })?.trigger;

    const queryClient = useQueryClient();
    const { data: apiTrigger, isLoading, isError } = useQuery({
        queryKey: ['trigger', id],
        queryFn: () => fetchTriggerById(id!),
        enabled: !!id,
    });

    const { data: linkedIssue } = useQuery({
        queryKey: ['trigger-issue', id],
        queryFn: () => fetchTriggerIssue(id!),
        enabled: !!id,
    });

    const trigger = apiTrigger ? toTriggeredRule(apiTrigger as unknown as Record<string, unknown>) : stateTrigger;

    const [interventionStatuses, setInterventionStatuses] = useState<Record<number, InterventionActionStatus>>({});
    const [actionError, setActionError] = useState<string | null>(null);
    const [interventionModifiedTexts, setInterventionModifiedTexts] = useState<Record<number, string>>({});
    const [expandedActionIdx, setExpandedActionIdx] = useState<number | null>(null);
    const [modifyingIdx, setModifyingIdx] = useState<number | null>(null);
    const [modifyText, setModifyText] = useState('');
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [completionPhoto, setCompletionPhoto] = useState<File | null>(null);
    const [completionRemarks, setCompletionRemarks] = useState('');
    const [completionGeo, setCompletionGeo] = useState<{ lat: number; lng: number } | null>(null);
    const [completionSubmitting, setCompletionSubmitting] = useState(false);

    // Intervention-level Complete modal state
    const [completeModalIdx, setCompleteModalIdx] = useState<number | null>(null);
    const [beforePhoto, setBeforePhoto] = useState<File | null>(null);
    const [afterPhoto, setAfterPhoto] = useState<File | null>(null);
    const [completeGeo, setCompleteGeo] = useState<{ lat: number; lng: number } | null>(null);
    const [completeSubmitting, setCompleteSubmitting] = useState(false);

    // Intervention-level Reject modal state
    const [rejectModalIdx, setRejectModalIdx] = useState<number | null>(null);
    const [rejectRemarks, setRejectRemarks] = useState('');
    const [rejectSubmitting, setRejectSubmitting] = useState(false);

    // Modify remarks state
    const [modifyRemarks, setModifyRemarks] = useState('');

    useEffect(() => {
        if (apiTrigger?.interventionStatuses) {
            const statuses: Record<number, InterventionActionStatus> = {};
            const texts: Record<number, string> = {};
            for (const [k, v] of Object.entries(apiTrigger.interventionStatuses)) {
                const idx = parseInt(k, 10);
                if (!isNaN(idx) && v && typeof v === 'object' && 'status' in v) {
                    statuses[idx] = (v as { status: string }).status as InterventionActionStatus;
                    if ('modifiedText' in v && (v as { modifiedText?: string }).modifiedText) {
                        texts[idx] = (v as { modifiedText: string }).modifiedText;
                    }
                }
            }
            setInterventionStatuses(statuses);
            setInterventionModifiedTexts(texts);
        }
    }, [apiTrigger?.interventionStatuses]);

    useEffect(() => {
        if (isError && !stateTrigger && id) {
            navigate('/dss', { replace: true });
        }
    }, [isError, stateTrigger, id, navigate]);

    if (!id) {
        navigate('/dss', { replace: true });
        return null;
    }

    if (isLoading && !stateTrigger) {
        return (
            <div className="page-container">
                <div style={{ textAlign: 'center', padding: '60px' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
                </div>
            </div>
        );
    }

    if (!trigger && !isLoading) {
        navigate('/dss', { replace: true });
        return null;
    }

    const safeTrigger = trigger!;

    const interventions = safeTrigger.suggestedInterventions.length > 0
        ? safeTrigger.suggestedInterventions
        : ['Immediate inspection', 'Enforce waste disposal norms', 'Issue notice/closure if required'];
    const allProcessed = interventions.length > 0 && interventions.every((_, i) => {
        const s = interventionStatuses[i];
        return s === 'completed' || s === 'rejected' || s === 'modified';
    });
    const coordStr = '26.8467°N, 80.9461°E';
    const [lat, lng] = [26.8467, 80.9461];

    const reportedDate = new Date(safeTrigger.activatedAt).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
    });

    const applyStatusResponse = (res: { interventionStatuses: Record<string, { status: string; modifiedText?: string }> }) => {
        const statuses: Record<number, InterventionActionStatus> = {};
        const texts: Record<number, string> = {};
        for (const [k, v] of Object.entries(res.interventionStatuses || {})) {
            const i = parseInt(k, 10);
            if (!isNaN(i) && v && typeof v === 'object' && 'status' in v) {
                statuses[i] = (v as { status: string }).status as InterventionActionStatus;
                if ('modifiedText' in v && (v as { modifiedText?: string }).modifiedText) {
                    texts[i] = (v as { modifiedText: string }).modifiedText;
                }
            }
        }
        setInterventionStatuses(statuses);
        setInterventionModifiedTexts(texts);
        queryClient.invalidateQueries({ queryKey: ['trigger', id] });
    };

    const pickFile = (): Promise<File | null> =>
        new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.capture = 'environment';
            input.onchange = () => resolve(input.files?.[0] || null);
            input.click();
        });

    const fetchGeo = async (): Promise<{ lat: number; lng: number } | null> => {
        try {
            const pos = await new Promise<GeolocationPosition>((res, rej) =>
                navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true })
            );
            return { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch {
            return null;
        }
    };

    const handleCompleteIntervention = async () => {
        if (completeModalIdx == null || !safeTrigger.id) return;
        if (!beforePhoto && !afterPhoto) {
            setActionError('Please upload at least one photo (before or after).');
            return;
        }
        setCompleteSubmitting(true);
        setActionError(null);
        try {
            const geo = completeGeo || await fetchGeo();
            const res = await updateInterventionStatus(safeTrigger.id, completeModalIdx, 'completed', {
                beforePhoto: beforePhoto || undefined,
                afterPhoto: afterPhoto || undefined,
                lat: geo?.lat,
                lng: geo?.lng,
            });
            applyStatusResponse(res);
            setCompleteModalIdx(null);
            setBeforePhoto(null);
            setAfterPhoto(null);
            setCompleteGeo(null);
        } catch (err) {
            setActionError((err as Error).message || 'Failed to complete intervention.');
        } finally {
            setCompleteSubmitting(false);
            setExpandedActionIdx(null);
        }
    };

    const handleRejectIntervention = async () => {
        if (rejectModalIdx == null || !safeTrigger.id) return;
        if (!rejectRemarks.trim()) {
            setActionError('Please provide remarks for rejection.');
            return;
        }
        setRejectSubmitting(true);
        setActionError(null);
        try {
            const res = await updateInterventionStatus(safeTrigger.id, rejectModalIdx, 'rejected', {
                remarks: rejectRemarks.trim(),
            });
            applyStatusResponse(res);
            setRejectModalIdx(null);
            setRejectRemarks('');
        } catch (err) {
            setActionError((err as Error).message || 'Failed to reject intervention.');
        } finally {
            setRejectSubmitting(false);
            setExpandedActionIdx(null);
        }
    };

    const handleModifyIntervention = async (idx: number) => {
        if (!safeTrigger.id) return;
        if (!modifyRemarks.trim()) {
            setActionError('Please provide remarks for modification.');
            return;
        }
        setActionLoading(true);
        setActionError(null);
        try {
            const res = await updateInterventionStatus(safeTrigger.id, idx, 'modified', {
                modifiedText: modifyText || undefined,
                remarks: modifyRemarks.trim(),
            });
            applyStatusResponse(res);
        } catch (err) {
            setActionError((err as Error).message || 'Failed to modify intervention.');
        } finally {
            setActionLoading(false);
            setModifyingIdx(null);
            setModifyText('');
            setModifyRemarks('');
            setExpandedActionIdx(null);
        }
    };

    const handleCompleteIssue = () => {
        if (allProcessed) setShowCompletionModal(true);
    };

    const capturePhoto = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                setCompletionPhoto(file);
                try {
                    const pos = await new Promise<GeolocationPosition>((res, rej) =>
                        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true })
                    );
                    setCompletionGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                } catch {
                    setCompletionGeo(null);
                }
            }
        };
        input.click();
    };

    const handleCompletionSubmit = async () => {
        if (!safeTrigger.id) return;
        setCompletionSubmitting(true);
        try {
            await completeSop(safeTrigger.id, {
                photo: completionPhoto || undefined,
                remarks: completionRemarks,
                lat: completionGeo?.lat,
                lng: completionGeo?.lng,
            });
            setShowCompletionModal(false);
            navigate('/dss');
        } catch (err) {
            console.error('Failed to complete SOP:', err);
        } finally {
            setCompletionSubmitting(false);
        }
    };

    return (
        <div className="page-container" style={{ overflow: 'auto' }}>
            <div className="issue-detail-v2">
                {/* Top Bar */}
                <div className="idv2-topbar">
                    <div className="idv2-topbar-left">
                        <button className="idv2-back-btn" onClick={() => navigate('/dss')}>
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <div className="idv2-issue-id">TRG-{safeTrigger.id}</div>
                            <div className="idv2-issue-type">📋 {safeTrigger.ruleName}</div>
                        </div>
                    </div>
                    <div className="idv2-topbar-right">
                        <span className={`status-badge ${safeTrigger.status === 'awaiting_approval' ? 'active' : safeTrigger.status}`}>
                            {safeTrigger.status.replace(/_/g, ' ')}
                        </span>
                        <button className="idv2-share-btn"><Share2 size={16} /></button>
                    </div>
                </div>

                {/* Content */}
                <div className="idv2-content">
                    <div className="idv2-badges">
                        <span className={`idv2-priority-badge ${safeTrigger.severity === 'severe' ? 'high' : safeTrigger.severity === 'moderate' ? 'medium' : 'low'}`}>
                            <AlertTriangle size={12} />
                            {getSeverityLabel(safeTrigger.severity)}
                        </span>
                        <span className="idv2-category-badge">{getAQICategoryFromReading(safeTrigger.currentReading)}</span>
                    </div>

                    <h2 className="idv2-title">{safeTrigger.ruleName}</h2>
                    <p className="idv2-description">
                        SOP triggered by {safeTrigger.currentReading}. {safeTrigger.sources?.length ? `Sources: ${safeTrigger.sources.join(', ')}.` : ''}
                    </p>

                    {/* Info Cards Grid */}
                    <div className="idv2-info-grid">
                        <div className="idv2-info-card">
                            <MapPin size={16} className="idv2-info-icon blue" />
                            <div className="idv2-info-label">Zone / Ward</div>
                            <div className="idv2-info-value">
                                {safeTrigger.zoneName || (safeTrigger.ward ? `Zone ${safeTrigger.ward}` : 'N/A')}
                                {safeTrigger.wardNames && safeTrigger.wardNames.length > 0 && (
                                    <div className="idv2-affected-wards" style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4 }}>
                                        <strong>Wards:</strong> {safeTrigger.wardNames.slice(0, 5).join(', ')}{safeTrigger.wardNames.length > 5 ? ` +${safeTrigger.wardNames.length - 5}` : ''}
                                    </div>
                                )}
                                {(!safeTrigger.wardNames || safeTrigger.wardNames.length === 0) && safeTrigger.affectedWards && safeTrigger.affectedWards.length > 0 && (
                                    <div className="idv2-affected-wards" style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4 }}>
                                        <strong>Wards:</strong> {safeTrigger.affectedWards.slice(0, 5).join(', ')}{safeTrigger.affectedWards.length > 5 ? ` +${safeTrigger.affectedWards.length - 5}` : ''}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="idv2-info-card">
                            <TrendingUp size={16} className="idv2-info-icon red" />
                            <div className="idv2-info-label">PM2.5 Reading</div>
                            <div className="idv2-info-value">{safeTrigger.currentReading}</div>
                        </div>
                        <div className="idv2-info-card">
                            <Wind size={16} className="idv2-info-icon teal" />
                            <div className="idv2-info-label">Wind</div>
                            <div className="idv2-info-value">{safeTrigger.wind || 'N/A'}</div>
                        </div>
                        <div className="idv2-info-card">
                            <Radio size={16} className="idv2-info-icon orange" />
                            <div className="idv2-info-label">Detected By</div>
                            <div className="idv2-info-value">{safeTrigger.detectedBy || 'Monitoring Network'}</div>
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
                            href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Navigation size={14} />
                            Navigate
                        </a>
                    </div>

                    {/* Mini Map */}
                    <div className="idv2-minimap">
                        <MiniMap lat={lat} lng={lng} />
                    </div>

                    {/* Linked Issue */}
                    {linkedIssue && (
                        <div
                            className="idv2-linked-issue-card"
                            onClick={() => navigate(`/issues/${(linkedIssue as TriggerLinkedIssue).id}`)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/issues/${(linkedIssue as TriggerLinkedIssue).id}`); } }}
                        >
                            <div className="idv2-linked-issue-header">
                                <AlertTriangle size={16} />
                                <span>Linked Issue</span>
                            </div>
                            <div className="idv2-linked-issue-title">{(linkedIssue as TriggerLinkedIssue).title}</div>
                            <div className="idv2-linked-issue-meta">
                                <span className={`status-badge ${(linkedIssue as TriggerLinkedIssue).status}`}>
                                    {(linkedIssue as TriggerLinkedIssue).status}
                                </span>
                                <span className="idv2-sop-card-arrow">→</span>
                            </div>
                        </div>
                    )}

                    {/* SOP Section - Short Term only */}
                    <div className="trigger-detail-sop">
                        <div className="trigger-detail-sop-header">
                            <div>
                                <h3 className="trigger-detail-sop-title">
                                    <FileText size={18} />
                                    Standard Operating Procedures
                                </h3>
                                <p className="trigger-detail-sop-subtitle">{safeTrigger.ruleName}</p>
                                <p className="trigger-detail-sop-authority">Authority: {safeTrigger.department || 'Traffic Police SOP 2023'}</p>
                            </div>
                            <span className="trigger-detail-sop-impact">Est. Impact: 20-25 µg/m³ reduction</span>
                        </div>

                        <div className="trigger-detail-sop-banner">
                            Immediate actions required within hours
                        </div>

                        {actionError && (
                            <div className="trigger-detail-error" style={{ marginTop: 12, padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <AlertTriangle size={18} />
                                <span>{actionError}</span>
                            </div>
                        )}

                        <div className="trigger-detail-interventions">
                            {interventions.map((intv, i) => {
                                const status = interventionStatuses[i] ?? 'pending';
                                const isExpanded = expandedActionIdx === i;
                                const isModifying = modifyingIdx === i;
                                const displayText = status === 'modified' && interventionModifiedTexts[i]
                                    ? interventionModifiedTexts[i]
                                    : intv;
                                const timeline = MOCK_TIMELINES[i % MOCK_TIMELINES.length];
                                const responsible = MOCK_RESPONSIBLE[i % MOCK_RESPONSIBLE.length];

                                return (
                                    <div key={i} className={`trigger-detail-intv-card ${status}`}>
                                        <div className="trigger-detail-intv-main">
                                            <span className="trigger-detail-intv-num">{i + 1}</span>
                                            <div className="trigger-detail-intv-body">
                                                <div className="trigger-detail-intv-title">{displayText}</div>
                                                <div className="trigger-detail-intv-meta">{responsible}</div>
                                            </div>
                                            <span className="trigger-detail-intv-timeline">{timeline}</span>
                                        </div>
                                        <div className="trigger-detail-intv-actions-row">
                                            {status === 'pending' ? (
                                                <>
                                                    <button
                                                        className="trigger-detail-action-btn"
                                                        onClick={() => setExpandedActionIdx(isExpanded ? null : i)}
                                                        disabled={actionLoading}
                                                    >
                                                        Action <ChevronDown size={12} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }} />
                                                    </button>
                                                    {isExpanded && (
                                                        <div className="trigger-detail-action-dropdown">
                                                            <button
                                                                className="trigger-detail-dropdown-btn complete"
                                                                onClick={() => {
                                                                    setExpandedActionIdx(null);
                                                                    setCompleteModalIdx(i);
                                                                    setBeforePhoto(null);
                                                                    setAfterPhoto(null);
                                                                    setCompleteGeo(null);
                                                                    setActionError(null);
                                                                }}
                                                            >
                                                                <CheckCircle size={14} /> Complete
                                                            </button>
                                                            <button
                                                                className="trigger-detail-dropdown-btn reject"
                                                                onClick={() => {
                                                                    setExpandedActionIdx(null);
                                                                    setRejectModalIdx(i);
                                                                    setRejectRemarks('');
                                                                    setActionError(null);
                                                                }}
                                                            >
                                                                <XCircle size={14} /> Reject
                                                            </button>
                                                            <button
                                                                className="trigger-detail-dropdown-btn modify"
                                                                onClick={() => {
                                                                    setExpandedActionIdx(null);
                                                                    setModifyingIdx(i);
                                                                    setModifyText(interventionModifiedTexts[i] || intv);
                                                                    setModifyRemarks('');
                                                                    setActionError(null);
                                                                }}
                                                            >
                                                                <Edit2 size={14} /> Modify
                                                            </button>
                                                            <button className="trigger-detail-dropdown-btn escalate disabled" disabled>
                                                                Escalate
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <span className={`trigger-detail-status-badge ${status}`}>{status}</span>
                                            )}
                                        </div>
                                        {isModifying && (
                                            <div className="trigger-detail-modify-form">
                                                <textarea
                                                    value={modifyText}
                                                    onChange={(e) => setModifyText(e.target.value)}
                                                    placeholder="Modified intervention text..."
                                                    rows={2}
                                                />
                                                <textarea
                                                    value={modifyRemarks}
                                                    onChange={(e) => setModifyRemarks(e.target.value)}
                                                    placeholder="Remarks (required)..."
                                                    rows={2}
                                                    style={{ marginTop: 8 }}
                                                />
                                                <div className="trigger-detail-modify-btns">
                                                    <button
                                                        className="idv2-btn accept"
                                                        onClick={() => handleModifyIntervention(i)}
                                                        disabled={actionLoading}
                                                    >
                                                        {actionLoading ? 'Saving...' : 'Save'}
                                                    </button>
                                                    <button className="idv2-btn reject" onClick={() => { setModifyingIdx(null); setModifyText(''); setModifyRemarks(''); }}>
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="trigger-detail-bottom-bar">
                        <button
                            className="trigger-detail-complete-btn"
                            onClick={handleCompleteIssue}
                            disabled={!allProcessed}
                            title={!allProcessed ? 'Complete all interventions first' : ''}
                        >
                            <CheckCircle size={18} />
                            Complete Task
                        </button>
                        <button className="trigger-detail-escalate-btn">
                            <XCircle size={18} />
                            Reject
                        </button>
                    </div>
                </div>
            </div>

            {/* SOP-level Completion Modal */}
            {showCompletionModal && safeTrigger && (
                <div className="dss-modal-overlay" onClick={() => setShowCompletionModal(false)}>
                    <div className="dss-modal dss-completion-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="dss-modal-header">
                            <h3>Complete SOP: {safeTrigger.ruleName}</h3>
                            <button className="dss-modal-close" onClick={() => setShowCompletionModal(false)}><X size={18} /></button>
                        </div>
                        <div className="dss-modal-body">
                            <p className="dss-modal-hint">Submit geotagged photo and optional remarks to complete this SOP.</p>
                            <div className="dss-completion-photo">
                                <button type="button" className="dss-btn dss-btn-outline" onClick={capturePhoto}>
                                    <Camera size={16} />
                                    {completionPhoto ? `Photo: ${completionPhoto.name}` : 'Capture / Upload Geotagged Photo'}
                                </button>
                                {completionGeo && (
                                    <span className="dss-geo-badge">
                                        {completionGeo.lat.toFixed(5)}°, {completionGeo.lng.toFixed(5)}°
                                    </span>
                                )}
                            </div>
                            <div className="dss-completion-remarks">
                                <label>Remarks (optional)</label>
                                <textarea
                                    value={completionRemarks}
                                    onChange={(e) => setCompletionRemarks(e.target.value)}
                                    placeholder="Add any remarks..."
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className="dss-modal-footer">
                            <button className="dss-btn" onClick={() => setShowCompletionModal(false)}>Cancel</button>
                            <button
                                className="dss-btn dss-btn-success"
                                onClick={handleCompletionSubmit}
                                disabled={completionSubmitting}
                            >
                                {completionSubmitting ? 'Submitting…' : 'Submit & Complete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Intervention Complete Modal — Before/After Photos */}
            {completeModalIdx != null && safeTrigger && (
                <div className="dss-modal-overlay" onClick={() => { setCompleteModalIdx(null); setActionError(null); }}>
                    <div className="dss-modal dss-completion-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="dss-modal-header">
                            <h3>Complete Intervention #{(completeModalIdx ?? 0) + 1}</h3>
                            <button className="dss-modal-close" onClick={() => { setCompleteModalIdx(null); setActionError(null); }}><X size={18} /></button>
                        </div>
                        <div className="dss-modal-body">
                            <p className="dss-modal-hint">Upload geocoded <strong>Before</strong> and <strong>After</strong> images as proof of completion.</p>

                            {actionError && (
                                <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#ef4444', fontSize: '0.85rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <AlertTriangle size={14} /> {actionError}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block' }}>Before Photo</label>
                                    <button
                                        type="button"
                                        className="dss-btn dss-btn-outline"
                                        style={{ width: '100%', justifyContent: 'center' }}
                                        onClick={async () => {
                                            const f = await pickFile();
                                            if (f) {
                                                setBeforePhoto(f);
                                                if (!completeGeo) {
                                                    const g = await fetchGeo();
                                                    if (g) setCompleteGeo(g);
                                                }
                                            }
                                        }}
                                    >
                                        <Camera size={14} />
                                        {beforePhoto ? beforePhoto.name.slice(0, 20) : 'Upload Before'}
                                    </button>
                                    {beforePhoto && <span style={{ fontSize: '0.7rem', color: '#059669', marginTop: 4, display: 'block' }}>Selected</span>}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block' }}>After Photo</label>
                                    <button
                                        type="button"
                                        className="dss-btn dss-btn-outline"
                                        style={{ width: '100%', justifyContent: 'center' }}
                                        onClick={async () => {
                                            const f = await pickFile();
                                            if (f) {
                                                setAfterPhoto(f);
                                                if (!completeGeo) {
                                                    const g = await fetchGeo();
                                                    if (g) setCompleteGeo(g);
                                                }
                                            }
                                        }}
                                    >
                                        <Camera size={14} />
                                        {afterPhoto ? afterPhoto.name.slice(0, 20) : 'Upload After'}
                                    </button>
                                    {afterPhoto && <span style={{ fontSize: '0.7rem', color: '#059669', marginTop: 4, display: 'block' }}>Selected</span>}
                                </div>
                            </div>

                            {completeGeo && (
                                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 12 }}>
                                    <MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                                    Geolocation: {completeGeo.lat.toFixed(5)}°, {completeGeo.lng.toFixed(5)}°
                                </div>
                            )}
                        </div>
                        <div className="dss-modal-footer">
                            <button className="dss-btn" onClick={() => { setCompleteModalIdx(null); setActionError(null); }}>Cancel</button>
                            <button
                                className="dss-btn dss-btn-success"
                                onClick={handleCompleteIntervention}
                                disabled={completeSubmitting || (!beforePhoto && !afterPhoto)}
                            >
                                {completeSubmitting ? 'Submitting…' : 'Submit & Complete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Intervention Reject Modal — Remarks */}
            {rejectModalIdx != null && safeTrigger && (
                <div className="dss-modal-overlay" onClick={() => { setRejectModalIdx(null); setActionError(null); }}>
                    <div className="dss-modal dss-completion-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="dss-modal-header">
                            <h3>Reject Intervention #{(rejectModalIdx ?? 0) + 1}</h3>
                            <button className="dss-modal-close" onClick={() => { setRejectModalIdx(null); setActionError(null); }}><X size={18} /></button>
                        </div>
                        <div className="dss-modal-body">
                            <p className="dss-modal-hint">Please provide a reason for rejecting this intervention.</p>

                            {actionError && (
                                <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#ef4444', fontSize: '0.85rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <AlertTriangle size={14} /> {actionError}
                                </div>
                            )}

                            <div className="dss-completion-remarks">
                                <label style={{ fontWeight: 600 }}>Remarks <span style={{ color: '#ef4444' }}>*</span></label>
                                <textarea
                                    value={rejectRemarks}
                                    onChange={(e) => setRejectRemarks(e.target.value)}
                                    placeholder="Reason for rejection..."
                                    rows={3}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="dss-modal-footer">
                            <button className="dss-btn" onClick={() => { setRejectModalIdx(null); setActionError(null); }}>Cancel</button>
                            <button
                                className="dss-btn"
                                style={{ background: '#ef4444', color: '#fff' }}
                                onClick={handleRejectIntervention}
                                disabled={rejectSubmitting || !rejectRemarks.trim()}
                            >
                                {rejectSubmitting ? 'Submitting…' : 'Reject Intervention'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
