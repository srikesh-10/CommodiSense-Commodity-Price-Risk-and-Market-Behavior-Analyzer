import { useState, type ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, Bar, BarChart } from "recharts";
import { AlertTriangle, ChevronDown, Loader2, Play, RefreshCw, RotateCcw, Sparkles, Database, CircleCheck, CircleX, CircleDashed } from "lucide-react";
import { useAppState, type Connection } from "@/lib/app-state";
import { API_BASE_URL, type DataSourceKind } from "@/lib/api";
import { FEATURES, METRICS, PERIODS, RISK_PRESETS, relevantSections, type AnalysisConfig } from "@/lib/analysis-config";
import { Panel, DendrogramChart } from "./widgets";
import { cn } from "@/lib/utils";

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };
const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 } };
const PALETTE = ["var(--secondary)", "var(--gold)", "var(--bull)", "var(--bear)", "var(--oil)", "var(--primary)", "var(--muted-foreground)", "var(--accent)", "var(--ring)", "var(--chart-1)"];

export const SOURCE_LABEL: Record<DataSourceKind, string> = { live: "Live provider data", preloaded: "Preloaded historical data", demo: "Illustrative demonstration data" };

export function ConnectionPill({ connection }: { connection: Connection }) {
  const map = { checking: ["bg-muted-foreground", "Checking server…"], online: ["bg-bull", "Server online"], degraded: ["bg-gold", "Server degraded"], offline: ["bg-bear", "Server offline"] } as const;
  const [dot, text] = map[connection];
  return <span className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-xs font-medium"><span className={cn("h-2 w-2 rounded-full", dot, connection === "checking" && "animate-pulse")} />{text}</span>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="block"><span className="text-xs font-semibold text-muted-foreground">{label}</span><div className="mt-1.5">{children}</div>{hint && <span className="text-[11px] text-muted-foreground mt-1 block">{hint}</span>}</label>;
}
function Select<T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[] }) {
  return (
    <select value={String(value)} onChange={(e) => { const o = options.find((x) => String(x.v) === e.target.value); if (o) onChange(o.v); }}
      className="clay w-full px-3 py-2.5 text-sm font-medium bg-card outline-none focus-visible:ring-2 ring-ring">
      {options.map((o) => <option key={String(o.v)} value={String(o.v)}>{o.l}</option>)}
    </select>
  );
}
function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value)} className="flex-1 accent-[var(--secondary)]" />
      <span className="clay w-10 py-1.5 text-center text-sm font-bold tabular">{value}</span>
    </div>
  );
}

