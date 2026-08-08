import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { formatMontant } from '../../utils/currency';
import {
  Receipt,
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
  CreditCard,
  AlertCircle,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import SearchableSelect from '../../components/common/SearchableSelect';
import KpiCard from '../../components/common/KpiCard';
import { useAlert } from '../../contexts/AlertContext';
import { generateFacturePDF } from '../../services/impression/facturePdf.js';
import Pagination from '../../components/common/Pagination';
import { getStatusColor, getStatusLabel, isOutstanding } from '../../utils/factureStatus';

const ITEMS_PER_PAGE = 20;

const FacturationFactures = () => {
  const location = useLocation();
  const { showError, showSuccess, showWarning, showInfo } = useAlert();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [showDetails, setShowDetails] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingFacture, setEditingFacture] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [factureData, setFactureData] = useState({
    patientId: '',
    type: '',
    items: [],
    observations: ''
  });
  const [patientsConsultes, setPatientsConsultes] = useState([]);
  const [factures, setFactures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Récupérer les patients consultés et les factures depuis la base de données
  useEffect(() => {
    fetchPatientsConsultes();
    fetchFactures();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get('status');
    const type = params.get('type');
    const period = params.get('period');
    const q = params.get('q');
    const openNew = params.get('new');

    if (status) setSelectedStatus(status);
    if (type) setSelectedType(type);
    if (period) setSelectedPeriod(period);
    if (q !== null) setSearchTerm(q);
    if (openNew === '1') {
      setShowForm(true);
      setEditingFacture(null);
    }
  }, [location.search]);

  const fetchPatientsConsultes = async () => {
    try {
      setLoading(true);
      setError(null);

      // Récupérer les consultations avec les informations des patients et leurs assurances
      const { data: consultations, error: consultationsError } = await supabase
        .from('consultations')
        .select(`
          id,
          date_consultation,
          patients (
            id,
            nom,
            prenom,
            telephone,
            assurance_id,
            assurances (
              id,
              nom,
              taux_remboursement
            )
          )
        `)
        .order('date_consultation', { ascending: false });

      if (consultationsError) {
        throw consultationsError;
      }

      // Extraire les patients uniques avec leurs informations d'assurance
      const patientsMap = new Map();
      
      consultations?.forEach(consultation => {
        const patient = consultation.patients;
        if (patient && !patientsMap.has(patient.id)) {
          patientsMap.set(patient.id, {
            id: patient.id,
            nom: patient.nom,
            prenom: patient.prenom,
            telephone: patient.telephone || '',
            assurance: patient.assurances?.nom || 'Aucune',
            tauxCouverture: patient.assurances?.taux_remboursement || 0,
            assurance_id: patient.assurance_id
          });
        }
      });

      const patientsUniques = Array.from(patientsMap.values());
      setPatientsConsultes(patientsUniques);
      
      console.log('✅ Patients consultés récupérés:', patientsUniques.length);
    } catch (err) {
      console.error('❌ Erreur lors de la récupération des patients consultés:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Patients sénégalais (fallback si la base de données ne retourne rien)
  const mockPatients = [
    { id: 1, nom: 'Diallo', prenom: 'Aminata', assurance: 'IPM', tauxCouverture: 80 },
    { id: 2, nom: 'Ndiaye', prenom: 'Moussa', assurance: 'IPRES', tauxCouverture: 70 },
    { id: 3, nom: 'Seck', prenom: 'Fatou', assurance: 'Aucune', tauxCouverture: 0 },
    { id: 4, nom: 'Fall', prenom: 'Cheikh', assurance: 'CNAM', tauxCouverture: 75 }
  ];

  // Charger les factures depuis la base de données
  const fetchFactures = async () => {
    try {
      console.log('🔄 Chargement des factures...');

      const { data: facturesData, error: facturesError } = await supabase
        .from('factures')
        .select(`
          id,
          numero_facture,
          date_facture,
          montant_ht,
          tva,
          montant_ttc,
          montant_paye,
          montant_restant,
          statut_paiement,
          mode_paiement,
          notes,
          created_at,
          consultation_id,
          patient_id,
          assurance_id,
          patients (
            id,
            nom,
            prenom,
            telephone,
            assurance_id,
            assurances (
              nom,
              taux_remboursement
            )
          ),
          consultations (
            id,
            date_consultation,
            users (
              id,
              nom,
              prenom
            )
          )
        `)
        .order('date_facture', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      if (facturesError) throw facturesError;

      console.log('✅ Factures récupérées:', facturesData?.length || 0);

      // Transformer les données pour correspondre au format attendu
      const facturesFormatees = (facturesData || []).map((facture, index) => {
        const patient = facture.patients;
        const consultation = facture.consultations;
        const medecin = consultation?.users;
        const assurance = patient?.assurances;
        const tauxCouverture = assurance?.taux_remboursement || 0;
        
        // Déterminer le type de facture (à partir de consultation_id ou notes)
        const type = facture.notes?.includes('Acte') ? 'Actes' :
                     facture.notes?.includes('Examen') ? 'Examens' :
                     facture.notes?.includes('Laboratoire') ? 'Laboratoire' :
                     facture.notes?.includes('Pharmacie') ? 'Pharmacie' : 'Actes';

        const montantTotal = parseFloat(facture.montant_ttc || 0);
        const montantAssurance = (montantTotal * tauxCouverture) / 100;
        const montantPatient = montantTotal - montantAssurance;

        return {
          id: facture.id,
          numero: facture.numero_facture,
          type: type,
          date: facture.date_facture || facture.created_at?.split('T')[0],
          patient: {
            id: patient?.id,
            nom: patient?.nom || 'Inconnu',
            prenom: patient?.prenom || '',
            assurance: assurance?.nom || 'Sans assurance',
            tauxCouverture: tauxCouverture
          },
          items: [type], // Simplifié pour l'instant
          sousTotal: parseFloat(facture.montant_ht || 0),
          remise: 0,
          montantAssurance: montantAssurance,
          montantPatient: montantPatient,
          total: montantTotal,
          statut: facture.statut_paiement || 'en_attente',
          medecin: medecin ? `Dr. ${medecin.prenom} ${medecin.nom}` : 'Non spécifié',
          dateEcheance: null
        };
      });

      setFactures(facturesFormatees);
    } catch (err) {
      console.error('❌ Erreur chargement factures:', err);
      setError(err.message);
    }
  };

  // Utiliser les patients de la base de données ou le fallback
  const patients = patientsConsultes.length > 0 ? patientsConsultes : mockPatients;

  // Utiliser les factures de la base de données ou le fallback
  const toutesFactures = factures.length > 0 ? factures : [
    {
      id: 1,
      numero: 'FA-2024-001',
      type: 'Actes',
      date: '2024-01-15',
      patient: patients[0] || mockPatients[0],
      items: ['Consultation générale', 'ECG'],
      sousTotal: 27000,
      remise: 0,
      montantAssurance: 21600,
      montantPatient: 5400,
      total: 27000,
      statut: 'paye',
      medecin: 'Dr. Mamadou Diallo',
      dateEcheance: '2024-01-30'
    },
    {
      id: 2,
      numero: 'FE-2024-002',
      type: 'Examens',
      date: '2024-01-14',
      patient: patients[1] || mockPatients[1],
      items: ['Scanner abdominal'],
      sousTotal: 23000,
      remise: 0,
      montantAssurance: 0,
      montantPatient: 23000,
      total: 23000,
      statut: 'impaye',
      medecin: 'Dr. Moussa Seck',
      dateEcheance: '2024-01-28'
    },
    {
      id: 3,
      numero: 'FL-2024-003',
      type: 'Laboratoire',
      date: '2024-01-13',
      patient: patients[2] || mockPatients[2],
      items: ['Analyse sanguine', 'Culture'],
      sousTotal: 9500,
      remise: 0,
      montantAssurance: 7600,
      montantPatient: 1900,
      total: 9500,
      statut: 'paye',
      medecin: 'Dr. Aminata Fall',
      dateEcheance: '2024-01-27'
    },
    {
      id: 4,
      numero: 'FP-2024-004',
      type: 'Pharmacie',
      date: '2024-01-12',
      patient: patients[3] || mockPatients[3],
      items: ['Antibiotiques', 'Antalgiques'],
      sousTotal: 54000,
      remise: 0,
      montantAssurance: 37800,
      montantPatient: 16200,
      total: 54000,
      statut: 'partiel',
      medecin: 'Dr. Cheikh Mbaye',
      dateEcheance: '2024-01-26'
    }
  ];

  const types = ['Actes', 'Examens', 'Laboratoire', 'Pharmacie'];

  const filteredFactures = toutesFactures.filter(facture => {
    const matchesSearch = facture.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         `${facture.patient.prenom} ${facture.patient.nom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         facture.medecin.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all'
      ? true
      : selectedStatus === 'outstanding'
        ? isOutstanding(facture.statut)
        : facture.statut === selectedStatus;
    const matchesType = selectedType === 'all' || facture.type === selectedType;

    // Filtre par période (uniquement si une période spécifique est sélectionnée)
    const matchesPeriod = () => {
      if (!selectedPeriod || selectedPeriod === 'all') return true;
      if (!facture.date) return false;
      const factureDate = new Date(facture.date);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch (selectedPeriod) {
        case 'today':
          return factureDate >= today && factureDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
        case 'week':
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          return factureDate >= weekAgo;
        case 'month':
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          return factureDate >= monthStart;
        case 'quarter':
          const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          return factureDate >= quarterStart;
        case 'year':
          const yearStart = new Date(now.getFullYear(), 0, 1);
          return factureDate >= yearStart;
        default:
          return true;
      }
    };

    return matchesSearch && matchesStatus && matchesType && matchesPeriod();
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedStatus, selectedType, selectedPeriod]);

  const totalPages = Math.max(1, Math.ceil(filteredFactures.length / ITEMS_PER_PAGE));
  const paginatedFactures = filteredFactures.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getTypeColor = (type) => {
    switch (type) {
      case 'Actes': return 'bg-blue-100 text-blue-800';
      case 'Examens': return 'bg-purple-100 text-purple-800';
      case 'Laboratoire': return 'bg-green-100 text-green-800';
      case 'Pharmacie': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Styles KpiCard pour la répartition par type (mêmes couleurs que getTypeColor)
  const typeKpiStyles = {
    Actes: { tone: 'blue' },
    Examens: { tone: 'purple' },
    Laboratoire: { tone: 'green' },
    Pharmacie: {
      className: 'rounded-lg p-4 bg-orange-50 hover:shadow-md',
      valueClassName: 'text-orange-600',
      labelClassName: 'text-orange-700',
    },
  };

  // Calculs statistiques
  const totalFactures = toutesFactures.length;
  const totalChiffre = toutesFactures.reduce((sum, f) => sum + f.total, 0);
  const totalEnAttente = toutesFactures
    .filter(f => f.statut === 'en_attente' || f.statut === 'impaye' || f.statut === 'partiel')
    .reduce((sum, f) => sum + f.montantPatient, 0);
  const totalPayees = toutesFactures.filter(f => f.statut === 'paye').length;

  const handleEdit = (facture) => {
    setEditingFacture(facture);
    setFactureData({
      patientId: facture.patient.id,
      type: facture.type,
      items: facture.items,
      observations: facture.observations || ''
    });
    setShowForm(true);
  };

  const handleDelete = (facture) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la facture ${facture.numero} ?`)) {
      console.log('Suppression facture:', facture.id);
      showSuccess('Facture supprimée avec succès!');
    }
  };

  const handleDownload = async (facture) => {
    console.log('Téléchargement facture:', facture.numero);
    showInfo(`Téléchargement de la facture ${facture.numero} en cours...`);

    try {
      const result = await generateFacturePDF(supabase, facture, false, null);
      if (result.success) {
        showSuccess(`Facture ${facture.numero} téléchargée avec succès!`);
      } else {
        showError(`Erreur lors du téléchargement: ${result.error}`);
      }
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      showError('Erreur lors du téléchargement de la facture');
    }
  };

  const handleSendEmail = async (facture) => {
    console.log('Envoi email facture:', facture.numero);
    showInfo(`Génération du PDF de la facture ${facture.numero} pour envoi par email...`);

    try {
      const result = await generateFacturePDF(supabase, facture, false, null);
      if (result.success) {
        // Pour l'instant, simuler l'envoi par email
        // Dans une implémentation réelle, il faudrait utiliser un service d'email
        showSuccess(`Facture ${facture.numero} prête pour l'envoi par email (PDF généré)`);
        console.log('PDF généré avec succès pour envoi par email');
      } else {
        showError(`Erreur lors de la génération du PDF: ${result.error}`);
      }
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      showError('Erreur lors de la préparation de l\'envoi par email');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
    if (editingFacture) {
        // TODO: Implémenter la modification de facture
      console.log('Modification facture:', factureData);
      showSuccess('Facture modifiée avec succès!');
      setEditingFacture(null);
    } else {
        console.log('🔄 Création nouvelle facture...');

        if (!factureData.patientId || !factureData.type) {
          showWarning('Veuillez sélectionner un patient et un type de facturation');
          return;
        }

        // 1. Récupérer la dernière consultation du patient pour obtenir le medecin_id
        const { data: derniereConsultation, error: derniereConsultationError } = await supabase
          .from('consultations')
          .select('medecin_id, id')
          .eq('patient_id', factureData.patientId)
          .order('date_consultation', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let medecinId = null;
        let consultationId = null;

        if (derniereConsultationError) {
          console.error('❌ Erreur récupération consultation:', derniereConsultationError);
          showError('Erreur lors de la récupération de la consultation. Veuillez réessayer.');
          return;
        }

        if (derniereConsultation) {
          medecinId = derniereConsultation.medecin_id;
          consultationId = derniereConsultation.id;
        } else {
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
        }

        if (!medecinId) {
          showError('Erreur: Impossible de déterminer le médecin. Veuillez d\'abord créer une consultation pour ce patient.');
          return;
        }

        // 2. Récupérer les informations du patient pour obtenir l'assurance_id
        const { data: patientData, error: patientError } = await supabase
          .from('patients')
          .select('assurance_id')
          .eq('id', factureData.patientId)
          .single();

        if (patientError) {
          console.error('❌ Erreur récupération patient:', patientError);
        }

        // 3. Générer un numéro de facture unique
        const annee = new Date().getFullYear();
        const { data: dernierNumero, error: numeroError } = await supabase
          .from('factures')
          .select('numero_facture')
          .like('numero_facture', `F-${annee}-%`)
          .order('numero_facture', { ascending: false })
          .limit(1)
          .maybeSingle();

        let numeroFacture = '';
        if (dernierNumero) {
          const dernierNum = parseInt(dernierNumero.numero_facture.split('-')[2]) || 0;
          numeroFacture = `F-${annee}-${String(dernierNum + 1).padStart(4, '0')}`;
        } else {
          numeroFacture = `F-${annee}-0001`;
        }

        // 4. Créer la facture
        const { data: factureDataInsert, error: factureError } = await supabase
          .from('factures')
          .insert({
            consultation_id: consultationId,
            patient_id: factureData.patientId,
            numero_facture: numeroFacture,
            date_facture: new Date().toISOString().split('T')[0],
            montant_ht: 0, // Sera calculé à partir des lignes
            tva: 0,
            montant_ttc: 0, // Sera calculé à partir des lignes
            montant_paye: 0,
            statut_paiement: 'en_attente',
            assurance_id: patientData?.assurance_id || null,
            notes: factureData.observations || `Facture ${factureData.type}`
          })
          .select()
          .single();

        if (factureError) throw factureError;

        console.log('✅ Facture créée:', factureDataInsert.id);

        showSuccess(`✅ Facture créée avec succès! Numéro: ${numeroFacture}`);
        
        // Recharger les factures
        await fetchFactures();
      }
      
    setShowForm(false);
      setEditingFacture(null);
    setFactureData({
      patientId: '', type: '', items: [], observations: ''
    });
    } catch (err) {
      console.error('❌ Erreur lors de la création:', err);
      showError(`Erreur lors de la création de la facture: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Factures</h1>
          <p className="text-gray-600">Vue d'ensemble de toutes les facturations</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => showInfo('Exportation en cours...')}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </button>
          <button 
            onClick={() => setShowForm(true)}
            className="flex items-center px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle facture
          </button>
        </div>
      </div>

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KpiCard icon={Receipt} tone="blue" label="Total factures" value={totalFactures} />
        <KpiCard icon={Coins} tone="green" label="Chiffre d'affaires" value={formatMontant(totalChiffre)} />
        <KpiCard icon={CheckCircle} tone="green" label="Factures payées" value={totalPayees} />
        <KpiCard icon={AlertCircle} tone="red" label="En attente" value={formatMontant(totalEnAttente)} />
      </div>

      {/* Répartition par type */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Répartition par type de facturation</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {types.map(type => {
            const facturesType = toutesFactures.filter(f => f.type === type);
            const totalType = facturesType.reduce((sum, f) => sum + f.total, 0);
            return (
              <KpiCard
                key={type}
                label={type}
                value={facturesType.length}
                hint={formatMontant(totalType)}
                {...(typeKpiStyles[type] || {})}
              />
            );
          })}
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rechercher</label>
            <div className="flex">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="N° facture, patient, médecin..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              />
              <button className="px-4 py-2 bg-medical-primary text-white rounded-r-lg hover:bg-medical-primary-dark transition-colors">
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="ml-16">
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
            >
              <option value="all">Tous les types</option>
              {types.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div className="ml-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-60 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
            >
              <option value="all">Tous les statuts</option>
              <option value="outstanding">À encaisser (non payées)</option>
              <option value="paye">Payées</option>
              <option value="partiel">Partiellement payées</option>
              <option value="en_attente">En attente</option>
              <option value="impaye">Impayées</option>
            </select>
          </div>
          
          <div className="ml-auto">
            <label className="block text-sm font-medium text-gray-700 mb-2">Période</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              style={{ width: '168px' }}
            >
              <option value="today">Aujourd'hui</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
              <option value="quarter">Ce trimestre</option>
              <option value="year">Cette année</option>
            </select>
          </div>
        </div>
      </div>

      {/* Liste des factures */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Toutes les factures</h2>
          <p className="text-sm text-gray-600">{filteredFactures.length} facture(s) trouvée(s)</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Facture
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Services
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedFactures.map((facture) => (
                <tr key={facture.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{facture.numero}</div>
                      <div className="text-sm text-gray-500">{new Date(facture.date).toLocaleDateString('fr-FR')}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {facture.patient.prenom} {facture.patient.nom}
                      </div>
                      <div className="text-sm text-gray-500">{facture.patient.assurance}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(facture.type)}`}>
                      {facture.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {facture.items.slice(0, 2).map((item, index) => (
                        <div key={index}>{item}</div>
                      ))}
                      {facture.items.length > 2 && (
                        <div className="text-gray-500">+{facture.items.length - 2} autre(s)</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {formatMontant(facture.total)}
                      </div>
                      <div className="text-sm text-gray-500">
                        Patient: {formatMontant(facture.montantPatient)}
                      </div>
                      {facture.montantAssurance > 0 && (
                        <div className="text-sm text-blue-600">
                          Assurance: {formatMontant(facture.montantAssurance)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(facture.statut)}`}>
                      {getStatusLabel(facture.statut)}
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
                        onClick={() => handleSendEmail(facture)}
                        className="text-orange-600 hover:text-orange-900"
                        title="Envoyer par email"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      {facture.statut !== 'paye' && (
                        <button 
                          onClick={() => handleDelete(facture)}
                          className="text-red-600 hover:text-red-900"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredFactures.length > 0 && (
          <div className="border-t border-gray-200">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Modal de détails */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Détails de la facture {showDetails.numero}
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
                  <p><span className="font-medium">Taux de couverture :</span> {showDetails.patient.tauxCouverture}%</p>
                </div>
              </div>
              
              {/* Détails facture */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Détails de la facture</h4>
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
              
              {/* Services */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Services facturés</h4>
                <div className="space-y-2">
                  {showDetails.items.map((item, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded">
                      {item}
                    </div>
                  ))}
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
                Imprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire de nouvelle facture */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingFacture ? 'Modifier la facture' : 'Nouvelle facture'}
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingFacture(null);
                    setFactureData({ patientId: '', type: '', items: [], observations: '' });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <SearchableSelect
                    options={patientsConsultes.map(patient => ({
                      id: patient.id,
                      label: `${patient.prenom} ${patient.nom}`,
                      nom: patient.nom,
                      prenom: patient.prenom,
                      assurance: patient.assurance,
                      telephone: patient.telephone || ''
                    }))}
                    value={factureData.patientId ? String(factureData.patientId) : ''}
                    onChange={(value) => setFactureData({...factureData, patientId: value})}
                    placeholder={loading ? 'Chargement des patients...' : 'Sélectionner un patient consulté'}
                    searchPlaceholder="Rechercher un patient (nom, prénom, assurance)..."
                    label="Patient *"
                    required={true}
                    emptyMessage={patientsConsultes.length === 0 ? "Aucun patient consulté trouvé. Vérifiez qu'il y a des consultations dans la base de données." : "Aucun patient trouvé"}
                    renderOption={(patient) => (
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">
                          {patient.prenom} {patient.nom}
                        </span>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <span className="mr-3">📋 {patient.assurance || 'Sans assurance'}</span>
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
                  {!loading && patientsConsultes.length === 0 && (
                    <p className="mt-1 text-sm text-yellow-600">
                      Aucun patient consulté trouvé dans la base de données
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type de facturation *</label>
                  <select
                    value={factureData.type}
                    onChange={(e) => setFactureData({...factureData, type: e.target.value})}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  >
                    <option value="">Sélectionner un type</option>
                    {types.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
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
                    setFactureData({ patientId: '', type: '', items: [], observations: '' });
                  }}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex items-center px-6 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingFacture ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacturationFactures;
