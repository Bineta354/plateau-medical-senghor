import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  Clock, 
  FileText,
  Calendar,
  User,
  CreditCard,
  Smartphone,
  Building2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { unifiedNotificationService } from '../../services/unifiedNotificationService';
import { notificationService } from '../../services/notificationService';
import { useReactToPrint } from 'react-to-print';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/permissions';
import { formatMontant } from '../../utils/currency';
import {
  CheckCircleIcon,
  BanknotesIcon,
  ExclamationCircleIcon,
  PrinterIcon,
  XMarkIcon as XIcon,
  MagnifyingGlassIcon,
  LockClosedIcon,
  LockOpenIcon,
  CalendarIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { MODES_PAIEMENT, ETAPES_MOBILE_MONEY as ETAPES_MOBILE_MONEY_BASE } from '../../config/modesPaiement';
import { enregistrerPaiement } from '../../services/paiementService';

const ETAPES_MOBILE_MONEY = (nom, montant) =>
  ETAPES_MOBILE_MONEY_BASE(nom, formatMontant(Number(montant)));

const getStatusBadge = (statut, montant_paye = 0, montant_ttc = 1) => {
  const config = {
    en_attente: { label: 'En attente', class: 'bg-amber-100 text-amber-800' },
    partiel: { label: 'Partiel', class: 'bg-orange-100 text-orange-800' },
    paye: { label: 'Payé', class: 'bg-green-100 text-green-800' },
    impaye: { label: 'Impayé', class: 'bg-red-100 text-red-800' },
  };
  const c = config[statut] || config.en_attente;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.class}`}>
      {c.label}
    </span>
  );
};

const Caisse = () => {
  const { userProfile } = useAuth();
  const isCaissier = userProfile?.role === ROLES.CAISSIER;
  const caissierId = isCaissier ? (userProfile?.id ?? null) : null;
  const [factures, setFactures] = useState([]);
  const [facturesPayees, setFacturesPayees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFacture, setSelectedFacture] = useState(null);
  const [showPaiementModal, setShowPaiementModal] = useState(false);
  const [showPayedInvoices, setShowPayedInvoices] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Accounting view states
  const [viewMode, setViewMode] = useState('caisse'); // 'caisse' or 'supervision'
  const [supervisionPeriod, setSupervisionPeriod] = useState('today');
  const [caissiers, setCaissiers] = useState([]);
  const [selectedCaissier, setSelectedCaissier] = useState('all');
  const [showAlerts, setShowAlerts] = useState(false);
  
  const [etatCaisse, setEtatCaisse] = useState({
    solde: 0,
    fondCaisse: 0,
    totalAujourdhui: 0,
    totalMois: 0,
    parModePaiement: { especes: 0, carte: 0, virement: 0, cheque: 0, orange_money: 0, wave: 0, yas: 0 },
  });
  
  // Enhanced supervision data
  const [supervisionData, setSupervisionData] = useState({
    totalEncaisse: 0,
    totalPaiements: 0,
    ticketMoyen: 0,
    caissiersActifs: 0,
    sessionsOuvertes: 0,
    tendance: { value: 0, label: 'stable' },
    alerts: [],
    topCaissier: null,
    peakHour: null,
  });
  
  const [paiementData, setPaiementData] = useState({
    montant_paye: 0,
    mode_paiement: 'especes',
    notes: '',
  });
  const [assuranceTaux, setAssuranceTaux] = useState(0);
  const [montantPatient, setMontantPatient] = useState(0);
  const [montantAssurance, setMontantAssurance] = useState(0);
  const [couvertureNom, setCouvertureNom] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // DataTables-like: filtre tableau + pagination
  const [tableFilter, setTableFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  // Session de caisse (ouverture/fermeture quotidienne)
  const [sessionCaisse, setSessionCaisse] = useState(null);
  const [showOpenCaisseModal, setShowOpenCaisseModal] = useState(false);
  const [showCloseCaisseModal, setShowCloseCaisseModal] = useState(false);
  const [showArreteModal, setShowArreteModal] = useState(false);
  const [fondCaisseInput, setFondCaisseInput] = useState('');
  const [arreteMois, setArreteMois] = useState({ annee: new Date().getFullYear(), mois: new Date().getMonth() + 1 });
  const [arreteData, setArreteData] = useState([]);
  const [cabinet, setCabinet] = useState(null);
  const [detailsJournee, setDetailsJournee] = useState({
    lignes: [],
    totals: { factures: 0, patient: 0, couverture: 0 },
  });
  const [loadingDetailsJournee, setLoadingDetailsJournee] = useState(false);
  const [showFinDeJournee, setShowFinDeJournee] = useState(false);
  const [showDetailsJournee, setShowDetailsJournee] = useState(false);
  // Historiques Patient / Couverture
  const [historiqueTab, setHistoriqueTab] = useState('patient');
  const [patientsList, setPatientsList] = useState([]);
  const [assurancesList, setAssurancesList] = useState([]);
  const [filterPatientId, setFilterPatientId] = useState('');
  const [filterPatientSearch, setFilterPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [filterAssuranceId, setFilterAssuranceId] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('mois');
  const [historiquePatientData, setHistoriquePatientData] = useState({ lignes: [], stats: { jour: 0, semaine: 0, mois: 0 } });
  const [historiqueCouvertureData, setHistoriqueCouvertureData] = useState({ lignes: [], stats: { jour: 0, semaine: 0, mois: 0 }, global: {} });
  const [loadingHistoriquePatient, setLoadingHistoriquePatient] = useState(false);
  const [loadingHistoriqueCouverture, setLoadingHistoriqueCouverture] = useState(false);
  const componentRef = useRef();
  const searchInputRef = useRef();
  const patientSearchRef = useRef(null);

  const PAGE_SIZES = [10, 25, 50, 100];

  // Factures en attente/partiel uniquement (exclure les factures "couverture" enfants)
  const facturesCaisse = (list) => (list || []).filter((f) => f.facture_parent_id == null);

  // Remplir les suggestions (selectSearch) quand on tape
  useEffect(() => {
    if (!factures.length) return;
    const list = facturesCaisse(factures);
    if (!searchTerm.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearchResults(list);
      return;
    }
    const s = searchTerm.toLowerCase().trim();
    const seen = new Map();
    const sug = [];
    list.forEach((f) => {
      const p = f.consultations?.patients;
      if (!p) return;
      const nom = (p.nom || '').toLowerCase();
      const prenom = (p.prenom || '').toLowerCase();
      const num = (f.numero_facture || '').toLowerCase();
      const match = nom.includes(s) || prenom.includes(s) || `${prenom} ${nom}`.includes(s) || `${nom} ${prenom}`.includes(s) || num.includes(s);
      if (!match) return;
      const key = `${f.id}`;
      if (seen.has(key)) return;
      seen.set(key, true);
      sug.push({
        factureId: f.id,
        prenom: p.prenom,
        nom: p.nom,
        numero_facture: f.numero_facture,
        montant_ttc: f.montant_ttc,
      });
    });
    setSuggestions(sug);
    setShowSuggestions(sug.length > 0);
  }, [searchTerm, factures]);

  // Filtrer les résultats de recherche pour la liste
  useEffect(() => {
    const list = facturesCaisse(factures);
    if (!searchTerm.trim()) {
      setSearchResults(list);
      return;
    }
    const s = searchTerm.toLowerCase().trim();
    const res = list.filter((f) => {
      const p = f.consultations?.patients;
      if (!p) return false;
      const nom = (p.nom || '').toLowerCase();
      const prenom = (p.prenom || '').toLowerCase();
      const num = (f.numero_facture || '').toLowerCase();
      return nom.includes(s) || prenom.includes(s) || `${prenom} ${nom}`.includes(s) || `${nom} ${prenom}`.includes(s) || num.includes(s);
    });
    setSearchResults(res);
  }, [searchTerm, factures]);

  const handleSuggestionClick = (s) => {
    setSearchTerm(`${s.prenom} ${s.nom}`);
    setShowSuggestions(false);
    const f = factures.find((x) => x.id === s.factureId);
    if (f) handleOpenModal(f);
  };

  const handleSearchFocus = () => {
    if (searchTerm && suggestions.length > 0) setShowSuggestions(true);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    if (!e.target.value) setShowSuggestions(false);
  };

  // Filtrage (DataTables) + tri (récent en premier) + pagination pour le tableau
  const tableFilterLower = (tableFilter || '').trim().toLowerCase();
  const tableFiltered = (() => {
    const base = tableFilterLower
      ? searchResults.filter((f) => {
          const p = f.consultations?.patients;
          const nom = (p?.nom || '').toLowerCase();
          const prenom = (p?.prenom || '').toLowerCase();
          const num = (f.numero_facture || '').toLowerCase();
          const dt = f.consultations?.date_consultation ? new Date(f.consultations.date_consultation).toLocaleDateString('fr-FR') : '';
          const montant = String(parseFloat(f.montant_ttc) || 0);
          const haystack = `${nom} ${prenom} ${num} ${dt} ${montant}`;
          return haystack.includes(tableFilterLower);
        })
      : searchResults;
    return [...base].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  })();
  const totalRows = tableFiltered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const effectivePage = Math.min(Math.max(1, page), totalPages);
  const start = (effectivePage - 1) * pageSize;
  const tablePaginated = tableFiltered.slice(start, start + pageSize);

  const selectedPatientForHisto = patientsList.find((p) => String(p.id) === String(filterPatientId));
  const selectedPatientLabel = selectedPatientForHisto ? `${selectedPatientForHisto.prenom || ''} ${selectedPatientForHisto.nom || ''}`.trim() : '';

  // Ramener la page dans les bornes si le filtre a réduit le nombre de pages
  useEffect(() => {
    if (totalPages >= 1 && page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  // Charger l'arrêté quand le modal s'ouvre ou quand mois/année change
  useEffect(() => {
    if (showArreteModal) {
      fetchArreteMensuel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArreteModal]);

  // Récupérer la session de caisse du jour pour le caissier connecté (ou session sans caissier pour secrétariat)
  const fetchSessionCaisse = async () => {
    try {
      const aujourdhui = new Date().toISOString().split('T')[0];
      let q = supabase
        .from('sessions_caisse')
        .select('*')
        .eq('date_session', aujourdhui)
        .eq('statut', 'ouverte');
      if (caissierId != null && caissierId !== '') {
        q = q.eq('caissier_id', caissierId);
      } else {
        q = q.is('caissier_id', null);
      }
      const { data, error } = await q.maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      setSessionCaisse(data || null);
      return data;
    } catch (err) {
      console.error('fetchSessionCaisse:', err);
      setSessionCaisse(null);
      return null;
    }
  };

  // Fetch supervision data for accounting view
  const fetchSupervisionData = async () => {
    try {
      // Get caissiers list
      const { data: caissiersList } = await supabase.rpc('get_caissiers');
      setCaissiers(caissiersList || []);

      // Get payments based on period
      let query = supabase
        .from('paiements')
        .select('*, factures(numero_facture, montant_ttc), users!paiements_caissier_id_fkey(nom, prenom)')
        .eq('statut', 'effectue');

      const startDate = getStartDateForPeriod(supervisionPeriod);
      if (startDate) {
        query = query.gte('date_paiement', startDate.toISOString());
      }

      if (selectedCaissier !== 'all') {
        query = query.eq('caissier_id', selectedCaissier);
      }

      const { data: payments } = await query;

      // Calculate supervision metrics
      const totalEncaisse = payments?.reduce((sum, p) => sum + Number(p.montant || 0), 0) || 0;
      const totalPaiements = payments?.length || 0;
      const ticketMoyen = totalPaiements > 0 ? totalEncaisse / totalPaiements : 0;
      
      // Active cashiers
      const activeCaissiers = new Set(payments?.map(p => p.caissier_id)).size;
      
      // Get open sessions
      const { data: sessions } = await supabase
        .from('sessions_caisse')
        .select('*')
        .eq('statut', 'ouverte');

      // Calculate trend (vs previous period)
      const tendance = await calculateTrend(payments);

      // Find top cashier
      const cashierTotals = {};
      payments?.forEach(p => {
        if (!cashierTotals[p.caissier_id]) {
          cashierTotals[p.caissier_id] = { total: 0, name: p.users?.nom || 'Unknown' };
        }
        cashierTotals[p.caissier_id].total += Number(p.montant || 0);
      });
      
      const topCaissier = Object.entries(cashierTotals)
        .sort(([,a], [,b]) => b.total - a.total)[0];

      // Find peak hour
      const hourTotals = {};
      payments?.forEach(p => {
        const hour = new Date(p.date_paiement).getHours();
        hourTotals[hour] = (hourTotals[hour] || 0) + Number(p.montant || 0);
      });
      
      const peakHour = Object.entries(hourTotals)
        .sort(([,a], [,b]) => b - a)[0];

      // Generate alerts
      const alerts = generateAlerts(totalEncaisse, sessions, activeCaissiers);

      setSupervisionData({
        totalEncaisse,
        totalPaiements,
        ticketMoyen,
        caissiersActifs: activeCaissiers,
        sessionsOuvertes: sessions?.length || 0,
        tendance,
        alerts,
        topCaissier: topCaissier ? { id: topCaissier[0], name: topCaissier[1].name, total: topCaissier[1].total } : null,
        peakHour: peakHour ? { hour: peakHour[0], total: peakHour[1] } : null,
      });
    } catch (error) {
      console.error('Error fetching supervision data:', error);
    }
  };

  const getStartDateForPeriod = (period) => {
    const now = new Date();
    switch (period) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      default:
        return null;
    }
  };

  const calculateTrend = async (currentPayments) => {
    // Simple trend calculation vs previous period
    const currentTotal = currentPayments?.reduce((sum, p) => sum + Number(p.montant || 0), 0) || 0;
    
    // Get previous period data (simplified)
    const now = new Date();
    const previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const previousEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const { data: previousPayments } = await supabase
      .from('paiements')
      .select('montant')
      .eq('statut', 'effectue')
      .gte('date_paiement', previousStart.toISOString())
      .lt('date_paiement', previousEnd.toISOString());

    const previousTotal = previousPayments?.reduce((sum, p) => sum + Number(p.montant || 0), 0) || 0;
    
    if (previousTotal === 0) return { value: 0, label: 'stable' };
    
    const change = ((currentTotal - previousTotal) / previousTotal) * 100;
    return {
      value: change,
      label: change > 5 ? 'hausse' : change < -5 ? 'baisse' : 'stable'
    };
  };

  const generateAlerts = (total, sessions, activeCashiers) => {
    const alerts = [];
    
    if (total < 50000) {
      alerts.push({
        type: 'warning',
        message: 'Fond de caisse faible',
        description: 'Total encaissé inférieur à 50 000 FCFA'
      });
    }
    
    if (sessions?.length > 0) {
      alerts.push({
        type: 'info',
        message: `${sessions.length} session(s) ouverte(s)`,
        description: 'Vérifiez que les caisses ont été fermées correctement'
      });
    }
    
    if (activeCashiers === 0) {
      alerts.push({
        type: 'error',
        message: 'Aucun caissier actif',
        description: 'Aucune transaction enregistrée aujourd\'hui'
      });
    }
    
    return alerts;
  };

  const fetchEtatCaisse = async () => {
    try {
      const debutJour = new Date();
      debutJour.setHours(0, 0, 0, 0);
      const debutMois = new Date();
      debutMois.setDate(1);
      debutMois.setHours(0, 0, 0, 0);

      // Récupérer la session du jour pour le fond de caisse
      const session = await fetchSessionCaisse();
      const fondCaisse = parseFloat(session?.fond_caisse || 0);

      // Calculer le total journalier (paiements du jour ; si caissier : uniquement les siens)
      let qJour = supabase.from('paiements').select('*').eq('statut', 'effectue').gte('date_paiement', debutJour.toISOString());
      if (caissierId) qJour = qJour.eq('caissier_id', caissierId);
      const { data: paiements, error } = await qJour;
      if (error) throw error;

      // Total du mois (si caissier : uniquement les siens)
      let qMois = supabase.from('paiements').select('*').eq('statut', 'effectue').gte('date_paiement', debutMois.toISOString());
      if (caissierId) qMois = qMois.eq('caissier_id', caissierId);
      const { data: paiementsMois, error: errMois } = await qMois;
      if (errMois) throw errMois;

      const calc = (arr, pred) => (arr || []).filter(pred).reduce((sum, p) => sum + parseFloat(p.montant || 0), 0);
      const aujourdhui = calc(paiements, () => true);
      const mois = calc(paiementsMois, () => true);

      // Par mode (pour la journée uniquement)
      const parMode = (paiements || []).reduce(
        (acc, p) => {
          const m = p.mode_paiement || 'especes';
          acc[m] = (acc[m] || 0) + parseFloat(p.montant || 0);
          return acc;
        },
        { especes: 0, carte: 0, virement: 0, cheque: 0, orange_money: 0, wave: 0, yas: 0 }
      );

      // Solde actuel = fond de caisse + total journée
      const soldeActuel = fondCaisse + aujourdhui;

      setEtatCaisse({
        solde: soldeActuel,
        fondCaisse,
        totalAujourdhui: aujourdhui,
        totalMois: mois,
        parModePaiement: parMode,
      });
    } catch (err) {
      console.error('fetchEtatCaisse:', err);
      setEtatCaisse({ solde: 0, fondCaisse: 0, totalAujourdhui: 0, totalMois: 0, parModePaiement: { especes: 0, carte: 0, virement: 0, cheque: 0, orange_money: 0, wave: 0, yas: 0 } });
    }
  };

  // Détails de la journée (vérification de fin de journée)
  const fetchDetailsJournee = async () => {
    try {
      setLoadingDetailsJournee(true);
      const debutJour = new Date();
      debutJour.setHours(0, 0, 0, 0);
      const finJour = new Date();
      finJour.setHours(23, 59, 59, 999);

      let qPaiements = supabase
        .from('paiements')
        .select(
          `*,
          factures (
            id,
            numero_facture,
            montant_ttc,
            consultations (
              date_consultation,
              patients (
                id, nom, prenom, numero_secu,
                assurances ( id, nom, taux_remboursement )
              )
            )
          )`
        )
        .eq('statut', 'effectue')
        .gte('date_paiement', debutJour.toISOString())
        .lte('date_paiement', finJour.toISOString());
      if (caissierId) qPaiements = qPaiements.eq('caissier_id', caissierId);
      const { data, error } = await qPaiements.order('date_paiement', { ascending: true });

      if (error) throw error;

      const lignes = (data || []).map((p) => {
        const facture = p.factures;
        const patient = facture?.consultations?.patients;
        const assurance = patient?.assurances;
        const montantFacture = parseFloat(facture?.montant_ttc || 0);
        const taux = Number(assurance?.taux_remboursement) || 0;

        let partCouverture = 0;
        let partPatient = montantFacture;
        if (taux > 0 && montantFacture > 0) {
          partCouverture = Math.round(montantFacture * (taux / 100));
          partPatient = montantFacture - partCouverture;
        }

        return {
          id: p.id,
          date_paiement: p.date_paiement,
          mode_paiement: p.mode_paiement,
          montant_paye: parseFloat(p.montant || 0),
          montant_facture: montantFacture,
          partPatient,
          partCouverture,
          patient,
          assurance,
          numero_facture: facture?.numero_facture || '',
        };
      });

      const totals = lignes.reduce(
        (acc, l) => {
          acc.factures += l.montant_facture;
          acc.patient += l.partPatient;
          acc.couverture += l.partCouverture;
          return acc;
        },
        { factures: 0, patient: 0, couverture: 0 }
      );

      setDetailsJournee({ lignes, totals });
    } catch (err) {
      console.error('fetchDetailsJournee:', err);
      setDetailsJournee({ lignes: [], totals: { factures: 0, patient: 0, couverture: 0 } });
    } finally {
      setLoadingDetailsJournee(false);
    }
  };

  const handleToggleDetailsJournee = () => {
    setShowDetailsJournee((prev) => {
      const next = !prev;
      if (!prev) {
        fetchDetailsJournee();
      }
      return next;
    });
  };

  const handleOpenFinDeJournee = () => {
    setShowFinDeJournee(true);
    setShowDetailsJournee(true);
    fetchDetailsJournee();
  };

  const fetchPatientsList = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, nom, prenom')
        .order('nom');
      if (error) throw error;
      setPatientsList(data || []);
    } catch (err) {
      console.error('fetchPatientsList:', err);
      setPatientsList([]);
    }
  };

  const fetchAssurancesList = async () => {
    try {
      const { data, error } = await supabase
        .from('assurances')
        .select('id, nom, taux_remboursement')
        .order('nom');
      if (error) throw error;
      setAssurancesList(data || []);
    } catch (err) {
      console.error('fetchAssurancesList:', err);
      setAssurancesList([]);
    }
  };

  const getDateRangeForPeriod = (period) => {
    const now = new Date();
    const debut = new Date(now);
    debut.setHours(0, 0, 0, 0);
    if (period === 'jour') {
      return { debut, fin: now };
    }
    if (period === 'semaine') {
      const day = debut.getDay();
      const diff = debut.getDate() - day + (day === 0 ? -6 : 1);
      debut.setDate(diff);
      return { debut, fin: now };
    }
    debut.setDate(1);
    return { debut, fin: now };
  };

  const fetchHistoriquePatient = async () => {
    if (!filterPatientId) {
      setHistoriquePatientData({ lignes: [], stats: { jour: 0, semaine: 0, mois: 0 } });
      return;
    }
    try {
      setLoadingHistoriquePatient(true);
      let facturesPayeesPatient = [];

      if (isCaissier && caissierId) {
        // Ce caissier ne voit que les factures qu'il a encaissées pour ce patient (via ses paiements)
        const { data: paiementsCaissier, error: e0 } = await supabase
          .from('paiements')
          .select(
            `id, date_paiement, mode_paiement, montant, facture_id,
             factures (
               id, numero_facture, montant_ttc, date_paiement, mode_paiement, patient_id,
               consultations ( date_consultation, patients ( id, nom, prenom, numero_secu, assurances ( id, nom, taux_remboursement ) ) )
             )`
          )
          .eq('caissier_id', caissierId)
          .order('date_paiement', { ascending: false })
          .limit(500);
        if (e0) throw e0;
        const byFactureId = {};
        (paiementsCaissier || []).forEach((p) => {
          const f = p.factures;
          if (!f || String(f.patient_id) !== String(filterPatientId)) return;
          if (!byFactureId[f.id]) {
            byFactureId[f.id] = { ...f, date_paiement: p.date_paiement, mode_paiement: p.mode_paiement || f.mode_paiement };
          }
        });
        facturesPayeesPatient = Object.values(byFactureId);
      } else {
        const { data, error: e1 } = await supabase
          .from('factures')
          .select(
            `*,
            consultations ( date_consultation, patients ( id, nom, prenom, numero_secu, assurances ( id, nom, taux_remboursement ) ) )
            `
          )
          .eq('statut_paiement', 'paye')
          .eq('patient_id', filterPatientId)
          .is('facture_parent_id', null)
          .order('date_paiement', { ascending: false })
          .limit(500);
        if (e1) throw e1;
        facturesPayeesPatient = data || [];
      }

      const lignes = facturesPayeesPatient.map((f) => {
        const patient = f.consultations?.patients;
        const assurance = patient?.assurances;
        const montantFacture = parseFloat(f.montant_ttc || 0);
        const taux = Number(assurance?.taux_remboursement) || 0;
        let partCouverture = 0;
        let partPatient = montantFacture;
        if (taux > 0 && montantFacture > 0) {
          partCouverture = Math.round(montantFacture * (taux / 100));
          partPatient = montantFacture - partCouverture;
        }
        return {
          id: f.id,
          numero_facture: f.numero_facture,
          date_paiement: f.date_paiement,
          montant_ttc: montantFacture,
          partPatient,
          partCouverture,
          mode_paiement: f.mode_paiement,
          assurance: assurance?.nom,
          taux,
        };
      });

      const stats = { jour: 0, semaine: 0, mois: 0 };
      ['jour', 'semaine', 'mois'].forEach((p) => {
        const { debut } = getDateRangeForPeriod(p);
        lignes.forEach((l) => {
          const d = new Date(l.date_paiement);
          if (d >= debut) stats[p] += l.partPatient;
        });
      });

      setHistoriquePatientData({ lignes, stats });
    } catch (err) {
      console.error('fetchHistoriquePatient:', err);
      setHistoriquePatientData({ lignes: [], stats: { jour: 0, semaine: 0, mois: 0 } });
    } finally {
      setLoadingHistoriquePatient(false);
    }
  };

  // Helpers export CSV
  const downloadCsv = (filename, headers, rows) => {
    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes('"') || s.includes(';') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const lines = [];
    lines.push(headers.map(escape).join(';'));
    rows.forEach((r) => lines.push(r.map(escape).join(';')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportJourneeCsv = () => {
    if (!detailsJournee.lignes.length) return;
    const headers = [
      'Patient',
      'Numéro facture',
      'Montant facture',
      'Part patient',
      'Part couverture',
      'Mode',
      'Date paiement',
      'Heure paiement',
    ];
    const rows = detailsJournee.lignes.map((l) => {
      const d = l.date_paiement ? new Date(l.date_paiement) : null;
      const formatNumberOnly = (val) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0, useGrouping: true }).format(val).replace(/\u00A0/g, ' ');
      return [
        `${l.patient?.prenom || ''} ${l.patient?.nom || ''}`.trim(),
        l.numero_facture,
        formatNumberOnly(l.montant_facture),
        formatNumberOnly(l.partPatient),
        formatNumberOnly(l.partCouverture),
        MODES_PAIEMENT.find((m) => m.value === l.mode_paiement)?.label || l.mode_paiement,
        d ? d.toLocaleDateString('fr-FR') : '',
        d ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
      ];
    });
    downloadCsv(
      `etat_caisse_jour_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    );
  };

  const handleExportHistoriquePatientCsv = () => {
    if (!historiquePatientData.lignes.length) return;
    const headers = [
      'Numéro facture',
      'Date paiement',
      'Montant facture',
      'Part patient',
      'Part couverture',
      'Couverture',
      'Mode',
    ];
    const rows = historiquePatientData.lignes.map((l) => {
      const d = l.date_paiement ? new Date(l.date_paiement) : null;
      const formatNumberOnly = (val) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0, useGrouping: true }).format(val).replace(/\u00A0/g, ' ');
      return [
        l.numero_facture,
        d ? d.toLocaleDateString('fr-FR') : '',
        formatNumberOnly(l.montant_ttc),
        formatNumberOnly(l.partPatient),
        formatNumberOnly(l.partCouverture),
        l.assurance || '',
        MODES_PAIEMENT.find((m) => m.value === l.mode_paiement)?.label || l.mode_paiement,
      ];
    });
    downloadCsv(
      `historique_patient_${filterPatientId}_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    );
  };

  const handleExportHistoriqueCouvertureCsv = () => {
    if (!historiqueCouvertureData.lignes.length) return;
    const headers = [
      'Date',
      'Patient',
      'Numéro facture',
      'Montant facture',
      'Part patient',
      'Part couverture',
      'Mode',
    ];
    const rows = historiqueCouvertureData.lignes.map((l) => {
      const d = l.date_paiement ? new Date(l.date_paiement) : null;
      const formatNumberOnly = (val) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0, useGrouping: true }).format(val).replace(/\u00A0/g, ' ');
      return [
        d ? d.toLocaleDateString('fr-FR') : '',
        l.patient,
        l.numero_facture,
        formatNumberOnly(l.montant_ttc),
        formatNumberOnly(l.partPatient),
        formatNumberOnly(l.partCouverture),
        MODES_PAIEMENT.find((m) => m.value === l.mode_paiement)?.label || l.mode_paiement,
      ];
    });
    downloadCsv(
      `historique_couverture_${filterAssuranceId}_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    );
  };

  const fetchHistoriqueCouverture = async () => {
    if (!filterAssuranceId) {
      setHistoriqueCouvertureData({ lignes: [], stats: { jour: 0, semaine: 0, mois: 0 }, global: {} });
      return;
    }
    try {
      setLoadingHistoriqueCouverture(true);
      let facturesSource = [];

      if (isCaissier && caissierId) {
        const { data: paiementsCaissier, error: e0 } = await supabase
          .from('paiements')
          .select(
            `id, date_paiement, mode_paiement, montant, facture_id,
             factures (
               id, numero_facture, montant_ttc, date_paiement, mode_paiement,
               consultations ( date_consultation, patients ( id, nom, prenom, assurance_id, assurances ( id, nom, taux_remboursement ) ) )
             )`
          )
          .eq('caissier_id', caissierId)
          .order('date_paiement', { ascending: false })
          .limit(1000);
        if (e0) throw e0;
        const byFactureId = {};
        (paiementsCaissier || []).forEach((p) => {
          const f = p.factures;
          if (!f) return;
          const patient = f.consultations?.patients;
          const aid = patient?.assurance_id ?? patient?.assurances?.id;
          if (String(aid) !== String(filterAssuranceId)) return;
          if (!byFactureId[f.id]) {
            byFactureId[f.id] = { ...f, date_paiement: p.date_paiement, mode_paiement: p.mode_paiement || f.mode_paiement };
          }
        });
        facturesSource = Object.values(byFactureId);
      } else {
        const { data, error: e2 } = await supabase
          .from('factures')
          .select(
            `*,
            consultations ( date_consultation, patients ( id, nom, prenom, assurance_id, assurances ( id, nom, taux_remboursement ) ) )
            `
          )
          .eq('statut_paiement', 'paye')
          .is('facture_parent_id', null)
          .order('date_paiement', { ascending: false })
          .limit(1000);
        if (e2) throw e2;
        facturesSource = data || [];
      }

      const lignes = [];
      facturesSource.forEach((f) => {
        const patient = f.consultations?.patients;
        const aid = patient?.assurance_id ?? patient?.assurances?.id;
        if (String(aid) !== String(filterAssuranceId)) return;
        const assurance = patient?.assurances;
        const montantFacture = parseFloat(f.montant_ttc || 0);
        const taux = Number(assurance?.taux_remboursement) || 0;
        let partCouverture = 0;
        let partPatient = montantFacture;
        if (taux > 0 && montantFacture > 0) {
          partCouverture = Math.round(montantFacture * (taux / 100));
          partPatient = montantFacture - partCouverture;
        }
        if (partCouverture <= 0) return;
        lignes.push({
          id: f.id,
          numero_facture: f.numero_facture,
          date_paiement: f.date_paiement,
          patient: `${patient?.prenom || ''} ${patient?.nom || ''}`.trim(),
          montant_ttc: montantFacture,
          partPatient,
          partCouverture,
          mode_paiement: f.mode_paiement,
          assurance: assurance?.nom,
        });
      });

      const stats = { jour: 0, semaine: 0, mois: 0 };
      ['jour', 'semaine', 'mois'].forEach((p) => {
        const { debut } = getDateRangeForPeriod(p);
        lignes.forEach((l) => {
          const d = new Date(l.date_paiement);
          if (d >= debut) stats[p] += l.partCouverture;
        });
      });

      const global = { jour: stats.jour, semaine: stats.semaine, mois: stats.mois };
      setHistoriqueCouvertureData({ lignes, stats, global });
    } catch (err) {
      console.error('fetchHistoriqueCouverture:', err);
      setHistoriqueCouvertureData({ lignes: [], stats: { jour: 0, semaine: 0, mois: 0 }, global: {} });
    } finally {
      setLoadingHistoriqueCouverture(false);
    }
  };

  useEffect(() => {
    if (historiqueTab === 'patient') fetchPatientsList();
    if (historiqueTab === 'couverture') fetchAssurancesList();
  }, [historiqueTab]);

  useEffect(() => {
    if (filterPatientId) fetchHistoriquePatient();
    else setHistoriquePatientData({ lignes: [], stats: { jour: 0, semaine: 0, mois: 0 } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterPatientId]);

  useEffect(() => {
    if (filterAssuranceId) fetchHistoriqueCouverture();
    else setHistoriqueCouvertureData({ lignes: [], stats: { jour: 0, semaine: 0, mois: 0 }, global: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAssuranceId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (patientSearchRef.current && !patientSearchRef.current.contains(e.target)) {
        setShowPatientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchFacturesPayees = async () => {
    try {
      const { data: payees, error } = await supabase
        .from('factures')
        .select(
          `*,
          consultations (
            date_consultation,
            patients ( id, nom, prenom, assurances ( nom, taux_remboursement ) )
          )
        `
        )
        .eq('statut_paiement', 'paye')
        .order('date_paiement', { ascending: false })
        .limit(100);

      if (error) throw error;
      setFacturesPayees(facturesCaisse(payees || []));
    } catch (err) {
      console.error('fetchFacturesPayees:', err);
      setFacturesPayees([]);
    }
  };

  const fetchFactures = async () => {
    try {
      setLoading(true);

      const { data: enAttente, error: e1 } = await supabase
        .from('factures')
        .select(
          `*,
          consultations (
            date_consultation,
            patient_id,
            patients (
              id, nom, prenom, numero_secu, assurance_id,
              assurances ( id, nom, taux_remboursement )
            )
          )
        `
        )
        .or('statut_paiement.eq.en_attente,statut_paiement.eq.partiel')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (e1) throw e1;
      const list = facturesCaisse(enAttente || []);
      setFactures(enAttente || []);
      setSearchResults(list);

      const { data: payees, error: e2 } = await supabase
        .from('factures')
        .select(
          `*,
          consultations (
            date_consultation,
            patients ( id, nom, prenom, assurances ( nom, taux_remboursement ) )
          )
        `
        )
        .eq('statut_paiement', 'paye')
        .order('date_paiement', { ascending: false })
        .limit(100);

      if (e2) throw e2;
      setFacturesPayees(facturesCaisse(payees || []));
    } catch (err) {
      console.error('fetchFactures:', err);
      setFactures([]);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Note : 'accounting' n'a jamais accès à /caisse (voir financeNavigation.js) — seul 'admin'
    // atterrit réellement en mode supervision ici.
    if (userProfile?.role === 'admin') {
      setViewMode('supervision');
      fetchSupervisionData();
    }
    fetchFactures();
    fetchEtatCaisse();
    fetchSessionCaisse();
    fetchFacturesPayees();
  }, [userProfile]);

  useEffect(() => {
    if (viewMode === 'supervision') {
      fetchSupervisionData();
    }
  }, [viewMode, supervisionPeriod, selectedCaissier]);

  useEffect(() => {
    const tenantId = userProfile?.tenant_id;
    if (!tenantId) {
      setCabinet(null);
      return;
    }
    supabase
      .from('parametres_cabinet')
      .select('nom_cabinet, adresse, ville, code_postal, telephone, email, logo_url')
      .eq('tenant_id', tenantId)
      .maybeSingle()
      .then((r) => setCabinet(r.data || null));
  }, [userProfile?.tenant_id]);

  // Ouvrir la caisse (réinitialisation matinale + fond de caisse)
  const handleOpenCaisse = async () => {
    try {
      const fondCaisse = parseFloat(fondCaisseInput) || 0;
      if (fondCaisse < 0) {
        unifiedNotificationService.error('Le fond de caisse doit être positif ou nul');
        return;
      }

      const aujourdhui = new Date().toISOString().split('T')[0];
      const currentCaissierId = userProfile?.id ?? null;

      // Vérifier s'il y a déjà une session ouverte aujourd'hui POUR CE CAISSIER
      let checkQ = supabase
        .from('sessions_caisse')
        .select('id')
        .eq('date_session', aujourdhui)
        .eq('statut', 'ouverte');
      if (currentCaissierId != null && currentCaissierId !== '') {
        checkQ = checkQ.eq('caissier_id', currentCaissierId);
      } else {
        checkQ = checkQ.is('caissier_id', null);
      }
      const { data: existing, error: checkErr } = await checkQ.maybeSingle();

      if (checkErr && checkErr.code !== 'PGRST116') throw checkErr;

      if (existing) {
        unifiedNotificationService.error('Votre session de caisse est déjà ouverte aujourd\'hui. Utilisez « Mise à jour caisse » pour rafraîchir ou fermez la session en fin de journée.');
        return;
      }

      // Créer une nouvelle session (liée à ce caissier)
      const { data, error } = await supabase
        .from('sessions_caisse')
        .insert({
          date_session: aujourdhui,
          fond_caisse: fondCaisse,
          caissier_id: currentCaissierId,
          statut: 'ouverte',
        })
        .select()
        .single();

      if (error) throw error;

      setSessionCaisse(data);
      setShowOpenCaisseModal(false);
      setFondCaisseInput('');
      await fetchSessionCaisse();
      fetchEtatCaisse();
      unifiedNotificationService.success(`Caisse ouverte avec un fond de ${formatMontant(fondCaisse)}`);
    } catch (err) {
      console.error('handleOpenCaisse:', err);
      unifiedNotificationService.error('Erreur lors de l\'ouverture de la caisse: ' + (err?.message || err));
    }
  };

  // Fermer la caisse (enregistre le montant journalier)
  const handleCloseCaisse = async () => {
    try {
      if (!sessionCaisse) {
        unifiedNotificationService.error('Aucune session de caisse ouverte');
        return;
      }
      // Sécurité : ne fermer que sa propre session
      if (caissierId != null && String(sessionCaisse.caissier_id) !== String(caissierId)) {
        unifiedNotificationService.error('Cette session ne vous appartient pas. Veuillez rafraîchir la page.');
        return;
      }

      // Utiliser la fonction SQL pour fermer (calcule automatiquement le montant journalier)
      const { data, error } = await supabase.rpc('fermer_session_caisse', {
        p_session_id: sessionCaisse.id,
      });

      if (error) throw error;

      setSessionCaisse(null);
      setShowCloseCaisseModal(false);
      await fetchSessionCaisse();
      fetchEtatCaisse();
      unifiedNotificationService.success(`Caisse fermée. Montant journalier: ${formatMontant(data.montant_journalier || 0)}`);
    } catch (err) {
      console.error('handleCloseCaisse:', err);
      unifiedNotificationService.error('Erreur lors de la fermeture de la caisse: ' + (err?.message || err));
    }
  };

  // Réinitialiser la caisse (pour le lendemain - supprime la session fermée si besoin)
  const handleResetCaisse = async () => {
    if (!confirm('Réinitialiser la caisse pour demain ? Cette action est irréversible.')) return;
    try {
      // La réinitialisation se fait en ouvrant une nouvelle session le lendemain
      // On ne supprime pas les sessions fermées (elles servent pour l'arrêté)
      setSessionCaisse(null);
      setFondCaisseInput('');
      fetchEtatCaisse();
      unifiedNotificationService.success('Caisse réinitialisée. Vous pouvez maintenant ouvrir une nouvelle session.');
    } catch (err) {
      console.error('handleResetCaisse:', err);
      unifiedNotificationService.error('Erreur lors de la réinitialisation: ' + (err?.message || err));
    }
  };

  // Charger l'arrêté comptable mensuel
  const fetchArreteMensuel = async () => {
    try {
      const { data, error } = await supabase.rpc('get_arrete_comptable_mensuel', {
        p_annee: arreteMois.annee,
        p_mois: arreteMois.mois,
      });
      if (error) throw error;
      setArreteData(data || []);
    } catch (err) {
      console.error('fetchArreteMensuel:', err);
      setArreteData([]);
      unifiedNotificationService.error('Erreur lors du chargement de l\'arrêté: ' + (err?.message || err));
    }
  };

  // Synchronisation automatique de l'état de la caisse : Realtime (paiements) + rafraîchissement périodique
  useEffect(() => {
    const channel = supabase
      .channel('caisse-paiements')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'paiements' },
        () => { fetchEtatCaisse(); }
      )
      .subscribe((status, err) => {
        if (err) console.warn('[Caisse] Realtime paiements:', err?.message || err);
      });

    const interval = setInterval(fetchEtatCaisse, 45_000); // toutes les 45 s en secours

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const handleOpenModal = (facture) => {
    setSelectedFacture(facture);
    const patient = facture.consultations?.patients;
    const assurance = patient?.assurances;
    const taux = Number(assurance?.taux_remboursement) || 0;
    const total = parseFloat(facture.montant_ttc) || 0;
    const deja = parseFloat(facture.montant_paye) || 0;
    const restant = total - deja;

    let partPatient = restant;
    let partCouverture = 0;
    if (taux > 0 && restant > 0) {
      partCouverture = Math.round(restant * (taux / 100) * 100) / 100;
      partPatient = Math.round((restant - partCouverture) * 100) / 100;
    }

    setAssuranceTaux(taux);
    setMontantPatient(partPatient);
    setMontantAssurance(partCouverture);
    setCouvertureNom(assurance?.nom || 'Couverture');
    setPaiementData({
      montant_paye: partPatient,
      mode_paiement: 'especes',
      notes: '',
    });
    setShowPaiementModal(true);
  };

  const handleMontantChange = (e) => {
    const v = parseFloat(e.target.value) || 0;
    setPaiementData((d) => ({ ...d, montant_paye: v }));
  };

  const facturePaiementCss = `
    body { font-family: Arial, sans-serif; font-size: 12px; padding: 24px; max-width: 800px; margin: 0 auto; }
    .header-info { display: flex; align-items: flex-start; gap: 24px; margin-bottom: 24px; border-bottom: 2px solid #1e40af; padding-bottom: 16px; }
    .logo-container { flex-shrink: 0; }
    .cabinet-logo { max-height: 60px; max-width: 120px; object-fit: contain; }
    .header-content { flex: 1; }
    .cabinet-info h4 { margin: 0 0 8px 0; font-size: 18px; color: #1e40af; }
    .cabinet-info p { margin: 2px 0; color: #555; font-size: 11px; }
    .titre-doc { font-size: 18px; font-weight: bold; margin: 16px 0 12px 0; color: #1e3a5f; }
    .info-section { margin-bottom: 16px; }
    .info-section h3 { font-size: 13px; margin: 0 0 6px 0; color: #374151; }
    .info-section p { margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
    th { background: #f3f4f6; font-weight: bold; font-size: 11px; }
    .totaux { margin-top: 20px; padding: 12px; background: #f9fafb; border-radius: 8px; }
    .totaux p { margin: 6px 0; font-weight: bold; }
    .footer { margin-top: 28px; font-size: 10px; color: #6b7280; }
  `;

  const buildFacturePaiementHtml = (facture, paiement, montantAssuranceVal, nomCouvertureVal, doPrint) => {
    if (!facture) return null;
    const patient = facture.consultations?.patients;
    const assurance = patient?.assurances;
    const baseNum = (facture.numero_facture || '').replace(/-C$/, '');
    const caissierLabel = userProfile ? `${userProfile.prenom || ''} ${userProfile.nom || ''}`.trim() || '–' : '–';
    const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const modeLabel = MODES_PAIEMENT.find((m) => m.value === paiement.mode_paiement)?.label || paiement.mode_paiement;
    const montantPaye = parseFloat(paiement.montant_paye || 0);
    const montantTtc = parseFloat(facture.montant_ttc || 0);
    const montantRestant = Math.max(0, montantTtc - montantPaye - parseFloat(facture.montant_paye || 0));
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Facture – Paiement ${baseNum}</title><style>${facturePaiementCss}</style></head><body>
    <div class="header-info">
      ${cabinet?.logo_url ? `<div class="logo-container"><img src="${cabinet.logo_url}" alt="Logo" class="cabinet-logo" /></div>` : ''}
      <div class="header-content">
        <div class="cabinet-info">
          <h4>${cabinet?.nom_cabinet || 'Cabinet Médical'}</h4>
          ${cabinet?.adresse ? `<p>${cabinet.adresse}</p>` : ''}
          ${cabinet?.telephone ? `<p>Tél: ${cabinet.telephone}</p>` : ''}
        </div>
      </div>
    </div>
    <div class="titre-doc">FACTURE – PAIEMENT</div>
    <div class="info-section">
      <h3>Patient</h3>
      <p><strong>${patient?.prenom || ''} ${patient?.nom || ''}</strong></p>
      ${patient?.numero_secu ? `<p>N° Sécurité sociale : ${patient.numero_secu}</p>` : ''}
      ${assurance ? `<p>Couverture : ${assurance.nom} (${assurance.taux_remboursement || 0} %)</p>` : ''}
    </div>
    <div class="info-section">
      <p><strong>N° facture :</strong> ${baseNum}</p>
      <p><strong>Date d'édition :</strong> ${dateStr}</p>
      <p><strong>Caissier :</strong> ${caissierLabel}</p>
    </div>
    <table>
      <thead><tr><th>Désignation</th><th style="text-align:right">Montant</th></tr></thead>
      <tbody>
        <tr><td>Montant total TTC</td><td style="text-align:right">${formatMontant(montantTtc)}</td></tr>
        <tr><td>Montant payé (ce paiement)</td><td style="text-align:right">${formatMontant(montantPaye)}</td></tr>
        <tr><td>Mode de paiement</td><td style="text-align:right">${modeLabel}</td></tr>
        ${montantAssuranceVal > 0 ? `<tr><td>Part couverture (${nomCouvertureVal || 'Assurance'})</td><td style="text-align:right">${formatMontant(Number(montantAssuranceVal))}</td></tr>` : ''}
        <tr><td><strong>Reste à payer</strong></td><td style="text-align:right"><strong>${formatMontant(montantRestant)}</strong></td></tr>
      </tbody>
    </table>
    <div class="totaux">
      <p><strong>Montant encaissé :</strong> ${formatMontant(montantPaye)}</p>
    </div>
    <div class="footer">Document généré depuis la caisse – Paiement enregistré le ${dateStr}.</div>
    ${doPrint ? '<script>window.onload=function(){setTimeout(function(){window.print();},400);}</script>' : ''}
    </body></html>`;
    return html;
  };

  const openFacturePaiementWindow = (html) => {
    if (!html) return;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  const handlePaiementSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFacture) return;
    
    // Vérifier que la caisse est ouverte
    if (!sessionCaisse) {
      unifiedNotificationService.error('La caisse est fermée. Veuillez d\'abord ouvrir une session de caisse.');
      return;
    }
    
    setSubmitting(true);

    try {
      const montantPaye = parseFloat(paiementData.montant_paye) || 0;
      const caissierId = userProfile?.id ?? null;

      // 1) Encaissement via le moteur unique (écrit factures + paiements de façon cohérente)
      const { paiement: paiementDataResult } = await enregistrerPaiement({
        factureId: selectedFacture.id,
        montant: montantPaye,
        modePaiement: paiementData.mode_paiement,
        notes: paiementData.notes,
        caissierId,
      });

      // 2) Si couverture : créer une 2e facture, même numéro de base (suffixe -C en BDD pour unicité)
      if (montantAssurance > 0) {
        const consultationId = selectedFacture.consultation_id;
        const patientId = selectedFacture.patient_id || selectedFacture.consultations?.patients?.id || selectedFacture.consultations?.patient_id;
        const assuranceId = selectedFacture.consultations?.patients?.assurance_id || selectedFacture.consultations?.patients?.assurances?.id;

        const { error: insErr } = await supabase.from('factures').insert({
          consultation_id: consultationId,
          patient_id: patientId,
          assurance_id: assuranceId || null,
          numero_facture: `${selectedFacture.numero_facture}-C`,
          montant_ht: montantAssurance,
          tva: 0,
          montant_ttc: montantAssurance,
          montant_paye: 0,
          statut_paiement: 'en_attente',
          type: 'couverture',
          facture_parent_id: selectedFacture.id,
        });

        if (insErr) throw insErr;
      }

      // Notifier les caissiers du paiement effectué
      const patient = selectedFacture.consultations?.patients;
      const patientName = patient ? `${patient.prenom} ${patient.nom}` : 'Patient';
      const cashierName = userProfile ? `${userProfile.prenom} ${userProfile.nom}` : 'Caissier';
      await notificationService.notifyCashierPaymentMade(
        paiementDataResult.id,
        patientName,
        montantPaye,
        cashierName,
        userProfile?.tenant_id || null
      );

      // Générer la facture pour ce paiement (même modèle que Récapitulatif)
      const facturePaiementHtml = buildFacturePaiementHtml(
        selectedFacture,
        { montant_paye: montantPaye, mode_paiement: paiementData.mode_paiement, notes: paiementData.notes },
        montantAssurance,
        couvertureNom,
        true
      );

      // Désactiver l'impression automatique pour éviter les plantages
      // TODO: Réactiver quand react-to-print sera stable
      console.log('Impression du reçu désactivée temporairement');
      
      setTimeout(() => {
        openFacturePaiementWindow(facturePaiementHtml);
      }, 200);
      setTimeout(() => {
        setShowPaiementModal(false);
        setSelectedFacture(null);
        fetchFactures();
        fetchEtatCaisse();
      }, 300);
    } catch (err) {
      console.error('handlePaiementSubmit:', err);
      unifiedNotificationService.error("Erreur lors de l'enregistrement : " + (err?.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintReceipt = useReactToPrint({ 
    content: () => componentRef.current,
    onBeforeGetContent: () => {
      // Vérifier qu'il y a du contenu à imprimer
      if (!componentRef.current) {
        console.warn('Aucun contenu à imprimer');
        return false;
      }
      return true;
    },
    onPrintError: (error) => {
      console.warn('Erreur lors de l\'impression:', error);
    }
  });

  // ——— Reçu (même numéro affiché pour patient et couverture) avec date et lignes signatures ———
  const Receipt = React.forwardRef(
    ({ facture, paiement, montantAssurance, couvertureNom: nomCouverture }, ref) => {
      if (!facture) return null;
      const patient = facture.consultations?.patients;
      const assurance = patient?.assurances;
      const baseNum = (facture.numero_facture || '').replace(/-C$/, '');

      return (
        <div ref={ref} className="p-6 max-w-md mx-auto bg-white text-black">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold">Reçu de paiement – Caisse</h2>
            <p className="text-sm text-gray-600">N° facture : {baseNum}</p>
            <p className="text-sm text-gray-600">Date : {new Date().toLocaleString('fr-FR')}</p>
          </div>

          <div className="mb-4">
            <h3 className="font-semibold border-b border-gray-300 pb-1 mb-2">Patient</h3>
            <p>{patient?.prenom} {patient?.nom}</p>
            {patient?.numero_secu && <p className="text-sm text-gray-600">N° Sécurité sociale : {patient.numero_secu}</p>}
            {assurance && <p className="text-sm text-gray-600">Couverture : {assurance.nom} ({assurance.taux_remboursement} %)</p>}
          </div>

          <div className="mb-4">
            <h3 className="font-semibold border-b border-gray-300 pb-1 mb-2">Paiement</h3>
            <div className="flex justify-between"><span>Montant total</span><span>{formatMontant(facture.montant_ttc || 0)}</span></div>
            <div className="flex justify-between"><span>Montant payé (patient)</span><span>{formatMontant(paiement.montant_paye || 0)}</span></div>
            <div className="flex justify-between"><span>Mode</span><span>{MODES_PAIEMENT.find((m) => m.value === paiement.mode_paiement)?.label || paiement.mode_paiement}</span></div>
            {montantAssurance > 0 && (
              <div className="flex justify-between mt-2 pt-2 border-t border-gray-200">
                <span>Part {nomCouverture}</span>
                <span>{formatMontant(montantAssurance)}</span>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-4">
            <div className="border-t border-gray-400 pt-2">
              <p className="text-sm font-medium">Signature caissier</p>
              <p className="text-xs text-gray-500 mt-1">_________________________________</p>
            </div>
            <div className="border-t border-gray-400 pt-2">
              <p className="text-sm font-medium">Signature patient</p>
              <p className="text-xs text-gray-500 mt-1">_________________________________</p>
            </div>
            {montantAssurance > 0 && (
              <div className="border-t border-gray-400 pt-2">
                <p className="text-sm font-medium">Signature couverture ({nomCouverture})</p>
                <p className="text-xs text-gray-500 mt-1">_________________________________</p>
              </div>
            )}
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">Merci de votre confiance. Conservez ce reçu.</p>
        </div>
      );
    }
  );

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Caisse</h1>
        <div className="flex flex-col items-end gap-0.5">
          <button
            type="button"
            onClick={() => { fetchFactures(); fetchEtatCaisse(); fetchSessionCaisse(); fetchDetailsJournee(); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Mise à jour caisse
          </button>
          <p className="text-xs text-gray-500">Récupère l&apos;état actuel (session et fond de caisse inchangés).</p>
        </div>
      </div>

      {/* État de la caisse avec session (fond de caisse, total journée, solde actuel) */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">État de la caisse</h2>
          <div className="flex gap-2">
            {!sessionCaisse ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowOpenCaisseModal(true)}
                  className="px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-1.5 text-sm"
                >
                  <LockOpenIcon className="w-4 h-4" /> Ouvrir la caisse
                </button>
                <button
                  type="button"
                  onClick={() => { setShowArreteModal(true); fetchArreteMensuel(); }}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 text-sm"
                >
                  <DocumentTextIcon className="w-4 h-4" /> Arrêté mensuel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowCloseCaisseModal(true)}
                  className="px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-1.5 text-sm"
                >
                  <LockClosedIcon className="w-4 h-4" /> Fermer la caisse
                </button>
                <button
                  type="button"
                  onClick={() => { setShowArreteModal(true); fetchArreteMensuel(); }}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 text-sm"
                >
                  <DocumentTextIcon className="w-4 h-4" /> Arrêté mensuel
                </button>
              </>
            )}
          </div>
        </div>
        {!sessionCaisse && (
          <p className="text-xs text-gray-500 -mt-2 mb-2">Uniquement en début de journée. Le fond de caisse n&apos;est demandé qu&apos;une fois.</p>
        )}

        {sessionCaisse ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <p className="text-sm text-gray-600">Fond de caisse</p>
                <p className="text-xl font-bold text-yellow-800">{formatMontant(sessionCaisse.fond_caisse || 0)}</p>
                <p className="text-xs text-gray-500 mt-1">Ouvert le {new Date(sessionCaisse.heure_ouverture).toLocaleString('fr-FR')}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-sm text-gray-600">Total journée</p>
                <p className="text-xl font-bold text-green-800">{formatMontant(etatCaisse.totalAujourdhui)}</p>
                <p className="text-xs text-gray-500 mt-1">Paiements aujourd'hui</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-600">Solde actuel</p>
                <p className="text-xl font-bold text-blue-800">{formatMontant(etatCaisse.solde)}</p>
                <p className="text-xs text-gray-500 mt-1">Fond + Total journée</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <p className="text-sm text-gray-600">Ce mois</p>
                <p className="text-xl font-bold text-purple-800">{formatMontant(etatCaisse.totalMois)}</p>
                <p className="text-xs text-gray-500 mt-1">Total mensuel</p>
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Répartition par mode (aujourd'hui)</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(etatCaisse.parModePaiement).filter(([, v]) => v > 0).map(([k, v]) => (
                  <span key={k} className="text-xs bg-white px-2 py-1 rounded border border-gray-200">
                    {MODES_PAIEMENT.find((m) => m.value === k)?.label || k} <strong>{formatMontant(v)}</strong>
                  </span>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
            <LockClosedIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p className="font-medium">Caisse fermée</p>
            <p className="text-sm mt-1">Ouvrez une session pour commencer</p>
          </div>
        )}
      </div>

      {/* Fin de journée : vérification puis fermeture (visible uniquement quand la caisse est ouverte) */}
      {sessionCaisse && (
        <div className="bg-white rounded-xl shadow p-6 mb-6 border-2 border-orange-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-orange-900 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Fin de journée
            </h2>
            {!showFinDeJournee ? (
              <button
                type="button"
                onClick={handleOpenFinDeJournee}
                className="px-3 py-1.5 bg-orange-100 text-orange-800 rounded-lg text-sm font-medium hover:bg-orange-200 flex items-center gap-1.5"
              >
                <CheckCircleIcon className="w-4 h-4" />
                Vérification fin de journée
                {isCaissier && <span className="ml-1 text-xs opacity-90">(vos encaissements)</span>}
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowDetailsJournee((v) => !v); if (!showDetailsJournee) fetchDetailsJournee(); }}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  {showDetailsJournee ? 'Masquer détail' : 'Voir détail de la journée'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowFinDeJournee(false)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  <XIcon className="w-4 h-4 inline mr-1" /> Fermer le panneau
                </button>
                <button
                  type="button"
                  onClick={() => setShowCloseCaisseModal(true)}
                  className="px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
                >
                  <LockClosedIcon className="w-4 h-4 inline mr-1" /> Fermer la caisse
                </button>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-4">
            {!showFinDeJournee
              ? 'En fin de journée, lancez la vérification pour voir le détail des paiements du jour, puis fermez la caisse.'
              : 'Vérifiez les totaux ci-dessous, puis cliquez sur « Fermer la caisse » pour enregistrer la session.'}
          </p>

          {showFinDeJournee && showDetailsJournee && (
            <>
              {loadingDetailsJournee ? (
                <div className="flex justify-center py-10">
                  <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : detailsJournee.lignes.length === 0 ? (
                <p className="text-gray-500 text-center py-6">Aucun paiement enregistré pour aujourd&apos;hui.</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Total factures (jour)</p>
                      <p className="text-xl font-bold text-blue-800">{formatMontant(detailsJournee.totals.factures)}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Part patient</p>
                      <p className="text-xl font-bold text-green-800">{formatMontant(detailsJournee.totals.patient)}</p>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Part couverture (IPM / assurance / mutuelle)</p>
                      <p className="text-xl font-bold text-amber-800">{formatMontant(detailsJournee.totals.couverture)}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Par mode (jour)</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {Object.entries(etatCaisse.parModePaiement).filter(([, v]) => v > 0).map(([k, v]) => (
                          <span key={k} className="text-xs bg-white px-2 py-0.5 rounded border border-gray-200">
                            {MODES_PAIEMENT.find((m) => m.value === k)?.label || k} {formatMontant(v)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">Export CSV pour archivage ou contrôle comptable.</span>
                    <button
                      type="button"
                      onClick={handleExportJourneeCsv}
                      className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Exporter (CSV)
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Patient</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">N° facture</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Montant facture</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Part patient</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Part couverture</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Mode</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Heure</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {detailsJournee.lignes.map((l) => (
                          <tr key={l.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <div className="font-medium">{l.patient?.prenom} {l.patient?.nom}</div>
                              {l.patient?.numero_secu && <div className="text-xs text-gray-500">N° secu: {l.patient.numero_secu}</div>}
                              {l.assurance && <div className="text-xs text-blue-700">{l.assurance.nom} ({l.assurance.taux_remboursement}%)</div>}
                            </td>
                            <td className="px-3 py-2">{l.numero_facture}</td>
                            <td className="px-3 py-2 font-medium">{formatMontant(l.montant_facture)}</td>
                            <td className="px-3 py-2">{formatMontant(l.partPatient)}</td>
                            <td className="px-3 py-2">{formatMontant(l.partCouverture)}</td>
                            <td className="px-3 py-2">{MODES_PAIEMENT.find((m) => m.value === l.mode_paiement)?.label || l.mode_paiement}</td>
                            <td className="px-3 py-2">{l.date_paiement ? new Date(l.date_paiement).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '–'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Recherche + SelectSearch (suggestions) */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Rechercher une facture (nom, prénom ou n° facture)</h2>
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            onFocus={handleSearchFocus}
            placeholder="Nom, prénom ou n° de facture..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
              {suggestions.map((s) => (
                <button
                  key={s.factureId}
                  type="button"
                  onClick={() => handleSuggestionClick(s)}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 flex justify-between items-center"
                >
                  <span className="font-medium">{s.prenom} {s.nom}</span>
                  <span className="text-sm text-gray-500">{s.numero_facture} – {formatMontant(s.montant_ttc || 0)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Liste factures en attente (DataTables: filtre + pagination, plus récentes en premier) */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Factures en attente de paiement</h2>
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : searchResults.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucune facture en attente.</p>
        ) : (
          <>
            {/* Barre DataTables: nb entrées + filtre */}
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Afficher</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="text-sm text-gray-600">entrées</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm text-gray-600">Filtrer:</span>
                <input
                  type="text"
                  value={tableFilter}
                  onChange={(e) => { setTableFilter(e.target.value); setPage(1); }}
                  placeholder="Patient, n° facture, date, montant..."
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Patient</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">N° facture</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Montant</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Statut</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tablePaginated.map((f) => {
                    const p = f.consultations?.patients;
                    const dt = f.consultations?.date_consultation ? new Date(f.consultations.date_consultation) : null;
                    const statut = (f.montant_paye > 0) ? 'partiel' : 'en_attente';
                    return (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3"><span className="font-medium">{p?.prenom} {p?.nom}</span><br /><span className="text-xs text-gray-500">{p?.numero_secu}</span></td>
                        <td className="px-4 py-3 text-sm">{f.numero_facture}</td>
                        <td className="px-4 py-3 text-sm">{dt ? dt.toLocaleDateString('fr-FR') : '–'}</td>
                        <td className="px-4 py-3 font-medium">{formatMontant(f.montant_ttc || 0)}</td>
                        <td className="px-4 py-3">{getStatusBadge(statut, f.montant_paye, f.montant_ttc)}</td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => handleOpenModal(f)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Payer à la caisse</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination: Affichage X à Y sur Z + Précédent / Suivant */}
            <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Affichage de {totalRows === 0 ? 0 : start + 1} à {Math.min(start + pageSize, totalRows)} sur {totalRows} entrées
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Précédent
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-600">
                  Page {effectivePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Suivant
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Historique des paiements (liste récente) */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Historique des paiements</h2>
          <button type="button" onClick={() => setShowPayedInvoices((v) => !v)} className="text-blue-600 hover:underline flex items-center gap-1">
            {showPayedInvoices ? <><XIcon className="w-4 h-4" /> Masquer</> : <><CheckCircleIcon className="w-4 h-4" /> Afficher</>}
          </button>
        </div>
        {showPayedInvoices && (
          facturesPayees.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-6 text-center text-gray-500">Aucun paiement enregistré.</div>
          ) : (
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Patient</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Date</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Montant</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Statut</th></tr></thead>
                <tbody className="divide-y divide-gray-200">
                  {facturesPayees.map((f) => {
                    const p = f.consultations?.patients;
                    const d = f.date_paiement ? new Date(f.date_paiement) : null;
                    return (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{p?.prenom} {p?.nom}</td>
                        <td className="px-4 py-3 text-sm">{d ? d.toLocaleString('fr-FR') : '–'}</td>
                        <td className="px-4 py-3 font-medium">{formatMontant(f.montant_ttc || 0)}</td>
                        <td className="px-4 py-3">{getStatusBadge('paye', f.montant_paye, f.montant_ttc)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Historique paiement par Patient et par Couverture (filtres + stats + facture globale) */}
      <div className="bg-white rounded-xl shadow p-6 mb-6 mt-8">
        <h2 className="text-lg font-semibold mb-4">
          Historique paiement par Patient / par Couverture
          {isCaissier && <span className="ml-2 text-sm font-normal text-gray-500">(uniquement vos encaissements)</span>}
        </h2>
        <div className="flex border-b border-gray-200 mb-4">
          <button
            type="button"
            onClick={() => setHistoriqueTab('patient')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${historiqueTab === 'patient' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Par patient
          </button>
          <button
            type="button"
            onClick={() => setHistoriqueTab('couverture')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${historiqueTab === 'couverture' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Par couverture (IPM / assurance / mutuelle)
          </button>
        </div>

        {historiqueTab === 'patient' && (
          <>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div className="min-w-[280px] relative" ref={patientSearchRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filtrer par patient</label>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={filterPatientId ? selectedPatientLabel : filterPatientSearch}
                    onChange={(e) => {
                      setFilterPatientSearch(e.target.value);
                      if (filterPatientId) setFilterPatientId('');
                      setShowPatientDropdown(true);
                    }}
                    onFocus={() => setShowPatientDropdown(true)}
                    placeholder="Tapez le nom ou prénom..."
                    className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {filterPatientId && (
                    <button
                      type="button"
                      onClick={() => { setFilterPatientId(''); setFilterPatientSearch(''); setShowPatientDropdown(false); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label="Effacer"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {showPatientDropdown && !filterPatientId && (
                  <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                    {(() => {
                      const q = (filterPatientSearch || '').trim().toLowerCase();
                      const filtered = q
                        ? patientsList.filter((p) => {
                            const nom = (p.nom || '').toLowerCase();
                            const prenom = (p.prenom || '').toLowerCase();
                            return nom.includes(q) || prenom.includes(q) || `${prenom} ${nom}`.includes(q) || `${nom} ${prenom}`.includes(q);
                          })
                        : patientsList;
                      if (filtered.length === 0) {
                        return <li className="px-3 py-2 text-sm text-gray-500">Aucun patient trouvé</li>;
                      }
                      return filtered.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex justify-between items-center"
                            onClick={() => {
                              setFilterPatientId(String(p.id));
                              setFilterPatientSearch('');
                              setShowPatientDropdown(false);
                            }}
                          >
                            <span>{p.prenom} {p.nom}</span>
                          </button>
                        </li>
                      ));
                    })()}
                  </ul>
                )}
              </div>
            </div>
            {filterPatientId && (
              <>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-600">Paiements (aujourd&apos;hui)</p>
                    <p className="text-lg font-bold text-blue-800">{formatMontant(historiquePatientData.stats.jour)}</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-600">Paiements (cette semaine)</p>
                    <p className="text-lg font-bold text-green-800">{formatMontant(historiquePatientData.stats.semaine)}</p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-600">Paiements (ce mois)</p>
                    <p className="text-lg font-bold text-purple-800">{formatMontant(historiquePatientData.stats.mois)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">Export CSV de l'historique de ce patient.</span>
                  <button
                    type="button"
                    onClick={handleExportHistoriquePatientCsv}
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Exporter (CSV)
                  </button>
                </div>
                {loadingHistoriquePatient ? (
                  <div className="flex justify-center py-8"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : historiquePatientData.lignes.length === 0 ? (
                  <p className="text-gray-500 text-center py-6">Aucune facture payée pour ce patient.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">N° facture</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Date paiement</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Montant facture</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Part patient</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Part couverture</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Mode</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {historiquePatientData.lignes.map((l) => (
                          <tr key={l.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2">{l.numero_facture}</td>
                            <td className="px-3 py-2">{l.date_paiement ? new Date(l.date_paiement).toLocaleDateString('fr-FR') : '–'}</td>
                            <td className="px-3 py-2 font-medium">{formatMontant(l.montant_ttc)}</td>
                            <td className="px-3 py-2">{formatMontant(l.partPatient)}</td>
                            <td className="px-3 py-2">{l.partCouverture > 0 ? `${formatMontant(l.partCouverture)} (${l.assurance || ''})` : '–'}</td>
                            <td className="px-3 py-2">{MODES_PAIEMENT.find((m) => m.value === l.mode_paiement)?.label || l.mode_paiement}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {historiqueTab === 'couverture' && (
          <>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div className="min-w-[220px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Filtrer par couverture</label>
                <select
                  value={filterAssuranceId}
                  onChange={(e) => setFilterAssuranceId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">— Choisir une couverture —</option>
                  {assurancesList.map((a) => (
                    <option key={a.id} value={a.id}>{a.nom} ({a.taux_remboursement}%)</option>
                  ))}
                </select>
              </div>
            </div>
            {filterAssuranceId && (
              <>
                <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm font-medium text-amber-900">Facture globale (part couverture)</p>
                  <div className="flex flex-wrap gap-6 mt-2">
                    <span><strong>Jour:</strong> {formatMontant(historiqueCouvertureData.global.jour ?? 0)}</span>
                    <span><strong>Semaine:</strong> {formatMontant(historiqueCouvertureData.global.semaine ?? 0)}</span>
                    <span><strong>Mois:</strong> {formatMontant(historiqueCouvertureData.global.mois ?? 0)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">Export CSV de la facture globale de cette couverture.</span>
                  <button
                    type="button"
                    onClick={handleExportHistoriqueCouvertureCsv}
                    className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                  >
                    Exporter (CSV)
                  </button>
                </div>
                {loadingHistoriqueCouverture ? (
                  <div className="flex justify-center py-8"><div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : historiqueCouvertureData.lignes.length === 0 ? (
                  <p className="text-gray-500 text-center py-6">Aucune facture pour cette couverture.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Date</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Patient</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">N° facture</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Montant facture</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Part patient</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Part couverture</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Mode</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {historiqueCouvertureData.lignes.map((l) => (
                          <tr key={l.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2">{l.date_paiement ? new Date(l.date_paiement).toLocaleDateString('fr-FR') : '–'}</td>
                            <td className="px-3 py-2 font-medium">{l.patient}</td>
                            <td className="px-3 py-2">{l.numero_facture}</td>
                            <td className="px-3 py-2">{formatMontant(l.montant_ttc)}</td>
                            <td className="px-3 py-2">{formatMontant(l.partPatient)}</td>
                            <td className="px-3 py-2 font-medium">{formatMontant(l.partCouverture)}</td>
                            <td className="px-3 py-2">{MODES_PAIEMENT.find((m) => m.value === l.mode_paiement)?.label || l.mode_paiement}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Modal paiement (prérempli: patient, montant, mode, répartition si couverture) */}
      {showPaiementModal && selectedFacture && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => !submitting && setShowPaiementModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center"><BanknotesIcon className="w-6 h-6 text-green-600" /></div>
                <div>
                  <h3 className="text-lg font-semibold">Enregistrer un paiement</h3>
                  <p className="text-sm text-gray-500">N° {selectedFacture.numero_facture} – {selectedFacture.consultations?.patients?.prenom} {selectedFacture.consultations?.patients?.nom}</p>
                </div>
              </div>

              {/* Bloc prérempli: montant total, répartition, à payer */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between text-sm mb-1"><span>Montant total (facture)</span><span className="font-medium">{formatMontant(selectedFacture.montant_ttc || 0)}</span></div>
                {assuranceTaux > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-blue-700"><span>Prise en charge ({couvertureNom} {assuranceTaux} %)</span><span>-{formatMontant(montantAssurance)}</span></div>
                    <div className="flex justify-between text-sm mt-2 pt-2 border-t border-gray-200"><span>À payer par le patient</span><span className="font-bold">{formatMontant(montantPatient)}</span></div>
                  </>
                )}
                {assuranceTaux === 0 && <div className="flex justify-between text-sm mt-2 pt-2 border-t border-gray-200"><span>À payer</span><span className="font-bold">{formatMontant(montantPatient)}</span></div>}
              </div>

              <form onSubmit={handlePaiementSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Montant à payer</label>
                  <div className="relative">
                    <BanknotesIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="text" 
                      step="0.01" 
                      min="0" 
                      max={montantPatient} 
                      value={new Intl.NumberFormat('fr-FR', {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2,
                        useGrouping: true
                      }).format(paiementData.montant_paye).replace(/\u00A0/g, ' ')}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\s/g, '');
                        const numValue = parseFloat(value) || 0;
                        handleMontantChange({ target: { value: numValue } });
                      }}
                      required 
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg" 
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">/ {formatMontant(montantPatient)}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mode de paiement</label>
                  {/* Ligne 1 : Espèces, Carte, Chèque, Virement */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {MODES_PAIEMENT.filter((m) => !m.mobile).map((m) => {
                      const sel = paiementData.mode_paiement === m.value;
                      const Icon = m.Icon;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setPaiementData((d) => ({ ...d, mode_paiement: m.value }))}
                          className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border-2 transition-all ${sel ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                        >
                          <Icon className="w-8 h-8 text-gray-700" />
                          <span className="text-xs font-medium">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Ligne 2 (en bas) : Orange Money, Wave, Yas — icônes dédiées, rangées en ligne */}
                  <div className="flex flex-wrap gap-2 justify-center">
                    {MODES_PAIEMENT.filter((m) => m.mobile).map((m) => {
                      const sel = paiementData.mode_paiement === m.value;
                      const Icon = m.Icon;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setPaiementData((d) => ({ ...d, mode_paiement: m.value }))}
                          className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border-2 transition-all ${sel ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                        >
                          <Icon className="w-9 h-9" />
                          <span className="text-xs font-medium">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Étapes scan / paiement lorsque Orange Money, Wave ou Yas est sélectionné */}
                {['orange_money', 'wave', 'yas'].includes(paiementData.mode_paiement) && (() => {
                  const m = MODES_PAIEMENT.find((x) => x.value === paiementData.mode_paiement);
                  const montant = parseFloat(paiementData.montant_paye) || 0;
                  const steps = ETAPES_MOBILE_MONEY(m?.label || 'mobile', montant);
                  return (
                    <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                        <CheckCircleIcon className="w-5 h-5 text-indigo-600" />
                        Étapes de paiement {m?.label || ''}
                      </h4>
                      <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-700">
                        {steps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                    </div>
                  );
                })()}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
                  <textarea rows={2} value={paiementData.notes} onChange={(e) => setPaiementData((d) => ({ ...d, notes: e.target.value }))} placeholder="Référence chèque, n° transaction…" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                </div>

                {assuranceTaux > 0 && montantAssurance > 0 && (
                  <div className="mb-4 flex gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <ExclamationCircleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">Une facture de <strong>{formatMontant(montantAssurance)}</strong> (même n° {selectedFacture.numero_facture}) sera créée pour la couverture {couvertureNom}.</p>
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-2">
                  <button type="button" onClick={() => setShowPaiementModal(false)} disabled={submitting} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Annuler</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50">
                    <PrinterIcon className="w-5 h-5" /> Enregistrer et imprimer
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal : Ouvrir la caisse (réinitialisation matinale + fond de caisse) */}
      {showOpenCaisseModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowOpenCaisseModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <LockOpenIcon className="w-6 h-6 text-green-600" />
                Ouvrir la caisse
              </h3>
              <p className="text-sm text-gray-600 mb-2">Définissez le fond de caisse pour cette journée (une seule fois par jour).</p>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-4">
                Pour reprendre une session déjà ouverte (après coupure ou erreur), utilisez « Mise à jour caisse » : le fond de caisse ne sera pas redemandé.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Fond de caisse (F CFA)</label>
                <input
                  type="text"
                  step="100"
                  min="0"
                  value={new Intl.NumberFormat('fr-FR', {
                    maximumFractionDigits: 0,
                    useGrouping: true
                  }).format(fondCaisseInput).replace(/\u00A0/g, ' ')}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\s/g, '');
                    const numValue = parseFloat(value) || 0;
                    setFondCaisseInput(numValue);
                  }}
                  placeholder="Ex: 50 000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">Montant initial mis en caisse (pour la monnaie)</p>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowOpenCaisseModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
                <button type="button" onClick={handleOpenCaisse} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Ouvrir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal : Fermer la caisse (enregistre le montant journalier) */}
      {showCloseCaisseModal && sessionCaisse && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowCloseCaisseModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <LockClosedIcon className="w-6 h-6 text-orange-600" />
                Fermer la caisse
              </h3>
              <div className="mb-4 space-y-2">
                <div className="flex justify-between"><span className="text-sm text-gray-600">Fond de caisse</span><span className="font-medium">{formatMontant(sessionCaisse.fond_caisse || 0)}</span></div>
                <div className="flex justify-between"><span className="text-sm text-gray-600">Total journée</span><span className="font-medium">{formatMontant(etatCaisse.totalAujourdhui)}</span></div>
                <div className="flex justify-between pt-2 border-t"><span className="text-sm font-semibold">Solde final</span><span className="font-bold text-lg">{formatMontant(etatCaisse.solde)}</span></div>
              </div>
              <p className="text-sm text-gray-600 mb-4">Le montant journalier sera enregistré et la session fermée.</p>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowCloseCaisseModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
                <button type="button" onClick={handleCloseCaisse} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">Fermer la caisse</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal : Arrêté comptable mensuel */}
      {showArreteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowArreteModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <DocumentTextIcon className="w-6 h-6 text-indigo-600" />
                Arrêté comptable mensuel
              </h3>
              <div className="mb-4 flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mois</label>
                  <select
                    value={arreteMois.mois}
                    onChange={(e) => {
                      setArreteMois((a) => ({ ...a, mois: Number(e.target.value) }));
                      setTimeout(() => fetchArreteMensuel(), 100);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('fr-FR', { month: 'long' })}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Année</label>
                  <input
                    type="number"
                    value={arreteMois.annee}
                    onChange={(e) => {
                      setArreteMois((a) => ({ ...a, annee: Number(e.target.value) }));
                      setTimeout(() => fetchArreteMensuel(), 100);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <button
                  type="button"
                  onClick={fetchArreteMensuel}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Actualiser
                </button>
              </div>
              {arreteData.length > 0 ? (
                <>
                  <div className="mb-4 p-3 bg-indigo-50 rounded-lg">
                    <p className="text-sm font-medium text-indigo-900">
                      Total du mois : <strong>{formatMontant(arreteData.reduce((s, r) => s + parseFloat(r.montant_journalier || 0), 0))}</strong>
                    </p>
                    <p className="text-xs text-indigo-700 mt-1">{arreteData.length} jour{arreteData.length > 1 ? 's' : ''} de caisse</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Date</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Fond de caisse</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Montant journalier</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Solde final</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Caissier</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {arreteData.map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2">{new Date(r.date_session).toLocaleDateString('fr-FR')}</td>
                            <td className="px-3 py-2 font-medium">{formatMontant(r.fond_caisse || 0)}</td>
                            <td className="px-3 py-2 font-medium">{formatMontant(r.montant_journalier || 0)}</td>
                            <td className="px-3 py-2 font-bold">{formatMontant(r.solde_final || 0)}</td>
                            <td className="px-3 py-2 text-gray-600">{r.caissier_nom || 'N/A'}</td>
                            <td className="px-3 py-2">{r.statut === 'fermee' ? <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">Fermée</span> : <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs">Ouverte</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-center text-gray-500 py-8">Aucune donnée pour cette période</p>
              )}
              <div className="mt-4 flex justify-end">
                <button type="button" onClick={() => setShowArreteModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reçu pour impression - caché visuellement mais disponible pour react-to-print */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        {selectedFacture && paiementData && (
          <div ref={componentRef}>
            <Receipt facture={selectedFacture} paiement={paiementData} montantAssurance={montantAssurance} couvertureNom={couvertureNom} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Caisse;
