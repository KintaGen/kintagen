import React from 'react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const colours = { Projects: '#06b6d4', Papers: '#f59e0b', Experiments: '#8b5cf6', Analyses: '#10b981' };
interface ChartData { label: string; [key: string]: any; }

const AdditionsChart: React.FC<{ data: ChartData[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={260}>
    <LineChart data={data}>
      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} stroke="#4A5568" />
      <XAxis dataKey="label" stroke="#A0AEC0" fontSize={12} />
      <YAxis allowDecimals={false} stroke="#A0AEC0" fontSize={12} />
      <Tooltip contentStyle={{ backgroundColor: '#2D3748', borderColor: '#4A5568', borderRadius: '0.5rem' }} labelStyle={{ color: '#E2E8F0' }} />
      <Legend wrapperStyle={{ fontSize: '14px' }} />
      {(Object.keys(colours) as Array<keyof typeof colours>).map((key) => (
        <Line key={key} type="monotone" dataKey={key} stroke={colours[key]} strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
      ))}
    </LineChart>
  </ResponsiveContainer>
);

export default AdditionsChart;