import type { Sensor } from '../types';
import { getSensorsByDistrict } from '../data/mockSensorData';
import { districts as staticDistricts } from '../data/geography';
import { isDummyDataMode } from './dummyMode';

const BASE = import.meta.env.VITE_DSS_API_BASE || 'http://localhost:3000';

interface SensorHealthSummary {
    total: number;
    active: number;
    anomalous: number;
    offline: number;
}

export interface HealthSensor {
    id: string;
    name: string;
    network: string;
    state: string;
    district: string;
    zone: string | null;
    zoneId: number | null;
    ward: number | null;
    status: 'Active' | 'Anomalous' | 'Offline';
    healthScore: number;
    uptimePct: number;
    completenessPct: number;
    lastDataAt: string | null;
    qualityClass: string;
    currentPm25: number | null;
    lat: number;
    lng: number;
    failedChecks: string[];
}

export interface SensorHealthResponse {
    summary: SensorHealthSummary;
    sensors: HealthSensor[];
}

export interface ManagedSensor {
    id: string;
    displayId: string;
    name: string;
    network: string;
    state: string;
    district: string;
    districtId: string;
    zone: string | null;
    zoneId: number | null;
    ward: number | null;
    lat: number;
    lng: number;
    isActive: boolean;
    status: string;
    deviceType: string | null;
    calibrationDate: string | null;
    lastSyncedAt: string | null;
}

