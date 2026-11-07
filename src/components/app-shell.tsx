import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, LineChart, Shapes, Layers, ShieldAlert, BrainCircuit, Database, Settings,
  ChevronsLeft, Bell, Moon, Sun, Search, Gem,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAppState, type Commodity } from "@/lib/app-state";
import type { RangeKey } from "@/lib/market-data";
import { cn } from "@/lib/utils";
import { ConnectionPill } from "./analysis";

export const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/explorer", label: "Market Explorer", icon: LineChart },
  { to: "/patterns", label: "Pattern Discovery", icon: Shapes },
  { to: "/states", label: "Hidden Market States", icon: Layers },
  { to: "/risk", label: "Risk Analysis", icon: ShieldAlert },
  { to: "/insights", label: "Model Insights", icon: BrainCircuit },
  { to: "/data", label: "Data Sources", icon: Database },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-xl bg-surface p-1 gap-1">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)}
          className={cn("px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200",
            value === o ? "clay text-primary" : "text-muted-foreground hover:text-foreground")}>
          {o}
        </button>
      ))}
    </div>
  );
}

export const RANGES: RangeKey[] = ["1M", "3M", "6M", "1Y", "5Y", "ALL"];
export const COMMODITIES: Commodity[] = ["Gold", "Crude Oil", "Compare"];

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const current = NAV.find((n) => n.to === path) ?? NAV[0];
  const { range, setRange, commodity, setCommodity, connection, summary } = useAppState();

  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);

  return (
    <div className="relative min-h-screen flex">
      <div className="orb w-96 h-96 bg-gold-soft/40 -top-20 right-10" />
      <div className="orb w-[28rem] h-[28rem] bg-secondary/15 top-60 -left-20" style={{ animationDelay: "-6s" }} />

      <aside className={cn("sticky top-0 h-screen shrink-0 p-3 transition-[width] duration-250 z-20", collapsed ? "w-20" : "w-64")}>
        <div className="glass h-full flex flex-col p-3">
          <div className="flex items-center gap-2.5 px-1.5 py-2">
            <div className="h-9 w-9 shrink-0 rounded-xl grid place-items-center clay-primary"><Gem className="h-4.5 w-4.5" /></div>
            {!collapsed && <div className="leading-tight"><div className="font-extrabold tracking-tight text-primary">CommodiSense</div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Market Intelligence</div></div>}
          </div>
          <nav className="mt-6 flex-1 space-y-1">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = path === to;
              return (
                <Link key={to} to={to} title={label}
                  className={cn("relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    active ? "bg-surface text-primary" : "text-muted-foreground hover:bg-surface/60 hover:text-foreground")}>
                  {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-secondary" />}
                  <Icon className="h-4 w-4 shrink-0" />{!collapsed && <span className="truncate">{label}</span>}
                </Link>
              );
            })}
          </nav>
          {!collapsed && (
            <div className="rounded-xl bg-surface p-3 text-xs space-y-1">
              <div className="flex items-center gap-2 font-semibold"><span className="h-2 w-2 rounded-full bg-gold" />{summary ? (summary.source === "live" ? "Live data" : summary.source === "preloaded" ? "Preloaded historical data" : "Demonstration data") : "Demonstration data"}</div>
              <div className="text-muted-foreground">Fetched automatically. See Data Sources.</div>
            </div>
          )}
          <div className="mt-3 flex items-center gap-2.5 px-1.5">
            <div className="h-8 w-8 rounded-full bg-primary grid place-items-center text-xs font-bold text-primary-foreground">A</div>
            {!collapsed && <div className="text-xs"><div className="font-semibold">Analyst</div><div className="text-muted-foreground">Research workspace</div></div>}
            <button onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar" className="ml-auto text-muted-foreground hover:text-foreground">
              <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 relative z-10">
        <header className="sticky top-0 z-30 px-3 pt-3">
          <div className="glass !rounded-2xl flex flex-wrap items-center gap-3 px-5 py-3">
            <div>
              <div className="text-[11px] text-muted-foreground">CommodiSense / {current.label}</div>
              <h1 className="text-base font-bold tracking-tight">{current.label}</h1>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="hidden lg:flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm text-muted-foreground">
                <Search className="h-4 w-4" />
                <select value={commodity} onChange={(e) => setCommodity(e.target.value as Commodity)} className="bg-transparent outline-none text-foreground font-medium">
                  {COMMODITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <Segmented value={range} options={RANGES} onChange={setRange} />
              <div className="hidden md:block"><ConnectionPill connection={connection} /></div>
              <Popover>
                <PopoverTrigger className="clay h-9 w-9 grid place-items-center relative" aria-label="Notifications">
                  <Bell className="h-4 w-4" /><span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-bear" />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 glass !bg-popover">
                  <div className="font-semibold text-sm mb-2">Notifications</div>
                  {[["Regime shift detected", "Crude oil moved into High Volatility (sample)."], ["Risk elevated", "Combined risk score crossed 60."], ["Model retrained", "Clustering refreshed on latest sample set."]].map(([t, d]) => (
                    <div key={t} className="py-2 border-t text-xs"><div className="font-semibold">{t}</div><div className="text-muted-foreground">{d}</div></div>
                  ))}
                </PopoverContent>
              </Popover>
              <button onClick={() => setDark(!dark)} className="clay h-9 w-9 grid place-items-center" aria-label="Toggle theme">
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </header>
        <main className="p-3 md:p-6">{children}</main>
      </div>
    </div>
  );
}
