import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, Area, AreaChart, Cell, ReferenceLine } from "recharts";
import { GitFork, Loader2, Play } from "lucide-react";
import { useAppState } from "@/lib/app-state";
import { sliceRange, regimeCounts, REGIMES, stats, fmtPct, fmtUsd, riskLabel, seriesOutToPoints } from "@/lib/market-data";
import { Panel, PriceChart, SampleBadge, RealDataBadge, DendrogramChart } from "./widgets";
import { cn } from "@/lib/utils";

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };
const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 } };
const Wrap = ({ children }: { children: React.ReactNode }) => <div className="space-y-6 max-w-[1500px] mx-auto">{children}</div>;
function Intro({ title, text, badge }: { title: string; text: string; badge?: React.ReactNode }) {
  return <div className="rise">{badge ?? <SampleBadge />}<h1 className="mt-3 text-2xl md:text-3xl font-display font-semibold tracking-tight text-primary">{title}</h1><p className="text-muted-foreground mt-1 max-w-2xl">{text}</p></div>;
}
function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <div className="glass glass-lift p-4"><div className="text-xs text-muted-foreground">{label}</div><div className={cn("text-xl font-extrabold tabular mt-1", tone)}>{value}</div></div>;
}

// Palette for cluster/HMM state coloring (matches analysis.tsx)
const PALETTE = ["var(--secondary)", "var(--gold)", "var(--bull)", "var(--bear)", "var(--oil)", "var(--primary)", "var(--muted-foreground)"];

export function ExplorerPage() {
  const { range, commodity, analysis } = useAppState();
  const synData = sliceRange(range);
  const series = commodity === "Gold" ? ["gold" as const] : commodity === "Crude Oil" ? ["oil" as const] : ["gold" as const, "oil" as const];

  // Real series from last analysis run
  const realSeries = analysis.result?.series;
  const isReal = realSeries && realSeries.length > 1;
  const chartData = isReal ? seriesOutToPoints(realSeries) : synData;

  // Stats — prefer real returns from analysis series; fall back to synthetic
  let goldMean = 0, goldSd = 0, oilMean = 0, oilSd = 0;
  if (isReal) {
    const gr = realSeries.map((s) => s.gold_return).filter((v): v is number => v != null);
    const or = realSeries.map((s) => s.oil_return).filter((v): v is number => v != null);
    const gStats = stats(gr); const oStats = stats(or);
    goldMean = gStats.mean; goldSd = gStats.sd; oilMean = oStats.mean; oilSd = oStats.sd;
  } else {
    const g = stats(synData.map((p) => p.goldChg)); const o = stats(synData.map((p) => p.oilChg));
    goldMean = g.mean; goldSd = g.sd; oilMean = o.mean; oilSd = o.sd;
  }

  const label = isReal ? "monthly" : "daily";
  const badge = isReal ? <RealDataBadge label="World Bank Pink Sheet · run analysis to refresh" /> : <SampleBadge />;

  return (
    <Wrap>
      <Intro title="Market Explorer" text={`Inspect price history and the statistical shape of ${label} returns.`} badge={badge} />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat label={`Gold avg ${label} return`} value={fmtPct(goldMean)} tone={goldMean >= 0 ? "text-bull" : "text-bear"} />
        <Stat label={`Gold ${label} volatility`} value={goldSd.toFixed(2) + "%"} />
        <Stat label={`Crude avg ${label} return`} value={fmtPct(oilMean)} tone={oilMean >= 0 ? "text-bull" : "text-bear"} />
        <Stat label={`Crude ${label} volatility`} value={oilSd.toFixed(2) + "%"} />
      </div>
      <Panel title="Price history" subtitle={isReal ? `Monthly World Bank observations · ${chartData.length} months` : `${range} window (demo)`}><PriceChart data={chartData} height={380} defaultSeries={series} /></Panel>
      <Panel title={isReal ? "Recent monthly observations" : "Recent sessions"}>
        <div className="overflow-x-auto"><table className="w-full text-sm tabular">
          <thead className="text-xs text-muted-foreground text-left"><tr><th className="py-2">Date</th><th>Gold</th><th>Δ</th><th>Crude</th><th>Δ</th>{!isReal && <th>Regime</th>}</tr></thead>
          <tbody>{chartData.slice(-10).reverse().map((p) => (
            <tr key={p.date} className="border-t"><td className="py-2">{p.date}</td><td>{p.gold ? fmtUsd(p.gold) : "—"}</td><td className={p.goldChg >= 0 ? "text-bull" : "text-bear"}>{fmtPct(p.goldChg)}</td><td>{p.oil ? fmtUsd(p.oil) : "—"}</td><td className={p.oilChg >= 0 ? "text-bull" : "text-bear"}>{fmtPct(p.oilChg)}</td>{!isReal && <td>{p.regime}</td>}</tr>
          ))}</tbody>
        </table></div>
      </Panel>
    </Wrap>
  );
}

