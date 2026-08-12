import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer } from 'recharts';

const DEFAULT_DATA = [
  { label: 'mar 04', termine: 30, attente: 10, annule: 4 },
  { label: 'mer 05', termine: 35, attente: 9, annule: 4 },
  { label: 'jeu 06', termine: 24, attente: 10, annule: 4 },
  { label: 'ven 07', termine: 39, attente: 8, annule: 3 },
  { label: 'sam 08', termine: 15, attente: 5, annule: 3 },
  { label: 'dim 09', termine: 1, attente: 0, annule: 0, closed: true },
  { label: 'lun 10', termine: 31, attente: 9, annule: 2 },
];

const LEGEND = [
  { key: 'termine', name: 'Terminé', from: '#6ee7b7', to: '#059669' },
  { key: 'attente', name: 'En attente', from: '#fcd34d', to: '#d97706' },
  { key: 'annule', name: 'Annulé', from: '#fca5a5', to: '#dc2626' },
];

export default function BarresEmpileesChart({
  title = 'Rendez-vous par statut',
  value = '294',
  unit = 'sur 7 jours',
  data = DEFAULT_DATA,
}) {
  const max = Math.max(...data.map((d) => d.termine + d.attente + d.annule), 1);
  const domainMax = Math.ceil((max * 1.15) / 10) * 10 || 10;

  return (
    <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-6 md:col-span-2">
      <div className="flex justify-between items-start mb-5">
        <div>
          <p className="m-0 text-[11px] font-semibold tracking-[0.12em] uppercase text-gray-400">{title}</p>
          <p className="mt-1.5 mb-0 text-2xl leading-7 font-bold text-gray-900">
            {value} <span className="text-[13px] font-semibold text-gray-400">{unit}</span>
          </p>
        </div>
        <div className="flex gap-4 text-[11.5px] text-gray-500">
          {LEGEND.map((entry) => (
            <span key={entry.key} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-[3px]"
                style={{ background: `linear-gradient(135deg, ${entry.from}, ${entry.to})` }}
              />
              {entry.name}
            </span>
          ))}
        </div>
      </div>

      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap="22%">
            <defs>
              <linearGradient id="stackTermine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6ee7b7" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
              <linearGradient id="stackAttente" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fcd34d" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
              <linearGradient id="stackAnnule" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fca5a5" />
                <stop offset="100%" stopColor="#dc2626" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#f4f5f7" vertical={false} />
            <XAxis dataKey="label" hide />
            <YAxis
              domain={[0, domainMax]}
              tickCount={6}
              tick={{ fontSize: 10.5, fill: '#c1c5cd' }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Bar dataKey="termine" stackId="rdv" fill="url(#stackTermine)" radius={[0, 0, 4, 4]} maxBarSize={40} isAnimationActive={false}>
              {data.map((entry) => (
                <Cell key={entry.label} fill={entry.closed ? '#e8eaee' : 'url(#stackTermine)'} />
              ))}
            </Bar>
            <Bar dataKey="attente" stackId="rdv" fill="url(#stackAttente)" maxBarSize={40} isAnimationActive={false}>
              {data.map((entry) => (
                <Cell key={entry.label} fill={entry.closed ? 'transparent' : 'url(#stackAttente)'} />
              ))}
            </Bar>
            <Bar dataKey="annule" stackId="rdv" fill="url(#stackAnnule)" radius={[8, 8, 0, 0]} maxBarSize={40} isAnimationActive={false}>
              {data.map((entry) => (
                <Cell key={entry.label} fill={entry.closed ? 'transparent' : 'url(#stackAnnule)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between gap-6 mt-2.5 text-center">
        {data.map((entry, index) => (
          <span
            key={entry.label}
            className={`flex-1 text-[10.5px] ${index === data.length - 1 ? 'text-gray-900 font-bold' : 'text-gray-400'}`}
          >
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}
