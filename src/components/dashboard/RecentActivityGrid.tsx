import React from 'react';
import { DocumentTextIcon, BeakerIcon, SparklesIcon, ChartBarIcon } from '@heroicons/react/24/solid';
import { type ApiProject, type ApiGenericItem } from '../../types';

interface RecentActivityGridProps {
  projects: ApiProject[];
  papers: ApiGenericItem[];
  experiments: ApiGenericItem[];
  analyses: ApiGenericItem[];
}

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });

interface RecentBoxProps {
  title: string;
  icon: React.ReactNode;
  accentColor: string;
  dotColor: string;
  items: { label: string; created_at: string }[];
}

const RecentBox: React.FC<RecentBoxProps> = ({ title, icon, accentColor, dotColor, items }) => (
  <div className="relative overflow-hidden bg-gray-800 border border-gray-700/60 rounded-xl shadow-card">
    {/* Top accent bar */}
    <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${accentColor}`} />
    <div className="px-5 py-4 border-b border-gray-700/60">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        {icon}
        {title}
      </h2>
    </div>
    <div className="p-2">
      {items.length === 0 ? (
        <p className="text-gray-500 text-sm p-3">No data found.</p>
      ) : (
        <ul className="divide-y divide-gray-700/40">
          {items.slice(0, 5).map((it, i) => (
            <li key={i} className="flex items-center justify-between gap-4 px-3 py-2.5 rounded-lg hover:bg-gray-700/30 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                <span className="font-medium text-gray-200 truncate text-sm">{it.label}</span>
              </div>
              <span className="text-[11px] text-gray-500 flex-shrink-0">{fmtDateTime(it.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);

const RecentActivityGrid: React.FC<RecentActivityGridProps> = ({ projects, papers, experiments, analyses }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
    <RecentBox
      title="Recent Projects"
      icon={<BeakerIcon className="h-4 w-4 text-cyan-400" />}
      accentColor="from-cyan-500/60 via-cyan-500/30 to-transparent"
      dotColor="bg-cyan-400"
      items={projects.map((p) => ({ label: p.name, created_at: p.created_at }))}
    />
    <RecentBox
      title="Recent Papers"
      icon={<DocumentTextIcon className="h-4 w-4 text-amber-400" />}
      accentColor="from-amber-500/60 via-amber-500/30 to-transparent"
      dotColor="bg-amber-400"
      items={papers.map((p) => ({ label: p.title, created_at: p.created_at }))}
    />
    <RecentBox
      title="Recent Experiments"
      icon={<SparklesIcon className="h-4 w-4 text-violet-400" />}
      accentColor="from-violet-500/60 via-violet-500/30 to-transparent"
      dotColor="bg-violet-400"
      items={experiments.map((e) => ({ label: e.title, created_at: e.created_at }))}
    />
    <RecentBox
      title="Recent Analyses"
      icon={<ChartBarIcon className="h-4 w-4 text-green-400" />}
      accentColor="from-green-500/60 via-green-500/30 to-transparent"
      dotColor="bg-green-400"
      items={analyses.map((a) => ({ label: a.title, created_at: a.created_at }))}
    />
  </div>
);

export default RecentActivityGrid;