export function PatternsPage() {
  const { range, analysis, config, setConfig, runAnalysis } = useAppState();
  const synData = sliceRange(range);

  // Real clustering points from analysis
  const clusterResult = analysis.result?.clustering;
  const isReal = !!clusterResult && clusterResult.points.length > 0;
  const currentAlgorithm = clusterResult?.algorithm ?? config.algorithm;
  const isHierarchical = currentAlgorithm === "hierarchical";
  const dendro = clusterResult?.dendrogram;
  const isRunning = analysis.status === "running";

  const handleSelectAlgorithm = async (algo: "kmeans" | "gmm" | "hierarchical") => {
    const nextCfg = { ...config, algorithm: algo };
    setConfig(nextCfg);
    await runAnalysis(nextCfg);
  };

  // Real: pc1 vs pc2 colored by cluster
  const realPts = isReal ? clusterResult!.points.map((p) => ({ x: +p.pc1.toFixed(3), y: +p.pc2.toFixed(3), cluster: p.cluster })) : null;
  const realClusters = isReal ? clusterResult!.clusters : null;

  // Synthetic: gold return vs oil return colored by regime
  const synPts = synData.map((p) => ({ x: +p.goldChg.toFixed(2), y: +p.oilChg.toFixed(2), regime: p.regime }));

  const badge = isReal ? <RealDataBadge label={`Real clustering · ${currentAlgorithm} · run analysis to refresh`} /> : <SampleBadge />;

  return (
    <Wrap>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Intro
          title="Pattern Discovery"
          badge={badge}
          text="Discover structural market groupings across gold and crude oil using K-Means, Gaussian Mixture, and Hierarchical clustering with Ward's linkage."
        />
        <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl glass border border-border">
          {(["kmeans", "gmm", "hierarchical"] as const).map((algo) => (
            <button
              key={algo}
              onClick={() => handleSelectAlgorithm(algo)}
              disabled={isRunning}
              className={cn(
                "px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all",
                currentAlgorithm === algo
                  ? "clay-primary shadow-sm"
                  : "hover:bg-surface text-muted-foreground hover:text-foreground",
                isRunning && "opacity-60 cursor-not-allowed"
              )}
            >
              {algo === "kmeans" ? "K-Means" : algo === "gmm" ? "Gaussian Mixture" : "Hierarchical (Dendrogram)"}
            </button>
          ))}
        </div>
      </div>

      {isRunning && (
        <div className="rounded-2xl bg-surface/70 border border-secondary/20 p-4 flex items-center gap-3 text-xs text-secondary animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin text-secondary" />
          <span>Computing <strong>{config.algorithm}</strong> clustering and updating visualizations…</span>
        </div>
      )}

      {/* When choosing hierarchical clustering: show the Dendrogram diagram */}
      {isHierarchical && (
        dendro ? (
          <Panel
            title="Hierarchical Cluster Tree (Dendrogram)"
            subtitle="Agglomerative tree diagram using Ward's minimum variance criterion. The horizontal dashed line marks the cut distance splitting observations into clusters."
          >
            <DendrogramChart data={dendro} height={420} />
          </Panel>
        ) : (
          <Panel
            title="Hierarchical Cluster Tree (Dendrogram)"
            subtitle="Agglomerative hierarchical clustering"
          >
            <div className="py-12 text-center space-y-3">
              <GitFork className="h-10 w-10 text-secondary mx-auto opacity-80" />
              <div className="font-semibold text-foreground text-base">Hierarchical Tree Ready to Generate</div>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Generate the hierarchical agglomerative linkage matrix and cluster cut threshold across historical commodity returns.
              </p>
              <button
                onClick={() => handleSelectAlgorithm("hierarchical")}
                disabled={isRunning}
                className="clay-primary px-6 py-2.5 text-xs font-bold inline-flex items-center gap-2"
              >
                {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Generate Dendrogram Diagram
              </button>
            </div>
          </Panel>
        )
      )}

      <Panel
        title="Return clusters"
        subtitle={isReal ? `PC1 × PC2 projection · ${currentAlgorithm} · ${clusterResult!.points.length} observations` : "Each dot is one session, colored by discovered cluster"}
      >
        <ResponsiveContainer width="100%" height={400}>
          {isReal ? (
            <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" />
              <XAxis type="number" dataKey="x" name="PC1" tick={axis} />
              <YAxis type="number" dataKey="y" name="PC2" tick={axis} />
              <ZAxis range={[28, 28]} />
              <Tooltip {...tip} cursor={{ strokeDasharray: "3 3" }} />
              {realClusters!.map((c, i) => (
                <Scatter
                  key={c.id}
                  name={`Cluster ${c.id} (${c.size} obs)`}
                  data={realPts!.filter((p) => p.cluster === c.id)}
                  fill={PALETTE[i % PALETTE.length]}
                  fillOpacity={0.75}
                />
              ))}
            </ScatterChart>
          ) : (
            <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" />
              <XAxis type="number" dataKey="x" name="Gold %" tick={axis} unit="%" />
              <YAxis type="number" dataKey="y" name="Crude %" tick={axis} unit="%" />
              <ZAxis range={[28, 28]} />
              <Tooltip {...tip} cursor={{ strokeDasharray: "3 3" }} />
              {REGIMES.map((r) => (
                <Scatter
                  key={r.key}
                  name={r.key}
                  data={synPts.filter((p) => p.regime === r.key)}
                  fill={r.color}
                  fillOpacity={0.7}
                />
              ))}
            </ScatterChart>
          )}
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-4 mt-2 text-xs">
          {isReal
            ? realClusters!.map((c, i) => (
              <span key={c.id} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                Cluster {c.id} · {c.size} obs
              </span>
            ))
            : REGIMES.map((r) => (
              <span key={r.key} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                {r.key}
              </span>
            ))}
        </div>
      </Panel>
    </Wrap>
  );
}

export function StatesPage() {
  const { range, analysis } = useAppState();
  const synData = sliceRange(range);
  const synCounts = regimeCounts(synData);
  const color = Object.fromEntries(REGIMES.map((r) => [r.key, r.color]));

  // Real HMM data from analysis
  const hmm = analysis.result?.hmm;
  const isReal = !!hmm && hmm.timeline.length > 0;

  // Real state counts from state_stats
  const realCounts = isReal ? hmm!.state_stats.map((s, i) => ({
    key: `State ${s.state}`,
    color: PALETTE[i % PALETTE.length]!,
    count: hmm!.timeline.filter((t) => t.state === s.state).length,
    desc: `Mean ret ${s.mean_return?.toFixed(2) ?? "—"}% · vol ${s.volatility?.toFixed(2) ?? "—"}%`,
  })) : null;

  const displayCounts = realCounts ?? synCounts;
  const stateColor = isReal
    ? Object.fromEntries(realCounts!.map((c) => [c.key, c.color]))
    : color;

  const badge = isReal ? <RealDataBadge label={`HMM · ${hmm!.n_states} states · run analysis to refresh`} /> : <SampleBadge />;

  return (
    <Wrap>
      <Intro title="Hidden Market States" badge={badge} text={isReal
        ? `Gaussian HMM with ${hmm!.n_states} hidden states inferred from real monthly Gold & Crude Oil returns.`
        : "A state model infers the unobserved regime behind each session and tracks transitions."} />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">{displayCounts.map((c) => (
        <div key={c.key} className="glass glass-lift p-4"><div className="flex items-center gap-2 text-xs font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />{c.key}</div><div className="text-2xl font-extrabold tabular mt-2">{c.count}</div><div className="text-[11px] text-muted-foreground">{c.desc}</div></div>
      ))}</div>
      <Panel title={isReal ? "HMM state timeline" : "State timeline"} subtitle={isReal ? `Inferred HMM state per monthly observation · ${hmm!.timeline.length} months` : "Inferred regime per session"}>
        {isReal ? (
          <div className="flex h-14 rounded-xl overflow-hidden">
            {hmm!.timeline.map((p) => <div key={p.date} title={`${p.date}: State ${p.state} (prob=${p.prob.toFixed(2)})`} className="flex-1 hover:opacity-70 transition-opacity" style={{ background: PALETTE[p.state % PALETTE.length], opacity: 0.4 + 0.6 * p.prob }} />)}
          </div>
        ) : (
          <div className="flex h-14 rounded-xl overflow-hidden">
            {synData.map((p) => <div key={p.date} title={`${p.date}: ${p.regime}`} className="flex-1 hover:opacity-70 transition-opacity" style={{ background: stateColor[p.regime] }} />)}
          </div>
        )}
        <div className="flex justify-between text-[11px] text-muted-foreground mt-2">
          <span>{isReal ? hmm!.timeline[0]?.date : synData[0]?.date}</span>
          <span>{isReal ? hmm!.timeline[hmm!.timeline.length - 1]?.date : synData[synData.length - 1]?.date}</span>
        </div>
        {isReal && hmm!.transition_matrix && (
          <div className="mt-4">
            <div className="text-xs font-semibold text-muted-foreground mb-2">Transition matrix (row = from state, col = to state)</div>
            <div className="grid gap-1 text-[11px]" style={{ gridTemplateColumns: `auto repeat(${hmm!.n_states}, 1fr)` }}>
              <div />
              {hmm!.transition_matrix.map((_, j) => <div key={j} className="text-center text-muted-foreground">S{j}</div>)}
              {hmm!.transition_matrix.map((row, i) => [
                <div key={`l${i}`} className="text-muted-foreground pr-1 self-center">S{i}</div>,
                ...row.map((v, j) => <div key={`${i}-${j}`} className="aspect-square rounded grid place-items-center font-semibold tabular" style={{ background: `color-mix(in oklab, var(--secondary) ${Math.round(v * 100)}%, var(--surface))` }}>{v.toFixed(2)}</div>),
              ])}
            </div>
          </div>
        )}
      </Panel>
    </Wrap>
  );
}

