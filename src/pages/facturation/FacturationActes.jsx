import React, { useState, useEffect } from 'react';
import { useTypesActes } from '../../hooks/useTypesActes';
import { 
  Activity, 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Trash2,
  Eye,
  Download,
  Printer,
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
  Receipt
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import SearchableSelect from '../../components/common/SearchableSelect';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateFacturePDF } from '../../services/impression/facturePdf.js';
import { useToast } from '../../hooks/useToast';
import { formatMontant } from '../../utils/currency';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import FactureCard from '../../components/facturation/FactureCard';
import FactureDetailsModal from '../../components/facturation/FactureDetailsModal';
import Pagination from '../../components/common/Pagination';

const ITEMS_PER_PAGE = 20;

const FacturationActes = () => {
  const { tenantId } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedActe, setSelectedActe] = useState(null);
  const [showDetails, setShowDetails] = useState(null);
  const [editingFacture, setEditingFacture] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [factureData, setFactureData] = useState({
    patientId: '',
    actesSelectionnes: [], // Tableau pour plusieurs actes
    quantite: 1,
    tarifUnitaire: '',
    remise: 0,
    observations: ''
  });

  // États pour les données réelles
  const [patients, setPatients] = useState([]);
  const [facturationActes, setFacturationActes] = useState([]);
  
  // Utilisation du hook pour les actes disponibles
  const { typesActes, loading: loadingActes } = useTypesActes();
  // Adapter le format des actes du hook pour ce composant
  const actesDisponibles = (typesActes || []).map(acte => ({
        id: acte.id,
        code: acte.code_ccam || `ACT-${acte.id}`,
        libelle: acte.nom,
        tarif: acte.tarif_defaut || 0,
        description: acte.description || '',
        categorie: acte.specialite_id ? 'Spécialisé' : 'Général',
        duree_estimee: acte.duree_estimee || null
  }));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Hooks pour les notifications
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { dialogState, showConfirm, closeDialog } = useConfirmDialog();

  // Charger les données depuis la base de données
  useEffect(() => {
    fetchPatients();
    fetchFacturations();
    // fetchActesDisponibles() n'est plus nécessaire car géré par le hook
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

  const fetchFacturations = async () => {
    try {
      console.log('🔄 Chargement des facturations d\'actes...');

      // Récupérer les actes de consultation avec toutes les relations
      const { data: actesData, error: actesError } = await supabase
        .from('actes_consultation')
        .select(`
          id,
          quantite,
          tarif_unitaire,
          montant_total,
          notes,
          created_at,
          consultation_id,
          consultations (
            id,
            date_consultation,
            patients (
              id,
              nom,
              prenom,
              assurance_id,
              assurances (
                nom,
                taux_remboursement
              )
            ),
            users (
              id,
              nom,
              prenom
            )
          ),
          types_actes (
            id,
            nom,
            description
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (actesError) throw actesError;

      console.log('✅ Actes récupérés:', actesData?.length || 0);

      // Transformer les données pour correspondre au format attendu
      const facturations = actesData?.map((acte, index) => {
        const patient = acte.consultations?.patients;
        const medecin = acte.consultations?.users;
        const assurance = patient?.assurances;
        const tauxCouverture = assurance?.taux_remboursement || 0;
        
        const montantTotal = acte.montant_total || 0;
        const montantAssurance = (montantTotal * tauxCouverture) / 100;
        const montantPatient = montantTotal - montantAssurance;

        return {
          id: acte.id,
          consultation_id: acte.consultation_id,
          numero: `FA-${new Date(acte.created_at).getFullYear()}-${String(index + 1).padStart(3, '0')}`,
          date: acte.consultations?.date_consultation || acte.created_at?.split('T')[0],
          patient: {
            id: patient?.id,
            nom: patient?.nom || 'Inconnu',
            prenom: patient?.prenom || '',
            assurance: assurance?.nom || 'Sans assurance',
            tauxCouverture: tauxCouverture
          },
      actes: [
            {
              acte: {
                id: acte.types_actes?.id,
                libelle: acte.types_actes?.nom || 'Acte médical',
                code: `ACT-${acte.types_actes?.id || acte.id}`
              },
              quantite: acte.quantite || 1,
              tarifUnitaire: parseFloat(acte.tarif_unitaire) || 0
            }
          ],
          sousTotal: montantTotal,
      remise: 0,
          montantAssurance: montantAssurance,
          montantPatient: montantPatient,
          total: montantTotal,
          statut: 'paye', // À adapter selon votre logique
          medecin: medecin ? `Dr. ${medecin.prenom} ${medecin.nom}` : 'Non spécifié'
        };
      }) || [];

      console.log('✅ Facturations formatées:', facturations.length);
      setFacturationActes(facturations);
    } catch (err) {
      console.error('❌ Erreur chargement facturations:', err);
      setError(err.message);
    }
  };




  const filteredFacturations = facturationActes.filter(facture => {
    const matchesSearch = facture.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         `${facture.patient.prenom} ${facture.patient.nom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         facture.medecin.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || facture.statut === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredFacturations.length / ITEMS_PER_PAGE));
  const paginatedFacturations = filteredFacturations.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Si c'est un changement d'acte, pré-remplir le tarif
    if (name === 'acteId' && value) {
      const acteSelectionne = actesDisponibles.find(a => a.id === parseInt(value));
      if (acteSelectionne) {
        setFactureData(prev => ({
          ...prev,
          [name]: value,
          tarifUnitaire: acteSelectionne.tarif || ''
        }));
        return;
      }
    }
    
    setFactureData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingFacture) {
        console.log('Modification facturation:', factureData);
        showSuccess('Facturation modifiée avec succès!');
        setEditingFacture(null);
      } else {
        console.log('🔄 Création nouvelle facturation d\'actes...');
        
        // Vérifier qu'au moins un acte est sélectionné
        if (!factureData.actesSelectionnes || factureData.actesSelectionnes.length === 0) {
          showWarning('Veuillez sélectionner au moins un acte');
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
            motif: `Actes: ${factureData.actesSelectionnes.map(a => a.libelle).join(', ')}`,
            statut: 'terminee'
          })
          .select()
          .single();

        if (consultationError) throw consultationError;
        console.log('✅ Consultation créée:', consultationData.id);

        // 2. Créer les actes de consultation (plusieurs actes possibles)
        const actesToInsert = factureData.actesSelectionnes.map(acte => ({
          consultation_id: consultationData.id,
          type_acte_id: parseInt(acte.id),
          quantite: parseInt(acte.quantite) || 1,
          tarif_unitaire: parseFloat(acte.tarifUnitaire || acte.tarif || 0),
          notes: factureData.observations || null
        }));

        console.log('🔄 Insertion des actes:', actesToInsert);
        console.log('🔍 Consultation ID:', consultationData.id);
        console.log('🔍 Actes sélectionnés:', factureData.actesSelectionnes.map(a => ({ id: a.id, libelle: a.libelle })));

        // Vérifier que tous les type_acte_id existent dans types_actes
        const typeActeIds = actesToInsert.map(a => a.type_acte_id);
        console.log('🔍 Type acte IDs à vérifier:', typeActeIds);
        
        const { data: existingTypesActes, error: typesCheckError } = await supabase
          .from('types_actes')
          .select('id')
          .in('id', typeActeIds);

        if (typesCheckError) {
          console.error('❌ Erreur vérification types_actes:', typesCheckError);
          throw typesCheckError;
        }

        const existingTypeIds = existingTypesActes?.map(t => t.id) || [];
        const missingTypeIds = typeActeIds.filter(id => !existingTypeIds.includes(id));

        if (missingTypeIds.length > 0) {
          console.error('❌ Types d\'actes manquants dans la base:', missingTypeIds);
          console.error('❌ Types existants:', existingTypeIds);
          
          // Afficher les détails des actes manquants
          const missingActes = factureData.actesSelectionnes.filter(a => 
            missingTypeIds.includes(parseInt(a.id))
          );
          console.error('❌ Actes manquants:', missingActes.map(a => ({ id: a.id, libelle: a.libelle })));
          
          throw new Error(`Les types d'actes suivants n'existent pas: ${missingTypeIds.join(', ')}`);
        }

        console.log('✅ Tous les types d\'actes sont valides');

        // Vérifier d'abord si des actes existent déjà pour cette consultation
        const { data: existingActes, error: checkError } = await supabase
          .from('actes_consultation')
          .select('consultation_id, type_acte_id')
          .eq('consultation_id', consultationData.id);

        if (checkError) {
          console.error('❌ Erreur vérification actes existants:', checkError);
        } else {
          console.log('🔍 Actes existants pour cette consultation:', existingActes);
          
          // Vérifier les doublons potentiels
          const duplicates = existingActes?.filter(existing => 
            actesToInsert.some(newActe => 
              existing.type_acte_id === newActe.type_acte_id
            )
          );
          
          if (duplicates && duplicates.length > 0) {
            console.warn('⚠️ Doublons détectés:', duplicates);
            // Filtrer les actes qui existent déjà
            const existingTypeIds = existingActes.map(a => a.type_acte_id);
            const newActesOnly = actesToInsert.filter(acte => 
              !existingTypeIds.includes(acte.type_acte_id)
            );
            console.log('🔄 Actes réellement à insérer (sans doublons):', newActesOnly);
            
            if (newActesOnly.length === 0) {
              console.warn('⚠️ Tous les actes existent déjà, pas d\'insertion nécessaire');
              showSuccess('Facturation créée avec succès (actes déjà existants)!');
              await fetchFacturations();
              setShowForm(false);
              setFactureData({
                patientId: '', actesSelectionnes: [], quantite: 1, tarifUnitaire: '', remise: 0, observations: ''
              });
              return;
            }
            
            // Utiliser uniquement les nouveaux actes
            const { data: actesData, error: actesError } = await supabase
              .from('actes_consultation')
              .insert(newActesOnly)
              .select();

            if (actesError) throw actesError;
            console.log('✅ Actes de consultation créés:', actesData?.length || 0, 'actes');
          } else {
            // Insérer tous les actes (pas de doublons)
            const { data: actesData, error: actesError } = await supabase
              .from('actes_consultation')
              .insert(actesToInsert)
              .select();

            if (actesError) {
              console.error('❌ Erreur détaillée insertion actes:', actesError);
              console.error('❌ Détails de l\'erreur:', {
                message: actesError.message,
                details: actesError.details,
                hint: actesError.hint,
                code: actesError.code
              });
              throw actesError;
            }
            console.log('✅ Actes de consultation créés:', actesData?.length || 0, 'actes');
          }
        }

      showSuccess('Nouvelle facturation créée avec succès!');
        
        // Recharger les facturations
        await fetchFacturations();
    }
      
    setShowForm(false);
    setFactureData({
      patientId: '', actesSelectionnes: [], quantite: 1, tarifUnitaire: '', remise: 0, observations: ''
    });
    } catch (error) {
      console.error('❌ Erreur lors de la création:', error);
      showError(`Erreur: ${error.message}`);
    }
  };

  const handleEdit = (facture) => {
    setEditingFacture(facture);
    // Pré-remplir avec les actes existants
    const actesSelectionnes = facture.actes.map(acte => ({
      ...acte.acte,
      quantite: acte.quantite || 1,
      tarifUnitaire: acte.tarifUnitaire || acte.acte.tarif || 0
    }));
    
    setFactureData({
      patientId: facture.patient.id,
      actesSelectionnes: actesSelectionnes,
      quantite: 1,
      tarifUnitaire: '',
      remise: facture.remise || 0,
      observations: facture.observations || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (facture) => {
    const confirmed = await showConfirm({
      title: 'Confirmer la suppression',
      message: `Êtes-vous sûr de vouloir supprimer la facture ${facture.numero} ?`,
      type: 'warning',
      confirmText: 'Supprimer',
      cancelText: 'Annuler'
    });
    
    if (confirmed) {
      console.log('Suppression facture:', facture.id);
      // TODO: Implémenter la suppression réelle
      showSuccess('Facture supprimée avec succès!');
    }
  };

  const handleDownload = async (facture) => {
    console.log('📄 Génération PDF pour téléchargement:', facture.numero);
    const { success, error } = await generateFacturePDF(supabase, facture, false, tenantId);
    if (!success) {
      showError(`Erreur lors du téléchargement: ${error}`);
    }
  };

  const handlePrint = async (facture) => {
    console.log('🖨️ Génération PDF pour impression:', facture.numero);
    const { success, error } = await generateFacturePDF(supabase, facture, true, tenantId);
    if (!success) {
      showError(`Erreur lors de l'impression: ${error}`);
    }
  };

  const getStatusColor = (statut) => {
    switch (statut) {
      case 'payee': return 'bg-green-100 text-green-800';
      case 'en_attente': return 'bg-yellow-100 text-yellow-800';
      case 'impayee': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (statut) => {
    switch (statut) {
      case 'payee': return 'Payée';
      case 'en_attente': return 'En attente';
      case 'impayee': return 'Impayée';
      default: return statut;
    }
  };

  const calculateTotal = () => {
    if (!factureData.actesSelectionnes || factureData.actesSelectionnes.length === 0) {
      return { total: 0, sousTotal: 0, remise: 0, partAssurance: 0, partPatient: 0, tauxCouverture: 0 };
    }
    
    // Calculer le sous-total pour tous les actes sélectionnés
    const sousTotal = factureData.actesSelectionnes.reduce((sum, acte) => {
      return sum + ((acte.tarifUnitaire || acte.tarif || 0) * (acte.quantite || 1));
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
          <h1 className="text-2xl font-bold text-gray-900">Facturation des Actes</h1>
          <p className="text-sm text-gray-600">Gestion et facturation des actes médicaux</p>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => setShowForm(true)}
            className="flex items-center px-3 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors text-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nouvelle
          </button>
        </div>
      </div>

      {/* Statistiques compact */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg shadow-md p-3 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Receipt className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">Total factures</p>
              <p className="text-xl font-semibold text-gray-900">{facturationActes.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-3 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">Payées</p>
              <p className="text-xl font-semibold text-gray-900">
                {facturationActes.filter(f => f.statut === 'payee').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-3 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-500">En attente</p>
              <p className="text-xl font-semibold text-gray-900">
                {facturationActes.filter(f => f.statut === 'en_attente').length}
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
                {formatMontant(facturationActes.reduce((sum, f) => sum + f.total, 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Barre de recherche et filtres compact */}
      <div className="bg-white rounded-lg shadow-md p-3 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
              <option value="all">Tous les statuts</option>
              <option value="payee">Payées</option>
              <option value="en_attente">En attente</option>
              <option value="impayee">Impayées</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button className="flex items-center px-3 py-1.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm">
              <Filter className="w-4 h-4 mr-1.5" />
              Filtres avancés
            </button>
          </div>
        </div>
      </div>

      {/* Formulaire de nouvelle facturation */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Plus className="w-5 h-5 mr-2" />
              {editingFacture ? 'Modifier la facturation' : 'Nouvelle facturation d\'acte'}
            </h3>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingFacture(null);
                setFactureData({
                  patientId: '', actesSelectionnes: [], quantite: 1, tarifUnitaire: '', remise: 0, observations: ''
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Actes *</label>
                <div className="space-y-2">
                  {actesDisponibles.length === 0 ? (
                    <div className="flex items-center justify-center p-4 border border-gray-300 rounded-lg bg-gray-50">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-medical-primary mr-2"></div>
                      <span className="text-sm text-gray-600">Chargement des actes...</span>
                    </div>
                  ) : (
                    <div>
                      <SearchableSelect
                        options={actesDisponibles.map(acte => ({
                          id: acte.id,
                          label: `${acte.code} - ${acte.libelle}`,
                          code: acte.code,
                          libelle: acte.libelle,
                          tarif: acte.tarif,
                          description: acte.description,
                          categorie: acte.categorie,
                          telephone: `${formatMontant(acte.tarif)}${acte.description ? ` - ${acte.description}` : ''}${acte.categorie ? ` (${acte.categorie})` : ''}`
                        }))}
                        value=""
                        onChange={(value) => {
                          // Ajouter un acte à la sélection
                          const acteSelectionne = actesDisponibles.find(a => a.id === parseInt(value));
                          if (acteSelectionne && !factureData.actesSelectionnes.find(a => a.id === acteSelectionne.id)) {
                            setFactureData(prev => ({
                              ...prev,
                              actesSelectionnes: [...prev.actesSelectionnes, {
                                ...acteSelectionne,
                                quantite: 1,
                                tarifUnitaire: acteSelectionne.tarif || 0
                              }]
                            }));
                          }
                        }}
                        placeholder="Sélectionner un acte à ajouter..."
                        label="Ajouter un acte"
                        searchPlaceholder="Rechercher par code, libellé, description..."
                        emptyMessage="Aucun acte trouvé"
                        renderOption={(option) => (
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">
                              {option.label}
                            </span>
                            {option.telephone && (
                              <span className="text-xs text-gray-500 mt-1">
                                {option.telephone}
                              </span>
                            )}
                          </div>
                        )}
                      />
                      
                      {/* Liste des actes sélectionnés */}
                      {factureData.actesSelectionnes.length > 0 && (
                        <div className="mt-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                          <h4 className="font-medium text-gray-900 mb-2">Actes sélectionnés :</h4>
                          {factureData.actesSelectionnes.map((acte, index) => (
                            <div key={acte.id} className="flex items-center justify-between p-2 bg-white rounded border mb-2">
                              <div className="flex-1">
                                <span className="font-medium">{acte.code} - {acte.libelle}</span>
                                <div className="flex items-center space-x-2 mt-1">
                                  <input
                                    type="number"
                                    min="1"
                                    value={acte.quantite || 1}
                                    onChange={(e) => {
                                      const newQuantite = parseInt(e.target.value) || 1;
                                      setFactureData(prev => ({
                                        ...prev,
                                        actesSelectionnes: prev.actesSelectionnes.map((a, i) => 
                                          i === index ? {...a, quantite: newQuantite} : a
                                        )
                                      }));
                                    }}
                                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                    placeholder="Qté"
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={acte.tarifUnitaire || acte.tarif || 0}
                                    onChange={(e) => {
                                      const newTarif = parseFloat(e.target.value) || 0;
                                      setFactureData(prev => ({
                                        ...prev,
                                        actesSelectionnes: prev.actesSelectionnes.map((a, i) => 
                                          i === index ? {...a, tarifUnitaire: newTarif} : a
                                        )
                                      }));
                                    }}
                                    className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                                    placeholder="Tarif unitaire"
                                  />
                                  <span className="text-sm text-gray-600">
                                    = {formatMontant((acte.quantite || 1) * (acte.tarifUnitaire || acte.tarif || 0))}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setFactureData(prev => ({
                                    ...prev,
                                    actesSelectionnes: prev.actesSelectionnes.filter((_, i) => i !== index)
                                  }));
                                }}
                                className="ml-2 text-red-600 hover:text-red-800"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <p className="mt-1 text-xs text-gray-500">
                        {actesDisponibles.length} acte(s) disponible(s)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            {factureData.patientId && factureData.actesSelectionnes.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Détails de la facturation</h4>
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
                    patientId: '', acteId: '', quantite: 1, tarifUnitaire: '', remise: 0, observations: ''
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
                {editingFacture ? 'Modifier' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des facturations compact */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Facturations d'actes</h2>
          <p className="text-xs text-gray-600">{filteredFacturations.length} facturation(s) trouvée(s)</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  N° Facture
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actes
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
                  <td colSpan="6" className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Clock className="w-6 h-6 text-gray-400 animate-spin mb-2" />
                      <p className="text-sm text-gray-500">Chargement...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredFacturations.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Receipt className="w-10 h-10 text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500 font-medium">Aucune facturation</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedFacturations.map((facture) => (
                  <FactureCard
                    key={facture.id}
                    facture={facture}
                    onView={setShowDetails}
                    onEdit={handleEdit}
                    onDownload={handleDownload}
                    onPrint={handlePrint}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredFacturations.length > 0 && (
          <div className="border-t border-gray-200">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Modal de détails compact */}
      <FactureDetailsModal
        facture={showDetails}
        onClose={() => setShowDetails(null)}
        onDownload={handleDownload}
        onPrint={handlePrint}
      />

      {/* Modal de confirmation */}
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onClose={closeDialog}
        onConfirm={dialogState.onConfirm}
        onCancel={dialogState.onCancel}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        showCancel={dialogState.showCancel}
      />
    </div>
  );
};

export default FacturationActes;
