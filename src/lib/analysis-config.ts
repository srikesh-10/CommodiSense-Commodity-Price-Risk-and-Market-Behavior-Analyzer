import type { AnalysisRequest, ApiCommodity, ApiInterval, ApiPeriod, CoverageInfo } from "./api";

export type Objective = "patterns" | "risk" | "states" | "compare";
export type Algorithm = "kmeans" | "gmm" | "hierarchical";
export type Sensitivity = "conservative" | "balanced" | "aggressive";
export type CommodityChoice = "gold" | "oil" | "both";

export interface AnalysisConfig {
  commodity: CommodityChoice; period: ApiPeriod; interval: ApiInterval; objective: Objective;
  algorithm: Algorithm; nClusters: number; pcaComponents: 2 | 3; hmmStates: number; sensitivity: Sensitivity;
  features: string[]; scaling: "standard" | "minmax" | "robust"; hmmCovariance: "full" | "diag" | "spherical"; hmmIter: number; randomState: number; metrics: string[];
}

export const FEATURES = [
  { key: "log_return", label: "Log return" }, { key: "rolling_vol_20", label: "20-day volatility" },
  { key: "momentum_20", label: "20-day momentum" }, { key: "range_pct", label: "Daily range" }, { key: "gold_oil_corr", label: "Gold–oil correlation" },
] as const;
export const METRICS = ["silhouette", "davies_bouldin", "calinski_harabasz", "log_likelihood", "aic", "bic"] as const;

/** Documented risk thresholds per sensitivity level. */
export const RISK_PRESETS: Record<Sensitivity, { label: string; varConfidence: number; volWindow: number; highRiskScore: number; description: string }> = {
  conservative: { label: "Conservative", varConfidence: 0.99, volWindow: 60, highRiskScore: 50, description: "99% VaR, 60-day volatility window, flags high risk at score ≥ 50." },
  balanced: { label: "Balanced", varConfidence: 0.95, volWindow: 20, highRiskScore: 66, description: "95% VaR, 20-day volatility window, flags high risk at score ≥ 66." },
  aggressive: { label: "Aggressive", varConfidence: 0.9, volWindow: 10, highRiskScore: 80, description: "90% VaR, 10-day volatility window, flags high risk at score ≥ 80." },
};

export const PERIODS: { key: ApiPeriod; label: string; days: number }[] = [
  { key: "1m", label: "1 Month", days: 31 }, { key: "3m", label: "3 Months", days: 92 }, { key: "6m", label: "6 Months", days: 183 },
  { key: "1y", label: "1 Year", days: 365 }, { key: "5y", label: "5 Years", days: 1826 }, { key: "all", label: "All Available Data", days: Infinity },
];

export const DEFAULT_CONFIG: AnalysisConfig = {
  commodity: "both", period: "1y", interval: "monthly", objective: "patterns",
  algorithm: "kmeans", nClusters: 3, pcaComponents: 2, hmmStates: 3, sensitivity: "balanced",
  features: ["log_return", "rolling_vol_20", "momentum_20"], scaling: "standard", hmmCovariance: "full", hmmIter: 200, randomState: 42,
  metrics: ["silhouette", "davies_bouldin", "log_likelihood"],
};

/** Which controls are shown for each objective. */
export function relevantSections(o: Objective) {
  return {
    clustering: o === "patterns" || o === "compare",
    hmm: o === "states" || o === "compare",
    risk: o === "risk" || o === "compare",
  };
}

export function selectedCommodities(c: CommodityChoice): ApiCommodity[] {
  return c === "both" ? ["gold", "oil"] : [c];
}

/** Returns a list of human-readable problems; empty means valid. */
export function validateConfig(c: AnalysisConfig, coverage?: CoverageInfo[]): string[] {
  const errs: string[] = [];
  const s = relevantSections(c.objective);
  if (c.objective === "compare" && c.commodity !== "both") errs.push("Comparing commodities requires “Compare Both”.");
  if (s.clustering && (c.nClusters < 2 || c.nClusters > 10)) errs.push("Number of clusters must be between 2 and 10.");
  if (s.clustering && c.pcaComponents > c.features.length) errs.push(`PCA needs at least ${c.pcaComponents} features selected.`);
  if (s.hmm && (c.hmmStates < 2 || c.hmmStates > 8)) errs.push("Hidden states must be between 2 and 8.");
  if (c.features.length === 0) errs.push("Select at least one feature.");
  if (c.features.includes("gold_oil_corr") && c.commodity !== "both") errs.push("Gold–oil correlation feature needs both commodities.");
  if (coverage?.length) {
    const p = PERIODS.find((x) => x.key === c.period)!;
    for (const cv of coverage.filter((x) => selectedCommodities(c.commodity).includes(x.commodity))) {
      const days = (Date.parse(cv.end) - Date.parse(cv.start)) / 86400000;
      if (Number.isFinite(p.days) && days + 3 < p.days) errs.push(`${cv.commodity === "gold" ? "Gold" : "Crude oil"} data only covers ${cv.start} to ${cv.end}; ${p.label} is not available.`);
      if (cv.intervals && !cv.intervals.includes(c.interval)) errs.push(`${c.interval} interval isn't supported for ${cv.commodity}.`);
    }
  }
  return errs;
}

export function toRequest(c: AnalysisConfig): AnalysisRequest {
  const s = relevantSections(c.objective);
  const r = RISK_PRESETS[c.sensitivity];
  return {
    commodities: selectedCommodities(c.commodity), period: c.period, interval: c.interval, objective: c.objective,
    clustering: s.clustering ? { algorithm: c.algorithm, n_clusters: c.nClusters, pca_components: c.pcaComponents } : undefined,
    hmm: s.hmm ? { n_states: c.hmmStates, covariance_type: c.hmmCovariance, n_iter: c.hmmIter } : undefined,
    risk: s.risk ? { sensitivity: c.sensitivity, var_confidence: r.varConfidence, vol_window: r.volWindow } : undefined,
    features: c.features, scaling: c.scaling, random_state: c.randomState, metrics: c.metrics,
  };
}
