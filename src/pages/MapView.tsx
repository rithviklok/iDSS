import { useState, useEffect, useCallback, useRef, useMemo, type Dispatch, type SetStateAction } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Layers, Eye, EyeOff, Play, Pause } from 'lucide-react';
import { useLocation } from '../contexts/LocationContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { fetchSensors, fetchHotspots, fetchAirsheds, fetchSourceContributions, fetchHeatmap, fetchPollutionGrid, fetchDssTriggers, fetchForecast, fetchDssStats, fetchSensorPlotReadings, fetchSensorSources, fetchSourcePinpointing } from '../services/api';
import type { ForecastPoint, ForecastStation, ForecastResult, SensorPlotReading } from '../services/api';
import { computeIDW, getAQICategory, pm25ToAQI, pollutionGridToRaster, renderSmoothHeatmap, type HeatmapRaster } from '../utils/idw';
import type { Sensor, MapLayerState, Hotspot, Airshed, SourceContribution, HeatmapPoint, HotspotMode } from '../types';

function getSensorColor(pm25: number): string {
    if (pm25 <= 30) return '#00b050';
    if (pm25 <= 60) return '#92d050';
    if (pm25 <= 90) return '#cccc00';
    if (pm25 <= 120) return '#ff9900';
    if (pm25 <= 250) return '#ff0000';
    return '#800000';
}

// ========== Heatmap Canvas Layer (server pollution grid → IDW fallback → sensors) ==========
function HeatmapLayer({
    serverRaster,
    heatmapPoints,
    sensors,
    visible,
    districtsGeoJson,
    selectedDistrictId,
    lucknowBoundary,
}: {
    /** From GET /map/pollution-grid (pollution_readings + server IDW); takes precedence */
    serverRaster: HeatmapRaster | null;
    heatmapPoints: HeatmapPoint[] | null;
    sensors: Sensor[];
    visible: boolean;
    districtsGeoJson: GeoJSON.FeatureCollection | null;
    selectedDistrictId: string;
    /** Dedicated Lucknow boundary GeoJSON — used for clipping instead of districts-boundaries */
    lucknowBoundary: GeoJSON.FeatureCollection | null;
}) {
    const map = useMap();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const layerRef = useRef<L.Layer | null>(null);

    // Prefer lucknow-boundary.json so the heatmap clip matches the visible boundary layer.
    // Fall back to districts-boundaries.json if the dedicated file is unavailable.
    const districtFeature = useMemo(() => {
        if (lucknowBoundary?.features?.length) {
            return lucknowBoundary.features[0];
        }
        if (!districtsGeoJson) return null;
        return districtsGeoJson.features.find(f =>
            districtNameMatches((f.properties || {}) as Record<string, unknown>, selectedDistrictId)
        ) ?? null;
    }, [lucknowBoundary, districtsGeoJson, selectedDistrictId]);

    const idwGrid = useMemo(() => {
        if (serverRaster?.data?.length && serverRaster.bounds) {
            const rows = serverRaster.data.length;
            const cols = serverRaster.data[0]?.length ?? 0;
            if (rows > 0 && cols > 0) {
                return { data: serverRaster.data, bounds: serverRaster.bounds };
            }
        }

        const points: HeatmapPoint[] = heatmapPoints?.length
            ? heatmapPoints
            : sensors.map(s => ({ lat: s.location.lat, lng: s.location.lng, value: s.pm25 }));
        if (!points.length) return null;

        // Use district GeoJSON bounds so the grid covers the whole district shape
        let north = -90, south = 90, east = -180, west = 180;
        if (districtFeature) {
            const geom = districtFeature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
            const polygons = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
            for (const polygon of polygons) {
                for (const ring of polygon) {
                    for (const coord of ring) {
                        const lng = coord[0], lat = coord[1];
                        if (lat > north) north = lat;
                        if (lat < south) south = lat;
                        if (lng > east) east = lng;
                        if (lng < west) west = lng;
                    }
                }
            }
        } else {
            const lats = points.map(p => p.lat);
            const lngs = points.map(p => p.lng);
            const pad = 0.05;
            north = Math.max(...lats) + pad;
            south = Math.min(...lats) - pad;
            east = Math.max(...lngs) + pad;
            west = Math.min(...lngs) - pad;
        }

        return computeIDW(
            points,
            { north, south, east, west },
            { power: 2, gridSize: 120, maxDistance: 50 }
        );
    }, [serverRaster, heatmapPoints, sensors, districtFeature]);

    const draw = useCallback(() => {
        if (!idwGrid || !visible) return;
        const { data, bounds } = idwGrid;
        const rows = data.length;
        const cols = data[0].length;

        // High-resolution canvas: 4px per grid cell for smooth output
        const SCALE = 4;
        const W = cols * SCALE;
        const H = rows * SCALE;

        if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas');
        }
        const canvas = canvasRef.current;
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, W, H);

        // Geo → canvas pixel helpers
        const toX = (lng: number) => ((lng - bounds.west) / (bounds.east - bounds.west)) * W;
        const toY = (lat: number) => ((bounds.north - lat) / (bounds.north - bounds.south)) * H;

        // Render smooth bilinear-interpolated heatmap into ImageData
        const imageData = renderSmoothHeatmap(data, W, H, 0.92);

        // Draw the smooth heatmap, then clip to district boundaries
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = W;
        tempCanvas.height = H;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;
        tempCtx.putImageData(imageData, 0, 0);

        ctx.save();

        // Clip canvas to district polygon boundary
        if (districtFeature) {
            ctx.beginPath();
            const geom = districtFeature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
            const polygons = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
            for (const polygon of polygons) {
                for (const ring of polygon) {
                    let first = true;
                    for (const coord of ring) {
                        const x = toX(coord[0]);
                        const y = toY(coord[1]);
                        if (first) { ctx.moveTo(x, y); first = false; }
                        else ctx.lineTo(x, y);
                    }
                    ctx.closePath();
                }
            }
            ctx.clip('evenodd');
        }

        // Draw the smooth heatmap onto the clipped context
        ctx.drawImage(tempCanvas, 0, 0);

        ctx.restore();

        if (layerRef.current) {
            map.removeLayer(layerRef.current);
        }

        // Ensure heatmap pane exists above the overlay pane (z-index 450 > default overlay 400)
        if (!map.getPane('heatmapPane')) {
            const pane = map.createPane('heatmapPane');
            pane.style.zIndex = '450';
            pane.style.pointerEvents = 'none';
        }

        const imageBounds: L.LatLngBoundsExpression = [
            [bounds.south, bounds.west],
            [bounds.north, bounds.east],
        ];
        const overlay = L.imageOverlay(canvas.toDataURL(), imageBounds, {
            opacity: 0.9,
            interactive: false,
            pane: 'heatmapPane',
        });
        overlay.addTo(map);
        layerRef.current = overlay;
    }, [idwGrid, map, visible, districtFeature]);

    useEffect(() => {
        if (visible) {
            draw();
        } else if (layerRef.current) {
            map.removeLayer(layerRef.current);
            layerRef.current = null;
        }
    }, [visible, draw, map]);

    return null;
}

// ========== Sensor Markers ==========

const SOURCE_COLORS: Record<string, string> = {
    Dust: '#f59e0b', 'Road dust': '#f59e0b',
    'Traffic Emission': '#ef4444',
    'Biomass burning': '#10b981', 'Garbage Burning': '#84cc16',
    'Industrial emission': '#6366f1', 'Industrial Waste burning': '#8b5cf6', 'Industrial Waste Burning': '#8b5cf6',
    'Coal combustion': '#78716c', 'Fireworks': '#ec4899',
    'Regionally Oxidised': '#06b6d4', 'Urban Oxidised': '#0ea5e9',
};

function buildDhsaPieChart(sources: { label: string; percentage: number }[]): string {
    const cx = 65, cy = 65, outerR = 55, innerR = 28;
    const total = sources.reduce((sum, s) => sum + s.percentage, 0);
    if (total === 0 || sources.length === 0) return '';

    let currentAngle = -Math.PI / 2;
    let paths = '';
    let labels = '';

    sources.forEach(s => {
        const sliceAngle = (s.percentage / total) * 2 * Math.PI;
        const endAngle = currentAngle + sliceAngle;
        const color = SOURCE_COLORS[s.label] || '#6b7280';
        const largeArc = sliceAngle > Math.PI ? 1 : 0;
        const midAngle = currentAngle + sliceAngle / 2;
        const labelR = (innerR + outerR) / 2;
        const lx = cx + labelR * Math.cos(midAngle);
        const ly = cy + labelR * Math.sin(midAngle);

        if (Math.abs(sliceAngle - 2 * Math.PI) < 0.0001) {
            // Full circle — draw as two halves to avoid degenerate arc
            paths += `
                <path d="M${cx},${cy - outerR} A${outerR},${outerR} 0 1 1 ${cx - 0.001},${cy - outerR} Z" fill="${color}" opacity="0.92"/>`;
        } else {
            const ox1 = cx + outerR * Math.cos(currentAngle);
            const oy1 = cy + outerR * Math.sin(currentAngle);
            const ox2 = cx + outerR * Math.cos(endAngle);
            const oy2 = cy + outerR * Math.sin(endAngle);
            const ix1 = cx + innerR * Math.cos(currentAngle);
            const iy1 = cy + innerR * Math.sin(currentAngle);
            const ix2 = cx + innerR * Math.cos(endAngle);
            const iy2 = cy + innerR * Math.sin(endAngle);
            paths += `<path d="M${ix1.toFixed(2)},${iy1.toFixed(2)} L${ox1.toFixed(2)},${oy1.toFixed(2)} A${outerR},${outerR} 0 ${largeArc} 1 ${ox2.toFixed(2)},${oy2.toFixed(2)} L${ix2.toFixed(2)},${iy2.toFixed(2)} A${innerR},${innerR} 0 ${largeArc} 0 ${ix1.toFixed(2)},${iy1.toFixed(2)} Z" fill="${color}" opacity="0.92" stroke="#1a1f35" stroke-width="1"/>`;
        }

        // Render % label only when slice is wide enough to fit text
        if (s.percentage >= 6) {
            labels += `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="middle" dominant-baseline="central" fill="white" font-size="9" font-weight="700" font-family="Inter,sans-serif" style="pointer-events:none;">${s.percentage}%</text>`;
        }

        currentAngle = endAngle;
    });

    return `
        <svg width="130" height="130" viewBox="0 0 130 130" style="display:block;margin:0 auto;">
            ${paths}
            <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="#1a1f35"/>
            ${labels}
        </svg>`;
}

const PM25_STANDARD = 60;

function downsamplePlotPoints<T>(points: T[], maxPoints: number): T[] {
    if (points.length <= maxPoints) return points;
    if (maxPoints <= 1) return [points[points.length - 1]];

    const sampled: T[] = [];
    const stride = (points.length - 1) / (maxPoints - 1);
    for (let index = 0; index < maxPoints; index += 1) {
        sampled.push(points[Math.round(index * stride)]);
    }
    return sampled;
}

function formatPopupChartLabel(timestamp: string, withDate = false): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('en-IN', {
        day: withDate ? '2-digit' : undefined,
        month: withDate ? 'short' : undefined,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date).replace(',', '');
}

function buildPopupEmptyState(message: string): string {
    return `
        <div style="display:flex;align-items:center;justify-content:center;min-height:120px;padding:14px;border:1px dashed #334155;border-radius:10px;background:#0f172a66;color:#94a3b8;font-size:11px;text-align:center;">
            ${message}
        </div>`;
}

