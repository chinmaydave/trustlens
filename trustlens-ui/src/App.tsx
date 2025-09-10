// React is a UI library. We import hooks to manage state (data) and lifecycle (when to load).
import React, { useEffect, useMemo, useState } from "react";

// Pretty SVG icons as React components
import { AlertTriangle, Bell, Database, RefreshCw, WifiOff, CheckCircle2, Activity } from "lucide-react";

// Recharts = charting library (used for the trend graph at the bottom)
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

/**
 * ────────────────────────────────────────────────────────────────────────────────
 * TrustLens Dashboard — high level:
 * - Shows KPIs (counts), a data sources table, recent alerts, and a live trend chart.
 * - Runs with FAKE data by default (so you can demo without any backend).
 * - Later, set USE_MOCKS=false + give API_BASE, and it will fetch real data from your API.
 * ────────────────────────────────────────────────────────────────────────────────
 */

// Switch this to false when your backend exists
const USE_MOCKS = false;

// Where to call your backend (only used when USE_MOCKS=false)
const API_BASE = (import.meta as any)?.env?.VITE_API_BASE || "http://localhost:8000";

/** Type “shapes” for our data (helps catch mistakes and self-documents the schema) */
type DataSource = {
  id: string;
  name: string;
  type: string;                      // e.g., 'postgres', 'api', 's3'
  status: "healthy" | "warning" | "failing";
  lastRun: string;                   // ISO datetime string
};

type AlertItem = {
  id: string | number;
  severity: "low" | "medium" | "high";
  message: string;
  created_at: string;                // ISO datetime string
};

type TrendPoint = { t: string; nullRate: number; freshnessMin: number };

/** Small helpers to generate realistic-looking demo data */
const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const choice = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

/** Build a fake list of data sources (what we “monitor”) */
function makeMockDataSources(): DataSource[] {
  const statuses: DataSource["status"][] = ["healthy", "warning", "failing"];
  const nowISO = new Date().toISOString();
  return [
    { id: "1", name: "Orders DB",         type: "postgres", status: choice(statuses), lastRun: nowISO },
    { id: "2", name: "Users API",         type: "api",      status: choice(statuses), lastRun: nowISO },
    { id: "3", name: "Inventory S3",      type: "s3",       status: choice(statuses), lastRun: nowISO },
    { id: "4", name: "Billing Warehouse", type: "postgres", status: choice(statuses), lastRun: nowISO },
  ];
}

/** Build a fake list of recent alerts (what went wrong recently) */
function makeMockAlerts(): AlertItem[] {
  const severities: AlertItem["severity"][] = ["low", "medium", "high"];
  const now = Date.now();
  return new Array(5).fill(0).map((_, i) => ({
    id: i + 1,
    severity: choice(severities),
    message: choice([
      "Orders freshness > 60 min",
      "Email NULL rate spiked",
      "Inventory sync delayed",
      "Billing amount out of range",
      "Warehouse connection flapping",
    ]),
    // Spread out timestamps for realism
    created_at: new Date(now - i * 1000 * 60 * rand(1, 9)).toISOString(),
  }));
}

/** Build a fake time series (null % and freshness minutes over time) */
function makeMockTrend(): TrendPoint[] {
  const now = Date.now();
  return new Array(30).fill(0).map((_, i) => ({
    // 30 points, one per minute
    t: new Date(now - (29 - i) * 60_000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    nullRate: Math.round(rand(0, 20) * 10) / 10,  // 0–20% with 0.1 steps
    freshnessMin: Math.round(rand(5, 120)),       // 5–120 minutes
  }));
}

/**
 * Tiny presentational component:
 * - Given a status, show a colored “pill” chip and an icon.
 * - Keeps UI logic separate and reusable.
 */
function StatusBadge({ status }: { status: DataSource["status"] }) {
  const cfg =
    status === "healthy"
      ? { icon: <CheckCircle2 className="h-4 w-4" />, cls: "bg-green-100 text-green-700 border-green-200" }
      : status === "warning"
      ? { icon: <AlertTriangle className="h-4 w-4" />, cls: "bg-yellow-100 text-yellow-800 border-yellow-200" }
      : { icon: <WifiOff className="h-4 w-4" />, cls: "bg-red-100 text-red-700 border-red-200" };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
      {cfg.icon}
      {status}
    </span>
  );
}

/**
 * Main App component — this is the whole page.
 * Think: “load data → compute small KPIs → render page”
 */
