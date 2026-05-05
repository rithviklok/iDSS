/**
 * Inverse Distance Weighting (IDW) Interpolation
 * Used to generate a continuous pollution surface from discrete sensor readings.
 */

import type { LatLng } from '../types';

interface IDWPoint {
    lat: number;
    lng: number;
    value: number;
}

interface IDWOptions {
    power?: number;        // Weighting power (default: 2)
    gridSize?: number;     // Number of cells per axis (default: 80)
    maxDistance?: number;   // Max distance for influence in degrees (default: 0.15)
}

interface IDWGrid {
    data: number[][];
    bounds: {
        north: number;
        south: number;
        east: number;
        west: number;
    };
    cellWidth: number;
    cellHeight: number;
}

// Fast approximate distance in km using equirectangular projection.
// Avoids trig-heavy haversine — accurate enough for IDW at district scale.
function approxDistanceKm(a: LatLng, b: LatLng): number {
    const DEG_TO_KM_LAT = 111.32;
    const midLatRad = ((a.lat + b.lat) / 2) * (Math.PI / 180);
    const dLat = (b.lat - a.lat) * DEG_TO_KM_LAT;
    const dLng = (b.lng - a.lng) * DEG_TO_KM_LAT * Math.cos(midLatRad);
    return Math.sqrt(dLat * dLat + dLng * dLng);
}

export function computeIDW(
    points: IDWPoint[],
    bounds: { north: number; south: number; east: number; west: number },
    options: IDWOptions = {}
): IDWGrid {
    const { power = 2, gridSize = 80, maxDistance = 15 } = options;

    const cellWidth = (bounds.east - bounds.west) / gridSize;
    const cellHeight = (bounds.north - bounds.south) / gridSize;

    const grid: number[][] = [];

    for (let row = 0; row < gridSize; row++) {
        grid[row] = [];
        for (let col = 0; col < gridSize; col++) {
            const cellLat = bounds.south + (row + 0.5) * cellHeight;
            const cellLng = bounds.west + (col + 0.5) * cellWidth;

            let numerator = 0;
            let denominator = 0;
            let exactMatch = false;

            for (const point of points) {
                const dist = approxDistanceKm(
                    { lat: cellLat, lng: cellLng },
                    { lat: point.lat, lng: point.lng }
                );

                if (dist < 0.01) {
                    grid[row][col] = point.value;
                    exactMatch = true;
                    break;
                }

                if (dist <= maxDistance) {
                    const weight = 1 / Math.pow(dist, power);
                    numerator += weight * point.value;
                    denominator += weight;
                }
            }

            if (!exactMatch) {
                grid[row][col] = denominator > 0 ? numerator / denominator : 0;
            }
        }
    }

    return { data: grid, bounds, cellWidth, cellHeight };
}

/** Raster shape expected by MapView HeatmapLayer `draw()` */
export interface HeatmapRaster {
    data: number[][];
    bounds: { north: number; south: number; east: number; west: number };
}

/**
 * Convert DSS GET /map/pollution-grid response `grid` into a 2D array for canvas rendering.
 * Server order: row = latitude (south→north), column = longitude (west→east).
 */
export function pollutionGridToRaster(grid: {
    rows: number;
    columns: number;
    values: [number, number, number][];
    bounds: { north: number; south: number; east: number; west: number };
}): HeatmapRaster | null {
    const { rows, columns, values, bounds } = grid;
    if (!values?.length || rows < 1 || columns < 1) return null;

    const data: number[][] = [];
    const expected = rows * columns;

    if (values.length === expected) {
        // Server returned exact grid — read sequentially
        let idx = 0;
        for (let r = 0; r < rows; r++) {
            data[r] = [];
            for (let c = 0; c < columns; c++) {
                const triple = values[idx++];
                const v = triple ? Number(triple[0]) : 0;
                data[r][c] = Number.isFinite(v) ? v : 0;
            }
        }
    } else {
        // Sparse grid — place values by lat/lng position
        for (let r = 0; r < rows; r++) {
            data[r] = new Array(columns).fill(0);
        }
        const latStep = (bounds.north - bounds.south) / (rows - 1 || 1);
        const lngStep = (bounds.east - bounds.west) / (columns - 1 || 1);
        for (const triple of values) {
            const v = Number(triple[0]);
            if (!Number.isFinite(v)) continue;
            const r = Math.round((Number(triple[1]) - bounds.south) / latStep);
            const c = Math.round((Number(triple[2]) - bounds.west) / lngStep);
            if (r >= 0 && r < rows && c >= 0 && c < columns) {
                data[r][c] = v;
            }
        }
    }
    return { data, bounds };
}

/**
 * Maps a PM2.5 value to an RGBA color using CPCB standard scale.
 * Colors are saturated for clear visibility on map overlays.
 */
