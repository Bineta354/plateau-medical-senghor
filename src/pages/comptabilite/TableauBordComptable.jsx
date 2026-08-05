import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Coins, Calendar, Users, 
  Activity, AlertCircle, Download, Filter, RefreshCw,
  Clock, CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';
import { formatMontant } from '../../utils/currency';

const TableauBordComptable = () => {
  const [periode, setPeriode] = useState('mois');
  const [loading, setLoading] = useState(false);
  const [donnees, setDonnees] = useState({
    paiementsMensuels: [],
    repartitionPaiements: [],
    evolutionTresorerie: [],
    topPatients: [],
    topMedecins: [],
    topServices: [],
    statistiques: {},
    alertesImpayes: []
  });

  // Couleurs pour les graphiques
  const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6b7280'];

  // Charger les données
  useEffect(() => {
    chargerDonnees();
  }, [periode]);

  const chargerDonnees = async () => {
    setLoading(true);
    try {
      // Simuler les données pour démonstration
      const mockData = {
        paiementsMensuels: [
          { mois: 'Jan', montant: 2500000, factures: 45, paiements: 42 },
          { mois: 'Fév', montant: 2800000, factures: 52, paiements: 48 },
          { mois: 'Mar', montant: 3200000, factures: 58, paiements: 55 },
          { mois: 'Avr', montant: 2900000, factures: 49, paiements: 46 },
          { mois: 'Mai', montant: 3500000, factures: 63, paiements: 60 },
          { mois: 'Jun', montant: 3800000, factures: 68, paiements: 65 }
        ],
        repartitionPaiements: [
          { nom: 'Payées', valeur: 65, couleur: '#10b981' },
          { nom: 'Partielles', valeur: 20, couleur: '#f59e0b' },
          { nom: 'En attente', valeur: 10, couleur: '#6b7280' },
          { nom: 'Impayées', valeur: 5, couleur: '#ef4444' }
        ],
        evolutionTresorerie: [
          { date: '01/01', encaisse: 15000000, depenses: 8000000, solde: 7000000 },
          { date: '08/01', encaisse: 18000000, depenses: 9500000, solde: 8500000 },
          { date: '15/01', encaisse: 22000000, depenses: 11000000, solde: 11000000 },
          { date: '22/01', encaisse: 26000000, depenses: 13000000, solde: 13000000 },
          { date: '29/01', encaisse: 30000000, depenses: 15000000, solde: 15000000 },
          { date: '05/02', encaisse: 34000000, depenses: 17000000, solde: 17000000 }
        ],
        topPatients: [
          { nom: 'Aminata Diallo', montant: 850000, factures: 12, statut: 'premium' },
          { nom: 'Moussa Ndiaye', montant: 620000, factures: 8, statut: 'regular' },
          { nom: 'Fatou Seck', montant: 480000, factures: 6, statut: 'regular' },
          { nom: 'Cheikh Fall', montant: 350000, factures: 5, statut: 'new' },
          { nom: 'Mariam Ba', montant: 280000, factures: 4, statut: 'new' }
        ],
        topMedecins: [
          { nom: 'Dr. Diop', patients: 156, chiffre: 4500000, satisfaction: 4.8 },
          { nom: 'Dr. Fall', patients: 142, chiffre: 3800000, satisfaction: 4.7 },
          { nom: 'Dr. Ndiaye', patients: 128, chiffre: 3200000, satisfaction: 4.9 },
          { nom: 'Dr. Sow', patients: 115, chiffre: 2900000, satisfaction: 4.6 },
          { nom: 'Dr. Ba', patients: 98, chiffre: 2400000, satisfaction: 4.8 }
        ],
        topServices: [
          { nom: 'Consultations', revenus: 8500000, patients: 320, croissance: 12 },
          { nom: 'Laboratoire', revenus: 4200000, patients: 180, croissance: 8 },
          { nom: 'Imagerie', revenus: 3800000, patients: 95, croissance: 15 },
          { nom: 'Pharmacie', revenus: 2500000, patients: 280, croissance: 5 },
          { nom: 'Urgences', revenus: 1800000, patients: 65, croissance: 20 }
        ],
        statistiques: {
          totalEncaisse: 30000000,
          totalDepenses: 15000000,
          solde: 15000000,
          croissanceMensuelle: 15.5,
          facturesEmises: 68,
          facturesPayees: 65,
          tauxRecouvrement: 95.6,
          montantMoyenFacture: 45000
        },
        alertesImpayes: [
          { patient: 'Baba Cissé', montant: 150000, retard: 45, facture: 'FACT-2025-045' },
          { patient: 'Awa Touré', montant: 85000, retard: 30, facture: 'FACT-2025-042' },
          { patient: 'Omar Sarr', montant: 120000, retard: 25, facture: 'FACT-2025-038' },
          { patient: 'Khady Dieng', montant: 65000, retard: 20, facture: 'FACT-2025-035' }
        ]
      };
      
      setDonnees(mockData);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  // Exporter les données
  const exporterDonnees = (format) => {
    // Implémentation de l'export
    console.log(`Exportation en ${format}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
        <span className="ml-2 text-gray-600">Chargement des données...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Activity className="w-8 h-8 text-purple-600" />
            Vue d'ensemble comptable
          </h1>
          <p className="text-gray-600 mt-2">
            Vue d'ensemble complète de la performance financière
          </p>
        </div>
        
        <div className="flex gap-3">
          <select
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="semaine">Cette semaine</option>
            <option value="mois">Ce mois</option>
            <option value="trimestre">Ce trimestre</option>
            <option value="annee">Cette année</option>
          </select>
          
          <button
            onClick={() => exporterDonnees('pdf')}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Exporter PDF
          </button>
          
          <button
            onClick={() => exporterDonnees('excel')}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Exporter Excel
          </button>
        </div>
      </div>

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Encaissé</p>
              <p className="text-2xl font-bold text-green-600">
                {formatMontant(donnees.statistiques.totalEncaisse)}
              </p>
              <div className="flex items-center mt-2 text-sm">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-green-600">+{donnees.statistiques.croissanceMensuelle}%</span>
              </div>
            </div>
            <Coins className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Solde Actuel</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatMontant(donnees.statistiques.solde)}
              </p>
              <div className="flex items-center mt-2 text-sm">
                <TrendingUp className="w-4 h-4 text-blue-500 mr-1" />
                <span className="text-blue-600">Stable</span>
              </div>
            </div>
            <Activity className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Taux Recouvrement</p>
              <p className="text-2xl font-bold text-purple-600">
                {donnees.statistiques.tauxRecouvrement}%
              </p>
              <div className="flex items-center mt-2 text-sm">
                <CheckCircle className="w-4 h-4 text-purple-500 mr-1" />
                <span className="text-purple-600">Excellent</span>
              </div>
            </div>
            <Users className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Montant Moyen</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatMontant(donnees.statistiques.montantMoyenFacture)}
              </p>
              <div className="flex items-center mt-2 text-sm">
                <TrendingUp className="w-4 h-4 text-orange-500 mr-1" />
                <span className="text-orange-600">+5.2%</span>
              </div>
            </div>
            <Calendar className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Alertes impayés */}
      {donnees.alertesImpayes.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <h3 className="text-lg font-semibold text-red-800">Alertes Impayés Critiques</h3>
          </div>
          <div className="space-y-2">
            {donnees.alertesImpayes.map((alerte, index) => (
              <div key={index} className="flex items-center justify-between bg-white p-3 rounded border border-red-100">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <div>
                    <span className="font-medium text-gray-900">{alerte.patient}</span>
                    <span className="text-sm text-gray-600 ml-2">{alerte.facture}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-medium text-red-600">{formatMontant(alerte.montant)}</span>
                  <span className="text-sm text-gray-500">{alerte.retard} jours</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Graphique des paiements mensuels */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Évolution des Paiements</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={donnees.paiementsMensuels}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mois" />
              <YAxis />
              <Tooltip formatter={(value) => formatMontant(value)} />
              <Legend />
              <Bar dataKey="montant" fill="#8b5cf6" name="Montant encaissé" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Répartition des statuts de paiement */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Répartition des Paiements</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={donnees.repartitionPaiements}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, valeur }) => `${name}: ${valeur}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="valeur"
              >
                {donnees.repartitionPaiements.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.couleur} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Évolution de la trésorerie */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Évolution de la Trésorerie</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={donnees.evolutionTresorerie}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => formatMontant(value)} />
              <Legend />
              <Area type="monotone" dataKey="encaisse" stackId="1" stroke="#10b981" fill="#10b981" name="Encaissé" />
              <Area type="monotone" dataKey="depenses" stackId="2" stroke="#ef4444" fill="#ef4444" name="Dépenses" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top patients */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Patients</h3>
          <div className="space-y-3">
            {donnees.topPatients.map((patient, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-sm font-medium text-purple-600">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{patient.nom}</p>
                    <p className="text-sm text-gray-500">{patient.factures} factures</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{formatMontant(patient.montant)}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    patient.statut === 'premium' ? 'bg-purple-100 text-purple-800' :
                    patient.statut === 'regular' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {patient.statut}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top médecins et services */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top médecins */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance des Médecins</h3>
          <div className="space-y-3">
            {donnees.topMedecins.map((medecin, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{medecin.nom}</p>
                    <p className="text-sm text-gray-500">{medecin.patients} patients</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{formatMontant(medecin.chiffre)}</p>
                  <div className="flex items-center text-sm text-yellow-500">
                    <span>⭐ {medecin.satisfaction}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top services */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenus par Service</h3>
          <div className="space-y-3">
            {donnees.topServices.map((service, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-sm font-medium text-green-600">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{service.nom}</p>
                    <p className="text-sm text-gray-500">{service.patients} patients</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{formatMontant(service.revenus)}</p>
                  <div className="flex items-center text-sm">
                    <TrendingUp className="w-3 h-3 text-green-500 mr-1" />
                    <span className="text-green-600">+{service.croissance}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TableauBordComptable;