function buildWindPolarChart(readings: SensorPlotReading[]): string {
    const points = downsamplePlotPoints(
        readings.filter((reading) =>
            reading.pm25 != null &&
            reading.windSpeed != null &&
            reading.windDir != null &&
            Number.isFinite(reading.pm25) &&
            Number.isFinite(reading.windSpeed) &&
            Number.isFinite(reading.windDir) &&
            Number(reading.windSpeed) > 0,
        ),
        140,
    );

    if (!points.length) {
        return buildPopupEmptyState('Wind speed and direction data is not available in recent DB readings.');
    }

    const size = 220;
    const cx = 110;
    const cy = 104;
    const maxRadius = 72;
    const maxWind = Math.max(4, Math.ceil(Math.max(...points.map((point) => Number(point.windSpeed ?? 0))) / 2) * 2);
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const rings = [0.25, 0.5, 0.75, 1];
    const latest = points[points.length - 1];

    const gridCircles = rings.map((ratio) => {
        const radius = maxRadius * ratio;
        const label = Math.round(maxWind * ratio * 10) / 10;
        return `
            <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#334155" stroke-width="1" opacity="0.9" />
            <text x="${cx + 6}" y="${cy - radius - 4}" fill="#94a3b8" font-size="9">${label}</text>`;
    }).join('');

    const spokes = directions.map((label, index) => {
        const angle = (index * 45 * Math.PI) / 180;
        const x = cx + maxRadius * Math.sin(angle);
        const y = cy - maxRadius * Math.cos(angle);
        const lx = cx + (maxRadius + 14) * Math.sin(angle);
        const ly = cy - (maxRadius + 14) * Math.cos(angle);
        return `
            <line x1="${cx}" y1="${cy}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" stroke="#233047" stroke-width="1" opacity="0.85" />
            <text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" fill="#cbd5e1" font-size="10" text-anchor="middle" dominant-baseline="middle">${label}</text>`;
    }).join('');

    const markers = points.map((point) => {
        const direction = Number(point.windDir ?? 0);
        const speed = Number(point.windSpeed ?? 0);
        const radius = Math.min(maxRadius, (speed / maxWind) * maxRadius);
        const x = cx + radius * Math.sin((direction * Math.PI) / 180);
        const y = cy - radius * Math.cos((direction * Math.PI) / 180);
        const fill = getSensorColor(Number(point.pm25 ?? 0));
        return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3.4" fill="${fill}" fill-opacity="0.82" stroke="#e2e8f0" stroke-opacity="0.35" stroke-width="0.7" />`;
    }).join('');

    return `
        <div style="border:1px solid #233047;border-radius:10px;padding:10px;background:#0f172acc;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;">
                <div>
                    <div style="font-size:11px;font-weight:700;color:#e2e8f0;">Wind Speed vs Direction</div>
                    <div style="font-size:10px;color:#94a3b8;">Polar scatter colored by PM2.5</div>
                </div>
                <div style="font-size:10px;color:#cbd5e1;text-align:right;line-height:1.4;">
                    <div>Latest: ${latest.windSpeed?.toFixed(1) ?? '—'} m/s</div>
                    <div>${Math.round(Number(latest.windDir ?? 0))}°</div>
                </div>
            </div>
            <svg viewBox="0 0 ${size} 220" style="display:block;width:100%;height:auto;overflow:visible;">
                ${gridCircles}
                ${spokes}
                <circle cx="${cx}" cy="${cy}" r="2.5" fill="#e2e8f0" opacity="0.8" />
                ${markers}
                <text x="12" y="196" fill="#94a3b8" font-size="10">Max wind: ${maxWind.toFixed(1)} m/s</text>
                <text x="208" y="196" fill="#94a3b8" font-size="10" text-anchor="end">Color: PM2.5</text>
            </svg>
        </div>`;
}

