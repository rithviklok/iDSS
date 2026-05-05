import type { Issue, AppNotification, Hotspot, Airshed, SourceContribution } from '../types';

// ==================== ISSUES ====================
export const mockIssues: Issue[] = [
    {
        id: 'ISS-2026-001',
        type: 'road_dust',
        title: 'Road Dust',
        description: 'Heavy road dust resuspension due to unpaved shoulder and dry conditions. Multiple heavy vehicles causing visible dust plumes. Nearby residential area affected.',
        location: { lat: 26.8610, lng: 80.9350 },
        zone: 7,
        ward: 67,
        severity: 'high',
        status: 'new',
        pm25: 195,
        pm10: 320,
        createdAt: '2026-02-24T10:00:00+05:30',
        updatedAt: '2026-02-24T10:00:00+05:30',
        districtId: 'uttar-pradesh-lucknow',
        detectedBy: 'Mobile AQ Unit',
        wind: 'N at 7.2 km/h',
        sopReference: { id: 'SOP-RD-01', title: 'Road Dust Mitigation Protocol', description: 'CPCB Guidelines, NGT Orders' },
    },
    {
        id: 'ISS-2026-002',
        type: 'waste_burning',
        title: 'Waste Burning',
        description: 'Open MSW burning detected by thermal camera in Block C & D. Thick smoke plume visible, spreading towards residential sectors.',
        location: { lat: 26.8190, lng: 80.9180 },
        zone: 4,
        ward: 45,
        severity: 'high',
        status: 'new',
        pm25: 340,
        pm10: 510,
        createdAt: '2026-02-24T11:15:00+05:30',
        updatedAt: '2026-02-24T11:15:00+05:30',
        districtId: 'uttar-pradesh-lucknow',
        detectedBy: 'Thermal Camera',
        wind: 'NW at 5.1 km/h',
        sopReference: { id: 'SOP-WB-01', title: 'Waste Burning Response Protocol', description: 'SWM Rules 2016, CPCB Norms' },
    },
    {
        id: 'ISS-2026-003',
        type: 'traffic_congestion',
        title: 'Traffic Congestion',
        description: 'Gridlock causing high NOx and PM2.5. 2000+ idling vehicles detected by traffic monitoring system.',
        location: { lat: 26.8513, lng: 80.9462 },
        zone: 1,
        ward: 12,
        severity: 'high',
        status: 'active',
        pm25: 210,
        pm10: 350,
        createdAt: '2026-02-24T08:30:00+05:30',
        updatedAt: '2026-02-25T14:00:00+05:30',
        assignedTo: 'Officer Rajan',
        districtId: 'uttar-pradesh-lucknow',
        detectedBy: 'Traffic Sensor Array',
        wind: 'E at 3.4 km/h',
        sopReference: { id: 'SOP-TC-01', title: 'Traffic Congestion Air Quality Protocol', description: 'Urban Transport Guidelines' },
    },
    {
        id: 'ISS-2026-004',
        type: 'construction_dust',
        title: 'Construction Dust',
        description: 'Uncovered construction site causing dust clouds. No water sprinkler or mitigation measures observed.',
        location: { lat: 26.8470, lng: 80.9340 },
        zone: 2,
        ward: 32,
        severity: 'medium',
        status: 'done',
        pm25: 145,
        pm10: 240,
        createdAt: '2026-02-22T09:00:00+05:30',
        updatedAt: '2026-02-25T16:30:00+05:30',
        assignedTo: 'Officer Meena',
        districtId: 'uttar-pradesh-lucknow',
        detectedBy: 'Field Inspection',
        wind: 'SW at 4.8 km/h',
        sopReference: { id: 'SOP-CD-01', title: 'Construction Dust Control Protocol', description: 'CPCB Construction Guidelines' },
    },
    {
        id: 'ISS-2026-005',
        type: 'industrial_emission',
        title: 'Industrial Emission',
        description: 'Unauthorized kiln operation detected near residential colony. Thick smoke visible from stack emissions.',
        location: { lat: 26.8930, lng: 80.9280 },
        zone: 5,
        ward: 55,
        severity: 'high',
        status: 'escalated',
        pm25: 380,
        pm10: 560,
        createdAt: '2026-02-23T07:00:00+05:30',
        updatedAt: '2026-02-25T18:00:00+05:30',
        assignedTo: 'CPCB Regional',
        districtId: 'uttar-pradesh-lucknow',
        detectedBy: 'CEMS Monitor',
        wind: 'NE at 6.0 km/h',
        sopReference: { id: 'SOP-IE-01', title: 'Industrial Emission Response', description: 'Air Act 1981, CPCB Emission Standards' },
    },
    {
        id: 'ISS-2026-006',
        type: 'road_dust',
        title: 'Road Dust (NH-44)',
        description: 'Construction debris on national highway shoulder causing persistent dust plume affecting commuters.',
        location: { lat: 28.4725, lng: 77.0390 },
        zone: 3,
        ward: 28,
        severity: 'medium',
        status: 'active',
        pm25: 165,
        pm10: 278,
        createdAt: '2026-02-25T06:45:00+05:30',
        updatedAt: '2026-02-25T12:00:00+05:30',
        assignedTo: 'Officer Anil',
        districtId: 'haryana-gurugram',
        detectedBy: 'Roadside Sensor',
        wind: 'W at 8.3 km/h',
        sopReference: { id: 'SOP-RD-01', title: 'Road Dust Mitigation Protocol', description: 'CPCB Guidelines, NGT Orders' },
    },
    {
        id: 'ISS-2026-007',
        type: 'waste_burning',
        title: 'Open Burning (Sector 56)',
        description: 'Garden waste burning in open plot. Multiple complaints received from nearby residents.',
        location: { lat: 28.4240, lng: 77.0980 },
        zone: 3,
        ward: 22,
        severity: 'medium',
        status: 'new',
        pm25: 180,
        pm10: 295,
        createdAt: '2026-02-26T04:30:00+05:30',
        updatedAt: '2026-02-26T04:30:00+05:30',
        districtId: 'haryana-gurugram',
        detectedBy: 'Citizen Complaint',
        wind: 'NW at 4.5 km/h',
        sopReference: { id: 'SOP-WB-01', title: 'Waste Burning Response Protocol', description: 'SWM Rules 2016, CPCB Norms' },
    },
    {
        id: 'ISS-2026-008',
        type: 'construction_dust',
        title: 'Metro Construction',
        description: 'Metro construction site near DLF Phase 3 without anti-smog gun or dust suppressant systems.',
        location: { lat: 28.4945, lng: 77.0930 },
        zone: 1,
        ward: 3,
        severity: 'high',
        status: 'active',
        pm25: 225,
        pm10: 370,
        createdAt: '2026-02-24T15:30:00+05:30',
        updatedAt: '2026-02-25T10:00:00+05:30',
        assignedTo: 'Officer Vikas',
        districtId: 'haryana-gurugram',
        detectedBy: 'Drone Surveillance',
        wind: 'SE at 5.7 km/h',
        sopReference: { id: 'SOP-CD-01', title: 'Construction Dust Control Protocol', description: 'CPCB Construction Guidelines' },
    },
];

