import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart, LineChart, PieChart, TrendingUp, Users, Clock, Calendar, Activity } from 'lucide-react';
import KpiCard from '../../components/common/KpiCard';

const StatistiquesRealtime = () => {
  const [statistiques, setStatistiques] = useState([]);
  const [medecins, setMedecins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedecin, setSelectedMedecin] = useState('');
  const [periode, setPeriode] = useState('aujourd_hui');
  const [statsGlobales, setStatsGlobales] = useState({
    totalPatients: 0,
    totalConsultations: 0,
    tempsAttenteMoyen: 0,
    tauxOccupation: 0
  });

  useEffect(() => {
    fetchData();
    setupRealtimeSubscription();
  }, [selectedMedecin, periode]);

  const setupRealtimeSubscription = () => {
    const channel = supabase.channel('statistiques_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'statistiques_realtime'
      }, (payload) => {
        console.log('Changement statistiques:', payload);
        fetchStatistiques();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchStatistiques(),
        fetchMedecins(),
        fetchStatsGlobales()
      ]);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistiques = async () => {
    try {
      let query = supabase
        .from('statistiques_realtime')
        .select('*')
        .order('date_statistique', { ascending: false });

      if (selectedMedecin) {
        query = query.eq('medecin_id', selectedMedecin);
      }

      if (periode === 'aujourd_hui') {
        query = query.eq('date_statistique', new Date().toISOString().split('T')[0]);
      } else if (periode === 'semaine') {
        const dateLimite = new Date();
        dateLimite.setDate(dateLimite.getDate() - 7);
        query = query.gte('date_statistique', dateLimite.toISOString().split('T')[0]);
      } else if (periode === 'mois') {
        const dateLimite = new Date();
        dateLimite.setMonth(dateLimite.getMonth() - 1);
        query = query.gte('date_statistique', dateLimite.toISOString().split('T')[0]);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStatistiques(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    }
  };

  const fetchMedecins = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, nom, prenom, specialite')
        .eq('role', 'doctor')
        .eq('actif', true)
        .order('nom');

      if (error) throw error;
      setMedecins(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des médecins:', error);
    }
  };

  const fetchStatsGlobales = async () => {
    try {
      // Récupérer les statistiques globales
      const [patientsData, consultationsData, waitingQueueData] = await Promise.all([
        supabase.from('patients').select('id', { count: 'exact' }),
        supabase.from('consultations').select('id', { count: 'exact' }),
        supabase.from('waiting_queue').select('*')
      ]);

      const totalPatients = patientsData.count || 0;
      const totalConsultations = consultationsData.count || 0;
      
      // Calculer le temps d'attente moyen
      const tempsAttenteTotal = waitingQueueData.data?.reduce((acc, queue) => {
        if (queue.temps_attente_estime) {
          const tempsMinutes = parseInt(queue.temps_attente_estime);
          return acc + tempsMinutes;
        }
        return acc;
      }, 0) || 0;
      
      const tempsAttenteMoyen = waitingQueueData.data?.length > 0 
        ? Math.round(tempsAttenteTotal / waitingQueueData.data.length) 
        : 0;

      // Calculer le taux d'occupation (simulation)
      const tauxOccupation = Math.round((totalConsultations / Math.max(totalPatients, 1)) * 100);

      setStatsGlobales({
        totalPatients,
        totalConsultations,
        tempsAttenteMoyen,
        tauxOccupation
      });
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques globales:', error);
    }
  };

  const formatInterval = (interval) => {
    if (!interval) return '0 min';
    const minutes = parseInt(interval);
    if (minutes < 60) return `${minutes} min`;
    const heures = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${heures}h${mins > 0 ? ` ${mins}min` : ''}`;
  };

  const getMedecinName = (medecinId) => {
    const medecin = medecins.find(m => m.id === medecinId);
    return medecin ? `${medecin.nom} ${medecin.prenom}` : 'Médecin inconnu';
  };

  const getSpecialite = (medecinId) => {
    const medecin = medecins.find(m => m.id === medecinId);
    return medecin?.specialite || 'Non spécifiée';
  };

  const generateChartData = () => {
    const labels = statistiques.map(stat => 
      new Date(stat.date_statistique).toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit' 
      })
    ).reverse();

    const patientsData = statistiques.map(stat => stat.nombre_patients_vus).reverse();
    const urgencesData = statistiques.map(stat => stat.nombre_urgences).reverse();
    const documentsData = statistiques.map(stat => stat.nombre_documents_scannes).reverse();

    return { labels, patientsData, urgencesData, documentsData };
  };

  const generatePieChartData = () => {
    const totalPatients = statistiques.reduce((acc, stat) => acc + stat.nombre_patients_vus, 0);
    const totalUrgences = statistiques.reduce((acc, stat) => acc + stat.nombre_urgences, 0);
    const totalDocuments = statistiques.reduce((acc, stat) => acc + stat.nombre_documents_scannes, 0);

    return [
      { name: 'Consultations normales', value: totalPatients - totalUrgences, color: '#3B82F6' },
      { name: 'Urgences', value: totalUrgences, color: '#EF4444' },
      { name: 'Documents scannés', value: totalDocuments, color: '#10B981' }
    ];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  const { labels, patientsData, urgencesData, documentsData } = generateChartData();
  const pieChartData = generatePieChartData();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Statistiques Temps Réel</h1>
        <p className="text-gray-600">Suivi des performances et métriques du cabinet</p>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Médecin
              </label>
              <select
                value={selectedMedecin}
                onChange={(e) => setSelectedMedecin(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              >
                <option value="">Tous les médecins</option>
                {medecins.map(medecin => (
                  <option key={medecin.id} value={medecin.id}>
                    {medecin.nom} {medecin.prenom} ({medecin.specialite})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Période
              </label>
              <select
                value={periode}
                onChange={(e) => setPeriode(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              >
                <option value="aujourd_hui">Aujourd'hui</option>
                <option value="semaine">7 derniers jours</option>
                <option value="mois">30 derniers jours</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Actualiser
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <KpiCard icon={Users} tone="blue" label="Total Patients" value={statsGlobales.totalPatients} />

        <KpiCard icon={Calendar} tone="green" label="Consultations" value={statsGlobales.totalConsultations} />

        <KpiCard icon={Clock} tone="yellow" label="Temps d'attente moyen" value={`${statsGlobales.tempsAttenteMoyen} min`} />

        <KpiCard icon={Activity} tone="purple" label="Taux d'occupation" value={`${statsGlobales.tauxOccupation}%`} />
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Graphique en barres - Patients vus */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Patients vus par jour</h3>
          <div className="h-64 flex items-end justify-center space-x-2">
            {patientsData.length > 0 ? (
              patientsData.map((value, index) => (
                <div key={`patients-${index}`} className="flex flex-col items-center">
                  <div 
                    className="bg-blue-500 rounded-t w-8 transition-all duration-300 hover:bg-blue-600"
                    style={{ height: `${(value / Math.max(...patientsData)) * 200}px` }}
                    title={`${value} patients`}
                  ></div>
                  <span className="text-xs text-gray-500 mt-1">{labels[index]}</span>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-center">
                <BarChart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Aucune donnée disponible</p>
              </div>
            )}
          </div>
        </div>

        {/* Graphique en ligne - Urgences */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Urgences par jour</h3>
          <div className="h-64 flex items-end justify-center space-x-2">
            {urgencesData.length > 0 ? (
              urgencesData.map((value, index) => (
                <div key={`urgences-${index}`} className="flex flex-col items-center">
                  <div 
                    className="bg-red-500 rounded-t w-8 transition-all duration-300 hover:bg-red-600"
                    style={{ height: `${(value / Math.max(...urgencesData, 1)) * 200}px` }}
                    title={`${value} urgences`}
                  ></div>
                  <span className="text-xs text-gray-500 mt-1">{labels[index]}</span>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-center">
                <LineChart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Aucune donnée disponible</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Graphique circulaire */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Répartition des activités</h3>
        <div className="flex flex-col lg:flex-row items-center justify-center">
          <div className="w-64 h-64 relative mb-6 lg:mb-0">
            {pieChartData.some(item => item.value > 0) ? (
              <svg className="w-full h-full" viewBox="0 0 100 100">
                {pieChartData.map((item, index) => {
                  const total = pieChartData.reduce((acc, d) => acc + d.value, 0);
                  const percentage = total > 0 ? (item.value / total) * 100 : 0;
                  const angle = (percentage / 100) * 360;
                  const radius = 40;
                  const circumference = 2 * Math.PI * radius;
                  const strokeDasharray = (percentage / 100) * circumference;
                  
                  return (
                    <circle
                      key={`pie-${index}`}
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="none"
                      stroke={item.color}
                      strokeWidth="8"
                      strokeDasharray={`${strokeDasharray} ${circumference}`}
                      strokeDashoffset={index === 0 ? 0 : -circumference * (index * 0.25)}
                      transform="rotate(-90 50 50)"
                    />
                  );
                })}
              </svg>
            ) : (
              <div className="text-gray-500 text-center">
                <PieChart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Aucune donnée disponible</p>
              </div>
            )}
          </div>
          
          <div className="lg:ml-8 space-y-2">
            {pieChartData.map((item, index) => (
              <div key={`legend-${index}`} className="flex items-center">
                <div 
                  className="w-4 h-4 rounded-full mr-2"
                  style={{ backgroundColor: item.color }}
                ></div>
                <span className="text-sm text-gray-600">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tableau détaillé */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Détail par médecin</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Médecin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Spécialité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patients vus
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Urgences
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Documents scannés
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Temps moyen consultation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Temps d'attente moyen
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {statistiques.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                    Aucune statistique disponible pour cette période
                  </td>
                </tr>
              ) : (
                statistiques.map((stat) => (
                  <tr key={stat.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {getMedecinName(stat.medecin_id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getSpecialite(stat.medecin_id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {stat.nombre_patients_vus}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {stat.nombre_urgences}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {stat.nombre_documents_scannes}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatInterval(stat.temps_moyen_consultation)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatInterval(stat.temps_attente_moyen)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StatistiquesRealtime;
