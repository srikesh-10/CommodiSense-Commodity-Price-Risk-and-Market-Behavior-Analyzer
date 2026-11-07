// Centralized, typed client for the (proposed) CommodiSense analysis backend.
// These endpoints are a contract for a future backend — they are not guaranteed to exist.
// The frontend never calls external market-data providers or holds provider API keys.

// Empty default = same origin; the dev server proxies /api to the analysis backend.
export const API_BASE_URL: string =
  (import.meta.env['VITE_API_BASE_URL'] as string | undefined)?.replace(/\/$/, "") || "";

export const ENDPOINTS = {
  health: "/api/health",
  summary: "/api/market/summary",
  prices: "/api/market/prices",
  refresh: "/api/market/refresh",
  analysisRun: "/api/analysis/run",
  kmeans: "/api/models/kmeans/run",
  gmm: "/api/models/gmm/run",
  hierarchical: "/api/models/hierarchical/run",
  pca: "/api/models/pca/run",
  hmmFit: "/api/models/hmm/fit",
  hmmInfer: "/api/models/hmm/infer",
  riskSummary: "/api/risk/summary",
  experiments: "/api/models/experiments",
} as const;

export type DataSourceKind = "live" | "preloaded" | "demo";
export type ApiCommodity = "gold" | "oil";
export type ApiPeriod = "1m" | "3m" | "6m" | "1y" | "5y" | "all";
export type ApiInterval = "daily" | "weekly" | "monthly";

export interface HealthResponse { status: "ok" | "degraded" | "down"; version?: string; provider?: string; provider_status?: "ok" | "rate_limited" | "unavailable" }
export interface CoverageInfo { commodity: ApiCommodity; start: string; end: string; observations: number; missing_days?: number; intervals?: ApiInterval[] }
export interface MarketSummaryResponse {
  source: DataSourceKind; provider: string; latest_observation: string; last_refresh: string | null;
  coverage: CoverageInfo[]; quality?: { duplicates: number; gaps: number; outliers: number; notes?: string[] };
}
export interface PricePoint { date: string; close: number; return_pct?: number; rolling_vol?: number }
export interface PricesResponse { commodity: ApiCommodity; interval: ApiInterval; source: DataSourceKind; points: PricePoint[] }
export interface RefreshResponse { accepted: boolean; message?: string; retry_after_seconds?: number; last_refresh?: string }

export interface AnalysisRequest {
  commodities: ApiCommodity[]; period: ApiPeriod; interval: ApiInterval;
  objective: "patterns" | "risk" | "states" | "compare";
  clustering?: undefined | { algorithm: "kmeans" | "gmm" | "hierarchical"; n_clusters: number; pca_components: 2 | 3 };
  hmm?: undefined | { n_states: number; covariance_type: string; n_iter: number };
  risk?: undefined | { sensitivity: "conservative" | "balanced" | "aggressive"; var_confidence: number; vol_window: number };
  features: string[]; scaling: "standard" | "minmax" | "robust"; random_state: number; metrics: string[];
}
export interface SeriesOut { date: string; gold?: number; oil?: number; gold_return?: number; oil_return?: number; gold_vol?: number; oil_vol?: number }
export interface ClusterOut { id: number; size: number; centroid: Record<string, number> }
export interface DendrogramData {
  icoord: number[][];
  dcoord: number[][];
  color_list: string[];
  ivl: string[];
  leaves: number[];
  cut_threshold: number;
  max_d: number;
  truncated: boolean;
  total_observations: number;
}
export interface AnalysisResponse {
  run_id: string; source: DataSourceKind; period: { start: string; end: string; requested: ApiPeriod; truncated?: boolean; note?: string };
  series: SeriesOut[];
  clustering?: undefined | { algorithm: string; clusters: ClusterOut[]; points: { date: string; cluster: number; pc1: number; pc2: number; pc3?: number }[]; explained_variance: number[]; metrics: Record<string, number>; dendrogram?: DendrogramData };
  hmm?: { n_states: number; timeline: { date: string; state: number; prob: number }[]; transition_matrix: number[][]; state_stats: { state: number; mean_return: number; volatility: number; share: number }[]; log_likelihood?: number; aic?: number; bic?: number };
  risk?: Partial<Record<ApiCommodity, { max_drawdown: number; var: number; cvar: number; annual_vol: number; sharpe?: number; var_95?: number; cvar_95?: number; var_99?: number; cvar_99?: number; risk_free_rate?: number }>> & { thresholds?: Record<string, number> };
  correlation?: { pearson: number; rolling?: { date: string; value: number }[] };
  evaluation?: Record<string, number>;
  methodology?: string[];
  summary?: string;
}

export class ApiError extends Error {
  constructor(message: string, public status?: number, public kind: "network" | "http" | "timeout" | "invalid" = "http") { super(message); }
}

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init?.timeoutMs ?? 15000);
  let res: Response;
  try {
    res = await fetch(API_BASE_URL + path, { ...init, signal: ctrl.signal, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new ApiError("The analysis server took too long to respond.", undefined, "timeout");
    throw new ApiError(`Can't reach the analysis server at ${API_BASE_URL}.`, undefined, "network");
  } finally { clearTimeout(timer); }
  if (!res.ok) {
    let msg = `Server responded with ${res.status}.`;
    try { const j = await res.json(); if (j?.detail || j?.message) msg = String(j.detail ?? j.message); } catch { /* ignore */ }
    if (res.status === 429) msg = "The data provider's rate limit was reached. Please try again later.";
    throw new ApiError(msg, res.status, "http");
  }
  try { return (await res.json()) as T; } catch { throw new ApiError("The server returned an unreadable response.", res.status, "invalid"); }
}

export const api = {
  health: () => request<HealthResponse>(ENDPOINTS.health, { timeoutMs: 5000 }),
  summary: () => request<MarketSummaryResponse>(ENDPOINTS.summary),
  prices: (commodity: ApiCommodity, period: ApiPeriod, interval: ApiInterval = "daily") =>
    request<PricesResponse>(`${ENDPOINTS.prices}?commodity=${commodity}&period=${period}&interval=${interval}`),
  refresh: () => request<RefreshResponse>(ENDPOINTS.refresh, { method: "POST" }),
  runAnalysis: (body: AnalysisRequest) => request<AnalysisResponse>(ENDPOINTS.analysisRun, { method: "POST", body: JSON.stringify(body), timeoutMs: 120000 }),
  riskSummary: () => request<unknown>(ENDPOINTS.riskSummary),
  experiments: () => request<unknown>(ENDPOINTS.experiments),
};
