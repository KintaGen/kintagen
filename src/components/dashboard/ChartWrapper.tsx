import React from 'react';

const ChartWrapper: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-gray-800 border border-gray-700/60 rounded-xl shadow-card overflow-hidden">
    {/* Header with gradient strip */}
    <div className="relative px-5 py-4 border-b border-gray-700/60">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500/60 via-violet-500/40 to-transparent" />
      <h2 className="text-base font-semibold text-white">{title}</h2>
    </div>
    <div className="p-5">
      {children}
    </div>
  </div>
);

export default ChartWrapper;