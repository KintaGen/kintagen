// src/components/StatCard.tsx
import React from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';

export interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, changeType }) => {
  const isPositive = changeType === 'positive';

  return (
    <div className="bg-gray-800 p-5 rounded-lg shadow-lg flex flex-col justify-between">
      <div>
        <p className="text-sm font-medium text-gray-400">{title}</p>
        <h2 className="text-3xl font-bold text-white mt-1">{value}</h2>
      </div>
      {change && (
        <div className="mt-4 flex items-center space-x-1 text-sm">
          {isPositive ? (
            <ArrowUpIcon className="w-4 h-4 text-green-500" />
          ) : (
            <ArrowDownIcon className="w-4 h-4 text-red-500" />
          )}
          <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
            {change}
          </span>
          <span className="text-gray-500">vs last 24h</span>
        </div>
      )}
    </div>
  );
};

export default StatCard;