export function ConfigurePanel() {
  const { config, setConfig, runAnalysis, resetAnalysis, analysis, connection, refreshData, refreshing } = useAppState();
  const [adv, setAdv] = useState(false);
  const set = <K extends keyof AnalysisConfig>(k: K, v: AnalysisConfig[K]) => setConfig({ ...config, [k]: v });
  const s = relevantSections(config.objective);
  const toggle = (k: "features" | "metrics", v: string) => set(k, config[k].includes(v) ? config[k].filter((x) => x !== v) : [...config[k], v]);
  const running = analysis.status === "running";

  return (
    <Panel title="Configure Your Analysis" subtitle="Data is fetched automatically from the analysis server — no files needed."
      action={<div className="flex gap-2">
        <button onClick={refreshData} disabled={refreshing} className="clay px-3 py-2 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"><RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />Refresh Data</button>
        <button onClick={resetAnalysis} className="clay px-3 py-2 text-xs font-semibold inline-flex items-center gap-1.5"><RotateCcw className="h-3.5 w-3.5" />Reset Analysis</button>
      </div>}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Commodity"><Select value={config.commodity} onChange={(v) => set("commodity", v)} options={[{ v: "gold", l: "Gold" }, { v: "oil", l: "Crude Oil" }, { v: "both", l: "Compare Both" }]} /></Field>
        <Field label="Historical period"><Select value={config.period} onChange={(v) => set("period", v)} options={PERIODS.map((p) => ({ v: p.key, l: p.label }))} /></Field>
        <Field label="Chart interval"><Select value={config.interval} onChange={(v) => set("interval", v)} options={[{ v: "daily", l: "Daily" }, { v: "weekly", l: "Weekly" }, { v: "monthly", l: "Monthly" }]} /></Field>
        <Field label="Analysis objective"><Select value={config.objective} onChange={(v) => set("objective", v)} options={[{ v: "patterns", l: "Discover Market Patterns" }, { v: "risk", l: "Detect Risk" }, { v: "states", l: "Infer Market States" }, { v: "compare", l: "Compare Commodities" }]} /></Field>
        {s.clustering && <>
          <Field label="Clustering algorithm"><Select value={config.algorithm} onChange={(v) => set("algorithm", v)} options={[{ v: "kmeans", l: "K-means" }, { v: "gmm", l: "Gaussian Mixture (GMM)" }, { v: "hierarchical", l: "Hierarchical Clustering" }]} /></Field>
          <Field label="Number of clusters"><Stepper value={config.nClusters} min={2} max={10} onChange={(v) => set("nClusters", v)} /></Field>
          <Field label="PCA components"><Select value={config.pcaComponents} onChange={(v) => set("pcaComponents", v)} options={[{ v: 2, l: "2 components" }, { v: 3, l: "3 components" }]} /></Field>
        </>}
        {s.hmm && <Field label="HMM hidden states"><Stepper value={config.hmmStates} min={2} max={8} onChange={(v) => set("hmmStates", v)} /></Field>}
        {s.risk && <Field label="Risk sensitivity" hint={RISK_PRESETS[config.sensitivity].description}><Select value={config.sensitivity} onChange={(v) => set("sensitivity", v)} options={(["conservative", "balanced", "aggressive"] as const).map((k) => ({ v: k, l: RISK_PRESETS[k].label }))} /></Field>}
      </div>

      <button onClick={() => setAdv(!adv)} className="mt-5 text-xs font-semibold text-secondary inline-flex items-center gap-1"><ChevronDown className={cn("h-4 w-4 transition-transform", adv && "rotate-180")} />Advanced Settings</button>
      {adv && (
        <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-4 rounded-2xl bg-surface/60 p-4">
          <Field label="Features">
            <div className="flex flex-wrap gap-1.5">{FEATURES.map((f) => <button key={f.key} onClick={() => toggle("features", f.key)} className={cn("rounded-lg px-2.5 py-1 text-xs font-medium transition-colors", config.features.includes(f.key) ? "clay text-primary" : "bg-card text-muted-foreground")}>{f.label}</button>)}</div>
          </Field>
          <Field label="Scaling"><Select value={config.scaling} onChange={(v) => set("scaling", v)} options={[{ v: "standard", l: "Standard (z-score)" }, { v: "minmax", l: "Min–max" }, { v: "robust", l: "Robust (median/IQR)" }]} /></Field>
          {s.hmm && <Field label="HMM covariance / iterations">
            <div className="flex gap-2"><Select value={config.hmmCovariance} onChange={(v) => set("hmmCovariance", v)} options={[{ v: "full", l: "Full" }, { v: "diag", l: "Diagonal" }, { v: "spherical", l: "Spherical" }]} />
              <input type="number" min={10} max={2000} value={config.hmmIter} onChange={(e) => set("hmmIter", +e.target.value)} className="clay w-24 px-2 py-2 text-sm bg-card tabular" /></div>
          </Field>}
          <Field label="Random seed"><input type="number" value={config.randomState} onChange={(e) => set("randomState", +e.target.value)} className="clay w-full px-3 py-2.5 text-sm bg-card tabular" /></Field>
          <Field label="Evaluation metrics">
            <div className="flex flex-wrap gap-1.5">{METRICS.map((m) => <button key={m} onClick={() => toggle("metrics", m)} className={cn("rounded-lg px-2.5 py-1 text-xs font-medium", config.metrics.includes(m) ? "clay text-primary" : "bg-card text-muted-foreground")}>{m.replace(/_/g, " ")}</button>)}</div>
          </Field>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button onClick={runAnalysis} disabled={running} className="clay-primary px-7 py-3.5 text-sm font-bold inline-flex items-center gap-2 disabled:opacity-70">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{running ? "Analyzing…" : "Analyze Market"}
        </button>
        {connection === "offline" && <span className="text-xs text-muted-foreground">The analysis server isn't reachable yet, so analysis will fail until it's running.</span>}
      </div>
      {running && <div className="mt-4 h-1.5 rounded-full bg-surface overflow-hidden"><div className="h-full w-1/3 rounded-full bg-secondary animate-[progress_1.4s_ease-in-out_infinite]" /></div>}
      {analysis.status === "error" && (
        <div className="mt-4 rounded-2xl border border-bear/30 bg-bear/10 p-4 text-sm">
          <div className="font-semibold flex items-center gap-2 text-bear"><AlertTriangle className="h-4 w-4" />Analysis couldn't run</div>
          <p className="mt-1">{analysis.error}</p>
          {analysis.issues.length > 0 && <ul className="mt-2 list-disc pl-5 space-y-0.5">{analysis.issues.map((i) => <li key={i}>{i}</li>)}</ul>}
        </div>
      )}
    </Panel>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string | undefined }) {
  return <div className="glass glass-lift p-4"><div className="text-xs text-muted-foreground">{label}</div><div className={cn("text-lg font-extrabold tabular mt-1", tone)}>{value}</div></div>;
}
const pct = (v?: number) => (v == null ? "—" : `${v.toFixed(2)}%`);

export function AnalysisResults() {
  const { analysis } = useAppState();
  const r = analysis.result;
  if (analysis.status === "idle") return (
    <Panel><div className="text-center py-10 text-muted-foreground"><Sparkles className="h-8 w-8 mx-auto text-gold" /><div className="mt-3 font-semibold text-foreground">No analysis yet</div><p className="text-sm">Choose your settings and press “Analyze Market” to see results computed by the server.</p></div></Panel>
  );
  if (!r) return null;
  const cl = r.clustering, hmm = r.hmm;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-gold-soft/50 px-3 py-1 font-semibold">{SOURCE_LABEL[r.source]}</span>
        <span className="rounded-full bg-surface px-3 py-1">{r.period.start} → {r.period.end}</span>
        <span className="rounded-full bg-surface px-3 py-1">Run {r.run_id}</span>
      </div>
      {r.period.truncated && <div className="rounded-2xl bg-gold-soft/40 p-3 text-sm"><AlertTriangle className="inline h-4 w-4 mr-1" />{r.period.note ?? "The requested period exceeds the available data; results cover only the available range."}</div>}
      {r.summary && <Panel title="Summary" subtitle="Generated from the calculated results"><p className="text-sm leading-relaxed">{r.summary}</p></Panel>}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Historical prices" subtitle="Observed values">
          <ResponsiveContainer width="100%" height={280}><LineChart data={r.series}><CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="date" tick={axis} minTickGap={50} /><YAxis yAxisId="g" tick={axis} width={50} /><YAxis yAxisId="o" orientation="right" tick={axis} width={40} /><Tooltip {...tip} />
            <Line yAxisId="g" dataKey="gold" stroke="var(--gold)" dot={false} strokeWidth={2} /><Line yAxisId="o" dataKey="oil" stroke="var(--oil)" dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer>
        </Panel>
        <Panel title="Daily returns & rolling volatility" subtitle="Observed returns, computed volatility">
          <ResponsiveContainer width="100%" height={280}><AreaChart data={r.series}><CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="date" tick={axis} minTickGap={50} /><YAxis tick={axis} width={40} unit="%" /><Tooltip {...tip} />
            <Area dataKey="gold_vol" stroke="var(--gold)" fill="var(--gold)" fillOpacity={0.15} /><Area dataKey="oil_vol" stroke="var(--oil)" fill="var(--oil)" fillOpacity={0.15} />
            <Line dataKey="gold_return" stroke="var(--gold)" dot={false} strokeOpacity={0.5} /><Line dataKey="oil_return" stroke="var(--oil)" dot={false} strokeOpacity={0.5} /></AreaChart></ResponsiveContainer>
        </Panel>
      </div>

      {cl && <div className="grid gap-6 xl:grid-cols-3">
        <Panel title={`Discovered clusters · ${cl.algorithm}`} subtitle="Model-inferred groups on the PCA projection. Cluster IDs carry no meaning until their centroids are examined." className="xl:col-span-2">
          <ResponsiveContainer width="100%" height={360}><ScatterChart><CartesianGrid stroke="var(--border)" strokeDasharray="3 4" /><XAxis type="number" dataKey="pc1" name="PC1" tick={axis} /><YAxis type="number" dataKey="pc2" name="PC2" tick={axis} /><ZAxis range={[26, 26]} /><Tooltip {...tip} />
            {cl.clusters.map((c, i) => <Scatter key={c.id} name={`Cluster ${c.id}`} data={cl.points.filter((p) => p.cluster === c.id)} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.75} />)}</ScatterChart></ResponsiveContainer>
        </Panel>
        <Panel title="PCA explained variance">
          <ResponsiveContainer width="100%" height={180}><BarChart data={cl.explained_variance.map((v, i) => ({ pc: `PC${i + 1}`, v: +(v * 100).toFixed(1) }))}><XAxis dataKey="pc" tick={axis} /><YAxis tick={axis} unit="%" width={40} /><Tooltip {...tip} /><Bar dataKey="v" fill="var(--secondary)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
          <div className="mt-3 space-y-2 text-xs">{cl.clusters.map((c, i) => (
            <div key={c.id} className="rounded-xl bg-surface p-2.5"><div className="font-semibold flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />Cluster {c.id} · {c.size} obs.</div>
              <div className="text-muted-foreground mt-0.5 tabular">{Object.entries(c.centroid).map(([k, v]) => `${k}: ${v.toFixed(3)}`).join(" · ")}</div></div>
          ))}</div>
        </Panel>
      </div>}

      {cl?.dendrogram && (
        <Panel
          title="Hierarchical Cluster Tree (Dendrogram)"
          subtitle="Agglomerative hierarchical clustering dendrogram with Ward's minimum variance linkage and cluster cut threshold"
        >
          <DendrogramChart data={cl.dendrogram} height={380} />
        </Panel>
      )}

      {hmm && <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="HMM-inferred state timeline" subtitle="Inferred, not observed. State numbers are labels; see their learned statistics." className="xl:col-span-2">
          <div className="flex h-14 rounded-xl overflow-hidden">{hmm.timeline.map((p) => <div key={p.date} title={`${p.date}: state ${p.state} (p=${p.prob.toFixed(2)})`} className="flex-1" style={{ background: PALETTE[p.state % PALETTE.length], opacity: 0.4 + 0.6 * p.prob }} />)}</div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs">{hmm.state_stats.map((s) => (
            <div key={s.state} className="rounded-xl bg-surface p-2.5"><div className="font-semibold flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: PALETTE[s.state % PALETTE.length] }} />State {s.state}</div>
              <div className="text-muted-foreground tabular">mean {pct(s.mean_return)} · vol {pct(s.volatility)} · {(s.share * 100).toFixed(0)}% of time</div></div>
          ))}</div>
        </Panel>
        <Panel title="Transition probabilities" subtitle="Row = from, column = to">
          <div className="grid gap-1" style={{ gridTemplateColumns: `auto repeat(${hmm.n_states}, 1fr)` }}>
            <div />{hmm.transition_matrix.map((_, j) => <div key={j} className="text-[10px] text-center text-muted-foreground">S{j}</div>)}
            {hmm.transition_matrix.map((row, i) => [<div key={`l${i}`} className="text-[10px] text-muted-foreground pr-1 self-center">S{i}</div>,
              ...row.map((v, j) => <div key={`${i}-${j}`} className="aspect-square rounded-md grid place-items-center text-[10px] font-semibold tabular" style={{ background: `color-mix(in oklab, var(--secondary) ${Math.round(v * 100)}%, var(--surface))` }}>{v.toFixed(2)}</div>)])}
          </div>
        </Panel>
      </div>}

      {(r.risk || r.correlation) && <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {(["gold", "oil"] as const).flatMap((k) => { const m = r.risk?.[k]; if (!m) return []; const n = k === "gold" ? "Gold" : "Crude";
          return [<Metric key={k + "dd"} label={`${n} max drawdown`} value={pct(m.max_drawdown)} tone="text-bear" />, <Metric key={k + "v"} label={`${n} VaR`} value={pct(m.var)} tone="text-bear" />, <Metric key={k + "c"} label={`${n} CVaR`} value={pct(m.cvar)} tone="text-bear" />, <Metric key={k + "a"} label={`${n} annual volatility`} value={pct(m.annual_vol)} />]; })}
        {r.correlation && <Metric label="Gold–oil correlation" value={r.correlation.pearson.toFixed(2)} />}
      </div>}

      {(r.evaluation || r.methodology) && <div className="grid gap-6 lg:grid-cols-2">
        {r.evaluation && <Panel title="Model evaluation"><div className="divide-y text-sm">{Object.entries(r.evaluation).map(([k, v]) => <div key={k} className="flex py-2"><span>{k.replace(/_/g, " ")}</span><span className="ml-auto tabular font-semibold">{v.toFixed(3)}</span></div>)}</div></Panel>}
        {r.methodology && <Panel title="Methodology"><ul className="list-disc pl-5 text-sm space-y-1">{r.methodology.map((m) => <li key={m}>{m}</li>)}</ul></Panel>}
      </div>}
    </div>
  );
}

