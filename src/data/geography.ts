import type { District } from '../types';

/**
 * Minimal static fallback — used only when the backend API is unreachable.
 * The real district list (732 districts, all states) comes from the backend.
 */
export const districts: District[] = [
    {
        id: 'haryana-gurugram',
        name: 'Gurugram',
        state: 'Haryana',
        center: { lat: 28.4595, lng: 77.0266 },
        zoom: 12,
        wards: Array.from({ length: 35 }, (_, i) => ({
            id: `haryana-gurugram-w${i + 1}`,
            name: `Ward ${i + 1}`,
            number: i + 1,
        })),
    },
    {
        id: 'uttar-pradesh-lucknow',
        name: 'Lucknow',
        state: 'Uttar Pradesh',
        center: { lat: 26.8312, lng: 80.889 },
        zoom: 12,
        wards: Array.from({ length: 110 }, (_, i) => ({
            id: `uttar-pradesh-lucknow-w${i + 1}`,
            name: `Ward ${i + 1}`,
            number: i + 1,
        })),
    },
];

export function getDistrictById(id: string): District | undefined {
    return districts.find((d) => d.id === id);
}

export function getDistrictsByState(state: string): District[] {
    return districts.filter((d) => d.state === state);
}

export const states = [...new Set(districts.map((d) => d.state))];
