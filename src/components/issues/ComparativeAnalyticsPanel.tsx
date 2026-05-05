import { useMemo, useState } from 'react';
import { BarChart3, PieChart as PieChartIcon, MapPin, Layers } from 'lucide-react';
import type { Issue } from '../../types';

export type BoundaryLevel = 'ward' | 'zone';

type PollutantId = 'pm25' | 'pm10' | 'co' | 'no2' | 'o3';

const POLLUTANTS: { id: PollutantId; label: string; unit: string; color: string }[] = [
    { id: 'pm25', label: 'PM2.5', unit: 'µg/m³', color: '#a855f7' },
    { id: 'pm10', label: 'PM10', unit: 'µg/m³', color: '#6366f1' },
    { id: 'co', label: 'CO', unit: 'µg/m³ (est.)', color: '#f59e0b' },
    { id: 'no2', label: 'NO₂', unit: 'µg/m³ (est.)', color: '#ef4444' },
    { id: 'o3', label: 'O₃', unit: 'µg/m³ (est.)', color: '#10b981' },
];

/** Model-estimated gases where sensors do not report full suite — derived from PM + issue context for visualization. */
function pollutantRow(issue: Issue): Record<PollutantId, number> {
    const pm25 = issue.pm25;
    const pm10 = issue.pm10;
    const traffic = issue.type === 'traffic_congestion';
    const industrial = issue.type === 'industrial_emission';
    const co = Math.round(pm25 * 0.72 + issue.zone * 1.8 + (industrial ? 35 : 12));
    const no2 = Math.round(pm25 * 0.48 + (traffic ? 52 : 24) + issue.ward % 7);
    const o3 = Math.max(18, Math.round(108 - pm25 * 0.28 + (traffic ? -12 : 8) + (issue.ward % 11)));
    return { pm25, pm10, co, no2, o3 };
}

type BucketAgg = {
    key: string;
    label: string;
    n: number;
    avg: Record<PollutantId, number>;
};

function aggregateIssues(issues: Issue[], level: BoundaryLevel): BucketAgg[] {
    const map = new Map<string, { sums: Record<PollutantId, number>; count: number }>();

    for (const issue of issues) {
        const rawKey = level === 'ward' ? String(issue.ward) : String(issue.zone);
        const row = pollutantRow(issue);
        const cur = map.get(rawKey) ?? {
            sums: { pm25: 0, pm10: 0, co: 0, no2: 0, o3: 0 },
            count: 0,
        };
        cur.count += 1;
        for (const p of POLLUTANTS) {
            cur.sums[p.id] += row[p.id];
        }
        map.set(rawKey, cur);
    }

    const out: BucketAgg[] = [];
    for (const [key, v] of map) {
        const avg = {} as Record<PollutantId, number>;
        for (const p of POLLUTANTS) {
            avg[p.id] = Math.round((v.sums[p.id] / v.count) * 10) / 10;
        }
        const label = level === 'ward' ? `Ward ${key}` : `Zone ${key}`;
        out.push({ key, label, n: v.count, avg });
    }
    out.sort((a, b) => {
        const ak = level === 'ward' ? Number(a.key) : Number(a.key);
        const bk = level === 'ward' ? Number(b.key) : Number(b.key);
        return ak - bk;
    });
    return out;
}

