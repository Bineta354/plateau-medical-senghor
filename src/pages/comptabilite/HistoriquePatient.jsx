import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Download, Calendar, User, FileText, 
  AlertCircle, CheckCircle, Clock, TrendingUp, TrendingDown,
  Eye, Edit, Trash2, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';
import { formatMontant } from '../../utils/currency';

const HistoriquePatient = () => {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [historique, setHistorique] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatut, setFilterStatut] = useState('all');
  const [filterPeriode, setFilterPeriode] = useState('all');
  const [expandedPatients, setExpandedPatients] = useState({});

  // Charger les patients
  useEffect(() => {
    chargerPatients();
  }, []);

  const chargerPatients = async () => {
    setLoading(true);
    try {
      // Données de test pour démonstration
      const mockPatients = [
        {
          id: 1,
          nom: 'Diallo',
          prenom: 'Aminata',
          telephone: '77 123 45 67',
          email: 'aminata.diallo@email.com',
          totalFactures: 12,
          totalPaye: 850000,
          totalRestant: 150000,
          dernierPaiement: '2025-01-20',
          statut: 'actif',
          moyennePaiement: 70833
        },
        {
          id: 2,
          nom: 'Ndiaye',
          prenom: 'Moussa',
          telephone: '76 987 65 43',
          email: 'moussa.ndiaye@email.com',
          totalFactures: 8,
          totalPaye: 620000,
          totalRestant: 80000,
          dernierPaiement: '2025-01-18',
          statut: 'actif',
          moyennePaiement: 77500
        },
        {
          id: 3,
          nom: 'Seck',
          prenom: 'Fatou',
          telephone: '78 456 78 90',
          email: 'fatou.seck@email.com',
          totalFactures: 6,
          totalPaye: 480000,
          totalRestant: 0,
          dernierPaiement: '2025-01-22',
          statut: 'solde',
          moyennePaiement: 80000
        },
        {
          id: 4,
          nom: 'Fall',
          prenom: 'Cheikh',
          telephone: '77 234 56 78',
          email: 'cheikh.fall@email.com',
          totalFactures: 5,
          totalPaye: 280000,
          totalRestant: 70000,
          dernierPaiement: '2025-01-15',
          statut: 'retard',
          moyennePaiement: 56000
        },
        {
          id: 5,
          nom: 'Ba',
          prenom: 'Mariam',
          telephone: '76 345 67 89',
          email: 'mariam.ba@email.com',
          totalFactures: 4,
          totalPaye: 280000,
          totalRestant: 0,
          dernierPaiement: '2025-01-25',
          statut: 'solde',
          moyennePaiement: 70000
        }
      ];
      
      setPatients(mockPatients);
    } catch (error) {
      console.error('Erreur lors du chargement des patients:', error);
    } finally {
      setLoading(false);
    }
  };

  // Charger l'historique d'un patient
  const chargerHistoriquePatient = async (patientId) => {
    setLoading(true);
    try {
      // Données de test pour l'historique
      const mockHistorique = [
        {
          id: 1,
          numero: 'FACT-2025-001',
          date: '2025-01-15',
          montant_total: 85000,
          montant_paye: 85000,
          montant_restant: 0,
          statut: 'paye',
          mode_paiement: 'carte',
          date_paiement: '2025-01-20',
          service: 'Consultation générale',
          medecin: 'Dr. Diop'
        },
        {
          id: 2,
          numero: 'FACT-2025-002',
          date: '2025-01-10',
          montant_total: 120000,
          montant_paye: 80000,
          montant_restant: 40000,
          statut: 'partiel',
          mode_paiement: 'especes',
          date_paiement: '2025-01-18',
          service: 'Laboratoire',
          medecin: 'Dr. Fall'
        },
        {
          id: 3,
          numero: 'FACT-2025-003',
          date: '2025-01-05',
          montant_total: 65000,
          montant_paye: 65000,
          montant_restant: 0,
          statut: 'paye',
          mode_paiement: 'cheque',
          date_paiement: '2025-01-12',
          service: 'Imagerie',
          medecin: 'Dr. Ndiaye'
        },
        {
          id: 4,
          numero: 'FACT-2025-004',
          date: '2024-12-28',
          montant_total: 95000,
          montant_paye: 0,
          montant_restant: 95000,
          statut: 'en_attente',
          mode_paiement: null,
          date_paiement: null,
          service: 'Pharmacie',
          medecin: 'Dr. Sow'
        }
      ];
      
      setHistorique(mockHistorique);
    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrer les patients
  const filteredPatients = patients.filter(patient => {
    const matchesSearch = 
      `${patient.prenom} ${patient.nom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.telephone?.includes(searchTerm);
    
    const matchesStatut = filterStatut === 'all' || patient.statut === filterStatut;
    
    return matchesSearch && matchesStatut;
  });

  // Basculer l'expansion d'un patient
  const togglePatientExpansion = (patientId) => {
    setExpandedPatients(prev => ({
      ...prev,
      [patientId]: !prev[patientId]
    }));
    
    if (!expandedPatients[patientId]) {
      chargerHistoriquePatient(patientId);
    }
  };

  // Obtenir la couleur du statut
  const getStatutColor = (statut) => {
    switch (statut) {
      case 'actif': return 'bg-green-100 text-green-800 border-green-200';
      case 'solde': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'retard': return 'bg-red-100 text-red-800 border-red-200';
      case 'inactif': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Obtenir la couleur du statut de paiement
  const getStatutPaiementColor = (statut) => {
    switch (statut) {
      case 'paye': return 'bg-green-100 text-green-800 border-green-200';
      case 'partiel': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'en_attente': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'impaye': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Exporter les données
  const exporterDonnees = (format) => {
    console.log(`Exportation en ${format}`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <User className="w-8 h-8 text-purple-600" />
            Historique des Patients
          </h1>
          <p className="text-gray-600 mt-2">
            Consultez l'historique complet des paiements par patient
          </p>
        </div>
        
        <div className="flex gap-3">
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
          
          <button
            onClick={chargerPatients}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="w-4 h-4 inline mr-1" />
              Recherche
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nom, email, téléphone..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="w-4 h-4 inline mr-1" />
              Statut
            </label>
            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="actif">Actif</option>
              <option value="solde">Soldé</option>
              <option value="retard">Retard</option>
              <option value="inactif">Inactif</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Période
            </label>
            <select
              value={filterPeriode}
              onChange={(e) => setFilterPeriode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Toutes périodes</option>
              <option value="aujourdhui">Aujourd'hui</option>
              <option value="semaine">Cette semaine</option>
              <option value="mois">Ce mois</option>
              <option value="trimestre">Ce trimestre</option>
            </select>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Patients</p>
              <p className="text-2xl font-bold text-gray-900">{patients.length}</p>
            </div>
            <User className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Encaissé</p>
              <p className="text-2xl font-bold text-green-600">
                {formatMontant(patients.reduce((sum, p) => sum + p.totalPaye, 0))}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Reste à Encaisser</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatMontant(patients.reduce((sum, p) => sum + p.totalRestant, 0))}
              </p>
            </div>
            <Clock className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Moyenne/Patient</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatMontant(patients.reduce((sum, p) => sum + p.moyennePaiement, 0) / patients.length || 0)}
              </p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Liste des patients */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Liste des Patients ({filteredPatients.length})
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Factures
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Payé
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reste à Payer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPatients.map((patient) => (
                <React.Fragment key={patient.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-purple-600">
                            {patient.prenom[0]}{patient.nom[0]}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {patient.prenom} {patient.nom}
                          </div>
                          <div className="text-sm text-gray-500">
                            Moyenne: {formatMontant(patient.moyennePaiement)}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{patient.telephone}</div>
                      <div className="text-sm text-gray-500">{patient.email}</div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{patient.totalFactures}</div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-green-600">
                        {formatMontant(patient.totalPaye)}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${
                        patient.totalRestant > 0 ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {formatMontant(patient.totalRestant)}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatutColor(patient.statut)}`}>
                        {patient.statut === 'actif' ? 'Actif' :
                         patient.statut === 'solde' ? 'Soldé' :
                         patient.statut === 'retard' ? 'Retard' : 'Inactif'}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => togglePatientExpansion(patient.id)}
                        className="text-purple-600 hover:text-purple-900 flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        {expandedPatients[patient.id] ? 'Masquer' : 'Voir'}
                        {expandedPatients[patient.id] ? 
                          <ChevronUp className="w-4 h-4" /> : 
                          <ChevronDown className="w-4 h-4" />
                        }
                      </button>
                    </td>
                  </tr>
                  
                  {/* Historique détaillé du patient */}
                  {expandedPatients[patient.id] && (
                    <tr>
                      <td colSpan="7" className="px-6 py-4 bg-gray-50">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-gray-900">
                              Historique des factures - {patient.prenom} {patient.nom}
                            </h4>
                            <div className="text-sm text-gray-500">
                              Dernier paiement: {patient.dernierPaiement}
                            </div>
                          </div>
                          
                          <div className="bg-white rounded-lg border border-gray-200">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Facture
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Date
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Service
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Total
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Payé
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Reste
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Statut
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Paiement
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {historique.map((facture) => (
                                  <tr key={facture.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                      {facture.numero}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-500">
                                      {new Date(facture.date).toLocaleDateString('fr-FR')}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-900">
                                      {facture.service}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-900">
                                      {formatMontant(facture.montant_total)}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-green-600">
                                      {formatMontant(facture.montant_paye)}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-orange-600">
                                      {formatMontant(facture.montant_restant)}
                                    </td>
                                    <td className="px-4 py-2">
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatutPaiementColor(facture.statut)}`}>
                                        {facture.statut === 'paye' ? 'Payée' :
                                         facture.statut === 'partiel' ? 'Partielle' :
                                         facture.statut === 'en_attente' ? 'En attente' : 'Impayée'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-500">
                                      {facture.mode_paiement ? (
                                        <div>
                                          <div>{facture.mode_paiement}</div>
                                          <div className="text-xs">
                                            {facture.date_paiement ? 
                                              new Date(facture.date_paiement).toLocaleDateString('fr-FR') : 
                                              '-'
                                            }
                                          </div>
                                        </div>
                                      ) : (
                                        '-'
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HistoriquePatient;