// ==================== NOTIFICATIONS ====================
export const mockNotifications: AppNotification[] = [
    {
        id: 'NOT-001',
        title: 'New Issue: Waste Burning',
        message: 'Open MSW burning detected in Zone 4, Ward 45. PM2.5: 340 µg/m³.',
        type: 'issue_new',
        isRead: false,
        createdAt: '2026-02-24T11:15:00+05:30',
        issueId: 'ISS-2026-002',
    },
    {
        id: 'NOT-002',
        title: 'New Issue: Road Dust',
        message: 'Road dust from unpaved shoulder in Zone 7, Ward 67.',
        type: 'issue_new',
        isRead: false,
        createdAt: '2026-02-24T10:00:00+05:30',
        issueId: 'ISS-2026-001',
    },
    {
        id: 'NOT-003',
        title: 'PM2.5 Threshold Exceeded',
        message: 'Sensor LKO-036 reporting PM2.5 at 240 µg/m³ — Severe category.',
        type: 'threshold_breach',
        isRead: true,
        createdAt: '2026-02-25T06:00:00+05:30',
    },
    {
        id: 'NOT-004',
        title: 'Issue Escalated: Industrial Emission',
        message: 'ISS-2026-005 has been escalated to CPCB Regional office.',
        type: 'issue_update',
        isRead: true,
        createdAt: '2026-02-25T18:00:00+05:30',
        issueId: 'ISS-2026-005',
    },
    {
        id: 'NOT-005',
        title: 'Issue Resolved: Construction Dust',
        message: 'ISS-2026-004 marked as done by Officer Meena.',
        type: 'issue_update',
        isRead: true,
        createdAt: '2026-02-25T16:30:00+05:30',
        issueId: 'ISS-2026-004',
    },
];

// ==================== HOTSPOTS ====================
const lucknowHotspots: Hotspot[] = [
    { id: 'HS-L1', location: { lat: 26.8590, lng: 80.9050 }, intensity: 92, label: 'Old Lucknow' },
    { id: 'HS-L2', location: { lat: 26.8930, lng: 80.9280 }, intensity: 88, label: 'Transport Nagar' },
    { id: 'HS-L3', location: { lat: 26.8190, lng: 80.9180 }, intensity: 80, label: 'Alambagh' },
    { id: 'HS-L4', location: { lat: 26.8610, lng: 80.9350 }, intensity: 75, label: 'Chowk' },
];
const gurugramHotspots: Hotspot[] = [
    { id: 'HS-G1', location: { lat: 28.4480, lng: 76.8210 }, intensity: 95, label: 'Farrukhnagar Zone' },
    { id: 'HS-G2', location: { lat: 28.3650, lng: 76.9500 }, intensity: 88, label: 'IMT Manesar' },
    { id: 'HS-G3', location: { lat: 28.4610, lng: 77.0020 }, intensity: 72, label: 'Old Gurugram' },
    { id: 'HS-G4', location: { lat: 28.4560, lng: 77.0610 }, intensity: 65, label: 'Sector 29' },
];
export const mockHotspots: Record<string, Hotspot[]> = {
    gurugram: gurugramHotspots,
    lucknow: lucknowHotspots,
    'uttar-pradesh-lucknow': lucknowHotspots,
    'haryana-gurugram': gurugramHotspots,
};

