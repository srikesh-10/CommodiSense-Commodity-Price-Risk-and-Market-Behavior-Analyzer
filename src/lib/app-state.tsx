import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { RangeKey } from "./market-data";
import { api, ApiError, type AnalysisResponse, type HealthResponse, type MarketSummaryResponse } from "./api";
import { DEFAULT_CONFIG, toRequest, validateConfig, type AnalysisConfig } from "./analysis-config";

export type Commodity = "Gold" | "Crude Oil" | "Compare";
export type Connection = "checking" | "online" | "degraded" | "offline";

interface AppState {
  range: RangeKey; setRange: (r: RangeKey) => void;
  commodity: Commodity; setCommodity: (c: Commodity) => void;
  config: AnalysisConfig; setConfig: (c: AnalysisConfig) => void; resetAnalysis: () => void;
  connection: Connection; health: HealthResponse | null; summary: MarketSummaryResponse | null; dataError: string | null;
  reloadStatus: () => Promise<void>;
  refreshing: boolean; refreshMessage: string | null; refreshData: () => Promise<void>;
  analysis: { status: "idle" | "running" | "success" | "error"; result: AnalysisResponse | null; error: string | null; issues: string[] };
  runAnalysis: (overrideConfig?: AnalysisConfig) => Promise<void>;
}
const Ctx = createContext<AppState | null>(null);
const msg = (e: unknown) => (e instanceof ApiError ? e.message : "Unexpected error.");

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<RangeKey>("1Y");
  const [commodity, setCommodity] = useState<Commodity>("Compare");
  const [config, setConfig] = useState<AnalysisConfig>(DEFAULT_CONFIG);
  const [connection, setConnection] = useState<Connection>("checking");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [summary, setSummary] = useState<MarketSummaryResponse | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AppState["analysis"]>({ status: "idle", result: null, error: null, issues: [] });

  const reloadStatus = useCallback(async () => {
    setConnection("checking"); setDataError(null);
    try {
      const h = await api.health(); setHealth(h);
      setConnection(h.status === "ok" ? "online" : "degraded");
      setSummary(await api.summary());
    } catch (e) { setConnection(health ? "degraded" : "offline"); setDataError(msg(e)); }
  }, [health]);

  useEffect(() => { void reloadStatus(); /* on load */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshData = async () => {
    setRefreshing(true); setRefreshMessage(null);
    try {
      const r = await api.refresh();
      setRefreshMessage(r.accepted ? r.message ?? "Refresh complete." : r.message ?? `Refresh not accepted${r.retry_after_seconds ? `; retry in ${r.retry_after_seconds}s` : ""}.`);
      await reloadStatus();
    } catch (e) { setRefreshMessage(msg(e)); } finally { setRefreshing(false); }
  };

  const runAnalysis = async (overrideConfig?: AnalysisConfig) => {
    const activeCfg = overrideConfig || config;
    const issues = validateConfig(activeCfg, summary?.coverage);
    if (issues.length) { setAnalysis({ status: "error", result: null, error: "Please fix the configuration first.", issues }); return; }
    setAnalysis((a) => ({ ...a, status: "running", error: null, issues: [] }));
    try { setAnalysis({ status: "success", result: await api.runAnalysis(toRequest(activeCfg)), error: null, issues: [] }); }
    catch (e) { setAnalysis({ status: "error", result: null, error: msg(e), issues: [] }); }
  };

  const resetAnalysis = () => { setConfig(DEFAULT_CONFIG); setAnalysis({ status: "idle", result: null, error: null, issues: [] }); };

  return <Ctx.Provider value={{ range, setRange, commodity, setCommodity, config, setConfig, resetAnalysis, connection, health, summary, dataError, reloadStatus, refreshing, refreshMessage, refreshData, analysis, runAnalysis }}>{children}</Ctx.Provider>;
}
export function useAppState() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAppState outside provider");
  return c;
}
