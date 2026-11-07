import { useEffect, useId, useState, type ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { cn } from "@/lib/utils";
import { indexed, type Point, fmtUsd, fmtPct } from "@/lib/market-data";
import type { DendrogramData } from "@/lib/api";
import { Segmented } from "./app-shell";

export function Panel({ title, subtitle, action, children, className }: { title?: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("glass p-5 rise", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-start gap-3 mb-4">
          <div><h2 className="font-bold tracking-tight">{title}</h2>{subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}</div>
          <div className="ml-auto">{action}</div>
        </div>
      )}
      {children}
    </section>
  );
}

export function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(target * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function Sparkline({ data, color }: { data: number[]; color: string }) {
  const d = data.map((v, i) => ({ i, v }));
  const id = "sp" + useId().replace(/:/g, "");
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={d} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area dataKey="v" stroke={color} strokeWidth={1.6} fill={`url(#${id})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function KpiCard({ label, value, format, desc, icon, spark, color, status, delay = 0 }: {
  label: string; value: number | string; format?: (v: number) => string; desc: string; icon: ReactNode; spark: number[]; color: string; status?: { text: string; tone: "bull" | "bear" | "neutral" | "gold" }; delay?: number;
}) {
  const n = useCountUp(typeof value === "number" ? value : 0);
  const tone = { bull: "text-bull bg-bull/10", bear: "text-bear bg-bear/10", neutral: "text-secondary bg-surface", gold: "text-primary bg-gold-soft/50" };
  return (
    <div className="glass glass-lift p-4 rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="h-7 w-7 rounded-lg bg-surface grid place-items-center text-secondary">{icon}</span>{label}
        {status && <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold", tone[status.tone])}>{status.text}</span>}
      </div>
      <div className="mt-3 text-2xl font-extrabold tracking-tight tabular">{typeof value === "number" ? (format ? format(n) : n.toFixed(2)) : value}</div>
      <div className="text-[11px] text-muted-foreground">{desc}</div>
      <div className="mt-2 -mx-1"><Sparkline data={spark} color={color} /></div>
    </div>
  );
}

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };

function PriceTooltip({ active, payload, label, mode }: any) {
  if (!active || !payload?.length) return null;
  const p: Point = payload[0].payload;
  return (
    <div className="glass !rounded-xl px-3 py-2 text-xs !bg-popover">
      <div className="font-semibold mb-1">{label}</div>
      {payload.map((s: any) => {
        const isGold = String(s.dataKey).startsWith("gold");
        return (
          <div key={s.dataKey} className="flex items-center gap-2 tabular">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {isGold ? "Gold" : "Crude"}: {mode === "Indexed" ? s.value.toFixed(1) : fmtUsd(s.value)}
            <span className={(isGold ? p.goldChg : p.oilChg) >= 0 ? "text-bull" : "text-bear"}>{fmtPct(isGold ? p.goldChg : p.oilChg)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function PriceChart({ data, height = 340, defaultSeries = ["gold", "oil"] }: { data: Point[]; height?: number; defaultSeries?: ("gold" | "oil")[] }) {
  const [mode, setMode] = useState<"Indexed" | "Raw">("Indexed");
  const [kind, setKind] = useState<"Line" | "Area">("Line");
  const [series, setSeries] = useState(new Set(defaultSeries));
  useEffect(() => setSeries(new Set(defaultSeries)), [defaultSeries.join()]);
  const rows = indexed(data);
  const toggle = (s: "gold" | "oil") => { const n = new Set(series); n.has(s) ? n.delete(s) : n.add(s); setSeries(n); };
  const both = series.has("gold") && series.has("oil");
  const k = (s: string) => (mode === "Indexed" ? `${s}Idx` : s);
  const Chart = kind === "Line" ? LineChart : AreaChart;
  const Series: any = kind === "Line" ? Line : Area;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {(["gold", "oil"] as const).map((s) => (
          <button key={s} onClick={() => toggle(s)} className={cn("flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all", series.has(s) ? "clay" : "bg-surface text-muted-foreground")}>
            <span className={cn("h-2.5 w-2.5 rounded-full", s === "gold" ? "bg-gold" : "bg-oil")} />{s === "gold" ? "Gold (USD/oz)" : "Crude Oil (USD/bbl)"}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <Segmented value={mode} options={["Indexed", "Raw"] as const} onChange={setMode} />
          <Segmented value={kind} options={["Line", "Area"] as const} onChange={setKind} />
        </div>
      </div>
      {mode === "Indexed" && <p className="text-[11px] text-muted-foreground mb-2">Both series rebased to 100 at the start of the selected range.</p>}
      {mode === "Raw" && both && <p className="text-[11px] text-muted-foreground mb-2">Raw mode uses separate axes — Gold left, Crude Oil right.</p>}
      {series.size === 0 ? (
        <div className="grid place-items-center text-sm text-muted-foreground" style={{ height }}>Select at least one series to display.</div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <Chart data={rows} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="g-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--gold)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--gold)" stopOpacity={0} /></linearGradient>
              <linearGradient id="g-oil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--oil)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--oil)" stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={false} minTickGap={50} />
            <YAxis yAxisId="l" tick={axis} tickLine={false} axisLine={false} domain={["auto", "auto"]} width={50} />
            {mode === "Raw" && both && <YAxis yAxisId="r" orientation="right" tick={axis} tickLine={false} axisLine={false} domain={["auto", "auto"]} width={40} />}
            <Tooltip content={<PriceTooltip mode={mode} />} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} />
            {series.has("gold") && <Series yAxisId="l" type="monotone" dataKey={k("gold")} stroke="var(--gold)" strokeWidth={2} dot={false} fill="url(#g-gold)" animationDuration={700} />}
            {series.has("oil") && <Series yAxisId={mode === "Raw" && both ? "r" : "l"} type="monotone" dataKey={k("oil")} stroke="var(--oil)" strokeWidth={2} dot={false} fill="url(#g-oil)" animationDuration={700} />}
          </Chart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function SampleBadge() {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft/50 px-2.5 py-1 text-[11px] font-semibold text-primary"><span className="h-1.5 w-1.5 rounded-full bg-gold" />Illustrative demonstration data — not live prices</span>;
}

export function RealDataBadge({ label = "World Bank Pink Sheet — verified historical monthly data" }: { label?: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-bull/10 px-2.5 py-1 text-[11px] font-semibold text-bull"><span className="h-1.5 w-1.5 rounded-full bg-bull" />{label}</span>;
}

const DENDRO_PALETTE: Record<string, string> = {
  C0: "var(--muted-foreground)",
  C1: "var(--bull)",
  C2: "var(--bear)",
  C3: "var(--gold)",
  C4: "var(--secondary)",
  C5: "var(--oil)",
  C6: "var(--primary)",
};

export function DendrogramChart({ data, height = 380 }: { data: DendrogramData; height?: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const { icoord, dcoord, color_list, ivl, cut_threshold, max_d, truncated, total_observations } = data;

  if (!icoord || icoord.length === 0) {
    return <div className="grid place-items-center text-sm text-muted-foreground" style={{ height }}>No hierarchical dendrogram data available.</div>;
  }

  const padding = { top: 35, right: 35, bottom: 85, left: 65 };
  const width = 900;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const allX = icoord.flat();
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const maxY = Math.max(max_d * 1.08, cut_threshold * 1.15, 0.1);

  const scaleX = (x: number) => padding.left + ((x - minX) / (maxX - minX || 1)) * plotWidth;
  const scaleY = (y: number) => padding.top + plotHeight - (y / maxY) * plotHeight;
  const yCut = scaleY(cut_threshold);

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map((pct) => {
    const val = maxY * pct;
    return { val, y: scaleY(val) };
  });

  return (
    <div className="w-full relative select-none">
      <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground mb-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">Ward&apos;s Minimum Variance Linkage</span>
          <span>· {total_observations} observations</span>
          {truncated && <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-secondary">Top {ivl.length} branches</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-bear" />
          <span>Cut height <strong className="tabular font-mono text-bear">{cut_threshold.toFixed(2)}</strong></span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" style={{ minWidth: 600 }}>
          {/* Distance grid lines */}
          {yTicks.map(({ val, y }, idx) => (
            <g key={idx}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border)" strokeDasharray="3 4" strokeOpacity={0.5} />
              <text x={padding.left - 8} y={y + 3.5} textAnchor="end" fill="var(--muted-foreground)" fontSize={10} fontFamily="monospace">
                {val.toFixed(1)}
              </text>
            </g>
          ))}

          {/* Left Y Axis Title */}
          <text
            x={16}
            y={padding.top + plotHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90 16 ${padding.top + plotHeight / 2})`}
            fill="var(--muted-foreground)"
            fontSize={10}
            fontWeight={600}
            letterSpacing="0.05em"
          >
            DISTANCE
          </text>

          {/* Cluster Cut Threshold Line */}
          <line
            x1={padding.left}
            y1={yCut}
            x2={width - padding.right}
            y2={yCut}
            stroke="var(--bear)"
            strokeDasharray="4 4"
            strokeWidth={1.8}
            strokeOpacity={0.85}
          />
          <text
            x={width - padding.right}
            y={yCut - 6}
            textAnchor="end"
            fill="var(--bear)"
            fontSize={10.5}
            fontWeight={700}
          >
            Cluster Cut (d = {cut_threshold.toFixed(2)})
          </text>

          {/* Tree links */}
          {icoord.map((xs, i) => {
            const ys = dcoord[i];
            const rawCol = color_list[i] || "C0";
            const strokeColor = DENDRO_PALETTE[rawCol] || "var(--secondary)";
            const isHovered = hovered === i;
            const pathData = `M ${scaleX(xs[0])} ${scaleY(ys[0])} L ${scaleX(xs[1])} ${scaleY(ys[1])} L ${scaleX(xs[2])} ${scaleY(ys[2])} L ${scaleX(xs[3])} ${scaleY(ys[3])}`;

            return (
              <g key={i}>
                <path
                  d={pathData}
                  stroke="transparent"
                  strokeWidth={10}
                  fill="none"
                  className="cursor-pointer"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                />
                <path
                  d={pathData}
                  stroke={strokeColor}
                  strokeWidth={isHovered ? 3.0 : 1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  className="transition-all duration-150 pointer-events-none"
                  strokeOpacity={hovered !== null && !isHovered ? 0.35 : 0.9}
                />
              </g>
            );
          })}

          {/* Leaf node labels */}
          {ivl.map((label, idx) => {
            const x = scaleX(5.0 + 10.0 * idx);
            const y = padding.top + plotHeight + 10;
            return (
              <g key={idx} transform={`translate(${x}, ${y})`}>
                <circle cx={0} cy={-10} r={2} fill="var(--muted-foreground)" />
                <text
                  x={0}
                  y={0}
                  textAnchor="end"
                  transform="rotate(-55)"
                  fill="var(--muted-foreground)"
                  fontSize={ivl.length > 25 ? 9 : 10}
                  fontFamily="monospace"
                  className="hover:fill-foreground transition-colors cursor-default"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {hovered !== null && dcoord[hovered] && (
        <div className="mt-2 text-[11px] text-muted-foreground flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-surface/50 border border-border">
          <span>Branch #{hovered + 1} merge distance: <strong className="text-foreground">{dcoord[hovered][1].toFixed(3)}</strong></span>
          <span>Type: <strong style={{ color: DENDRO_PALETTE[color_list[hovered]] || "var(--foreground)" }}>{color_list[hovered] === "C0" ? "Inter-cluster trunk link" : `Intra-cluster branch (${color_list[hovered]})`}</strong></span>
        </div>
      )}
    </div>
  );
}

export { Legend };
