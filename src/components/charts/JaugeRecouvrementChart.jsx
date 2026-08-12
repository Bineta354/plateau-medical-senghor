import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function JaugeRecouvrementChart({
  title = 'Taux de recouvrement',
  percent = 76,
  objectif = 85,
  encaisse = 12350000,
  reste = 3872500,
  periode = 'Sur les 30 derniers jours',
  factures = 31,
}) {
  const gaugeData = [
    { name: 'value', value: percent },
    { name: 'rest', value: 100 - percent },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-6 flex flex-col">
      <p className="m-0 text-[11px] font-semibold tracking-[0.12em] uppercase text-gray-400">{title}</p>
      <div className="flex-1 flex items-center gap-7 mt-2">
        <div className="relative flex-shrink-0" style={{ width: 240, height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="45%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
              </defs>
              <Pie
                data={gaugeData}
                dataKey="value"
                cx="50%"
                cy="82%"
                startAngle={180}
                endAngle={0}
                innerRadius={78}
                outerRadius={98}
                cornerRadius={10}
                stroke="none"
                isAnimationActive={false}
              >
                <Cell fill="url(#gaugeGradient)" />
                <Cell fill="#f4f5f7" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute left-0 right-0 text-center" style={{ top: 58 }}>
            <span className="text-[34px] leading-9 font-bold text-gray-900">
              {percent}
              <span className="text-lg">%</span>
            </span>
            <p className="mt-0.5 mb-0 text-[11px] text-gray-400">objectif {objectif} %</p>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-3.5">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-600">Encaissé</span>
              <span className="font-bold text-gray-900">{encaisse.toLocaleString('fr-FR')}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${percent}%`, background: 'linear-gradient(90deg,#34d399,#059669)' }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-600">Reste à recouvrer</span>
              <span className="font-bold text-gray-900">{reste.toLocaleString('fr-FR')}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${100 - percent}%`, background: 'linear-gradient(90deg,#fca5a5,#dc2626)' }}
              />
            </div>
          </div>
          <p className="m-0 text-[11.5px] text-gray-400">
            {periode} · {factures} factures ouvertes
          </p>
        </div>
      </div>
    </div>
  );
}