function pieSlices(avg: Record<PollutantId, number>): { id: PollutantId; value: number; pct: number }[] {
    const weights = POLLUTANTS.map(p => ({ id: p.id, value: Math.max(0, avg[p.id]) }));
    const sum = weights.reduce((s, w) => s + w.value, 0);
    if (sum <= 0) return weights.map(w => ({ ...w, pct: 0 }));
    return weights.map(w => ({ ...w, pct: (w.value / sum) * 100 }));
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const large = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`;
}

const PIE_CX = 140;
const PIE_CY = 140;
const PIE_R = 118;

export default function ComparativeAnalyticsPanel({ issues }: { issues: Issue[] }) {
    const [level, setLevel] = useState<BoundaryLevel>('ward');
    const [chartKind, setChartKind] = useState<'bar' | 'pie'>('bar');
    const [pieBucketKey, setPieBucketKey] = useState<string>('__aggregate__');

    const buckets = useMemo(() => aggregateIssues(issues, level), [issues, level]);

    const districtAvg = useMemo(() => {
        if (!issues.length) return null;
        const sums: Record<PollutantId, number> = { pm25: 0, pm10: 0, co: 0, no2: 0, o3: 0 };
        for (const issue of issues) {
            const row = pollutantRow(issue);
            for (const p of POLLUTANTS) sums[p.id] += row[p.id];
        }
        const avg = {} as Record<PollutantId, number>;
        for (const p of POLLUTANTS) {
            avg[p.id] = Math.round((sums[p.id] / issues.length) * 10) / 10;
        }
        return avg;
    }, [issues]);

    const pieTargetAvg = useMemo(() => {
        if (!districtAvg) return null;
        if (pieBucketKey === '__aggregate__') return districtAvg;
        const b = buckets.find(x => x.key === pieBucketKey);
        return b?.avg ?? districtAvg;
    }, [districtAvg, pieBucketKey, buckets]);

    const pieData = useMemo(() => (pieTargetAvg ? pieSlices(pieTargetAvg) : []), [pieTargetAvg]);

    const pieArcs = useMemo(() => {
        let angle = 0;
        return pieData.map(slice => {
            const meta = POLLUTANTS.find(p => p.id === slice.id)!;
            const sweep = (slice.pct / 100) * 360;
            const start = angle;
            angle += sweep;
            const d = slice.pct < 0.05 ? null : describeArc(PIE_CX, PIE_CY, PIE_R, start, start + sweep);
            return { slice, meta, d };
        });
    }, [pieData]);

    const barDimensions = useMemo(() => {
        const n = Math.max(1, buckets.length);
        const groupWidth = 72;
        const barWidth = 10;
        const gap = 4;
        const chartWidth = Math.min(1200, 80 + n * groupWidth);
        const chartHeight = 300;
        const padL = 52;
        const padR = 24;
        const padT = 16;
        const padB = 56;

        let maxVal = 1;
        for (const b of buckets) {
            for (const p of POLLUTANTS) {
                maxVal = Math.max(maxVal, b.avg[p.id]);
            }
        }

        return { n, groupWidth, barWidth, gap, chartWidth, chartHeight, padL, padR, padT, padB, maxVal };
    }, [buckets]);

    if (!issues.length) {
        return (
            <div className="analytics-empty">
                <BarChart3 size={40} style={{ opacity: 0.35 }} />
                <h3>No issues in this filter</h3>
                <p>Adjust geography or date filters to load comparative analytics.</p>
            </div>
        );
    }

    return (
        <div className="comparative-analytics">
            <div className="analytics-toolbar">
                <div className="analytics-toolbar-group">
                    <span className="analytics-toolbar-label">Administrative level</span>
                    <div className="analytics-segment">
                        <button
                            type="button"
                            className={level === 'ward' ? 'active' : ''}
                            onClick={() => { setLevel('ward'); setPieBucketKey('__aggregate__'); }}
                        >
                            <MapPin size={14} /> Ward
                        </button>
                        <button
                            type="button"
                            className={level === 'zone' ? 'active' : ''}
                            onClick={() => { setLevel('zone'); setPieBucketKey('__aggregate__'); }}
                        >
                            <Layers size={14} /> Zone
                        </button>
                    </div>
                </div>

                <div className="analytics-toolbar-group">
                    <span className="analytics-toolbar-label">Chart type</span>
                    <div className="analytics-segment">
                        <button type="button" className={chartKind === 'bar' ? 'active' : ''} onClick={() => setChartKind('bar')}>
                            <BarChart3 size={14} /> Bar
                        </button>
                        <button type="button" className={chartKind === 'pie' ? 'active' : ''} onClick={() => setChartKind('pie')}>
                            <PieChartIcon size={14} /> Pie
                        </button>
                    </div>
                </div>

                {chartKind === 'pie' && (
                    <div className="analytics-toolbar-group analytics-toolbar-grow">
                        <span className="analytics-toolbar-label">Pie focus</span>
                        <select
                            className="analytics-select"
                            value={pieBucketKey}
                            onChange={(e) => setPieBucketKey(e.target.value)}
                        >
                            <option value="__aggregate__">District aggregate (all filtered issues)</option>
                            {buckets.map(b => (
                                <option key={b.key} value={b.key}>
                                    {b.label} ({b.n} issue{b.n === 1 ? '' : 's'})
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <p className="analytics-footnote">
                PM2.5 and PM10 are taken from issue records. CO, NO₂, and O₃ are estimated for comparison where multi-pollutant observations are not stored with each issue.
            </p>

            <div className="analytics-legend">
                {POLLUTANTS.map(p => (
                    <span key={p.id} className="analytics-legend-item">
                        <span className="analytics-dot" style={{ background: p.color }} />
                        {p.label} <span className="analytics-legend-unit">({p.unit})</span>
                    </span>
                ))}
            </div>

            {chartKind === 'bar' && (
                <div className="analytics-chart-wrap">
                    <svg
                        className="analytics-bar-svg"
                        viewBox={`0 0 ${barDimensions.chartWidth} ${barDimensions.chartHeight}`}
                        preserveAspectRatio="xMinYMid meet"
                    >
                        <rect
                            x={0}
                            y={0}
                            width={barDimensions.chartWidth}
                            height={barDimensions.chartHeight}
                            fill="transparent"
                        />
                        {/* Y axis ticks */}
                        {[0, 0.25, 0.5, 0.75, 1].map(t => {
                            const y =
                                barDimensions.padT +
                                (1 - t) * (barDimensions.chartHeight - barDimensions.padT - barDimensions.padB);
                            const val = Math.round(t * barDimensions.maxVal);
                            return (
                                <g key={t}>
                                    <line
                                        x1={barDimensions.padL - 4}
                                        y1={y}
                                        x2={barDimensions.chartWidth - barDimensions.padR}
                                        y2={y}
                                        stroke="var(--border-color)"
                                        strokeOpacity={0.45}
                                        strokeDasharray="4 4"
                                    />
                                    <text x={4} y={y + 4} fontSize={10} fill="var(--text-muted)">
                                        {val}
                                    </text>
                                </g>
                            );
                        })}

                        {buckets.map((b, gi) => {
                            const gx =
                                barDimensions.padL + gi * barDimensions.groupWidth + (barDimensions.groupWidth - 5 * barDimensions.barWidth - 4 * barDimensions.gap) / 2;
                            return (
                                <g key={b.key}>
                                    {POLLUTANTS.map((p, pi) => {
                                        const h =
                                            (b.avg[p.id] / barDimensions.maxVal) *
                                            (barDimensions.chartHeight - barDimensions.padT - barDimensions.padB);
                                        const x = gx + pi * (barDimensions.barWidth + barDimensions.gap);
                                        const y =
                                            barDimensions.chartHeight -
                                            barDimensions.padB -
                                            h;
                                        return (
                                            <rect
                                                key={p.id}
                                                x={x}
                                                y={y}
                                                width={barDimensions.barWidth}
                                                height={Math.max(1, h)}
                                                fill={p.color}
                                                rx={2}
                                            >
                                                <title>{`${b.label} · ${p.label}: ${b.avg[p.id]} ${p.unit}`}</title>
                                            </rect>
                                        );
                                    })}
                                    <text
                                        x={gx + (5 * barDimensions.barWidth + 4 * barDimensions.gap) / 2}
                                        y={barDimensions.chartHeight - 12}
                                        fontSize={10}
                                        fill="var(--text-secondary)"
                                        textAnchor="middle"
                                    >
                                        {b.label}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                    <div className="analytics-x-label">{level === 'ward' ? 'Ward' : 'Zone'} (average concentration)</div>
                </div>
            )}

            {chartKind === 'pie' && pieTargetAvg && (
                <div className="analytics-chart-wrap analytics-pie-wrap">
                    <svg viewBox="0 0 280 280" className="analytics-pie-svg">
                        {pieArcs.map(({ slice, meta, d }) =>
                            d ? (
                                <path key={slice.id} d={d} fill={meta.color} stroke="var(--bg-card)" strokeWidth={1}>
                                    <title>{`${meta.label}: ${slice.pct.toFixed(1)}% of profile`}</title>
                                </path>
                            ) : null,
                        )}
                        <text x={PIE_CX} y={PIE_CY - 4} textAnchor="middle" fontSize={12} fill="var(--text-muted)">
                            Pollutant mix
                        </text>
                        <text x={PIE_CX} y={PIE_CY + 14} textAnchor="middle" fontSize={11} fill="var(--text-secondary)">
                            {pieBucketKey === '__aggregate__' ? 'District aggregate' : buckets.find(b => b.key === pieBucketKey)?.label}
                        </text>
                    </svg>
                    <ul className="analytics-pie-legend">
                        {pieData.map(slice => {
                            const meta = POLLUTANTS.find(p => p.id === slice.id)!;
                            return (
                                <li key={slice.id}>
                                    <span className="analytics-dot" style={{ background: meta.color }} />
                                    <span>{meta.label}</span>
                                    <strong>{slice.pct.toFixed(1)}%</strong>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}
