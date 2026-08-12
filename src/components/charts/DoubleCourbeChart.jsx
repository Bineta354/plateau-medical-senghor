import React from 'react';
import { ComposedChart, Area, Line, XAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

const DEFAULT_DATA = [
  { label: 'mar', current: 27, previous: 21 },
  { label: 'mer', current: 32, previous: 25 },
  { label: 'jeu', current: 24, previous: 29 },
  { label: 'ven', current: 35, previous: 23 },
  { label: 'sam', current: 14, previous: 18 },
  { label: 'dim', current: 5, previous: 4 },
  { label: 'lun', current: 30, previous: 25 },
];

function CurrentDot({ cx, cy, index, dataLength }) {
  if (index === dataLength - 1) {
    return <circle cx={cx} cy={cy} r={5} fill="#7c3aed" stroke="#fff" strokeWidth={3} />;
  }
  return null;
}

export default function DoubleCourbeChart({
  title = 'Comparaison hebdomadaire',
  value,
  trend = '+16 %',
  currentLabel = 'Cette semaine',
  previousLabel = 'Semaine passée',
  data = DEFAULT_DATA,
}) {
  const total = value ?? data.reduce((sum, d) => sum + d.current, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-6">
      <div className="flex justify-between items-start mb-5">
        <div>
          <p className="m-0 text-[11px] font-semibold tracking-[0.12em] uppercase text-gray-400">{title}</p>
          <p className="mt-1.5 mb-0 text-2xl leading-7 font-bold text-gray-900">
            {total} <span className="text-[13px] font-semibold text-green-600">{trend}</span>
          </p>
        </div>
        <div className="flex flex-col gap-1.5 text-[11px] text-gray-500 items-end">
          <span className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-[3px] rounded"
              style={{ background: 'linear-gradient(90deg,#a78bfa,#7c3aed)' }}
            />
            {currentLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-0 border-t-2 border-dashed" style={{ borderColor: '#c1c5cd' }} />
            {previousLabel}
          </span>
        </div>
      </div>

      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="cmpFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cmpLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#6d28d9" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#f4f5f7" vertical={false} />
            <XAxis dataKey="label" hide />
            <Area
              type="monotone"
              dataKey="current"
              stroke="none"
              fill="url(#cmpFill)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="previous"
              stroke="#c1c5cd"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="current"
              stroke="url(#cmpLine)"
              strokeWidth={3}
              strokeLinecap="round"
              isAnimationActive={false}
              dot={(props) => <CurrentDot key={props.index} {...props} dataLength={data.length} />}
              activeDot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between mt-2.5 text-[10.5px] text-gray-400">
        {data.map((entry, index) => (
          <span key={entry.label} className={index === data.length - 1 ? 'text-purple-600 font-bold' : ''}>
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}
