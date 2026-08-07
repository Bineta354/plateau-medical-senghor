import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { 
  Users, 
  Calendar, 
  Coins, 
  TrendingUp, 
  Clock, 
  UserCheck,
  Activity,
  FileText,
  Pill,
  Stethoscope,
  Building2,
  BarChart3
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { formatMontant } from '../utils/currency';
import KpiCard from '../components/common/KpiCard';

const StatisticsPage = () => {
  const { currentUser, userProfile } = useAuth();

  const userRole = userProfile?.role || currentUser?.user_metadata?.role || currentUser?.app_metadata?.role;
  const isAccounting = userRole === 'accounting';

  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedDoctor, setSelectedDoctor] = useState('all');
  const [isLoading, setIsLoading] = useState(true);



  

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-medical-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isAccounting ? 'Statistiques Financières' : 'Statistiques du Cabinet'}
          </h1>
          <p className="text-gray-600">
            {isAccounting
              ? "Indicateurs financiers : revenus, dépenses, profit, tendances"
              : "Vue d'ensemble des performances et métriques"}
          </p>
        </div>
        <div className="flex space-x-4">
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
          >
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
            <option value="quarter">Ce trimestre</option>
            <option value="year">Cette année</option>
          </select>
          {!isAccounting && (
            <select 
              value={selectedDoctor} 
              onChange={(e) => setSelectedDoctor(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
            >
              <option value="all">Tous les médecins</option>
              <option value="dr-martin">Dr. Martin</option>
              <option value="dr-bernard">Dr. Bernard</option>
              <option value="dr-dubois">Dr. Dubois</option>
            </select>
          )}
        </div>
      </div>

      {/* Cartes de statistiques principales */}
      {!isAccounting ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          <KpiCard
            icon={Users}
            tone="blue"
            label="Total Patients"
            value={statsData.overview.totalPatients.toLocaleString()}
            hint="+5.2% vs mois dernier"
          />
          <KpiCard
            icon={Calendar}
            tone="green"
            label="Rendez-vous"
            value={statsData.overview.totalAppointments.toLocaleString()}
            hint="+8.7% vs mois dernier"
          />
          <KpiCard
            icon={Coins}
            tone="yellow"
            label="Revenus (FCFA)"
            value={formatMontant(statsData.overview.totalRevenue)}
            hint="+12.3% vs mois dernier"
          />
          <KpiCard
            icon={Clock}
            tone="red"
            label="Temps d'attente (min)"
            value={statsData.overview.averageWaitTime}
            hint="-15.4% vs mois dernier"
          />
          <KpiCard
            icon={UserCheck}
            tone="purple"
            label="Satisfaction (%)"
            value={statsData.overview.satisfactionRate}
            hint="+2.1% vs mois dernier"
          />
          <KpiCard
            icon={Activity}
            label="Taux d'occupation (%)"
            value={statsData.overview.occupancyRate}
            hint="+3.8% vs mois dernier"
            className="rounded-lg p-4 bg-indigo-50 hover:shadow-md"
            iconClassName="text-indigo-600"
            valueClassName="text-indigo-600"
            labelClassName="text-indigo-700"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard
            icon={Coins}
            tone="yellow"
            label="Revenus (FCFA)"
            value={formatMontant(statsData.overview.totalRevenue)}
            hint="+12.3% vs mois dernier"
          />
          <KpiCard
            icon={TrendingUp}
            tone="red"
            label="Dépenses (FCFA)"
            value={formatMontant(statsData.revenueByMonth?.[statsData.revenueByMonth.length - 1]?.expenses || 0)}
            hint="+2.4% vs mois dernier"
          />
          <KpiCard
            icon={TrendingUp}
            tone="green"
            label="Profit (FCFA)"
            value={formatMontant(statsData.revenueByMonth?.[statsData.revenueByMonth.length - 1]?.profit || 0)}
            hint="+6.1% vs mois dernier"
          />
          <KpiCard
            icon={BarChart3}
            tone="blue"
            label="Revenus (mois)"
            value={formatMontant(statsData.revenueByMonth?.[statsData.revenueByMonth.length - 1]?.revenue || 0)}
            hint="+3.2% vs mois dernier"
          />
        </div>
      )}

      {/* Graphiques et tableaux combinés */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {!isAccounting && (
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Rendez-vous par mois</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statsData.appointmentsByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{fontSize: 11}} />
                <YAxis tick={{fontSize: 11}} />
                <Tooltip />
                <Legend wrapperStyle={{fontSize: 11}} />
                <Bar dataKey="consultations" fill="#3B82F6" name="Consultations" />
                <Bar dataKey="emergency" fill="#EF4444" name="Urgences" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Revenus par mois */}
        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Évolution financière</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={statsData.revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{fontSize: 11}} />
              <YAxis tick={{fontSize: 11}} />
              <Tooltip />
              <Legend wrapperStyle={{fontSize: 11}} />
              <Area type="monotone" dataKey="revenue" stackId="1" stroke="#3B82F6" fill="#3B82F6" name="Revenus" />
              <Area type="monotone" dataKey="expenses" stackId="1" stroke="#EF4444" fill="#EF4444" name="Dépenses" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {!isAccounting && (
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Répartition par âge</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statsData.patientsByAge}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ age, percentage }) => `${age}: ${percentage}%`}
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {statsData.patientsByAge.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {!isAccounting && (
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Consultations par spécialité</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statsData.consultationsBySpecialty} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{fontSize: 11}} />
                <YAxis dataKey="specialty" type="category" width={100} tick={{fontSize: 11}} />
                <Tooltip />
                <Bar dataKey="count" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {!isAccounting && (
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Temps d'attente par jour</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={statsData.waitTimeByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{fontSize: 11}} />
                <YAxis tick={{fontSize: 11}} />
                <Tooltip />
                <Legend wrapperStyle={{fontSize: 11}} />
                <Line type="monotone" dataKey="avgWait" stroke="#3B82F6" strokeWidth={2} name="Moyenne (min)" />
                <Line type="monotone" dataKey="maxWait" stroke="#EF4444" strokeWidth={2} name="Maximum (min)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {!isAccounting && (
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Performance des médecins</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Médecin</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patients</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Consultations</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Satisfaction</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {statsData.doctorsPerformance.map((doctor, index) => (
                    <tr key={doctor.id || `doctor-${index}`}>
                      <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">{doctor.name}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{doctor.patients}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{doctor.consultations}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{doctor.satisfaction}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Métriques supplémentaires */}
      {!isAccounting && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Métriques détaillées</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard tone="blue" label="Taux de ponctualité" value="87.3%" />
            <KpiCard tone="green" label="Taux de satisfaction" value="94.2%" />
            <KpiCard tone="yellow" label="Temps d'attente moyen" value="12.5 min" />
            <KpiCard tone="purple" label="Nouveaux patients/mois" value={156} />
          </div>
        </div>
      )}

      {/* Actions rapides */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions rapides</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <FileText className="w-5 h-5 mr-2" />
            Exporter le rapport
          </button>
          <button className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <BarChart3 className="w-5 h-5 mr-2" />
            Générer PDF
          </button>
          <button className="flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            <TrendingUp className="w-5 h-5 mr-2" />
            Prévisions
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatisticsPage;
