// Illustrative SAMPLE data only — deterministic synthetic series, not live market prices.
export type Regime = "Bullish" | "Bearish" | "Sideways" | "High Volatility";
export type RangeKey = "1M" | "3M" | "6M" | "1Y" | "5Y" | "ALL";

export interface Point {
  date: string;
  gold: number;
  oil: number;
  goldChg: number;
  oilChg: number;
  regime: Regime;
  risk: number; // 0-100
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r: () => number) {
  return Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
}

const DAYS = 730;
function build(): Point[] {
  const r = mulberry32(42);
  let gold = 1820, oil = 78;
  const out: Point[] = [];
  const start = new Date(Date.UTC(2024, 9, 17));
  for (let i = 0; i < DAYS; i++) {
    const phase = Math.sin(i / 70);
    const volBoost = i % 180 > 150 ? 2.2 : 1;
    const gr = 0.00035 + 0.0004 * phase + 0.009 * volBoost * gauss(r);
    const or = -0.0001 + 0.0009 * Math.sin(i / 55 + 1) + 0.019 * volBoost * gauss(r);
    const pg = gold, po = oil;
    gold = Math.max(1200, gold * (1 + gr));
    oil = Math.max(35, oil * (1 + or));
    const d = new Date(start); d.setUTCDate(d.getUTCDate() + i);
    out.push({
      date: d.toISOString().slice(0, 10),
      gold: +gold.toFixed(2), oil: +oil.toFixed(2),
      goldChg: i ? ((gold - pg) / pg) * 100 : 0,
      oilChg: i ? ((oil - po) / po) * 100 : 0,
      regime: "Sideways", risk: 0,
    });
  }
  // regimes & risk from rolling 20-day stats on oil+gold
  for (let i = 0; i < out.length; i++) {
    const w = out.slice(Math.max(0, i - 19), i + 1);
    const ret = (w[w.length - 1]!.gold / w[0]!.gold - 1) * 100 + (w[w.length - 1]!.oil / w[0]!.oil - 1) * 50;
    const vol = Math.sqrt(w.reduce((s, p) => s + p.oilChg ** 2 + p.goldChg ** 2, 0) / w.length);
    out[i]!.risk = Math.min(100, Math.round(vol * 26));
    out[i]!.regime = vol > 2.6 ? "High Volatility" : ret > 3 ? "Bullish" : ret < -3 ? "Bearish" : "Sideways";
  }
  return out;
}

export const SERIES: Point[] = build();
export const LAST_UPDATED = SERIES[SERIES.length - 1]!.date;

const RANGE_DAYS: Record<RangeKey, number> = { "1M": 22, "3M": 66, "6M": 130, "1Y": 260, "5Y": 1300, ALL: DAYS };
export function sliceRange(range: RangeKey) {
  return SERIES.slice(-RANGE_DAYS[range]);
}

export function indexed(points: Point[]) {
  const g0 = points[0]?.gold ?? 1, o0 = points[0]?.oil ?? 1;
  return points.map((p) => ({ ...p, goldIdx: +((p.gold / g0) * 100).toFixed(2), oilIdx: +((p.oil / o0) * 100).toFixed(2) }));
}

export const REGIMES: { key: Regime; color: string; desc: string }[] = [
  { key: "Bullish", color: "var(--bull)", desc: "Sustained upward drift" },
  { key: "Bearish", color: "var(--bear)", desc: "Persistent declines" },
  { key: "Sideways", color: "var(--secondary)", desc: "Range-bound consolidation" },
  { key: "High Volatility", color: "var(--gold)", desc: "Large daily swings" },
];

export function regimeCounts(points: Point[]) {
  return REGIMES.map((r) => ({ ...r, count: points.filter((p) => p.regime === r.key).length }));
}

export function riskLabel(score: number) {
  return score >= 66 ? "High" : score >= 40 ? "Elevated" : "Low";
}

export const ASSUMED_RISK_FREE_RATE_PCT = 2.5;

export function stats(values: number[]) {
  const n = values.length || 1;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const sorted = [...values].sort((a, b) => a - b);
  return { mean, sd, var95: sorted[Math.floor(n * 0.05)] ?? 0, min: sorted[0] ?? 0, max: sorted[n - 1] ?? 0 };
}

export const fmtUsd = (v: number) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtPct = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(2) + "%";

/** Convert backend SeriesOut[] to the Point[] format expected by PriceChart and other widgets. */
export function seriesOutToPoints(series: { date: string; gold?: number | null; oil?: number | null; gold_return?: number | null; oil_return?: number | null; gold_vol?: number | null; oil_vol?: number | null }[]): Point[] {
  return series.map((s) => ({
    date: s.date,
    gold: s.gold ?? 0,
    oil: s.oil ?? 0,
    goldChg: s.gold_return ?? 0,
    oilChg: s.oil_return ?? 0,
    regime: "Sideways" as Regime,
    risk: 0,
  }));
}
