import type { Sensor } from '../types';

/**
 * Hardcoded set of sensor IDs that have multi-gas monitoring capability
 * (CO, NO₂, O₃, wind speed, humidity, temperature).
 * Only sensors in this set will have gas/weather fields populated.
 * Update this list when new gas sensors are commissioned.
 */
export const GAS_SENSOR_IDS = new Set<string>([
    // Gurugram gas sensors
    'GUR-001', 'GUR-002', 'GUR-003', 'GUR-004', 'GUR-005',
    // Lucknow gas sensors
    'LKO-001', 'LKO-002', 'LKO-003', 'LKO-004', 'LKO-005',
]);

// ==================== GURUGRAM SENSORS ====================
const gurugramSensors: Sensor[] = [
    { id: 'GUR-001', name: 'Sector 14 Monitor', location: { lat: 28.4725, lng: 77.0390 }, pm25: 83, pm10: 145, zone: 1, ward: 14, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true, co: 1.1, no2: 40, o3: 35, windSpeed: 10, rh: 55, temp: 28 },
    { id: 'GUR-002', name: 'Sector 29 Monitor', location: { lat: 28.4590, lng: 77.0610 }, pm25: 107, pm10: 195, zone: 2, ward: 29, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true, co: 1.8, no2: 55, o3: 29, windSpeed: 9, rh: 58, temp: 29 },
    { id: 'GUR-003', name: 'Palam Vihar', location: { lat: 28.4830, lng: 76.9920 }, pm25: 150, pm10: 240, zone: 3, ward: 5, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true, co: 2.5, no2: 70, o3: 25, windSpeed: 7, rh: 63, temp: 30 },
    { id: 'GUR-004', name: 'DLF Phase 3', location: { lat: 28.4945, lng: 77.0930 }, pm25: 78, pm10: 130, zone: 1, ward: 3, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true, co: 0.7, no2: 28, o3: 40, windSpeed: 13, rh: 52, temp: 27 },
    { id: 'GUR-005', name: 'Sohna Road', location: { lat: 28.4132, lng: 77.0640 }, pm25: 118, pm10: 210, zone: 4, ward: 32, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true, co: 1.6, no2: 50, o3: 31, windSpeed: 11, rh: 57, temp: 29 },
    { id: 'GUR-006', name: 'Manesar Industrial', location: { lat: 28.3590, lng: 76.9380 }, pm25: 216, pm10: 340, zone: 5, ward: 35, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-007', name: 'IMT Manesar', location: { lat: 28.3650, lng: 76.9500 }, pm25: 289, pm10: 410, zone: 5, ward: 34, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-008', name: 'Cyber City', location: { lat: 28.4940, lng: 77.0870 }, pm25: 52, pm10: 98, zone: 1, ward: 2, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-009', name: 'Golf Course Road', location: { lat: 28.4560, lng: 77.1010 }, pm25: 77, pm10: 125, zone: 2, ward: 12, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-010', name: 'Sector 56', location: { lat: 28.4240, lng: 77.0980 }, pm25: 130, pm10: 220, zone: 3, ward: 22, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-011', name: 'Udyog Vihar', location: { lat: 28.4990, lng: 77.0640 }, pm25: 105, pm10: 185, zone: 1, ward: 1, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-012', name: 'Huda Market Sec-14', location: { lat: 28.4680, lng: 77.0230 }, pm25: 156, pm10: 255, zone: 3, ward: 15, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-013', name: 'Sushant Lok', location: { lat: 28.4650, lng: 77.0770 }, pm25: 40, pm10: 78, zone: 2, ward: 18, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-014', name: 'South City I', location: { lat: 28.4380, lng: 77.0540 }, pm25: 41, pm10: 82, zone: 4, ward: 25, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-015', name: 'Farrukhnagar', location: { lat: 28.4480, lng: 76.8210 }, pm25: 314, pm10: 450, zone: 7, ward: 33, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-016', name: 'Sector 33', location: { lat: 28.4310, lng: 77.0800 }, pm25: 35, pm10: 60, zone: 2, ward: 20, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-017', name: 'Sector 40', location: { lat: 28.4440, lng: 77.0690 }, pm25: 158, pm10: 260, zone: 2, ward: 21, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-018', name: 'Sector 21', location: { lat: 28.4780, lng: 77.0650 }, pm25: 36, pm10: 65, zone: 1, ward: 8, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-019', name: 'Sector 45', location: { lat: 28.4360, lng: 77.0890 }, pm25: 33, pm10: 56, zone: 4, ward: 24, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-020', name: 'Wazirabad', location: { lat: 28.4530, lng: 76.8950 }, pm25: 181, pm10: 300, zone: 6, ward: 30, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-021', name: 'Bhondsi', location: { lat: 28.3630, lng: 77.0460 }, pm25: 44, pm10: 80, zone: 5, ward: 35, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-022', name: 'Sector 10A', location: { lat: 28.4730, lng: 77.0140 }, pm25: 106, pm10: 185, zone: 3, ward: 10, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-023', name: 'Badshahpur', location: { lat: 28.3940, lng: 77.0400 }, pm25: 30, pm10: 50, zone: 4, ward: 28, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-024', name: 'Dundahera', location: { lat: 28.5010, lng: 77.0460 }, pm25: 23, pm10: 42, zone: 1, ward: 4, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-025', name: 'Old Gurugram', location: { lat: 28.4610, lng: 77.0020 }, pm25: 186, pm10: 310, zone: 3, ward: 16, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-026', name: 'IFFCO Chowk', location: { lat: 28.4730, lng: 77.0720 }, pm25: 29, pm10: 52, zone: 1, ward: 6, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-027', name: 'Sector 57', location: { lat: 28.4260, lng: 77.1040 }, pm25: 27, pm10: 48, zone: 4, ward: 23, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-028', name: 'Pataudi Rd', location: { lat: 28.3920, lng: 76.9040 }, pm25: 108, pm10: 190, zone: 6, ward: 31, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-029', name: 'Maruti Kund', location: { lat: 28.4490, lng: 76.9640 }, pm25: 26, pm10: 44, zone: 3, ward: 17, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-030', name: 'Sec 22 Crossing', location: { lat: 28.4780, lng: 77.0490 }, pm25: 34, pm10: 62, zone: 1, ward: 7, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-031', name: 'Nirvana Country', location: { lat: 28.4280, lng: 77.0450 }, pm25: 25, pm10: 40, zone: 4, ward: 26, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-032', name: 'Sector 49', location: { lat: 28.4130, lng: 77.0380 }, pm25: 122, pm10: 202, zone: 4, ward: 27, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-033', name: 'MG Road', location: { lat: 28.4790, lng: 77.0820 }, pm25: 43, pm10: 75, zone: 1, ward: 9, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-034', name: 'Subhash Chowk', location: { lat: 28.4406, lng: 76.9990 }, pm25: 14, pm10: 28, zone: 3, ward: 19, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-035', name: 'Jharsa', location: { lat: 28.4640, lng: 77.0520 }, pm25: 39, pm10: 66, zone: 2, ward: 11, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-036', name: 'Basai', location: { lat: 28.4800, lng: 76.9750 }, pm25: 27, pm10: 50, zone: 3, ward: 13, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-037', name: 'Islampur', location: { lat: 28.4850, lng: 76.8800 }, pm25: 24, pm10: 38, zone: 7, ward: 33, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-038', name: 'Sikanderpur', location: { lat: 28.4790, lng: 77.0960 }, pm25: 11, pm10: 22, zone: 1, ward: 3, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-039', name: 'Heritage City', location: { lat: 28.4440, lng: 77.1070 }, pm25: 26, pm10: 46, zone: 4, ward: 23, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'GUR-040', name: 'Rampura', location: { lat: 28.4930, lng: 76.9360 }, pm25: 106, pm10: 180, zone: 6, ward: 29, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
];

// ==================== LUCKNOW SENSORS ====================
const lucknowSensors: Sensor[] = [
    { id: 'LKO-001', name: 'Hazratganj', location: { lat: 26.8513, lng: 80.9462 }, pm25: 112, pm10: 198, zone: 1, ward: 1, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true, co: 1.2, no2: 45, o3: 30, windSpeed: 12, rh: 65, temp: 32 },
    { id: 'LKO-002', name: 'Aminabad', location: { lat: 26.8470, lng: 80.9340 }, pm25: 145, pm10: 245, zone: 1, ward: 3, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true, co: 2.1, no2: 62, o3: 28, windSpeed: 8, rh: 70, temp: 31 },
    { id: 'LKO-003', name: 'Chowk', location: { lat: 26.8610, lng: 80.9350 }, pm25: 195, pm10: 320, zone: 2, ward: 5, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true, co: 3.4, no2: 88, o3: 22, windSpeed: 6, rh: 72, temp: 33 },
    { id: 'LKO-004', name: 'Gomti Nagar', location: { lat: 26.8508, lng: 80.9915 }, pm25: 67, pm10: 115, zone: 3, ward: 10, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true, co: 0.8, no2: 30, o3: 38, windSpeed: 15, rh: 60, temp: 30 },
    { id: 'LKO-005', name: 'Indira Nagar', location: { lat: 26.8750, lng: 80.9920 }, pm25: 78, pm10: 130, zone: 3, ward: 12, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true, co: 0.9, no2: 35, o3: 42, windSpeed: 14, rh: 58, temp: 30 },
    { id: 'LKO-006', name: 'Aliganj', location: { lat: 26.8920, lng: 80.9430 }, pm25: 92, pm10: 168, zone: 4, ward: 15, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-007', name: 'Mahanagar', location: { lat: 26.8740, lng: 80.9500 }, pm25: 105, pm10: 185, zone: 2, ward: 7, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-008', name: 'Rajajipuram', location: { lat: 26.8550, lng: 80.8950 }, pm25: 165, pm10: 275, zone: 5, ward: 20, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-009', name: 'Alambagh', location: { lat: 26.8190, lng: 80.9180 }, pm25: 210, pm10: 345, zone: 6, ward: 25, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-010', name: 'Husainabad', location: { lat: 26.8680, lng: 80.9190 }, pm25: 178, pm10: 298, zone: 2, ward: 6, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-011', name: 'Cantonment', location: { lat: 26.8330, lng: 80.9330 }, pm25: 88, pm10: 152, zone: 6, ward: 28, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-012', name: 'Chinhat', location: { lat: 26.8740, lng: 81.0230 }, pm25: 55, pm10: 95, zone: 3, ward: 14, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-013', name: 'Jankipuram', location: { lat: 26.9150, lng: 80.9620 }, pm25: 72, pm10: 125, zone: 4, ward: 16, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-014', name: 'Vikas Nagar', location: { lat: 26.8900, lng: 80.9150 }, pm25: 98, pm10: 170, zone: 4, ward: 18, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-015', name: 'Telibagh', location: { lat: 26.7920, lng: 80.9420 }, pm25: 135, pm10: 228, zone: 7, ward: 30, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-016', name: 'Ashiyana', location: { lat: 26.7990, lng: 80.9630 }, pm25: 120, pm10: 205, zone: 7, ward: 32, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-017', name: 'Sarojini Nagar', location: { lat: 26.8050, lng: 80.9110 }, pm25: 148, pm10: 250, zone: 6, ward: 27, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-018', name: 'Talkatora', location: { lat: 26.8510, lng: 80.9130 }, pm25: 187, pm10: 308, zone: 5, ward: 22, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-019', name: 'Nishatganj', location: { lat: 26.8630, lng: 80.9550 }, pm25: 130, pm10: 218, zone: 2, ward: 8, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-020', name: 'Kaiserbagh', location: { lat: 26.8430, lng: 80.9390 }, pm25: 155, pm10: 260, zone: 1, ward: 2, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-021', name: 'Lalbagh', location: { lat: 26.8580, lng: 80.9250 }, pm25: 168, pm10: 282, zone: 2, ward: 4, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-022', name: 'Narhi', location: { lat: 26.8660, lng: 80.9430 }, pm25: 142, pm10: 240, zone: 2, ward: 9, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-023', name: 'Vrindavan Colony', location: { lat: 26.8360, lng: 80.9840 }, pm25: 58, pm10: 100, zone: 3, ward: 11, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-024', name: 'Banthra', location: { lat: 26.7660, lng: 80.9200 }, pm25: 45, pm10: 78, zone: 7, ward: 35, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-025', name: 'Mohanlalganj', location: { lat: 26.7490, lng: 80.9780 }, pm25: 38, pm10: 65, zone: 7, ward: 38, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-026', name: 'IIM Lucknow', location: { lat: 26.8480, lng: 80.9520 }, pm25: 82, pm10: 140, zone: 1, ward: 2, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-027', name: 'Charbagh', location: { lat: 26.8450, lng: 80.9080 }, pm25: 195, pm10: 318, zone: 5, ward: 21, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-028', name: 'Amausi Airport', location: { lat: 26.7600, lng: 80.8820 }, pm25: 88, pm10: 150, zone: 6, ward: 36, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-029', name: 'IT City Sector', location: { lat: 26.8780, lng: 81.0100 }, pm25: 42, pm10: 72, zone: 3, ward: 13, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-030', name: 'Kakori', location: { lat: 26.8720, lng: 80.8350 }, pm25: 52, pm10: 90, zone: 5, ward: 40, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-031', name: 'Transport Nagar', location: { lat: 26.8930, lng: 80.9280 }, pm25: 220, pm10: 360, zone: 4, ward: 17, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-032', name: 'Naka Hindola', location: { lat: 26.8810, lng: 80.9410 }, pm25: 159, pm10: 268, zone: 4, ward: 19, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-033', name: 'Daliganj', location: { lat: 26.8880, lng: 80.9680 }, pm25: 98, pm10: 170, zone: 4, ward: 15, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-034', name: 'Cantt Railway', location: { lat: 26.8260, lng: 80.9430 }, pm25: 114, pm10: 196, zone: 6, ward: 26, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-035', name: 'Sector C LDA', location: { lat: 26.8440, lng: 80.9680 }, pm25: 75, pm10: 128, zone: 3, ward: 10, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-036', name: 'Old Lucknow Core', location: { lat: 26.8590, lng: 80.9050 }, pm25: 240, pm10: 395, zone: 5, ward: 23, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-037', name: 'Gudamba', location: { lat: 26.8940, lng: 80.8950 }, pm25: 185, pm10: 305, zone: 5, ward: 42, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-038', name: 'Thakurganj', location: { lat: 26.8730, lng: 80.8880 }, pm25: 170, pm10: 280, zone: 5, ward: 41, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-039', name: 'Sitapur Road', location: { lat: 26.9080, lng: 80.9530 }, pm25: 108, pm10: 185, zone: 4, ward: 44, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
    { id: 'LKO-040', name: 'Faizabad Road', location: { lat: 26.8820, lng: 81.0000 }, pm25: 64, pm10: 112, zone: 3, ward: 13, lastUpdated: '2026-02-26T05:31:00+05:30', isActive: true },
];

export function getSensorsByDistrict(districtId: string): Sensor[] {
    const id = districtId.toLowerCase();
    if (id === 'haryana-gurugram' || id === 'gurugram') return gurugramSensors;
    if (id === 'uttar-pradesh-lucknow' || id === 'lucknow') return lucknowSensors;
    return [];
}

export function getAllSensors(): Record<string, Sensor[]> {
    return {
        gurugram: gurugramSensors,
        lucknow: lucknowSensors,
    };
}
