import React from 'react';
import StatCard, { type StatCardProps } from './StatCard';
import { BeakerIcon, DocumentTextIcon, SparklesIcon, ChartBarIcon } from '@heroicons/react/24/solid';

interface StatCardsGridProps {
  stats: StatCardProps[];
}

// Bespoke icon + color config per stat type
const statConfig = [
  {
    icon: <BeakerIcon className="h-5 w-5 text-purple-400" />,
    accentColor: 'from-purple-500 to-violet-500',
    bgGlow: 'from-purple-900/15',
  },
  {
    icon: <DocumentTextIcon className="h-5 w-5 text-amber-400" />,
    accentColor: 'from-amber-500 to-orange-500',
    bgGlow: 'from-amber-900/15',
  },
  {
    icon: <SparklesIcon className="h-5 w-5 text-violet-400" />,
    accentColor: 'from-violet-500 to-purple-500',
    bgGlow: 'from-violet-900/15',
  },
  {
    icon: <ChartBarIcon className="h-5 w-5 text-green-400" />,
    accentColor: 'from-green-500 to-teal-500',
    bgGlow: 'from-green-900/15',
  },
];

const StatCardsGrid: React.FC<StatCardsGridProps> = ({ stats }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
    {stats.map((s, i) => (
      <StatCard key={s.title} {...s} {...(statConfig[i] ?? {})} />
    ))}
  </div>
);

export default StatCardsGrid;