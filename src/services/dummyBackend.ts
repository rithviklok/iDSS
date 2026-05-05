import type { Issue, IssueStatus, Sensor, District, AppNotification, Hotspot, Airshed, SourceContribution, Ward } from '../types';
import { districts as staticDistricts } from '../data/geography';
import { getSensorsByDistrict } from '../data/mockSensorData';
import {
    mockIssues,
    mockNotifications,
    mockHotspots,
    mockAirsheds,
    mockSourceContributions,
    getIssuesByDistrict,
} from '../data/mockIssueData';
import { mockDssRules, mockTriggeredRules } from '../data/mockDssData';
import type { TriggeredRule } from '../types/dss';

/** Mirrors `FetchIssuesParams` in api.ts */
export interface DummyFetchIssuesParams {
    districtId?: string;
    status?: string;
    ward?: number | string;
    startDate?: string;
    endDate?: string;
}

const DUMMY_DISTRICT = 'uttar-pradesh-lucknow';

function delay(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function wardFromLabel(ward: string): number {
    const m = ward.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
}

/** Same shape as `DssTrigger` returned by the real API */
function triggeredToApi(t: TriggeredRule, districtId: string) {
    const wn = wardFromLabel(t.ward);
    return {
        id: t.id,
        ruleId: t.ruleId,
        ruleName: t.ruleName,
        severity: t.severity,
        status: t.status,
        ward: wn || t.ward,
        zoneName: null,
        wardNames: [t.ward],
        wind: t.sources?.[0] ?? null,
        detectedBy: null,
        districtId,
        currentReading: t.currentReading,
        slaDeadline: t.slaDeadline,
        department: t.department,
        budgetImpact: t.budgetImpact,
        activatedAt: t.activatedAt,
        suggestedInterventions: t.suggestedInterventions,
        sources: t.sources,
        affectedWards: [],
        interventionStatuses: {},
    };
}

const dummyTriggersLucknow = mockTriggeredRules.map((t) =>
    triggeredToApi(t, DUMMY_DISTRICT),
);

const TRIGGER_TO_ISSUE: Record<string, string> = {
    'trig-001': 'ISS-2026-001',
    'trig-002': 'ISS-2026-002',
    'trig-003': 'ISS-2026-003',
};

export async function dummyFetchSensors(districtId: string, wardNumber?: number | null): Promise<Sensor[]> {
    await delay(50);
    let list = getSensorsByDistrict(districtId);
    if (wardNumber != null) {
        list = list.filter((s) => s.ward === wardNumber);
    }
    return list;
}

export async function dummyFetchIssues(params?: DummyFetchIssuesParams | string): Promise<Issue[]> {
    await delay(80);
    const opts = typeof params === 'string' ? { districtId: params } : (params ?? {});
    const { districtId } = opts;
    if (!districtId) return [...mockIssues];
    return getIssuesByDistrict(districtId);
}

export async function dummyFetchIssueById(id: string): Promise<Issue | undefined> {
    await delay(40);
    return mockIssues.find((i) => i.id === id);
}

export async function dummyFetchIssueSops(issueId: string) {
    await delay(40);
    void issueId;
    return [
        {
            id: 'sop-d1',
            ruleName: 'Road Dust Mitigation Protocol',
            severity: 'high',
            status: 'active',
            sop_type: 'field',
            department: 'Engineering (PWD)',
            pollutionSource: 'Road dust',
            pollutionSourcePct: 35,
            activatedAt: new Date().toISOString(),
            slaDeadline: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
        },
    ];
}

export async function dummyUpdateIssueStatus(id: string, status: IssueStatus): Promise<Issue> {
    await delay(60);
    const base = mockIssues.find((i) => i.id === id);
    if (!base) {
        return {
            id,
            type: 'road_dust',
            title: 'Unknown',
            description: '',
            location: { lat: 0, lng: 0 },
            zone: 0,
            ward: 0,
            severity: 'medium',
            status,
            pm25: 0,
            pm10: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            districtId: DUMMY_DISTRICT,
        };
    }
    return { ...base, status, updatedAt: new Date().toISOString() };
}

export async function dummyFetchNotifications(): Promise<AppNotification[]> {
    await delay(100);
    return mockNotifications;
}

export async function dummyFetchHotspots(districtId: string): Promise<Hotspot[]> {
    await delay(80);
    return mockHotspots[districtId] ?? mockHotspots[districtId.toLowerCase()] ?? [];
}

export async function dummyFetchAirsheds(districtId: string): Promise<Airshed[]> {
    await delay(60);
    const key = districtId.includes('lucknow') ? 'lucknow' : districtId.includes('gurugram') ? 'gurugram' : districtId;
    return mockAirsheds[key] ?? [];
}

export async function dummyFetchSourceContributions(districtId: string): Promise<SourceContribution[]> {
    await delay(60);
    const key = districtId.includes('lucknow') ? 'lucknow' : districtId.includes('gurugram') ? 'gurugram' : districtId;
    return mockSourceContributions[key] ?? [];
}

export async function dummyFetchPollutionGrid(districtId: string) {
    await delay(40);
    void districtId;
    return null;
}

export async function dummyFetchHeatmap(districtId: string, pollutant: 'pm25' | 'pm10' = 'pm25') {
    const sensors = await dummyFetchSensors(districtId);
    const key = pollutant === 'pm10' ? 'pm10' : 'pm25';
    const points = sensors
        .filter((s) => s.location.lat && s.location.lng)
        .map((s) => ({
            lat: s.location.lat,
            lng: s.location.lng,
            value: Number(s[key] ?? s.pm25 ?? 0),
        }));
    let north = -90,
        south = 90,
        east = -180,
        west = 180;
    for (const p of points) {
        if (p.lat > north) north = p.lat;
        if (p.lat < south) south = p.lat;
        if (p.lng > east) east = p.lng;
        if (p.lng < west) west = p.lng;
    }
    const pad = 0.02;
    return {
        points,
        bounds: {
            north: north > -90 ? north + pad : 27,
            south: south < 90 ? south - pad : 26,
            east: east > -180 ? east + pad : 81,
            west: west < 180 ? west - pad : 80,
        },
        timestamp: new Date().toISOString(),
    };
}

export async function dummyFetchStates(): Promise<string[]> {
    await delay(30);
    return [...new Set(staticDistricts.map((d) => d.state))].sort();
}

export async function dummyFetchDistrictsByState(state: string): Promise<District[]> {
    await delay(40);
    if (!state) return staticDistricts;
    return staticDistricts.filter((d) => d.state === state);
}

export async function dummyFetchWardsByDistrict(districtId: string): Promise<Ward[]> {
    await delay(40);
    const d = staticDistricts.find((x) => x.id === districtId);
    return d?.wards ?? [];
}

export async function dummyFetchDistrictById(id: string): Promise<District | null> {
    await delay(40);
    return staticDistricts.find((d) => d.id === id) ?? null;
}

export async function dummyFetchIssueStats(districtId: string) {
    const issues = await dummyFetchIssues({ districtId });
    const byStatus: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    for (const i of issues) {
        byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
        bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
        byType[i.type] = (byType[i.type] ?? 0) + 1;
    }
    return {
        total: issues.length,
        byStatus,
        bySeverity,
        byType,
    };
}

export async function dummyFetchDssTriggers(districtId: string, ward?: number | null) {
    await delay(100);
    if (!districtId.includes('lucknow') && districtId !== DUMMY_DISTRICT) {
        return [];
    }
    if (ward == null) return dummyTriggersLucknow;
    return dummyTriggersLucknow.filter((t) => {
        const n = typeof t.ward === 'number' ? t.ward : wardFromLabel(String(t.ward));
        return n === ward;
    });
}

export async function dummyFetchTriggerById(id: string) {
    await delay(60);
    return dummyTriggersLucknow.find((t) => t.id === id) ?? null;
}

export async function dummyFetchTriggerIssue(triggerId: string) {
    await delay(50);
    const issueId = TRIGGER_TO_ISSUE[triggerId];
    if (!issueId) return null;
    const issue = mockIssues.find((i) => i.id === issueId);
    if (!issue) return null;
    return {
        id: issue.id,
        type: issue.type,
        title: issue.title,
        status: issue.status,
        severity: issue.severity,
    };
}

export async function dummyUpdateInterventionStatus(
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
    },
) {
    await delay(80);
    void triggerId;
    void opts?.beforePhoto;
    void opts?.afterPhoto;
    return {
        interventionStatuses: {
            [index]: {
                status,
                ...(opts?.modifiedText ? { modifiedText: opts.modifiedText } : {}),
                ...(opts?.remarks ? { remarks: opts.remarks } : {}),
            },
        },
    };
}

