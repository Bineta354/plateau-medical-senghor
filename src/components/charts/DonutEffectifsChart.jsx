import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const DEFAULT_DATA = [
  { key: 'medecins', name: 'Médecins', value: 6, from: '#93c5fd', to: '#1d4ed8' },
  { key: 'secretaires', name: 'Secrétaires', value: 4, from: '#6ee7b7', to: '#047857' },
  { key: 'caissiers', name: 'Caissiers', value: 3, from: '#fdba74', to: '#c2410c' },
  { key: 'comptables', name: 'Comptables', value: 2, from: '#d8b4fe', to: '#7c3aed' },
  { key: 'administrateurs', name: 'Administrateurs', value: 2, from: '#fca5a5', to: '#dc2626' },
];

export default function DonutEffectifsChart({
  title = 'Répartition des effectifs',
  centerLabel = 'comptes',
  data = DEFAULT_DATA,
  headerRight,
  footer,
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-6">
      <div className="flex items-center justify-between mb-1">
        <p className="m-0 text-[11px] font-semibold tracking-[0.12em] uppercase text-gray-400">{title}</p>
        {headerRight && <span className="text-[12.5px] text-gray-400">{headerRight}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <div className="relative flex-shrink-0 mx-auto" style={{ width: 180, height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                {data.map((entry) => (
                  <linearGradient key={entry.key} id={`donut-${entry.key}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={entry.from} />
                    <stop offset="100%" stopColor={entry.to} />
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={82}
                startAngle={90}
                endAngle={-270}
                stroke="none"
                isAnimationActive={false}
              >
                {data.map((entry) => (
                  <Cell key={entry.key} fill={`url(#donut-${entry.key})`} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[30px] leading-8 font-bold text-gray-900">{total}</span>
            <span className="mt-0.5 text-[10.5px] font-semibold tracking-[0.1em] uppercase text-gray-400">
              {centerLabel}
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-[180px] flex flex-col gap-2.5">
          {data.map((entry) => (
            <div key={entry.key} className="flex items-start justify-between gap-2">
              <span className="flex items-start gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-[3px] mt-1 flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${entry.from}, ${entry.to})` }}
                />
                <span className="text-gray-600 text-[12.5px] leading-tight">{entry.name}</span>
              </span>
              <span className="flex items-center gap-2 flex-shrink-0">
                <span className="font-bold tabular-nums text-gray-900">{entry.value}</span>
                <span className="w-8 text-right text-[11.5px] text-gray-400">
                  {Math.round((entry.value / total) * 100)}%
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
      {footer && (
        <div className="mt-4 pt-4 border-t border-gray-100 text-[12.5px] text-gray-400">{footer}</div>
      )}
    </div>
  );
}