export default function App() {
  // React “state”: the current data in memory that triggers re-render when changed.
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Derived values (computed from state). useMemo avoids re-computing on every render.
  const healthyCount = useMemo(() => dataSources.filter(d => d.status === "healthy").length, [dataSources]);
  const failingCount = useMemo(() => dataSources.filter(d => d.status === "failing").length, [dataSources]);
  const warningCount = useMemo(() => dataSources.filter(d => d.status === "warning").length, [dataSources]);

  /**
   * useEffect = run side effects (like fetching data) after the first render.
   * Here: on mount → load mock data (or fetch real API) and start a timer that
   * pushes a new point into the trend chart every 6 seconds so it feels “live”.
   */
  useEffect(() => {
    let timer: number | undefined;

    async function load() {
      setLoading(true);
      try {
        if (USE_MOCKS) {
          // No backend? No problem. Seed the UI with fake but realistic data.
          setDataSources(makeMockDataSources());
          setAlerts(makeMockAlerts());
          setTrend(makeMockTrend());
        } else {
          // When you have a backend, flip USE_MOCKS=false and implement these routes.
          const [dsRes, alRes, trRes] = await Promise.all([
            fetch(`${API_BASE}/data-sources`),
            fetch(`${API_BASE}/alerts?limit=20`),
            fetch(`${API_BASE}/metrics/null-rate?window=30min`),
          ]);
          setDataSources(await dsRes.json());
          setAlerts(await alRes.json());
          setTrend(await trRes.json());
        }
      } finally {
        setLoading(false);
      }

      // Live-ish feel: replace the oldest trend point with a new one every 6s
      timer = window.setInterval(() => {
        setTrend(prev => {
          const next = [
            ...prev.slice(1),
            {
              t: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              nullRate: Math.round(rand(0, 20) * 10) / 10,
              freshnessMin: Math.round(rand(5, 120)),
            },
          ];
          return next;
        });
      }, 6000);
    }

    load();

    // Cleanup: stop the timer if the component/page is removed
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, []);

  /** Manual refresh button handler (regenerates mocks or re-fetches API) */
  function refresh() {
    if (USE_MOCKS) {
      setDataSources(makeMockDataSources());
      setAlerts(makeMockAlerts());
    } else {
      fetch(`${API_BASE}/data-sources`).then(r => r.json()).then(setDataSources);
      fetch(`${API_BASE}/alerts?limit=20`).then(r => r.json()).then(setAlerts);
    }
  }

  /** JSX = the “HTML-like” UI we render, but with JS expressions inside {}. */
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Top bar with a title and actions */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-600" />
            <h1 className="text-lg md:text-2xl font-semibold">TrustLens — Data Observability</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-100">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <a
              href="#"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Bell className="h-4 w-4" /> Connect Slack
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* KPI cards: quick at-a-glance stats */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Data Sources" value={dataSources.length} icon={<Database className="h-5 w-5" />} />
          <KpiCard title="Healthy" value={healthyCount} accent="green" />
          <KpiCard title="Warnings" value={warningCount} accent="yellow" />
          <KpiCard title="Failing" value={failingCount} accent="red" />
        </section>

        {/* Two-column layout: table (left) + alerts (right) */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Data sources table (list of systems being monitored) */}
          <div className="lg:col-span-2 rounded-2xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <h2 className="font-semibold">Data Sources</h2>
              <span className="text-xs text-gray-500">{loading ? "Loading…" : `Updated ${new Date().toLocaleTimeString()}`}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium text-gray-600">Name</th>
                    <th className="px-4 py-2 font-medium text-gray-600">Type</th>
                    <th className="px-4 py-2 font-medium text-gray-600">Status</th>
                    <th className="px-4 py-2 font-medium text-gray-600">Last Run</th>
                  </tr>
                </thead>
                <tbody>
                  {dataSources.map(ds => (
                    <tr key={ds.id} className="border-t">
                      <td className="px-4 py-2">{ds.name}</td>
                      <td className="px-4 py-2 uppercase text-xs text-gray-500">{ds.type}</td>
                      <td className="px-4 py-2"><StatusBadge status={ds.status} /></td>
                      <td className="px-4 py-2 text-gray-500">{new Date(ds.lastRun).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent alerts panel */}
          <div className="rounded-2xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Recent Alerts
              </h2>
              <a className="text-xs text-indigo-600 hover:underline" href="#">View all</a>
            </div>
            <div className="divide-y">
              {alerts.map(a => (
                <div key={a.id} className="px-4 py-3 flex items-start gap-3">
                  {/* small colored dot by severity */}
                  <span
                    className={`mt-1 h-2.5 w-2.5 rounded-full ${
                      a.severity === "high" ? "bg-red-500" : a.severity === "medium" ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                  />
                  <div className="flex-1">
                    <p className="text-sm">{a.message}</p>
                    <p className="text-xs text-gray-500">{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trend chart: shows data quality over time (two lines) */}
        <section className="rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-4 py-3 flex items-center justify-between">
            <h2 className="font-semibold">Quality Trends</h2>
            <div className="text-xs text-gray-500">Null rate (%) & Freshness (min)</div>
          </div>
          <div className="h-72 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {/* Two metrics on two y-axes so scales don’t fight each other */}
                <Line yAxisId="left"  type="monotone" dataKey="nullRate"     name="Null %"         strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="freshnessMin" name="Freshness (min)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </main>

      <footer className="text-center py-6 text-xs text-gray-500">
        Built for demo speed • Toggle mocks later to hit your FastAPI
      </footer>
    </div>
  );
}

/** Small card component used for the top KPIs (counts) */
function KpiCard({
  title,
  value,
  icon,
  accent,
}: {
  title: string;
  value: number | string;
  icon?: React.ReactNode;
  accent?: "green" | "yellow" | "red";
}) {
  // Color theming for the subtle ring + status dot
  const ring =
    accent === "green" ? "ring-green-200" :
    accent === "yellow" ? "ring-yellow-200" :
    accent === "red" ? "ring-red-200" : "ring-gray-200";

  const dot =
    accent === "green" ? "bg-green-500" :
    accent === "yellow" ? "bg-yellow-500" :
    accent === "red" ? "bg-red-500" : "bg-gray-400";

  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ring-1 ${ring}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="flex items-center gap-2">
          {icon}
          <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        </div>
      </div>
    </div>
  );
}