function buildPm25TimeseriesChart(readings: SensorPlotReading[]): string {
    const points = downsamplePlotPoints(
        readings.filter((reading) => reading.pm25 != null && Number.isFinite(reading.pm25)),
        96,
    );

    if (!points.length) {
        return buildPopupEmptyState('PM2.5 history is not available in recent DB readings.');
    }

    const width = 320;
    const height = 170;
    const left = 34;
    const right = 12;
    const top = 14;
    const bottom = 34;
    const innerWidth = width - left - right;
    const innerHeight = height - top - bottom;
    const peak = Math.max(...points.map((point) => Number(point.pm25 ?? 0)));
    const latest = Number(points[points.length - 1].pm25 ?? 0);
    const mean = points.reduce((sum, point) => sum + Number(point.pm25 ?? 0), 0) / points.length;
    const yMax = Math.max(80, PM25_STANDARD * 1.4, Math.ceil((peak * 1.15) / 10) * 10);
    const xDenominator = Math.max(points.length - 1, 1);
    const yTicks = [0, yMax / 2, yMax];

    const getX = (index: number) => left + (index / xDenominator) * innerWidth;
    const getY = (value: number) => top + innerHeight - (Math.min(value, yMax) / yMax) * innerHeight;
    const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(index).toFixed(2)} ${getY(Number(point.pm25 ?? 0)).toFixed(2)}`).join(' ');
    const areaPath = `${linePath} L ${getX(points.length - 1).toFixed(2)} ${(top + innerHeight).toFixed(2)} L ${getX(0).toFixed(2)} ${(top + innerHeight).toFixed(2)} Z`;
    const standardY = getY(PM25_STANDARD);
    const labelIndexes = [...new Set([0, Math.floor(xDenominator / 3), Math.floor((2 * xDenominator) / 3), xDenominator])];

    return `
        <div style="border:1px solid #233047;border-radius:10px;padding:10px;background:#0f172acc;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;">
                <div>
                    <div style="font-size:11px;font-weight:700;color:#e2e8f0;">PM2.5 Time Series</div>
                    <div style="font-size:10px;color:#94a3b8;">Recent DB readings with NAAQS reference</div>
                </div>
                <div style="font-size:10px;color:#cbd5e1;text-align:right;line-height:1.4;">
                    <div>Latest: ${Math.round(latest)} µg/m³</div>
                    <div>Peak: ${Math.round(peak)} µg/m³</div>
                    <div>Avg: ${Math.round(mean)} µg/m³</div>
                </div>
            </div>
            <svg viewBox="0 0 ${width} ${height}" style="display:block;width:100%;height:auto;overflow:visible;">
                <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="transparent" />
                <rect x="${left}" y="${top}" width="${innerWidth}" height="${innerHeight}" fill="#111827" opacity="0.35" rx="6" />
                <rect x="${left}" y="0" width="${innerWidth}" height="${standardY.toFixed(2)}" fill="#7f1d1d" opacity="0.06" rx="6" />
                ${yTicks.map((tick) => `
                    <g>
                        <line x1="${left}" y1="${getY(tick).toFixed(2)}" x2="${width - right}" y2="${getY(tick).toFixed(2)}" stroke="#334155" stroke-width="1" />
                        <text x="${left - 6}" y="${(getY(tick) + 3).toFixed(2)}" fill="#94a3b8" font-size="9" text-anchor="end">${Math.round(tick)}</text>
                    </g>`).join('')}
                <path d="${areaPath}" fill="#38bdf8" fill-opacity="0.12" />
                <path d="${linePath}" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                ${points.map((point, index) => {
                    const value = Number(point.pm25 ?? 0);
                    const isExceedance = value > PM25_STANDARD;
                    return `<circle cx="${getX(index).toFixed(2)}" cy="${getY(value).toFixed(2)}" r="${isExceedance ? '2.8' : '2.2'}" fill="${isExceedance ? '#f87171' : '#bae6fd'}" />`;
                }).join('')}
                <line x1="${left}" y1="${standardY.toFixed(2)}" x2="${width - right}" y2="${standardY.toFixed(2)}" stroke="#f97316" stroke-width="1.4" stroke-dasharray="5 4" />
                <text x="${width - right}" y="${(standardY - 6).toFixed(2)}" fill="#fdba74" font-size="9" text-anchor="end">NAAQS ${PM25_STANDARD}</text>
                ${labelIndexes.map((index) => {
                    const timestamp = points[index]?.timestamp;
                    const label = formatPopupChartLabel(timestamp, index === 0 || index === xDenominator);
                    return `
                        <g>
                            <line x1="${getX(index).toFixed(2)}" y1="${top + innerHeight}" x2="${getX(index).toFixed(2)}" y2="${top + innerHeight + 4}" stroke="#475569" stroke-width="1" />
                            <text x="${getX(index).toFixed(2)}" y="${height - 10}" fill="#94a3b8" font-size="8.5" text-anchor="middle">${label}</text>
                        </g>`;
                }).join('')}
            </svg>
        </div>`;
}

function buildSensorPlotsSection(readings: SensorPlotReading[]): string {
    return `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid #334155;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                <span style="color:#38bdf8;font-size:14px;">◌</span>
                <span style="color:#38bdf8;font-size:11px;font-weight:600;">SENSOR TRENDS</span>
            </div>
            <div style="display:grid;gap:10px;">
                ${buildWindPolarChart(readings)}
                ${buildPm25TimeseriesChart(readings)}
            </div>
        </div>`;
}

/** Close sensor popup when clicking on the map background (not on a marker). */
function MapClickHandler({ onDeselect }: { onDeselect: () => void }) {
    const map = useMap();
    useEffect(() => {
        const handler = () => {
            map.closePopup();
            onDeselect();
        };
        map.on('click', handler);
        return () => { map.off('click', handler); };
    }, [map, onDeselect]);
    return null;
}

function SensorMarkers({
    sensors,
    visible,
    onSelect,
    selectedId,
    districtId,
    onAffectedWards,
    forecastOverrides,
}: {
    sensors: Sensor[];
    visible: boolean;
    onSelect: (s: Sensor | null) => void;
    selectedId: string | null;
    districtId?: string;
    onAffectedWards?: (wards: { wardName: string; percentage: number }[]) => void;
    forecastOverrides?: Map<string, number> | null;
}) {
    const map = useMap();
    const markersRef = useRef<L.Marker[]>([]);
    const popupRef = useRef<L.Popup | null>(null);

    // Close popup only when the sensors layer is hidden (not when sensors data refreshes)
    useEffect(() => {
        if (!visible && popupRef.current) {
            onAffectedWards?.([]);
            map.closePopup(popupRef.current);
            popupRef.current = null;
        }
    }, [visible, map, onAffectedWards]);

    useEffect(() => {
        markersRef.current.forEach(m => map.removeLayer(m));
        markersRef.current = [];

        if (!visible) return;

        sensors.forEach(sensor => {
            const isForecast = forecastOverrides?.has(sensor.id);
            const displayPm25 = isForecast ? forecastOverrides!.get(sensor.id)! : sensor.pm25;
            const color = getSensorColor(displayPm25);
            const isGas = sensor.co != null || sensor.no2 != null || sensor.so2 != null || sensor.o3 != null || sensor.nh3 != null;
            const size = isGas ? 40 : 36;
            const half = size / 2;
            const forecastBorder = isForecast ? `border: 2px solid rgba(99,102,241,0.9); box-shadow: 0 0 10px rgba(99,102,241,0.5);` : '';
            const icon = L.divIcon({
                html: `<div style="
          width: ${size}px; height: ${size}px; border-radius: 50%;
          background: ${color}; display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: white;
          ${isForecast ? forecastBorder : `border: ${isGas ? '3px solid #0f172a' : '2px solid rgba(255,255,255,0.3)'};`}
          ${!isForecast && isGas ? 'box-shadow: 0 0 0 2px rgba(255,255,255,0.5), 0 2px 6px rgba(0,0,0,0.4);' : ''}
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
          cursor: pointer; font-family: Inter, sans-serif;
        ">${Math.round(displayPm25)}</div>`,
                className: '',
                iconSize: [size, size],
                iconAnchor: [half, half],
            });

            const marker = L.marker([sensor.location.lat, sensor.location.lng], { icon });
            marker.on('click', () => {
                const cat = getAQICategory(displayPm25);
                const aqiNumeric = pm25ToAQI(displayPm25);
                const healthLabel = sensor.isActive ? 'Active' : 'Inactive';
                const healthColor = sensor.isActive ? '#22c55e' : '#94a3b8';

                const fmtµg = (v: number | null | undefined, decimals?: number) =>
                    v != null && Number.isFinite(Number(v))
                        ? (decimals != null ? Number(v).toFixed(decimals) : String(Math.round(Number(v))))
                        : '—';
                const fmtPctRh = (v: number | null | undefined) =>
                    v != null && Number.isFinite(Number(v)) ? `${Math.round(Number(v))}%` : '—';
                const fmtTemp = (v: number | null | undefined) =>
                    v != null && Number.isFinite(Number(v)) ? `${Number(v).toFixed(1)} °C` : '—';
                const fmtWind = (v: number | null | undefined) =>
                    v != null && Number.isFinite(Number(v)) ? `${Number(v)} km/h` : '—';

                const airQualitySection = `
            <div style="padding-bottom:10px;border-bottom:1px solid #334155;">
              <div style="color:#94a3b8;font-size:10px;font-weight:600;letter-spacing:0.06em;margin-bottom:6px;">AIR QUALITY</div>
              <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:#94a3b8">PM2.5</span><span style="font-weight:600;color:${color}">${Math.round(displayPm25)} µg/m³</span></div>
              <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:#94a3b8">PM10</span><span style="font-weight:600">${fmtµg(sensor.pm10)} µg/m³</span></div>
              <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:#94a3b8">AQI</span><span style="font-weight:600;color:${cat.color}">${Math.round(aqiNumeric)} <span style="color:#cbd5e1;font-weight:500;font-size:12px;">(${cat.label})</span></span></div>
              <div style="font-size:10px;color:#64748b;margin-top:4px;line-height:1.35;">AQI is estimated from PM₂.₅ (Indian scale).</div>
            </div>`;

                const traceGasesSection = `
            <div style="margin-top:10px;padding-bottom:10px;border-bottom:1px solid #334155;">
              <div style="color:#94a3b8;font-size:10px;font-weight:600;letter-spacing:0.06em;margin-bottom:6px;">TRACE GASES</div>
              <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:#94a3b8">Carbon monoxide (CO)</span><span style="font-weight:600">${sensor.co != null ? `${fmtµg(sensor.co, 2)} µg/m³` : '—'}</span></div>
              <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:#94a3b8">Nitrogen dioxide (NO₂)</span><span style="font-weight:600">${sensor.no2 != null ? `${fmtµg(sensor.no2)} µg/m³` : '—'}</span></div>
              <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:#94a3b8">Ozone (O₃)</span><span style="font-weight:600">${sensor.o3 != null ? `${fmtµg(sensor.o3)} µg/m³` : '—'}</span></div>
              ${sensor.so2 != null ? `<div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:#94a3b8">Sulfur dioxide (SO₂)</span><span style="font-weight:600">${fmtµg(sensor.so2)} µg/m³</span></div>` : ''}
              ${sensor.nh3 != null ? `<div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:#94a3b8">Ammonia (NH₃)</span><span style="font-weight:600">${fmtµg(sensor.nh3)} µg/m³</span></div>` : ''}
            </div>`;

                const weatherSection = `
            <div style="margin-top:10px;padding-bottom:10px;border-bottom:1px solid #334155;">
              <div style="color:#94a3b8;font-size:10px;font-weight:600;letter-spacing:0.06em;margin-bottom:6px;">WEATHER</div>
              <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:#94a3b8">Temperature</span><span style="font-weight:600">${fmtTemp(sensor.temp)}</span></div>
              <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:#94a3b8">Relative humidity (RH)</span><span style="font-weight:600">${fmtPctRh(sensor.rh)}</span></div>
              <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:#94a3b8">Wind speed</span><span style="font-weight:600">${fmtWind(sensor.windSpeed)}</span></div>
            </div>`;

                const popupContainer = document.createElement('div');
                popupContainer.innerHTML = `
          <div style="background:#1a1f35;color:#f1f5f9;border-radius:10px;min-width:280px;max-width:340px;font-family:Inter,sans-serif;font-size:13px;max-height:480px;display:flex;flex-direction:column;overflow:hidden;">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 14px 8px;background:#1a1f35;position:sticky;top:0;z-index:1;flex-shrink:0;">
              <h4 style="font-size:14px;font-weight:600;margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sensor.name}</h4>
              <button id="remove-sensor-btn" title="Remove from map" style="flex-shrink:0;margin-left:8px;background:#2d3655;border:none;border-radius:6px;color:#94a3b8;cursor:pointer;padding:4px 8px;font-size:11px;display:flex;align-items:center;gap:4px;transition:background 0.15s;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                Remove
              </button>
            </div>
            <div style="overflow-y:auto;padding:0 14px 14px;flex:1;min-height:0;">
            ${airQualitySection}
            ${traceGasesSection}
            ${weatherSection}
            <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:#94a3b8">Sensor status</span><span style="font-weight:600;color:${healthColor}">${healthLabel}</span></div>
            <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:#94a3b8">Zone / Ward</span><span style="font-weight:600">Z${sensor.zone} / W${sensor.ward}</span></div>
            <div style="display:flex;justify-content:space-between;padding:3px 0;margin-bottom:10px"><span style="color:#94a3b8">ID</span><span style="font-family:monospace;font-size:11px">${sensor.id}</span></div>
            <div id="sensor-sources-section" style="margin-top:10px;padding-top:10px;border-top:1px solid #334155;">
              <div style="display:flex;align-items:center;gap:6px;color:#64748b;font-size:11px;">
                <span class="sensor-source-spinner" style="display:inline-block;width:12px;height:12px;border:2px solid #475569;border-top-color:#6366f1;border-radius:50%;animation:spin 0.8s linear infinite;"></span>
                Fetching pollution sources…
              </div>
            </div>
            <div id="sop-trigger-section"></div>
            <div id="source-pinpointing-section"></div>
                        <div id="sensor-plots-section" style="margin-top:10px;padding-top:10px;border-top:1px solid #334155;">
                            <div style="display:flex;align-items:center;gap:6px;color:#64748b;font-size:11px;">
                                <span class="sensor-source-spinner" style="display:inline-block;width:12px;height:12px;border:2px solid #475569;border-top-color:#38bdf8;border-radius:50%;animation:spin 0.8s linear infinite;"></span>
                                Fetching sensor trends…
                            </div>
                        </div>
            <div id="affected-wards-section"></div>
            </div>
          </div>
        `;

                const popup = L.popup({
                    closeButton: true,
                    closeOnClick: false,
                    autoClose: false,
                    className: 'sensor-leaflet-popup',
                    offset: [0, -18],
                })
                    .setLatLng([sensor.location.lat, sensor.location.lng])
                    .setContent(popupContainer);
                popup.on('remove', () => {
                    onAffectedWards?.([]);
                });
                popup.openOn(map);
                popupRef.current = popup;
                onSelect(sensor);

                // Wire up the Remove button after the popup DOM is in the page
                requestAnimationFrame(() => {
                    const removeBtn = popupContainer.querySelector('#remove-sensor-btn') as HTMLButtonElement | null;
                    if (removeBtn) {
                        removeBtn.addEventListener('mouseenter', () => {
                            removeBtn.style.background = '#3b2a2a';
                            removeBtn.style.color = '#f87171';
                        });
                        removeBtn.addEventListener('mouseleave', () => {
                            removeBtn.style.background = '#2d3655';
                            removeBtn.style.color = '#94a3b8';
                        });
                        removeBtn.addEventListener('click', () => {
                            map.closePopup(popup);
                            map.removeLayer(marker);
                            markersRef.current = markersRef.current.filter(m => m !== marker);
                            onAffectedWards?.([]);
                        });
                    }
                });

                // Fetch source pinpointing data (ward-level contributions)
                if (districtId) {
                    fetchSourcePinpointing(sensor.id, districtId, 5).then(spResult => {
                        const spDiv = popupContainer.querySelector('#source-pinpointing-section');
                        if (!spDiv || !spResult?.sensor) return;
                        const s = spResult.sensor;
                        const wards = s.wardContributions || [];
                        if (!wards.length && !s.outsideSourcesPct) return;

                        // Highlight contributing wards on the map with percentages
                        if (wards.length) {
                            onAffectedWards?.(wards.map((w: { wardName: string; percentage: number }) => ({
                                wardName: w.wardName,
                                percentage: Math.round(w.percentage),
                            })));
                        }

                        const windDirLabel = s.latestWindDir != null ? `${Math.round(s.latestWindDir)}°` : '—';
                        const outsidePct = s.outsideSourcesPct != null ? Math.round(s.outsideSourcesPct) : 0;

                        spDiv.innerHTML = `
                            <div style="margin-top:10px;padding-top:10px;border-top:1px solid #334155;">
                                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                                    <div style="display:flex;align-items:center;gap:6px;">
                                        <span style="color:#8b5cf6;font-size:14px;">◎</span>
                                        <span style="color:#8b5cf6;font-size:11px;font-weight:600;">SOURCE PINPOINTING</span>
                                    </div>
                                    <span style="font-size:9px;padding:1px 6px;border-radius:4px;background:#334155;color:#94a3b8;">Wind ${windDirLabel}</span>
                                </div>
                                ${wards.length ? `
                                <div style="margin-bottom:4px;">
                                    <div style="font-size:10px;color:#94a3b8;margin-bottom:4px;font-weight:600;">Top Contributing Wards</div>
                                    ${wards.map((w: { wardName: string; percentage: number; gridCount: number }, idx: number) => {
                                        const barColor = idx === 0 ? '#8b5cf6' : idx === 1 ? '#a78bfa' : '#c4b5fd';
                                        const pct = Math.round(w.percentage);
                                        return `
                                        <div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:11px;">
                                            <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e2e8f0;">${w.wardName}</div>
                                            <div style="width:60px;height:6px;background:#1e293b;border-radius:3px;overflow:hidden;flex-shrink:0;">
                                                <div style="width:${Math.min(pct, 100)}%;height:100%;background:${barColor};border-radius:3px;"></div>
                                            </div>
                                            <span style="font-weight:600;min-width:32px;text-align:right;color:#cbd5e1;">${pct}%</span>
                                        </div>`;
                                    }).join('')}
                                </div>` : ''}
                                ${outsidePct > 0 ? `
                                <div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;color:#94a3b8;">
                                    <span>Outside sources</span>
                                    <span style="font-weight:600;color:#f59e0b;">${outsidePct}%</span>
                                </div>` : ''}
                                <div style="font-size:9px;color:#475569;margin-top:4px;">Computed ${new Date(spResult.computedAt).toLocaleTimeString()}</div>
                            </div>
                        `;
                    }).catch(() => { /* source pinpointing not available — silent */ });
                }

                fetchSensorPlotReadings(sensor.id, 24).then(readings => {
                    const plotsDiv = popupContainer.querySelector('#sensor-plots-section');
                    if (!plotsDiv) return;

                    if (!readings.length) {
                        plotsDiv.innerHTML = buildSensorPlotsSection([]);
                        return;
                    }

                    plotsDiv.innerHTML = buildSensorPlotsSection(readings);
                }).catch(() => {
                    const plotsDiv = popupContainer.querySelector('#sensor-plots-section');
                    if (!plotsDiv) return;
                    plotsDiv.innerHTML = `
                        <div style="margin-top:10px;padding-top:10px;border-top:1px solid #334155;">
                            ${buildPopupEmptyState('Failed to load recent sensor trends from the database.')}
                        </div>`;
                });

                fetchSensorSources(sensor.id, districtId, displayPm25).then(result => {
                    // Show affected wards in popup (highlighting is handled by source pinpointing above)
                    if (result.affectedWards?.length) {
                        const wardsDiv = popupContainer.querySelector('#affected-wards-section');
                        if (wardsDiv) {
                            wardsDiv.innerHTML = `
                                <div style="margin-top:10px;padding-top:10px;border-top:1px solid #334155;">
                                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                                        <span style="color:#f59e0b;font-size:14px;">◉</span>
                                        <span style="color:#f59e0b;font-size:11px;font-weight:600;">AFFECTED WARDS (${result.affectedWards.length})</span>
                                    </div>
                                    <div style="display:flex;flex-wrap:wrap;gap:4px;">
                                        ${result.affectedWards.map(w =>
                                            `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#f59e0b22;color:#f59e0b;border:1px solid #f59e0b44;">${w}</span>`
                                        ).join('')}
                                    </div>
                                    <div style="font-size:10px;color:#64748b;margin-top:4px;">Highlighted on map</div>
                                </div>
                            `;
                        }
                    }
                    const sourcesDiv = popupContainer.querySelector('#sensor-sources-section');
                    const sopDiv = popupContainer.querySelector('#sop-trigger-section');

                    if (result.hasSources && result.sources.length > 0) {
                        const originLabels: Record<string, string> = {
                            dhsa_api: 'DHSA Model',
                            dhsa_proxied: 'DHSA Proxied',
                            bff_api: 'BFF Forecast',
                            heuristic: 'Estimated',
                        };
                        const originBadge = originLabels[result.sourceOrigin || ''] || '';
                        const proxyLabel = result.proxiedFromName || result.proxiedFrom;
                        const proxyNote = result.proxiedFrom
                            ? `<div style="font-size:10px;color:#64748b;margin-bottom:4px;">via ${proxyLabel}${result.proxyDistanceKm != null ? ` (${result.proxyDistanceKm} km)` : ''}</div>`
                            : '';
                        const isDhsa = result.sourceOrigin === 'dhsa_api' || result.sourceOrigin === 'dhsa_proxied';
                        const pieChartHtml = isDhsa
                            ? `<div style="margin:8px 0 4px;">
                                ${buildDhsaPieChart(result.sources.slice(0, 8))}
                                <div style="display:flex;flex-wrap:wrap;gap:4px 8px;margin-top:8px;justify-content:center;">
                                    ${result.sources.slice(0, 8).map((s: { label: string; percentage: number }) =>
                                        `<div style="display:flex;align-items:center;gap:3px;font-size:10px;">
                                            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${SOURCE_COLORS[s.label] || '#6b7280'};flex-shrink:0;"></span>
                                            <span style="color:#cbd5e1;">${s.label}</span>
                                        </div>`
                                    ).join('')}
                                </div>
                               </div>`
                            : '';
                        if (sourcesDiv) {
                            sourcesDiv.innerHTML = `
                                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;">
                                    <span style="color:#94a3b8;font-size:11px;font-weight:600;">Top Pollution Sources</span>
                                    ${originBadge ? `<span style="font-size:9px;padding:1px 6px;border-radius:4px;background:#334155;color:#94a3b8;">${originBadge}</span>` : ''}
                                </div>
                                ${proxyNote}
                                ${pieChartHtml}
                                ${!isDhsa ? result.sources.slice(0, 6).map((s: { label: string; percentage: number }) =>
                                    `<div style="display:flex;align-items:center;padding:3px 0;font-size:12px;">
                                        <span style="color:${SOURCE_COLORS[s.label] || '#6b7280'};margin-right:6px;">●</span>
                                        <span style="flex:1">${s.label}</span>
                                        <span style="font-weight:600;min-width:40px;text-align:right">${s.percentage}%</span>
                                    </div>`
                                ).join('') : ''}
                            `;
                        }

                        if (sopDiv && result.sopResult) {
                            if (result.sopResult.sopTriggered && result.sopResult.trigger) {
                                const t = result.sopResult.trigger;
                                sopDiv.innerHTML = `
                                    <div style="margin-top:10px;padding:10px;border-radius:8px;background:#1e293b;border:1px solid #22c55e33;">
                                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                                            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;"></span>
                                            <span style="color:#22c55e;font-size:11px;font-weight:700;text-transform:uppercase;">SOP Triggered</span>
                                        </div>
                                        <div style="font-size:12px;color:#e2e8f0;margin-bottom:4px;font-weight:600;">${t.ruleName}</div>
                                        <div style="font-size:11px;color:#94a3b8;">Severity: <span style="color:${t.severity === 'severe' ? '#ef4444' : '#f59e0b'};font-weight:600;">${t.pm25Category}</span></div>
                                        <div style="font-size:11px;color:#94a3b8;">Leading source: <span style="font-weight:600;color:#e2e8f0;">${t.leadingSource}</span></div>
                                        ${t.intervention ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px;">Action: <span style="color:#e2e8f0;">${t.intervention.intervention_description}</span></div>` : ''}
                                    </div>
                                `;
                            } else {
                                const reason = result.sopResult.reason || 'Conditions not met';
                                sopDiv.innerHTML = `
                                    <div style="margin-top:8px;font-size:11px;color:#64748b;">
                                        <span style="color:#94a3b8;">SOP Status:</span> ${reason}
                                    </div>
                                `;
                            }
                        }
                    } else {
                        if (sourcesDiv) {
                            sourcesDiv.innerHTML = `
                                <div style="color:#64748b;font-size:11px;padding:4px 0;">
                                    Pollution source data not available for this sensor.
                                </div>
                            `;
                        }
                    }
                }).catch(() => {
                    const sourcesDiv = popupContainer.querySelector('#sensor-sources-section');
                    if (sourcesDiv) {
                        sourcesDiv.innerHTML = '<div style="color:#64748b;font-size:11px;">Failed to load source data</div>';
                    }
                });
            });
            marker.addTo(map);
            markersRef.current.push(marker);
        });

        return () => {
            markersRef.current.forEach(m => map.removeLayer(m));
            markersRef.current = [];
        };
    }, [sensors, visible, map, onSelect, selectedId, districtId, onAffectedWards, forecastOverrides]);

    return null;
}

// ========== Affected Wards Highlight Layer ==========
function AffectedWardsHighlightLayer({ wardData }: { wardData: { wardName: string; percentage: number }[] }) {
    const map = useMap();
    const layerRef = useRef<L.GeoJSON | null>(null);
    const [geoJson, setGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);

    useEffect(() => {
        fetch(`${import.meta.env.BASE_URL}lucknow-all-wards.json`)
            .then(r => r.json())
            .then(setGeoJson)
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (layerRef.current) {
            map.removeLayer(layerRef.current);
            layerRef.current = null;
        }
        if (!geoJson || wardData.length === 0) return;

        if (!map.getPane('affectedWardsPane')) {
            const pane = map.createPane('affectedWardsPane');
            pane.style.zIndex = '575';
            pane.style.pointerEvents = 'none';
        }

        // Normalize names for fuzzy matching (lowercase, collapse whitespace + dashes)
        const normalize = (s: string) => s.toLowerCase().replace(/[\s\-–—]+/g, ' ').trim();
        const pctMap = new Map(wardData.map(w => [normalize(w.wardName), w.percentage]));

        const matchingFeatures = geoJson.features.filter(f => {
            const name = normalize(f.properties?.name || '');
            return pctMap.has(name);
        });

        if (matchingFeatures.length === 0) return;

        const filtered: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: matchingFeatures,
        };

        // Color scale: higher percentage → more intense red/orange
        const getColor = (pct: number) => {
            if (pct >= 40) return '#dc2626';  // red-600
            if (pct >= 25) return '#ea580c';  // orange-600
            if (pct >= 15) return '#f59e0b';  // amber-500
            if (pct >= 5)  return '#facc15';  // yellow-400
            return '#a3e635';                 // lime-400
        };

        const layer = L.geoJSON(filtered, {
            pane: 'affectedWardsPane',
            interactive: false,
            style: (feature) => {
                const name = normalize(feature?.properties?.name || '');
                const pct = pctMap.get(name) ?? 0;
                const color = getColor(pct);
                return {
                    color,
                    weight: 3,
                    fillColor: color,
                    fillOpacity: 0.30 + Math.min(pct / 100, 0.4),
                    opacity: 0.9,
                };
            },
            onEachFeature: (feature, layer) => {
                const name = feature.properties?.name || 'Ward';
                const nName = normalize(name);
                const pct = pctMap.get(nName) ?? 0;
                layer.bindTooltip(
                    `<div style="text-align:center;font-family:Inter,sans-serif;">
                        <div style="font-weight:600;font-size:13px;">${Math.round(pct)}%</div>
                        <div style="font-size:10px;color:#475569;margin-top:1px;">${name}</div>
                    </div>`,
                    {
                        permanent: true,
                        direction: 'center',
                        className: 'ward-pct-tooltip',
                    },
                );
            },
        });
        layer.addTo(map);
        layer.bringToFront();
        layerRef.current = layer;

        return () => {
            if (layerRef.current) {
                map.removeLayer(layerRef.current);
                layerRef.current = null;
            }
        };
    }, [geoJson, wardData, map]);

    return null;
}

// ========== Hotspot Markers ==========
function HotspotMarkers({ hotspots, visible }: { hotspots: Hotspot[]; visible: boolean }) {
    const map = useMap();
    const markersRef = useRef<L.Marker[]>([]);

    useEffect(() => {
        markersRef.current.forEach(m => map.removeLayer(m));
        markersRef.current = [];
        if (!visible) return;

        // Only show sensors flagged as hotspots
        const hotOnly = hotspots.filter(hp => hp.isHotspot);

        hotOnly.forEach(hp => {
            const conds = hp.conditionsMet ?? 0;
            const severity = conds >= 3 ? 'high' : 'medium';
            const borderColor = severity === 'high' ? '#dc2626' : '#f59e0b';
            const bgColor = severity === 'high' ? 'rgba(220,38,38,0.15)' : 'rgba(245,158,11,0.15)';
            const emoji = severity === 'high' ? '🔴' : '🟠';

            const icon = L.divIcon({
                html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
          <span style="font-size:22px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">${emoji}</span>
          <span style="font-size:9px;color:${borderColor};font-weight:700;font-family:Inter,sans-serif;text-shadow:0 1px 3px rgba(0,0,0,0.8);white-space:nowrap;max-width:100px;overflow:hidden;text-overflow:ellipsis">${hp.label}</span>
        </div>`,
                className: '',
                iconSize: [80, 40],
                iconAnchor: [40, 20],
            });
            const marker = L.marker([hp.location.lat, hp.location.lng], { icon }).addTo(map);

            const c1 = hp.condition1 ? '✅' : '❌';
            const c2 = hp.condition2 ? '✅' : '❌';
            const c3 = hp.condition3 ? '✅' : '❌';
            const foePct = hp.foe != null ? (hp.foe * 100).toFixed(1) : '—';

            marker.bindPopup(`
              <div style="font-family:Inter,sans-serif;min-width:200px;">
                <div style="background:${bgColor};border:1px solid ${borderColor};border-radius:8px;padding:10px;margin-bottom:6px;">
                  <div style="font-weight:700;font-size:13px;color:${borderColor};margin-bottom:4px;">🔥 HOTSPOT — ${severity.toUpperCase()}</div>
                  <div style="font-size:12px;color:#e5e7eb;">${hp.label}</div>
                </div>
                <div style="font-size:12px;color:#d1d5db;line-height:1.7;">
                  <div><b>Avg PM₂.₅:</b> ${hp.intensity?.toFixed(1) ?? '—'} µg/m³</div>
                  <div><b>FOE:</b> ${foePct}%</div>
                  <div><b>Conditions met:</b> ${conds}/3</div>
                  <div style="margin-top:4px;">
                    ${c1} Above statistical threshold<br/>
                    ${c2} FOE &gt; 70%<br/>
                    ${c3} Consecutive exceedance (${hp.maxConsecDays ?? 0} days)
                  </div>
                </div>
              </div>
            `);

            markersRef.current.push(marker);
        });

        return () => {
            markersRef.current.forEach(m => map.removeLayer(m));
            markersRef.current = [];
        };
    }, [hotspots, visible, map]);

    return null;
}