export async function dummyCompleteSop(
    triggerId: string,
    _data?: { photo?: File; remarks?: string; lat?: number; lng?: number },
) {
    await delay(80);
    void _data;
    return { id: triggerId, status: 'completed' };
}

export async function dummyFetchDssRules() {
    await delay(80);
    return mockDssRules as unknown[];
}

export async function dummyFetchForecast(districtId: string, hours = 72) {
    await delay(100);
    void districtId;
    void hours;
    const now = Date.now();
    const forecast = Array.from({ length: 24 }, (_, i) => {
        const t = new Date(now + i * 3600 * 1000).toISOString();
        const pm25 = 80 + Math.sin(i / 3) * 40;
        const aqi = Math.round(pm25 * 1.2);
        let category = 'Moderate';
        if (aqi <= 50) category = 'Good';
        else if (aqi <= 100) category = 'Satisfactory';
        else if (aqi <= 200) category = 'Moderate';
        else if (aqi <= 300) category = 'Poor';
        else category = 'Very Poor';
        return { timestamp: t, pm25, aqi, category };
    });
    return {
        forecast,
        stations: [],
        model: 'Dummy local (no backend)',
        generatedAt: new Date().toISOString(),
    };
}

export async function dummyFetchTeam() {
    await delay(60);
    return [
        {
            id: 'u1',
            name: 'Priya Sharma',
            username: 'priya.sharma',
            role: 'AE',
            wardIds: [18, 45],
            wards: [
                { wardName: 'Aliganj', wardNumber: 18 },
                { wardName: 'Indira Nagar', wardNumber: 45 },
            ],
            supervisorId: null,
        },
        {
            id: 'u2',
            name: 'Ramesh Kumar',
            username: 'ramesh.kumar',
            role: 'JE',
            wardIds: [18],
            wards: [{ wardName: 'Aliganj', wardNumber: 18 }],
            supervisorId: 'u1',
        },
    ];
}