// ==================== AIRSHEDS ====================
export const mockAirsheds: Record<string, Airshed[]> = {
    gurugram: [
        {
            id: 'AS-G1', name: 'Western Industrial', avgPm25: 245,
            boundary: [
                { lat: 28.50, lng: 76.85 }, { lat: 28.50, lng: 76.97 },
                { lat: 28.35, lng: 76.97 }, { lat: 28.35, lng: 76.85 },
            ],
        },
        {
            id: 'AS-G2', name: 'Central Urban', avgPm25: 105,
            boundary: [
                { lat: 28.50, lng: 76.97 }, { lat: 28.50, lng: 77.05 },
                { lat: 28.42, lng: 77.05 }, { lat: 28.42, lng: 76.97 },
            ],
        },
        {
            id: 'AS-G3', name: 'Eastern Commercial', avgPm25: 65,
            boundary: [
                { lat: 28.50, lng: 77.05 }, { lat: 28.50, lng: 77.12 },
                { lat: 28.40, lng: 77.12 }, { lat: 28.40, lng: 77.05 },
            ],
        },
    ],
    lucknow: [
        {
            id: 'AS-L1', name: 'Old City Core', avgPm25: 195,
            boundary: [
                { lat: 26.88, lng: 80.89 }, { lat: 26.88, lng: 80.95 },
                { lat: 26.84, lng: 80.95 }, { lat: 26.84, lng: 80.89 },
            ],
        },
        {
            id: 'AS-L2', name: 'Trans-Gomti', avgPm25: 68,
            boundary: [
                { lat: 26.89, lng: 80.96 }, { lat: 26.89, lng: 81.03 },
                { lat: 26.83, lng: 81.03 }, { lat: 26.83, lng: 80.96 },
            ],
        },
    ],
};

// ==================== SOURCE CONTRIBUTIONS ====================
export const mockSourceContributions: Record<string, SourceContribution[]> = {
    gurugram: [
        {
            id: 'SC-G1', location: { lat: 28.46, lng: 76.90 },
            sources: [
                { label: 'Industrial', percentage: 42, color: '#e74c3c' },
                { label: 'Vehicular', percentage: 25, color: '#f39c12' },
                { label: 'Road Dust', percentage: 20, color: '#9b59b6' },
                { label: 'Construction', percentage: 8, color: '#3498db' },
                { label: 'Other', percentage: 5, color: '#95a5a6' },
            ],
        },
        {
            id: 'SC-G2', location: { lat: 28.48, lng: 77.07 },
            sources: [
                { label: 'Vehicular', percentage: 45, color: '#f39c12' },
                { label: 'Road Dust', percentage: 22, color: '#9b59b6' },
                { label: 'Construction', percentage: 18, color: '#3498db' },
                { label: 'Industrial', percentage: 10, color: '#e74c3c' },
                { label: 'Other', percentage: 5, color: '#95a5a6' },
            ],
        },
    ],
    lucknow: [
        {
            id: 'SC-L1', location: { lat: 26.86, lng: 80.93 },
            sources: [
                { label: 'Vehicular', percentage: 35, color: '#f39c12' },
                { label: 'Road Dust', percentage: 28, color: '#9b59b6' },
                { label: 'Waste Burning', percentage: 18, color: '#e74c3c' },
                { label: 'Industrial', percentage: 12, color: '#3498db' },
                { label: 'Other', percentage: 7, color: '#95a5a6' },
            ],
        },
        {
            id: 'SC-L2', location: { lat: 26.85, lng: 80.99 },
            sources: [
                { label: 'Vehicular', percentage: 50, color: '#f39c12' },
                { label: 'Construction', percentage: 20, color: '#3498db' },
                { label: 'Road Dust', percentage: 15, color: '#9b59b6' },
                { label: 'Industrial', percentage: 10, color: '#e74c3c' },
                { label: 'Other', percentage: 5, color: '#95a5a6' },
            ],
        },
    ],
};

export function getIssuesByDistrict(districtId: string): Issue[] {
    return mockIssues.filter(i => i.districtId === districtId);
}

export function getIssueIcon(type: string): string {
    const icons: Record<string, string> = {
        road_dust: '🛣️',
        waste_burning: '🔥',
        traffic_congestion: '🚗',
        construction_dust: '🏗️',
        industrial_emission: '🏭',
        crop_burning: '🌾',
    };
    return icons[type] || '⚠️';
}

export function getIssueTypeLabel(type: string): string {
    const labels: Record<string, string> = {
        road_dust: 'Road Dust',
        waste_burning: 'Waste Burning',
        traffic_congestion: 'Traffic Congestion',
        construction_dust: 'Construction Dust',
        industrial_emission: 'Industrial Emission',
        crop_burning: 'Crop Burning',
    };
    return labels[type] || type;
}
