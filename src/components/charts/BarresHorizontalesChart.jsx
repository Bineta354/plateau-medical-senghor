import React from 'react';

const DEFAULT_DATA = [
  { name: 'Dr Mamadou Ndiaye', value: 420000 },
  { name: 'Dr Awa Fall', value: 315000 },
  { name: 'Dr Ibrahima Sarr', value: 288000 },
  { name: 'Dr Khady Diouf', value: 222000 },
  { name: 'Dr Ousmane Bâ', value: 0 },
];

export default function BarresHorizontalesChart({
  title = 'Encaissé par médecin',
  period = "aujourd'hui",
  data = DEFAULT_DATA,
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-6">
      <div className="flex justify-between items-baseline mb-5">
        <p className="m-0 text-[11px] font-semibold tracking-[0.12em] uppercase text-gray-400">{title}</p>
        <span className="text-[11.5px] text-gray-400">{period}</span>
      </div>
      <div className="flex flex-col gap-4">
        {data.map((entry) => {
          const isZero = entry.value === 0;
          const widthPct = isZero ? 2 : Math.max((entry.value / max) * 100, 4);
          return (
            <div key={entry.name}>
              <div className="flex justify-between text-[12.5px] mb-1.5">
                <span className={isZero ? 'font-medium text-gray-400' : 'font-medium text-gray-700'}>
                  {entry.name}
                </span>
                <span className={`font-bold tabular-nums ${isZero ? 'text-gray-400' : 'text-gray-900'}`}>
                  {entry.value.toLocaleString('fr-FR')}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${widthPct}%`,
                    background: isZero ? '#e8eaee' : 'linear-gradient(90deg,#22d3ee,#3b82f6)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
