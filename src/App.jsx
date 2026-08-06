import React, { Suspense, lazy, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PersonnalisationProvider } from './contexts/PersonnalisationContext';
import { AlertProvider } from './contexts/AlertContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AccessDenied from './components/AccessDenied';
import ProtectedRoute from './components/ProtectedRoute';
import { ROLES } from './utils/permissions';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import TemporaryPasswordGuard from './components/TemporaryPasswordGuard';
import { getCurrentSpeciality } from './lib/specialityConfigService';
// Helper pour créer des routes protégées avec guard de mot de passe temporaire
const ProtectedRouteWithGuard = ({ children }) => (
  <ProtectedRoute>
    <TemporaryPasswordGuard>
      {children}
    </TemporaryPasswordGuard>
  </ProtectedRoute>
);

// Composant de chargement optimisé
const LoadingSpinner = ({ message = "Chargement..." }) => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-700 font-medium">{message}</p>
      <p className="text-gray-500 text-sm mt-1">Optimisation en cours...</p>
    </div>
  </div>
);

// Composant Dashboard intelligent qui affiche le dashboard approprié selon le rôle
const SmartDashboard = () => {
  const { hasRole, userProfile, isLoading, currentUser } = useAuth();
  if (isLoading) {
    return <LoadingSpinner message="Vérification des permissions..." />;
  }
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  const role = userProfile?.role || currentUser?.user_metadata?.role || currentUser?.app_metadata?.role;
  if (role === ROLES.ADMIN) {
    return <Dashboard />;
  } else if (role === ROLES.DOCTOR) {
    return <DoctorDashboard />; // Affiche le dashboard médecin au lieu de rediriger
  } else if (role === ROLES.SECRETARY) {
    return <Navigate to="/secretary" replace />;
  } else if (role === ROLES.CAISSIER) {
    return <Navigate to="/caisse" replace />;
  } else if (role === ROLES.ACCOUNTING) {
    return <Navigate to="/accounting" replace />;
  } else if (role === ROLES.CASHIER) {
    return <Navigate to="/caisse" replace />;
  } else {
    return <Dashboard />;
  }
};

const RootRedirect = () => {
  const { isLoading } = useAuth();
  if (isLoading) {
    return <LoadingSpinner message="Chargement..." />;
  }
  return <Navigate to="/login" replace />;
};

// ============================================================================
// LAZY LOADING DES COMPOSANTS POUR OPTIMISER LE DÉMARRAGE
// ============================================================================

// Pages principales (chargement prioritaire)
const TestSimple = lazy(() => import('./pages/TestSimple'));
const TestAuth = lazy(() => import('./pages/TestAuth'));
const DatabaseCheck = lazy(() => import('./components/admin/DatabaseCheck'));
const TestSpecialityFilter = lazy(() => import('./pages/test/TestSpecialityFilter'));
const CabinetWelcome = lazy(() => import('./pages/CabinetWelcome'));
const CabinetWelcomePublic = lazy(() => import('./pages/CabinetWelcomePublic'));

// Pages de paramétrage (chargement à la demande)
const ParametragePage = lazy(() => import('./pages/parametrage/ParametragePage'));
const Medecins = lazy(() => import('./pages/parametrage/Medecins'));
const MedecinsForm = lazy(() => import('./pages/parametrage/MedecinsForm'));
const Specialites = lazy(() => import('./pages/parametrage/Specialites'));
const SpecialitesForm = lazy(() => import('./pages/parametrage/SpecialitesForm'));
const ListeEtiologies = lazy(() => import('./pages/parametrage/ListeEtiologies'));
const PlaintesPrincipales = lazy(() => import('./pages/parametrage/PlaintesPrincipales'));
const TypesSymptomes = lazy(() => import('./pages/parametrage/TypesSymptomes'));
const CategoriesAntecedents = lazy(() => import('./pages/parametrage/CategoriesAntecedents'));
const TypesAntecedents = lazy(() => import('./pages/parametrage/TypesAntecedents'));
const TypesCertificats = lazy(() => import('./pages/parametrage/TypesCertificats'));
const Employeurs = lazy(() => import('./pages/parametrage/Employeurs'));
const TiersPayant = lazy(() => import('./pages/parametrage/TiersPayant'));
const TypeCouvertureMedicale = lazy(() => import('./pages/parametrage/TypeCouvertureMedicale'));
const ListeArchives = lazy(() => import('./pages/parametrage/ListeArchives'));
const TypesArchives = lazy(() => import('./pages/parametrage/TypesArchives'));
const FamillesArchives = lazy(() => import('./pages/parametrage/FamillesArchives'));

// Pages de paramétrage médical - Phase 1
const Constantes = lazy(() => import('./pages/parametrage/Constantes'));
const SignesCliniques = lazy(() => import('./pages/parametrage/SignesCliniques'));
const Appareils = lazy(() => import('./pages/parametrage/Appareils'));
const Diagnostics = lazy(() => import('./pages/parametrage/Diagnostics'));

// Pages de paramétrage médical - Phase 2
const Antecedents = lazy(() => import('./pages/parametrage/Antecedents'));
const Medicaments = lazy(() => import('./pages/parametrage/Medicaments'));

// Pages de paramétrage médical - Phase 3
const ElementsSynthese = lazy(() => import('./pages/parametrage/ElementsSynthese'));
const TypesActes = lazy(() => import('./pages/parametrage/TypesActes'));
const Assurances = lazy(() => import('./pages/parametrage/Assurances'));
const ToothStatesPage = lazy(() => import('./pages/parametrage/ToothStatesPage'));

