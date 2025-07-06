/* --------------------------------------------------------------------------
 *  Dashboard.tsx · weekly = last 7 days, monthly = last 30 days, yearly = last 12 months
 * -------------------------------------------------------------------------*/
import React, { useEffect, useState, useMemo } from 'react';
import StatCard, { type StatCardProps } from '../components/StatCard';
import {
  ArrowPathIcon,

  DocumentTextIcon,
  BeakerIcon,
  SparklesIcon,
  ChartBarIcon,
} from '@heroicons/react/24/solid';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  Legend,
} from 'recharts';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const colours = {
  Projects: '#06b6d4',
  Papers: '#f59e0b',
  Experiments: '#8b5cf6',
  Analyses: '#10b981',
} as const;

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

/* ---------- API types ---------- */
interface ApiProject {
  id: number;
  name: string;
  created_at: string;
}
interface ApiGenericItem {
  cid: string;
  title: string;
  created_at: string;
}

/* ----------------------------------------------------------------------- */
const Dashboard: React.FC = () => {
  /* ---- base state ---- */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [papers, setPapers] = useState<ApiGenericItem[]>([]);
  const [experiments, setExperiments] = useState<ApiGenericItem[]>([]);
  const [analyses, setAnalyses] = useState<ApiGenericItem[]>([]);

  /* ---- chart filter ---- */
  type View = 'weekly' | 'monthly' | 'yearly';
  const [view, setView] = useState<View>('monthly');

  /* ---- fetching helpers ---- */
  const getJSON = async <T,>(url: string): Promise<T> => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return r.json();
  };
  const getDataList = async (type: string) =>
    (await getJSON<{ data: ApiGenericItem[] }>(
      `${API_BASE}/data/${type}?limit=1000&sort=created_at&order=DESC`
    )).data;

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        setLoading(true);
        const [prj, pap, exp, ana] = await Promise.all([
          getJSON<ApiProject[]>(`${API_BASE}/projects`),
          getDataList('paper'),
          getDataList('experiment'),
          getDataList('analysis'),
        ]);
        setProjects(prj);
        setPapers(pap);
        setExperiments(exp);
        setAnalyses(ana);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---- stat cards ---- */
  const stats: StatCardProps[] = useMemo(
    () => [
      { title: 'Projects', value: projects.length.toLocaleString() },
      { title: 'Papers', value: papers.length.toLocaleString() },
      { title: 'Experiments', value: experiments.length.toLocaleString() },
      { title: 'Analyses', value: analyses.length.toLocaleString() },
    ],
    [projects, papers, experiments, analyses]
  );

  /* ---- timeline rows (7 days | 30 days | 12 months) ---- */
  const timelineRows = useMemo(() => {
    const now = new Date();

    /* 1️⃣ build label array */
    const labels: string[] = (() => {
      switch (view) {
        case 'weekly': // last 7 days
          return [...Array(7)].map((_, i) => {
            const d = new Date(now);
            d.setDate(d.getDate() - (6 - i));
            return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
          });
        case 'yearly': // last 12 months
          return [...Array(12)].map((_, i) => {
            const d = new Date(now);
            d.setMonth(d.getMonth() - (11 - i));
            return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
          });
        default: // monthly view = last 30 days
          return [...Array(30)].map((_, i) => {
            const d = new Date(now);
            d.setDate(d.getDate() - (29 - i));
            return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
          });
      }
    })();

    /* 2️⃣ bucket function */
    const bucketLabel = (d: Date): string => {
      switch (view) {
        case 'weekly':
        case 'monthly':
          return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
        case 'yearly':
          return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      }
    };

    /* 3️⃣ template map */
    const template = labels.reduce(
      (acc, l) => ({
        ...acc,
        [l]: { Projects: 0, Papers: 0, Experiments: 0, Analyses: 0 },
      }),
      {} as Record<string, Record<string, number>>
    );

    const bump = (arr: { created_at: string }[], key: keyof typeof colours) => {
      arr.forEach(({ created_at }) => {
        const lab = bucketLabel(new Date(created_at));
        if (template[lab]) template[lab][key] += 1;
      });
    };

    bump(projects, 'Projects');
    bump(papers, 'Papers');
    bump(experiments, 'Experiments');
    bump(analyses, 'Analyses');

    return labels.map((lab) => ({ label: lab, ...template[lab] }));
  }, [view, projects, papers, experiments, analyses]);

  const barRows = Object.entries({
    Projects: projects.length,
    Papers: papers.length,
    Experiments: experiments.length,
    Analyses: analyses.length,
  }).map(([name, total]) => ({ name, total }));



  /* ---------------- RENDER ---------------- */
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Network Cortex Overview</h1>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 mb-6">
          <ArrowPathIcon className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <p className="text-red-400 mb-6">Error: {error}</p>
      ) : (
        <>
          {/* stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((s) => (
              <StatCard key={s.title} {...s} />
            ))}
          </div>

          {/* recent lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-6 mb-10">
            <RecentBox
              title="Recent Projects"
              icon={<BeakerIcon className="h-5 w-5 text-cyan-400" />}
              items={projects.map((p) => ({
                label: p.name,
                created_at: p.created_at,
              }))}
            />
            <RecentBox
              title="Recent Papers"
              icon={<DocumentTextIcon className="h-5 w-5 text-amber-400" />}
              items={papers.map((p) => ({
                label: p.title,
                created_at: p.created_at,
              }))}
            />
            <RecentBox
              title="Recent Experiments"
              icon={<SparklesIcon className="h-5 w-5 text-violet-400" />}
              items={experiments.map((e) => ({
                label: e.title,
                created_at: e.created_at,
              }))}
            />
            <RecentBox
              title="Recent Analyses"
              icon={<ChartBarIcon className="h-5 w-5 text-emerald-400" />}
              items={analyses.map((a) => ({
                label: a.title,
                created_at: a.created_at,
              }))}
            />
          </div>

          {/* view selector */}
          <div className="flex items-center justify-end mb-2 gap-3">
            <label htmlFor="view" className="text-sm text-gray-400">
              Range:
            </label>
            <select
              id="view"
              value={view}
              onChange={(e) => setView(e.target.value as View)}
              className="bg-gray-700 text-gray-100 px-3 py-1 rounded-md text-sm"
            >
              <option value="weekly">Last 7 Days</option>
              <option value="monthly">Last 30 Days</option>
              <option value="yearly">Last 12 Months</option>
            </select>
          </div>

          {/* charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            <ChartWrapper title="Record Additions">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={timelineRows}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  {(Object.keys(colours) as Array<keyof typeof colours>).map(
                    (key) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={colours[key]}
                        strokeWidth={2}
                        dot={false}
                      />
                    )
                  )}
                </LineChart>
              </ResponsiveContainer>
            </ChartWrapper>

            <ChartWrapper title="Total Records by Type">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barRows}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total">
                    {barRows.map((r) => (
                      <Cell
                        key={r.name}
                        fill={colours[r.name as keyof typeof colours]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </div>
        </>
      )}
    </div>
  );
};

/* --- RecentBox --- */
const RecentBox: React.FC<{
  title: string;
  icon: React.ReactNode;
  items: { label: string; created_at: string }[];
}> = ({ title, icon, items }) => (
  <div className="bg-gray-800 p-5 rounded-lg shadow-lg">
    <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
      {icon}
      {title}
    </h2>
    {items.length === 0 ? (
      <p className="text-gray-500">No data found.</p>
    ) : (
      <ul className="divide-y divide-gray-700">
        {items.slice(0, 5).map((it, i) => (
          <li key={i} className="py-2 flex justify-between">
            <span className="font-medium truncate">{it.label}</span>
            <span className="text-xs text-gray-400">
              {fmtDateTime(it.created_at)}
            </span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

/* --- ChartWrapper --- */
const ChartWrapper: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="bg-gray-800 p-5 rounded-lg shadow-lg">
    <h2 className="text-xl font-bold mb-4">{title}</h2>
    {children}
  </div>
);

export default Dashboard;
