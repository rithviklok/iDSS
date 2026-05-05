import { mockNotifications, mockAirsheds } from '../data/mockIssueData';
import { districts as staticDistricts } from '../data/geography';
import type { Sensor, Issue, IssueStatus, AppNotification, Hotspot, Airshed, SourceContribution, District, HeatmapPoint } from '../types';
import { isDummyDataMode } from './dummyMode';
import * as dummyBe from './dummyBackend';

/**
 * API Service
 * DSS API base URL for sensors, issues, etc.
 * Set VITE_DSS_API_BASE in .env (e.g. http://localhost:3000)
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.idss.internal/v1';
const DSS_API_BASE = import.meta.env.VITE_DSS_API_BASE || 'http://localhost:3000';
const BFF_FORECAST_BASE = import.meta.env.VITE_BFF_FORECAST_BASE || 'https://aqi-breathe-ui-bff-new-aqi-dev.apps.rosa.airquality.0ljt.p3.openshiftapps.com';

// Simulate network delay for mock endpoints
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch sensors from DSS backend API.
 * GET /sensors?districtId=<id>
 * Called when Sensors map layer is toggled ON.
 */
export async function fetchSensors(districtId: string, wardNumber?: number | null): Promise<Sensor[]> {
    if (isDummyDataMode()) return dummyBe.dummyFetchSensors(districtId, wardNumber);
    try {
        let url = `${DSS_API_BASE}/sensors?districtId=${encodeURIComponent(districtId)}`;
        if (wardNumber != null) url += `&wardNumber=${wardNumber}`;
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `DSS API error: ${res.status}`);
        }
        const data = await res.json();
        const sensors = data?.sensors ?? [];
        return sensors.map((s: { location?: { lat?: number; lng?: number; latitude?: number; longitude?: number }; [key: string]: unknown }) => {
            const loc = s.location as { lat?: number; lng?: number; latitude?: number; longitude?: number } | undefined;
            return {
                id: s.id ?? '',
                name: s.name ?? 'Unknown',
                location: {
                    lat: Number(loc?.lat ?? loc?.latitude ?? 0),
                    lng: Number(loc?.lng ?? loc?.longitude ?? 0),
                },
                pm25: Number(s.pm25 ?? 0),
                pm10: Number(s.pm10 ?? 0),
                zone: Number(s.zone ?? 0),
                ward: Number(s.ward ?? 0),
                lastUpdated: s.lastUpdated ?? new Date().toISOString(),
                isActive: s.isActive !== false,
                ...(s.co  != null && { co:  Number(s.co) }),
                ...(s.no2 != null && { no2: Number(s.no2) }),
                ...(s.so2 != null && { so2: Number(s.so2) }),
                ...(s.o3  != null && { o3:  Number(s.o3) }),
                ...(s.nh3 != null && { nh3: Number(s.nh3) }),
                ...(s.windSpeed != null && { windSpeed: Number(s.windSpeed) }),
                ...(s.rh != null && { rh: Number(s.rh) }),
                ...(s.temp != null && { temp: Number(s.temp) }),
            };
        });
    } catch (err) {
        console.warn('DSS sensors API failed:', err);
        return [];
    }
}

export interface FetchIssuesParams {
    districtId?: string;
    status?: string;
    ward?: number | string;
    startDate?: string;
    endDate?: string;
}

function mapIssue(i: Record<string, unknown>, districtId?: string): Issue {
    return {
        id: i.id ?? '',
        type: i.type ?? 'road_dust',
        title: i.title ?? 'Unknown',
        description: i.description ?? '',
        location: { lat: Number((i.location as { lat?: number })?.lat ?? 0), lng: Number((i.location as { lng?: number })?.lng ?? 0) },
        zone: Number(i.zone ?? 0),
        zone_id: i.zone_id != null ? Number(i.zone_id) : null,
        zoneName: (i.zoneName as string) || null,
        ward: Number(i.ward ?? 0),
        wardNames: Array.isArray(i.wardNames) ? i.wardNames as string[] : [],
        severity: i.severity ?? 'medium',
        status: i.status ?? 'new',
        pm25: Number(i.pm25 ?? 0),
        pm10: Number(i.pm10 ?? 0),
        createdAt: i.createdAt ?? new Date().toISOString(),
        updatedAt: i.updatedAt ?? new Date().toISOString(),
        districtId: i.districtId ?? districtId ?? '',
        ...(typeof i.assignedTo === 'string' ? { assignedTo: i.assignedTo } : {}),
        detectedBy: (i.detectedBy as string) || null,
        wind: (i.wind as string) || null,
        affectedWards: Array.isArray(i.affectedWards) ? i.affectedWards as string[] : [],
        sourceContributors: Array.isArray(i.sourceContributors) ? i.sourceContributors as Issue['sourceContributors'] : [],
    } as Issue;
}