// Pages de paramétrage supplémentaires manquantes
const AntecedentsForm = lazy(() => import('./pages/parametrage/AntecedentsForm'));
const ParametresCabinet = lazy(() => import('./pages/parametrage/ParametresCabinet'));

// Pages du module Rendez-vous
const FichePatient = lazy(() => import('./pages/rendez-vous/FichePatient'));
const PatientForm = lazy(() => import('./pages/PatientForm'));
const PriseRendezVous = lazy(() => import('./pages/rendez-vous/PriseRendezVous'));
const SalleAttente = lazy(() => import('./pages/rendez-vous/SalleAttente'));
const RappelsSMS = lazy(() => import('./pages/rendez-vous/RappelsSMS'));
const NotificationsRealtime = lazy(() => import('./pages/rendez-vous/NotificationsRealtime'));
const ScanDocuments = lazy(() => import('./pages/rendez-vous/ScanDocuments'));
const StatistiquesRealtime = lazy(() => import('./pages/rendez-vous/StatistiquesRealtime'));

// Pages du module Consultation
const Consultations = lazy(() => import('./pages/consultation/Consultations'));
const ConsultationDetail = lazy(() => import('./pages/consultation/ConsultationDetail'));

// Pages du module Facturation
const ActesPage = lazy(() => import('./pages/facturation/Actes'));
const ExamensPage = lazy(() => import('./pages/facturation/Examens'));
const FacturesPage = lazy(() => import('./pages/facturation/Factures'));
const LaboPage = lazy(() => import('./pages/facturation/Labo'));
const PharmaciePage = lazy(() => import('./pages/facturation/Pharmacie'));
const DiversPage = lazy(() => import('./pages/facturation/Divers'));
const ReportingPage = lazy(() => import('./pages/reporting/Reporting'));

// Nouvelles pages de facturation complètes
const FacturationActes = lazy(() => import('./pages/facturation/FacturationActes'));
const FacturationExamens = lazy(() => import('./pages/facturation/FacturationExamens'));
const FacturationLabo = lazy(() => import('./pages/facturation/FacturationLabo'));
const ConsultationsTerminees = lazy(() => import('./pages/secretary/ConsultationsTerminees'));
const ConsultationCompletion = lazy(() => import('./pages/secretary/ConsultationCompletion'));
const Caisse = lazy(() => import('./pages/secretary/Caisse'));
const Relances = lazy(() => import('./pages/caissier/Relances'));
const Recapitulatif = lazy(() => import('./pages/caissier/Recapitulatif'));
const ArreteMensuel = lazy(() => import('./pages/caissier/ArreteMensuel'));
const ReversementBancaire = lazy(() => import('./pages/caissier/ReversementBancaire'));
const FacturationPharmacie = lazy(() => import('./pages/facturation/FacturationPharmacie'));
const FacturationFactures = lazy(() => import('./pages/facturation/FacturationFactures'));

// Pages d'administration

const GestionUtilisateurs = lazy(() => import('./pages/administration/GestionUtilisateurs'));
const FormulaireUtilisateur = lazy(() => import('./pages/administration/FormulaireUtilisateur'));
const GestionMedecins = lazy(() => import('./pages/administration/GestionMedecins'));
const GestionSecretaires = lazy(() => import('./pages/administration/GestionSecretaires'));
const GestionComptables = lazy(() => import('./pages/administration/GestionComptables'));
const GestionCaissiers = lazy(() => import('./pages/administration/GestionCaissiers'));
const GestionAdmins = lazy(() => import('./pages/administration/GestionAdmins'));
const Personnalisation = lazy(() => import('./pages/administration/Parametrage'));
const PersonnalisationMain = lazy(() => import('./pages/administration/PersonnalisationMain'));
const PersonnalisationGeneral = lazy(() => import('./pages/administration/PersonnalisationGeneral'));
const PersonnalisationApparence = lazy(() => import('./pages/administration/PersonnalisationApparence'));
const PersonnalisationDocuments = lazy(() => import('./pages/administration/PersonnalisationDocuments'));

// Pages pour médecins et secrétaires
const IntroductionPatientPage = lazy(() => import('./pages/IntroductionPatientPage'));
const FicheIdentificationPage = lazy(() => import('./pages/FicheIdentificationPage'));
const ExamenMedicalPage = lazy(() => import('./pages/ExamenMedicalPage'));
const ActesConsultationPage = lazy(() => import('./pages/ActesPage'));
const BcdsPage = lazy(() => import('./pages/BcdsPage'));
const StatisticsPage = lazy(() => import('./pages/StatisticsPage'));
const HistoriquesArchivesPage = lazy(() => import('./pages/HistoriquesArchivesPage'));
// Import direct pour contourner le problème de lazy loading
import PatientsPage from './pages/Patients';
import MesPatientsPageDirect from './pages/MesPatients';
const WaitingQueuePage = lazy(() => import('./pages/WaitingQueuePage'));
const SecretaryDashboard = lazy(() => import('./components/secretary/SecretaryDashboard'));
const MedicalRecordsPage = lazy(() => import('./pages/MedicalRecordsPage'));
const PrescriptionsPage = lazy(() => import('./pages/PrescriptionsPage'));
const MyWaitingQueuePage = lazy(() => import('./pages/MyWaitingQueuePage'));
const TestDoctorSpecificQueue = lazy(() => import('./pages/test/TestDoctorSpecificQueue'));
const DoctorDashboard = lazy(() => import('./components/doctor/DoctorDashboard_Fixed'));
const AccountingDashboard = lazy(() => import('./pages/AccountingDashboard'));
const EncaissementFactures = lazy(() => import('./pages/comptabilite/EncaissementFactures'));
const SuiviCaissiers = lazy(() => import('./pages/comptabilite/SuiviCaissiers'));
const TableauBordComptable = lazy(() => import('./pages/comptabilite/TableauBordComptable'));
const HistoriquePatient = lazy(() => import('./pages/comptabilite/HistoriquePatient'));
const AlertesImpayes = lazy(() => import('./pages/comptabilite/AlertesImpayes'));
const RechercheAvancee = lazy(() => import('./pages/comptabilite/RechercheAvancee'));
const RapportsFinanciers = lazy(() => import('./pages/comptabilite/RapportsFinanciers'));
const MyCalendar = lazy(() => import('./pages/doctor/MyCalendar'));
const Profile = lazy(() => import('./pages/Profile'));
const SettingsPage = lazy(() => import('./pages/doctor/SettingsPage'));

