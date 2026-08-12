import React from 'react';
import {
  BarresVerticalesChart,
  AireCourbeChart,
  DonutEffectifsChart,
  JaugeRecouvrementChart,
  BarresHorizontalesChart,
  DoubleCourbeChart,
  BarresEmpileesChart,
} from '../../components/charts';

/**
 * Page de test isolée pour la bibliothèque de graphiques (recharts),
 * reproduisant les 7 composants du mockup "Composants Graphiques".
 */
const TestGraphiques = () => {
  return (
    <div className="min-h-screen" style={{ background: '#eceae5' }}>
      <div className="max-w-[1220px] mx-auto px-10 py-10">
        <div className="flex items-baseline gap-2.5 mb-3.5">
          <span className="font-semibold text-[10px] px-1.5 py-1 bg-gray-900 text-white rounded">
            GRAPHES
          </span>
          <span className="font-semibold text-[13px] text-gray-900">
            Composants graphiques dégradés — barres, donut, courbes
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <BarresVerticalesChart />
          <AireCourbeChart />
          <DonutEffectifsChart />
          <JaugeRecouvrementChart />
          <BarresHorizontalesChart />
          <DoubleCourbeChart />
          <BarresEmpileesChart />
        </div>
      </div>
    </div>
  );
};

export default TestGraphiques;