export async function dummyFetchDssStats(districtId: string, ward?: number | null) {
    await delay(80);
    void ward;
    const issues = await dummyFetchIssues({ districtId });
    const openIssuesCount = issues.filter((i) => i.status === 'new' || i.status === 'active').length;
    const criticalIssuesCount = issues.filter((i) => i.severity === 'high' && i.status !== 'done').length;
    const pendingSopsCount = dummyTriggersLucknow.filter((t) => t.status !== 'completed').length;
    if (!districtId.includes('lucknow') && districtId !== DUMMY_DISTRICT) {
        return { openIssuesCount: 0, criticalIssuesCount: 0, pendingSopsCount: 0 };
    }
    return { openIssuesCount, criticalIssuesCount, pendingSopsCount };
}

export async function dummyFetchSensorForecast(sensorId: string) {
    await delay(60);
    const now = Date.now();
    return {
        sensorId,
        dataPoints: Array.from({ length: 12 }, (_, i) => ({
            timestamp: new Date(now - (11 - i) * 3600 * 1000).toISOString(),
            aqi: 120 + i * 3,
            pm25: 55 + i * 2,
            confidence: { lower: 50, upper: 90 },
        })),
        source_types: [
            { label: 'Vehicular', percentage: 38 },
            { label: 'Road dust', percentage: 28 },
            { label: 'Construction', percentage: 18 },
            { label: 'Other', percentage: 16 },
        ],
    };
}

export async function dummyFetchSensorPlotReadings(sensorId: string, hours = 24) {
    await delay(80);
    const sensors = [...getSensorsByDistrict('uttar-pradesh-lucknow'), ...getSensorsByDistrict('haryana-gurugram')];
    const s = sensors.find((x) => x.id === sensorId);
    const name = s?.name ?? sensorId;
    const end = Date.now();
    const step = Math.max(1, Math.floor((hours * 3600 * 1000) / 48));
    const rows: Array<{
        sensorId: string;
        sensorName: string;
        timestamp: string;
        source?: string | null;
        pm25: number | null;
        windSpeed: number | null;
        windDir: number | null;
    }> = [];
    for (let t = end - hours * 3600 * 1000; t <= end; t += step) {
        const phase = (t / 3600000) % 24;
        rows.push({
            sensorId,
            sensorName: name,
            timestamp: new Date(t).toISOString(),
            source: 'dummy',
            pm25: (s?.pm25 ?? 90) + Math.sin(phase) * 15,
            windSpeed: 8 + Math.sin(phase / 4) * 3,
            windDir: (phase * 15) % 360,
        });
    }
    return rows;
}

export async function dummyFetchSensorSources(
    sensorId: string,
    districtId?: string,
    pm25Hint?: number,
) {
    void pm25Hint;
    await delay(70);
    return {
        sensorId,
        hasSources: true,
        sources: [
            { label: 'Vehicular', percentage: 36 },
            { label: 'Road dust', percentage: 29 },
            { label: 'Industrial', percentage: 18 },
            { label: 'Other', percentage: 17 },
        ],
        sourceOrigin: 'heuristic' as const,
        sopResult: {
            sopTriggered: false,
            reason: 'Dummy mode — no live SOP evaluation.',
        },
        affectedWards: districtId?.includes('lucknow') ? ['Ward 18'] : [],
        message: undefined,
        timestamp: new Date().toISOString(),
    };
}

export async function dummyFetchSourcePinpointing(
    sensorId: string,
    districtId: string,
    limit = 5,
) {
    await delay(90);
    const sensors = getSensorsByDistrict(districtId);
    const s = sensors.find((x) => x.id === sensorId) ?? sensors[0];
    if (!s) return null;
    const wards = await dummyFetchWardsByDistrict(districtId);
    const wardContributions = wards.slice(0, limit).map((w, i) => ({
        wardId: w.id,
        wardName: w.name,
        gridCount: 12 - i,
        rawPercentage: 25 - i * 3,
        percentage: Math.max(5, 22 - i * 4),
    }));
    return {
        districtId,
        computedAt: new Date().toISOString(),
        contributionHourStart: new Date(Date.now() - 3600000).toISOString(),
        contributionHourEnd: new Date().toISOString(),
        sensor: {
            sensorId: s.id,
            sensorName: s.name,
            deviceType: 'CAAQMS',
            lat: s.location.lat,
            lng: s.location.lng,
            latestPm25: s.pm25,
            latestWindSpeed: s.windSpeed ?? 10,
            latestWindDir: 180,
            latestObservationTime: s.lastUpdated,
            outsideSourcesPct: 22,
            wardContributions,
        },
    };
}