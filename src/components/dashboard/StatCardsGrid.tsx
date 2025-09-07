import React from 'react';
import StatCard, { type StatCardProps } from './StatCard';

interface StatCardsGridProps {
  stats: StatCardProps[];
}

const StatCardsGrid: React.FC<StatCardsGridProps> = ({ stats }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
    {stats.map((s) => (
      <StatCard key={s.title} {...s} />
    ))}
  </div>
);

export default StatCardsGrid;