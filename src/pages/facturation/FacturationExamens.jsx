import React, { useState, useEffect } from 'react';
import {
  FileSearch,
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
  Calculator,
  CreditCard,
  Receipt,
  Stethoscope,
  Activity
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import SearchableSelect from '../../components/common/SearchableSelect';
import { useAlert } from '../../contexts/AlertContext';
import { generateFacturePDF } from '../../services/impression/facturePdf.js';
import ExamenCard from '../../components/facturation/ExamenCard';
import ExamenDetailsModal from '../../components/facturation/ExamenDetailsModal';
import { formatMontant } from '../../utils/currency';

const FacturationExamens = () => {
  const { showError, showSuccess, showWarning, showInfo } = useAlert();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedExamen, setSelectedExamen] = useState(null);
  const [showDetails, setShowDetails] = useState(null);
  const [editingFacture, setEditingFacture] = useState(null);
  const [factureData, setFactureData] = useState({
    patientId: '',
    examensSelectionnes: [], // Tableau pour plusieurs examens
    quantite: 1,
    tarifUnitaire: '',
    remise: 0,
    dateRealisation: '',
    observations: ''
  });

  // États pour les données réelles
  const [patients, setPatients] = useState([]);
  const [facturationExamens, setFacturationExamens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Charger les données depuis la base de données
  useEffect(() => {
    fetchPatients();
    fetchExamens();
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
        .order('nom', { ascending: true });

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

  const fetchExamens = async () => {
    try {
      console.log('🔄 Chargement des examens prescrits...');

      // Récupérer les examens prescrits sans les relations imbriquées
      const { data: examensData, error: examensError } = await supabase
        .from('examens_prescrits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (examensError) throw examensError;

      console.log('✅ Examens récupérés:', examensData?.length || 0);

      if (!examensData || examensData.length === 0) {
        setFacturationExamens([]);
        return;
      }

      // Récupérer les IDs uniques des patients et consultations
      const patientIds = [...new Set(examensData.map(e => e.patient_id).filter(Boolean))];
      const consultationIds = [...new Set(examensData.map(e => e.consultation_id).filter(Boolean))];

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

      // Récupérer les consultations avec les médecins
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
      const facturations = examensData.map((examen, index) => {
        const patient = patientsMap.get(examen.patient_id);
        const consultation = consultationsMap.get(examen.consultation_id);
        const medecin = consultation?.users;
        const assurance = patient?.assurances;
        const tauxCouverture = assurance?.taux_remboursement || 0;
        
        // Tarifs estimés basés sur le type d'examen
        const tarifEstime = getTarifEstime(examen.type_examen);
        const montantTotal = tarifEstime;
        const montantAssurance = (montantTotal * tauxCouverture) / 100;
        const montantPatient = montantTotal - montantAssurance;

        return {
          id: examen.id,
          numero: `FE-${new Date(examen.created_at).getFullYear()}-${String(index + 1).padStart(3, '0')}`,
          date: examen.date_prescription || examen.created_at?.split('T')[0],
          patient: {
            id: patient?.id,
            nom: patient?.nom || 'Inconnu',
            prenom: patient?.prenom || '',
            assurance: assurance?.nom || 'Sans assurance',
            tauxCouverture: tauxCouverture
          },
          examens: [
            {
              examen: {
                id: examen.id,
                libelle: examen.type_examen,
                code: `EX-${examen.id}`,
                categorie: getCategorieExamen(examen.type_examen),
                duree: 30
              },
              quantite: 1,
              tarifUnitaire: tarifEstime,
              realise: examen.statut === 'termine'
            }
          ],
          sousTotal: montantTotal,
          remise: 0,
          montantAssurance: montantAssurance,
          montantPatient: montantPatient,
          total: montantTotal,
          statut: mapStatut(examen.statut),
          medecin: medecin ? `Dr. ${medecin.prenom} ${medecin.nom}` : 'Non spécifié',
          dateRealisation: examen.date_realisation || examen.date_prescription
        };
      });

      console.log('✅ Facturations formatées:', facturations.length);
      setFacturationExamens(facturations);
    } catch (err) {
      console.error('❌ Erreur chargement examens:', err);
      setError(err.message);
    }
  };

  // Fonction pour estimer le tarif selon le type d'examen dentaire
  const getTarifEstime = (typeExamen) => {
    const tarifs = {
      'radiographie dentaire': 25000,
      'radiographie panoramique': 25000,
      'rétro-alvéolaire': 8000,
      'céphalométrique': 35000,
      'téléradiographie': 28000,
      'cone beam': 85000,
      'cbct': 85000,
      'scanner dentaire': 120000,
      'dentascan': 120000,
      'bilan buccal': 18000,
      'test pulpaire': 12000,
      'prélèvement bactérien': 15000,
      'échographie glandes salivaires': 30000,
      'modélisation 3d': 45000,
      'orthodontique': 45000,
      'analyse occlusale': 22000
    };

    const type = typeExamen.toLowerCase();
    for (const [key, tarif] of Object.entries(tarifs)) {
      if (type.includes(key)) return tarif;
    }
    return 25000; // Tarif par défaut dentaire
  };

  // Fonction pour déterminer la catégorie dentaire
  const getCategorieExamen = (typeExamen) => {
    const type = typeExamen.toLowerCase();
    if (type.includes('radio') || type.includes('radiographie')) return 'Radiologie dentaire';
    if (type.includes('cone') || type.includes('cbct') || type.includes('scanner') || type.includes('3d') || type.includes('modélisation')) return 'Imagerie 3D dentaire';
    if (type.includes('échographie') || type.includes('echo')) return 'Échographie dentaire';
    if (type.includes('bilan') || type.includes('test') || type.includes('prélèvement') || type.includes('bactéri')) return 'Biologie dentaire';
    if (type.includes('analyse') || type.includes('occlusale') || type.includes('sensibilité')) return 'Diagnostic dentaire';
    return 'Diagnostic dentaire';
  };

  // Mapper le statut de la DB vers le statut d'affichage
  const mapStatut = (statutDB) => {
    const mapping = {
      'prescrit': 'programme',
      'en_cours': 'en_cours',
      'termine': 'payee',
      'annule': 'annule'
    };
    return mapping[statutDB] || 'programme';
  };

  // Examens disponibles (uniquement dentaire)
  const examensDisponibles = [
    { id: 1, code: 'RAD001', libelle: 'Radiographie dentaire panoramique', tarif: 25000, categorie: 'Radiologie dentaire', duree: 15 },
    { id: 2, code: 'RAD002', libelle: 'Radiographie rétro-alvéolaire', tarif: 8000, categorie: 'Radiologie dentaire', duree: 5 },
    { id: 3, code: 'RAD003', libelle: 'Radiographie céphalométrique', tarif: 35000, categorie: 'Radiologie dentaire', duree: 20 },
    { id: 4, code: 'CONE001', libelle: 'Cone Beam (CBCT)', tarif: 85000, categorie: 'Imagerie 3D dentaire', duree: 30 },
    { id: 5, code: 'BIO001', libelle: 'Bilan buccal pré-opératoire', tarif: 18000, categorie: 'Biologie dentaire', duree: 10 },
    { id: 6, code: 'BIO002', libelle: 'Test de sensibilité pulpaire', tarif: 12000, categorie: 'Diagnostic dentaire', duree: 15 },
    { id: 7, code: 'BIO003', libelle: 'Prélèvement bactérien', tarif: 15000, categorie: 'Biologie dentaire', duree: 10 },
    { id: 8, code: 'SCAN001', libelle: 'Scanner dentaire (Dentascan)', tarif: 120000, categorie: 'Imagerie 3D dentaire', duree: 45 },
    { id: 9, code: 'ECHO001', libelle: 'Échographie glandes salivaires', tarif: 30000, categorie: 'Échographie dentaire', duree: 20 },
    { id: 10, code: 'DOC001', libelle: 'Modélisation 3D orthodontique', tarif: 45000, categorie: 'Imagerie 3D dentaire', duree: 25 },
    { id: 11, code: 'DOC002', libelle: 'Analyse occlusale', tarif: 22000, categorie: 'Diagnostic dentaire', duree: 30 },
    { id: 12, code: 'DOC003', libelle: 'Téléradiographie', tarif: 28000, categorie: 'Radiologie dentaire', duree: 10 }
  ];


  const categories = ['Radiologie dentaire', 'Imagerie 3D dentaire', 'Biologie dentaire', 'Diagnostic dentaire', 'Échographie dentaire'];

  const filteredFacturations = facturationExamens.filter(facture => {
    const matchesSearch = facture.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         `${facture.patient.prenom} ${facture.patient.nom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         facture.medecin.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || facture.statut === selectedStatus;
    const matchesType = selectedType === 'all' || 
                       facture.examens.some(e => e.examen.categorie === selectedType);
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFactureData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
    if (editingFacture) {
      console.log('Modification facturation examen:', factureData);
      showSuccess('Facturation examen modifiée avec succès!');
      setEditingFacture(null);
    } else {
        console.log('🔄 Programmation de nouveaux examens...');
        
        // Vérifier qu'au moins un examen est sélectionné
        if (!factureData.examensSelectionnes || factureData.examensSelectionnes.length === 0) {
          showWarning('Veuillez sélectionner au moins un examen');
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
            motif: `Examens: ${factureData.examensSelectionnes.map(e => e.libelle).join(', ')}`,
            statut: 'terminee'
          })
          .select()
          .single();

        if (consultationError) throw consultationError;
        console.log('✅ Consultation créée:', consultationData.id);

        // 3. Créer les examens prescrits (plusieurs examens possibles)
        const examensToInsert = factureData.examensSelectionnes.map(examen => ({
          consultation_id: consultationData.id,
          patient_id: factureData.patientId,
          type_examen: examen.libelle,
          description: factureData.observations,
          date_prescription: new Date().toISOString().split('T')[0],
          date_realisation: factureData.dateRealisation,
          statut: 'prescrit',
          notes: factureData.observations
        }));

        console.log('🔄 Insertion des examens:', examensToInsert);

        const { data: examensData, error: examensError } = await supabase
          .from('examens_prescrits')
          .insert(examensToInsert)
          .select();

        if (examensError) throw examensError;
        console.log('✅ Examens prescrits créés:', examensData?.length || 0, 'examens');

      showSuccess('Nouveaux examens programmés avec succès!');
        
        // Recharger les examens
        await fetchExamens();
    }
      
    setShowForm(false);
    setFactureData({
      patientId: '', examensSelectionnes: [], quantite: 1, tarifUnitaire: '', remise: 0, 
      dateRealisation: '', observations: ''
    });
    } catch (error) {
      console.error('❌ Erreur lors de la programmation:', error);
      showError(`Erreur: ${error.message}`);
    }
  };

  const handleEdit = (facture) => {
    setEditingFacture(facture);
    // Pré-remplir avec les examens existants
    const examensSelectionnes = facture.examens.map(examen => ({
      ...examen.examen,
      quantite: examen.quantite || 1,
      tarifUnitaire: examen.tarifUnitaire || examen.examen.tarif || 0
    }));
    
    setFactureData({
      patientId: facture.patient.id,
      examensSelectionnes: examensSelectionnes,
      quantite: 1,
      tarifUnitaire: '',
      remise: facture.remise || 0,
      dateRealisation: facture.dateRealisation || '',
      observations: facture.observations || ''
    });
    setShowForm(true);
  };

  const handleDelete = (facture) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la facturation ${facture.numero} ?`)) {
      console.log('Suppression facturation examen:', facture.id);
      showSuccess('Facturation supprimée avec succès!');
    }
  };

  const handleDownload = async (facture) => {
    console.log('Téléchargement facturation examen:', facture.numero);
    showInfo(`Téléchargement de la facturation ${facture.numero} en cours...`);

    try {
      const result = await generateFacturePDF(supabase, facture, false, null);
      if (result.success) {
        showSuccess(`Facturation ${facture.numero} téléchargée avec succès!`);
      } else {
        showError(`Erreur lors du téléchargement: ${result.error}`);
      }
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      showError('Erreur lors du téléchargement de la facturation');
    }
  };

  const getStatusColor = (statut) => {
    switch (statut) {
      case 'payee': return 'bg-green-100 text-green-800';
      case 'programme': return 'bg-blue-100 text-blue-800';
      case 'en_cours': return 'bg-yellow-100 text-yellow-800';
      case 'annule': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (statut) => {
    switch (statut) {
      case 'payee': return 'Payée';
      case 'programme': return 'Programmé';
      case 'en_cours': return 'En cours';
      case 'annule': return 'Annulé';
      default: return statut;
    }
  };

  const calculateTotal = () => {
    if (!factureData.examensSelectionnes || factureData.examensSelectionnes.length === 0) {
      return { total: 0, sousTotal: 0, remise: 0, partAssurance: 0, partPatient: 0, tauxCouverture: 0 };
    }
    
    // Calculer le sous-total pour tous les examens sélectionnés
    const sousTotal = factureData.examensSelectionnes.reduce((sum, examen) => {
      return sum + ((examen.tarifUnitaire || examen.tarif || 0) * (examen.quantite || 1));
    }, 0);
    
    const montantRemise = (sousTotal * factureData.remise) / 100;
    const total = sousTotal - montantRemise;
    
    // Récupérer le taux de couverture du patient sélectionné
    const patient = patients.find(p => p.id === factureData.patientId);
    const tauxCouverture = patient?.assurances?.taux_remboursement || 0;
    
    const partAssurance = (total * tauxCouverture) / 100;
    const partPatient = total - partAssurance;
    
    return {
      total,
      sousTotal,
      remise: montantRemise,
      partAssurance,
      partPatient,
      tauxCouverture
    };
  };

  return (
    <div className="space-y-4 p-3 sm:p-4">
      {/* En-tête compact */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturation des Examens</h1>
          <p className="text-sm text-gray-600">Gestion et facturation des examens médicaux</p>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => setShowForm(true)}
            className="flex items-center px-3 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors text-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Programmer
          </button>
        </div>
      </div>

      {/* Statistiques compact */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-lg shadow-md p-3 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FileSearch className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">Total</p>
              <p className="text-xl font-semibold text-gray-900">{facturationExamens.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-3 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">Réalisés</p>
              <p className="text-xl font-semibold text-gray-900">
                {facturationExamens.filter(f => f.statut === 'payee').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-3 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">Programmés</p>
              <p className="text-xl font-semibold text-gray-900">
                {facturationExamens.filter(f => f.statut === 'programme').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-3 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Activity className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">En cours</p>
              <p className="text-xl font-semibold text-gray-900">
                {facturationExamens.filter(f => f.statut === 'en_cours').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-3 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Coins className="w-8 h-8 text-medical-primary" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">CA</p>
              <p className="text-xl font-semibold text-gray-900">
                {formatMontant(facturationExamens.reduce((sum, f) => sum + f.total, 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Barre de recherche et filtres compact */}
      <div className="bg-white rounded-lg shadow-md p-3 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Rechercher</label>
            <div className="flex">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="N° facture, patient, médecin..."
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent text-sm"
              />
              <button className="px-3 py-1.5 bg-medical-primary text-white rounded-r-lg hover:bg-medical-primary-dark transition-colors">
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Statut</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent text-sm"
            >
              <option value="all">Tous</option>
              <option value="payee">Réalisés</option>
              <option value="programme">Programmés</option>
              <option value="en_cours">En cours</option>
              <option value="annule">Annulés</option>
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent text-sm"
            >
              <option value="all">Tous</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <button className="flex items-center px-3 py-1.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm">
              <Filter className="w-4 h-4 mr-1.5" />
              Filtres
            </button>
          </div>
        </div>
      </div>

      {/* Formulaire de programmation d'examen */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Plus className="w-5 h-5 mr-2" />
              {editingFacture ? 'Modifier l\'examen' : 'Programmer un examen'}
            </h3>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingFacture(null);
                setFactureData({
                  patientId: '', examenId: '', quantite: 1, tarifUnitaire: '', remise: 0, 
                  dateRealisation: '', observations: ''
                });
              }}
              className="text-gray-400 hover:text-gray-600"
            >
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Examens * ({factureData.examensSelectionnes.length} sélectionné(s))
                </label>
                <div className="max-h-64 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                  {examensDisponibles.map((examen) => {
                    const isSelected = factureData.examensSelectionnes.some(e => e.id === examen.id);
                    
                    return (
                      <label
                        key={examen.id}
                        className={`flex items-center p-3 rounded cursor-pointer border ${
                          isSelected 
                            ? 'bg-blue-50 border-blue-300' 
                            : 'hover:bg-gray-50 border-gray-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFactureData({
                                ...factureData,
                                examensSelectionnes: [...factureData.examensSelectionnes, examen]
                              });
                            } else {
                              setFactureData({
                                ...factureData,
                                examensSelectionnes: factureData.examensSelectionnes.filter(e => e.id !== examen.id)
                              });
                            }
                          }}
                          className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">
                              {examen.code} - {examen.libelle}
                            </span>
                            <span className="text-sm text-gray-600 font-medium">
                              {formatMontant(examen.tarif)}
                            </span>
                          </div>
                          <div className="flex items-center text-xs text-gray-500 mt-1">
                            <span className="mr-3">📋 {examen.categorie}</span>
                            <span>⏱️ {examen.duree} min</span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {factureData.examensSelectionnes.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    Veuillez sélectionner au moins un examen
                  </p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date de réalisation *</label>
                <input
                  type="date"
                  name="dateRealisation"
                  value={factureData.dateRealisation}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantité *</label>
                <input
                  type="number"
                  name="quantite"
                  value={factureData.quantite}
                  onChange={handleInputChange}
                  min="1"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Remise (%)</label>
                <input
                  type="number"
                  name="remise"
                  value={factureData.remise}
                  onChange={handleInputChange}
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Total estimé</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-medium">
                  {formatMontant(calculateTotal().total)}
                </div>
              </div>
            </div>
            
            {/* Détails de la facturation */}
            {factureData.patientId && factureData.examensSelectionnes.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Détails de la facturation</h4>
                <div className="space-y-2 text-sm mb-3">
                  {factureData.examensSelectionnes.map((examen, index) => (
                    <div key={examen.id} className="flex justify-between items-center py-2 border-b border-blue-100">
                      <div>
                        <span className="font-medium text-gray-900">{examen.code} - {examen.libelle}</span>
                        <div className="text-xs text-gray-500">
                          Quantité: {examen.quantite || 1} × {formatMontant(examen.tarifUnitaire || examen.tarif || 0)}
                        </div>
                      </div>
                      <span className="font-medium">
                        {formatMontant((examen.tarifUnitaire || examen.tarif || 0) * (examen.quantite || 1))}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sous-total :</span>
                    <span className="font-medium">{formatMontant(calculateTotal().sousTotal)}</span>
                  </div>
                  {calculateTotal().remise > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Remise ({factureData.remise}%) :</span>
                      <span className="font-medium">-{formatMontant(calculateTotal().remise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-600">Total :</span>
                    <span className="font-bold text-lg">{formatMontant(calculateTotal().total)}</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between text-blue-600">
                      <span>Part assurance ({calculateTotal().tauxCouverture}%) :</span>
                      <span className="font-medium">{formatMontant(calculateTotal().partAssurance)}</span>
                    </div>
                    <div className="flex justify-between text-orange-600">
                      <span>Part patient :</span>
                      <span className="font-bold">{formatMontant(calculateTotal().partPatient)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Observations</label>
              <textarea
                name="observations"
                value={factureData.observations}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                placeholder="Instructions particulières pour l'examen..."
              />
            </div>
            
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingFacture(null);
                  setFactureData({
                    patientId: '', examenId: '', quantite: 1, tarifUnitaire: '', remise: 0, 
                    dateRealisation: '', observations: ''
                  });
                }}
                className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex items-center px-6 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingFacture ? 'Modifier' : 'Programmer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des examens compact */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Examens programmés et réalisés</h2>
          <p className="text-xs text-gray-600">{filteredFacturations.length} examen(s) trouvé(s)</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  N°
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Examens
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Clock className="w-6 h-6 text-gray-400 animate-spin mb-2" />
                      <p className="text-sm text-gray-500">Chargement...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredFacturations.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <FileSearch className="w-10 h-10 text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500 font-medium">Aucun examen</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredFacturations.map((facture) => (
                  <ExamenCard
                    key={facture.id}
                    facture={facture}
                    onView={setShowDetails}
                    onEdit={handleEdit}
                    onDownload={handleDownload}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de détails compact */}
      <ExamenDetailsModal
        facture={showDetails}
        onClose={() => setShowDetails(null)}
        onDownload={handleDownload}
      />
    </div>
  );
};

export default FacturationExamens;
