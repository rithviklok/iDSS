import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Shield, Zap, AlertTriangle,
    BarChart3, ChevronDown, Activity, Users, Wallet,
    TrendingDown, Target, Settings, Play, RefreshCw
} from 'lucide-react';
import type { DSSTab, TriggerSeverity, TriggerStatus, TriggeredRule } from '../types/dss';
import { mockDeptCapacity, mockSimulationResults } from '../data/mockDssData';
import { fetchDssTriggers, fetchDssRules, fetchSensors, fetchTeam } from '../services/api';
import type { DssRule, TeamMember } from '../services/api';
import { useLocation } from '../contexts/LocationContext';
import { useAuth } from '../contexts/AuthContext';
import { isDummyDataMode } from '../services/dummyMode';

const DSS_API_BASE = import.meta.env.VITE_DSS_API_BASE || 'http://localhost:3000';

// ========== Helpers ==========
function getSeverityColor(s: TriggerSeverity) {
    return s === 'severe' ? '#ef4444' : s === 'moderate' ? '#f59e0b' : '#6366f1';
}
function getSeverityBg(s: TriggerSeverity) {
    return s === 'severe' ? 'rgba(239,68,68,0.12)' : s === 'moderate' ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)';
}
function getStatusColor(s: TriggerStatus) {
    switch (s) {
        case 'awaiting_approval': return '#f59e0b';
        case 'in_progress': return '#6366f1';
        case 'completed': return '#10b981';
        case 'failed': return '#ef4444';
        case 'escalated': return '#8b5cf6';
    }
}
function formatINR(n: number) {
    if (n < 0) return `+₹${Math.abs(n).toLocaleString('en-IN')} (recovery)`;
    return `₹${n.toLocaleString('en-IN')}`;
}
function slaRemaining(deadline: string) {
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) return { text: 'SLA BREACHED', urgent: true };
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return { text: `${mins}m remaining`, urgent: mins < 15 };
    const hrs = Math.floor(mins / 60);
    return { text: `${hrs}h ${mins % 60}m remaining`, urgent: hrs < 1 };
}
function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

// Map raw API trigger to TriggeredRule shape
function apiTriggerToTriggeredRule(t: ReturnType<typeof Object.assign>): TriggeredRule {
    return {
        id: String(t.id ?? ''),
        ruleId: String(t.ruleId ?? ''),
        ruleName: String(t.ruleName ?? t.ruleId ?? 'Unknown Rule'),
        severity: (t.severity ?? 'advisory') as TriggerSeverity,
        sources: Array.isArray(t.sources) ? t.sources : [],
        activatedAt: t.activatedAt ?? new Date().toISOString(),
        ward: t.ward != null ? `Ward ${t.ward}` : 'Unknown Ward',
        currentReading: t.currentReading != null ? `PM: ${t.currentReading} µg/m³` : '',
        timeExceeded: t.timeExceeded ?? '',
        suggestedInterventions: (() => {
            const v = t.suggestedInterventions;
            if (Array.isArray(v)) return v.filter((s): s is string => typeof s === 'string');
            if (typeof v === 'string') return v.split(';').map(s => s.trim()).filter(Boolean);
            return [];
        })(),
        department: t.department ?? '',
        slaDeadline: t.slaDeadline ?? '',
        status: (t.status ?? 'awaiting_approval') as TriggerStatus,
        approvalChain: Array.isArray(t.approvalChain) ? t.approvalChain : [],
        budgetImpact: Number(t.budgetImpact ?? 0),
        capacityNote: t.capacityNote ?? '',
        affectedWards: Array.isArray(t.affectedWards) ? t.affectedWards : [],
    };
}

