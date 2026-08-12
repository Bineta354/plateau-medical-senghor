import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

const DEFAULT_DATA = [
  { label: 'mar 04', value: 981000 },
  { label: 'mer 05', value: 1120000 },
  { label: 'jeu 06', value: 875000 },
  { label: 'ven 07', value: 1341000 },
  { label: 'sam 08', value: 640000 },
  { label: 'dim 09', value: 25000, closed: true },
  { label: 'lun 10', value: 1245000, highlight: true },
];

function formatCompact(value) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1).replace('.', ',').replace(',0', '')} M`;
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)} k`;
  }
  return `${value}`;
}

export default function BarresVerticalesChart({
  title = 'Encaissements',
  value = '6 200 000',
  unit = 'FCFA',
  trend,
  data = DEFAULT_DATA,
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const domainMax = Math.ceil((max * 1.3) / 400000) * 400000 || 400000;

  return (
    <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-6">
      <div className="flex justify-between items-start mb-5">
        <div>
          <p className="m-0 text-[11px] font-semibold tracking-[0.12em] uppercase text-gray-400">{title}</p>
          <p className="mt-1.5 mb-0 text-2xl leading-7 font-bold text-gray-900">
            {value} <span className="text-[13px] font-semibold text-gray-400">{unit}</span>
          </p>
        </div>
        {trend && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-[11.5px] font-semibold">
            <TrendingUp className="w-[13px] h-[13px]" />
            {trend}
          </span>
        )}
      </div>

      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap="18%">
            <defs>
              <linearGradient id="barBlueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#67e8f9" />
                <stop offset="30%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="barGreenGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a7f3d0" />
                <stop offset="30%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#f4f5f7" vertical={false} />
            <XAxis dataKey="label" hide />
            <YAxis
              domain={[0, domainMax]}
              tickCount={5}
              tickFormatter={formatCompact}
              tick={{ fontSize: 10.5, fill: '#c1c5cd' }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Bar dataKey="value" isAnimationActive={false} radius={[8, 8, 3, 3]} maxBarSize={48}>
              {data.map((entry, index) => (
                <Cell
                  key={entry.label}
                  fill={
                    entry.closed
                      ? '#e8eaee'
                      : entry.highlight
                        ? 'url(#barGreenGradient)'
                        : 'url(#barBlueGradient)'
                  }
                  radius={entry.closed ? [3, 3, 3, 3] : [8, 8, 3, 3]}
                  style={
                    entry.highlight
                      ? { filter: 'drop-shadow(0 6px 10px rgba(5,150,105,.28))' }
                      : undefined
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between gap-3 mt-2.5 text-center">
        {data.map((entry) => (
          <span
            key={entry.label}
            className={`flex-1 text-[10.5px] ${entry.highlight ? 'text-green-600 font-bold' : 'text-gray-400'}`}
          >
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}
