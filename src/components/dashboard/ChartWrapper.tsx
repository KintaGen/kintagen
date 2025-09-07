import React from 'react';

const ChartWrapper: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-gray-800 p-5 rounded-lg shadow-lg">
    <h2 className="text-xl font-bold mb-4">{title}</h2>
    {children}
  </div>
);

export default ChartWrapper;