export function RiskPage() {
  const { range, analysis } = useAppState();
  const data = sliceRange(range);
  const last = data[data.length - 1]!;
  const g = stats(data.map((p) => p.goldChg)), o = stats(data.map((p) => p.oilChg));
  const bins = Array.from({ length: 16 }, (_, i) => ({ b: -8 + i, n: 0 }));
  data.forEach((p) => { const i = Math.min(15, Math.max(0, Math.floor(p.oilChg) + 8)); bins[i]!.n++; });

  // Real risk metrics from backend analysis run when available
  const realGoldRisk = analysis.result?.risk?.gold;
  const realOilRisk = analysis.result?.risk?.oil;
  const rf = realGoldRisk?.risk_free_rate ?? 2.5;
  const isReal = !!realGoldRisk;
  const badge = isReal ? <RealDataBadge label="World Bank Pink Sheet historical data · real risk calculations" /> : <SampleBadge />;

  return (
    <Wrap>
      <Intro title="Risk Analysis" badge={badge} text={`Rolling volatility, value-at-risk, maximum drawdown, and Sharpe ratio (assuming ${rf}% annual risk-free rate).`} />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat label="Current risk score" value={`${last.risk} · ${riskLabel(last.risk)}`} tone={last.risk >= 66 ? "text-bear" : "text-primary"} />
        <Stat label="Gold 95% VaR" value={realGoldRisk?.var_95 ? `${realGoldRisk.var_95}%` : (g.var95.toFixed(2) + "%")} tone="text-bear" />
        <Stat label="Crude 95% VaR" value={realOilRisk?.var_95 ? `${realOilRisk.var_95}%` : (o.var95.toFixed(2) + "%")} tone="text-bear" />
        <Stat label="Worst crude session" value={realOilRisk?.max_drawdown ? `${realOilRisk.max_drawdown}%` : (o.min.toFixed(2) + "%")} tone="text-bear" />
      </div>
      {realGoldRisk && (
        <div className="rounded-2xl bg-surface p-4 text-xs text-muted-foreground flex flex-wrap gap-6 items-center">
          <span>Assumed Risk-Free Rate: <strong className="text-primary">{rf}%</strong> annualized</span>
          <span>Gold Sharpe: <strong className="text-primary">{realGoldRisk.sharpe ?? "—"}</strong></span>
          <span>Crude Oil Sharpe: <strong className="text-primary">{realOilRisk?.sharpe ?? "—"}</strong></span>
          <span>Gold Max Drawdown: <strong className="text-bear">{realGoldRisk.max_drawdown}%</strong></span>
          <span>Crude Max Drawdown: <strong className="text-bear">{realOilRisk?.max_drawdown}%</strong></span>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Risk score over time" subtitle="0–100 composite of rolling volatility">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <defs><linearGradient id="rk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--bear)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--bear)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="date" tick={axis} minTickGap={50} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={axis} tickLine={false} axisLine={false} width={30} />
              <ReferenceLine y={66} stroke="var(--bear)" strokeDasharray="4 4" />
              <Tooltip {...tip} />
              <Area dataKey="risk" stroke="var(--bear)" fill="url(#rk)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Crude monthly return distribution" subtitle="Months per 1% bucket (demo data)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={bins}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="b" tick={axis} unit="%" tickLine={false} axisLine={false} />
              <YAxis tick={axis} tickLine={false} axisLine={false} width={30} />
              <Tooltip {...tip} />
              <Bar dataKey="n" radius={[6, 6, 0, 0]}>{bins.map((b) => <Cell key={b.b} fill={b.b < 0 ? "var(--bear)" : "var(--bull)"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </Wrap>
  );
}

export function InsightsPage() {
  const { analysis } = useAppState();
  const evaluation = analysis.result?.evaluation;
  const hmmStats = analysis.result?.hmm;
  const features = [["20-day volatility", 0.34], ["20-day momentum", 0.27], ["Gold–oil correlation", 0.16], ["Daily range", 0.13], ["Volume proxy", 0.1]] as const;

  const kVal = analysis.result?.clustering?.clusters.length ?? 4;
  const silVal = evaluation?.silhouette ? evaluation.silhouette.toFixed(2) : "0.61";
  const hStates = hmmStats?.n_states ?? 3;
  const logLike = hmmStats?.log_likelihood ? `${Math.round(hmmStats.log_likelihood)}` : "−1,842";
  const isReal = !!(evaluation || hmmStats);
  const badge = isReal ? <RealDataBadge label="Real ML model results · run analysis to refresh" /> : <SampleBadge />;

  return (
    <Wrap>
      <Intro title="Model Insights" badge={badge} text="How the clustering, PCA, and Hidden Markov state models evaluate real commodity behavior." />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat label="Clusters (k)" value={String(kVal)} />
        <Stat label="Silhouette score" value={String(silVal)} />
        <Stat label="Hidden states" value={String(hStates)} />
        <Stat label="Log-likelihood" value={String(logLike)} />
      </div>
      <Panel title="Feature importance">
        <div className="space-y-4">{features.map(([f, v]) => (
          <div key={f}><div className="flex text-sm mb-1"><span className="font-medium">{f}</span><span className="ml-auto tabular text-muted-foreground">{(v * 100).toFixed(0)}%</span></div>
            <div className="h-2 rounded-full bg-surface"><div className="h-full rounded-full bg-gradient-to-r from-secondary to-primary" style={{ width: `${v * 250}%` }} /></div></div>
        ))}</div>
      </Panel>
    </Wrap>
  );
}

export function SettingsPage() {
  const [opts, setOpts] = useState({ alerts: true, animations: true, indexed: true });
  return (
    <Wrap>
      <Intro title="Settings" text="Personalize your analysis workspace." />
      <Panel title="Preferences">
        {(Object.keys(opts) as (keyof typeof opts)[]).map((k) => (
          <div key={k} className="flex items-center py-3 border-t first:border-0">
            <div className="text-sm font-medium">{{ alerts: "Regime-shift notifications", animations: "Chart animations", indexed: "Default to indexed comparison" }[k]}</div>
            <button onClick={() => setOpts({ ...opts, [k]: !opts[k] })} className={cn("ml-auto h-6 w-11 rounded-full p-0.5 transition-colors", opts[k] ? "bg-secondary" : "bg-muted")}>
              <span className={cn("block h-5 w-5 rounded-full bg-background shadow transition-transform", opts[k] && "translate-x-5")} />
            </button>
          </div>
        ))}
      </Panel>
    </Wrap>
  );
}
