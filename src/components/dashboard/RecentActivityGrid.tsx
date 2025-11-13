import React from 'react';
// NEW: Import the ChartBarIcon for the Analyses card
import { DocumentTextIcon, BeakerIcon, SparklesIcon, ChartBarIcon } from '@heroicons/react/24/solid';
import { type ApiProject, type ApiGenericItem } from '../../types';

// MODIFIED: Props now correctly include `analyses` and remove NFT-related props.
interface RecentActivityGridProps {
  projects: ApiProject[];
  papers: ApiGenericItem[];
  experiments: ApiGenericItem[];
  analyses: ApiGenericItem[];
}

// --- Helpers (Unchanged) ---
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });

// --- Sub-component for recent items (Unchanged) ---
const RecentBox: React.FC<{
  title: string;
  icon: React.ReactNode;
  items: { label: string; created_at: string }[];
}> = ({ title, icon, items }) => (
  <div className="bg-gray-800 p-5 rounded-lg shadow-lg">
    <h2 className="text-xl font-bold flex items-center gap-2 mb-4">{icon}{title}</h2>
    {items.length === 0 ? <p className="text-gray-500">No data found.</p> : (
      <ul className="divide-y divide-gray-700">
        {items.slice(0, 5).map((it, i) => (
          <li key={i} className="py-2 flex justify-between gap-4">
            <span className="font-medium truncate">{it.label}</span>
            <span className="text-xs text-gray-400 flex-shrink-0">{fmtDateTime(it.created_at)}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

// --- Main Grid Component (Updated with 4 cards in a 2x2 layout) ---
const RecentActivityGrid: React.FC<RecentActivityGridProps> = ({ projects, papers, experiments, analyses }) => (
  // MODIFIED: The grid is now 2 columns on medium screens and up for a balanced 2x2 layout.
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
    <RecentBox
      title="Recent Projects"
      icon={<BeakerIcon className="h-5 w-5 text-cyan-400" />}
      items={projects.map((p) => ({ label: p.name, created_at: p.created_at }))}
    />
    <RecentBox
      title="Recent Papers"
      icon={<DocumentTextIcon className="h-5 w-5 text-amber-400" />}
      items={papers.map((p) => ({ label: p.title, created_at: p.created_at }))}
    />
    <RecentBox
      title="Recent Experiments"
      icon={<SparklesIcon className="h-5 w-5 text-violet-400" />}
      items={experiments.map((e) => ({ label: e.title, created_at: e.created_at }))}
    />
    {/* NEW: Added the "Recent Analyses" card */}
    <RecentBox
      title="Recent Analyses"
      icon={<ChartBarIcon className="h-5 w-5 text-green-400" />}
      items={analyses.map((a) => ({ label: a.title, created_at: a.created_at }))}
    />
  </div>
);

export default RecentActivityGrid;