// ========== Airshed Polygons ==========
function AirshedPolygons({ airsheds, visible }: { airsheds: Airshed[]; visible: boolean }) {
    const map = useMap();
    const layersRef = useRef<L.Layer[]>([]);

    useEffect(() => {
        layersRef.current.forEach(l => map.removeLayer(l));
        layersRef.current = [];
        if (!visible) return;

        airsheds.forEach(as => {
            const polygon = L.polygon(
                as.boundary.map(p => [p.lat, p.lng] as [number, number]),
                { color: '#6366f1', weight: 2, fillColor: '#6366f1', fillOpacity: 0.1, opacity: 0.7 }
            );
            polygon.bindTooltip(`${as.name} (Avg PM2.5: ${as.avgPm25})`, {
                permanent: true, direction: 'center', className: 'airshed-tooltip',
            });
            polygon.addTo(map);
            layersRef.current.push(polygon);
        });

        return () => {
            layersRef.current.forEach(l => map.removeLayer(l));
            layersRef.current = [];
        };
    }, [airsheds, visible, map]);

    return null;
}

// ========== Source Contribution Markers ==========
function SourceContributionMarkers({ contributions, visible }: { contributions: SourceContribution[]; visible: boolean }) {
    const map = useMap();
    const markersRef = useRef<L.Marker[]>([]);

    useEffect(() => {
        markersRef.current.forEach(m => map.removeLayer(m));
        markersRef.current = [];
        if (!visible) return;

        contributions.forEach(sc => {
            const rows = sc.sources.map(s =>
                `<div style="display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:2px">
          <div style="width:8px;height:8px;border-radius:2px;background:${s.color};flex-shrink:0"></div>
          <span style="color:#94a3b8;flex:1">${s.label}</span>
          <span style="font-weight:600;color:#f1f5f9">${s.percentage}%</span>
        </div>`
            ).join('');

            const icon = L.divIcon({
                html: `<div style="background:rgba(10,14,26,0.9);border:1px solid #1e293b;border-radius:8px;padding:8px;min-width:130px;font-family:Inter,sans-serif;backdrop-filter:blur(8px)">
          <div style="font-size:10px;color:#64748b;font-weight:600;margin-bottom:4px">SOURCE BREAKDOWN</div>
          ${rows}
        </div>`,
                className: '',
                iconSize: [140, 100],
                iconAnchor: [70, 50],
            });
            const marker = L.marker([sc.location.lat, sc.location.lng], { icon }).addTo(map);
            markersRef.current.push(marker);
        });

        return () => {
            markersRef.current.forEach(m => map.removeLayer(m));
            markersRef.current = [];
        };
    }, [contributions, visible, map]);

    return null;
}

