import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Download, Calendar, TrendingUp, TrendingDown,
  BarChart3, PieChart, Activity, RefreshCw, FileText, Eye,
  ChevronDown, ChevronUp, Clock, Coins, Users, Target
} from 'lucide-react';
import { formatMontant } from '../../utils/currency';

const RechercheAvancee = () => {
  const [donnees, setDonnees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    periode: 'mois',
    statut: 'all',
    service: 'all',
    medecin: 'all',
    patient: 'all',
    montantMin: '',
    montantMax: '',
    modePaiement: 'all'
  });
  const [expandedFilters, setExpandedFilters] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState(null);

  // Charger les données
  useEffect(() => {
    chargerDonnees();
  }, []);

  const chargerDonnees = async () => {
    setLoading(true);
    try {
      // Données de test enrichies pour démonstration
      const mockDonnees = [
        {
          id: 1,
          numero: 'FACT-2025-001',
          date: '2025-01-15',
          patient: {
            id: 1,
            nom: 'Diallo',
            prenom: 'Aminata',
            telephone: '77 123 45 67',
            email: 'aminata.diallo@email.com',
            assurance: 'IPM'
          },
          medecin: {
            id: 1,
            nom: 'Diop',
            prenom: 'Mouhammad',
            specialite: 'Cardiologie'
          },
          service: 'Consultation',
          montant_total: 85000,
          montant_paye: 85000,
          montant_restant: 0,
          statut: 'paye',
          mode_paiement: 'carte',
          date_paiement: '2025-01-20',
          temps_traitement: 5, // jours
          priorite: 'normale',
          tags: ['urgent', 'vip'],
          notes: 'Patient satisfait du service'
        },
        {
          id: 2,
          numero: 'FACT-2025-002',
          date: '2025-01-18',
          patient: {
            id: 2,
            nom: 'Ndiaye',
            prenom: 'Moussa',
            telephone: '76 987 65 43',
            email: 'moussa.ndiaye@email.com',
            assurance: 'IPRES'
          },
          medecin: {
            id: 2,
            nom: 'Fall',
            prenom: 'Aminata',
            specialite: 'Pédiatrie'
          },
          service: 'Laboratoire',
          montant_total: 120000,
          montant_paye: 80000,
          montant_restant: 40000,
          statut: 'partiel',
          mode_paiement: 'especes',
          date_paiement: '2025-01-22',
          temps_traitement: 4,
          priorite: 'haute',
          tags: ['analyse', 'complexe'],
          notes: 'Résultats envoyés par email'
        },
        {
          id: 3,
          numero: 'FACT-2025-003',
          date: '2025-01-20',
          patient: {
            id: 3,
            nom: 'Seck',
            prenom: 'Fatou',
            telephone: '78 456 78 90',
            email: 'fatou.seck@email.com',
            assurance: 'Aucune'
          },
          medecin: {
            id: 3,
            nom: 'Ndiaye',
            prenom: 'Cheikh',
            specialite: 'Radiologie'
          },
          service: 'Imagerie',
          montant_total: 95000,
          montant_paye: 0,
          montant_restant: 95000,
          statut: 'en_attente',
          mode_paiement: null,
          date_paiement: null,
          temps_traitement: 2,
          priorite: 'normale',
          tags: ['scanner', 'urgent'],
          notes: 'Scanner abdominal prévu'
        },
        {
          id: 4,
          numero: 'FACT-2025-004',
          date: '2025-01-22',
          patient: {
            id: 4,
            nom: 'Ba',
            prenom: 'Mariam',
            telephone: '77 234 56 78',
            email: 'mariam.ba@email.com',
            assurance: 'CNAM'
          },
          medecin: {
            id: 4,
            nom: 'Sow',
            prenom: 'Khady',
            specialite: 'Gynécologie'
          },
          service: 'Pharmacie',
          montant_total: 65000,
          montant_paye: 65000,
          montant_restant: 0,
          statut: 'paye',
          mode_paiement: 'cheque',
          date_paiement: '2025-01-25',
          temps_traitement: 3,
          priorite: 'basse',
          tags: ['medicaments', 'chronique'],
          notes: 'Médicaments pour traitement mensuel'
        },
        {
          id: 5,
          numero: 'FACT-2025-005',
          date: '2025-01-25',
          patient: {
            id: 5,
            nom: 'Faye',
            prenom: 'Ibrahim',
            telephone: '76 345 67 89',
            email: 'ibrahim.faye@email.com',
            assurance: 'IPM'
          },
          medecin: {
            id: 5,
            nom: 'Ba',
            prenom: 'Oumar',
            specialite: 'Urgences'
          },
          service: 'Urgences',
          montant_total: 150000,
          montant_paye: 50000,
          montant_restant: 100000,
          statut: 'partiel',
          mode_paiement: 'especes',
          date_paiement: '2025-01-26',
          temps_traitement: 1,
          priorite: 'critique',
          tags: ['urgence', 'accident'],
          notes: 'Soins d\'urgence suite à accident'
        }
      ];
      
      setDonnees(mockDonnees);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrer les données
  const filteredDonnees = donnees.filter(item => {
    // Recherche textuelle
    const matchesSearch = 
      item.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${item.patient.prenom} ${item.patient.nom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.medecin.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.patient.telephone?.includes(searchTerm);
    
    // Filtres avancés
    const matchesStatut = filters.statut === 'all' || item.statut === filters.statut;
    const matchesService = filters.service === 'all' || item.service === filters.service;
    const matchesMedecin = filters.medecin === 'all' || item.medecin.nom === filters.medecin;
    const matchesModePaiement = filters.modePaiement === 'all' || item.mode_paiement === filters.modePaiement;
    
    // Filtre montant
    const matchesMontantMin = !filters.montantMin || item.montant_total >= parseInt(filters.montantMin);
    const matchesMontantMax = !filters.montantMax || item.montant_total <= parseInt(filters.montantMax);
    
    // Filtre période (simplifié)
    const matchesPeriode = true; // Implémentation selon la période choisie
    
    return matchesSearch && matchesStatut && matchesService && matchesMedecin && 
           matchesModePaiement && matchesMontantMin && matchesMontantMax && matchesPeriode;
  });

  // Obtenir les options uniques pour les filtres
  const getUniqueServices = () => [...new Set(donnees.map(d => d.service))];
  const getUniqueMedecins = () => [...new Set(donnees.map(d => d.medecin.nom))];
  const getUniqueModesPaiement = () => [...new Set(donnees.map(d => d.mode_paiement).filter(Boolean))];

  // Obtenir la couleur du statut
  const getStatutColor = (statut) => {
    switch (statut) {
      case 'paye': return 'bg-green-100 text-green-800 border-green-200';
      case 'partiel': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'en_attente': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'impaye': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Obtenir la couleur de priorité
  const getPrioriteColor = (priorite) => {
    switch (priorite) {
      case 'critique': return 'bg-red-100 text-red-800 border-red-200';
      case 'haute': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'normale': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'basse': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Exporter les données
  const exporterDonnees = (format) => {
    console.log(`Exportation en ${format}`);
  };

  // Statistiques
  const stats = {
    total: filteredDonnees.length,
    totalMontant: filteredDonnees.reduce((sum, d) => sum + d.montant_total, 0),
    totalPaye: filteredDonnees.reduce((sum, d) => sum + d.montant_paye, 0),
    totalRestant: filteredDonnees.reduce((sum, d) => sum + d.montant_restant, 0),
    tauxRecouvrement: filteredDonnees.length > 0 ? 
      (filteredDonnees.filter(d => d.statut === 'paye').length / filteredDonnees.length * 100) : 0
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
            <Search className="w-8 h-8 text-purple-600" />
            Recherche Avancée
          </h1>
          <p className="text-gray-600 mt-2">
            Recherche et analyse multicritères des factures
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => exporterDonnees('pdf')}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            PDF
          </button>
          
          <button
            onClick={() => exporterDonnees('excel')}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Excel
          </button>
          
          <button
            onClick={chargerDonnees}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Résultats</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <FileText className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Montant</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatMontant(stats.totalMontant)}
              </p>
            </div>
            <Coins className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Payé</p>
              <p className="text-2xl font-bold text-green-600">
                {formatMontant(stats.totalPaye)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Reste à Payer</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatMontant(stats.totalRestant)}
              </p>
            </div>
            <Clock className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Taux Recouvrement</p>
              <p className="text-2xl font-bold text-purple-600">
                {stats.tauxRecouvrement.toFixed(1)}%
              </p>
            </div>
            <Target className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Filtres de recherche</h3>
            <button
              onClick={() => setExpandedFilters(!expandedFilters)}
              className="text-purple-600 hover:text-purple-900 flex items-center gap-1"
            >
              {expandedFilters ? 'Masquer' : 'Afficher'} les filtres avancés
              {expandedFilters ? 
                <ChevronUp className="w-4 h-4" /> : 
                <ChevronDown className="w-4 h-4" />
              }
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {/* Recherche principale */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="w-4 h-4 inline mr-1" />
              Recherche rapide
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Numéro, patient, médecin, service, téléphone..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          {/* Filtres avancés */}
          {expandedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Période
                </label>
                <select
                  value={filters.periode}
                  onChange={(e) => setFilters({...filters, periode: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="aujourdhui">Aujourd'hui</option>
                  <option value="semaine">Cette semaine</option>
                  <option value="mois">Ce mois</option>
                  <option value="trimestre">Ce trimestre</option>
                  <option value="annee">Cette année</option>
                  <option value="all">Toutes périodes</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Filter className="w-4 h-4 inline mr-1" />
                  Statut
                </label>
                <select
                  value={filters.statut}
                  onChange={(e) => setFilters({...filters, statut: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="paye">Payée</option>
                  <option value="partiel">Partiellement payée</option>
                  <option value="en_attente">En attente</option>
                  <option value="impaye">Impayée</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service
                </label>
                <select
                  value={filters.service}
                  onChange={(e) => setFilters({...filters, service: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">Tous les services</option>
                  {getUniqueServices().map(service => (
                    <option key={service} value={service}>{service}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Médecin
                </label>
                <select
                  value={filters.medecin}
                  onChange={(e) => setFilters({...filters, medecin: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">Tous les médecins</option>
                  {getUniqueMedecins().map(medecin => (
                    <option key={medecin} value={medecin}>{medecin}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mode de paiement
                </label>
                <select
                  value={filters.modePaiement}
                  onChange={(e) => setFilters({...filters, modePaiement: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">Tous les modes</option>
                  {getUniqueModesPaiement().map(mode => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant minimum
                </label>
                <input
                  type="number"
                  value={filters.montantMin}
                  onChange={(e) => setFilters({...filters, montantMin: e.target.value})}
                  placeholder="FCFA"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant maximum
                </label>
                <input
                  type="number"
                  value={filters.montantMax}
                  onChange={(e) => setFilters({...filters, montantMax: e.target.value})}
                  placeholder="FCFA"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={() => setFilters({
                    periode: 'mois',
                    statut: 'all',
                    service: 'all',
                    medecin: 'all',
                    patient: 'all',
                    montantMin: '',
                    montantMax: '',
                    modePaiement: 'all'
                  })}
                  className="btn btn-secondary w-full"
                >
                  Réinitialiser
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Résultats */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Résultats de la recherche ({filteredDonnees.length})
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Facture
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Médecin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priorité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDonnees.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.numero}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(item.date).toLocaleDateString('fr-FR')}
                      </div>
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {item.tags.map((tag, index) => (
                            <span key={index} className="inline-flex px-1 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {item.patient.prenom} {item.patient.nom}
                      </div>
                      <div className="text-sm text-gray-500">{item.patient.telephone}</div>
                      <div className="text-xs text-gray-400">{item.patient.assurance}</div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        Dr. {item.medecin.prenom} {item.medecin.nom}
                      </div>
                      <div className="text-sm text-gray-500">{item.medecin.specialite}</div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{item.service}</div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {formatMontant(item.montant_total)}
                      </div>
                      <div className="text-xs text-green-600">
                        Payé: {formatMontant(item.montant_paye)}
                      </div>
                      {item.montant_restant > 0 && (
                        <div className="text-xs text-orange-600">
                          Reste: {formatMontant(item.montant_restant)}
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatutColor(item.statut)}`}>
                      {item.statut === 'paye' ? 'Payée' :
                       item.statut === 'partiel' ? 'Partielle' :
                       item.statut === 'en_attente' ? 'En attente' : 'Impayée'}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getPrioriteColor(item.priorite)}`}>
                      {item.priorite === 'critique' ? 'Critique' :
                       item.priorite === 'haute' ? 'Haute' :
                       item.priorite === 'normale' ? 'Normale' : 'Basse'}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => setSelectedFacture(item)}
                      className="text-purple-600 hover:text-purple-900 flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      Voir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de détails */}
      {selectedFacture && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Détails de la facture {selectedFacture.numero}
              </h3>
              <button
                onClick={() => setSelectedFacture(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Informations patient</h4>
                <div className="space-y-2 text-sm">
                  <div><strong>Nom:</strong> {selectedFacture.patient.prenom} {selectedFacture.patient.nom}</div>
                  <div><strong>Téléphone:</strong> {selectedFacture.patient.telephone}</div>
                  <div><strong>Email:</strong> {selectedFacture.patient.email}</div>
                  <div><strong>Assurance:</strong> {selectedFacture.patient.assurance}</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Informations facture</h4>
                <div className="space-y-2 text-sm">
                  <div><strong>Date:</strong> {new Date(selectedFacture.date).toLocaleDateString('fr-FR')}</div>
                  <div><strong>Service:</strong> {selectedFacture.service}</div>
                  <div><strong>Médecin:</strong> Dr. {selectedFacture.medecin.prenom} {selectedFacture.medecin.nom}</div>
                  <div><strong>Spécialité:</strong> {selectedFacture.medecin.specialite}</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Montants</h4>
                <div className="space-y-2 text-sm">
                  <div><strong>Total:</strong> {formatMontant(selectedFacture.montant_total)}</div>
                  <div><strong>Payé:</strong> {formatMontant(selectedFacture.montant_paye)}</div>
                  <div><strong>Reste:</strong> {formatMontant(selectedFacture.montant_restant)}</div>
                  <div><strong>Mode paiement:</strong> {selectedFacture.mode_paiement || 'Non défini'}</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Statuts</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Statut paiement:</strong>
                    <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatutColor(selectedFacture.statut)}`}>
                      {selectedFacture.statut === 'paye' ? 'Payée' :
                       selectedFacture.statut === 'partiel' ? 'Partielle' :
                       selectedFacture.statut === 'en_attente' ? 'En attente' : 'Impayée'}
                    </span>
                  </div>
                  <div>
                    <strong>Priorité:</strong>
                    <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getPrioriteColor(selectedFacture.priorite)}`}>
                      {selectedFacture.priorite === 'critique' ? 'Critique' :
                       selectedFacture.priorite === 'haute' ? 'Haute' :
                       selectedFacture.priorite === 'normale' ? 'Normale' : 'Basse'}
                    </span>
                  </div>
                  <div><strong>Temps traitement:</strong> {selectedFacture.temps_traitement} jours</div>
                </div>
              </div>
            </div>
            
            {selectedFacture.notes && (
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-3">Notes</h4>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-sm text-gray-700">{selectedFacture.notes}</p>
                </div>
              </div>
            )}
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setSelectedFacture(null)}
                className="btn btn-secondary flex-1"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  // Implémentation de l'impression
                  alert('Impression de la facture...');
                }}
                className="btn btn-primary flex-1"
              >
                Imprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RechercheAvancee;