export interface ManagedSensorsResponse {
    sensors: ManagedSensor[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

/** Extra sensors “created” in dummy mode (session-local). */
let dummyManagedExtras: ManagedSensor[] = [];

function districtMeta(districtId: string): { state: string; district: string } {
    const d = staticDistricts.find((x) => x.id === districtId);
    if (d) return { state: d.state, district: d.name };
    if (districtId.includes('lucknow')) return { state: 'Uttar Pradesh', district: 'Lucknow' };
    if (districtId.includes('gurugram')) return { state: 'Haryana', district: 'Gurugram' };
    return { state: '—', district: '—' };
}

function allMockSensors(): Sensor[] {
    return [...getSensorsByDistrict('uttar-pradesh-lucknow'), ...getSensorsByDistrict('haryana-gurugram')];
}

function sensorToHealth(s: Sensor, idx: number): HealthSensor {
    const lucknow = getSensorsByDistrict('uttar-pradesh-lucknow').some((x) => x.id === s.id);
    const districtId = lucknow ? 'uttar-pradesh-lucknow' : 'haryana-gurugram';
    const { state, district } = districtMeta(districtId);
    const score = 65 + (idx % 30);
    return {
        id: s.id,
        name: s.name,
        network: 'CAAQMS',
        state,
        district,
        zone: s.zone != null ? `Zone ${s.zone}` : null,
        zoneId: s.zone ?? null,
        ward: s.ward ?? null,
        status: s.isActive ? 'Active' : 'Offline',
        healthScore: score,
        uptimePct: Math.min(99, 80 + (idx % 15)),
        completenessPct: Math.min(100, 88 + (idx % 10)),
        lastDataAt: s.lastUpdated,
        qualityClass: score >= 85 ? 'Good' : score >= 70 ? 'Fair' : 'Watch',
        currentPm25: s.pm25,
        lat: s.location.lat,
        lng: s.location.lng,
        failedChecks: score < 75 ? ['Calibration drift'] : [],
    };
}

function sensorToManaged(s: Sensor): ManagedSensor {
    const lucknow = getSensorsByDistrict('uttar-pradesh-lucknow').some((x) => x.id === s.id);
    const districtId = lucknow ? 'uttar-pradesh-lucknow' : 'haryana-gurugram';
    const { state, district } = districtMeta(districtId);
    return {
        id: s.id,
        displayId: s.id,
        name: s.name,
        network: 'CAAQMS',
        state,
        district,
        districtId,
        zone: s.zone != null ? `Zone ${s.zone}` : null,
        zoneId: s.zone ?? null,
        ward: s.ward ?? null,
        lat: s.location.lat,
        lng: s.location.lng,
        isActive: s.isActive,
        status: s.isActive ? 'Reporting' : 'Offline',
        deviceType: 'AQ monitor',
        calibrationDate: null,
        lastSyncedAt: s.lastUpdated,
    };
}

export async function fetchSensorHealth(filters?: {
    districtId?: string;
    network?: string;
    zone?: string;
    status?: string;
    search?: string;
}): Promise<SensorHealthResponse> {
    if (isDummyDataMode()) {
        let list = allMockSensors();
        if (filters?.districtId) list = getSensorsByDistrict(filters.districtId);
        if (filters?.search) {
            const q = filters.search.toLowerCase();
            list = list.filter((s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
        }
        const sensors = list.map((s, i) => sensorToHealth(s, i));
        const active = sensors.filter((x) => x.status === 'Active').length;
        const offline = sensors.filter((x) => x.status === 'Offline').length;
        const anomalous = sensors.filter((x) => x.healthScore < 72).length;
        return {
            summary: { total: sensors.length, active, anomalous, offline },
            sensors,
        };
    }
    const params = new URLSearchParams();
    if (filters?.districtId) params.set('districtId', filters.districtId);
    if (filters?.network) params.set('network', filters.network);
    if (filters?.zone) params.set('zone', filters.zone);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.search) params.set('search', filters.search);

    const res = await fetch(`${BASE}/configurator/sensors/health?${params}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    return res.json();
}

export async function fetchManagedSensors(page = 1, limit = 10): Promise<ManagedSensorsResponse> {
    if (isDummyDataMode()) {
        const base = [...dummyManagedExtras.map((m) => ({ ...m })), ...allMockSensors().map(sensorToManaged)];
        const total = base.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const start = (page - 1) * limit;
        return {
            sensors: base.slice(start, start + limit),
            pagination: { page, limit, total, totalPages },
        };
    }
    const res = await fetch(`${BASE}/configurator/sensors?page=${page}&limit=${limit}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    return res.json();
}

export async function createSensor(data: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    deviceType?: string;
    districtId?: string;
    wardNumber?: number;
    zone?: number;
}): Promise<{ sensor: ManagedSensor }> {
    if (isDummyDataMode()) {
        const districtId = data.districtId ?? 'uttar-pradesh-lucknow';
        const { state, district } = districtMeta(districtId);
        const sensor: ManagedSensor = {
            id: data.id,
            displayId: data.id,
            name: data.name,
            network: 'Manual',
            state,
            district,
            districtId,
            zone: data.zone != null ? `Zone ${data.zone}` : null,
            zoneId: data.zone ?? null,
            ward: data.wardNumber ?? null,
            lat: data.lat,
            lng: data.lng,
            isActive: true,
            status: 'Reporting',
            deviceType: data.deviceType ?? null,
            calibrationDate: null,
            lastSyncedAt: new Date().toISOString(),
        };
        dummyManagedExtras = [sensor, ...dummyManagedExtras.filter((x) => x.id !== data.id)];
        return { sensor };
    }
    const res = await fetch(`${BASE}/configurator/sensors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Failed: ${res.status}`);
    }
    return res.json();
}

export async function updateSensor(id: string, data: Record<string, unknown>): Promise<{ sensor: ManagedSensor }> {
    if (isDummyDataMode()) {
        const fromExtras = dummyManagedExtras.find((x) => x.id === id);
        const mock = allMockSensors().find((s) => s.id === id);
        const base = fromExtras ?? (mock ? sensorToManaged(mock) : null);
        if (!base) throw new Error('Sensor not found');
        const sensor = { ...base, ...data } as ManagedSensor;
        dummyManagedExtras = [sensor, ...dummyManagedExtras.filter((x) => x.id !== id)];
        return { sensor };
    }
    const res = await fetch(`${BASE}/configurator/sensors/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Failed: ${res.status}`);
    }
    return res.json();
}

export async function deleteSensor(id: string): Promise<void> {
    if (isDummyDataMode()) {
        dummyManagedExtras = dummyManagedExtras.filter((x) => x.id !== id);
        return;
    }
    const res = await fetch(`${BASE}/configurator/sensors/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Failed: ${res.status}`);
    }
}

export async function bulkImportSensors(file: File): Promise<{ message: string; created: number; updated: number }> {
    if (isDummyDataMode()) {
        void file;
        return { message: 'Dummy mode: bulk import skipped (no backend).', created: 0, updated: 0 };
    }
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/configurator/sensors/bulk-import`, {
        method: 'POST',
        credentials: 'include',
        body: form,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Failed: ${res.status}`);
    }
    return res.json();
}