// District border styles for dark theme - light borders for visibility
const DISTRICT_STYLE = {
    color: '#94a3b8',
    weight: 1.5,
    fillColor: 'transparent',
    fillOpacity: 0,
    opacity: 0.9,
};
const DISTRICT_HOVER_STYLE = {
    color: '#f1f5f9',
    weight: 2.5,
    fillColor: '#60a5fa',
    fillOpacity: 0.15,
    opacity: 1,
};
const DISTRICT_SELECTED_STYLE = {
    color: '#38bdf8',
    weight: 3,
    fillColor: '#3b82f6',
    fillOpacity: 0.18,
    opacity: 1,
    dashArray: undefined,
};

// ========== Lucknow District Boundary ==========
function LucknowBoundaryLayer({ visible }: { visible: boolean }) {
    const map = useMap();
    const layerRef = useRef<L.GeoJSON | null>(null);
    const [geoJson, setGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);

    useEffect(() => {
        fetch(`${import.meta.env.BASE_URL}lucknow-boundary.json`)
            .then(r => r.json())
            .then(setGeoJson)
            .catch(err => console.warn('Failed to load Lucknow boundary:', err));
    }, []);

    useEffect(() => {
        if (layerRef.current) {
            map.removeLayer(layerRef.current);
            layerRef.current = null;
        }
        if (!visible || !geoJson || !geoJson.features.length) return;

        const layer = L.geoJSON(geoJson, {
            style: {
                color: '#f97316',
                weight: 3,
                fillColor: '#f97316',
                fillOpacity: 0.05,
                opacity: 0.9,
                dashArray: '8 4',
            },
            onEachFeature: (_feature, layer) => {
                layer.bindTooltip('Lucknow District', {
                    permanent: false,
                    direction: 'center',
                    className: 'admin-boundary-tooltip',
                });
            },
        });
        layer.addTo(map);
        layerRef.current = layer;

        return () => {
            if (layerRef.current) {
                map.removeLayer(layerRef.current);
                layerRef.current = null;
            }
        };
    }, [geoJson, visible, map]);

    return null;
}

// ========== Zone Boundary Layer ==========
const ZONE_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

function ZoneBoundaryLayer({ visible }: { visible: boolean }) {
    const map = useMap();
    const layerRef = useRef<L.GeoJSON | null>(null);
    const [geoJson, setGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);

    useEffect(() => {
        fetch(`${import.meta.env.BASE_URL}zone-boundaries.json`)
            .then(r => r.json())
            .then(setGeoJson)
            .catch(err => console.warn('Failed to load zone boundaries:', err));
    }, []);

    useEffect(() => {
        if (layerRef.current) {
            map.removeLayer(layerRef.current);
            layerRef.current = null;
        }
        if (!visible || !geoJson || !geoJson.features.length) return;

        const layer = L.geoJSON(geoJson, {
            style: (feature) => {
                const idx = (feature?.properties?.id ?? 1) - 1;
                const color = ZONE_COLORS[idx % ZONE_COLORS.length];
                return {
                    color,
                    weight: 2.5,
                    fillColor: color,
                    fillOpacity: 0.1,
                    opacity: 0.85,
                };
            },
            onEachFeature: (feature, layer) => {
                const name = feature.properties?.Name || `Zone ${feature.properties?.id || ''}`;
                layer.bindTooltip(name, {
                    permanent: false,
                    direction: 'center',
                    className: 'zone-boundary-tooltip',
                });
            },
        });
        layer.addTo(map);
        layerRef.current = layer;

        return () => {
            if (layerRef.current) {
                map.removeLayer(layerRef.current);
                layerRef.current = null;
            }
        };
    }, [geoJson, visible, map]);

    return null;
}

// ========== Ward Boundary Layer (109 Lucknow wards) ==========
function WardBoundaryLayer({ visible, selectedWard }: { visible: boolean; selectedWard: number | null }) {
    const map = useMap();
    const layerRef = useRef<L.LayerGroup | null>(null);
    const [geoJson, setGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);

    useEffect(() => {
        fetch(`${import.meta.env.BASE_URL}lucknow-wards.json`)
            .then(r => r.json())
            .then(setGeoJson)
            .catch(err => console.warn('Failed to load ward boundaries:', err));
    }, []);

    useEffect(() => {
        if (layerRef.current) {
            map.removeLayer(layerRef.current);
            layerRef.current = null;
        }
        if (!visible || !geoJson || !geoJson.features.length) return;

        if (!map.getPane('wardBoundaryPane')) {
            const pane = map.createPane('wardBoundaryPane');
            pane.style.zIndex = '560';
            pane.style.pointerEvents = 'auto';
        }

        const selectedWardNo = selectedWard != null ? Number(selectedWard) : null;
        const selectedFeature = selectedWardNo != null
            ? geoJson.features.find((feature) => Number(feature.properties?.ward_no) === selectedWardNo) ?? null
            : null;
        const baseFeatures = selectedWardNo != null
            ? geoJson.features.filter((feature) => Number(feature.properties?.ward_no) !== selectedWardNo)
            : geoJson.features;

        const group = L.layerGroup();
        const bindWardTooltip = (feature: GeoJSON.Feature, featureLayer: L.Layer) => {
            const props = feature.properties || {};
            const name = props.name || 'Ward';
            const wardNo = props.ward_no;
            const label = wardNo ? `Ward ${wardNo} — ${name}` : name;
            if ('bindTooltip' in featureLayer) {
                (featureLayer as L.Path).bindTooltip(label, {
                    permanent: false,
                    direction: 'center',
                    className: 'admin-boundary-tooltip',
                });
            }
        };

        const baseCollection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: baseFeatures };
        const baseCasing = L.geoJSON(baseCollection, {
            pane: 'wardBoundaryPane',
            interactive: false,
            style: {
                color: '#0f172a',
                weight: 3.6,
                opacity: 0.28,
                fillOpacity: 0,
            },
        });
        const baseLayer = L.geoJSON(baseCollection, {
            pane: 'wardBoundaryPane',
            style: {
                color: '#f8fafc',
                weight: 1.9,
                opacity: 0.95,
                fillOpacity: 0,
                dashArray: '3 3',
                lineCap: 'round',
                lineJoin: 'round',
                className: 'ward-boundary-path',
            },
            onEachFeature: bindWardTooltip,
        });
        group.addLayer(baseCasing);
        group.addLayer(baseLayer);

        if (selectedFeature) {
            const selectedCollection: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: [selectedFeature],
            };
            const selectedCasing = L.geoJSON(selectedCollection, {
                pane: 'wardBoundaryPane',
                interactive: false,
                style: {
                    color: '#312e81',
                    weight: 7,
                    opacity: 0.55,
                    fillOpacity: 0,
                },
            });
            const selectedLayer = L.geoJSON(selectedCollection, {
                pane: 'wardBoundaryPane',
                style: {
                    color: '#a5b4fc',
                    weight: 4,
                    opacity: 1,
                    fillColor: '#6366f1',
                    fillOpacity: 0.18,
                    lineCap: 'round',
                    lineJoin: 'round',
                    className: 'ward-boundary-path ward-boundary-path-selected',
                },
                onEachFeature: bindWardTooltip,
            });
            group.addLayer(selectedCasing);
            group.addLayer(selectedLayer);
        }

        group.addTo(map);
        layerRef.current = group;

        // Fit map to selected ward
        if (selectedWardNo != null && selectedFeature) {
            const target = selectedFeature;
            if (target) {
                const bounds = L.geoJSON(target).getBounds();
                if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
            }
        }

        return () => {
            if (layerRef.current) {
                map.removeLayer(layerRef.current);
                layerRef.current = null;
            }
        };
    }, [geoJson, visible, map, selectedWard]);

    return null;
}

function districtNameMatches(geoProps: Record<string, unknown>, districtId: string): boolean {
    // Normalize district name from GeoJSON: lowercase, spaces → hyphens
    const distName = (geoProps.Dist_Name as string)?.toLowerCase().replace(/\s+/g, '-') || '';
    const stateName = (geoProps.State_Name as string)?.toLowerCase().replace(/\s+/g, '-') || '';
    const idLower = districtId.toLowerCase();
    if (!distName) return false;
    // Exact match (simple ID like 'lucknow')
    if (distName === idLower) return true;
    // Compound ID: 'uttar-pradesh-lucknow' ends with '-lucknow'
    if (idLower.endsWith('-' + distName)) return true;
    // Full compound match: state-district === id
    if (stateName && `${stateName}-${distName}` === idLower) return true;
    return false;
}