/**
 * Fetch issues from DSS backend API.
 * GET /issues?districtId=&evaluateIssues=true
 * Caching is handled by TanStack Query.
 */
export async function fetchIssues(params?: FetchIssuesParams | string): Promise<Issue[]> {
    if (isDummyDataMode()) return dummyBe.dummyFetchIssues(params);
    try {
        const opts = typeof params === 'string' ? { districtId: params } : (params ?? {});
        const { districtId } = opts;

        const search = new URLSearchParams();
        search.set('evaluateIssues', 'true');
        if (districtId) search.set('districtId', districtId);
        const url = `${DSS_API_BASE}/issues?${search.toString()}`;
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error(`issues API ${res.status}`);
        const data = await res.json();
        const issues: Issue[] = (data?.issues ?? []).map((i: Record<string, unknown>) => mapIssue(i, districtId));

        return issues;
    } catch (err) {
        console.warn('fetchIssues API failed, returning empty:', err);
        return [];
    }
}

export async function fetchIssueById(id: string): Promise<Issue | undefined> {
    if (isDummyDataMode()) return dummyBe.dummyFetchIssueById(id);
    try {
        const res = await fetch(`${DSS_API_BASE}/issues/${encodeURIComponent(id)}`, { credentials: 'include' });
        if (!res.ok) return undefined;
        const data = await res.json();
        return mapIssue(data as Record<string, unknown>);
    } catch {
        return undefined;
    }
}

export interface LinkedSop {
    id: string;
    ruleName: string;
    severity: string;
    status: string;
    sop_type: string;
    department: string;
    pollutionSource: string | null;
    pollutionSourcePct: number | null;
    activatedAt: string;
    slaDeadline: string;
}

