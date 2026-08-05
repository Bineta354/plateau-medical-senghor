import React, { useState, useEffect } from 'react';
import { 
  Download, FileText, Calendar, Filter, TrendingUp, TrendingDown,
  BarChart3, PieChart, Activity, RefreshCw, Printer, Mail,
  ChevronDown, ChevronUp, Settings, Eye, Edit, Trash2
} from 'lucide-react';
import { formatMontant } from '../../utils/currency';

const RapportsFinanciers = () => {
  const [rapports, setRapports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRapport, setSelectedRapport] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configRapport, setConfigRapport] = useState({
    type: 'mensuel',
    periode: 'mois',
    format: 'pdf',
    inclureDetails: true,
    inclureGraphiques: true,
    envoyerEmail: false,
    emailDestinataire: ''
  });

  // Charger les rapports
  useEffect(() => {
    chargerRapports();
  }, []);

  const chargerRapports = async () => {
    setLoading(true);
    try {
      // Données de test pour démonstration
      const mockRapports = [
        {
          id: 1,
          nom: 'Rapport Mensuel - Janvier 2025',
          type: 'mensuel',
          periode: '2025-01',
            dateGeneration: '2025-01-31',
            format: 'pdf',
            taille: '2.4 MB',
            statut: 'complet',
            donnees: {
              totalFactures: 68,
              totalEncaisse: 3800000,
              totalRestant: 450000,
              tauxRecouvrement: 89.4,
              topServices: [
                { nom: 'Consultations', revenus: 1500000 },
                { nom: 'Laboratoire', revenus: 800000 },
                { nom: 'Imagerie', revenus: 600000 }
              ],
              evolution: [
                { mois: 'Nov', montant: 3200000 },
                { mois: 'Dec', montant: 3500000 },
                { mois: 'Jan', montant: 3800000 }
              ]
            },
            tags: ['finance', 'mensuel', 'complet'],
            notes: 'Rapport complet avec toutes les analyses financières'
          },
          {
            id: 2,
            nom: 'Analyse des Impayés - Q1 2025',
            type: 'impayes',
            periode: '2025-Q1',
            dateGeneration: '2025-01-25',
            format: 'excel',
            taille: '1.8 MB',
            statut: 'partiel',
            donnees: {
              totalImpayes: 12,
              montantImpayes: 850000,
              patientsCritiques: 5,
              delaiMoyen: 35,
              evolutionImpayes: [
                { mois: 'Nov', montant: 450000 },
                { mois: 'Dec', montant: 650000 },
                { mois: 'Jan', montant: 850000 }
              ]
            },
            tags: ['impayés', 'trimestriel', 'alerte'],
            notes: 'Focus sur les factures en retard et actions correctives'
          },
          {
            id: 3,
            nom: 'Performance par Service - Janvier 2025',
            type: 'services',
            periode: '2025-01',
            dateGeneration: '2025-01-30',
            format: 'pdf',
            taille: '3.1 MB',
            statut: 'complet',
            donnees: {
              services: [
                { 
                  nom: 'Consultations', 
                  patients: 156, 
                  revenus: 1500000, 
                  croissance: 12.5,
                  satisfaction: 4.8
                },
                { 
                  nom: 'Laboratoire', 
                  patients: 89, 
                  revenus: 800000, 
                  croissance: 8.3,
                  satisfaction: 4.6
                },
                { 
                  nom: 'Imagerie', 
                  patients: 45, 
                  revenus: 600000, 
                  croissance: 15.2,
                  satisfaction: 4.9
                },
                { 
                  nom: 'Pharmacie', 
                  patients: 234, 
                  revenus: 450000, 
                  croissance: 5.1,
                  satisfaction: 4.5
                },
                { 
                  nom: 'Urgences', 
                  patients: 67, 
                  revenus: 350000, 
                  croissance: 22.8,
                  satisfaction: 4.7
                }
              ],
              totalPatients: 591,
              totalRevenus: 3700000
            },
            tags: ['services', 'performance', 'détaillé'],
            notes: 'Analyse détaillée par service avec indicateurs de performance'
          },
          {
            id: 4,
            nom: 'Rapport Annuel - 2024',
            type: 'annuel',
            periode: '2024',
            dateGeneration: '2025-01-05',
            format: 'pdf',
            taille: '8.7 MB',
            statut: 'complet',
            donnees: {
              chiffreAffaires: 42000000,
              croissance: 18.5,
              patientsTotal: 3420,
              facturesTotal: 5680,
              tauxRecouvrement: 92.3,
              moisData: [
                { mois: 'Jan', ca: 2800000 },
                { mois: 'Fev', ca: 3200000 },
                { mois: 'Mar', ca: 2900000 },
                { mois: 'Avr', ca: 3500000 },
                { mois: 'Mai', ca: 3800000 },
                { mois: 'Jun', ca: 4100000 },
                { mois: 'Jul', ca: 3600000 },
                { mois: 'Aou', ca: 3400000 },
                { mois: 'Sep', ca: 3900000 },
                { mois: 'Oct', ca: 4200000 },
                { mois: 'Nov', ca: 4500000 },
                { mois: 'Dec', ca: 4800000 }
              ]
            },
            tags: ['annuel', 'synthèse', 'global'],
            notes: 'Rapport annuel complet avec toutes les analyses et tendances'
          },
          {
            id: 5,
            nom: 'Rapport Personnalisé - Client VIP',
            type: 'personnalise',
            periode: '2025-01',
            dateGeneration: '2025-01-28',
            format: 'pdf',
            taille: '1.2 MB',
            statut: 'complet',
            donnees: {
              clientType: 'VIP',
              nombrePatients: 45,
              revenusVIP: 1200000,
              satisfactionMoyenne: 4.9,
              servicesUtilises: ['Consultations', 'Laboratoire', 'Imagerie']
            },
            tags: ['personnalisé', 'VIP', 'client'],
            notes: 'Rapport spécifique pour les patients VIP et leur comportement'
          }
        ];
        
        setRapports(mockRapports);
      } catch (error) {
        console.error('Erreur lors du chargement des rapports:', error);
      } finally {
        setLoading(false);
      }
    };

    // Obtenir la couleur du statut
    const getStatutColor = (statut) => {
      switch (statut) {
        case 'complet': return 'bg-green-100 text-green-800 border-green-200';
        case 'partiel': return 'bg-orange-100 text-orange-800 border-orange-200';
        case 'en_cours': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'erreur': return 'bg-red-100 text-red-800 border-red-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    };

    // Obtenir l'icône du type de rapport
    const getTypeIcon = (type) => {
      switch (type) {
        case 'mensuel': return <Calendar className="w-4 h-4 text-blue-600" />;
        case 'annuel': return <BarChart3 className="w-4 h-4 text-purple-600" />;
        case 'impayes': return <TrendingDown className="w-4 h-4 text-red-600" />;
        case 'services': return <Activity className="w-4 h-4 text-green-600" />;
        case 'personnalise': return <Settings className="w-4 h-4 text-orange-600" />;
        default: return <FileText className="w-4 h-4 text-gray-600" />;
      }
    };

    // Formater la taille du fichier
    const formatTaille = (taille) => {
      return taille;
    };

    // Générer un nouveau rapport
    const genererRapport = async () => {
      try {
        setLoading(true);
        console.log('Génération du rapport avec config:', configRapport);
        
        // Simuler la génération
        setTimeout(() => {
          const nouveauRapport = {
            id: rapports.length + 1,
            nom: `Rapport ${configRapport.type} - ${new Date().toLocaleDateString('fr-FR')}`,
            type: configRapport.type,
            periode: configRapport.periode,
            dateGeneration: new Date().toISOString().split('T')[0],
            format: configRapport.format,
            taille: '1.5 MB',
            statut: 'complet',
            donnees: {},
            tags: ['nouveau', configRapport.type],
            notes: 'Rapport généré automatiquement'
          };
          
          setRapports(prev => [nouveauRapport, ...prev]);
          setShowConfigModal(false);
          setLoading(false);
          alert('Rapport généré avec succès!');
        }, 2000);
      } catch (error) {
        console.error('Erreur lors de la génération:', error);
        setLoading(false);
        alert('Erreur lors de la génération du rapport');
      }
    };

    // Télécharger un rapport
    const telechargerRapport = (rapportId) => {
      const rapport = rapports.find(r => r.id === rapportId);
      if (rapport) {
        console.log(`Téléchargement du rapport: ${rapport.nom}`);
        alert(`Téléchargement de ${rapport.nom} (${rapport.format})`);
      }
    };

    // Envoyer un rapport par email
    const envoyerRapport = (rapportId) => {
      const rapport = rapports.find(r => r.id === rapportId);
      if (rapport) {
        console.log(`Envoi par email du rapport: ${rapport.nom}`);
        alert(`Rapport ${rapport.nom} envoyé par email!`);
      }
    };

    // Supprimer un rapport
    const supprimerRapport = (rapportId) => {
      if (confirm('Êtes-vous sûr de vouloir supprimer ce rapport?')) {
        setRapports(prev => prev.filter(r => r.id !== rapportId));
        alert('Rapport supprimé avec succès!');
      }
    };

    // Statistiques
    const stats = {
      total: rapports.length,
      completes: rapports.filter(r => r.statut === 'complet').length,
      tailleTotale: rapports.reduce((sum, r) => {
        const taille = parseFloat(r.taille.replace(' MB', ''));
        return sum + taille;
      }, 0).toFixed(1),
      types: [...new Set(rapports.map(r => r.type))].length
    };

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
          <span className="ml-2 text-gray-600">Génération en cours...</span>
        </div>
      );
    }

    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-purple-600" />
              Rapports Financiers
            </h1>
            <p className="text-gray-600 mt-2">
              Génération et consultation des rapports financiers
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfigModal(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <FileText className="w-5 h-5" />
              Nouveau Rapport
            </button>
            
            <button
              onClick={chargerRapports}
              className="btn btn-secondary flex items-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Actualiser
            </button>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Rapports</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-purple-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Complets</p>
                <p className="text-2xl font-bold text-green-600">{stats.completes}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Espace Total</p>
                <p className="text-2xl font-bold text-blue-600">{stats.tailleTotale} MB</p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Types</p>
                <p className="text-2xl font-bold text-orange-600">{stats.types}</p>
              </div>
              <PieChart className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Liste des rapports */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Rapports disponibles ({rapports.length})
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rapport
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Période
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Format
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Taille
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
                {rapports.map((rapport) => (
                  <tr key={rapport.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {getTypeIcon(rapport.type)}
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {rapport.nom}
                          </div>
                          <div className="flex gap-1 mt-1">
                            {rapport.tags.map((tag, index) => (
                              <span key={index} className="inline-flex px-1 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{rapport.periode}</div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(rapport.dateGeneration).toLocaleDateString('fr-FR')}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        rapport.format === 'pdf' ? 'bg-red-100 text-red-800' :
                        rapport.format === 'excel' ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {rapport.format.toUpperCase()}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatTaille(rapport.taille)}</div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatutColor(rapport.statut)}`}>
                        {rapport.statut === 'complet' ? 'Complet' :
                         rapport.statut === 'partiel' ? 'Partiel' :
                         rapport.statut === 'en_cours' ? 'En cours' : 'Erreur'}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedRapport(rapport)}
                          className="text-purple-600 hover:text-purple-900"
                          title="Voir les détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => telechargerRapport(rapport.id)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Télécharger"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => envoyerRapport(rapport.id)}
                          className="text-green-600 hover:text-green-900"
                          title="Envoyer par email"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => supprimerRapport(rapport.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de configuration */}
        {showConfigModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Configuration du Rapport
                </h3>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type de rapport
                    </label>
                    <select
                      value={configRapport.type}
                      onChange={(e) => setConfigRapport({...configRapport, type: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="mensuel">Rapport Mensuel</option>
                      <option value="trimestriel">Rapport Trimestriel</option>
                      <option value="annuel">Rapport Annuel</option>
                      <option value="impayes">Analyse des Impayés</option>
                      <option value="services">Performance par Service</option>
                      <option value="personnalise">Rapport Personnalisé</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Période
                    </label>
                    <select
                      value={configRapport.periode}
                      onChange={(e) => setConfigRapport({...configRapport, periode: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="mois">Ce mois</option>
                      <option value="trimestre">Ce trimestre</option>
                      <option value="annee">Cette année</option>
                      <option value="personnalise">Personnalisée</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Format
                    </label>
                    <select
                      value={configRapport.format}
                      onChange={(e) => setConfigRapport({...configRapport, format: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="pdf">PDF</option>
                      <option value="excel">Excel</option>
                      <option value="csv">CSV</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email destinataire (optionnel)
                    </label>
                    <input
                      type="email"
                      value={configRapport.emailDestinataire}
                      onChange={(e) => setConfigRapport({...configRapport, emailDestinataire: e.target.value})}
                      placeholder="email@exemple.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="inclureDetails"
                      checked={configRapport.inclureDetails}
                      onChange={(e) => setConfigRapport({...configRapport, inclureDetails: e.target.checked})}
                      className="mr-2"
                    />
                    <label htmlFor="inclureDetails" className="text-sm text-gray-700">
                      Inclure les détails complets
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="inclureGraphiques"
                      checked={configRapport.inclureGraphiques}
                      onChange={(e) => setConfigRapport({...configRapport, inclureGraphiques: e.target.checked})}
                      className="mr-2"
                    />
                    <label htmlFor="inclureGraphiques" className="text-sm text-gray-700">
                      Inclure les graphiques et analyses
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="envoyerEmail"
                      checked={configRapport.envoyerEmail}
                      onChange={(e) => setConfigRapport({...configRapport, envoyerEmail: e.target.checked})}
                      className="mr-2"
                    />
                    <label htmlFor="envoyerEmail" className="text-sm text-gray-700">
                      Envoyer automatiquement par email
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Annuler
                </button>
                <button
                  onClick={genererRapport}
                  className="btn btn-primary flex-1"
                >
                  Générer le Rapport
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de détails du rapport */}
        {selectedRapport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Détails du rapport
                </h3>
                <button
                  onClick={() => setSelectedRapport(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Informations générales</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Nom:</strong> {selectedRapport.nom}</div>
                      <div><strong>Type:</strong> {selectedRapport.type}</div>
                      <div><strong>Période:</strong> {selectedRapport.periode}</div>
                      <div><strong>Date:</strong> {new Date(selectedRapport.dateGeneration).toLocaleDateString('fr-FR')}</div>
                      <div><strong>Format:</strong> {selectedRapport.format.toUpperCase()}</div>
                      <div><strong>Taille:</strong> {selectedRapport.taille}</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Métadonnées</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Statut:</strong>
                        <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatutColor(selectedRapport.statut)}`}>
                          {selectedRapport.statut === 'complet' ? 'Complet' :
                           selectedRapport.statut === 'partiel' ? 'Partiel' :
                           selectedRapport.statut === 'en_cours' ? 'En cours' : 'Erreur'}
                        </span>
                      </div>
                      <div><strong>Tags:</strong></div>
                      <div className="flex gap-1 flex-wrap">
                        {selectedRapport.tags.map((tag, index) => (
                          <span key={index} className="inline-flex px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                {selectedRapport.notes && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Notes</h4>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-sm text-gray-700">{selectedRapport.notes}</p>
                    </div>
                  </div>
                )}
                
                {/* Données du rapport */}
                {selectedRapport.donnees && Object.keys(selectedRapport.donnees).length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Aperçu des données</h4>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <pre className="text-xs text-gray-700 overflow-x-auto">
                        {JSON.stringify(selectedRapport.donnees, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setSelectedRapport(null)}
                  className="btn btn-secondary flex-1"
                >
                  Fermer
                </button>
                <button
                  onClick={() => telechargerRapport(selectedRapport.id)}
                  className="btn btn-primary flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

export default RapportsFinanciers;
