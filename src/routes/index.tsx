import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Gem, ArrowRight, ArrowDown, LineChart, Shapes, Layers, ShieldAlert,
  History, ScatterChart, BrainCircuit, Gauge, Menu, X, Moon, Sun,
  Coins, Droplet, Activity, TrendingDown,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SERIES, LAST_UPDATED, fmtUsd, fmtPct, riskLabel, regimeCounts, indexed, sliceRange, type RangeKey } from "@/lib/market-data";
import { Sparkline } from "@/components/widgets";
import { Segmented } from "@/components/app-shell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CommodiSense — Read the patterns. Understand the risk." },
      { name: "description", content: "Commodity market intelligence: explore historical gold and crude oil behavior, uncover latent market regimes, and measure changing risk with machine-learning analytics." },
      { property: "og:title", content: "CommodiSense — Commodity Market Intelligence" },
      { property: "og:description", content: "Explore historical commodity behavior, uncover latent market regimes, and measure changing risk with machine-learning-powered analytics." },
    ],
  }),
  component: Landing,
});

/* ---------- scroll reveal ---------- */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("reveal-in")),
      { threshold: 0.12 },
    );
    el.querySelectorAll(".reveal").forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, []);
  return ref;
}
function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <div className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

/* ---------- svg line helpers ---------- */
function toPath(values: number[], w: number, h: number, pad = 6) {
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  return values
    .map((v, i) => `${i === 0 ? "M" : "L"}${((i / (values.length - 1)) * (w - pad * 2) + pad).toFixed(1)},${(h - pad - ((v - min) / span) * (h - pad * 2)).toFixed(1)}`)
    .join(" ");
}

function HeroChart() {
  const data = SERIES.slice(-160);
  const W = 560, H = 300;
  const gold = toPath(data.map((p) => p.gold), W, H);
  const oil = toPath(data.map((p) => p.oil), W, H);
  const ticks = [0, 40, 80, 120, 159].map((i) => data[i]!.date.slice(0, 7));
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <defs>
          <linearGradient id="hero-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="6" x2={W - 6} y1={H * f} y2={H * f} stroke="var(--border)" strokeDasharray="3 5" />
        ))}
        <path d={`${gold} L${W - 6},${H - 6} L6,${H - 6} Z`} fill="url(#hero-gold)" stroke="none" />
        <path d={oil} fill="none" stroke="var(--oil)" strokeWidth="2" className="anim-draw" style={{ "--dash": 1400, animationDelay: "0.7s" } as any} strokeLinecap="round" />
        <path d={gold} fill="none" stroke="var(--gold)" strokeWidth="2.4" className="anim-draw" strokeLinecap="round" />
      </svg>
      <div className="flex justify-between px-1.5 text-[10px] text-muted-foreground tabular">
        {ticks.map((t) => <span key={t}>{t}</span>)}
      </div>
    </div>
  );
}

