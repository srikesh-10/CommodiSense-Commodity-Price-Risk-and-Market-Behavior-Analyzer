import { createFileRoute, Link } from "@tanstack/react-router";
import { Coins, Droplet, TrendingUp, TrendingDown, Layers, ShieldAlert, ArrowRight } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useAppState } from "@/lib/app-state";
import { SERIES, LAST_UPDATED, sliceRange, regimeCounts, riskLabel, fmtUsd, fmtPct, seriesOutToPoints } from "@/lib/market-data";
import { KpiCard, Panel, PriceChart, SampleBadge, RealDataBadge } from "@/components/widgets";
import { Segmented, RANGES, COMMODITIES } from "@/components/app-shell";
import { ConfigurePanel, AnalysisResults } from "@/components/analysis";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Overview — CommodiSense" },
      { name: "description", content: "Executive overview of gold and crude oil prices, market regimes and risk." },
      { property: "og:title", content: "Overview — CommodiSense" },
      { property: "og:description", content: "Executive overview of gold and crude oil prices, market regimes and risk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

// Palette shared with analysis.tsx for HMM state coloring
const PALETTE = ["var(--secondary)", "var(--gold)", "var(--bull)", "var(--bear)", "var(--oil)"];

function Overview() {
  const { range, setRange, commodity, setCommodity, summary, analysis } = useAppState();

  // --- Real data sources ---
  const analysisResult = analysis.result;
  const hmm = analysisResult?.hmm;
  const realSeries = analysisResult?.series;

  // Build chart data: prefer real series from analysis, fall back to synthetic
  const syntheticData = sliceRange(range);
  const chartData = realSeries && realSeries.length > 1
    ? seriesOutToPoints(realSeries)
    : syntheticData;
  const isRealChart = realSeries && realSeries.length > 1;

  // KPI: prefer real data from summary/analysis, fall back to synthetic
  const synLast = SERIES[SERIES.length - 1]!;
  const synSpark = SERIES.slice(-30);

  // Real latest prices from analysis series (last non-null entry)
  const realLastGold = realSeries ? [...realSeries].reverse().find((s) => s.gold != null)?.gold : undefined;
  const realLastOil = realSeries ? [...realSeries].reverse().find((s) => s.oil != null)?.oil : undefined;
  const realLastGoldChg = realSeries ? [...realSeries].reverse().find((s) => s.gold_return != null)?.gold_return : undefined;
  const realLastOilChg = realSeries ? [...realSeries].reverse().find((s) => s.oil_return != null)?.oil_return : undefined;
  const goldPrice = realLastGold ?? synLast.gold;
  const oilPrice = realLastOil ?? synLast.oil;
  const goldChg = realLastGoldChg ?? synLast.goldChg;
  const oilChg = realLastOilChg ?? synLast.oilChg;

  const goldSpark = isRealChart ? chartData.map((p) => p.gold).filter(Boolean) as number[] : synSpark.map((p) => p.gold);
  const oilSpark = isRealChart ? chartData.map((p) => p.oil).filter(Boolean) as number[] : synSpark.map((p) => p.oil);

  // Regime pie: prefer HMM state stats from analysis, fall back to synthetic regime counts
  const synCounts = regimeCounts(syntheticData);
  const synTotal = synCounts.reduce((a, b) => a + b.count, 0);

  // Build counts from HMM state_stats
  const hmmCounts = hmm?.state_stats.map((s, i) => ({
    key: `State ${s.state}`,
    color: PALETTE[i % PALETTE.length]!,
    count: Math.round(s.share * (hmm.timeline?.length ?? 100)),
    desc: `Mean return ${s.mean_return?.toFixed(2) ?? "—"}%`,
  })) ?? null;
  const realCounts = hmmCounts && hmmCounts.length > 0 ? hmmCounts : null;
  const pieCounts = realCounts ?? synCounts;
  const pieTotal = pieCounts.reduce((a, b) => a + b.count, 0);
  const isRealPie = !!realCounts;

  const lastUpdated = summary?.latest_observation ?? LAST_UPDATED;
  const isRealData = !!analysisResult;

  const series = commodity === "Gold" ? ["gold" as const] : commodity === "Crude Oil" ? ["oil" as const] : ["gold" as const, "oil" as const];

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto">
      <section className="glass relative overflow-hidden p-6 md:p-8 rise">
        <div className="orb w-72 h-72 bg-gold-soft/50 -right-10 -top-24" />
        <div className="orb w-64 h-64 bg-secondary/20 right-60 top-10" style={{ animationDelay: "-4s" }} />
        <div className="relative max-w-2xl">
          <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
            {isRealData ? <RealDataBadge /> : <SampleBadge />}
            Last observation {lastUpdated}
          </div>
          <h1 className="mt-4 text-3xl md:text-5xl font-display font-semibold tracking-tight text-primary leading-[1.05]">Understand the rhythm of commodity markets.</h1>
          <p className="mt-3 text-muted-foreground md:text-lg">Discover market regimes, recurring price behavior, and evolving risk across gold and crude oil.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Segmented value={range} options={RANGES} onChange={setRange} />
            <Segmented value={commodity} options={COMMODITIES} onChange={setCommodity} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/patterns" className="clay-primary px-5 py-3 text-sm font-semibold inline-flex items-center gap-2">Explore Market Patterns <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/risk" className="clay px-5 py-3 text-sm font-semibold text-primary inline-flex items-center gap-2"><ShieldAlert className="h-4 w-4" />Run Risk Analysis</Link>
          </div>
        </div>
      </section>

      <ConfigurePanel />
      <AnalysisResults />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard label="Gold Latest Price" value={goldPrice} format={fmtUsd} desc={isRealData ? "USD/troy oz · World Bank" : "USD per troy ounce"} icon={<Coins className="h-4 w-4" />} spark={goldSpark} color="var(--gold)" status={isRealData ? { text: "Real", tone: "bull" } : { text: "Sample", tone: "gold" }} />
        <KpiCard label="Crude Oil Latest Price" value={oilPrice} format={fmtUsd} desc={isRealData ? "USD/bbl · World Bank" : "USD per barrel"} icon={<Droplet className="h-4 w-4" />} spark={oilSpark} color="var(--oil)" status={isRealData ? { text: "Real", tone: "bull" } : { text: "Sample", tone: "gold" }} delay={60} />
        <KpiCard label="Gold Monthly Change" value={goldChg} format={fmtPct} desc={isRealData ? "vs previous month" : "vs previous session"} icon={goldChg >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />} spark={chartData.map((p) => p.goldChg)} color={goldChg >= 0 ? "var(--bull)" : "var(--bear)"} status={{ text: goldChg >= 0 ? "Up" : "Down", tone: goldChg >= 0 ? "bull" : "bear" }} delay={120} />
        <KpiCard label="Crude Monthly Change" value={oilChg} format={fmtPct} desc={isRealData ? "vs previous month" : "vs previous session"} icon={oilChg >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />} spark={chartData.map((p) => p.oilChg)} color={oilChg >= 0 ? "var(--bull)" : "var(--bear)"} status={{ text: oilChg >= 0 ? "Up" : "Down", tone: oilChg >= 0 ? "bull" : "bear" }} delay={180} />
        <KpiCard label={isRealData ? "HMM States Detected" : "Current Regime"} value={isRealData ? (hmm?.n_states ?? "—") : synLast.regime} desc={isRealData ? "Hidden Markov Model states" : "20-day behavior classification"} icon={<Layers className="h-4 w-4" />} spark={chartData.map((p) => p.risk)} color="var(--secondary)" status={{ text: isRealData ? "Real" : "Model", tone: isRealData ? "bull" : "neutral" }} delay={240} />
        <KpiCard label="Gold Annual Volatility" value={isRealData ? (analysisResult?.risk?.gold?.annual_vol ?? synLast.risk) : synLast.risk} format={isRealData && analysisResult?.risk?.gold?.annual_vol ? (v) => `${v.toFixed(1)}%` : (v) => `${Math.round(v)} / 100`} desc={isRealData ? `${analysisResult?.risk?.gold?.annual_vol?.toFixed(1) ?? "—"}% annualised · real` : `${riskLabel(synLast.risk)} risk conditions`} icon={<ShieldAlert className="h-4 w-4" />} spark={chartData.map((p) => p.risk)} color="var(--bear)" status={isRealData ? { text: "Real", tone: "bull" } : { text: riskLabel(synLast.risk), tone: synLast.risk >= 66 ? "bear" : synLast.risk >= 40 ? "gold" : "bull" }} delay={300} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Gold & Crude Oil Prices" subtitle={isRealChart ? `Monthly World Bank data · ${chartData.length} observations` : `Range: ${range} · ${chartData.length} sessions (demo)`} className="xl:col-span-2">
          <PriceChart data={chartData} defaultSeries={series} />
        </Panel>
        <Panel title="Market Behavior Overview" subtitle={isRealPie ? "HMM-inferred state distribution · run analysis to update" : "Share of sessions per detected regime (demo)"}>
          <div className="relative h-52">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieCounts} dataKey="count" nameKey="key" innerRadius={62} outerRadius={88} paddingAngle={3} stroke="none">
                  {pieCounts.map((c) => <Cell key={c.key} fill={c.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center pointer-events-none text-center">
              <div><div className="text-2xl font-extrabold tabular">{pieTotal}</div><div className="text-[11px] text-muted-foreground">{isRealPie ? "months" : "sessions"}</div></div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {pieCounts.map((c) => (
              <div key={c.key}>
                <div className="flex text-xs mb-1"><span className="font-semibold flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.key}</span><span className="ml-auto tabular text-muted-foreground">{c.count} · {((c.count / pieTotal) * 100).toFixed(0)}%</span></div>
                <div className="h-1.5 rounded-full bg-surface overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${(c.count / pieTotal) * 100}%`, background: c.color }} /></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