// ========== Tab 1: Trigger Queue ==========
function TriggerQueue({ triggers, loading }: { triggers: TriggeredRule[]; loading: boolean; isAdminOrSuper?: boolean; onRefresh?: () => void }) {
    const navigate = useNavigate();

    if (loading) return (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={20} style={{ animation: 'spinner 1s linear infinite', marginBottom: 8 }} />
            <div>Loading triggers…</div>
        </div>
    );
    if (!triggers.length) return (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Shield size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
            <div>No active triggers for this district</div>
        </div>
    );

    return (
        <>
            <div className="dss-trigger-queue">
                {triggers.map(t => {
                    const sla = slaRemaining(t.slaDeadline);
                    return (
                        <div
                            key={t.id}
                            role="button"
                            tabIndex={0}
                            className="dss-tq-card dss-tq-card-clickable"
                            style={{ borderLeftColor: getSeverityColor(t.severity) }}
                            onClick={() => navigate(`/dss/triggers/${t.id}`, { state: { trigger: t } })}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    navigate(`/dss/triggers/${t.id}`, { state: { trigger: t } });
                                }
                            }}
                        >
                            <div className="dss-tq-top">
                                <div>
                                    <div className="dss-tq-name">{t.ruleName}</div>
                                    <div className="dss-tq-ward">
                                        {t.ward}
                                        {t.affectedWards && t.affectedWards.length > 0 && (
                                            <span style={{ fontSize: '0.7rem', color: '#6b7280', marginLeft: 6 }}>
                                                ({t.affectedWards.length} wards affected)
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className="dss-severity-badge" style={{ background: getSeverityBg(t.severity), color: getSeverityColor(t.severity) }}>
                                    {t.severity}
                                </span>
                            </div>

                            <div className="dss-tq-reading">
                                <Activity size={13} />
                                <span>{t.currentReading}</span>
                                <span className="dss-tq-time">{t.timeExceeded}</span>
                            </div>

                                <div className="dss-tq-metrics">
                                <div className="dss-tq-metric">
                                    <span className="dss-tq-metric-label">SLA</span>
                                    <span className={`dss-sla-badge ${sla.urgent ? 'urgent' : ''}`}>{sla.text}</span>
                                </div>
                            </div>

                            <div className="dss-tq-sources">
                                {t.sources.map((s, i) => <span key={i} className="dss-source-tag">{s}</span>)}
                            </div>

                            <div className="dss-tq-interventions">
                                <span className="dss-tq-metric-label">Interventions:</span>
                                {t.suggestedInterventions.map((intv, i) => (
                                    <span key={i} className="dss-intv-tag">{intv}</span>
                                ))}
                            </div>

                            <div className="dss-tq-footer">
                                <div className="dss-tq-budget">
                                    <Wallet size={13} />
                                    <span>Budget Impact: <strong>{formatINR(t.budgetImpact)}</strong></span>
                                </div>
                            </div>

                            <div className="dss-tq-status-row">
                                <span className="dss-trigger-status-badge" style={{ background: getStatusColor(t.status) + '22', color: getStatusColor(t.status) }}>
                                    {t.status.replace(/_/g, ' ')}
                                </span>
                                <span className="dss-tq-ago">{timeAgo(t.activatedAt)}</span>
                            </div>
                            <div className="dss-tq-click-hint">Click to open →</div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}

// ========== Tab 2: Rule Logic ==========
function RuleLogic({ apiRules, loading }: { apiRules: DssRule[]; loading: boolean }) {
    // Use API rules directly — no mock fallback
    const rules = apiRules.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        status: (r.status === 'active' ? 'active' : r.status) as import('../types/dss').DSSRuleStatus,
        conditions: r.conditions as { id: string; source: string; parameter: string; operator: string; threshold: string; logic?: string; duration?: string; spatialFilter?: string }[],
        department: r.department,
        slaHours: r.slaHours,
        approvalMode: r.approvalMode,
        triggerCount: r.triggerCount,
        interventions: r.interventions,
        workflowChain: r.workflowChain,
        impactMetrics: r.impactMetrics as { estimatedPollutantReduction: string; affectedPopulation: number; healthBenefit: string; impactedSchools?: number },
    }));

    const firstId = rules[0]?.id ?? null;
    const [expandedRule, setExpandedRule] = useState<string | null>(firstId);

    if (loading) return (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div>Loading rules…</div>
        </div>
    );

    return (
        <div className="dss-rule-logic">
            {rules.map(rule => {
                const isExpanded = expandedRule === rule.id;
                const totalBudget = rule.interventions.reduce((s, i) => s + Math.max(0, i.estimatedCost), 0);

                return (
                    <div key={rule.id} className={`dss-rl-card ${isExpanded ? 'expanded' : ''}`}>
                        <div className="dss-rl-header" onClick={() => setExpandedRule(isExpanded ? null : rule.id)}>
                            <div className="dss-rl-header-left">
                                <span className={`dss-rl-status-dot ${rule.status}`} />
                                <div>
                                    <div className="dss-rl-name">{rule.name}</div>
                                    <div className="dss-rl-dept">{rule.department} • Triggered {rule.triggerCount}x</div>
                                </div>
                            </div>
                            <ChevronDown size={16} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted)' }} />
                        </div>

                        {isExpanded && (
                            <div className="dss-rl-body">
                                <p className="dss-rl-desc">{rule.description}</p>

                                {/* IF Conditions */}
                                <div className="dss-rl-conditions">
                                    <div className="dss-rl-block-label">IF</div>
                                    {rule.conditions.map((c, i) => (
                                        <div key={c.id} className="dss-rl-condition">
                                            {i > 0 && <span className="dss-rl-logic">{c.logic}</span>}
                                            <div className="dss-rl-condition-content">
                                                <span className="dss-rl-tag source">{c.source}</span>
                                                <span>{c.parameter}</span>
                                                <span className="dss-rl-op">{c.operator}</span>
                                                <span className="dss-rl-threshold">{c.threshold}</span>
                                                {c.duration && <span className="dss-rl-duration">for {c.duration}</span>}
                                                {c.spatialFilter && <span className="dss-rl-spatial">📍 {c.spatialFilter}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* THEN Interventions */}
                                <div className="dss-rl-interventions">
                                    <div className="dss-rl-block-label">THEN</div>
                                    {rule.interventions.map(intv => (
                                        <div key={intv.id} className="dss-rl-intervention-row">
                                            <span className="dss-rl-intv-name">{intv.name}</span>
                                            <span className="dss-rl-intv-cost">{formatINR(intv.estimatedCost)}</span>
                                            <span className="dss-rl-intv-fund">{intv.fundSource}</span>
                                        </div>
                                    ))}
                                    <div className="dss-rl-budget-total">
                                        <Wallet size={13} />
                                        Total Budget per trigger: <strong>{formatINR(totalBudget)}</strong>
                                    </div>
                                </div>

                                {/* Workflow Chain */}
                                <div className="dss-rl-workflow">
                                    <div className="dss-rl-block-label">Approval Chain</div>
                                    <div className="dss-rl-chain">
                                        {rule.workflowChain.map((step, i) => (
                                            <span key={i}>
                                                <span className="dss-rl-chain-step">{step}</span>
                                                {i < rule.workflowChain.length - 1 && <span className="dss-rl-chain-arrow">→</span>}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Impact */}
                                <div className="dss-rl-impact">
                                    <div className="dss-rl-block-label">Impact Assessment</div>
                                    <div className="dss-rl-impact-grid">
                                        <div><TrendingDown size={13} /><span>{rule.impactMetrics.estimatedPollutantReduction}</span></div>
                                        <div><Users size={13} /><span>{rule.impactMetrics.affectedPopulation.toLocaleString('en-IN')} people affected</span></div>
                                        <div><Target size={13} /><span>{rule.impactMetrics.healthBenefit}</span></div>
                                        {rule.impactMetrics.impactedSchools && (
                                            <div><AlertTriangle size={13} /><span>{rule.impactMetrics.impactedSchools} schools in affected zone</span></div>
                                        )}
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="dss-rl-controls">
                                    <div className="dss-rl-control-row">
                                        <span>SLA Timer</span><strong>{rule.slaHours}h</strong>
                                    </div>
                                    <div className="dss-rl-control-row">
                                        <span>Approval Mode</span>
                                        <span className={`dss-rl-mode ${rule.approvalMode}`}>
                                            {rule.approvalMode === 'auto' ? '⚡ Auto-Approve' : '✋ Manual Approval'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ========== Tab 3: Sensor Health ==========
function SensorHealth({ districtId }: { districtId: string }) {
    const { data: sensors = [], isLoading: loading } = useQuery({
        queryKey: ['sensors', districtId, null],
        queryFn: () => fetchSensors(districtId),
    });

    if (loading) return (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={20} style={{ animation: 'spinner 1s linear infinite', marginBottom: 8 }} />
            <div>Loading sensors…</div>
        </div>
    );
    if (!sensors.length) return (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Activity size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
            <div>No sensors found for this district</div>
        </div>
    );

    return (
        <div className="dss-sensor-health">
            <div className="dss-sensor-health-table-wrap">
                <table className="dss-sensor-health-table">
                    <thead>
                        <tr>
                            <th>Sensor ID</th>
                            <th>Name</th>
                            <th>Health</th>
                            <th>PM2.5</th>
                            <th>PM10</th>
                            <th>Zone</th>
                            <th>Ward</th>
                            <th>Last Updated</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sensors.map(s => (
                            <tr key={s.id}>
                                <td className="dss-sh-id">{s.id}</td>
                                <td className="dss-sh-name">{s.name}</td>
                                <td>
                                    <span className={`dss-sh-health ${s.isActive ? 'active' : 'inactive'}`}>
                                        {s.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td>{s.pm25} µg/m³</td>
                                <td>{s.pm10} µg/m³</td>
                                <td>{s.zone}</td>
                                <td>{s.ward}</td>
                                <td className="dss-sh-updated">
                                    {s.lastUpdated ? new Date(s.lastUpdated).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ========== Tab 4: Capacity Monitor ==========
interface CapacityDept {
    department: string;
    resources: { name: string; total: number; available: number; deployed: number }[];
    pendingActions: number;
    avgResponseTime: string;
    slaCompliance: number;
    overdueCount: number;
    budgetUtilized: number;
    budgetAllocated: number;
}

function CapacityMonitor({ districtId }: { districtId: string }) {
    const { data: departments = [], isLoading: loading } = useQuery<CapacityDept[]>({
        queryKey: ['dss-capacity', districtId],
        queryFn: async (): Promise<CapacityDept[]> => {
            if (isDummyDataMode()) return mockDeptCapacity as CapacityDept[];
            try {
                const r = await fetch(`${DSS_API_BASE}/dss/capacity?districtId=${encodeURIComponent(districtId)}`, { credentials: 'include' });
                if (!r.ok) throw new Error(`capacity ${r.status}`);
                const data = await r.json();
                return data.departments ?? [];
            } catch {
                return mockDeptCapacity;
            }
        },
    });

    if (loading) return (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={20} style={{ animation: 'spinner 1s linear infinite', marginBottom: 8 }} />
            <div>Loading capacity…</div>
        </div>
    );
    if (!departments.length) return (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <BarChart3 size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
            <div>No department capacity data available</div>
        </div>
    );

    return (
        <div className="dss-capacity">
            {departments.map((dept: CapacityDept) => {
                const budgetPct = dept.budgetAllocated > 0 ? Math.round((dept.budgetUtilized / dept.budgetAllocated) * 100) : 0;
                return (
                    <div key={dept.department} className="dss-cap-card">
                        <div className="dss-cap-header">
                            <div className="dss-cap-dept">{dept.department}</div>
                            <span className={`dss-cap-sla ${dept.slaCompliance < 75 ? 'red' : dept.slaCompliance < 90 ? 'yellow' : 'green'}`}>
                                SLA: {dept.slaCompliance}%
                            </span>
                        </div>

                        <div className="dss-cap-resources">
                            {dept.resources.map((r: { name: string; total: number; available: number; deployed: number }) => (
                                <div key={r.name} className="dss-cap-resource">
                                    <span className="dss-cap-res-name">{r.name}</span>
                                    <div className="dss-cap-res-bar">
                                        <div className="dss-cap-res-fill deployed" style={{ width: `${(r.deployed / r.total) * 100}%` }} />
                                        <div className="dss-cap-res-fill available" style={{ width: `${(r.available / r.total) * 100}%` }} />
                                    </div>
                                    <span className="dss-cap-res-nums">{r.available}/{r.total} free</span>
                                </div>
                            ))}
                        </div>

                        <div className="dss-cap-metrics">
                            <div>
                                <span className="dss-cap-metric-label">Avg Response</span>
                                <span className="dss-cap-metric-value">{dept.avgResponseTime}</span>
                            </div>
                            <div>
                                <span className="dss-cap-metric-label">Pending</span>
                                <span className="dss-cap-metric-value">{dept.pendingActions}</span>
                            </div>
                            <div>
                                <span className="dss-cap-metric-label">Overdue</span>
                                <span className={`dss-cap-metric-value ${dept.overdueCount > 0 ? 'red' : ''}`}>{dept.overdueCount}</span>
                            </div>
                        </div>

                        <div className="dss-cap-budget">
                            <div className="dss-cap-budget-row">
                                <span><Wallet size={12} /> Budget Utilized</span>
                                <span>{formatINR(dept.budgetUtilized)} / {formatINR(dept.budgetAllocated)}</span>
                            </div>
                            <div className="dss-cap-budget-bar">
                                <div className="dss-cap-budget-fill" style={{
                                    width: `${budgetPct}%`,
                                    background: budgetPct > 80 ? '#ef4444' : budgetPct > 60 ? '#f59e0b' : '#10b981',
                                }} />
                            </div>
                            <span className="dss-cap-budget-pct">{budgetPct}% utilized</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ========== Simulation Panel ==========
interface SimResult {
    ruleId: string;
    ruleName: string;
    triggerCount: number;
    avgSlaAdherence: number;
    estimatedReduction: string;
    budgetSpend: number;
}

function SimulationPanel() {
    const { data: simResults = [], isLoading: loading } = useQuery<SimResult[]>({
        queryKey: ['dss-simulations'],
        queryFn: async (): Promise<SimResult[]> => {
            if (isDummyDataMode()) {
                return mockSimulationResults.map((s) => ({
                    ruleId: s.ruleId,
                    ruleName: s.ruleName,
                    triggerCount: s.triggerCount,
                    avgSlaAdherence: s.avgSlaAdherence,
                    estimatedReduction: s.estimatedReduction,
                    budgetSpend: s.budgetSpend,
                }));
            }
            const r = await fetch(`${DSS_API_BASE}/dss/simulations`);
            if (!r.ok) throw new Error(`simulations ${r.status}`);
            const data = await r.json();
            const sims = data.simulations ?? [];
            return sims.map((s: { results?: SimResult; ruleId?: string; ruleName?: string }) => ({
                ruleId: s.ruleId ?? s.results?.ruleId ?? '',
                ruleName: s.ruleName ?? s.results?.ruleName ?? 'Unknown',
                triggerCount: s.results?.triggerCount ?? 0,
                avgSlaAdherence: s.results?.avgSlaAdherence ?? 0,
                estimatedReduction: s.results?.estimatedReduction ?? '',
                budgetSpend: s.results?.budgetSpend ?? 0,
            }));
        },
    });

    const totalBudget = simResults.reduce((s: number, r: SimResult) => s + r.budgetSpend, 0);
    const totalTriggers = simResults.reduce((s: number, r: SimResult) => s + r.triggerCount, 0);

    if (loading) return (
        <div className="dss-simulation">
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={16} style={{ animation: 'spinner 1s linear infinite', marginBottom: 6 }} />
                <div>Loading simulations…</div>
            </div>
        </div>
    );
    if (!simResults.length) return (
        <div className="dss-simulation">
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Play size={20} style={{ marginBottom: 6, opacity: 0.4 }} />
                <div>No simulation results yet</div>
            </div>
        </div>
    );

    return (
        <div className="dss-simulation">
            <div className="dss-sim-header">
                <div className="dss-sim-title">
                    <Play size={14} />
                    <h4>Simulation Results</h4>
                </div>
            </div>

            <div className="dss-sim-summary">
                <div className="dss-sim-stat">
                    <span className="dss-sim-stat-val">{totalTriggers}</span>
                    <span className="dss-sim-stat-label">Total Triggers</span>
                </div>
                <div className="dss-sim-stat">
                    <span className="dss-sim-stat-val">{formatINR(totalBudget)}</span>
                    <span className="dss-sim-stat-label">Total Budget Spent</span>
                </div>
            </div>

            <div className="dss-sim-rules">
                {simResults.map((r: SimResult) => (
                    <div key={r.ruleId} className="dss-sim-rule">
                        <div className="dss-sim-rule-top">
                            <span className="dss-sim-rule-name">{r.ruleName}</span>
                            <span className="dss-sim-triggers">{r.triggerCount}x triggered</span>
                        </div>
                        <div className="dss-sim-rule-metrics">
                            <div>
                                <span className="dss-tq-metric-label">SLA Adherence</span>
                                <span className={`dss-sim-sla ${r.avgSlaAdherence < 75 ? 'red' : ''}`}>{r.avgSlaAdherence}%</span>
                            </div>
                            <div>
                                <span className="dss-tq-metric-label">Budget</span>
                                <span>{formatINR(r.budgetSpend)}</span>
                            </div>
                        </div>
                        {r.estimatedReduction && (
                            <div className="dss-sim-rule-impact">
                                <TrendingDown size={12} /> {r.estimatedReduction}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ========== Main DSS Page ==========
export default function DSSPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { selectedDistrict, selectedWard } = useLocation();
    const { isAdminOrSuper, user, hasRole } = useAuth();
    const [activeTab, setActiveTab] = useState<DSSTab>('triggers');
    const [showSimulation, setShowSimulation] = useState(false);
    const [teamJeFilter, setTeamJeFilter] = useState<string>('all');

    const isJE = hasRole('JE');
    const isAE = hasRole('AE');

    const { data: triggersRaw = [], isLoading: loadingTriggers } = useQuery({
        queryKey: ['dss-triggers', selectedDistrict.id, selectedWard],
        queryFn: () => fetchDssTriggers(selectedDistrict.id, selectedWard),
    });
    const triggers = triggersRaw.map(apiTriggerToTriggeredRule);

    const { data: apiRules = [], isLoading: loadingRules } = useQuery({
        queryKey: ['dss-rules'],
        queryFn: () => fetchDssRules(),
        enabled: isAdminOrSuper,
    });

    const { data: teamMembers = [] } = useQuery<TeamMember[]>({
        queryKey: ['auth-team'],
        queryFn: () => fetchTeam(),
        enabled: isAE || isAdminOrSuper,
    });

    const invalidateDssData = () => {
        queryClient.invalidateQueries({ queryKey: ['dss-triggers', selectedDistrict.id] });
        queryClient.invalidateQueries({ queryKey: ['dss-rules'] });
        queryClient.invalidateQueries({ queryKey: ['sensors', selectedDistrict.id] });
        queryClient.invalidateQueries({ queryKey: ['dss-capacity', selectedDistrict.id] });
        queryClient.invalidateQueries({ queryKey: ['dss-simulations'] });
    };

    const allTabs: { key: DSSTab; label: string; icon: React.ReactNode; count?: number; adminOnly?: boolean }[] = [
        { key: 'triggers', label: 'Live Triggers', icon: <Zap size={15} />, count: triggers.filter(t => t.status !== 'completed').length },
        { key: 'rules', label: 'Rule Logic', icon: <Shield size={15} />, adminOnly: true },
        { key: 'sensor-health', label: 'Sensor Health', icon: <Activity size={15} />, adminOnly: true },
        { key: 'capacity', label: 'Capacity Monitor', icon: <BarChart3 size={15} />, adminOnly: true },
    ];
    const tabs = allTabs.filter(t => !t.adminOnly || isAdminOrSuper);

    // Summary stats from real data
    const activeCount = triggers.filter(t => t.status === 'awaiting_approval' || t.status === 'in_progress').length;
    const totalBudget = triggers.reduce((s, t) => s + t.budgetImpact, 0);
    // eslint-disable-next-line react-hooks/purity -- SLA breach count needs wall-clock comparison
    const slaBreaches = triggers.filter(t => t.slaDeadline && new Date(t.slaDeadline).getTime() < Date.now()).length;

    return (
        <div className="dss-page">
            {/* Page Header */}
            <div className="dss-page-header">
                <div className="dss-page-header-left">
                    <button className="dss-back-btn" onClick={() => navigate('/')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div className="dss-page-title-area">
                        <h2><Shield size={20} /> Decision Support System</h2>
                        <span className="dss-page-subtitle">
                            {selectedDistrict.name}, {selectedDistrict.state}
                            {selectedWard != null ? ` · Ward ${selectedWard}` : ' · All Wards'}
                            {' · '}Auto-populated from live sensor feeds
                        </span>
                    </div>
                    {(isJE || isAE) && user?.wardIds && user.wardIds.length > 0 && (
                        <span style={{
                            marginLeft: 12, padding: '3px 10px', borderRadius: 12,
                            fontSize: '11px', fontWeight: 600,
                            background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                        }}>
                            My Wards: {user.wardIds.length}
                        </span>
                    )}
                </div>
                <div className="dss-page-header-right">
                    <button className="dss-btn dss-btn-outline" onClick={invalidateDssData} title="Refresh data">
                        <RefreshCw size={14} /> Refresh
                    </button>
                    {isAdminOrSuper && (
                        <>
                            <button className={`dss-sim-toggle ${showSimulation ? 'active' : ''}`} onClick={() => setShowSimulation(!showSimulation)}>
                                <Play size={14} /> Simulate 30 Days
                            </button>
                            <button className="dss-btn dss-btn-outline"><Settings size={14} /> Governance</button>
                        </>
                    )}
                </div>
            </div>

            {/* Stats Bar */}
            <div className="dss-stats-bar">
                <div className="dss-stat-pill">
                    <Zap size={14} />
                    <span><strong>{activeCount}</strong> Active Triggers</span>
                </div>
                <div className="dss-stat-pill">
                    <Wallet size={14} />
                    <span>Budget Impact: <strong>{formatINR(totalBudget)}</strong></span>
                </div>
                {isAdminOrSuper && (
                    <div className="dss-stat-pill">
                        <Shield size={14} />
                        <span><strong>{apiRules.length}</strong> Rules Configured</span>
                    </div>
                )}
                {slaBreaches > 0 && (
                    <div className="dss-stat-pill urgent">
                        <AlertTriangle size={14} />
                        <span><strong>{slaBreaches}</strong> SLA Breaches</span>
                    </div>
                )}
            </div>

            {/* AE Team Panel */}
            {isAE && teamMembers.length > 0 && (
                <div style={{
                    display: 'flex', gap: 8, padding: '8px 16px',
                    background: 'var(--bg-secondary, #1e293b)', borderRadius: 8, margin: '0 0 12px',
                    flexWrap: 'wrap', alignItems: 'center',
                }}>
                    <Users size={14} style={{ color: '#818cf8' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginRight: 4 }}>My Team:</span>
                    <button
                        onClick={() => setTeamJeFilter('all')}
                        style={{
                            padding: '2px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
                            fontSize: 11, fontWeight: 600,
                            background: teamJeFilter === 'all' ? '#6366f1' : 'var(--bg-card, #334155)',
                            color: teamJeFilter === 'all' ? '#fff' : 'var(--text-secondary)',
                        }}
                    >All ({triggers.length})</button>
                    {teamMembers.filter(m => m.role === 'JE').map(m => {
                        const cnt = triggers.filter(t => {
                            const mWards = m.wards.map(w => w.wardName.toLowerCase());
                            return (t.affectedWards || []).some(aw => mWards.includes(aw.toLowerCase()));
                        }).length;
                        return (
                            <button key={m.id}
                                onClick={() => setTeamJeFilter(m.id)}
                                style={{
                                    padding: '2px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
                                    fontSize: 11, fontWeight: 600,
                                    background: teamJeFilter === m.id ? '#6366f1' : 'var(--bg-card, #334155)',
                                    color: teamJeFilter === m.id ? '#fff' : 'var(--text-secondary)',
                                }}
                            >{m.name.split(' ')[0]} ({cnt})</button>
                        );
                    })}
                </div>
            )}

            {/* Tab Bar */}
            <div className="dss-page-tabs">
                {tabs.map(tab => (
                    <button key={tab.key}
                        className={`dss-page-tab ${activeTab === tab.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.icon}
                        {tab.label}
                        {tab.count !== undefined && <span className="dss-tab-count">{tab.count}</span>}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="dss-page-content">
                <div className="dss-page-main">
                    {activeTab === 'triggers' && (() => {
                        let filteredTriggers = triggers;
                        // AE JE filter
                        if (isAE && teamJeFilter !== 'all') {
                            const je = teamMembers.find(m => m.id === teamJeFilter);
                            if (je) {
                                const jeWards = je.wards.map(w => w.wardName.toLowerCase());
                                filteredTriggers = triggers.filter(t =>
                                    (t.affectedWards || []).some(aw => jeWards.includes(aw.toLowerCase()))
                                );
                            }
                        }
                        return <TriggerQueue triggers={filteredTriggers} loading={loadingTriggers} isAdminOrSuper={isAdminOrSuper} onRefresh={invalidateDssData} />;
                    })()}
                    {activeTab === 'rules' && <RuleLogic apiRules={apiRules} loading={loadingRules} />}
                    {activeTab === 'sensor-health' && <SensorHealth districtId={selectedDistrict.id} />}
                    {activeTab === 'capacity' && <CapacityMonitor districtId={selectedDistrict.id} />}
                </div>

                {showSimulation && (
                    <div className="dss-page-sidebar">
                        <SimulationPanel />
                    </div>
                )}
            </div>
        </div>
    );
}