/* ---------- mini visualizations for feature cards ---------- */
function MiniDualLines() {
  const d = SERIES.slice(-60);
  return (
    <svg viewBox="0 0 200 64" className="w-full h-16">
      <path d={toPath(d.map((p) => p.oil), 200, 64)} fill="none" stroke="var(--oil)" strokeWidth="1.6" />
      <path d={toPath(d.map((p) => p.gold), 200, 64)} fill="none" stroke="var(--gold)" strokeWidth="1.8" />
    </svg>
  );
}
function MiniScatter() {
  const d = SERIES.slice(-90);
  const x = (v: number) => ((v + 6) / 12) * 190 + 5;
  const y = (v: number) => 58 - ((v + 6) / 12) * 54;
  const colors = ["var(--gold)", "var(--oil)", "var(--bull)"];
  return (
    <svg viewBox="0 0 200 64" className="w-full h-16">
      {d.map((p, i) => (
        <circle key={i} cx={x(p.goldChg)} cy={y(p.oilChg)} r="2.6" fill={colors[i % 3]} opacity="0.75" className="transition-all duration-300 group-hover:r-3" />
      ))}
    </svg>
  );
}
function MiniStates() {
  const d = SERIES.slice(-48);
  const color: Record<string, string> = { Bullish: "var(--bull)", Bearish: "var(--bear)", Sideways: "var(--secondary)", "High Volatility": "var(--gold)" };
  return (
    <div className="flex h-16 items-end gap-[2px]">
      {d.map((p, i) => (
        <div key={i} className="flex-1 rounded-sm transition-all duration-300 group-hover:scale-y-110 origin-bottom" style={{ background: color[p.regime], height: `${30 + Math.abs(p.goldChg) * 22}%` }} />
      ))}
    </div>
  );
}
function MiniDrawdown() {
  const d = SERIES.slice(-60);
  let peak = -Infinity;
  const dd = d.map((p) => { peak = Math.max(peak, p.gold); return ((p.gold - peak) / peak) * 100; });
  return (
    <svg viewBox="0 0 200 64" className="w-full h-16" preserveAspectRatio="none">
      <path d={`${toPath(dd.map((v) => v + 8), 200, 56)} L194,60 L6,60 Z`} fill="var(--bear)" opacity="0.18" stroke="none" transform="translate(0,2)" />
      <path d={toPath(dd.map((v) => v + 8), 200, 56)} fill="none" stroke="var(--bear)" strokeWidth="1.8" transform="translate(0,2)" />
    </svg>
  );
}