export function DataSourcesPage() {
  const { summary, health, connection, dataError, reloadStatus, refreshData, refreshing, refreshMessage } = useAppState();
  const Icon = connection === "online" ? CircleCheck : connection === "checking" ? CircleDashed : CircleX;
  const statusMeta = {
    checking: { label: "Checking…", tone: "text-muted-foreground", dot: "bg-muted-foreground animate-pulse", ring: "bg-muted-foreground/10" },
    online: { label: "Online", tone: "text-bull", dot: "bg-bull", ring: "bg-bull/10" },
    degraded: { label: "Degraded", tone: "text-gold", dot: "bg-gold", ring: "bg-gold/10" },
    offline: { label: "Offline", tone: "text-bear", dot: "bg-bear", ring: "bg-bear/10" },
  }[connection];

  // Coverage timeline span for the horizontal range bars
  const span = (() => {
    if (!summary?.coverage.length) return null;
    const starts = summary.coverage.map((c) => +new Date(c.start));
    const ends = summary.coverage.map((c) => +new Date(c.end));
    const min = Math.min(...starts), max = Math.max(...ends);
    return max > min ? { min, max } : null;
  })();

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto">
      {/* Header */}
      <div className="rise flex flex-wrap items-end gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-secondary">Infrastructure</p>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-primary mt-1">Data Sources & Coverage</h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">Market data is retrieved automatically by the analysis server — nothing needs to be uploaded.</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={reloadStatus} className="clay px-4 py-2.5 text-xs font-semibold inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />Check connection</button>
          <button onClick={refreshData} disabled={refreshing} className="clay-primary px-4 py-2.5 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"><RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />Refresh data</button>
        </div>
      </div>

      {/* Status hero */}
      <section className="glass p-5 md:p-6 rise" style={{ animationDelay: "60ms" }}>
        <div className="flex flex-wrap items-center gap-5">
          <div className={cn("h-14 w-14 rounded-2xl grid place-items-center shrink-0", statusMeta.ring)}>
            <span className={cn("h-3.5 w-3.5 rounded-full", statusMeta.dot)} />
          </div>
          <div className="min-w-0">
            <div className={cn("text-lg font-extrabold tracking-tight", statusMeta.tone)}>{statusMeta.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {health ? <>Server {health.status}{health.provider_status ? ` · provider ${health.provider_status}` : ""}{health.version ? ` · v${health.version}` : ""}</> : "Awaiting server response"}
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Endpoint</div>
            <code className="text-xs font-medium tabular">{API_BASE_URL}</code>
          </div>
        </div>
        {dataError && (
          <div className="mt-4 rounded-2xl bg-bear/10 border border-bear/30 p-3.5 text-sm flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-bear shrink-0 mt-0.5" />
            <span>{dataError} The other pages are currently showing <b>illustrative demonstration data</b>, not real market prices.</span>
          </div>
        )}
        {refreshMessage && <div className="mt-4 rounded-2xl bg-surface p-3.5 text-sm">{refreshMessage}</div>}
      </section>

      {/* Key facts */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Metric label="Dataset source" value={summary ? SOURCE_LABEL[summary.source] : "Illustrative demo"} />
        <Metric label="Provider" value={summary?.provider ?? health?.provider ?? "—"} />
        <Metric label="Latest observation" value={summary?.latest_observation ?? "—"} />
        <Metric label="Last successful refresh" value={summary?.last_refresh ?? "—"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Coverage with timeline bars */}
        <Panel title="Historical coverage" subtitle="Date range and observation count per commodity">
          {summary?.coverage.length ? (
            <div className="space-y-5">
              {summary.coverage.map((c) => {
                const pct = span ? ((+new Date(c.start) - span.min) / (span.max - span.min)) * 100 : 0;
                const width = span ? ((+new Date(c.end) - +new Date(c.start)) / (span.max - span.min)) * 100 : 100;
                const color = c.commodity === "gold" ? "var(--gold)" : "var(--oil)";
                return (
                  <div key={c.commodity}>
                    <div className="flex items-baseline gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
                      <span className="font-semibold text-sm">{c.commodity === "gold" ? "Gold" : "Crude Oil"}</span>
                      <span className="ml-auto text-xs text-muted-foreground tabular">{c.observations.toLocaleString()} obs{c.intervals ? ` · ${c.intervals.join(", ")}` : ""}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-surface relative overflow-hidden">
                      <div className="absolute h-full rounded-full" style={{ left: `${pct}%`, width: `${Math.max(width, 2)}%`, background: color }} />
                    </div>
                    <div className="mt-1.5 flex text-[11px] text-muted-foreground tabular"><span>{c.start}</span><span className="ml-auto">{c.end}</span></div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid place-items-center py-10 text-center">
              <Database className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground max-w-xs">No coverage information yet — it will appear once the analysis server responds.</p>
            </div>
          )}
        </Panel>

        {/* Quality with meter bars */}
        <Panel title="Dataset quality" subtitle="Automated checks run by the server on each refresh">
          {summary?.quality ? (
            <div className="space-y-5">
              {(["duplicates", "gaps", "outliers"] as const).map((k) => {
                const v = summary.quality![k];
                const clean = v === 0;
                return (
                  <div key={k}>
                    <div className="flex items-baseline text-sm">
                      <span className="capitalize font-medium">{k}</span>
                      <span className={cn("ml-auto tabular font-bold", clean ? "text-bull" : "text-gold")}>{v}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-surface overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", clean ? "bg-bull" : "bg-gold")} style={{ width: clean ? "100%" : "35%" }} />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{clean ? "None detected" : `${v} flagged for review`}</p>
                  </div>
                );
              })}
              {summary.quality.notes?.length ? (
                <div className="rounded-2xl bg-surface p-3.5 space-y-1.5">
                  {summary.quality.notes.map((n) => <p key={n} className="text-xs text-muted-foreground">{n}</p>)}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid place-items-center py-10 text-center">
              <CircleDashed className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground max-w-xs">Quality checks will be reported by the server.</p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