const GlobalCalendar = lazy(() => import('./pages/secretary/GlobalCalendar'));
const PermissionTestPage = lazy(() => import('./pages/PermissionTestPage'));
const MesPatientsPage = lazy(() => import('./pages/MesPatients'));

// Pages patients avec formulaires dédiés
const PatientDetailsPage = lazy(() => import('./pages/patients/PatientDetailsPage'));
const PatientEditPage = lazy(() => import('./pages/patients/PatientEditPage'));
const PatientCreatePage = lazy(() => import('./pages/patients/PatientCreatePage'));

// Page de test pour le sélecteur de dents
const DentalChartPage = lazy(() => import('./pages/DentalChartPage'));
const ToothCanvasExamplePage = lazy(() => import('./examples/ToothCanvasExamplePage'));
const DentalChartPageV2 = lazy(() => import('./pages/DentalChartPageV2'));
const ThreeDentalChart = lazy(() => import('./components/dental-chart-3d/ThreeDentalChart'));

// Wrapper pour les pages avec Suspense et Layout
const LazyPageWrapper = ({ Component, message, allowedRoles = null }) => {
  const { currentUser, userProfile, isLoading, profileLoading } = useAuth();
  
  console.log('🔄 [LazyPageWrapper] Chargement du composant:', Component.name || 'Component sans nom');
  
  // Si des rôles sont spécifiés, vérifier les permissions
  if (allowedRoles) {
    const userRole = userProfile?.role || currentUser?.user_metadata?.role || currentUser?.app_metadata?.role;

    // Éviter un accès refusé prématuré juste après connexion (profil pas encore chargé)
    if (!isLoading && currentUser && !userRole && profileLoading) {
      return <LoadingSpinner message="Chargement du profil..." />;
    }

    if (!isLoading && currentUser && !userRole && !profileLoading) {
      return <LoadingSpinner message="Chargement du profil..." />;
    }

    if (!allowedRoles.includes(userRole)) {
      return <Navigate to="/access-denied" replace />;
    }
  }
  
  return (
    <Suspense fallback={<LoadingSpinner message={message} />}>
      <Component />
    </Suspense>
  );
};


// Wrapper pour les pages sans Layout
const LazyComponentWrapper = ({ Component, message }) => (
  <Suspense fallback={<LoadingSpinner message={message} />}>
    <Component />
  </Suspense>
);

// Pages temporaires optimisées
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'));

// Pages du module secrétaire - Rendez-vous
const SalleAttentePage = lazy(() => {
  console.log('🔄 [App.jsx] Lazy loading SalleAttentePage...');
  return import('./pages/SalleAttentePage').catch(err => {
    console.error('❌ [App.jsx] Erreur lazy loading SalleAttentePage:', err);
    throw err;
  });
});
const FichePatientRdv = lazy(() => import('./pages/rendez-vous/FichePatientRdv'));
const FichePatientOnly = lazy(() => import('./pages/rendez-vous/FichePatientOnly'));
const PriseRendezVousPage = lazy(() => import('./pages/rendez-vous/PriseRendezVousPage'));
const RappelsSmsPage = lazy(() => import('./pages/rendez-vous/RappelsSmsPage'));
const RechercheRendezVousPage = lazy(() => import('./pages/rendez-vous/RechercheRendezVousPage'));
const DetailsRendezVous = lazy(() => import('./pages/rendez-vous/DetailsRendezVous'));

// Pages de paramètres simples (pas de lazy loading nécessaire)
const GeneralSettingsPage = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-bold text-gray-900">Paramètres Généraux</h1>
    <div className="card">
      <p className="text-gray-600">Page de paramètres généraux en cours de développement...</p>
    </div>
  </div>
);

const UsersPage = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-bold text-gray-900">Gestion des Utilisateurs</h1>
    <div className="card">
      <p className="text-gray-600">Page de gestion des utilisateurs en cours de développement...</p>
    </div>
  </div>
);

const CabinetSettingsPage = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-bold text-gray-900">Paramètres du Cabinet</h1>
    <div className="card">
      <p className="text-gray-600">Page des paramètres du cabinet en cours de développement...</p>
    </div>
  </div>
);

const SecurityPage = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-bold text-gray-900">Sécurité</h1>
    <div className="card">
      <p className="text-gray-600">Page de sécurité en cours de développement...</p>
    </div>
  </div>
);