/* ---------- methodology ---------- */
const METHODS = [
  {
    id: "kmeans", name: "K-means", link: "/patterns" as const,
    headline: "Discover groups of similar observations",
    text: "K-means partitions market sessions into k clusters by minimizing within-cluster variance across return, volatility and momentum features — surfacing recurring behavioral archetypes.",
    viz: MiniScatter,
  },
  {
    id: "gmm", name: "GMM & EM", link: "/patterns" as const,
    headline: "Model probabilistic market clusters",
    text: "Gaussian Mixture Models treat each session as drawn from a blend of multivariate Gaussians. The Expectation–Maximization algorithm iteratively estimates the mixture parameters, yielding soft cluster membership probabilities.",
    viz: function GmmViz() {
      const curve = (mu: number, sd: number, amp: number) => {
        const pts: string[] = [];
        for (let i = 0; i <= 100; i++) {
          const x = (i / 100) * 200;
          const g = Math.exp(-((x - mu) ** 2) / (2 * sd * sd)) * amp;
          pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${(60 - g).toFixed(1)}`);
        }
        return pts.join(" ");
      };
      return (
        <svg viewBox="0 0 200 64" className="w-full h-16">
          <path d={curve(60, 26, 46)} fill="none" stroke="var(--gold)" strokeWidth="1.8" />
          <path d={curve(115, 32, 40)} fill="none" stroke="var(--oil)" strokeWidth="1.8" />
          <path d={curve(150, 18, 30)} fill="none" stroke="var(--bull)" strokeWidth="1.6" />
        </svg>
      );
    },
  },
  {
    id: "pca", name: "PCA", link: "/insights" as const,
    headline: "Compress many features into a readable map",
    text: "Principal Component Analysis projects high-dimensional feature vectors onto the directions of greatest variance, so relationships between sessions can be visualized in two or three dimensions.",
    viz: function PcaViz() {
      const d = SERIES.slice(-50);
      return (
        <svg viewBox="0 0 200 64" className="w-full h-16">
          <line x1="10" y1="54" x2="190" y2="54" stroke="var(--border)" />
          <line x1="10" y1="54" x2="10" y2="6" stroke="var(--border)" />
          {d.map((p, i) => (
            <circle key={i} cx={20 + ((p.goldChg + 5) / 10) * 165} cy={50 - ((p.oilChg + 5) / 10) * 42} r="2.4" fill={i % 2 ? "var(--gold)" : "var(--oil)"} opacity="0.7" />
          ))}
          <line x1="10" y1="54" x2="120" y2="18" stroke="var(--primary)" strokeWidth="1.4" markerEnd="url(#arr)" />
          <defs><marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--primary)" /></marker></defs>
        </svg>
      );
    },
  },
  {
    id: "hier", name: "Hierarchical", link: "/patterns" as const,
    headline: "Inspect nested similarities",
    text: "Agglomerative hierarchical clustering merges the most similar sessions step by step, producing a dendrogram of nested structure — no need to choose the number of clusters in advance.",
    viz: function HierViz() {
      const leaves = [20, 55, 90, 125, 160];
      return (
        <svg viewBox="0 0 200 64" className="w-full h-16" fill="none" strokeWidth="1.6">
          {leaves.map((x) => <line key={x} x1={x} y1="58" x2={x} y2="48" stroke="var(--secondary)" />)}
          <path d="M20 48 V38 H55 V48 M37.5 38 V26 H107.5 M90 48 V38 H125 V48 M107.5 38 V26 M72.5 26 V14 H142.5 M160 48 V30 H142.5 V14" stroke="var(--primary)" />
        </svg>
      );
    },
  },
  {
    id: "hmm", name: "Hidden Markov Models", link: "/states" as const,
    headline: "Infer latent market states through time",
    text: "An HMM assumes the market moves between unobserved states — calm, trending, turbulent — each emitting characteristic return patterns. The model infers the most likely state sequence and transition probabilities.",
    viz: MiniStates,
  },
];

/* ---------- page ---------- */
function Landing() {
  const [dark, setDark] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [method, setMethod] = useState(METHODS[0]!);
  const [previewRange, setPreviewRange] = useState<RangeKey>("1Y");
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const root = useReveal();

  const last = SERIES[SERIES.length - 1]!;
  const preview = indexed(sliceRange(previewRange));
  const counts = regimeCounts(preview);
  const corr = (() => {
    const n = preview.length;
    const mg = preview.reduce((s, p) => s + p.goldChg, 0) / n;
    const mo = preview.reduce((s, p) => s + p.oilChg, 0) / n;
    let cov = 0, vg = 0, vo = 0;
    preview.forEach((p) => { cov += (p.goldChg - mg) * (p.oilChg - mo); vg += (p.goldChg - mg) ** 2; vo += (p.oilChg - mo) ** 2; });
    return cov / Math.sqrt(vg * vo || 1);
  })();

  const navLinks = [
    { label: "Product", href: "#product" },
    { label: "Methodology", href: "#methodology" },
    { label: "Market Insights", href: "#insights" },
    { label: "About", href: "#about" },
  ];

  return (
    <div ref={root} className="relative min-h-screen overflow-x-clip">
      {/* atmospheric glassmorphic background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="ambient absolute inset-0" />
        <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMin slice" className="absolute inset-x-0 top-0 h-[135vh] w-full" style={{ maskImage: "linear-gradient(to bottom, black 0%, black 40%, transparent 75%)", opacity: 0.5 }}>
          <path d={toPath(SERIES.slice(-300).map((p) => p.gold), 1440, 900)} fill="none" stroke="var(--gold)" strokeWidth="1.6" className="anim-draw" style={{ "--dash": 2800 } as any} strokeLinecap="round" />
          <path d={toPath(SERIES.slice(-300).map((p) => p.oil), 1440, 900)} fill="none" stroke="var(--oil)" strokeWidth="1.4" className="anim-draw" style={{ "--dash": 2800, animationDelay: "1.1s" } as any} strokeLinecap="round" />
        </svg>
        <div className="grain-soft absolute inset-0" />
        <div className="frost float-y absolute left-[3%] top-[34rem] h-36 w-60 opacity-80" style={{ "--rot": "-7deg", transform: "rotate(-7deg)", animationDelay: "-2s" } as any} />
        <div className="frost float-y absolute right-[4%] top-[62rem] h-44 w-72 opacity-70 hidden sm:block" style={{ "--rot": "5deg", transform: "rotate(5deg)", animationDelay: "-5s" } as any} />
        <div className="frost float-y absolute left-[14%] top-[92rem] h-28 w-52 opacity-60 hidden lg:block" style={{ "--rot": "3deg", transform: "rotate(3deg)", animationDelay: "-7s" } as any} />
        <div className="orb w-[36rem] h-[36rem] bg-oil/35 -top-48 right-[-10rem]" />
        <div className="orb w-[30rem] h-[30rem] bg-gold/40 top-[46rem] -left-48" style={{ animationDelay: "-6s" }} />
        <div className="orb w-[26rem] h-[26rem] bg-bull/25 top-[105rem] right-[5rem]" style={{ animationDelay: "-3s" }} />
      </div>

      {/* nav */}
      <header className="sticky top-3 z-40 px-3">
        <div className={`frost mx-auto flex max-w-6xl items-center gap-3 px-4 transition-all duration-300 ${scrolled ? "py-2 !rounded-2xl shadow-lg" : "py-3"}`}>
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl grid place-items-center clay-primary"><Gem className="h-4.5 w-4.5" /></div>
            <div className="leading-tight">
              <div className="font-display text-lg text-primary">CommodiSense</div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Market Intelligence</div>
            </div>
          </Link>
          <nav className="ml-auto hidden lg:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            {navLinks.map((l) => <a key={l.href} href={l.href} className="hover:text-foreground transition-colors">{l.label}</a>)}
          </nav>
          <div className="ml-auto lg:ml-4 flex items-center gap-2">
            <button onClick={() => setDark(!dark)} className="clay h-9 w-9 grid place-items-center" aria-label="Toggle theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link to="/dashboard" className="hidden sm:inline-flex clay-primary px-4 py-2 text-sm font-semibold items-center gap-2">
              Open Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
            <button onClick={() => setMenu(!menu)} className="lg:hidden clay h-9 w-9 grid place-items-center" aria-label="Menu">
              {menu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {menu && (
          <div className="glass mx-auto mt-2 max-w-6xl rounded-2xl p-4 lg:hidden rise">
            <nav className="grid gap-1 text-sm font-medium">
              {navLinks.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setMenu(false)} className="rounded-lg px-3 py-2.5 hover:bg-surface transition-colors">{l.label}</a>
              ))}
              <Link to="/dashboard" className="clay-primary mt-2 px-4 py-2.5 text-center font-semibold">Open Dashboard</Link>
            </nav>
          </div>
        )}
      </header>

      <main className="relative z-10">
        {/* ---------- HERO ---------- */}
        <section className="mx-auto max-w-6xl px-4 md:px-6 pt-14 md:pt-20 pb-16 grid gap-12 lg:grid-cols-[1.05fr_1fr] items-center">
          <div>
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" /> Commodity Market Intelligence
              </div>
            </Reveal>
            <Reveal delay={90}>
              <h1 className="mt-6 text-4xl md:text-6xl font-display text-primary leading-[1.06] tracking-tight">
                Markets move in patterns. Discover <em className="italic">what lies beneath</em>.
              </h1>
            </Reveal>
            <Reveal delay={180}>
              <p className="mt-5 text-muted-foreground md:text-lg max-w-xl leading-relaxed">
                Explore historical commodity behavior, uncover latent market regimes, and measure changing
                risk with machine-learning-powered analytics.
              </p>
            </Reveal>
            <Reveal delay={260}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/dashboard" className="clay-primary px-6 py-3.5 text-sm font-semibold inline-flex items-center gap-2">
                  Explore Market Intelligence <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#methodology" className="clay px-6 py-3.5 text-sm font-semibold text-primary inline-flex items-center gap-2">
                  Discover the Methodology <ArrowDown className="h-4 w-4" />
                </a>
              </div>
            </Reveal>
            <Reveal delay={340}>
              <p className="mt-6 text-xs text-muted-foreground tracking-wide">
                Gold · Crude Oil · Unsupervised Learning · Hidden Markov Models
              </p>
            </Reveal>
          </div>

          {/* hero visual */}
          <Reveal delay={200} className="relative">
            <div className="gold-orb absolute -top-10 -right-6 h-24 w-24 md:h-32 md:w-32 z-0" />
            <div className="frost relative z-10 p-4 md:p-5 shadow-xl">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="text-xs font-semibold text-muted-foreground">Gold vs Crude Oil — indexed</div>
                <span className="rounded-full bg-gold-soft/60 px-2.5 py-0.5 text-[10px] font-semibold text-primary">Illustrative preview</span>
              </div>
              <HeroChart />
            </div>
            <div className="frost absolute -left-3 md:-left-8 top-8 z-20 px-3.5 py-2.5 rounded-xl shadow-lg rise" style={{ animationDelay: "600ms" }}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Market Regime</div>
              <div className="text-sm font-bold text-secondary">{last.regime}</div>
            </div>
            <div className="frost absolute -right-2 md:-right-6 bottom-16 z-20 px-3.5 py-2.5 rounded-xl shadow-lg rise" style={{ animationDelay: "800ms" }}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Volatility</div>
              <div className="text-sm font-bold tabular">{Math.abs(last.oilChg).toFixed(2)}σ</div>
            </div>
            <div className="frost absolute left-6 -bottom-5 z-20 px-3.5 py-2.5 rounded-xl shadow-lg rise" style={{ animationDelay: "1000ms" }}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk</div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tabular">{last.risk}/100</span>
                <span className={`h-2 w-2 rounded-full ${last.risk >= 66 ? "bg-bear" : last.risk >= 40 ? "bg-gold" : "bg-bull"}`} />
              </div>
            </div>
          </Reveal>
        </section>

        {/* ---------- A: intelligence strip ---------- */}
        <section className="border-y border-border bg-card/60 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-4 md:px-6 grid grid-cols-2 lg:grid-cols-4">
            {[
              { icon: History, label: "Historical Market Behavior" },
              { icon: ScatterChart, label: "Unsupervised Pattern Discovery" },
              { icon: BrainCircuit, label: "Hidden State Inference" },
              { icon: Gauge, label: "Quantitative Risk Analysis" },
            ].map((t, i) => (
              <div key={t.label} className={`flex items-center gap-3 px-4 py-5 ${i > 0 ? "lg:border-l border-border" : ""}`}>
                <t.icon className="h-4.5 w-4.5 text-gold shrink-0" />
                <span className="text-xs font-semibold text-primary leading-snug">{t.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- B: product intro ---------- */}
        <section id="product" className="mx-auto max-w-6xl px-4 md:px-6 py-20 md:py-28 grid gap-12 lg:grid-cols-2 items-center">
          <Reveal>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">The Idea</div>
            <h2 className="mt-3 text-3xl md:text-4xl font-display text-primary tracking-tight">From historical prices to hidden market behavior.</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Price movements contain recurring patterns, shifting volatility, and latent regimes that are
              invisible in a raw chart. CommodiSense uses statistical learning to surface that structure —
              transforming a price line into clusters of similar behavior, and clusters into the hidden
              states that drive them.
            </p>
          </Reveal>
          <Reveal delay={150}>
            <div className="frost p-5 md:p-6">
              <TransformationVisual />
            </div>
          </Reveal>
        </section>

        {/* ---------- C: feature cards ---------- */}
        <section className="mx-auto max-w-6xl px-4 md:px-6 pb-20 md:pb-28">
          <Reveal className="text-center mb-12">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">Capabilities</div>
            <h2 className="mt-3 text-3xl md:text-4xl font-display text-primary tracking-tight">Four lenses on the same market</h2>
          </Reveal>
          <div className="grid gap-5 md:grid-cols-2">
            {[
              { icon: LineChart, title: "Market Explorer", text: "Examine historical gold and crude oil prices, returns, moving averages, and rolling volatility.", viz: <MiniDualLines />, to: "/explorer" },
              { icon: Shapes, title: "Pattern Discovery", text: "Group similar market observations with K-means, Gaussian Mixture Models, and hierarchical clustering.", viz: <MiniScatter />, to: "/patterns" },
              { icon: Layers, title: "Hidden Market States", text: "Use Hidden Markov Models to infer latent regimes and visualize state-transition probabilities.", viz: <MiniStates />, to: "/states" },
              { icon: ShieldAlert, title: "Risk Intelligence", text: "Examine volatility, drawdowns, tail risk, and cross-commodity relationships.", viz: <MiniDrawdown />, to: "/risk" },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <Link to={f.to as any} className="group glass glass-lift block p-6 md:p-7 h-full">
                  <div className="flex items-start justify-between">
                    <div className="h-11 w-11 rounded-xl bg-surface grid place-items-center text-primary"><f.icon className="h-5 w-5" /></div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold tracking-tight">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.text}</p>
                  <div className="mt-5 rounded-xl bg-surface/70 p-3">{f.viz}</div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------- D: methodology ---------- */}
        <section id="methodology" className="border-y border-border bg-card/60 backdrop-blur-sm py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <Reveal className="max-w-2xl mb-10">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">Methodology</div>
              <h2 className="mt-3 text-3xl md:text-4xl font-display text-primary tracking-tight">Five analytical perspectives. One connected market picture.</h2>
            </Reveal>
            <Reveal delay={120}>
              <div className="flex flex-wrap gap-2 mb-8">
                {METHODS.map((m) => (
                  <button key={m.id} onClick={() => setMethod(m)}
                    className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${method.id === m.id ? "clay-primary" : "clay text-muted-foreground"}`}>
                    {m.name}
                  </button>
                ))}
              </div>
            </Reveal>
            <Reveal delay={200}>
              <div className="glass p-6 md:p-8 grid gap-8 md:grid-cols-2 items-center" key={method.id}>
                <div className="rise">
                  <h3 className="text-xl font-bold tracking-tight">{method.headline}</h3>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{method.text}</p>
                  <Link to={method.link as any} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:gap-3 transition-all">
                    Explore in Dashboard <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="rounded-xl bg-surface/70 p-5 rise" style={{ animationDelay: "120ms" }}>
                  <method.viz />
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------- E: sample intelligence ---------- */}
        <section id="insights" className="mx-auto max-w-6xl px-4 md:px-6 py-20 md:py-28">
          <Reveal className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">Sample Market Intelligence</div>
              <h2 className="mt-3 text-3xl md:text-4xl font-display text-primary tracking-tight">A live look at the analytics</h2>
            </div>
            <div className="flex items-center gap-3">
              <Segmented value={previewRange} options={["1M", "3M", "6M", "1Y", "ALL"] as const} onChange={setPreviewRange} />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-gold-soft/50 px-3 py-1 text-[11px] font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" /> Illustrative demonstration data — not live prices
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="glass p-5 lg:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-bold">Indexed price trends</div>
                  <div className="flex gap-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gold" />Gold</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-oil" />Crude Oil</span>
                  </div>
                </div>
                <svg viewBox="0 0 560 220" className="w-full h-auto">
                  <path d={toPath(preview.map((p) => p.oilIdx), 560, 220)} fill="none" stroke="var(--oil)" strokeWidth="1.8" />
                  <path d={toPath(preview.map((p) => p.goldIdx), 560, 220)} fill="none" stroke="var(--gold)" strokeWidth="2.2" />
                </svg>
              </div>
              <div className="grid gap-5">
                <div className="glass p-5">
                  <div className="flex items-center gap-2 text-sm font-bold"><Activity className="h-4 w-4 text-secondary" />Volatility</div>
                  <div className="mt-2 -mx-1"><Sparkline data={preview.map((p) => Math.abs(p.goldChg) + Math.abs(p.oilChg))} color="var(--secondary)" /></div>
                  <div className="mt-1 text-[11px] text-muted-foreground">Rolling absolute daily move</div>
                </div>
                <div className="glass p-5">
                  <div className="flex items-center gap-2 text-sm font-bold"><Layers className="h-4 w-4 text-secondary" />Market states</div>
                  <MiniStatesPreview data={preview} />
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                    {counts.map((c) => <span key={c.key} className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />{c.key}</span>)}
                  </div>
                </div>
                <div className="glass p-5">
                  <div className="flex items-center gap-2 text-sm font-bold"><TrendingDown className="h-4 w-4 text-secondary" />Gold–oil correlation</div>
                  <div className="mt-2 text-2xl font-extrabold tabular">{corr.toFixed(2)}</div>
                  <div className="mt-2 h-1.5 rounded-full bg-surface relative">
                    <div className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full bg-primary border-2 border-card transition-all" style={{ left: `${((corr + 1) / 2) * 100}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>-1</span><span>0</span><span>+1</span></div>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <Link to="/explorer" className="clay-primary px-5 py-3 text-sm font-semibold inline-flex items-center gap-2">
                Open Market Explorer <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </section>

        {/* ---------- F: risk section ---------- */}
        <section className="relative overflow-hidden py-20 md:py-28" style={{ background: "var(--ocean-deep)" }}>
          <div className="orb w-96 h-96 bg-gold/10 top-10 right-10" />
          <div className="mx-auto max-w-6xl px-4 md:px-6 relative">
            <Reveal className="max-w-2xl mb-12">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-gold-soft">Risk Intelligence</div>
              <h2 className="mt-3 text-3xl md:text-4xl font-display tracking-tight" style={{ color: "oklch(0.95 0.01 230)" }}>Understand risk beyond the headline price.</h2>
            </Reveal>
            <div className="grid gap-5 md:grid-cols-3">
              {[
                { title: "Volatility & Instability", text: "Rolling volatility tracks how violently prices swing — and when calm markets turn turbulent.", spark: SERIES.slice(-40).map((p) => Math.abs(p.oilChg)), color: "var(--gold)" },
                { title: "Drawdown & Downside", text: "Peak-to-trough declines measure the pain of holding through adverse moves.", spark: (() => { let pk = -Infinity; return SERIES.slice(-40).map((p) => { pk = Math.max(pk, p.gold); return ((p.gold - pk) / pk) * 100; }); })(), color: "var(--bear)" },
                { title: "VaR & CVaR", text: "Value at Risk and Conditional VaR quantify tail losses at chosen confidence levels.", spark: SERIES.slice(-40).map((p) => p.risk), color: "var(--gold)" },
              ].map((r, i) => (
                <Reveal key={r.title} delay={i * 100}>
                  <div className="rounded-2xl border p-6 h-full" style={{ background: "oklch(1 0 0 / 0.06)", borderColor: "oklch(1 0 0 / 0.12)", backdropFilter: "blur(10px)" }}>
                    <h3 className="font-bold" style={{ color: "oklch(0.95 0.01 230)" }}>{r.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: "oklch(0.75 0.02 230)" }}>{r.text}</p>
                    <div className="mt-4"><Sparkline data={r.spark} color={r.color} /></div>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={200}>
              <p className="mt-8 text-xs max-w-xl" style={{ color: "oklch(0.65 0.02 230)" }}>
                These statistical metrics describe historical or modeled risk. They do not guarantee future outcomes.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ---------- G: how it works ---------- */}
        <section id="about" className="mx-auto max-w-6xl px-4 md:px-6 py-20 md:py-28">
          <Reveal className="text-center mb-14">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">How It Works</div>
            <h2 className="mt-3 text-3xl md:text-4xl font-display text-primary tracking-tight">From raw prices to readable risk</h2>
          </Reveal>
          <div className="grid gap-8 md:grid-cols-4 relative">
            <div className="hidden md:block absolute top-6 left-[12%] right-[12%] h-px bg-border" />
            {[
              ["Collect", "Gather historical market observations for gold and crude oil."],
              ["Engineer", "Compute returns, volatility, momentum, and other features."],
              ["Discover", "Find patterns and infer hidden states with statistical learning."],
              ["Visualize", "Explore market behavior and quantify risk in the dashboard."],
            ].map(([t, d], i) => (
              <Reveal key={t} delay={i * 100}>
                <div className="relative text-center md:text-left">
                  <div className="mx-auto md:mx-0 h-12 w-12 rounded-full clay-primary grid place-items-center font-display text-lg relative z-10">{String(i + 1).padStart(2, "0")}</div>
                  <h3 className="mt-4 font-bold">{t}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------- H: final CTA ---------- */}
        <section className="mx-auto max-w-6xl px-4 md:px-6 pb-24">
          <Reveal>
            <div className="frost relative overflow-hidden p-8 md:p-14 text-center shadow-xl">
              <div className="orb w-72 h-72 bg-secondary/20 -left-20 -bottom-24" />
              <svg viewBox="0 0 400 60" className="absolute inset-x-0 bottom-0 w-full opacity-30" preserveAspectRatio="none">
                <path d={toPath(SERIES.slice(-80).map((p) => p.gold), 400, 60)} fill="none" stroke="var(--gold)" strokeWidth="1.5" />
              </svg>
              <h2 className="relative text-3xl md:text-5xl font-display text-primary tracking-tight">Look beyond the price. <em className="italic">Explore the pattern.</em></h2>
              <p className="relative mt-4 text-muted-foreground max-w-lg mx-auto">Move from raw historical observations to interpretable market behavior.</p>
              <div className="relative mt-8">
                <Link to="/dashboard" className="clay-primary px-7 py-4 text-sm font-semibold inline-flex items-center gap-2">
                  Open CommodiSense Dashboard <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ---------- footer ---------- */}
        <footer className="border-t border-border bg-card/60 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-4 md:px-6 py-12 grid gap-10 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg grid place-items-center clay-primary"><Gem className="h-4 w-4" /></div>
                <span className="font-display text-lg text-primary">CommodiSense</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">Read the patterns. Understand the risk.</p>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Product</div>
              <div className="grid gap-2 text-sm">
                {[["Overview", "/dashboard"], ["Market Explorer", "/explorer"], ["Pattern Discovery", "/patterns"], ["Risk Analysis", "/risk"]].map(([l, to]) => (
                  <Link key={to} to={to as any} className="text-muted-foreground hover:text-foreground transition-colors">{l}</Link>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Methodology</div>
              <div className="grid gap-2 text-sm">
                {[["Hidden Market States", "/states"], ["Model Insights", "/insights"], ["Data Sources", "/data"]].map(([l, to]) => (
                  <Link key={to} to={to as any} className="text-muted-foreground hover:text-foreground transition-colors">{l}</Link>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">About</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                CommodiSense is an educational analytics project. All displayed prices are illustrative
                demonstration data, not live market feeds, and nothing here constitutes financial advice.
              </p>
            </div>
          </div>
          <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">
            © 2026 CommodiSense · For educational use only · Demonstration data
          </div>
        </footer>
      </main>
    </div>
  );
}

function MiniStatesPreview({ data }: { data: ReturnType<typeof indexed> }) {
  const color: Record<string, string> = { Bullish: "var(--bull)", Bearish: "var(--bear)", Sideways: "var(--secondary)", "High Volatility": "var(--gold)" };
  return (
    <div className="mt-2 flex h-6 gap-px overflow-hidden rounded-md">
      {data.map((p, i) => <div key={i} className="flex-1" style={{ background: color[p.regime] }} />)}
    </div>
  );
}

function TransformationVisual() {
  const d = SERIES.slice(-72);
  const color: Record<string, string> = { Bullish: "var(--bull)", Bearish: "var(--bear)", Sideways: "var(--secondary)", "High Volatility": "var(--gold)" };
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">1 · Price line</div>
        <svg viewBox="0 0 400 56" className="w-full h-14">
          <path d={toPath(d.map((p) => p.gold), 400, 56)} fill="none" stroke="var(--gold)" strokeWidth="2" />
        </svg>
      </div>
      <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
      <div>
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">2 · Behavioral clusters</div>
        <svg viewBox="0 0 400 56" className="w-full h-14">
          {d.map((p, i) => (
            <circle key={i} cx={8 + (i / (d.length - 1)) * 384} cy={50 - ((p.goldChg + 4) / 8) * 44} r="3.4" fill={color[p.regime]} opacity="0.8" />
          ))}
        </svg>
      </div>
      <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
      <div>
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">3 · Inferred market states</div>
        <div className="flex h-8 gap-px overflow-hidden rounded-lg">
          {d.map((p, i) => <div key={i} className="flex-1" style={{ background: color[p.regime] }} />)}
        </div>
      </div>
    </div>
  );
}
