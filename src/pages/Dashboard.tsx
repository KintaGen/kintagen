// src/pages/Dashboard.tsx
import React from 'react';
import StatCard, { type StatCardProps } from '../components/StatCard';

const Dashboard: React.FC = () => {
  const stats: StatCardProps[] = [
    { title: 'Active Agents (MCP)', value: '1,284', change: '2.1%', changeType: 'positive' },
    { title: 'Knowledge Graph Facts', value: '14.8M', change: '12,450', changeType: 'positive' },
    { title: 'Storage Utilized (Filecoin)', value: '45.2 TB' },
    { title: 'Avg. Query Time', value: '1.2s', change: '0.2s', changeType: 'negative' },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Network Cortex Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            change={stat.change}
            changeType={stat.changeType}
          />
        ))}
      </div>

      <div className="mt-8">
        <div className="bg-gray-800 p-5 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold">Future Widget Area</h2>
            <p className="text-gray-400 mt-2">Charts and live feeds will go here.</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;