import React, { useState, useEffect } from 'react';
import { formatMontant } from '../../utils/currency';
import {
  Pill,
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
  ShoppingCart,
  Package,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import SearchableSelect from '../../components/common/SearchableSelect';
import { useAlert } from '../../contexts/AlertContext';

const FacturationPharmacie = () => {
  const { showError, showSuccess, showWarning, showInfo } = useAlert();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(null);
  const [editingFacture, setEditingFacture] = useState(null);
  const [medicaments, setMedicaments] = useState([]);
  const [factureData, setFactureData] = useState({
    patientId: '',
    medicamentId: '',
    quantite: 1,
    observations: ''
  });

  // États pour les données réelles
  const [patients, setPatients] = useState([]);
  const [ventesPharmacies, setVentesPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingVentes, setLoadingVentes] = useState(true);

  // Charger les données depuis la base de données
  useEffect(() => {
    fetchPatients();
    fetchVentesPharmacies();
  }, []);

  // Mettre à jour le loading global quand les deux sont terminés
  useEffect(() => {
    if (!loadingPatients && !loadingVentes) {
      setLoading(false);
    }
  }, [loadingPatients, loadingVentes]);

  const fetchPatients = async () => {
    try {
      setLoadingPatients(true);
      setError(null);

      console.log('🔄 Chargement des patients...');

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

      if (fetchError) {
        console.error('❌ Erreur Supabase fetchPatients:', fetchError);
        throw fetchError;
      }

      console.log('✅ Patients chargés:', data?.length || 0);
      console.log('📋 Données patients:', data);
      setPatients(data || []);
    } catch (err) {
      console.error('❌ Erreur chargement patients:', err);
      setError(err.message);
      setPatients([]); // S'assurer que patients est un tableau vide en cas d'erreur
    } finally {
      setLoadingPatients(false);
    }
  };

  const fetchVentesPharmacies = async () => {
    try {
      setLoadingVentes(true);
      console.log('🔄 Chargement des prescriptions pharmacie...');

      // Récupérer les prescriptions pharmacie
      const { data: prescriptionsData, error: prescriptionsError } = await supabase
        .from('prescriptions_pharmacie')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (prescriptionsError) throw prescriptionsError;

      console.log('✅ Prescriptions récupérées:', prescriptionsData?.length || 0);

      if (!prescriptionsData || prescriptionsData.length === 0) {
        setVentesPharmacies([]);
        return;
      }

      // Récupérer les IDs uniques des patients et consultations
      const patientIds = [...new Set(prescriptionsData.map(p => p.patient_id).filter(Boolean))];
      const consultationIds = [...new Set(prescriptionsData.map(p => p.consultation_id).filter(Boolean))];

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
      const ventes = prescriptionsData.map((prescription, index) => {
        const patient = patientsMap.get(prescription.patient_id);
        const consultation = consultationsMap.get(prescription.consultation_id);
        const medecin = consultation?.users;
        const assurance = patient?.assurances;
        const tauxCouverture = assurance?.taux_remboursement || 0;
        
        // Prix estimé (à adapter selon votre logique)
        const prixEstime = 5000; // Prix par défaut
        const montantTotal = prixEstime * (prescription.quantite_prescrite || 1);
        const montantAssurance = (montantTotal * tauxCouverture) / 100;
        const montantPatient = montantTotal - montantAssurance;

        return {
          id: prescription.id,
          numero: `FP-${new Date(prescription.created_at).getFullYear()}-${String(index + 1).padStart(3, '0')}`,
          date: prescription.date_prescription || prescription.created_at?.split('T')[0],
          patient: {
            id: patient?.id,
            nom: patient?.nom || 'Inconnu',
            prenom: patient?.prenom || '',
            assurance: assurance?.nom || 'Sans assurance',
            tauxCouverture: tauxCouverture
          },
          medicaments: [
            {
              medicament: {
                id: prescription.medicament_id,
                nom: prescription.nom_medicament || 'Médicament',
                dosage: prescription.posologie,
                forme: 'Comprimé',
                prix: prixEstime,
                dci: prescription.nom_medicament
              },
              quantite: prescription.quantite_prescrite || 1,
              prixUnitaire: prixEstime
            }
          ],
          sousTotal: montantTotal,
          remise: 0,
          montantAssurance: montantAssurance,
          montantPatient: montantPatient,
          total: montantTotal,
          statut: mapStatut(prescription.statut),
          pharmacien: medecin ? `Dr. ${medecin.prenom} ${medecin.nom}` : 'Non spécifié'
        };
      });

      console.log('✅ Ventes formatées:', ventes.length);
      setVentesPharmacies(ventes);
    } catch (err) {
      console.error('❌ Erreur chargement prescriptions:', err);
      setError(err.message);
      setVentesPharmacies([]); // S'assurer que ventesPharmacies est un tableau vide en cas d'erreur
    } finally {
      setLoadingVentes(false);
    }
  };

  // Mapper le statut de la DB vers le statut d'affichage
  const mapStatut = (statutDB) => {
    const mapping = {
      'prescrit': 'en_attente',
      'delivre': 'delivree',
      'termine': 'delivree',
      'annule': 'annulee'
    };
    return mapping[statutDB] || 'en_attente';
  };

  // Médicaments disponibles (pour l'instant en mock, à remplacer par une vraie table plus tard)
  const medicamentsDisponibles = [
    { id: 1, nom: 'Paracétamol', dosage: '500mg', forme: 'Comprimé', prix: 2500, stock: 150, dci: 'Paracétamol' },
    { id: 2, nom: 'Ibuprofène', dosage: '400mg', forme: 'Comprimé', prix: 3000, stock: 80, dci: 'Ibuprofène' },
    { id: 3, nom: 'Amoxicilline', dosage: '1g', forme: 'Comprimé', prix: 8000, stock: 45, dci: 'Amoxicilline' },
    { id: 4, nom: 'Oméprazole', dosage: '20mg', forme: 'Gélule', prix: 4500, stock: 60, dci: 'Oméprazole' },
    { id: 5, nom: 'Vitamine D3', dosage: '1000 UI', forme: 'Gouttes', prix: 12000, stock: 25, dci: 'Cholécalciférol' },
    { id: 6, nom: 'Aspirine', dosage: '100mg', forme: 'Comprimé', prix: 1800, stock: 200, dci: 'Acide acétylsalicylique' },
    { id: 7, nom: 'Metformine', dosage: '850mg', forme: 'Comprimé', prix: 5500, stock: 90, dci: 'Metformine' },
    { id: 8, nom: 'Amlodipine', dosage: '5mg', forme: 'Comprimé', prix: 6000, stock: 70, dci: 'Amlodipine' }
  ];

  const filteredVentes = ventesPharmacies.filter(vente => {
    const matchesSearch = vente.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         `${vente.patient.prenom} ${vente.patient.nom}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || vente.statut === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const handleAddMedicament = () => {
    const medicament = medicamentsDisponibles.find(m => m.id === parseInt(factureData.medicamentId));
    if (medicament && factureData.quantite > 0) {
      setMedicaments([...medicaments, {
        medicament,
        quantite: parseInt(factureData.quantite)
      }]);
      setFactureData({ ...factureData, medicamentId: '', quantite: 1 });
    }
  };

  const handleRemoveMedicament = (index) => {
    setMedicaments(medicaments.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    const sousTotal = medicaments.reduce((total, item) => total + (item.medicament.prix * item.quantite), 0);
    const remise = 0; // Pas de remise pour l'instant
    const total = sousTotal - remise;
    
    // Calculer la part assurance et patient
    const patientSelectionne = patients.find(p => p.id === factureData.patientId);
    const tauxRemboursement = patientSelectionne?.assurances?.taux_remboursement || 0;
    const partAssurance = (total * tauxRemboursement) / 100;
    const partPatient = total - partAssurance;
    
    return {
      sousTotal,
      remise,
      total,
      partAssurance,
      partPatient,
      tauxRemboursement
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      console.log('🔄 Création nouvelle prescription pharmacie...');

      if (!factureData.patientId || medicaments.length === 0) {
        showWarning('Veuillez sélectionner un patient et au moins un médicament');
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
          motif: 'Prescription pharmacie',
          statut: 'terminee'
        })
        .select()
        .single();

      if (consultationError) throw consultationError;
      console.log('✅ Consultation créée:', consultationData.id);

      // 3. Créer les prescriptions pharmacie pour chaque médicament
      for (const item of medicaments) {
        const { data: prescriptionData, error: prescriptionError } = await supabase
          .from('prescriptions_pharmacie')
          .insert({
            consultation_id: consultationData.id,
            patient_id: factureData.patientId,
            medicament_id: item.medicament.id,
            nom_medicament: item.medicament.nom,
            posologie: `${item.medicament.dosage} - ${item.quantite} unité(s)`,
            quantite_prescrite: item.quantite,
            duree_traitement: '7 jours',
            date_prescription: new Date().toISOString().split('T')[0],
            statut: 'prescrit',
            instructions: factureData.observations || null
          });

        if (prescriptionError) {
          console.error('❌ Erreur création prescription:', prescriptionError);
          throw prescriptionError;
        }

        console.log('✅ Prescription créée pour:', item.medicament.nom);
      }

      showSuccess(`✅ Prescription pharmacie créée avec succès! ${medicaments.length} médicament(s) prescrit(s).`);
      
      // Réinitialiser le formulaire
    setShowForm(false);
      setEditingFacture(null);
    setMedicaments([]);
    setFactureData({
      patientId: '', medicamentId: '', quantite: 1, observations: ''
    });

      // Recharger les ventes
      await fetchVentesPharmacies();

    } catch (err) {
      console.error('❌ Erreur lors de la création:', err);
      showError(`Erreur lors de la création de la prescription: ${err.message}`);
    }
  };

  const handleEdit = (vente) => {
    setEditingFacture(vente);
    setFactureData({
      patientId: vente.patient.id,
      medicamentId: '',
      quantite: 1,
      observations: vente.observations || ''
    });
    setMedicaments(vente.medicaments.map(item => ({
      medicament: item.medicament,
      quantite: item.quantite
    })));
    setShowForm(true);
  };

  const handleDelete = (vente) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la vente ${vente.numero} ?`)) {
      console.log('Suppression vente pharmacie:', vente.id);
      showSuccess('Vente supprimée avec succès!');
    }
  };

  const handleDownload = (vente) => {
    console.log('Téléchargement vente pharmacie:', vente.numero);
    showInfo(`Téléchargement de la vente ${vente.numero} en cours...`);
  };

  const getStatusColor = (statut) => {
    switch (statut) {
      case 'delivree': return 'bg-green-100 text-green-800';
      case 'en_preparation': return 'bg-yellow-100 text-yellow-800';
      case 'en_attente': return 'bg-blue-100 text-blue-800';
      case 'annulee': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (statut) => {
    switch (statut) {
      case 'delivree': return 'Délivrée';
      case 'en_preparation': return 'En préparation';
      case 'en_attente': return 'En attente';
      case 'annulee': return 'Annulée';
      default: return statut;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Facturation Pharmacie</h1>
          <p className="text-gray-600">Gestion des ventes et délivrance de médicaments</p>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle vente
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center">
            <Pill className="w-8 h-8 text-blue-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-500">Total ventes</p>
              <p className="text-2xl font-semibold text-gray-900">{ventesPharmacies.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-500">Délivrées</p>
              <p className="text-2xl font-semibold text-gray-900">
                {ventesPharmacies.filter(v => v.statut === 'delivree').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center">
            <Package className="w-8 h-8 text-yellow-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-500">En préparation</p>
              <p className="text-2xl font-semibold text-gray-900">
                {ventesPharmacies.filter(v => v.statut === 'en_preparation').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-blue-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-500">En attente</p>
              <p className="text-2xl font-semibold text-gray-900">
                {ventesPharmacies.filter(v => v.statut === 'en_attente').length}
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
                {formatMontant(ventesPharmacies.reduce((sum, v) => sum + v.total, 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rechercher</label>
            <div className="flex">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="N° vente, patient..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              />
              <button className="px-4 py-2 bg-medical-primary text-white rounded-r-lg hover:bg-medical-primary-dark transition-colors">
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
            >
              <option value="all">Tous les statuts</option>
              <option value="delivree">Délivrées</option>
              <option value="en_preparation">En préparation</option>
              <option value="en_attente">En attente</option>
              <option value="annulee">Annulées</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button className="flex items-center px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              <Filter className="w-4 h-4 mr-2" />
              Filtres avancés
            </button>
          </div>
        </div>
      </div>

      {/* Formulaire de nouvelle vente */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingFacture ? 'Modifier la vente' : 'Nouvelle vente pharmacie'}
            </h3>
            <button onClick={() => {
              setShowForm(false);
              setEditingFacture(null);
              setMedicaments([]);
              setFactureData({
                patientId: '', medicamentId: '', quantite: 1, observations: ''
              });
            }}>
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Patient *</label>
              {loadingPatients ? (
                <div className="flex items-center justify-center p-4 border border-gray-300 rounded-lg bg-gray-50">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-medical-primary mr-2"></div>
                  <span className="text-sm text-gray-600">Chargement des patients...</span>
                </div>
              ) : error ? (
                <div className="p-3 border border-red-300 rounded-lg bg-red-50">
                  <p className="text-sm text-red-600">Erreur: {error}</p>
                  <button
                    type="button"
                    onClick={fetchPatients}
                    className="mt-2 text-sm text-red-700 underline hover:text-red-900"
                  >
                    Réessayer
                  </button>
                </div>
              ) : (
                <SearchableSelect
                  options={patients.map(patient => ({
                    id: patient.id,
                    label: `${patient.prenom} ${patient.nom}`,
                    nom: patient.nom,
                    prenom: patient.prenom,
                    telephone: patient.telephone || '',
                    email: patient.email || '',
                    numero_dossier: patient.numero_dossier || '',
                    assurance: patient.assurances?.nom || 'Sans assurance',
                    taux_remboursement: patient.assurances?.taux_remboursement || 0
                  }))}
                  value={factureData.patientId ? String(factureData.patientId) : ''}
                  onChange={(value) => setFactureData({...factureData, patientId: value})}
                  placeholder="Rechercher un patient..."
                  searchPlaceholder="Rechercher par nom, prénom, téléphone, dossier..."
                  emptyMessage={patients.length === 0 ? "Aucun patient trouvé. Vérifiez qu'il y a des patients actifs dans la base de données." : "Aucun patient trouvé"}
                  renderOption={(option) => (
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">
                        {option.label}
                      </span>
                      <div className="flex items-center text-xs text-gray-500 mt-1 space-x-2">
                        {option.numero_dossier && (
                          <span>📁 {option.numero_dossier}</span>
                        )}
                        {option.assurance && (
                          <span>🏥 {option.assurance} {option.taux_remboursement > 0 && `(${option.taux_remboursement}%)`}</span>
                        )}
                        {option.telephone && (
                          <span>📞 {option.telephone}</span>
                        )}
                      </div>
                    </div>
                  )}
                />
              )}
              {!loadingPatients && !error && (
                <p className="mt-1 text-xs text-gray-500">
                  {patients.length} patient(s) disponible(s)
                </p>
              )}
            </div>
            
            {/* Ajout de médicaments */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="text-md font-semibold text-gray-900 mb-4">Ajouter des médicaments</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="md:col-span-2">
                  <select
                    value={factureData.medicamentId}
                    onChange={(e) => setFactureData({...factureData, medicamentId: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Sélectionner un médicament</option>
                    {medicamentsDisponibles.map(med => (
                      <option key={med.id} value={med.id}>
                        {med.nom} {med.dosage} - {formatMontant(med.prix)} (Stock: {med.stock})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <input
                    type="number"
                    value={factureData.quantite}
                    onChange={(e) => setFactureData({...factureData, quantite: e.target.value})}
                    min="1"
                    placeholder="Quantité"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                
                <div>
                  <button
                    type="button"
                    onClick={handleAddMedicament}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Ajouter
                  </button>
                </div>
              </div>
              
              {/* Liste des médicaments ajoutés */}
              {medicaments.length > 0 && (
                <div className="border-t pt-4">
                  <h5 className="font-medium text-gray-900 mb-3">Médicaments sélectionnés :</h5>
                  <div className="space-y-2">
                    {medicaments.map((item, index) => (
                      <div key={`new-med-${index}`} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                        <div>
                          <span className="font-medium">{item.medicament.nom} {item.medicament.dosage}</span>
                          <span className="text-gray-500 ml-2">x{item.quantite}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="font-medium">{formatMontant(item.medicament.prix * item.quantite)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMedicament(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t">
                    {(() => {
                      const totaux = calculateTotal();
                      return (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Sous-total :</span>
                            <span className="font-medium">{formatMontant(totaux.sousTotal)}</span>
                    </div>
                          {totaux.remise > 0 && (
                            <div className="flex justify-between text-sm text-green-600">
                              <span>Remise :</span>
                              <span>-{formatMontant(totaux.remise)}</span>
                  </div>
                          )}
                          <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                            <span>Total :</span>
                            <span>{formatMontant(totaux.total)}</span>
                          </div>
                          {factureData.patientId && (
                            <>
                              <div className="flex justify-between text-sm text-blue-600">
                                <span>Part assurance ({totaux.tauxRemboursement}%) :</span>
                                <span className="font-medium">{formatMontant(totaux.partAssurance)}</span>
                              </div>
                              <div className="flex justify-between text-sm text-orange-600">
                                <span>Part patient :</span>
                                <span className="font-medium">{formatMontant(totaux.partPatient)}</span>
                              </div>
                            </>
                          )}
                    </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Observations</label>
              <textarea
                value={factureData.observations}
                onChange={(e) => setFactureData({...factureData, observations: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Instructions particulières..."
              />
            </div>
            
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingFacture(null);
                  setMedicaments([]);
                  setFactureData({
                    patientId: '', medicamentId: '', quantite: 1, observations: ''
                  });
                }}
                className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={medicaments.length === 0}
                className="flex items-center px-6 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingFacture ? 'Modifier' : 'Enregistrer vente'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des ventes */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Ventes pharmacie</h2>
          <p className="text-sm text-gray-600">{filteredVentes.length} vente(s) trouvée(s)</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Vente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Médicaments</th>
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
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-primary mb-4"></div>
                      <p className="text-gray-500">Chargement des ventes...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredVentes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Package className="w-16 h-16 text-gray-300 mb-4" />
                      <p className="text-gray-500 text-lg font-medium">Aucune vente trouvée</p>
                      <p className="text-gray-400 text-sm mt-2">
                        {searchTerm || selectedStatus !== 'all' 
                          ? 'Essayez de modifier vos filtres de recherche'
                          : 'Créez votre première vente pharmacie'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVentes.map((vente) => (
                <tr key={vente.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{vente.numero}</div>
                    <div className="text-sm text-gray-500">{new Date(vente.date).toLocaleDateString('fr-FR')}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {vente.patient.prenom} {vente.patient.nom}
                    </div>
                    <div className="text-sm text-gray-500">{vente.patient.assurance}</div>
                  </td>
                  <td className="px-6 py-4">
                    {vente.medicaments.map((item, index) => (
                      <div key={`${vente.id}-vente-med-${index}`} className="text-sm text-gray-900 mb-1">
                        {item.medicament.nom} x{item.quantite}
                      </div>
                    ))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatMontant(vente.total)}
                    </div>
                    <div className="text-sm text-gray-500">
                      Patient: {formatMontant(vente.montantPatient)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(vente.statut)}`}>
                      {getStatusText(vente.statut)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => setShowDetails(vente)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Voir détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEdit(vente)}
                        className="text-medical-primary hover:text-medical-primary-dark"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDownload(vente)}
                        className="text-green-600 hover:text-green-900"
                        title="Télécharger"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(vente)}
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
                  Détails de la vente {showDetails.numero}
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
                  <p><span className="font-medium">Pharmacien :</span> {showDetails.pharmacien}</p>
                  <p><span className="font-medium">Date :</span> {new Date(showDetails.date).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
              
              {/* Médicaments vendus */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Médicaments vendus</h4>
                <div className="space-y-2">
                  {showDetails.medicaments.map((item, index) => (
                    <div key={`${showDetails.id}-detail-med-${index}`} className="bg-gray-50 p-3 rounded flex justify-between items-center">
                      <div>
                        <span className="font-medium">{item.medicament.nom} {item.medicament.dosage}</span>
                        <span className="text-sm text-gray-500 block">{item.medicament.forme} - {item.medicament.dci}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-gray-600">x{item.quantite}</span>
                        <span className="font-medium">{formatMontant(item.prixUnitaire * item.quantite)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Détails financiers */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Détails financiers</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Sous-total :</span>
                    <span>{formatMontant(showDetails.sousTotal)}</span>
                  </div>
                  {showDetails.remise > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Remise :</span>
                      <span>-{formatMontant(showDetails.remise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Part assurance :</span>
                    <span>{formatMontant(showDetails.montantAssurance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Part patient :</span>
                    <span>{formatMontant(showDetails.montantPatient)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total :</span>
                    <span>{formatMontant(showDetails.total)}</span>
                  </div>
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

export default FacturationPharmacie;
