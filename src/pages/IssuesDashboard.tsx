import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, AlertTriangle, Zap, CheckCircle, ArrowUpRight, ChevronRight, Calendar, Filter, LayoutList, ChartColumn } from 'lucide-react';
import ComparativeAnalyticsPanel from '../components/issues/ComparativeAnalyticsPanel';
import { useLocation } from '../contexts/LocationContext';
import { fetchIssues, fetchWardsByDistrict } from '../services/api';
import { getIssueIcon } from '../data/mockIssueData';
import { districts as staticDistricts } from '../data/geography';
import type { Issue, IssueStatus } from '../types';

function getDateRangeFromQuickFilter(quickFilter: QuickFilter): { startDate?: string; endDate?: string } {
    const now = new Date();
    const toStart = (d: Date) => d.toISOString().slice(0, 10);
    const toEnd = (d: Date) => {
        const end = new Date(d);
        end.setHours(23, 59, 59, 999);
        return end.toISOString();
    };
    switch (quickFilter) {
        case 'last7': {
            const start = new Date(now);
            start.setDate(start.getDate() - 7);
            return { startDate: toStart(start), endDate: toEnd(now) };
        }
        case 'last30': {
            const start = new Date(now);
            start.setDate(start.getDate() - 30);
            return { startDate: toStart(start), endDate: toEnd(now) };
        }
        case 'this_month': {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            return { startDate: toStart(start), endDate: toEnd(now) };
        }
        case 'last_month': {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            return { startDate: toStart(start), endDate: toEnd(end) };
        }
        case 'this_year': {
            const start = new Date(now.getFullYear(), 0, 1);
            return { startDate: toStart(start), endDate: toEnd(now) };
        }
        default:
            return {};
    }
}

function getPmBadgeClass(pm25: number): string {
    if (pm25 > 250) return 'severe';
    if (pm25 > 120) return 'very-poor';
    if (pm25 > 90) return 'poor';
    if (pm25 > 60) return 'moderate';
    if (pm25 > 30) return 'satisfactory';
    return 'good';
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
}

type FilterTab = 'all' | IssueStatus;
type QuickFilter = 'last7' | 'last30' | 'this_month' | 'last_month' | 'this_year' | 'all_time';
type IssuesMainTab = 'issues' | 'analytics';

