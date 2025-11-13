import React from 'react';
import { type View } from '../../types';

interface DateRangeSelectorProps {
  view: View;
  onViewChange: (view: View) => void;
}

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({ view, onViewChange }) => (
  <div className="flex items-center justify-end mb-2 gap-3">
    <label htmlFor="view" className="text-sm text-gray-400">Range:</label>
    <select
      id="view"
      value={view}
      onChange={(e) => onViewChange(e.target.value as View)}
      className="bg-gray-700 text-gray-100 px-3 py-1 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="weekly">Last 7 Days</option>
      <option value="monthly">Last 30 Days</option>
      <option value="yearly">Last 12 Months</option>
    </select>
  </div>
);

export default DateRangeSelector;