export async function fetchIssueSops(issueId: string): Promise<LinkedSop[]> {
    if (isDummyDataMode()) return dummyBe.dummyFetchIssueSops(issueId);
    try {
        const res = await fetch(`${DSS_API_BASE}/issues/${encodeURIComponent(issueId)}/sops`, {
            credentials: 'include',
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.sops ?? [];
    } catch {
        return [];
    }
}

export async function updateIssueStatus(id: string, status: IssueStatus): Promise<Issue> {
    if (isDummyDataMode()) return dummyBe.dummyUpdateIssueStatus(id, status);
    const res = await fetch(`${DSS_API_BASE}/issues/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || `Update issue status failed: ${res.status}`);
    }
    const data = await res.json();
    return data as Issue;
}

export async function fetchNotifications(): Promise<AppNotification[]> {
    if (isDummyDataMode()) return dummyBe.dummyFetchNotifications();
    await delay(150);
    return mockNotifications;
}

export async function fetchHotspots(districtId: string, lookbackDays?: number, mode?: string): Promise<Hotspot[]> {
    if (isDummyDataMode()) return dummyBe.dummyFetchHotspots(districtId);
    try {
        const params = new URLSearchParams({ districtId, method: 'statistical' });
        if (lookbackDays != null) params.set('lookbackDays', String(lookbackDays));
        if (mode) params.set('mode', mode);
        const res = await fetch(
            `${DSS_API_BASE}/map/hotspots?${params.toString()}`,
            { credentials: 'include' }
        );
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `DSS API error: ${res.status}`);
        }
        const data = await res.json();
        const list = data?.hotspots ?? [];
        return list.map((h: {
            id?: string; location?: { lat?: number; lng?: number };
            intensity?: number; label?: string; sensorId?: string;
            isHotspot?: boolean; conditionsMet?: number; maxConsecDays?: number;
            foe?: number;
            condition1?: boolean; condition2?: boolean; condition3?: boolean;
        }) => ({
            id: h.id ?? `hot-${Math.random().toString(36).slice(2)}`,
            location: { lat: h.location?.lat ?? 0, lng: h.location?.lng ?? 0 },
            intensity: h.intensity ?? 0,
            label: h.label ?? 'Hotspot',
            sensorId: h.sensorId,
            isHotspot: h.isHotspot ?? false,
            conditionsMet: h.conditionsMet ?? 0,
            maxConsecDays: h.maxConsecDays ?? 0,
            foe: h.foe ?? 0,
            condition1: h.condition1 ?? false,
            condition2: h.condition2 ?? false,
            condition3: h.condition3 ?? false,
        }));
    } catch (err) {
        console.warn('DSS hotspots API failed:', err);
        return [];
    }
}

export async function fetchAirsheds(districtId: string): Promise<Airshed[]> {
    if (isDummyDataMode()) return dummyBe.dummyFetchAirsheds(districtId);
    await delay(200);
    return mockAirsheds[districtId] || [];
}

/**
 * GET /map/source-contributions?districtId=
 * Fetches source apportionment (Dust, Traffic, etc.) for the district.
 * Falls back to mock data if the API fails (e.g. auth required).
 */
export async function fetchSourceContributions(districtId: string): Promise<SourceContribution[]> {
    if (isDummyDataMode()) return dummyBe.dummyFetchSourceContributions(districtId);
    try {
        const res = await fetch(
            `${DSS_API_BASE}/map/source-contributions?districtId=${encodeURIComponent(districtId)}`
        );
        if (!res.ok) {
            throw new Error(`source-contributions ${res.status}`);
        }
        const data = await res.json();
        const list = data?.contributions ?? [];
        return list.map((c: { id?: string; location?: { lat?: number; lng?: number }; sources?: { label?: string; percentage?: number; color?: string }[] }) => ({
            id: c.id ?? `src-${Math.random().toString(36).slice(2)}`,
            location: {
                lat: Number(c.location?.lat ?? 0),
                lng: Number(c.location?.lng ?? 0),
            },
            sources: (c.sources ?? []).map((s: { label?: string; percentage?: number; color?: string }) => ({
                label: s.label ?? 'Unknown',
                percentage: Number(s.percentage ?? 0),
                color: s.color ?? '#94a3b8',
            })),
        }));
    } catch (err) {
        console.warn('DSS source-contributions API failed, returning empty:', err);
        return [];
    }
}

// ==================== Heatmap API (PM2.5) ====================

export interface HeatmapResponse {
    points: HeatmapPoint[];
    bounds: { north: number; south: number; east: number; west: number };
    timestamp: string;
}

/** GET /map/pollution-grid — server-side IDW from unified pollution_readings */
export interface PollutionGridResponse {
    districtId: string;
    mode: string;
    generatedAt: string;
    sensorCount: number;
    sensors: Array<{
        sensorId: string;
        name: string;
        lat: number;
        lng: number;
        pm25: number;
        timestamp: string;
        source: string;
    }>;
    grid: {
        rows: number;
        columns: number;
        values: [number, number, number][];
        bounds: { north: number; south: number; east: number; west: number };
        resolutionDeg?: number;
        resolutionMetersApprox?: number;
    } | null;
    statistics: { min: number | null; max: number | null; mean: number | null; stdDev: number | null } | null;
    interpolation: string;
    degraded?: boolean;
    cacheHit?: boolean;
}

/**
 * GET /map/pollution-grid?districtId=&minSensors=2
 * Gridded PM2.5 from pollution_readings (Google, CAAQMS, Atmos, Airveda, Aurassure, etc.).
 * Returns null if not enough sensors (422) or request fails.
 */
export async function fetchPollutionGrid(districtId: string): Promise<PollutionGridResponse | null> {
    if (isDummyDataMode()) return dummyBe.dummyFetchPollutionGrid(districtId);
    try {
        const params = new URLSearchParams({
            districtId,
            minSensors: '2',
        });
        const res = await fetch(`${DSS_API_BASE}/map/pollution-grid?${params}`, {
            credentials: 'include',
        });
        if (res.status === 422) return null;
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error((err as { message?: string }).message || `pollution-grid ${res.status}`);
        }
        return res.json() as Promise<PollutionGridResponse>;
    } catch (e) {
        console.warn('fetchPollutionGrid failed:', e);
        return null;
    }
}

/**
 * GET /sensors/heatmap?districtId=&pollutant=pm25
 * Fetches PM2.5 heatmap points for a district from the DSS backend.
 * Falls back to deriving points from sensors if the API fails.
 */
export async function fetchHeatmap(districtId: string, pollutant: 'pm25' | 'pm10' = 'pm25'): Promise<HeatmapResponse> {
    if (isDummyDataMode()) return dummyBe.dummyFetchHeatmap(districtId, pollutant);
    try {
        const res = await fetch(
            `${DSS_API_BASE}/sensors/heatmap?districtId=${encodeURIComponent(districtId)}&pollutant=${pollutant}`,
            { credentials: 'include' },
        );
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `heatmap API ${res.status}`);
        }
        const data = await res.json();
        return {
            points: (data.points ?? []).map((p: { lat: number; lng: number; value: number }) => ({
                lat: Number(p.lat),
                lng: Number(p.lng),
                value: Number(p.value ?? 0),
            })),
            bounds: data.bounds ?? { north: 27, south: 26, east: 81, west: 80 },
            timestamp: data.timestamp ?? new Date().toISOString(),
        };
    } catch (err) {
        console.warn('fetchHeatmap API failed, deriving from sensors:', err);
        const sensors = await fetchSensors(districtId);
        const points: HeatmapPoint[] = sensors
            .filter(s => s.location.lat && s.location.lng)
            .map(s => ({ lat: s.location.lat, lng: s.location.lng, value: s.pm25 }));
        let north = -90, south = 90, east = -180, west = 180;
        for (const p of points) {
            if (p.lat > north) north = p.lat;
            if (p.lat < south) south = p.lat;
            if (p.lng > east) east = p.lng;
            if (p.lng < west) west = p.lng;
        }
        const padding = 0.02;
        return {
            points,
            bounds: {
                north: north > -90 ? north + padding : 27,
                south: south < 90 ? south - padding : 26,
                east: east > -180 ? east + padding : 81,
                west: west < 180 ? west - padding : 80,
            },
            timestamp: new Date().toISOString(),
        };
    }
}

// ==================== Geography API ====================

/**
 * GET /geography/states
 * Falls back to unique states from the static geography file.
 */
export async function fetchStates(): Promise<string[]> {
    if (isDummyDataMode()) return dummyBe.dummyFetchStates();
    try {
        const res = await fetch(`${DSS_API_BASE}/geography/states`);
        if (!res.ok) throw new Error(`geography/states ${res.status}`);
        const data = await res.json();
        return data.states ?? [];
    } catch (err) {
        console.warn('fetchStates API failed, using static data:', err);
        return [...new Set(staticDistricts.map((d) => d.state))].sort();
    }
}

/**
 * GET /geography/districts?state=<state>
 * Falls back to the static geography file filtered by state.
 */
export async function fetchDistrictsByState(state: string): Promise<District[]> {
    if (isDummyDataMode()) return dummyBe.dummyFetchDistrictsByState(state);
    try {
        const res = await fetch(`${DSS_API_BASE}/geography/districts?state=${encodeURIComponent(state)}`);
        if (!res.ok) throw new Error(`geography/districts ${res.status}`);
        const data = await res.json();
        return (data.districts ?? []) as District[];
    } catch (err) {
        console.warn('fetchDistrictsByState API failed, using static data:', err);
        return staticDistricts.filter((d) => d.state === state);
    }
}

/**
 * GET /geography/wards?districtId=
 */
export async function fetchWardsByDistrict(districtId: string): Promise<import('../types').Ward[]> {
    if (isDummyDataMode()) return dummyBe.dummyFetchWardsByDistrict(districtId);
    try {
        const res = await fetch(`${DSS_API_BASE}/geography/wards?districtId=${encodeURIComponent(districtId)}`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.wards ?? []) as import('../types').Ward[];
    } catch {
        return [];
    }
}

/**
 * GET /geography/districts/:id
 * Falls back to the static geography file. Ensures wards are populated (fetches from /wards if empty).
 */
export async function fetchDistrictById(id: string): Promise<District | null> {
    if (isDummyDataMode()) return dummyBe.dummyFetchDistrictById(id);
    try {
        const res = await fetch(`${DSS_API_BASE}/geography/districts/${encodeURIComponent(id)}`);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`geography/districts/:id ${res.status}`);
        const district = (await res.json()) as District;
        if (district && (!district.wards || district.wards.length === 0)) {
            const wards = await fetchWardsByDistrict(id);
            if (wards.length > 0) district.wards = wards;
        }
        return district;
    } catch (err) {
        console.warn('fetchDistrictById API failed, using static data:', err);
        return staticDistricts.find((d) => d.id === id) ?? null;
    }
}

// ==================== Dashboard Sidebar APIs ====================

export interface IssueStats {
    total: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
}

export async function fetchIssueStats(districtId: string): Promise<IssueStats | null> {
    if (isDummyDataMode()) return dummyBe.dummyFetchIssueStats(districtId);
    try {
        const res = await fetch(`${DSS_API_BASE}/issues/stats?districtId=${encodeURIComponent(districtId)}`, { credentials: 'include' });
        if (!res.ok) throw new Error(`issues/stats ${res.status}`);
        return await res.json();
    } catch {
        console.warn('fetchIssueStats API failed, returning null');
        return null;
    }
}

export interface DssTrigger {
    id: string;
    ruleId: string;
    ruleName: string;
    severity: string;
    status: string;
    ward: string | number;
    zoneName?: string | null;
    wardNames?: string[];
    wind?: string | null;
    detectedBy?: string | null;
    districtId: string;
    currentReading: string | number;
    slaDeadline: string;
    department: string;
    budgetImpact: number;
    activatedAt: string;
    suggestedInterventions: string[];
    sources?: string[];
    affectedWards?: string[];
    interventionStatuses?: Record<number, { status: string; modifiedText?: string }>;
    completion?: {
        photoUrl?: string;
        remarks?: string;
        lat?: number;
        lng?: number;
        completedAt?: string;
        completedBy?: string;
    };
}

export async function fetchDssTriggers(districtId: string, ward?: number | null): Promise<DssTrigger[]> {
    if (isDummyDataMode()) return dummyBe.dummyFetchDssTriggers(districtId, ward);
    try {
        let url = `${DSS_API_BASE}/dss/triggers?districtId=${encodeURIComponent(districtId)}`;
        if (ward != null) url += `&ward=${ward}`;
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error(`dss/triggers ${res.status}`);
        const data = await res.json();
        return data.triggers ?? [];
    } catch {
        return [];
    }
}

export async function fetchTriggerById(id: string): Promise<DssTrigger | null> {
    if (isDummyDataMode()) return dummyBe.dummyFetchTriggerById(id);
    try {
        const res = await fetch(`${DSS_API_BASE}/dss/triggers/${encodeURIComponent(id)}`, {
            credentials: 'include',
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

export interface TriggerLinkedIssue {
    id: string;
    type: string;
    title: string;
    status: string;
    severity: string;
}

export async function fetchTriggerIssue(triggerId: string): Promise<TriggerLinkedIssue | null> {
    if (isDummyDataMode()) return dummyBe.dummyFetchTriggerIssue(triggerId);
    try {
        const res = await fetch(`${DSS_API_BASE}/dss/triggers/${encodeURIComponent(triggerId)}/issue`, {
            credentials: 'include',
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.issue ?? null;
    } catch {
        return null;
    }
}

export async function updateInterventionStatus(
    triggerId: string,
    index: number,
    status: 'completed' | 'rejected' | 'modified',
    opts?: {
        modifiedText?: string;
        remarks?: string;
        beforePhoto?: File;
        afterPhoto?: File;
        lat?: number;
        lng?: number;
    }
): Promise<{ interventionStatuses: Record<number, { status: string; modifiedText?: string; beforePhotoUrl?: string; afterPhotoUrl?: string; remarks?: string }> }> {
    if (isDummyDataMode()) return dummyBe.dummyUpdateInterventionStatus(triggerId, index, status, opts);
    const form = new FormData();
    form.append('status', status);
    if (opts?.modifiedText) form.append('modifiedText', opts.modifiedText);
    if (opts?.remarks) form.append('remarks', opts.remarks);
    if (opts?.beforePhoto) form.append('before_photo', opts.beforePhoto);
    if (opts?.afterPhoto) form.append('after_photo', opts.afterPhoto);
    if (opts?.lat != null) form.append('lat', String(opts.lat));
    if (opts?.lng != null) form.append('lng', String(opts.lng));

    const res = await fetch(
        `${DSS_API_BASE}/dss/triggers/${encodeURIComponent(triggerId)}/interventions/${index}/status`,
        {
            method: 'POST',
            credentials: 'include',
            body: form,
        }
    );
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || `Update intervention failed: ${res.status}`);
    }
    return res.json();
}

export async function completeSop(
    triggerId: string,
    data: { photo?: File; remarks?: string; lat?: number; lng?: number }
): Promise<{ id: string; status: string }> {
    if (isDummyDataMode()) return dummyBe.dummyCompleteSop(triggerId, data);
    const form = new FormData();
    if (data.photo) form.append('photo', data.photo);
    if (data.remarks != null) form.append('remarks', data.remarks);
    if (data.lat != null) form.append('lat', String(data.lat));
    if (data.lng != null) form.append('lng', String(data.lng));

    const res = await fetch(`${DSS_API_BASE}/dss/triggers/${encodeURIComponent(triggerId)}/complete`, {
        method: 'POST',
        credentials: 'include',
        body: form,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || `Complete SOP failed: ${res.status}`);
    }
    return res.json();
}

export interface DssRule {
    id: string;
    name: string;
    description: string;
    status: string;
    conditions: unknown[];
    interventions: { id: string; name: string; estimatedCost: number; budgetCode: string; fundSource: string }[];
    workflowChain: string[];
    department: string;
    slaHours: number;
    approvalMode: 'auto' | 'manual';
    triggerCount: number;
    impactMetrics: { estimatedPollutantReduction: string; affectedPopulation: number; healthBenefit: string };
}

export async function fetchDssRules(): Promise<DssRule[]> {
    if (isDummyDataMode()) return (await dummyBe.dummyFetchDssRules()) as DssRule[];
    try {
        const res = await fetch(`${DSS_API_BASE}/dss/rules`, { credentials: 'include' });
        if (!res.ok) throw new Error(`dss/rules ${res.status}`);
        const data = await res.json();
        return data.rules ?? [];
    } catch {
        return [];
    }
}

export interface ForecastPoint {
    timestamp: string;
    pm25: number;
    aqi: number;
    category: string;
}

export interface ForecastStation {
    sensorId: string;
    lat: number;
    lng: number;
    avgPm25: number;
    peakPm25: number;
    trend: string;
    forecasts: { timestamp: string; pm25: number }[];
}

export interface ForecastResult {
    forecast: ForecastPoint[];
    stations: ForecastStation[];
    model: string;
    generatedAt: string;
}

export async function fetchForecast(districtId: string, hours = 72): Promise<ForecastResult> {
    if (isDummyDataMode()) return dummyBe.dummyFetchForecast(districtId, hours);
    try {
        const res = await fetch(`${DSS_API_BASE}/map/forecast?districtId=${encodeURIComponent(districtId)}&hours=${hours}`);
        if (!res.ok) throw new Error(`map/forecast ${res.status}`);
        const data = await res.json();
        return {
            forecast: data.forecast ?? [],
            stations: data.stations ?? [],
            model: data.model ?? 'Unknown',
            generatedAt: data.generatedAt ?? new Date().toISOString(),
        };
    } catch {
        return { forecast: [], stations: [], model: 'Unavailable', generatedAt: new Date().toISOString() };
    }
}

export { API_BASE };

// ==================== Auth Team ====================

export interface TeamMember {
    id: string;
    name: string;
    username: string;
    role: string;
    wardIds: number[];
    wards: { wardName: string; wardNumber: number }[];
    supervisorId: string | null;
}

export async function fetchTeam(): Promise<TeamMember[]> {
    if (isDummyDataMode()) return dummyBe.dummyFetchTeam();
    try {
        const res = await fetch(`${DSS_API_BASE}/auth/team`, { credentials: 'include' });
        if (!res.ok) return [];
        const data = await res.json();
        return data.team ?? [];
    } catch {
        return [];
    }
}

// ==================== DSS Stats (dashboard sidebar) ====================

export interface DssStats {
    openIssuesCount: number;
    criticalIssuesCount: number;
    pendingSopsCount: number;
}

/**
 * GET /dss/stats?districtId=&ward=
 * Returns dashboard counts (open issues, critical issues, pending SOPs) from live evaluation.
 * Returns null when API is unavailable.
 */
export async function fetchDssStats(districtId: string, ward?: number | null): Promise<DssStats | null> {
    if (isDummyDataMode()) return dummyBe.dummyFetchDssStats(districtId, ward);
    try {
        let url = `${DSS_API_BASE}/dss/stats?districtId=${encodeURIComponent(districtId)}`;
        if (ward != null) url += `&ward=${ward}`;
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error(`dss/stats ${res.status}`);
        const data = await res.json();
        return {
            openIssuesCount: Number(data.openIssuesCount ?? 0),
            criticalIssuesCount: Number(data.criticalIssuesCount ?? 0),
            pendingSopsCount: Number(data.pendingSopsCount ?? 0),
        };
    } catch (err) {
        console.warn('fetchDssStats API failed:', err);
        return null;
    }
}

// ==================== BFF Forecast Sensor API ====================

export interface BffSourceType {
    label: string;
    percentage: number;
}

export interface BffForecastDataPoint {
    timestamp: string;
    aqi: number;
    pm25: number;
    confidence: { lower: number; upper: number };
}

export interface BffForecastResponse {
    sensorId: string;
    dataPoints: BffForecastDataPoint[];
    source_types?: BffSourceType[];
}

export interface SensorPlotReading {
    sensorId: string;
    sensorName: string;
    timestamp: string;
    source?: string | null;
    pm25: number | null;
    windSpeed: number | null;
    windDir: number | null;
}

/**
 * GET /api/v1/forecast/sensor/{sensorId}
 * Calls BFF Forecast Sensor API for forecast data + optional source_types.
 * Returns null when API is unavailable or sensor not found.
 */
export async function fetchSensorForecast(sensorId: string): Promise<BffForecastResponse | null> {
    if (isDummyDataMode()) return dummyBe.dummyFetchSensorForecast(sensorId);
    try {
        const res = await fetch(`${BFF_FORECAST_BASE}/api/v1/forecast/sensor/${encodeURIComponent(sensorId)}`);
        if (!res.ok) throw new Error(`BFF forecast ${res.status}`);
        const json = await res.json();
        if (!json?.success || !json?.data) return null;
        const data = json.data;
        return {
            sensorId: data.sensorId ?? sensorId,
            dataPoints: Array.isArray(data.dataPoints) ? data.dataPoints : [],
            ...(Array.isArray(data.source_types) && data.source_types.length > 0
                ? { source_types: data.source_types }
                : {}),
        };
    } catch (err) {
        console.warn('BFF fetchSensorForecast failed:', err);
        return null;
    }
}

export async function fetchSensorPlotReadings(sensorId: string, hours = 24): Promise<SensorPlotReading[]> {
    if (isDummyDataMode()) return dummyBe.dummyFetchSensorPlotReadings(sensorId, hours);
    try {
        const end = new Date();
        const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
        const params = new URLSearchParams({
            sensorId,
            start_date: start.toISOString(),
            end_date: end.toISOString(),
            limit: '1000',
        });

        const res = await fetch(`${DSS_API_BASE}/sensors/readings?${params.toString()}`, {
            credentials: 'include',
        });
        if (!res.ok) throw new Error(`sensor readings ${res.status}`);

        const data = await res.json();
        const rows = Array.isArray(data?.readings) ? data.readings : [];
        const normalizedRows: SensorPlotReading[] = rows
            .map((row: Record<string, unknown>) => ({
                sensorId,
                sensorName: typeof row?.sensorName === 'string' ? row.sensorName : sensorId,
                timestamp: typeof row?.timestamp === 'string' ? row.timestamp : '',
                source: typeof row?.source === 'string' ? row.source : null,
                pm25: row?.pm25 != null ? Number(row.pm25) : null,
                windSpeed: row?.windSpeed != null ? Number(row.windSpeed) : null,
                windDir: row?.windDir != null ? Number(row.windDir) : null,
            }))
            .filter((row: SensorPlotReading) => row.timestamp)
            .sort((left: SensorPlotReading, right: SensorPlotReading) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());

        const rowsWithPm = normalizedRows.filter((row: SensorPlotReading) => row.pm25 != null && Number.isFinite(row.pm25));
        const rowsWithWind = normalizedRows.filter((row: SensorPlotReading) =>
            row.windSpeed != null &&
            row.windDir != null &&
            Number.isFinite(row.windSpeed) &&
            Number.isFinite(row.windDir),
        );
        const maxWindGapMs = 90 * 60 * 1000;

        const combinedRows = rowsWithPm.map((row: SensorPlotReading) => {
            if (row.windSpeed != null && row.windDir != null) return row;

            const baseTime = new Date(row.timestamp).getTime();
            let nearestWind: SensorPlotReading | null = null;
            let nearestGap = Number.POSITIVE_INFINITY;

            for (const windRow of rowsWithWind) {
                const gap = Math.abs(new Date(windRow.timestamp).getTime() - baseTime);
                if (gap > maxWindGapMs || gap >= nearestGap) continue;
                nearestWind = windRow;
                nearestGap = gap;
            }

            if (!nearestWind) return row;

            return {
                ...row,
                windSpeed: row.windSpeed ?? nearestWind.windSpeed,
                windDir: row.windDir ?? nearestWind.windDir,
                source: row.source || nearestWind.source,
            };
        });

        const passthroughWindOnlyRows = rowsWithWind.filter((windRow: SensorPlotReading) => {
            const windTime = new Date(windRow.timestamp).getTime();
            return !combinedRows.some((row: SensorPlotReading) => {
                const rowTime = new Date(row.timestamp).getTime();
                return Math.abs(rowTime - windTime) <= maxWindGapMs;
            });
        });

        return [...combinedRows, ...passthroughWindOnlyRows]
            .filter((row) => row.pm25 != null || row.windSpeed != null || row.windDir != null)
            .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
    } catch (err) {
        console.warn('fetchSensorPlotReadings failed:', err);
        return [];
    }
}

// ==================== Sensor Sources + SOP Evaluation ====================

export interface SopTriggerResult {
    deviceId: string;
    ruleId: string;
    ruleName: string;
    severity: string;
    sopType: string;
    leadingSource: string;
    issueType: string;
    intervention: {
        sensor_issue_type: string;
        intervention_description: string;
        estimated_cost_min: number;
        estimated_cost_max: number;
        sla_hours: number;
        primary_department: string;
    };
    pm25Category: string;
}

export interface SensorSourcesResponse {
    sensorId: string;
    hasSources: boolean;
    sources: BffSourceType[];
    sourceOrigin?: 'dhsa_api' | 'dhsa_proxied' | 'bff_api' | 'heuristic';
    proxiedFrom?: string;
    proxiedFromName?: string;
    proxyDistanceKm?: number;
    sopResult: { sopTriggered: boolean; reason?: string; trigger?: SopTriggerResult; triggerId?: string; note?: string } | null;
    affectedWards?: string[];
    message?: string;
    timestamp?: string;
}

/**
 * GET /sensors/:id/sources?districtId=&pm25=
 * Fetches pollution sources from BFF via DSS backend and runs SOP evaluation.
 */
export async function fetchSensorSources(
    sensorId: string,
    districtId?: string,
    pm25?: number,
): Promise<SensorSourcesResponse> {
    if (isDummyDataMode()) return dummyBe.dummyFetchSensorSources(sensorId, districtId, pm25);
    try {
        const params = new URLSearchParams();
        if (districtId) params.set('districtId', districtId);
        if (pm25 != null) params.set('pm25', String(pm25));
        const res = await fetch(
            `${DSS_API_BASE}/sensors/${encodeURIComponent(sensorId)}/sources?${params}`,
            { credentials: 'include' },
        );
        if (!res.ok) throw new Error(`sensor sources ${res.status}`);
        return await res.json();
    } catch (err) {
        console.warn('fetchSensorSources failed:', err);
        return {
            sensorId,
            hasSources: false,
            sources: [],
            sopResult: null,
            message: 'Pollution source data not available for this sensor.',
        };
    }
}

// ==================== Source Pinpointing ====================

export interface WardContribution {
    wardId: string;
    wardName: string;
    gridCount: number;
    rawPercentage: number;
    percentage: number;
}

export interface SourcePinpointingSensorResult {
    districtId: string;
    computedAt: string;
    contributionHourStart: string;
    contributionHourEnd: string;
    sensor: {
        sensorId: string;
        sensorName: string;
        deviceType: string | null;
        lat: number;
        lng: number;
        latestPm25: number;
        latestWindSpeed: number | null;
        latestWindDir: number | null;
        latestObservationTime: string | null;
        outsideSourcesPct: number;
        wardContributions: WardContribution[];
    };
}

/**
 * GET /map/source-pinpointing/sensors/:sensorId?districtId=&limit=
 * Fetches ward-level pollution source contributions for a sensor.
 * Requires authentication.
 */
export async function fetchSourcePinpointing(
    sensorId: string,
    districtId: string,
    limit = 5,
): Promise<SourcePinpointingSensorResult | null> {
    if (isDummyDataMode()) return dummyBe.dummyFetchSourcePinpointing(sensorId, districtId, limit);
    try {
        const params = new URLSearchParams({ districtId, limit: String(limit) });
        const res = await fetch(
            `${DSS_API_BASE}/map/source-pinpointing/sensors/${encodeURIComponent(sensorId)}?${params}`,
            { credentials: 'include' },
        );
        if (!res.ok) return null;
        return await res.json();
    } catch (err) {
        console.warn('fetchSourcePinpointing failed:', err);
        return null;
    }
}
