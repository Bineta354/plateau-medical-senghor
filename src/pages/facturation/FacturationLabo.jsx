import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Trash2,
  Eye,
  Download,
  Calendar,
  User,
  CheckCircle,
  Clock,
  Coins,
  FileText,
  Save,
  X,
  TestTube,
  Microscope,
  Activity
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import SearchableSelect from '../../components/common/SearchableSelect';
import { useAlert } from '../../contexts/AlertContext';
import { formatMontant } from '../../utils/currency';

const FacturationLabo = () => {
  const { showError, showSuccess, showWarning, showInfo } = useAlert();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(null);
  const [editingFacture, setEditingFacture] = useState(null);
  const [factureData, setFactureData] = useState({
    patientId: '',
    analysesIds: [],
    datePrelevement: '',
    urgence: false,
    observations: ''
  });

  // États pour les données réelles
  const [patients, setPatients] = useState([]);
  const [facturationLabo, setFacturationLabo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Charger les données depuis la base de données
  useEffect(() => {
    fetchPatients();
    fetchAnalysesLabo();
  }, []);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('patients')
        .select(`
          id,
          nom,
          prenom,
          date_naissance,
          sexe,
          telephone,
          adresse,
          numero_dossier,
          assurance_id,
          actif,
          assurances (
            id,
            nom,
            type_assurance,
            taux_remboursement,
            description
          )
        `)
        .eq('actif', true)
        .order('nom', { ascending: true});

      if (fetchError) throw fetchError;

      console.log('✅ Patients chargés:', data?.length || 0);
      setPatients(data || []);
    } catch (err) {
      console.error('❌ Erreur chargement patients:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalysesLabo = async () => {
    try {
      console.log('🔄 Chargement des analyses de laboratoire...');

      // Récupérer les analyses prescrites
      const { data: analysesData, error: analysesError } = await supabase
        .from('analyses_labo_prescrites')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (analysesError) throw analysesError;

      console.log('✅ Analyses récupérées:', analysesData?.length || 0);

      if (!analysesData || analysesData.length === 0) {
        setFacturationLabo([]);
        return;
      }

      // Récupérer les IDs uniques des patients et consultations
      const patientIds = [...new Set(analysesData.map(a => a.patient_id).filter(Boolean))];
      const consultationIds = [...new Set(analysesData.map(a => a.consultation_id).filter(Boolean))];

      // Récupérer les patients avec leurs assurances
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select(`
          id,
          nom,
          prenom,
          assurance_id,
          assurances (
            nom,
            taux_remboursement
          )
        `)
        .in('id', patientIds);

      if (patientsError) {
        console.warn('⚠️ Erreur chargement patients:', patientsError);
      }

      // Récupérer les consultations
      const { data: consultationsData, error: consultationsError } = await supabase
        .from('consultations')
        .select(`
          id,
          date_consultation,
          medecin_id,
          users (
            id,
            nom,
            prenom
          )
        `)
        .in('id', consultationIds);

      if (consultationsError) {
        console.warn('⚠️ Erreur chargement consultations:', consultationsError);
      }

      // Créer des maps pour un accès rapide
      const patientsMap = new Map(patientsData?.map(p => [p.id, p]) || []);
      const consultationsMap = new Map(consultationsData?.map(c => [c.id, c]) || []);

      // Transformer les données
      const facturations = analysesData.map((analyse, index) => {
        const patient = patientsMap.get(analyse.patient_id);
        const consultation = consultationsMap.get(analyse.consultation_id);
        const medecin = consultation?.users;
        const assurance = patient?.assurances;
        const tauxCouverture = assurance?.taux_remboursement || 0;
        
        // Tarif estimé basé sur le type d'analyse
        const tarifEstime = getTarifEstime(analyse.type_analyse);
        const montantTotal = tarifEstime;
        const montantAssurance = (montantTotal * tauxCouverture) / 100;
        const montantPatient = montantTotal - montantAssurance;

        return {
          id: analyse.id,
          numero: `FL-${new Date(analyse.created_at).getFullYear()}-${String(index + 1).padStart(3, '0')}`,
          date: analyse.date_prescription || analyse.created_at?.split('T')[0],
          patient: {
            id: patient?.id,
            nom: patient?.nom || 'Inconnu',
            prenom: patient?.prenom || '',
            assurance: assurance?.nom || 'Sans assurance',
            tauxCouverture: tauxCouverture
          },
          analyses: [
            {
              analyse: {
                id: analyse.id,
                libelle: analyse.type_analyse,
                code: `LAB-${analyse.id}`,
                categorie: getCategorieAnalyse(analyse.type_analyse),
                duree: 24
              },
              resultat: analyse.resultat || 'En cours',
              statut: analyse.statut
            }
          ],
          total: montantTotal,
          montantAssurance: montantAssurance,
          montantPatient: montantPatient,
          statut: mapStatut(analyse.statut),
          datePrelevement: analyse.date_prelevement || analyse.date_prescription,
          dateResultat: analyse.date_resultat,
          urgence: analyse.urgence || false,
          medecin: medecin ? `Dr. ${medecin.prenom} ${medecin.nom}` : 'Non spécifié'
        };
      });

      console.log('✅ Facturations formatées:', facturations.length);
      setFacturationLabo(facturations);
    } catch (err) {
      console.error('❌ Erreur chargement analyses:', err);
      setError(err.message);
    }
  };

  // Fonction pour estimer le tarif selon le type d'analyse
  const getTarifEstime = (typeAnalyse) => {
    const tarifs = {
      'hemogramme': 15000,
      'glycemie': 8000,
      'creatinine': 10000,
      'lipidique': 18000,
      'vih': 25000,
      'ecbu': 12000,
      'tsh': 20000,
      'crp': 15000,
      'hepatite': 30000,
      'uree': 8000
    };

    const type = typeAnalyse.toLowerCase();
    for (const [key, tarif] of Object.entries(tarifs)) {
      if (type.includes(key)) return tarif;
    }
    return 15000; // Tarif par défaut
  };

  // Fonction pour déterminer la catégorie
  const getCategorieAnalyse = (typeAnalyse) => {
    const type = typeAnalyse.toLowerCase();
    if (type.includes('hemo') || type.includes('sang')) return 'Hématologie';
    if (type.includes('glyc') || type.includes('creat') || type.includes('lipid') || type.includes('uree')) return 'Biochimie';
    if (type.includes('vih') || type.includes('hepat') || type.includes('serol')) return 'Sérologie';
    if (type.includes('ecbu') || type.includes('bact')) return 'Bactériologie';
    if (type.includes('tsh') || type.includes('hormon')) return 'Hormonologie';
    if (type.includes('crp') || type.includes('immun')) return 'Immunologie';
    return 'Autre';
  };

  // Mapper le statut de la DB vers le statut d'affichage
  const mapStatut = (statutDB) => {
    const mapping = {
      'prescrit': 'programme',
      'preleve': 'en_cours',
      'en_cours': 'en_cours',
      'termine': 'termine',
      'annule': 'annule'
    };
    return mapping[statutDB] || 'programme';
  };

  // Analyses disponibles
  const analysesDisponibles = [
    { id: 1, code: 'HEM001', libelle: 'Hémogramme complet', tarif: 15000, categorie: 'Hématologie', duree: 2 },
    { id: 2, code: 'BIO001', libelle: 'Glycémie à jeun', tarif: 8000, categorie: 'Biochimie', duree: 1 },
    { id: 3, code: 'BIO002', libelle: 'Créatininémie', tarif: 10000, categorie: 'Biochimie', duree: 1 },
    { id: 4, code: 'LIP001', libelle: 'Bilan lipidique', tarif: 18000, categorie: 'Biochimie', duree: 2 },
    { id: 5, code: 'SER001', libelle: 'Sérologie VIH', tarif: 25000, categorie: 'Sérologie', duree: 24 },
    { id: 6, code: 'BAC001', libelle: 'ECBU', tarif: 12000, categorie: 'Bactériologie', duree: 48 },
    { id: 7, code: 'HOR001', libelle: 'TSH', tarif: 20000, categorie: 'Hormonologie', duree: 4 },
    { id: 8, code: 'IMM001', libelle: 'CRP', tarif: 15000, categorie: 'Immunologie', duree: 2 }
  ];


  const categories = ['Hématologie', 'Biochimie', 'Sérologie', 'Bactériologie', 'Hormonologie', 'Immunologie'];

  const filteredFacturations = facturationLabo.filter(facture => {
    const matchesSearch = facture.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         `${facture.patient.prenom} ${facture.patient.nom}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || facture.statut === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
    if (editingFacture) {
      console.log('Modification prescription labo:', factureData);
      showSuccess('Prescription laboratoire modifiée avec succès!');
      setEditingFacture(null);
    } else {
        console.log('🔄 Création nouvelle prescription laboratoire...');
        
        if (!factureData.patientId || factureData.analysesIds.length === 0) {
          showWarning('Veuillez sélectionner un patient et au moins une analyse');
          return;
        }

        // 1. Récupérer la dernière consultation du patient pour obtenir le medecin_id
        const { data: derniereConsultation, error: derniereConsultationError } = await supabase
          .from('consultations')
          .select('medecin_id')
          .eq('patient_id', factureData.patientId)
          .order('date_consultation', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let medecinId = null;

        if (derniereConsultationError) {
          // Erreur lors de la requête
          console.error('❌ Erreur récupération consultation:', derniereConsultationError);
          showError('Erreur lors de la récupération de la consultation. Veuillez réessayer.');
          return;
        }

        if (!derniereConsultation) {
          // Si aucune consultation n'existe, essayer de récupérer l'utilisateur connecté
          console.warn('⚠️ Aucune consultation trouvée pour ce patient, tentative avec utilisateur connecté...');
          
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          
          if (userError || !user) {
            showError('Erreur: Aucune consultation trouvée pour ce patient et utilisateur non connecté. Veuillez d\'abord créer une consultation pour ce patient.');
            return;
          }

          const { data: userData, error: userDataError } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', user.id)
            .single();

          if (userDataError || !userData) {
            showError('Erreur: Impossible de récupérer les informations du médecin. Veuillez d\'abord créer une consultation pour ce patient.');
            return;
          }

          medecinId = userData.id;
        } else {
          medecinId = derniereConsultation.medecin_id;
        }

        if (!medecinId) {
          showError('Erreur: Impossible de déterminer le médecin. Veuillez d\'abord créer une consultation pour ce patient.');
          return;
        }

        console.log('✅ Médecin ID (depuis consultation):', medecinId);

        // 2. Créer une consultation pour ce patient
        const { data: consultationData, error: consultationError } = await supabase
          .from('consultations')
          .insert({
            patient_id: factureData.patientId,
            medecin_id: medecinId,
            date_consultation: new Date().toISOString().split('T')[0],
            motif: 'Analyses de laboratoire',
            statut: 'terminee'
          })
          .select()
          .single();

        if (consultationError) throw consultationError;
        console.log('✅ Consultation créée:', consultationData.id);

        // 2. Créer les analyses prescrites
        for (const analyseId of factureData.analysesIds) {
          const analyseSelectionnee = analysesDisponibles.find(a => a.id === analyseId);
          if (!analyseSelectionnee) continue;

          const { data: analyseData, error: analyseError } = await supabase
            .from('analyses_labo_prescrites')
            .insert({
              consultation_id: consultationData.id,
              patient_id: factureData.patientId,
              type_analyse: analyseSelectionnee.libelle,
              description: factureData.observations,
              urgence: factureData.urgence,
              date_prescription: new Date().toISOString().split('T')[0],
              date_prelevement: factureData.datePrelevement,
              statut: 'prescrit',
              notes: factureData.observations
            })
            .select()
            .single();

          if (analyseError) throw analyseError;
          console.log('✅ Analyse prescrite créée:', analyseData.id);
        }

      showSuccess('Nouvelle prescription laboratoire créée avec succès!');
        
        // Recharger les analyses
        await fetchAnalysesLabo();
    }
      
    setShowForm(false);
    setFactureData({
      patientId: '', analysesIds: [], datePrelevement: '', urgence: false, observations: ''
    });
    } catch (error) {
      console.error('❌ Erreur lors de la création:', error);
      showError(`Erreur: ${error.message}`);
    }
  };

  const handleEdit = (facture) => {
    setEditingFacture(facture);
    setFactureData({
      patientId: facture.patient.id,
      analysesIds: facture.analyses.map(a => a.analyse.id),
      datePrelevement: facture.datePrelevement,
      urgence: facture.urgence,
      observations: facture.observations || ''
    });
    setShowForm(true);
  };

  const handleDelete = (facture) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la prescription ${facture.numero} ?`)) {
      console.log('Suppression prescription labo:', facture.id);
      showSuccess('Prescription supprimée avec succès!');
    }
  };

  const handleDownload = (facture) => {
    console.log('Téléchargement prescription labo:', facture.numero);
    showInfo(`Téléchargement de la prescription ${facture.numero} en cours...`);
  };

  const getStatusColor = (statut) => {
    switch (statut) {
      case 'termine': return 'bg-green-100 text-green-800';
      case 'en_cours': return 'bg-yellow-100 text-yellow-800';
      case 'programme': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Facturation Laboratoire</h1>
          <p className="text-gray-600">Gestion des analyses et examens de laboratoire</p>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle prescription
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center">
            <TestTube className="w-8 h-8 text-blue-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-500">Total analyses</p>
              <p className="text-2xl font-semibold text-gray-900">{facturationLabo.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-500">Terminées</p>
              <p className="text-2xl font-semibold text-gray-900">
                {facturationLabo.filter(f => f.statut === 'termine').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-yellow-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-500">En cours</p>
              <p className="text-2xl font-semibold text-gray-900">
                {facturationLabo.filter(f => f.statut === 'en_cours').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center">
            <Coins className="w-8 h-8 text-medical-primary mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-500">Chiffre d'affaires</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatMontant(facturationLabo.reduce((sum, f) => sum + f.total, 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingFacture ? 'Modifier la prescription' : 'Nouvelle prescription laboratoire'}
            </h3>
            <button onClick={() => {
              setShowForm(false);
              setEditingFacture(null);
              setFactureData({
                patientId: '', analysesIds: [], datePrelevement: '', urgence: false, observations: ''
              });
            }}>
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <SearchableSelect
                  options={patients.map(patient => ({
                    id: patient.id,
                    label: `${patient.prenom} ${patient.nom}`,
                    nom: patient.nom,
                    prenom: patient.prenom,
                    assurance: patient.assurances?.nom || 'Sans assurance',
                    tauxCouverture: patient.assurances?.taux_remboursement || 0,
                    telephone: patient.telephone || '',
                    numero_dossier: patient.numero_dossier || ''
                  }))}
                  value={factureData.patientId}
                  onChange={(value) => setFactureData({...factureData, patientId: value})}
                  placeholder={loading ? 'Chargement des patients...' : 'Sélectionner un patient'}
                  searchPlaceholder="Rechercher un patient (nom, prénom, dossier)..."
                  label="Patient *"
                  required={true}
                  emptyMessage="Aucun patient trouvé"
                  renderOption={(patient) => (
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">
                      {patient.prenom} {patient.nom}
                        </span>
                        {patient.numero_dossier && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            #{patient.numero_dossier}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center text-xs text-gray-500 mt-1">
                        <span className="mr-3">
                          🏥 {patient.assurance}
                          {patient.tauxCouverture > 0 && (
                            <span className="ml-1 text-green-600 font-medium">
                              ({patient.tauxCouverture}%)
                            </span>
                          )}
                        </span>
                        {patient.telephone && (
                          <span>📞 {patient.telephone}</span>
                        )}
                      </div>
                    </div>
                  )}
                />
                {error && (
                  <p className="mt-1 text-sm text-red-600">
                    Erreur: {error}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date prélèvement *</label>
                <input
                  type="date"
                  value={factureData.datePrelevement}
                  onChange={(e) => setFactureData({...factureData, datePrelevement: e.target.value})}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Analyses à réaliser *</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-4">
                {analysesDisponibles.map(analyse => (
                  <label key={analyse.id} className="flex items-center space-x-3 hover:bg-gray-50 p-2 rounded cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded text-medical-primary focus:ring-medical-primary"
                      checked={factureData.analysesIds.includes(analyse.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFactureData({
                            ...factureData,
                            analysesIds: [...factureData.analysesIds, analyse.id]
                          });
                        } else {
                          setFactureData({
                            ...factureData,
                            analysesIds: factureData.analysesIds.filter(id => id !== analyse.id)
                          });
                        }
                      }}
                    />
                    <span className="text-sm">
                      <span className="font-medium">{analyse.libelle}</span>
                      <span className="text-gray-500"> - {formatMontant(analyse.tarif)}</span>
                    </span>
                  </label>
                ))}
              </div>
              {factureData.analysesIds.length > 0 && (
                <p className="mt-2 text-sm text-blue-600">
                  {factureData.analysesIds.length} analyse(s) sélectionnée(s) - Total estimé: {
                    formatMontant(factureData.analysesIds.reduce((sum, id) => sum + (analysesDisponibles.find(a => a.id === id)?.tarif || 0), 0))
                  }
                </p>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              <input 
                type="checkbox" 
                className="rounded text-red-600 focus:ring-red-600"
                checked={factureData.urgence}
                onChange={(e) => setFactureData({...factureData, urgence: e.target.checked})}
              />
              <label className="text-sm font-medium text-red-600">Analyse urgente</label>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Observations</label>
              <textarea
                value={factureData.observations}
                onChange={(e) => setFactureData({...factureData, observations: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                placeholder="Observations particulières..."
              />
            </div>
            
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingFacture(null);
                  setFactureData({
                    patientId: '', analysesIds: [], datePrelevement: '', urgence: false, observations: ''
                  });
                }}
                className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex items-center px-6 py-2 bg-medical-primary text-white rounded-lg"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingFacture ? 'Modifier' : 'Prescrire'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des analyses */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Analyses de laboratoire</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Prescription</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Analyses</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Clock className="w-8 h-8 text-gray-400 animate-spin mb-2" />
                      <p className="text-gray-500">Chargement des analyses...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredFacturations.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <TestTube className="w-12 h-12 text-gray-300 mb-3" />
                      <p className="text-gray-500 font-medium">Aucune analyse trouvée</p>
                      <p className="text-sm text-gray-400 mt-1">
                        {searchTerm || selectedStatus !== 'all'
                          ? 'Essayez de modifier vos filtres de recherche'
                          : 'Créez votre première prescription laboratoire'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredFacturations.map((facture) => (
                <tr key={facture.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{facture.numero}</div>
                    <div className="text-sm text-gray-500">{new Date(facture.date).toLocaleDateString('fr-FR')}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {facture.patient.prenom} {facture.patient.nom}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {facture.analyses.map((item, index) => (
                      <div key={`${facture.id}-analyse-${index}`} className="text-sm text-gray-900 mb-1">
                        {item.analyse.libelle}
                      </div>
                    ))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatMontant(facture.total)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(facture.statut)}`}>
                      {facture.statut === 'termine' ? 'Terminé' : 'En cours'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => setShowDetails(facture)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Voir détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEdit(facture)}
                        className="text-medical-primary hover:text-medical-primary-dark"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDownload(facture)}
                        className="text-green-600 hover:text-green-900"
                        title="Télécharger"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(facture)}
                        className="text-red-600 hover:text-red-900"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de détails */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Détails de la prescription {showDetails.numero}
                </h3>
                <button
                  onClick={() => setShowDetails(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Informations patient */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Informations patient</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p><span className="font-medium">Nom :</span> {showDetails.patient.prenom} {showDetails.patient.nom}</p>
                  <p><span className="font-medium">Assurance :</span> {showDetails.patient.assurance}</p>
                  <p><span className="font-medium">Date prélèvement :</span> {new Date(showDetails.datePrelevement).toLocaleDateString('fr-FR')}</p>
                  {showDetails.urgence && (
                    <p><span className="font-medium text-red-600">URGENCE</span></p>
                  )}
                </div>
              </div>
              
              {/* Analyses demandées */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Analyses demandées</h4>
                <div className="space-y-2">
                  {showDetails.analyses.map((item, index) => (
                    <div key={`${showDetails.id}-detail-analyse-${index}`} className="bg-gray-50 p-3 rounded flex justify-between items-center">
                      <div>
                        <span className="font-medium">{item.analyse.libelle}</span>
                        <span className="text-sm text-gray-500 block">{item.analyse.categorie} - {item.analyse.duree}h</span>
                        {item.resultat && item.resultat !== 'En cours' && (
                          <span className="text-sm text-blue-600 block">Résultat: {item.resultat}</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-medium">{formatMontant(item.analyse.tarif)}</span>
                        {item.statut === 'termine' && <CheckCircle className="w-5 h-5 text-green-500" />}
                        {item.statut === 'en_cours' && <Clock className="w-5 h-5 text-yellow-500" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Total */}
              <div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total :</span>
                  <span>{formatMontant(showDetails.total)}</span>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowDetails(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Fermer
              </button>
              <button 
                onClick={() => handleDownload(showDetails)}
                className="px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark"
              >
                Télécharger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacturationLabo;