// ========== Admin Boundary Polygons (selected district + same-state neighbors) ==========
function AdminBoundaryLayer({
    geoJson,
    visible,
    selectedDistrictId,
}: {
    geoJson: GeoJSON.FeatureCollection | null;
    visible: boolean;
    selectedDistrictId: string;
}) {
    const map = useMap();
    const layerRef = useRef<L.GeoJSON | null>(null);

    // Filter to only the selected district's state — avoids rendering 732 polygons
    const filteredGeoJson = useMemo<GeoJSON.FeatureCollection | null>(() => {
        if (!geoJson) return null;
        const selected = geoJson.features.find(f =>
            districtNameMatches((f.properties || {}) as Record<string, unknown>, selectedDistrictId)
        );
        if (!selected) return null;
        const selectedState = ((selected.properties as Record<string, unknown>)?.State_Name as string)?.toLowerCase() || '';
        if (!selectedState) return { type: 'FeatureCollection', features: [selected] };
        const stateFeatures = geoJson.features.filter(f => {
            const s = ((f.properties || {}) as Record<string, unknown>).State_Name as string;
            return s?.toLowerCase() === selectedState;
        });
        return { type: 'FeatureCollection', features: stateFeatures };
    }, [geoJson, selectedDistrictId]);

    useEffect(() => {
        if (layerRef.current) {
            map.removeLayer(layerRef.current);
            layerRef.current = null;
        }
        if (!visible || !filteredGeoJson) return;

        const geoJsonLayer = L.geoJSON(filteredGeoJson, {
            style: (feature) => {
                const props = feature?.properties || {};
                const isSelected = districtNameMatches(props as Record<string, unknown>, selectedDistrictId);
                return isSelected ? DISTRICT_SELECTED_STYLE : DISTRICT_STYLE;
            },
            onEachFeature: (feature, layer) => {
                const props = feature.properties || {};
                const name = props.Dist_Name || props.district || 'District';
                const state = props.State_Name || props.state || '';
                layer.bindTooltip(`${name}${state ? ` (${state})` : ''}`, {
                    permanent: false,
                    direction: 'center',
                    className: 'admin-boundary-tooltip',
                });
                layer.on({
                    mouseover: (e) => {
                        const lyr = e.target;
                        if (!districtNameMatches((feature.properties || {}) as Record<string, unknown>, selectedDistrictId)) {
                            lyr.setStyle(DISTRICT_HOVER_STYLE);
                            lyr.bringToFront();
                        }
                    },
                    mouseout: (e) => {
                        const lyr = e.target;
                        const isSelected = districtNameMatches((feature.properties || {}) as Record<string, unknown>, selectedDistrictId);
                        lyr.setStyle(isSelected ? DISTRICT_SELECTED_STYLE : DISTRICT_STYLE);
                    },
                });
            },
        });
        geoJsonLayer.addTo(map);
        layerRef.current = geoJsonLayer;

        return () => {
            if (layerRef.current) {
                map.removeLayer(layerRef.current);
                layerRef.current = null;
            }
        };
    }, [filteredGeoJson, visible, map, selectedDistrictId]);

    return null;
}

// ========== Fit Bounds on District/Filter Change ==========
function FitBoundsOnDistrictChange({
    selectedDistrict,
    geoJson,
}: {
    selectedDistrict: { id: string; name: string; center: { lat: number; lng: number }; zoom: number };
    geoJson: GeoJSON.FeatureCollection | null;
}) {
    const map = useMap();

    useEffect(() => {
        if (!geoJson?.features?.length) {
            map.setView([selectedDistrict.center.lat, selectedDistrict.center.lng], selectedDistrict.zoom, { animate: true });
            return;
        }
        const feature = geoJson.features.find(
            (f) => districtNameMatches((f.properties || {}) as Record<string, unknown>, selectedDistrict.id)
        );
        if (feature && feature.geometry) {
            const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [feature] };
            const layer = L.geoJSON(fc);
            const bounds = layer.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: true });
                return;
            }
        }
        map.setView([selectedDistrict.center.lat, selectedDistrict.center.lng], selectedDistrict.zoom, { animate: true });
    }, [selectedDistrict.id, selectedDistrict.center, selectedDistrict.zoom, geoJson, map]);

    return null;
}

// ========== 72-Hour Outlook SVG Chart ==========
function OutlookChart({ forecast }: { forecast: ForecastPoint[] }) {
    const forecastData = useMemo(() => {
        if (!forecast.length) return [{ label: 'Now', value: 0 }];
        // Adaptive picks based on available data length
        const n = forecast.length;
        let picks: number[];
        if (n <= 6) {
            picks = Array.from({ length: n }, (_, i) => i);
        } else if (n <= 24) {
            picks = [0, 1, 3, 6, 12, Math.min(18, n - 2), n - 1].filter(h => h < n);
        } else {
            picks = [0, 2, 6, 12, 24, 48, 72].filter(h => h < n);
        }
        // Deduplicate
        picks = [...new Set(picks)].sort((a, b) => a - b);
        const result: { label: string; value: number }[] = [];
        for (const h of picks) {
            const pt = forecast[h];
            result.push({ label: h === 0 ? 'Now' : `+${h}h`, value: Math.round(pt.pm25) });
        }
        return result.length > 0 ? result : [{ label: 'Now', value: 0 }];
    }, [forecast]);

    const width = 260;
    const height = 140;
    const padL = 35;
    const padR = 10;
    const padT = 10;
    const padB = 25;
    const chartW = width - padL - padR;
    const chartH = height - padT - padB;
    const maxVal = Math.max(30, ...forecastData.map(d => d.value)) * 1.2;

    const points = forecastData.map((d, i) => {
        const x = padL + (i / (forecastData.length - 1)) * chartW;
        const y = padT + chartH - (d.value / maxVal) * chartH;
        return { x, y, ...d };
    });

    const linePath = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
    const areaPath = linePath + ` L${points[points.length - 1].x},${padT + chartH} L${points[0].x},${padT + chartH} Z`;

    const step = Math.ceil(maxVal / 4 / 10) * 10;
    const gridLines = [0, step, step * 2, step * 3, Math.round(maxVal)];

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
            {/* Grid lines */}
            {gridLines.map(v => {
                const y = padT + chartH - (v / maxVal) * chartH;
                return (
                    <g key={v}>
                        <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#1e293b" strokeWidth={1} strokeDasharray="3 3" />
                        <text x={padL - 5} y={y + 3} textAnchor="end" fill="#64748b" fontSize={9} fontFamily="Inter">{v}</text>
                    </g>
                );
            })}
            {/* Area fill */}
            <path d={areaPath} fill="url(#outlookGrad)" opacity={0.6} />
            {/* Line */}
            <path d={linePath} fill="none" stroke="#6366f1" strokeWidth={2} />
            {/* Dots */}
            {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill="#6366f1" stroke="#1a1f35" strokeWidth={1.5} />
            ))}
            {/* X labels */}
            {points.map((p, i) => (
                <text key={i} x={p.x} y={height - 5} textAnchor="middle" fill="#64748b" fontSize={9} fontFamily="Inter">{p.label}</text>
            ))}
            {/* Gradient definition */}
            <defs>
                <linearGradient id="outlookGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                </linearGradient>
            </defs>
        </svg>
    );
}

