import React from 'react';
import { type View } from '../../types';

interface DateRangeSelectorProps {
  view: View;
  onViewChange: (view: View) => void;
}

const views: { value: View; label: string }[] = [
  { value: 'weekly', label: 'Last 7 Days' },
  { value: 'monthly', label: 'Last 30 Days' },
  { value: 'yearly', label: 'Last 12 Months' },
];

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({ view, onViewChange }) => (
  <div className="flex items-center justify-end mb-4 gap-2">
    <span className="text-xs text-gray-500 font-medium mr-1">Range:</span>
    <div className="flex items-center gap-1 bg-gray-800/80 border border-gray-700/60 rounded-lg p-1">
      {views.map((v) => (
        <button
          key={v.value}
          onClick={() => onViewChange(v.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${view === v.value
              ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
            }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  </div>
);

export default DateRangeSelector;