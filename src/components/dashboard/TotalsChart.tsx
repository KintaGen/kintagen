import React from 'react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Cell } from 'recharts';

const colours = { Projects: '#06b6d4', Papers: '#f59e0b', Experiments: '#8b5cf6', Analyses: '#10b981' };
interface ChartData { name: string; total: number; }

const TotalsChart: React.FC<{ data: ChartData[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={260}>
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} stroke="#4A5568" />
      <XAxis dataKey="name" stroke="#A0AEC0" fontSize={12} />
      <YAxis allowDecimals={false} stroke="#A0AEC0" fontSize={12} />
      <Tooltip contentStyle={{ backgroundColor: '#2D3748', borderColor: '#4A5568', borderRadius: '0.5rem' }} labelStyle={{ color: '#E2E8F0' }} cursor={{ fill: 'rgba(113, 128, 150, 0.1)' }} />
      <Legend wrapperStyle={{ fontSize: '14px' }} />
      <Bar dataKey="total">
        {data.map((entry) => (
          <Cell key={`cell-${entry.name}`} fill={colours[entry.name as keyof typeof colours]} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

export default TotalsChart;