// ========== Forecast Player Bar (timeline slider) ==========
function ForecastPlayer({
    stations,
    visible,
    forecastHour,
    setForecastHour,
}: {
    stations: ForecastStation[];
    visible: boolean;
    forecastHour: number;
    setForecastHour: Dispatch<SetStateAction<number>>;
}) {
    const [playing, setPlaying] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Auto-advance when playing
    useEffect(() => {
        if (!playing || !visible) {
            if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
            return;
        }
        const maxHour = (stations[0]?.forecasts?.length || 24) - 1;
        intervalRef.current = setInterval(() => {
            setForecastHour(prev => {
                if (prev >= maxHour) { setPlaying(false); return maxHour; }
                return prev + 1;
            });
        }, 1000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [playing, visible, stations, setForecastHour]);

    // Stop playback when forecast layer is turned off (defer setState to satisfy react-hooks plugin)
    useEffect(() => {
        if (!visible) queueMicrotask(() => setPlaying(false));
    }, [visible]);

    if (!visible || stations.length === 0) return null;

    const maxHour = (stations[0]?.forecasts?.length || 24) - 1;
    const currentTs = stations[0]?.forecasts?.[forecastHour]?.timestamp;
    const timeLabel = currentTs
        ? new Date(currentTs).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        : `+${forecastHour}h`;
    const dateLabel = currentTs
        ? new Date(currentTs).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        : '';

    return (
        <div style={{
            position: 'absolute', bottom: 50, left: '50%', transform: 'translateX(-50%)',
            zIndex: 1000, display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(10px)',
            borderRadius: 12, padding: '8px 18px', minWidth: 340,
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(99,102,241,0.3)',
            fontFamily: 'Inter, sans-serif', color: 'white',
        }}>
            {/* Play / Pause button */}
            <button
                onClick={() => {
                    if (forecastHour >= maxHour) setForecastHour(0);
                    setPlaying(p => !p);
                }}
                style={{
                    width: 34, height: 34, borderRadius: '50%', border: 'none',
                    background: '#6366f1', color: 'white', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                }}
                title={playing ? 'Pause' : 'Play forecast'}
            >
                {playing ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
            </button>

            {/* Time info */}
            <div style={{ minWidth: 60, textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{timeLabel}</div>
                <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1 }}>{dateLabel}</div>
            </div>

            {/* Slider */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <input
                    type="range"
                    min={0}
                    max={maxHour}
                    value={forecastHour}
                    onChange={e => { setForecastHour(Number(e.target.value)); setPlaying(false); }}
                    style={{
                        width: '100%', accentColor: '#6366f1', cursor: 'pointer',
                        height: 6,
                    }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#64748b' }}>
                    <span>Now</span>
                    <span>+{maxHour}h</span>
                </div>
            </div>

            {/* Hour badge */}
            <div style={{
                background: '#6366f133', border: '1px solid #6366f1', borderRadius: 6,
                padding: '2px 8px', fontSize: 11, fontWeight: 600, flexShrink: 0,
                color: '#a5b4fc',
            }}>
                +{forecastHour}h
            </div>
        </div>
    );
}

// Helper: build map of sensorId → forecast pm25 for a given hour index
function buildForecastOverrides(
    sensors: Sensor[],
    forecastStations: ForecastStation[],
    hourIndex: number,
): Map<string, number> {
    const overrides = new Map<string, number>();
    if (!forecastStations.length) return overrides;

    for (const sensor of sensors) {
        const slat = sensor.location.lat;
        const slng = sensor.location.lng;
        // Find closest forecast station (no distance threshold — networks may cover different areas)
        let best: ForecastStation | null = null;
        let bestDist = Infinity;
        for (const fs of forecastStations) {
            const dlat = slat - fs.lat;
            const dlng = slng - fs.lng;
            const dist = dlat * dlat + dlng * dlng;
            if (dist < bestDist) { bestDist = dist; best = fs; }
        }
        if (best) {
            const idx = Math.min(hourIndex, (best.forecasts?.length || 1) - 1);
            const pm25 = best.forecasts?.[idx]?.pm25;
            if (pm25 != null) overrides.set(sensor.id, pm25);
        }
    }
    return overrides;
}

// ========== Main MapView ==========
export default function MapView() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { theme } = useTheme();
    const { selectedDistrict, selectedWard, livePm25, liveSensorCount, updateSensorStats } = useLocation();
    const { isWardScopedOfficer } = useAuth();
    // Ward officers: don't pass ward to stats/triggers — backend role filter handles ward scoping
    const statsWard = isWardScopedOfficer ? undefined : selectedWard;
    const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
    const [highlightedWards, setHighlightedWards] = useState<{ wardName: string; percentage: number }[]>([]);
    // Ward data from sensor click (source pinpointing popup)
    const [sensorClickWards, setSensorClickWards] = useState<{ wardName: string; percentage: number }[]>([]);
    // Ward data aggregated from all active hotspot sensors
    const [hotspotWards, setHotspotWards] = useState<{ wardName: string; percentage: number }[]>([]);
    const handleMapDeselect = useCallback(() => {
        setSelectedSensor(null);
        setSensorClickWards([]);
    }, []);
    const [layersPanelOpen, setLayersPanelOpen] = useState(true);
    const [forecastHour, setForecastHour] = useState(0);
    const [hotspotMode, setHotspotMode] = useState<HotspotMode>('realtime');
    const hotspotLookbackDays = hotspotMode === 'realtime' ? 2 : 180;
    const [districtsGeoJson, setDistrictsGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
    const [lucknowBoundary, setLucknowBoundary] = useState<GeoJSON.FeatureCollection | null>(null);
    const [layers, setLayers] = useState<MapLayerState>({
        pollution: true,
        sensors: true,
        hotspots: false,
        airsheds: false,
        admin_boundaries: false,
        source_contributions: false,
        forecast: false,
        lucknow_boundary: true,
        zone_boundaries: false,
        ward_boundaries: false,
    });

    useEffect(() => {
        fetch(`${import.meta.env.BASE_URL}districts-boundaries.json`)
            .then((r) => r.json())
            .then(setDistrictsGeoJson)
            .catch((err) => console.warn('Failed to load district boundaries:', err));
        fetch(`${import.meta.env.BASE_URL}lucknow-boundary.json`)
            .then((r) => r.json())
            .then(setLucknowBoundary)
            .catch((err) => console.warn('Failed to load Lucknow boundary:', err));
    }, []);

    // TanStack Query – cached, shared across Map/DSS/Issues
    const { data: sensors = [] } = useQuery({
        queryKey: ['sensors', selectedDistrict.id, selectedWard],
        queryFn: () => fetchSensors(selectedDistrict.id, selectedWard),
    });
    const { data: heatmapData, dataUpdatedAt: heatmapUpdatedAt } = useQuery({
        queryKey: ['heatmap', selectedDistrict.id],
        queryFn: () => fetchHeatmap(selectedDistrict.id, 'pm25'),
    });
    const heatmapPoints = heatmapData?.points?.length ? heatmapData.points : null;

    const { data: pollutionGridData } = useQuery({
        queryKey: ['pollution-grid', selectedDistrict.id],
        queryFn: () => fetchPollutionGrid(selectedDistrict.id),
        staleTime: 4 * 60 * 1000,
    });

    const pollutionRaster = useMemo((): HeatmapRaster | null => {
        const g = pollutionGridData?.grid;
        if (!g?.values?.length) return null;
        return pollutionGridToRaster(g);
    }, [pollutionGridData]);
    const { data: hotspots = [] } = useQuery({
        queryKey: ['hotspots', selectedDistrict.id, hotspotLookbackDays, hotspotMode],
        queryFn: () => fetchHotspots(selectedDistrict.id, hotspotLookbackDays, hotspotMode),
        enabled: layers.hotspots,
    });

    // Auto-fetch source pinpointing ward contributions for active hotspot sensors
    useEffect(() => {
        if (!layers.hotspots || hotspots.length === 0) {
            setHotspotWards([]);
            return;
        }
        const activeHotspots = hotspots.filter(hp => hp.isHotspot && hp.sensorId);
        if (activeHotspots.length === 0) {
            setHotspotWards([]);
            return;
        }
        let cancelled = false;
        Promise.all(
            activeHotspots.map(hp =>
                fetchSourcePinpointing(hp.sensorId!, selectedDistrict.id, 10).catch(() => null),
            ),
        ).then(results => {
            if (cancelled) return;
            // Aggregate: for each ward, take the max percentage across all hotspot sensors
            const wardMap = new Map<string, number>();
            for (const r of results) {
                if (!r?.sensor?.wardContributions) continue;
                for (const w of r.sensor.wardContributions) {
                    const existing = wardMap.get(w.wardName) ?? 0;
                    wardMap.set(w.wardName, Math.max(existing, Math.round(w.percentage)));
                }
            }
            setHotspotWards(
                Array.from(wardMap.entries()).map(([wardName, percentage]) => ({ wardName, percentage })),
            );
        });
        return () => { cancelled = true; };
    }, [layers.hotspots, hotspots, selectedDistrict.id]);

    // Merge sensor-click wards and hotspot wards into highlightedWards
    useEffect(() => {
        // Sensor click wards take priority (more specific)
        if (sensorClickWards.length > 0) {
            setHighlightedWards(sensorClickWards);
        } else {
            setHighlightedWards(hotspotWards);
        }
    }, [sensorClickWards, hotspotWards]);

    const { data: airsheds = [] } = useQuery({
        queryKey: ['airsheds', selectedDistrict.id],
        queryFn: () => fetchAirsheds(selectedDistrict.id),
    });
    const { data: sourceContributions = [] } = useQuery({
        queryKey: ['source-contributions', selectedDistrict.id],
        queryFn: () => fetchSourceContributions(selectedDistrict.id),
    });
    const { data: dssStats = null } = useQuery({
        queryKey: ['dss-stats', selectedDistrict.id, statsWard],
        queryFn: () => fetchDssStats(selectedDistrict.id, statsWard),
    });
    const { data: dssTriggers = [] } = useQuery({
        queryKey: ['dss-triggers', selectedDistrict.id, statsWard],
        queryFn: () => fetchDssTriggers(selectedDistrict.id, statsWard),
    });
    const emptyForecast: ForecastResult = { forecast: [], stations: [], model: 'Unavailable', generatedAt: '' };
    const { data: forecastResult = emptyForecast, isFetching: forecastLoading } = useQuery({
        queryKey: ['forecast', selectedDistrict.id],
        queryFn: () => fetchForecast(selectedDistrict.id, 24),
        enabled: layers.forecast,
        staleTime: 5 * 60_000,
    });
    const forecast = forecastResult.forecast;
    const forecastStations = forecastResult.stations;

    // Reset hour when forecast is toggled off
    useEffect(() => { if (!layers.forecast) setForecastHour(0); }, [layers.forecast]);

    // Build per-sensor overrides map for current forecast hour
    const forecastOverrides = useMemo(() => {
        if (!layers.forecast || !forecastStations.length) return null;
        return buildForecastOverrides(sensors, forecastStations, forecastHour);
    }, [layers.forecast, forecastStations, sensors, forecastHour]);

    const invalidateMapData = useCallback(async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['sensors', selectedDistrict.id] }),
            queryClient.invalidateQueries({ queryKey: ['heatmap', selectedDistrict.id] }),
            queryClient.invalidateQueries({ queryKey: ['pollution-grid', selectedDistrict.id] }),
            queryClient.invalidateQueries({ queryKey: ['hotspots', selectedDistrict.id, hotspotLookbackDays] }),
            queryClient.invalidateQueries({ queryKey: ['airsheds', selectedDistrict.id] }),
            queryClient.invalidateQueries({ queryKey: ['source-contributions', selectedDistrict.id] }),
            queryClient.invalidateQueries({ queryKey: ['dss-stats', selectedDistrict.id] }),
            queryClient.invalidateQueries({ queryKey: ['dss-triggers', selectedDistrict.id] }),
            queryClient.invalidateQueries({ queryKey: ['forecast', selectedDistrict.id] }),
        ]);
    }, [queryClient, selectedDistrict.id, hotspotLookbackDays]);

    const { lastUpdated } = useAutoRefresh(invalidateMapData);

    const toggleLayer = (layer: keyof MapLayerState) => {
        setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
    };

    const layerConfig = [
        { key: 'pollution' as const, label: 'Pollution', icon: '◎' },
        { key: 'sensors' as const, label: 'Sensors', icon: '◉' },
        { key: 'hotspots' as const, label: 'Hotspots', icon: '🔥' },
        { key: 'admin_boundaries' as const, label: 'Admin Boundaries', icon: '◇' },
        { key: 'forecast' as const, label: 'Forecast', icon: '⤴' },
        { key: 'lucknow_boundary' as const, label: 'Lucknow Boundary', icon: '🔶' },
        { key: 'zone_boundaries' as const, label: 'Zone Boundaries', icon: '▣' },
        { key: 'ward_boundaries' as const, label: 'Ward Boundaries', icon: '▦' },
    ];

    const pollutionTimestamp = pollutionGridData?.generatedAt
        ? new Date(pollutionGridData.generatedAt)
        : heatmapUpdatedAt
            ? new Date(heatmapUpdatedAt)
            : lastUpdated;
    const formattedPollutionTime = pollutionTimestamp.toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
    });

    // Compute avg PM2.5 from map sensors and push to context so the
    // top-right badge always matches the sidebar value.
    const localAvgPm25 = useMemo(() => {
        const withData = sensors.filter(s => s.pm25 > 0);
        if (!withData.length) return 0;
        return Math.round(withData.reduce((s, x) => s + x.pm25, 0) / withData.length);
    }, [sensors]);

    useEffect(() => {
        const allActive = sensors.filter(s => s.isActive !== false);
        if (allActive.length > 0) {
            updateSensorStats(localAvgPm25, allActive.length);
        }
    }, [sensors, localAvgPm25, updateSensorStats]);

    const avgPm25 = livePm25 ?? localAvgPm25;

    // Issue counts from DSS stats API (no-fallback: null when API unavailable)
    const activeIssueCount = dssStats?.openIssuesCount ?? null;
    const criticalCount = dssStats?.criticalIssuesCount ?? null;
    const pendingSopsCount = dssStats?.pendingSopsCount ?? null;

    // Pending SOPs: triggers awaiting_approval or in_progress with SLA tracking
    const pendingTriggers = useMemo(() =>
        dssTriggers.filter(t => t.status === 'awaiting_approval' || t.status === 'in_progress'),
    [dssTriggers]);
    const slaBreach = useMemo(() =>
        pendingTriggers.filter(t => t.slaDeadline && new Date(t.slaDeadline) < new Date()),
    [pendingTriggers]);

    // Priority alerts: high-severity triggers or issues
    const priorityAlerts = useMemo(() => {
        const TYPE_LABELS: Record<string, string> = {
            road_dust: 'Road Dust', waste_burning: 'Waste Burning',
            traffic_congestion: 'Traffic Congestion', construction_dust: 'Construction Dust',
            industrial_emission: 'Industrial Emission', crop_burning: 'Crop Burning',
        };
        return dssTriggers
            .filter(t => t.severity === 'severe' || t.severity === 'moderate')
            .slice(0, 4)
            .map(t => ({
                type: TYPE_LABELS[t.ruleName?.toLowerCase().replace(/\s+/g, '_')] || t.ruleName || 'Alert',
                location: `Ward ${t.ward}${t.department ? ' • ' + t.department : ''}`,
                icon: t.severity === 'severe' ? '🔺' : '🔸',
                reading: t.currentReading,
            }));
    }, [dssTriggers]);

    return (
        <div className="map-page">
            {/* ========== Left Sidebar ========== */}
            <div className="map-sidebar">
                {/* Summary Cards - Stacked Vertically */}
                <div className="map-summary-card">
                    <div className="map-card-label">
                        {selectedWard != null ? `WARD ${selectedWard} AVG PM2.5` : 'DISTRICT AVG PM2.5'}
                    </div>
                    <div className="map-card-value" style={{ color: avgPm25 > 120 ? 'var(--pm-very-poor)' : avgPm25 > 60 ? 'var(--pm-poor)' : 'var(--pm-satisfactory)' }}>
                        {avgPm25 > 0 ? avgPm25 : '—'} <span className="map-card-unit">µg/m³</span>
                    </div>
                    {liveSensorCount > 0 && (
                        <div className="map-card-trend" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                            {liveSensorCount} active sensor{liveSensorCount === 1 ? '' : 's'} · live average
                        </div>
                    )}
                    {forecast.length >= 2 && avgPm25 > 0 && (
                        <div className={`map-card-trend ${forecast[forecast.length - 1].pm25 > avgPm25 ? 'trend-up' : 'trend-down'}`}>
                            {forecast[forecast.length - 1].pm25 > avgPm25 ? '↗' : '↘'} 24h forecast: {Math.round(forecast[Math.min(23, forecast.length - 1)].pm25)} µg/m³
                        </div>
                    )}
                </div>

                <div className="map-summary-card">
                    <div className="map-card-label">ACTIVE ISSUES</div>
                    <div className="map-card-value">
                        {activeIssueCount != null ? activeIssueCount : '—'} <span className="map-card-unit">{activeIssueCount != null ? 'Open' : 'No data'}</span>
                    </div>
                    <div className="map-card-footer">
                        {criticalCount != null && criticalCount > 0 && <span className="critical-badge">{criticalCount} Critical</span>}
                        <button className="map-card-link" onClick={() => navigate('/issues')}>View All</button>
                    </div>
                </div>

                <div className="map-summary-card">
                    <div className="map-card-label">PENDING SOPs</div>
                    <div className="map-card-value">
                        {pendingSopsCount != null ? pendingSopsCount : '—'} <span className="map-card-unit">{pendingSopsCount != null ? 'Tasks' : 'No data'}</span>
                    </div>
                    <div className="map-card-footer">
                        {slaBreach.length > 0 && (
                            <span className="overdue-badge">⊘ {slaBreach.length} SLA Breached</span>
                        )}
                        <button className="map-card-link" onClick={() => navigate('/dss')}>View</button>
                    </div>
                </div>

                {/* Priority Alerts */}
                <div className="map-panel map-priority-alerts">
                    <div className="map-panel-header">
                        <h4>PRIORITY ALERTS</h4>
                    </div>
                    <div className="alerts-list">
                        {priorityAlerts.length > 0 ? priorityAlerts.map((alert, i) => (
                            <div key={i} className="alert-item">
                                <div className="alert-icon">{alert.icon}</div>
                                <div className="alert-info">
                                    <div className="alert-type">{alert.type}</div>
                                    <div className="alert-location">{alert.location}{alert.reading ? ` • PM: ${alert.reading}` : ''}</div>
                                </div>
                            </div>
                        )) : (
                            <div className="alert-item" style={{ opacity: 0.5 }}>
                                <div className="alert-info"><div className="alert-type">No active alerts</div></div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 24-Hour Forecast Outlook */}
                <div className="map-panel map-outlook-panel">
                    <div className="map-panel-header">
                        <h4>24-HOUR FORECAST</h4>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {forecastResult.model !== 'Unavailable' ? forecastResult.model : ''}
                        </span>
                    </div>
                    <div className="outlook-chart-wrapper">
                        {!layers.forecast ? (
                            <div style={{ textAlign: 'center', padding: '18px 12px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                Enable <strong>Forecast</strong> layer to see PM2.5 predictions
                            </div>
                        ) : forecastLoading ? (
                            <div style={{ textAlign: 'center', padding: '18px 12px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                Loading forecast…
                            </div>
                        ) : forecast.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '18px 12px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                No forecast data available
                            </div>
                        ) : (
                            <OutlookChart forecast={forecast} />
                        )}
                    </div>
                </div>

                {/* DSS Active Triggers (Compact) */}
                <div className="map-panel dss-home-triggers">
                    <div className="map-panel-header">
                        <h4>⚡ DSS ACTIVE TRIGGERS</h4>
                        <button className="map-card-link" onClick={() => navigate('/dss')} style={{ cursor: 'pointer' }}>View All →</button>
                    </div>
                    {selectedWard != null && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '0 0 6px 0' }}>
                            Filtered: Ward {selectedWard}
                        </div>
                    )}
                    <div className="dss-home-list">
                        {(() => {
                            /* eslint-disable react-hooks/purity -- relative SLA ordering uses current time */
                            const nowMs = Date.now();
                            const active = dssTriggers
                                .filter(t => t.status !== 'completed' && t.status !== 'rejected')
                                .sort((a, b) => {
                                    // Sort by SLA urgency: breached first, then soonest deadline
                                    const aMs = a.slaDeadline ? new Date(a.slaDeadline).getTime() - nowMs : Infinity;
                                    const bMs = b.slaDeadline ? new Date(b.slaDeadline).getTime() - nowMs : Infinity;
                                    return aMs - bMs;
                                })
                                .slice(0, 4);
                            /* eslint-enable react-hooks/purity */
                            if (active.length === 0) return (
                                <div className="dss-home-item" style={{ borderLeftColor: '#334155', opacity: 0.5 }}>
                                    <div className="dss-home-item-top">
                                        <span className="dss-home-item-name">No active triggers</span>
                                    </div>
                                </div>
                            );
                            return active.map(t => {
                                const slaMs = t.slaDeadline ? new Date(t.slaDeadline).getTime() - nowMs : null;
                                const slaBreached = slaMs !== null && slaMs < 0;
                                const slaUrgent = slaMs !== null && slaMs >= 0 && slaMs < 3600000;
                                const slaText = slaMs === null ? t.status.replace(/_/g, ' ')
                                    : slaBreached ? 'SLA Breached'
                                    : slaMs < 3600000 ? `SLA ${Math.round(slaMs / 60000)}m`
                                    : `SLA ${Math.round(slaMs / 3600000)}h ${Math.round((slaMs % 3600000) / 60000)}m`;
                                const slaColor = slaBreached ? '#ef4444' : slaUrgent ? '#f59e0b' : '#10b981';
                                const borderColor = t.severity === 'severe' ? '#ef4444'
                                    : t.severity === 'moderate' ? '#f59e0b' : '#6366f1';
                                return (
                                    <div key={t.id} className="dss-home-item" style={{ borderLeftColor: borderColor, cursor: 'pointer' }}
                                        onClick={() => navigate('/dss')}
                                    >
                                        <div className="dss-home-item-top">
                                            <span className="dss-home-item-name">{t.ruleName || t.ruleId}</span>
                                            <span className="dss-home-sla" style={{ color: slaColor, background: slaColor + '22' }}>{slaText}</span>
                                        </div>
                                        <div className="dss-home-item-ward">
                                            Ward {t.ward}{t.department ? ` · ${t.department.split(' ')[0]}` : ''}{t.currentReading ? ` · PM: ${t.currentReading}` : ''}
                                        </div>
                                        {Number(t.budgetImpact) > 0 && (
                                            <div className="dss-home-item-budget">₹{Number(t.budgetImpact).toLocaleString('en-IN')} budget impact</div>
                                        )}
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            </div>

            {/* ========== Map Viewport ========== */}
            <div className="map-viewport">
                <MapContainer
                    center={[selectedDistrict.center.lat, selectedDistrict.center.lng]}
                    zoom={selectedDistrict.zoom}
                    style={{ width: '100%', height: '100%' }}
                    zoomControl={false}
                    attributionControl={false}
                >
                    <TileLayer
                        key={theme}
                        url={theme === 'light'
                            ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
                            : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'}
                        attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
                    />
                    <FitBoundsOnDistrictChange selectedDistrict={selectedDistrict} geoJson={districtsGeoJson} />
                    <MapClickHandler onDeselect={handleMapDeselect} />
                    <HeatmapLayer
                        serverRaster={pollutionRaster}
                        heatmapPoints={heatmapPoints}
                        sensors={sensors}
                        visible={layers.pollution}
                        districtsGeoJson={districtsGeoJson}
                        selectedDistrictId={selectedDistrict.id}
                        lucknowBoundary={lucknowBoundary}
                    />
                    <SensorMarkers
                        sensors={sensors}
                        visible={layers.sensors}
                        onSelect={setSelectedSensor}
                        selectedId={selectedSensor?.id || null}
                        districtId={selectedDistrict.id}
                        onAffectedWards={setSensorClickWards}
                        forecastOverrides={forecastOverrides}
                    />
                    <AffectedWardsHighlightLayer wardData={highlightedWards} />
                    <HotspotMarkers hotspots={hotspots} visible={layers.hotspots} />
                    <AirshedPolygons airsheds={airsheds} visible={layers.airsheds} />
                    <SourceContributionMarkers contributions={sourceContributions} visible={layers.source_contributions} />
                    <AdminBoundaryLayer
                        geoJson={districtsGeoJson}
                        visible={layers.admin_boundaries}
                        selectedDistrictId={selectedDistrict.id}
                    />
                    <LucknowBoundaryLayer visible={layers.lucknow_boundary} />
                    <ZoneBoundaryLayer visible={layers.zone_boundaries} />
                    <WardBoundaryLayer visible={layers.ward_boundaries || selectedWard != null} selectedWard={selectedWard} />
                </MapContainer>

                {/* Forecast timeline player bar */}
                <ForecastPlayer
                    stations={forecastStations}
                    visible={layers.forecast}
                    forecastHour={forecastHour}
                    setForecastHour={setForecastHour}
                />

                {/* ========== Bottom-Left Overlays (Legend + Layers) ========== */}
                <div className="map-bottom-left-overlays">
                    <div className="map-legend map-legend-horizontal">
                        <div className="legend-h-header">
                            <h4>PM<sub>2.5</sub> <span className="unit">(µg/m³) – CPCB Standard</span></h4>
                        </div>
                        <div className="legend-h-bar">
                            <div className="legend-h-gradient" />
                            <div className="legend-h-labels">
                                <span>0</span>
                                <span>30</span>
                                <span>60</span>
                                <span>90</span>
                                <span>120</span>
                                <span>250</span>
                            </div>
                        </div>
                    </div>

                    {layersPanelOpen && (
                        <div className="map-layers-panel">
                            <div className="map-layers-header">
                                <h3><Layers size={14} /> Map Layers</h3>
                                <button onClick={() => setLayersPanelOpen(false)}>
                                    <ChevronLeft size={16} />
                                </button>
                            </div>
                            <div className="map-layers-list">
                                {layerConfig.map(({ key, label, icon, disabled }: { key: keyof MapLayerState; label: string; icon: string; disabled?: boolean }) => (
                                    <div key={key}>
                                        <button
                                            className={`layer-toggle ${layers[key] ? 'active' : ''}`}
                                            onClick={() => !disabled && toggleLayer(key)}
                                            disabled={disabled}
                                            style={disabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                                            title={disabled ? 'Coming soon' : undefined}
                                        >
                                            <span className="layer-icon">{icon}</span>
                                            {label}
                                            {disabled
                                                ? <EyeOff size={14} style={{ marginLeft: 'auto' }} />
                                                : layers[key] ? <Eye size={14} style={{ marginLeft: 'auto' }} /> : <EyeOff size={14} style={{ marginLeft: 'auto' }} />}
                                        </button>
                                        {key === 'hotspots' && layers.hotspots && (
                                            <div className="hotspot-sub-filters">
                                                <button
                                                    className={`hotspot-sub-btn ${hotspotMode === 'realtime' ? 'active' : ''}`}
                                                    onClick={() => setHotspotMode('realtime')}
                                                >
                                                    ⚡ Realtime (48h)
                                                </button>
                                                <button
                                                    className={`hotspot-sub-btn ${hotspotMode === 'alltime' ? 'active' : ''}`}
                                                    onClick={() => setHotspotMode('alltime')}
                                                >
                                                    📊 All-Time (6mo)
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!layersPanelOpen && (
                        <button
                            className="map-layers-collapsed-btn"
                            onClick={() => setLayersPanelOpen(true)}
                        >
                            <Layers size={20} />
                        </button>
                    )}
                </div>

                {/* Map Bottom Bar */}
                <div className="map-overlay-bottom-bar">
                    <div className="map-copyright">© 2026 iDSS</div>
                    <div className="last-updated-badge" title="Time of last pollution data fetch">
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginRight: 4 }}>Pollution API{pollutionGridData?.interpolation ? ` (${pollutionGridData.interpolation})` : ''}</span>
                        <span className="time">{formattedPollutionTime}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