const MainLayout = () => {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

const AppContent = () => {
  const SoundPolicySetter = () => {
    const { hasRole } = useAuth();
    React.useEffect(() => {
      try {
        const isSecretary = !!hasRole('secretary');
        const isAdmin = !!hasRole('admin');
        const isDoctor = !!hasRole('doctor');
        const isAccounting = !!hasRole('accounting');
        const roleName = isAdmin ? 'admin' : isDoctor ? 'doctor' : isSecretary ? 'secretary' : isAccounting ? 'accounting' : 'other';
        localStorage.setItem('user_role', roleName);
        const enable = isSecretary || isAdmin || isDoctor || isAccounting;
        localStorage.setItem('notification_sound_enabled', enable ? 'true' : 'false');
      } catch {}
    }, [hasRole]);
    return null;
  };


  // Composant pour initialiser la configuration de spécialité au démarrage
  const SpecialityConfigInitializer = () => {
    const { currentUser } = useAuth();
    const initializedRef = React.useRef(false);
    
    React.useEffect(() => {
      // Initialiser la configuration seulement si l'utilisateur est connecté et pas déjà initialisé
      if (currentUser && !initializedRef.current) {
        console.log(`[SPECIALITY_CONFIG] Initialisation de la configuration de spécialité au démarrage de l'application`);
        getCurrentSpeciality()
          .then(config => {
            console.log(`[SPECIALITY_CONFIG] Configuration initialisée avec succès`, {
              mode_specialite_id: config.mode_specialite_id,
              specialite_nom: config.specialite?.nom || 'Mode généraliste',
              user_email: currentUser.email
            });
            initializedRef.current = true;
          })
          .catch(error => {
            console.error(`[SPECIALITY_CONFIG] Erreur lors de l'initialisation de la configuration:`, error);
          });
      }
    }, [currentUser]);
    
    return null;
  };

  return (
    <PersonnalisationProvider>
      <Router>
        <SoundPolicySetter />
      <SpecialityConfigInitializer />
      {/* Système de notifications unifié */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        limit={5}
      />
      <Routes>
        {/* Route publiques */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Routes de test */}
        <Route path="/test-simple" element={
          <LazyComponentWrapper Component={TestSimple} message="Chargement du test..." />
        } />
        <Route path="/test-auth" element={
          <LazyComponentWrapper Component={TestAuth} message="Chargement du test d'auth..." />
        } />
        {/* Routes protégées principales - Layout global persistant */}
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/test-speciality-filter" element={
          <ProtectedRoute>
            <LazyPageWrapper Component={TestSpecialityFilter} message="Chargement du test de filtrage spécialité..." />
          </ProtectedRoute>
        } />

        <Route path="/dental-chart" element={
          <ProtectedRoute>
            <LazyPageWrapper Component={DentalChartPage} message="Chargement du schéma dentaire..." />
          </ProtectedRoute>
        } />

        
        
        {/* New route for ToothCanvas example */}
        <Route path="/tooth-canvas-example" element={
          <LazyComponentWrapper Component={ToothCanvasExamplePage} message="Chargement de l'exemple ToothCanvas..." />
        } />
        
        <Route path="/dental-chart-v2" element={
          <ProtectedRoute>
            <LazyPageWrapper Component={DentalChartPageV2} message="Chargement du schéma dentaire V2..." />
          </ProtectedRoute>
        } />
        
        <Route path="/dental-chart-3d" element={
          <ProtectedRoute>
            <LazyPageWrapper Component={ThreeDentalChart} message="Chargement du schéma dentaire 3D..." />
          </ProtectedRoute>
        } />
        
        {/* Route calendrier */}
     
        
        {/* Routes protégées principales - Layout global persistant */}

        <Route path="/" element={<RootRedirect />} />
        
        <Route path="/dashboard" element={
          <ProtectedRouteWithGuard>
            <SmartDashboard />
          </ProtectedRouteWithGuard>
        } />
        
        {/* Routes d'accueil spécifiques par rôle */}
        <Route path="/secretary" element={
          <ProtectedRoute allowedRoles={[ROLES.SECRETARY]}>
            <LazyPageWrapper Component={SecretaryDashboard} message="Chargement tableau de bord secrétaire..." />
          </ProtectedRoute>
        } />
        
        <Route path="/doctor" element={
          <ProtectedRoute allowedRoles={[ROLES.DOCTOR]}>
            <LazyPageWrapper Component={DoctorDashboard} message="Chargement dashboard médecin..." />
          </ProtectedRoute>
        } />
        
        <Route path="/doctor-dashboard" element={
          <ProtectedRoute allowedRoles={[ROLES.DOCTOR]}>
            <LazyPageWrapper Component={DoctorDashboard} message="Chargement dashboard médecin..." />
          </ProtectedRoute>
        } />
        
        <Route path="/accounting" element={
          <ProtectedRoute allowedRoles={[ROLES.ACCOUNTING]}>
            <LazyPageWrapper Component={AccountingDashboard} message="Chargement dashboard comptabilité..." />
          </ProtectedRoute>
        } />

        <Route path="/comptabilite/encaissement" element={
          <ProtectedRoute allowedRoles={[ROLES.ACCOUNTING, ROLES.ADMIN, ROLES.CASHIER, ROLES.CAISSIER]}>
            <LazyPageWrapper Component={EncaissementFactures} message="Chargement encaissement factures..." />
          </ProtectedRoute>
        } />

        <Route path="/comptabilite/suivi-caissiers" element={
          <ProtectedRoute allowedRoles={[ROLES.ACCOUNTING, ROLES.ADMIN]}>
            <LazyPageWrapper Component={SuiviCaissiers} message="Chargement suivi caissiers..." />
          </ProtectedRoute>
        } />

        {/* Business Intelligence et Reporting */}
        <Route path="/comptabilite/tableau-bord" element={
          <ProtectedRoute allowedRoles={[ROLES.ACCOUNTING]}>
            <LazyPageWrapper Component={TableauBordComptable} message="Chargement tableau de bord..." />
          </ProtectedRoute>
        } />

        <Route path="/comptabilite/historique-patients" element={
          <ProtectedRoute allowedRoles={[ROLES.ACCOUNTING]}>
            <LazyPageWrapper Component={HistoriquePatient} message="Chargement historique patients..." />
          </ProtectedRoute>
        } />

        <Route path="/comptabilite/alertes-impayes" element={
          <ProtectedRoute allowedRoles={[ROLES.ACCOUNTING, ROLES.ADMIN, ROLES.CASHIER, ROLES.CAISSIER]}>
            <LazyPageWrapper Component={AlertesImpayes} message="Chargement alertes impayés..." />
          </ProtectedRoute>
        } />

        <Route path="/comptabilite/recherche-avancee" element={
          <ProtectedRoute allowedRoles={[ROLES.ACCOUNTING]}>
            <LazyPageWrapper Component={RechercheAvancee} message="Chargement recherche avancée..." />
          </ProtectedRoute>
        } />

        <Route path="/comptabilite/rapports-financiers" element={
          <ProtectedRoute allowedRoles={[ROLES.ACCOUNTING]}>
            <LazyPageWrapper Component={RapportsFinanciers} message="Chargement rapports financiers..." />
          </ProtectedRoute>
        } />

        {/* Calendriers dédiés */}
        <Route path="/my-calendar" element={
          <ProtectedRoute allowedRoles={[ROLES.DOCTOR]}>
            <LazyPageWrapper Component={MyCalendar} message="Chargement de mon calendrier..." />
          </ProtectedRoute>
        } />
        <Route path="/secretary-calendar" element={
          <ProtectedRoute allowedRoles={[ROLES.SECRETARY, ROLES.ADMIN]}>
            <LazyPageWrapper Component={GlobalCalendar} message="Chargement du calendrier..." />
          </ProtectedRoute>
        } />
        
        {/* Paramètres médecin */}
        <Route path="/doctor/settings" element={
          <ProtectedRoute allowedRoles={[ROLES.DOCTOR]}>
            <LazyPageWrapper Component={SettingsPage} message="Chargement des paramètres..." />
          </ProtectedRoute>
        } />
        
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        {/* Routes principales avec lazy loading */}
        <Route path="/database-check" element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.DOCTOR]}>
            <LazyPageWrapper Component={DatabaseCheck} message="Chargement du diagnostic base de données..." />
          </ProtectedRoute>
        } />
        <Route path="/patients" element={
          <ProtectedRoute allowedRoles={[ROLES.DOCTOR, ROLES.SECRETARY, ROLES.ADMIN]}>
            <PatientsPage />
          </ProtectedRoute>
        } />
        
        {/* Route de test simple pour isoler le problème */}
        <Route path="/patients-simple" element={
          <div>
            <h1>Page Patients Simple - Test</h1>
            <p>Si vous voyez ceci, la route fonctionne.</p>
            <p>Rôle: doctor</p>
          </div>
        } />
        
        <Route path="/appointments" element={
          <ProtectedRoute>
            <LazyPageWrapper Component={AppointmentsPage} message="Chargement des rendez-vous..." />
          </ProtectedRoute>
        } />

        <Route path="/appointments/recherche" element={
          <ProtectedRoute>
            <LazyPageWrapper Component={RechercheRendezVousPage} message="Chargement de la recherche de rendez-vous..." />
          </ProtectedRoute>
        } />

        {/* Notifications - accessible aux rôles principaux */}
        <Route path="/notifications" element={
          <ProtectedRoute allowedRoles={[ROLES.DOCTOR, ROLES.SECRETARY, ROLES.ADMIN]}>
            <LazyPageWrapper Component={NotificationsRealtime} message="Chargement des notifications..." />
          </ProtectedRoute>
        } />
        
        {/* Nouvelles pages du module secrétaire */}
        <Route path="/salle-attente" element={
          <ProtectedRoute allowedRoles={['secretary', 'admin']}>
            <LazyPageWrapper Component={SalleAttentePage} message="Chargement salle d'attente..." />
          </ProtectedRoute>
        } />
        
        <Route path="/my-waiting-queue" element={
          <ProtectedRoute allowedRoles={['doctor', 'admin']}>
            <LazyPageWrapper Component={MyWaitingQueuePage} message="Chargement salle d'attente..." />
          </ProtectedRoute>
        } />
        
        <Route path="/rendez-vous/fiche-patient" element={
          <ProtectedRoute allowedRoles={['doctor', 'secretary', 'admin']}>
            <LazyPageWrapper Component={FichePatientOnly} message="Chargement fiche patient..." />
          </ProtectedRoute>
        } />
        
        <Route path="/rendez-vous/prise-rendez-vous" element={
          <ProtectedRoute allowedRoles={['secretary', 'admin']}>
            <LazyPageWrapper Component={PriseRendezVousPage} message="Chargement prise de rendez-vous..." />
          </ProtectedRoute>
        } />
        
        <Route path="/rendez-vous/rappels-sms" element={
          <ProtectedRoute allowedRoles={['secretary', 'admin']}>
            <LazyPageWrapper Component={RappelsSmsPage} message="Chargement rappels SMS..." />
          </ProtectedRoute>
        } />
        
        <Route path="/rendez-vous/details" element={
          <ProtectedRoute allowedRoles={['secretary', 'admin']}>
            <LazyPageWrapper Component={DetailsRendezVous} message="Chargement détails des rendez-vous..." />
          </ProtectedRoute>
        } />
        
        {/* Route principale de paramétrage */}
        <Route path="/parametrage" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={ParametragePage} message="Chargement paramétrage..." />
          </ProtectedRoute>
        } />
        
        {/* Routes de paramétrage avec lazy loading */}
        <Route path="/parametrage/medecins" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={Medecins} message="Chargement paramètres médecins..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/medecins/form" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={MedecinsForm} message="Chargement formulaire médecin..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/specialites" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={Specialites} message="Chargement spécialités..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/specialites/form" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={SpecialitesForm} message="Chargement formulaire spécialité..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/liste-etiologies" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={ListeEtiologies} message="Chargement liste étiologies..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/plaintes-principales" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={PlaintesPrincipales} message="Chargement plaintes principales..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/types-symptomes" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={TypesSymptomes} message="Chargement types symptômes..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/categories-antecedents" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={CategoriesAntecedents} message="Chargement catégories antécédents..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/types-antecedents" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={TypesAntecedents} message="Chargement types antécédents..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/types-certificats" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={TypesCertificats} message="Chargement types certificats..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/employeurs" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={Employeurs} message="Chargement employeurs..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/tiers-payant" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={TiersPayant} message="Chargement tiers payant..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/type-couverture-medicale" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={TypeCouvertureMedicale} message="Chargement type couverture médicale..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/liste-archives" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={ListeArchives} message="Chargement liste archives..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/types-archives" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={TypesArchives} message="Chargement types archives..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/familles-archives" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={FamillesArchives} message="Chargement familles archives..." />
          </ProtectedRoute>
        } />
        
        {/* Routes de paramétrage médical */}
        <Route path="/parametrage/constantes" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={Constantes} message="Chargement constantes..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/signes-cliniques" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={SignesCliniques} message="Chargement signes cliniques..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/appareils" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={Appareils} message="Chargement appareils..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/diagnostics" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={Diagnostics} message="Chargement diagnostics..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/antecedents" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={Antecedents} message="Chargement antécédents..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/antecedents/form" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={AntecedentsForm} message="Chargement formulaire antécédent..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/medicaments" element={
          <ProtectedRoute allowedRoles={['admin', ROLES.DOCTOR]}>
            <LazyPageWrapper Component={Medicaments} message="Chargement médicaments..." />
          </ProtectedRoute>
        } />

        <Route path="/parametrage/elements-synthese" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={ElementsSynthese} message="Chargement éléments synthèse..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/types-actes" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={TypesActes} message="Chargement types actes..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/etats-dentaires" element={
          <ProtectedRoute allowedRoles={['admin', 'doctor']}>
            <LazyPageWrapper Component={ToothStatesPage} message="Chargement états dentaires..." />
          </ProtectedRoute>
        } />
        
        <Route path="/parametrage/assurances" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={Assurances} message="Chargement assurances..." />
          </ProtectedRoute>
        } />
        
        {/* Routes de paramètres généraux */}
        <Route path="/personnalisation" element={
          <ProtectedRoute allowedRoles={['admin', 'doctor']}>
            <LazyPageWrapper Component={ParametresCabinet} message="Chargement personnalisation..." />
          </ProtectedRoute>
        } />
        <Route path="/cabinet-settings" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={ParametresCabinet} message="Chargement paramètres cabinet..." />
          </ProtectedRoute>
        } />
        
        <Route path="/settings" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <GeneralSettingsPage />
          </ProtectedRoute>
        } />
        

        
        <Route path="/profile" element={
          <ProtectedRoute>
            <LazyPageWrapper Component={Profile} message="Chargement du profil..." />
          </ProtectedRoute>
        } />
        
        <Route path="/security" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <SecurityPage />
          </ProtectedRoute>
        } />
        
        <Route path="/statistics" element={
          <ProtectedRoute allowedRoles={['admin', 'accounting']}>
            <LazyPageWrapper Component={StatisticsPage} message="Chargement statistiques..." />
          </ProtectedRoute>
        } />

        <Route path="/reports" element={
          <ProtectedRoute allowedRoles={['admin', 'accounting']}>
            <LazyPageWrapper Component={ReportingPage} message="Chargement rapports..." />
          </ProtectedRoute>
        } />
        
        <Route path="/historiques-archives" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={HistoriquesArchivesPage} message="Chargement historiques & archives..." />
          </ProtectedRoute>
        } />
        
        {/* Routes d'administration avec lazy loading */}
        <Route path="/administration/gestion-utilisateurs" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={GestionUtilisateurs} message="Chargement gestion utilisateurs..." />
          </ProtectedRoute>
        } />
        
        <Route path="/administration/gestion-utilisateurs/details/:id" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Suspense fallback={<LoadingSpinner message="Chargement formulaire utilisateur..." />}>
              <FormulaireUtilisateur />
            </Suspense>
          </ProtectedRoute>
        } />
        
        {/* Routes de gestion des médecins */}
        <Route path="/administration/gestion-medecins" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={GestionMedecins} message="Chargement gestion médecins..." />
          </ProtectedRoute>
        } />
        
        <Route path="/administration/gestion-medecins/details/:id" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Suspense fallback={<LoadingSpinner message="Chargement formulaire médecin..." />}>
              <FormulaireUtilisateur />
            </Suspense>
          </ProtectedRoute>
        } />
        
        {/* Routes de gestion des secrétaires */}
        <Route path="/administration/gestion-secretaires" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={GestionSecretaires} message="Chargement gestion secrétaires..." />
          </ProtectedRoute>
        } />
        
        <Route path="/administration/gestion-secretaires/details/:id" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Suspense fallback={<LoadingSpinner message="Chargement formulaire secrétaire..." />}>
              <FormulaireUtilisateur />
            </Suspense>
          </ProtectedRoute>
        } />
        
        {/* Routes de gestion des comptables */}
        <Route path="/administration/gestion-comptables" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={GestionComptables} message="Chargement gestion comptables..." />
          </ProtectedRoute>
        } />
        
        <Route path="/administration/gestion-comptables/details/:id" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Suspense fallback={<LoadingSpinner message="Chargement formulaire comptable..." />}>
              <FormulaireUtilisateur />
            </Suspense>
          </ProtectedRoute>
        } />

        {/* Routes de gestion des caissiers */}
        <Route path="/administration/gestion-caissiers" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={GestionCaissiers} message="Chargement gestion caissiers..." />
          </ProtectedRoute>
        } />

        <Route path="/administration/gestion-caissiers/details/:id" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Suspense fallback={<LoadingSpinner message="Chargement formulaire caissier..." />}>
              <FormulaireUtilisateur />
            </Suspense>
          </ProtectedRoute>
        } />
        
        {/* Routes de gestion des administrateurs */}
        <Route path="/administration/gestion-admins" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={GestionAdmins} message="Chargement gestion administrateurs..." />
          </ProtectedRoute>
        } />
        
        <Route path="/administration/gestion-admins/details/:id" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Suspense fallback={<LoadingSpinner message="Chargement formulaire administrateur..." />}>
              <FormulaireUtilisateur />
            </Suspense>
          </ProtectedRoute>
        } />
        
        {/* Routes de personnalisation */}
        <Route path="/administration/personnalisation" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={PersonnalisationMain} message="Chargement personnalisation..." />
          </ProtectedRoute>
        } />
        <Route path="/administration/personnalisation/general" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={PersonnalisationGeneral} message="Chargement paramètres généraux..." />
          </ProtectedRoute>
        } />
        <Route path="/administration/personnalisation/apparence" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={PersonnalisationApparence} message="Chargement apparence..." />
          </ProtectedRoute>
        } />
        <Route path="/administration/personnalisation/documents" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={PersonnalisationDocuments} message="Chargement documents..." />
          </ProtectedRoute>
        } />
        
        {/* Routes médecin avec lazy loading */}
        <Route path="/my-patients" element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <MesPatientsPageDirect />
          </ProtectedRoute>
        } />
        
        <Route path="/consultations" element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <LazyPageWrapper Component={Consultations} message="Chargement consultations..." />
          </ProtectedRoute>
        } />
        
        <Route path="/consultation/:id" element={
          <ProtectedRoute>
            <LazyPageWrapper Component={ConsultationDetail} message="Chargement détails consultation..." />
          </ProtectedRoute>
        } />
        
        {/* Routes pour les pages médicales */}
        <Route path="/examen-medical" element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <LazyPageWrapper Component={ExamenMedicalPage} message="Chargement examen médical..." />
          </ProtectedRoute>
        } />
  
        
        <Route path="/ordonnances" element={
          <ProtectedRoute allowedRoles={['doctor', 'secretary']}>
            <LazyPageWrapper Component={PrescriptionsPage} message="Chargement ordonnances..." />
          </ProtectedRoute>
        } />
        
        <Route path="/prescription" element={
          <ProtectedRoute allowedRoles={['doctor', 'secretary']}>
            <LazyPageWrapper Component={PrescriptionsPage} message="Chargement prescriptions..." />
          </ProtectedRoute>
        } />
        
        <Route path="/actes" element={
          <ProtectedRoute allowedRoles={['doctor', 'secretary']}>
            <LazyPageWrapper Component={ActesConsultationPage} message="Chargement actes..." />
          </ProtectedRoute>
        } />
        
        <Route path="/medical-records" element={
          <ProtectedRoute allowedRoles={['doctor', 'secretary']}>
            <LazyPageWrapper Component={MedicalRecordsPage} message="Chargement dossiers médicaux..." />
          </ProtectedRoute>
        } />
        
        <Route path="/bcds" element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <LazyPageWrapper Component={BcdsPage} message="Chargement BCDS..." />
          </ProtectedRoute>
        } />
        
        {/* Routes secrétaire avec lazy loading */}
        <Route path="/secretary-dashboard" element={
          <ProtectedRoute allowedRoles={[ROLES.SECRETARY, ROLES.ADMIN]}>
            <LazyPageWrapper Component={SecretaryDashboard} message="Chargement tableau de bord..." />
          </ProtectedRoute>
        } />
        
        <Route path="/introduction-patient" element={
          <ProtectedRoute allowedRoles={[ROLES.SECRETARY, ROLES.ADMIN]}>
            <LazyPageWrapper Component={IntroductionPatientPage} message="Chargement introduction patient..." />
          </ProtectedRoute>
        } />
        
        <Route path="/fiche-identification" element={
          <ProtectedRoute allowedRoles={[ROLES.SECRETARY, ROLES.ADMIN]}>
            <LazyPageWrapper Component={FicheIdentificationPage} message="Chargement fiche identification..." />
          </ProtectedRoute>
        } />
        
        {/* Routes pour les formulaires patients */}
        <Route path="/patients/details/:id" element={
          <ProtectedRoute allowedRoles={[ROLES.SECRETARY, ROLES.ADMIN, ROLES.DOCTOR]}>
            <LazyPageWrapper Component={PatientDetailsPage} message="Chargement détails patient..." />
          </ProtectedRoute>
        } />
        
        <Route path="/patients/edit/:id" element={
          <ProtectedRoute allowedRoles={[ROLES.SECRETARY, ROLES.ADMIN]}>
            <LazyPageWrapper Component={PatientEditPage} message="Chargement modification patient..." />
          </ProtectedRoute>
        } />
        
        <Route path="/patients/create" element={
          <ProtectedRoute allowedRoles={[ROLES.SECRETARY, ROLES.ADMIN]}>
            <LazyPageWrapper Component={PatientCreatePage} message="Chargement création patient..." />
          </ProtectedRoute>
        } />
        
        {/* Route consultations terminées */}
        <Route path="/consultations-terminees" element={
          <LazyPageWrapper 
            Component={ConsultationsTerminees} 
            message="Chargement des consultations terminées..." 
          />
        } />
        
        {/* Route pour la caisse (module caissier ; accès admin/secrétaire pour dépannage) */}
        <Route path="/caisse" element={
          <ProtectedRoute allowedRoles={[ROLES.SECRETARY, ROLES.ADMIN, ROLES.CASHIER, ROLES.CAISSIER]}>
            <LazyPageWrapper 
              Component={Caisse} 
              message="Chargement de la caisse..." 
            />  
          </ProtectedRoute>
        } />
        {/* Pages module caissier */}
        <Route path="/caissier/relances" element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.CAISSIER]}>
            <LazyPageWrapper Component={Relances} message="Chargement des relances..." />
          </ProtectedRoute>
        } />
        <Route path="/caissier/recapitulatif" element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.CAISSIER]}>
            <LazyPageWrapper Component={Recapitulatif} message="Chargement du récapitulatif..." />
          </ProtectedRoute>
        } />
        <Route path="/caissier/arrete-mensuel" element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.CAISSIER]}>
            <LazyPageWrapper Component={ArreteMensuel} message="Chargement de l'arrêté mensuel..." />
          </ProtectedRoute>
        } />
        <Route path="/caissier/reversement-bancaire" element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.CAISSIER]}>
            <LazyPageWrapper Component={ReversementBancaire} message="Chargement reversement bancaire..." />
          </ProtectedRoute>
        } />
        {/* Route completion de consultation */}
        <Route path="/consultation-completion/:consultationId" element={
          <LazyPageWrapper 
            Component={ConsultationCompletion} 
            message="Chargement de la completion de consultation..." 
            allowedRoles={[ROLES.SECRETARY, ROLES.ADMIN]} 
          />
        } />
        
        {/* Routes de facturation - DIRECTES SANS REDIRECTION */}
        <Route path="/facturation/actes" element={
          <LazyPageWrapper 
            Component={FacturationActes} 
            message="Chargement facturation actes..." 
            allowedRoles={[ROLES.SECRETARY, ROLES.ADMIN, ROLES.ACCOUNTING]} 
          />
        } />
        
        <Route path="/facturation/examens" element={
          <LazyPageWrapper 
            Component={FacturationExamens} 
            message="Chargement facturation examens..." 
            allowedRoles={[ROLES.SECRETARY, ROLES.ADMIN, ROLES.ACCOUNTING]} 
          />
        } />
        
        <Route path="/facturation/labo" element={
          <LazyPageWrapper 
            Component={FacturationLabo} 
            message="Chargement facturation laboratoire..." 
            allowedRoles={[ROLES.SECRETARY, ROLES.ADMIN, ROLES.ACCOUNTING]} 
          />
        } />
        
        <Route path="/facturation/pharmacie" element={
          <LazyPageWrapper 
            Component={FacturationPharmacie} 
            message="Chargement facturation pharmacie..." 
            allowedRoles={[ROLES.SECRETARY, ROLES.ADMIN, ROLES.ACCOUNTING]} 
          />
        } />
        
        <Route path="/facturation/factures" element={
          <LazyPageWrapper 
            Component={FacturationFactures} 
            message="Chargement gestion factures..." 
            allowedRoles={[ROLES.SECRETARY, ROLES.ADMIN, ROLES.ACCOUNTING]} 
          />
        } />
        
        </Route>

        <Route path="/cabinet-welcome" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <LazyPageWrapper Component={CabinetWelcome} message="Chargement..." />
          </ProtectedRoute>
        } />

        <Route path="/cabinet-welcome-public/:tenantId" element={
          <Suspense fallback={<LoadingSpinner message="Chargement..." />}>
            <CabinetWelcomePublic />
          </Suspense>
        } />

        {/* Page d'accès refusé */}
        <Route path="/access-denied" element={<AccessDenied />} />
        
        {/* Route par défaut */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
    </PersonnalisationProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <AlertProvider>
        <div className="App">
          <AppContent />
        </div>
      </AlertProvider>
    </AuthProvider>
  );
}

export default App;