export function pm25ToColor(value: number, alpha: number = 0.6): string {
    if (value <= 30) {
        // Good - Bright Green
        const t = value / 30;
        return `rgba(${Math.round(34 + t * 20)}, ${Math.round(180 + t * 40)}, ${Math.round(34)}, ${alpha})`;
    } else if (value <= 60) {
        // Satisfactory - Green → Yellow
        const t = (value - 30) / 30;
        return `rgba(${Math.round(54 + t * 190)}, ${Math.round(220 - t * 40)}, ${Math.round(34 - t * 14)}, ${alpha})`;
    } else if (value <= 90) {
        // Moderate - Yellow → Orange
        const t = (value - 60) / 30;
        return `rgba(${Math.round(244 + t * 11)}, ${Math.round(180 - t * 60)}, ${Math.round(20)}, ${alpha})`;
    } else if (value <= 120) {
        // Poor - Orange → Red-Orange
        const t = (value - 90) / 30;
        return `rgba(${Math.round(255)}, ${Math.round(120 - t * 70)}, ${Math.round(20)}, ${alpha})`;
    } else if (value <= 250) {
        // Very Poor to Severe - Red → Dark Red
        const t = Math.min((value - 120) / 130, 1);
        return `rgba(${Math.round(255 - t * 80)}, ${Math.round(50 - t * 40)}, ${Math.round(10)}, ${alpha})`;
    } else {
        // Severe+
        return `rgba(128, 0, 0, ${alpha})`;
    }
}

/**
 * CPCB-standard PM2.5 colormap (matching aq-gis-frontend).
 * Stops are in PM2.5 units (µg/m³) with linear interpolation between them.
 */
const HEATMAP_STOPS: [number, number, number, number][] = [
    //  PM2.5   R    G    B
    [  0,       0, 176,  80],   // Good          – #00B050
    [ 30,     146, 208,  80],   // Satisfactory  – #92D050
    [ 60,     255, 255,   0],   // Moderate      – #FFFF00
    [ 90,     255, 126,   0],   // Poor          – #FF7E00
    [120,     255,   0,   0],   // Very Poor     – #FF0000
    [250,     126,   0,  35],   // Severe        – #7E0023
];

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/** Returns [r, g, b] (0-255) for a PM2.5 value — green→yellow→red colormap */
export function pm25ToRGB(value: number): [number, number, number] {
    const v = Math.max(value, 0);
    // Interpolate directly on PM2.5 stops (not normalized)
    for (let i = 0; i < HEATMAP_STOPS.length - 1; i++) {
        const [t0, r0, g0, b0] = HEATMAP_STOPS[i];
        const [t1, r1, g1, b1] = HEATMAP_STOPS[i + 1];
        if (v >= t0 && v <= t1) {
            const f = (v - t0) / (t1 - t0);
            return [
                Math.round(lerp(r0, r1, f)),
                Math.round(lerp(g0, g1, f)),
                Math.round(lerp(b0, b1, f)),
            ];
        }
    }
    const last = HEATMAP_STOPS[HEATMAP_STOPS.length - 1];
    return [last[1], last[2], last[3]];
}

/**
 * Render a smooth heatmap using bilinear interpolation of the IDW grid.
 * Writes directly to an ImageData buffer at the target canvas resolution.
 */
export function renderSmoothHeatmap(
    grid: number[][],
    width: number,
    height: number,
    alpha: number = 0.85,
): ImageData {
    const rows = grid.length;
    const cols = grid[0].length;
    const imageData = new ImageData(width, height);
    const buf = imageData.data;
    const a = Math.round(alpha * 255);

    for (let py = 0; py < height; py++) {
        // Map pixel y → grid row (grid row 0 = south, pixel y 0 = top/north)
        const gy = ((height - 1 - py) / (height - 1)) * (rows - 1);
        const r0 = Math.floor(gy);
        const r1 = Math.min(r0 + 1, rows - 1);
        const ry = gy - r0;

        for (let px = 0; px < width; px++) {
            const gx = (px / (width - 1)) * (cols - 1);
            const c0 = Math.floor(gx);
            const c1 = Math.min(c0 + 1, cols - 1);
            const rx = gx - c0;

            // Bilinear interpolation of PM2.5 value
            const v00 = grid[r0][c0];
            const v01 = grid[r0][c1];
            const v10 = grid[r1][c0];
            const v11 = grid[r1][c1];
            const val = v00 * (1 - rx) * (1 - ry)
                      + v01 * rx * (1 - ry)
                      + v10 * (1 - rx) * ry
                      + v11 * rx * ry;

            const [r, g, b] = pm25ToRGB(Math.max(val, 0));
            const idx = (py * width + px) * 4;
            buf[idx] = r;
            buf[idx + 1] = g;
            buf[idx + 2] = b;
            buf[idx + 3] = a;
        }
    }
    return imageData;
}

/**
 * Returns the AQI category label for a PM2.5 value
 */
export function getAQICategory(pm25: number): { label: string; color: string } {
    if (pm25 <= 30) return { label: 'Good', color: '#00b050' };
    if (pm25 <= 60) return { label: 'Satisfactory', color: '#92d050' };
    if (pm25 <= 90) return { label: 'Moderate', color: '#ffff00' };
    if (pm25 <= 120) return { label: 'Poor', color: '#ff9900' };
    if (pm25 <= 250) return { label: 'Very Poor', color: '#ff0000' };
    return { label: 'Severe', color: '#800000' };
}

/**
 * Simple PM2.5 to AQI conversion (approximate, Indian AQI standard)
 */
export function pm25ToAQI(pm25: number): number {
    if (pm25 <= 30) return Math.round((50 / 30) * pm25);
    if (pm25 <= 60) return Math.round(50 + ((50 / 30) * (pm25 - 30)));
    if (pm25 <= 90) return Math.round(100 + ((100 / 30) * (pm25 - 60)));
    if (pm25 <= 120) return Math.round(200 + ((100 / 30) * (pm25 - 90)));
    if (pm25 <= 250) return Math.round(300 + ((100 / 130) * (pm25 - 120)));
    return Math.round(400 + ((100 / 130) * (pm25 - 250)));
}
