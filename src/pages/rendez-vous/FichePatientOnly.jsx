import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { NewAppointmentModal } from '../../components/rendez-vous/NewAppointmentModal';
import { printOrdonnances } from '../../services/impression/ordonnancePrint';
import { unifiedNotificationService } from '../../services/unifiedNotificationService';
import Pagination, { ItemsPerPageSelector } from '../../components/common/Pagination';
import {
  User,
  Calendar,
  Phone,
  Mail,
  MapPin,
  FileText,
  Heart,
  Stethoscope,
  Clock,
  CheckCircle,
  Edit,
  X,
  Activity,
  ArrowLeft,
  Eye
} from 'lucide-react';

const FichePatientOnly = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, userProfile, getUserProfile, tenantId } = useAuth();
  
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [consultations, setConsultations] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dossier'); // 'dossier' | 'ordonnances' | 'rdv'
  const [dossierPage, setDossierPage] = useState(1);
  const [dossierPageSize, setDossierPageSize] = useState(10);
  const [ordonnancesPage, setOrdonnancesPage] = useState(1);
  const [ordonnancesPageSize, setOrdonnancesPageSize] = useState(10);
  const [rdvPage, setRdvPage] = useState(1);
  const [rdvPageSize, setRdvPageSize] = useState(10);
  const [showNewAppointment, setShowNewAppointment] = useState(false);

  useEffect(() => {
    const initializePage = async () => {
      const profile = userProfile || await getUserProfile();
      await fetchPatients(profile);

      // Si un ID patient est fourni dans l'URL
      const patientId = searchParams.get('id');
      if (patientId) {
        loadPatientData(patientId);
      } else {
        // Rediriger vers la page patients si pas d'ID — /patients (pas
        // /my-patients, réservée aux médecins) puisque cette fiche est aussi
        // accessible aux secrétaires et admins.
        navigate('/patients');
      }
    };

    if (currentUser) {
      initializePage();
    }
  }, [currentUser?.id, userProfile?.id, searchParams, navigate]);

  const fetchPatients = async (profile = userProfile) => {
    try {
      if (!profile?.id) {
        setPatients([]);
        return;
      }

      console.log('[FichePatientOnly] Recuperation des patients du medecin:', profile.id);
      const patientIds = new Set();

      const { data: treatedPatients, error: linkedError } = await supabase
        .from('patients')
        .select('*')
        .eq('medecin_traitant_id', profile.id)
        .order('nom', { ascending: true });

      if (linkedError) {
        console.warn('[FichePatientOnly] Erreur patients lies:', linkedError.message);
      }

      let linkedPatients = treatedPatients || [];

      if (currentUser?.id) {
        const { data: createdPatients, error: createdError } = await supabase
          .from('patients')
          .select('*')
          .eq('created_by', currentUser.id)
          .order('nom', { ascending: true });

        if (createdError) {
          console.warn('[FichePatientOnly] Erreur patients crees:', createdError.message);
        } else {
          const existingIds = new Set(linkedPatients.map((patient) => patient.id));
          linkedPatients = [
            ...linkedPatients,
            ...(createdPatients || []).filter((patient) => !existingIds.has(patient.id))
          ];
        }
      }

      (linkedPatients || []).forEach((patient) => patientIds.add(patient.id));

      const { data: consultData, error: consultError } = await supabase
        .from('consultations')
        .select('patient_id')
        .eq('medecin_id', profile.id);

      if (consultError) {
        console.warn('[FichePatientOnly] Erreur consultations:', consultError.message);
      }

      (consultData || []).forEach((row) => {
        if (row.patient_id) patientIds.add(row.patient_id);
      });

      const { data: appointmentData, error: appointmentError } = await supabase
        .from('appointments')
        .select('patient_id')
        .eq('medecin_id', profile.id);

      if (appointmentError) {
        console.warn('[FichePatientOnly] Erreur rendez-vous:', appointmentError.message);
      }

      (appointmentData || []).forEach((row) => {
        if (row.patient_id) patientIds.add(row.patient_id);
      });

      let foundPatients = linkedPatients || [];
      const missingPatientIds = [...patientIds].filter(
        (patientId) => !foundPatients.some((patient) => patient.id === patientId)
      );

      if (missingPatientIds.length > 0) {
        const { data: patientData, error: patientError } = await supabase
          .from('patients')
          .select('*')
          .in('id', missingPatientIds)
          .order('nom', { ascending: true });

        if (patientError) throw patientError;
        foundPatients = [...foundPatients, ...(patientData || [])];
      }

      foundPatients.sort((a, b) =>
        `${a.nom || ''} ${a.prenom || ''}`.localeCompare(`${b.nom || ''} ${b.prenom || ''}`, 'fr')
      );

      console.log('[FichePatientOnly] Patients du medecin trouves:', foundPatients.length);
      setPatients(foundPatients);
    } catch (error) {
      console.error('Erreur lors du chargement des patients:', error);
      setPatients([]);
    }
  };

  const loadPatientData = async (patientId) => {
    try {
      setLoading(true);
      
      // Charger les données du patient
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (patientError) throw patientError;
      setSelectedPatient(patient);

      // Charger l'historique des consultations
      const { data: consultationsData, error: consultationsError } = await supabase
        .from('consultations')
        .select(`
          *,
          medecin:users!inner(nom, prenom, specialite, actif)
        `)
        .eq('patient_id', patientId)
        .order('date_consultation', { ascending: false })
        .limit(100);

      if (consultationsError) throw consultationsError;
      setConsultations(consultationsData || []);

      // Charger les ordonnances/prescriptions du patient
      // Note : pas de `signature_url` dans l'embed medecin — cette colonne
      // n'existe pas sur `users` en base (voir SettingsPage.jsx qui la
      // référence aussi), PostgREST renvoie une erreur 42703 sur toute la
      // requête et faisait passer cette page en "Aucune ordonnance trouvée"
      // même quand des ordonnances existent.
      const { data: ordonnancesData, error: ordonnancesError } = await supabase
        .from('ordonnances')
        .select(`
          *,
          consultations!inner ( id, patient_id, date_consultation, medecin:users!inner(id, nom, prenom, specialite, telephone, email) ),
          lignes_ordonnance ( *, medicaments ( nom ) )
        `)
        .eq('consultations.patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (ordonnancesError) {
        console.error('Erreur lors du chargement des ordonnances:', ordonnancesError);
        setPrescriptions([]);
      } else {
        setPrescriptions(ordonnancesData || []);
      }

      // Charger les rendez-vous à venir
      const today = new Date().toISOString().split('T')[0];
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          *,
          medecin:users!inner(nom, prenom, specialite, actif)
        `)
        .eq('patient_id', patientId)
        .gte('date_heure', today)
        .order('date_heure', { ascending: true });

      if (appointmentsError) throw appointmentsError;
      setAppointments(appointmentsData || []);

    } catch (error) {
      console.error('Erreur lors du chargement des données patient:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (statut) => {
    const statusConfig = {
      confirme: { color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle },
      en_attente: { color: 'bg-amber-50 text-amber-700', icon: Clock },
      annule: { color: 'bg-red-50 text-red-700', icon: X }
    };

    const config = statusConfig[statut] || statusConfig.confirme;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {statut === 'confirme' ? 'Confirmé' :
         statut === 'en_attente' ? 'En attente' : 'Annulé'}
      </span>
    );
  };

  const formatDateTime = (dateTime) => {
    return new Date(dateTime).toLocaleString('fr-FR');
  };

  // Ouvre l'ordonnance réelle (mise en page cabinet + médicaments + signature) dans
  // un nouvel onglet, prête à imprimer — même service que ConsultationCompletion.jsx,
  // pour ne pas ré-écrire un rendu d'ordonnance ad hoc ici.
  const handleViewOrdonnance = async (ordonnance) => {
    const { success, error } = await printOrdonnances(
      supabase,
      [ordonnance],
      selectedPatient,
      ordonnance.consultations?.medecin,
      { date_consultation: ordonnance.consultations?.date_consultation },
      tenantId
    );
    if (!success) {
      unifiedNotificationService.error(`Erreur lors de l'affichage de l'ordonnance: ${error}`);
    }
  };

  // Pagination client-side pour les listes de la fiche (dossier, ordonnances, RDV) —
  // chaque liste a son propre état de page/taille de page, via le composant partagé
  // <Pagination> (voir src/components/common/Pagination.jsx).
  const paginate = (items, page, pageSize) => {
    const totalRows = items.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const effectivePage = Math.min(Math.max(1, page), totalPages);
    const start = (effectivePage - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      totalRows,
      totalPages,
      effectivePage,
      start,
    };
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (loading && !selectedPatient) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement de la fiche patient...</p>
        </div>
      </div>
    );
  }

  const age = calculateAge(selectedPatient?.date_naissance);
  const dossierPag = paginate(consultations, dossierPage, dossierPageSize);
  const ordonnancesPag = paginate(prescriptions, ordonnancesPage, ordonnancesPageSize);
  const rdvPag = paginate(appointments, rdvPage, rdvPageSize);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-5">
        <button
          onClick={() => navigate('/patients')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour aux patients
        </button>

        {selectedPatient ? (
          <>
            {/* Hero patient */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-7">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-medical-primary to-medical-secondary text-white flex items-center justify-center text-xl font-semibold flex-shrink-0 shadow-[0_8px_24px_rgb(var(--medical-primary-rgb)/0.35)]">
                    {(selectedPatient.prenom?.[0] || '').toUpperCase()}{(selectedPatient.nom?.[0] || '').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-2xl font-semibold text-gray-900 tracking-tight truncate">
                      {selectedPatient.prenom} {selectedPatient.nom}
                    </h1>
                    <p className="text-[13px] text-gray-500 mt-1">
                      {age !== null ? `${age} ans` : 'Âge non renseigné'}
                      {selectedPatient.sexe && ` · ${selectedPatient.sexe === 'M' ? 'Masculin' : 'Féminin'}`}
                      {` · Dossier n° ${selectedPatient.numero_dossier || '—'}`}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[13px] text-gray-600">
                      {selectedPatient.telephone && (
                        <span className="flex items-center"><Phone className="w-3.5 h-3.5 mr-1.5 text-gray-400" />{selectedPatient.telephone}</span>
                      )}
                      {selectedPatient.email && (
                        <span className="flex items-center"><Mail className="w-3.5 h-3.5 mr-1.5 text-gray-400" />{selectedPatient.email}</span>
                      )}
                      {selectedPatient.adresse && (
                        <span className="flex items-center"><MapPin className="w-3.5 h-3.5 mr-1.5 text-gray-400" />{selectedPatient.adresse}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2.5 flex-shrink-0">
                  <button
                    onClick={() => navigate(`/patients?id=${selectedPatient.id}&edit=true`)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Modifier
                  </button>
                  <button
                    onClick={() => setShowNewAppointment(true)}
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium bg-medical-primary text-white rounded-xl hover:bg-medical-primary-dark transition-colors shadow-[0_4px_14px_rgb(var(--medical-primary-rgb)/0.35)]"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Prise RDV
                  </button>
                </div>
              </div>
            </div>

            {/* Corps : infos toujours visibles à gauche, dossier/ordonnances/RDV à droite */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Colonne infos - persistante, pas de switch */}
              <div className="lg:col-span-1 flex flex-col gap-5">
                <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6">
                  <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-gray-400 mb-3.5">
                    Informations personnelles
                  </p>
                  <div className="space-y-2.5 text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Date de naissance</span>
                      <span className="text-gray-900 font-medium text-right">
                        {selectedPatient.date_naissance ?
                          new Date(selectedPatient.date_naissance).toLocaleDateString('fr-FR') :
                          'Non renseignée'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sexe</span>
                      <span className="text-gray-900 font-medium">
                        {selectedPatient.sexe === 'M' ? 'Masculin' : selectedPatient.sexe === 'F' ? 'Féminin' : 'Non renseigné'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">N° dossier</span>
                      <span className="text-gray-900 font-medium">{selectedPatient.numero_dossier || 'Non renseigné'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6">
                  <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-gray-400 mb-3.5">
                    Informations médicales
                  </p>
                  <div className="space-y-3 text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Groupe sanguin</span>
                      <span className="text-gray-900 font-medium">{selectedPatient.groupe_sanguin || 'Non renseigné'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-1.5">Allergies</span>
                      {selectedPatient.allergies ? (
                        <span className="inline-flex px-2.5 py-1 bg-red-50 text-red-600 rounded-full text-xs font-medium">
                          {selectedPatient.allergies}
                        </span>
                      ) : (
                        <span className="text-gray-900">Aucune connue</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Assurance</span>
                      <span className="text-gray-900 font-medium text-right">{selectedPatient.assurance || 'Non renseignée'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Médecin traitant</span>
                      <span className="text-gray-900 font-medium text-right">{selectedPatient.medecin_traitant || 'Non renseigné'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Colonne dossier - onglets réservés au contenu qui a vraiment besoin d'un switch */}
              <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
              <nav className="flex gap-1 p-1.5 bg-gray-50 border-b border-gray-200">
                {[
                  { key: 'dossier', label: 'Dossier médical', icon: FileText, count: consultations.length },
                  // Ordonnances : seul le médecin peut les consulter (contenu médical), masqué pour secrétaire/admin.
                  ...(userProfile?.role === 'doctor'
                    ? [{ key: 'ordonnances', label: 'Ordonnances', icon: Activity, count: prescriptions.length }]
                    : []),
                  { key: 'rdv', label: 'Rendez-vous', icon: Calendar, count: appointments.length },
                ].map((tab) => {
                  const TabIcon = tab.icon;
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex-1 flex items-center justify-center gap-2 px-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-white text-medical-primary shadow-sm font-semibold'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      <TabIcon className="w-4 h-4 flex-shrink-0" />
                      {tab.label}
                      {typeof tab.count === 'number' && tab.count > 0 && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          isActive ? 'bg-medical-primary/10 text-medical-primary' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="p-5">
                {activeTab === 'dossier' && (
                  consultations.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-gray-500">{dossierPag.totalRows} consultation(s)</p>
                        <ItemsPerPageSelector
                          value={dossierPageSize}
                          onChange={(size) => {
                            setDossierPageSize(size);
                            setDossierPage(1);
                          }}
                        />
                      </div>
                      <div className="space-y-3 max-h-[440px] overflow-y-auto">
                        {dossierPag.items.map((consultation) => (
                          <div
                            key={consultation.id}
                            onClick={() => navigate(`/consultation/${consultation.id}`)}
                            className="p-4 border border-gray-100 rounded-2xl hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">
                                  {consultation.motif_consultation || consultation.motif || 'Consultation'}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {new Date(consultation.date_consultation || consultation.created_at).toLocaleDateString('fr-FR')}
                                  {' · '}
                                  Dr. {consultation.medecin?.prenom} {consultation.medecin?.nom}
                                </p>
                              </div>
                              <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-[11px] font-medium rounded-full">
                                {consultation.statut || 'terminee'}
                              </span>
                            </div>
                            {consultation.notes_generales && (
                              <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                                {consultation.notes_generales}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      <Pagination
                        currentPage={dossierPag.effectivePage}
                        totalPages={dossierPag.totalPages}
                        onPageChange={setDossierPage}
                        itemsPerPage={dossierPageSize}
                        totalItems={dossierPag.totalRows}
                      />
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-12">
                      <Stethoscope className="w-10 h-10 text-gray-300 mb-3" />
                      <p className="text-gray-500">Aucune consultation trouvée pour ce patient</p>
                    </div>
                  )
                )}

                {activeTab === 'ordonnances' && userProfile?.role === 'doctor' && (
                  prescriptions.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-gray-500">{ordonnancesPag.totalRows} ordonnance(s)</p>
                        <ItemsPerPageSelector
                          value={ordonnancesPageSize}
                          onChange={(size) => {
                            setOrdonnancesPageSize(size);
                            setOrdonnancesPage(1);
                          }}
                        />
                      </div>
                      <div className="space-y-3 max-h-[440px] overflow-y-auto">
                        {ordonnancesPag.items.map((ordonnance) => (
                          <div
                            key={ordonnance.id}
                            onClick={() => handleViewOrdonnance(ordonnance)}
                            className="p-4 border border-gray-100 rounded-2xl hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-gray-500">
                                {new Date(ordonnance.date_prescription || ordonnance.created_at).toLocaleDateString('fr-FR')}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-[11px] font-medium rounded-full">
                                  {ordonnance.statut || 'actif'}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-medical-primary">
                                  <Eye className="w-3.5 h-3.5" />
                                  Voir
                                </span>
                              </div>
                            </div>
                            {ordonnance.lignes_ordonnance?.length > 0 ? (
                              <ul className="mt-2 space-y-1 text-sm text-gray-900">
                                {ordonnance.lignes_ordonnance.slice(0, 2).map((ligne) => (
                                  <li key={ligne.id}>
                                    • {ligne.medicaments?.nom || 'Médicament inconnu'}
                                    {ligne.posologie && <span className="text-gray-500"> — {ligne.posologie}</span>}
                                  </li>
                                ))}
                                {ordonnance.lignes_ordonnance.length > 2 && (
                                  <li className="text-gray-400">…</li>
                                )}
                              </ul>
                            ) : (
                              <p className="text-sm text-gray-500 mt-2">Aucun médicament renseigné</p>
                            )}
                            {ordonnance.instructions_generales && (
                              <p className="text-sm text-gray-600 mt-2">{ordonnance.instructions_generales}</p>
                            )}
                          </div>
                        ))}
                      </div>
                      <Pagination
                        currentPage={ordonnancesPag.effectivePage}
                        totalPages={ordonnancesPag.totalPages}
                        onPageChange={setOrdonnancesPage}
                        itemsPerPage={ordonnancesPageSize}
                        totalItems={ordonnancesPag.totalRows}
                      />
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-12">
                      <Activity className="w-10 h-10 text-gray-300 mb-3" />
                      <p className="text-gray-500">Aucune ordonnance trouvée pour ce patient</p>
                    </div>
                  )
                )}

                {activeTab === 'rdv' && (
                  appointments.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-gray-500">{rdvPag.totalRows} rendez-vous</p>
                        <ItemsPerPageSelector
                          value={rdvPageSize}
                          onChange={(size) => {
                            setRdvPageSize(size);
                            setRdvPage(1);
                          }}
                        />
                      </div>
                      <div className="space-y-3 max-h-[380px] overflow-y-auto">
                        {rdvPag.items.map((appointment) => (
                          <div key={appointment.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-2xl">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">
                                {formatDateTime(appointment.date_heure)}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Dr. {appointment.medecin?.prenom} {appointment.medecin?.nom} — {appointment.motif || 'Consultation'}
                              </div>
                            </div>
                            <div>
                              {getStatusBadge(appointment.statut)}
                            </div>
                          </div>
                        ))}
                      </div>
                      <Pagination
                        currentPage={rdvPag.effectivePage}
                        totalPages={rdvPag.totalPages}
                        onPageChange={setRdvPage}
                        itemsPerPage={rdvPageSize}
                        totalItems={rdvPag.totalRows}
                      />
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-12">
                      <Calendar className="w-10 h-10 text-gray-300 mb-3" />
                      <p className="text-gray-500">Aucun rendez-vous à venir</p>
                    </div>
                  )
                )}
              </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-12 text-center">
            <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Sélectionnez un patient</h3>
            <p className="text-gray-600">Choisissez un patient dans la liste pour voir ses informations</p>
          </div>
        )}
      </div>

      {/* Modal nouveau rendez-vous — composant réutilisable partagé avec le reste
          de l'app (voir components/rendez-vous/NewAppointmentModal.jsx), pré-rempli
          avec le patient de la fiche courante. */}
      <NewAppointmentModal
        isOpen={showNewAppointment}
        onClose={() => setShowNewAppointment(false)}
        preselectedPatientId={selectedPatient?.id}
        onSaved={() => selectedPatient && loadPatientData(selectedPatient.id)}
      />
    </div>
  );
};

export default FichePatientOnly;
