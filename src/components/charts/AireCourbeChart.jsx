import React from 'react';
import { ComposedChart, Area, Line, XAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

const DEFAULT_DATA = [
  { label: 'mar 04', value: 27 },
  { label: 'mer 05', value: 32 },
  { label: 'jeu 06', value: 24 },
  { label: 'ven 07', value: 35 },
  { label: 'sam 08', value: 14 },
  { label: 'dim 09', value: 5 },
  { label: 'lun 10', value: 30 },
];

function CustomDot({ cx, cy, index, dataLength, peakIndex }) {
  if (index === dataLength - 1) {
    return <circle cx={cx} cy={cy} r={5} fill="#3b82f6" stroke="#fff" strokeWidth={3} />;
  }
  if (index === peakIndex) {
    return <circle cx={cx} cy={cy} r={4} fill="#fff" stroke="#3b82f6" strokeWidth={2.5} />;
  }
  return null;
}

export default function AireCourbeChart({
  title = 'Consultations terminées',
  value,
  unit = 'sur 7 jours',
  badge,
  data = DEFAULT_DATA,
}) {
  const total = value ?? data.reduce((sum, d) => sum + d.value, 0);
  const average = Math.round(total / data.length);
  const peakIndex = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);

  return (
    <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-6">
      <div className="flex justify-between items-start mb-5">
        <div>
          <p className="m-0 text-[11px] font-semibold tracking-[0.12em] uppercase text-gray-400">{title}</p>
          <p className="mt-1.5 mb-0 text-2xl leading-7 font-bold text-gray-900">
            {total} <span className="text-[13px] font-semibold text-gray-400">{unit}</span>
          </p>
        </div>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-[11.5px] font-semibold">
          {badge ?? `Ø ${average} / jour`}
        </span>
      </div>

      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.34} />
                <stop offset="60%" stopColor="#3b82f6" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="areaLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="55%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#f4f5f7" vertical={false} />
            <XAxis dataKey="label" hide />
            <Area
              type="monotone"
              dataKey="value"
              stroke="none"
              fill="url(#areaFill)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="url(#areaLine)"
              strokeWidth={3}
              strokeLinecap="round"
              isAnimationActive={false}
              dot={(props) => (
                <CustomDot key={props.index} {...props} dataLength={data.length} peakIndex={peakIndex} />
              )}
              activeDot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between mt-2.5 text-[10.5px] text-gray-400">
        {data.map((entry, index) => (
          <span key={entry.label} className={index === data.length - 1 ? 'text-blue-600 font-bold' : ''}>
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}