export default function IssuesDashboard() {
    const { selectedDistrict, allStates, allDistricts, isLoadingGeography } = useLocation();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

    // Structured filter state (same data source as Dashboard homepage)
    const [quickFilter, setQuickFilter] = useState<QuickFilter>('all_time');
    const [filterState, setFilterState] = useState(selectedDistrict.state);
    const [filterDistrictId, setFilterDistrictId] = useState(selectedDistrict.id);
    const [filterWard, setFilterWard] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [issuesMainTab, setIssuesMainTab] = useState<IssuesMainTab>('issues');

    // Districts for selected state; wards for selected district (from LocationContext, same as homepage)
    const districtsForState = useMemo(() => {
        const fromContext = allDistricts.filter(d => d.state === filterState);
        if (fromContext.length > 0) return fromContext;
        return staticDistricts.filter(d => d.state === filterState);
    }, [allDistricts, filterState]);
    const currentFilterDistrict = useMemo(
        () => allDistricts.find(d => d.id === filterDistrictId) ?? selectedDistrict,
        [allDistricts, filterDistrictId, selectedDistrict]
    );
    const { data: wardsFromApi = [] } = useQuery({
        queryKey: ['wards', filterDistrictId],
        queryFn: () => fetchWardsByDistrict(filterDistrictId),
        enabled: !!filterDistrictId,
    });
    const wardList = wardsFromApi.length > 0
        ? wardsFromApi
        : currentFilterDistrict.wards ?? [];

    const { data: allDistrictIssues = [], isLoading: loading } = useQuery({
        queryKey: ['issues', filterDistrictId],
        queryFn: () => fetchIssues({ districtId: filterDistrictId }),
    });

    const totalCounts = useMemo(() => ({
        new: allDistrictIssues.filter((i: Issue) => i.status === 'new').length,
        active: allDistrictIssues.filter((i: Issue) => i.status === 'active').length,
        done: allDistrictIssues.filter((i: Issue) => i.status === 'done').length,
        escalated: allDistrictIssues.filter((i: Issue) => i.status === 'escalated').length,
    }), [allDistrictIssues]);

    // Sync filter dropdowns when context district changes (e.g. from homepage)
    useEffect(() => {
        /* eslint-disable react-hooks/set-state-in-effect -- reset filters when district changes */
        setFilterState(selectedDistrict.state);
        setFilterDistrictId(selectedDistrict.id);
        setFilterWard('all');
        setFilterStatus('all');
        setActiveFilter('all');
        setQuickFilter('all_time');
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [selectedDistrict.id, selectedDistrict.state]);

    // All filtering is client-side — avoids redundant API calls.
    const filteredIssues = useMemo(() => {
        let result = allDistrictIssues;

        if (filterStatus !== 'all') {
            result = result.filter(i => i.status === filterStatus);
        }
        if (filterWard !== 'all') {
            result = result.filter(i => String(i.ward) === String(filterWard));
        }

        const { startDate, endDate } = getDateRangeFromQuickFilter(quickFilter);
        if (startDate) {
            result = result.filter(i => new Date(i.createdAt) >= new Date(startDate));
        }
        if (endDate) {
            result = result.filter(i => new Date(i.createdAt) <= new Date(endDate));
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(i =>
                i.title.toLowerCase().includes(q) ||
                i.description.toLowerCase().includes(q) ||
                i.id.toLowerCase().includes(q) ||
                `zone ${i.zone}`.includes(q) ||
                `ward ${i.ward}`.includes(q)
            );
        }

        return result;
    }, [allDistrictIssues, filterStatus, filterWard, quickFilter, searchQuery]);

    const filterTabs: { key: FilterTab; label: string }[] = [
        // { key: 'all', label: 'All' },
        // { key: 'new', label: 'New' },
        { key: 'active', label: 'Active' },
        { key: 'escalated', label: 'Escalated' },
        { key: 'done', label: 'Completed' },
        // { key: 'rejected', label: 'Rejected' },
    ];

    const quickFilters: { key: QuickFilter; label: string }[] = [
        { key: 'last7', label: 'Last 7 Days' },
        { key: 'last30', label: 'Last 30 Days' },
        { key: 'this_month', label: 'This Month' },
        { key: 'last_month', label: 'Last Month' },
        { key: 'this_year', label: 'This Year' },
        { key: 'all_time', label: 'All Time' },
    ];

    const awaitingAction = totalCounts.new;
    const totalIssues = totalCounts.new + totalCounts.active + totalCounts.done + totalCounts.escalated;

    return (
        <div className="issues-page">
            {/* Header */}
            <div className="issues-header">
                <h1>Issues Dashboard</h1>
                <p className="subtitle">
                    {totalIssues} total issues • {awaitingAction} awaiting action
                </p>
            </div>

            {/* ===== Structured Filter Bar ===== */}
            <div className="filter-bar">
                {/* Row 1: Quick Filters */}
                <div className="filter-bar-section">
                    <div className="filter-bar-label">
                        <Calendar size={14} />
                        Quick Filters:
                    </div>
                    {quickFilters.map(qf => (
                        <button
                            key={qf.key}
                            className={`quick-filter-btn ${quickFilter === qf.key ? 'active' : ''}`}
                            onClick={() => setQuickFilter(qf.key)}
                        >
                            {qf.label}
                        </button>
                    ))}
                </div>

                {/* Primary view: issue list vs comparative analytics */}
                <div className="issues-main-tab-row">
                    <button
                        type="button"
                        className={`issues-main-tab ${issuesMainTab === 'issues' ? 'active' : ''}`}
                        onClick={() => setIssuesMainTab('issues')}
                    >
                        <LayoutList size={15} />
                        Issue list
                    </button>
                    <button
                        type="button"
                        className={`issues-main-tab ${issuesMainTab === 'analytics' ? 'active' : ''}`}
                        onClick={() => setIssuesMainTab('analytics')}
                    >
                        <ChartColumn size={15} />
                        Comparative Analytics
                    </button>
                </div>

                {/* Row 2: Geography + Status Dropdowns */}
                <div className="filter-bar-section">
                    <div className="filter-dropdown-group">
                        <span className="fd-label">State</span>
                        <select
                            className="filter-dropdown"
                            value={filterState}
                            onChange={(e) => {
                                const state = e.target.value;
                                setFilterState(state);
                                const firstDist = allDistricts.find(d => d.state === state);
                                if (firstDist) {
                                    setFilterDistrictId(firstDist.id);
                                }
                                setFilterWard('all');
                            }}
                            disabled={isLoadingGeography && allStates.length === 0}
                        >
                            {isLoadingGeography && allStates.length === 0 ? (
                                <option>Loading...</option>
                            ) : (
                                (allStates.length > 0 ? allStates : [...new Set(staticDistricts.map(d => d.state))]).map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))
                            )}
                        </select>
                    </div>

                    <div className="filter-dropdown-group">
                        <span className="fd-label">District</span>
                        <select
                            className="filter-dropdown"
                            value={filterDistrictId}
                            onChange={(e) => {
                                setFilterDistrictId(e.target.value);
                                setFilterWard('all');
                            }}
                            disabled={isLoadingGeography && districtsForState.length === 0}
                        >
                            {isLoadingGeography && districtsForState.length === 0 ? (
                                <option>Loading...</option>
                            ) : (
                                districtsForState.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))
                            )}
                        </select>
                    </div>

                    <div className="filter-dropdown-group">
                        <span className="fd-label">Ward</span>
                        <select
                            className="filter-dropdown"
                            value={filterWard}
                            onChange={(e) => setFilterWard(e.target.value)}
                        >
                            <option value="all">All Wards</option>
                            {wardList.map(w => (
                                <option key={w.id} value={w.number}>{w.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-dropdown-group">
                        <span className="fd-label">Status</span>
                        <select
                            className="filter-dropdown"
                            value={filterStatus}
                            onChange={(e) => {
                                const v = e.target.value;
                                setFilterStatus(v);
                                setActiveFilter(v === 'all' ? 'all' : v as FilterTab);
                            }}
                        >
                            <option value="all">All Status</option>
                            <option value="new">New</option>
                            <option value="active">Active</option>
                            <option value="done">Done</option>
                            <option value="escalated">Escalated</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>

                    <button className="filter-apply-btn" style={{ marginTop: '14px' }} onClick={() => { /* filters are reactive */ }}>
                        <Filter size={14} />
                        Apply
                    </button>
                </div>
            </div>

            {issuesMainTab === 'analytics' && (
                <ComparativeAnalyticsPanel issues={filteredIssues} />
            )}

            {/* Status Summary Cards */}
            {issuesMainTab === 'issues' && (
            <div className="status-summary">
                <div className="status-card new-card" onClick={() => { setActiveFilter('new'); setFilterStatus('new'); }} style={{ cursor: 'pointer' }}>
                    <div className="icon"><AlertTriangle size={18} /></div>
                    <div>
                        <div className="label">New</div>
                        <div className="count">{totalCounts.new}</div>
                    </div>
                </div>
                <div className="status-card active-card" onClick={() => { setActiveFilter('active'); setFilterStatus('active'); }} style={{ cursor: 'pointer' }}>
                    <div className="icon"><Zap size={18} /></div>
                    <div>
                        <div className="label">Active</div>
                        <div className="count">{totalCounts.active}</div>
                    </div>
                </div>
                <div className="status-card done-card" onClick={() => { setActiveFilter('done'); setFilterStatus('done'); }} style={{ cursor: 'pointer' }}>
                    <div className="icon"><CheckCircle size={18} /></div>
                    <div>
                        <div className="label">Done</div>
                        <div className="count">{totalCounts.done}</div>
                    </div>
                </div>
                <div className="status-card escalated-card" onClick={() => { setActiveFilter('escalated'); setFilterStatus('escalated'); }} style={{ cursor: 'pointer' }}>
                    <div className="icon"><ArrowUpRight size={18} /></div>
                    <div>
                        <div className="label">Escalated</div>
                        <div className="count">{totalCounts.escalated}</div>
                    </div>
                </div>
            </div>
            )}

            {/* Search */}
            {issuesMainTab === 'issues' && (
            <div className="issues-search">
                <Search size={18} color="var(--text-muted)" />
                <input
                    type="text"
                    placeholder="Search by type, ID, location, zone, ward..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            )}

            {/* Filter Tabs */}
            {issuesMainTab === 'issues' && (
            <div className="filter-tabs">
                {filterTabs.map(tab => (
                    <button
                        key={tab.key}
                        className={`filter-tab ${activeFilter === tab.key ? 'active' : ''}`}
                        onClick={() => {
                            setActiveFilter(tab.key);
                            setFilterStatus(tab.key === 'all' ? 'all' : tab.key);
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            )}

            {/* Issue Cards */}
            {issuesMainTab === 'issues' && (loading ? (
                <div className="empty-state">
                    <div className="icon">⏳</div>
                    <h3>Loading issues...</h3>
                </div>
            ) : filteredIssues.length === 0 ? (
                <div className="empty-state">
                    <div className="icon">📋</div>
                    <h3>No issues found</h3>
                    <p>Try adjusting your search or filter criteria.</p>
                </div>
            ) : (
                filteredIssues.map(issue => (
                    <div
                        key={issue.id}
                        className="issue-card"
                        onClick={() => navigate(`/issues/${issue.id}`)}
                    >
                        <div className="issue-card-icon">{getIssueIcon(issue.type)}</div>
                        <div className="issue-card-body">
                            <div className="issue-card-title">{issue.title}</div>
                            <div className="issue-card-desc">
                                PM2.5 {issue.pm25} µg/m³ exceeds threshold ({getPmBadgeClass(issue.pm25) === 'good' ? 'Good' : getPmBadgeClass(issue.pm25) === 'satisfactory' ? 'Satisfactory' : getPmBadgeClass(issue.pm25) === 'moderate' ? 'Moderate' : getPmBadgeClass(issue.pm25) === 'poor' ? 'Poor' : getPmBadgeClass(issue.pm25) === 'very-poor' ? 'Very Poor' : 'Severe'})
                            </div>
                            {issue.sourceContributors && issue.sourceContributors.length > 0 && (
                                <div className="issue-source-chips">
                                    {issue.sourceContributors
                                        .slice()
                                        .sort((a, b) => b.percentage - a.percentage)
                                        .map(sc => (
                                            <span key={sc.source} className="issue-source-chip">
                                                {sc.source.replace(/_/g, ' ')}
                                                <span className="issue-source-pct">{Math.round(sc.percentage)}%</span>
                                            </span>
                                        ))
                                    }
                                </div>
                            )}
                            <div className="issue-card-meta">
                                <span>📍 Zone {issue.zone} • Ward {issue.ward}</span>
                                <span className={`issue-severity ${issue.severity}`}>{issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}</span>
                                <span>⏱ {timeAgo(issue.createdAt)}</span>
                            </div>
                            <div className="issue-card-meta" style={{ marginTop: '4px' }}>
                                <span className={`pm-badge ${getPmBadgeClass(issue.pm25)}`}>
                                    PM2.5: {issue.pm25} µg/m³
                                </span>
                                {issue.detectedBy && <span className="confidence-tag">{issue.detectedBy}</span>}
                            </div>
                        </div>
                        <div className="issue-card-right">
                            <span className={`status-badge ${issue.status}`}>
                                {issue.status === 'done' ? 'Completed' : issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
                            </span>
                            <ChevronRight size={18} className="issue-card-arrow" />
                        </div>
                    </div>
                ))
            ))}
        </div>
    );
}
