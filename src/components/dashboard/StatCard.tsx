import React from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';

export interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative';
  icon?: React.ReactNode;
  accentColor?: string;
  bgGlow?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, changeType, icon, accentColor = 'from-purple-500 to-violet-500', bgGlow = 'from-purple-900/10' }) => {
  const isPositive = changeType === 'positive';

  return (
    <div className={`relative overflow-hidden bg-gray-800 border border-gray-700/60 rounded-xl p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-gray-600/80 group`}>
      {/* Top accent gradient bar */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${accentColor}`} />
      {/* Background glow */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${bgGlow} to-transparent rounded-full blur-2xl pointer-events-none opacity-60 group-hover:opacity-80 transition-opacity`} />

      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
          {icon && (
            <div className={`p-2 rounded-lg bg-gradient-to-br ${bgGlow.replace('/10', '/20')} to-transparent border border-gray-700/50`}>
              {icon}
            </div>
          )}
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight">{value}</h2>
        {change && (
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            {isPositive ? (
              <ArrowUpIcon className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <ArrowDownIcon className="w-3.5 h-3.5 text-red-400" />
            )}
            <span className={isPositive ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
              {change}
            </span>
            <span className="text-gray-500">vs last 24h</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;