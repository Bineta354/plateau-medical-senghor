import { ROLES } from '../utils/permissions';

// Configuration complète de toutes les pages et sous-pages de l'application
export const PAGES_CONFIG = [
  // Dashboard principal
  {
    id: 'dashboard',
    title: 'Tableau de Bord',
    description: 'Vue d\'ensemble du cabinet médical',
    path: '/dashboard',
    category: 'Principal',
    icon: 'BarChart3',
    keywords: ['dashboard', 'accueil', 'tableau', 'bord', 'statistiques', 'vue ensemble'],
    allowedRoles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.SECRETARY],
    isMainPage: true
  },

  // PATIENTS
  {
    id: 'patients',
    title: 'Gestion des Patients',
    description: 'Liste et gestion de tous les patients',
    path: '/patients',
    category: 'Patients',
    icon: 'Users',
    keywords: ['patients', 'gestion', 'liste', 'dossiers', 'malades'],
    allowedRoles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.SECRETARY],
    isMainPage: true
  },
  {
    id: 'my-patients',
    title: 'Mes Patients',
    description: 'Patients spécifiques au médecin connecté',
    path: '/my-patients',
    category: 'Patients',
    icon: 'UserCheck',
    keywords: ['mes patients', 'patients médecin', 'consultations', 'suivi'],
    allowedRoles: [ROLES.DOCTOR],
    isMainPage: true
  },
  {
    id: 'my-waiting-queue',
    title: 'Ma File d\'Attente',
    description: 'File d\'attente personnelle du médecin',
    path: '/my-waiting-queue',
    category: 'Rendez-vous',
    icon: 'Users',
    keywords: ['file attente', 'patients en attente', 'ma file', 'queue'],
    allowedRoles: [ROLES.DOCTOR],
    isMainPage: true
  },
  {
    id: 'patient-form',
    title: 'Nouveau Patient',
    description: 'Formulaire d\'ajout d\'un nouveau patient',
    path: '/rendez-vous/fiche-patient/form',
    category: 'Patients',
    icon: 'UserPlus',
    keywords: ['nouveau patient', 'ajouter', 'formulaire', 'inscription', 'enregistrement'],
    allowedRoles: [ROLES.ADMIN, ROLES.SECRETARY],
    isSubPage: true
  },

  // RENDEZ-VOUS
  {
    id: 'calendar',
    title: 'Calendrier',
    description: 'Gestion des rendez-vous et planning',
    path: '/appointments',
    category: 'Rendez-vous',
    icon: 'Calendar',
    keywords: ['calendrier', 'rendez-vous', 'planning', 'agenda', 'rdv'],
    allowedRoles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.SECRETARY],
    isMainPage: true
  },
  {
    id: 'fiche-patient',
    title: 'Fiche Patient',
    description: 'Informations détaillées du patient',
    path: '/rendez-vous/fiche-patient',
    category: 'Rendez-vous',
    icon: 'FileText',
    keywords: ['fiche patient', 'informations', 'détails', 'profil'],
    allowedRoles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.SECRETARY],
    isSubPage: true
  },
  {
    id: 'prise-rendez-vous',
    title: 'Prise de Rendez-vous',
    description: 'Planifier un nouveau rendez-vous',
    path: '/rendez-vous/prise-rendez-vous',
    category: 'Rendez-vous',
    icon: 'CalendarPlus',
    keywords: ['prise rendez-vous', 'planifier', 'nouveau rdv', 'réserver'],
    allowedRoles: [ROLES.ADMIN, ROLES.SECRETARY],
    isSubPage: true
  },
  {
    id: 'salle-attente',
    title: 'Salle d\'Attente',
    description: 'Gestion de la salle d\'attente',
    path: '/rendez-vous/salle-attente',
    category: 'Rendez-vous',
    icon: 'Clock',
    keywords: ['salle attente', 'file attente', 'patients en attente'],
    allowedRoles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.SECRETARY],
    isSubPage: true
  },
  {
    id: 'rappels-sms',
    title: 'Rappels SMS',
    description: 'Gestion des rappels par SMS',
    path: '/rendez-vous/rappels-sms',
    category: 'Rendez-vous',
    icon: 'MessageSquare',
    keywords: ['rappels', 'sms', 'notifications', 'messages'],
    allowedRoles: [ROLES.ADMIN, ROLES.SECRETARY],
    isSubPage: true
  },
  {
    id: 'notifications-realtime',
    title: 'Notifications Temps Réel',
    description: 'Notifications en temps réel',
    path: '/rendez-vous/notifications-realtime',
    category: 'Rendez-vous',
    icon: 'Bell',
    keywords: ['notifications', 'temps réel', 'alertes', 'live'],
    allowedRoles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.SECRETARY],
    isSubPage: true
  },
  {
    id: 'scan-documents',
    title: 'Scan de Documents',
    description: 'Numérisation de documents',
    path: '/rendez-vous/scan-documents',
    category: 'Rendez-vous',
    icon: 'Scan',
    keywords: ['scan', 'numérisation', 'documents', 'scanner'],
    allowedRoles: [ROLES.ADMIN, ROLES.SECRETARY],
    isSubPage: true
  },
  {
    id: 'statistiques-realtime',
    title: 'Statistiques Temps Réel',
    description: 'Statistiques en temps réel',
    path: '/rendez-vous/statistiques-realtime',
    category: 'Rendez-vous',
    icon: 'TrendingUp',
    keywords: ['statistiques', 'temps réel', 'analytics', 'métriques'],
    allowedRoles: [ROLES.ADMIN],
    isSubPage: true
  },

  // CONSULTATIONS
  {
    id: 'consultations',
    title: 'Consultations',
    description: 'Gestion des consultations médicales',
    path: '/consultations',
    category: 'Consultations',
    icon: 'Stethoscope',
    keywords: ['consultations', 'examens', 'médical', 'diagnostic'],
    allowedRoles: [ROLES.DOCTOR],
    isMainPage: true
  },
  {
    id: 'introduction-patient',
    title: 'Introduction Patient',
    description: 'Introduction d\'un nouveau patient',
    path: '/introduction-patient',
    category: 'Consultations',
    icon: 'UserPlus',
    keywords: ['introduction', 'nouveau patient', 'accueil'],
    allowedRoles: [ROLES.SECRETARY],
    isSubPage: true
  },
  {
    id: 'fiche-identification',
    title: 'Fiche d\'Identification',
    description: 'Identification du patient',
    path: '/fiche-identification',
    category: 'Consultations',
    icon: 'IdCard',
    keywords: ['identification', 'fiche', 'identité', 'patient'],
    allowedRoles: [ROLES.SECRETARY],
    isSubPage: true
  },
  {
    id: 'examen-medical',
    title: 'Examen Médical',
    description: 'Réalisation d\'un examen médical',
    path: '/examen-medical',
    category: 'Consultations',
    icon: 'Stethoscope',
    keywords: ['examen médical', 'consultation', 'diagnostic', 'médecin'],
    allowedRoles: [ROLES.DOCTOR],
    isSubPage: true
  },
  {
    id: 'prescription',
    title: 'Prescription',
    description: 'Rédaction d\'ordonnances',
    path: '/prescription',
    category: 'Consultations',
    icon: 'FileText',
    keywords: ['prescription', 'ordonnance', 'médicaments', 'traitement'],
    allowedRoles: [ROLES.DOCTOR],
    isSubPage: true
  },
  {
    id: 'prescriptions',
    title: 'Mes Prescriptions',
    description: 'Liste des prescriptions du médecin',
    path: '/prescriptions',
    category: 'Consultations',
    icon: 'FileText',
    keywords: ['prescriptions', 'ordonnances', 'historique', 'médicaments'],
    allowedRoles: [ROLES.DOCTOR],
    isSubPage: true
  },
  {
    id: 'actes',
    title: 'Actes Médicaux',
    description: 'Gestion des actes médicaux',
    path: '/actes',
    category: 'Consultations',
    icon: 'Activity',
    keywords: ['actes médicaux', 'procédures', 'interventions'],
    allowedRoles: [ROLES.DOCTOR],
    isSubPage: true
  },
  {
    id: 'bcds',
    title: 'BCDS',
    description: 'Gestion des BCDS',
    path: '/bcds',
    category: 'Consultations',
    icon: 'FileCheck',
    keywords: ['bcds', 'certificats', 'documents'],
    allowedRoles: [ROLES.DOCTOR],
    isSubPage: true
  },
  {
    id: 'medical-records',
    title: 'Dossiers Médicaux',
    description: 'Consultation des dossiers médicaux',
    path: '/medical-records',
    category: 'Consultations',
    icon: 'FolderOpen',
    keywords: ['dossiers médicaux', 'historique', 'antécédents'],
    allowedRoles: [ROLES.DOCTOR],
    isSubPage: true
  },

  // FACTURATION
  {
    id: 'facturation-actes',
    title: 'Facturation Actes',
    description: 'Facturation des actes médicaux',
    path: '/facturation/actes',
    category: 'Facturation',
    icon: 'Receipt',
    keywords: ['facturation', 'actes', 'tarifs', 'paiement'],
    allowedRoles: [ROLES.SECRETARY],
    isMainPage: true
  },
  {
    id: 'facturation-examens',
    title: 'Facturation Examens',
    description: 'Facturation des examens',
    path: '/facturation/examens',
    category: 'Facturation',
    icon: 'FileText',
    keywords: ['facturation', 'examens', 'analyses', 'tarifs'],
    allowedRoles: [ROLES.SECRETARY],
    isSubPage: true
  },
  {
    id: 'facturation-factures',
    title: 'Factures',
    description: 'Gestion des factures',
    path: '/facturation/factures',
    category: 'Facturation',
    icon: 'FileText',
    keywords: ['factures', 'facturation', 'paiements', 'comptabilité'],
    allowedRoles: [ROLES.SECRETARY],
    isSubPage: true
  },
  {
    id: 'facturation-labo',
    title: 'Laboratoire',
    description: 'Facturation laboratoire',
    path: '/facturation/labo',
    category: 'Facturation',
    icon: 'TestTube',
    keywords: ['laboratoire', 'analyses', 'labo', 'examens'],
    allowedRoles: [ROLES.SECRETARY],
    isSubPage: true
  },
  {
    id: 'facturation-pharmacie',
    title: 'Pharmacie',
    description: 'Facturation pharmacie',
    path: '/facturation/pharmacie',
    category: 'Facturation',
    icon: 'Pill',
    keywords: ['pharmacie', 'médicaments', 'ordonnances'],
    allowedRoles: [ROLES.SECRETARY],
    isSubPage: true
  },
  {
    id: 'facturation-divers',
    title: 'Divers',
    description: 'Facturation divers',
    path: '/facturation/divers',
    category: 'Facturation',
    icon: 'MoreHorizontal',
    keywords: ['divers', 'autres', 'facturation'],
    allowedRoles: [ROLES.SECRETARY],
    isSubPage: true
  },

  // PARAMÉTRAGE
  {
    id: 'parametrage-medecins',
    title: 'Médecins',
    description: 'Gestion des médecins',
    path: '/parametrage/medecins',
    category: 'Paramétrage',
    icon: 'UserCheck',
    keywords: ['médecins', 'docteurs', 'praticiens', 'personnel médical'],
    allowedRoles: [ROLES.ADMIN],
    isMainPage: true
  },
  {
    id: 'parametrage-specialites',
    title: 'Spécialités',
    description: 'Gestion des spécialités médicales',
    path: '/parametrage/specialites',
    category: 'Paramétrage',
    icon: 'Stethoscope',
    keywords: ['spécialités', 'disciplines', 'médical'],
    allowedRoles: [ROLES.ADMIN],
    isSubPage: true
  },
  {
    id: 'parametrage-actes-tarifs',
    title: 'Annuaire Actes & Tarifs',
    description: 'Gestion des actes et tarifs',
    path: '/parametrage/annuaire-actes-tarifs',
    category: 'Paramétrage',
    icon: 'Coins',
    keywords: ['actes', 'tarifs', 'prix', 'nomenclature'],
    allowedRoles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.SECRETARY],
    isSubPage: true
  },
  {
    id: 'parametrage-examens-diagnostic',
    title: 'Examens Diagnostic',
    description: 'Gestion des examens diagnostiques',
    path: '/parametrage/examens-diagnostic',
    category: 'Paramétrage',
    icon: 'Search',
    keywords: ['examens', 'diagnostic', 'analyses', 'tests'],
    allowedRoles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.SECRETARY],
    isSubPage: true
  },
  {
    id: 'parametrage-maladies',
    title: 'Liste des Maladies',
    description: 'Gestion de la liste des maladies',
    path: '/parametrage/liste-maladies',
    category: 'Paramétrage',
    icon: 'AlertTriangle',
    keywords: ['maladies', 'pathologies', 'cim', 'diagnostic'],
    allowedRoles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.SECRETARY],
    isSubPage: true
  },
  {
    id: 'parametrage-vaccins',
    title: 'Liste des Vaccins',
    description: 'Gestion de la liste des vaccins',
    path: '/parametrage/liste-vaccins',
    category: 'Paramétrage',
    icon: 'Shield',
    keywords: ['vaccins', 'vaccination', 'immunisation', 'prévention'],
    allowedRoles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.SECRETARY],
    isSubPage: true
  },
  {
    id: 'parametrage-constantes',
    title: 'Constantes',
    description: 'Gestion des constantes vitales',
    path: '/parametrage/constantes',
    category: 'Paramétrage',
    icon: 'Activity',
    keywords: ['constantes', 'vitales', 'tension', 'température', 'pouls'],
    allowedRoles: [ROLES.ADMIN],
    isSubPage: true
  },
  {
    id: 'parametrage-signes-cliniques',
    title: 'Signes Cliniques',
    description: 'Gestion des signes cliniques',
    path: '/parametrage/signes-cliniques',
    category: 'Paramétrage',
    icon: 'Eye',
    keywords: ['signes cliniques', 'symptômes', 'observations'],
    allowedRoles: [ROLES.ADMIN],
    isSubPage: true
  },
  {
    id: 'parametrage-appareils',
    title: 'Appareils',
    description: 'Gestion des appareils médicaux',
    path: '/parametrage/appareils',
    category: 'Paramétrage',
    icon: 'Monitor',
    keywords: ['appareils', 'équipements', 'matériel médical'],
    allowedRoles: [ROLES.ADMIN],
    isSubPage: true
  },
  {
    id: 'parametrage-diagnostics',
    title: 'Diagnostics',
    description: 'Gestion des diagnostics',
    path: '/parametrage/diagnostics',
    category: 'Paramétrage',
    icon: 'FileSearch',
    keywords: ['diagnostics', 'conclusions', 'résultats'],
    allowedRoles: [ROLES.ADMIN],
    isSubPage: true
  },
  {
    id: 'parametrage-antecedents',
    title: 'Antécédents',
    description: 'Gestion des antécédents médicaux',
    path: '/parametrage/antecedents',
    category: 'Paramétrage',
    icon: 'History',
    keywords: ['antécédents', 'historique', 'médical', 'passé'],
    allowedRoles: [ROLES.ADMIN],
    isSubPage: true
  },
  {
    id: 'parametrage-medicaments',
    title: 'Médicaments',
    description: 'Gestion des médicaments',
    path: '/parametrage/medicaments',
    category: 'Paramétrage',
    icon: 'Pill',
    keywords: ['médicaments', 'pharmacie', 'traitements', 'dci'],
    allowedRoles: [ROLES.ADMIN, ROLES.DOCTOR],
    isSubPage: true
  },
  {
    id: 'parametrage-elements-synthese',
    title: 'Éléments de Synthèse',
    description: 'Gestion des éléments de synthèse',
    path: '/parametrage/elements-synthese',
    category: 'Paramétrage',
    icon: 'FileText',
    keywords: ['synthèse', 'résumé', 'éléments', 'conclusions'],
    allowedRoles: [ROLES.ADMIN],
    isSubPage: true
  },
  {
    id: 'parametrage-types-actes',
    title: 'Types d\'Actes',
    description: 'Gestion des types d\'actes',
    path: '/parametrage/types-actes',
    category: 'Paramétrage',
    icon: 'List',
    keywords: ['types actes', 'catégories', 'classification'],
    allowedRoles: [ROLES.ADMIN],
    isSubPage: true
  },
  {
    id: 'parametrage-assurances',
    title: 'Assurances',
    description: 'Gestion des assurances',
    path: '/parametrage/assurances',
    category: 'Paramétrage',
    icon: 'Shield',
    keywords: ['assurances', 'mutuelles', 'couverture', 'tiers payant'],
    allowedRoles: [ROLES.ADMIN],
    isSubPage: true
  },

  // ADMINISTRATION
  {
    id: 'administration-utilisateurs',
    title: 'Gestion des Utilisateurs',
    description: 'Administration des utilisateurs',
    path: '/administration/gestion-utilisateurs',
    category: 'Administration',
    icon: 'Users',
    keywords: ['utilisateurs', 'comptes', 'administration', 'gestion'],
    allowedRoles: [ROLES.ADMIN],
    isMainPage: true
  },
  {
    id: 'administration-canal-provenance',
    title: 'Canal de Provenance',
    description: 'Gestion des canaux de provenance',
    path: '/administration/canal-provenance',
    category: 'Administration',
    icon: 'Route',
    keywords: ['canal', 'provenance', 'origine', 'source'],
    allowedRoles: [ROLES.ADMIN],
    isSubPage: true
  },
  {
    id: 'administration-professions',
    title: 'Professions',
    description: 'Gestion des professions',
    path: '/administration/professions',
    category: 'Administration',
    icon: 'Briefcase',
    keywords: ['professions', 'métiers', 'emplois'],
    allowedRoles: [ROLES.ADMIN],
    isSubPage: true
  },
  {
    id: 'administration-periodes',
    title: 'Liste des Périodes',
    description: 'Gestion des périodes',
    path: '/administration/liste-periodes',
    category: 'Administration',
    icon: 'Calendar',
    keywords: ['périodes', 'temps', 'durées', 'planning'],
    allowedRoles: [ROLES.ADMIN],
    isSubPage: true
  },
  {
    id: 'administration-produits',
    title: 'Liste des Produits',
    description: 'Gestion des produits',
    path: '/administration/liste-produits',
    category: 'Administration',
    icon: 'Package',
    keywords: ['produits', 'articles', 'inventaire'],
    allowedRoles: [ROLES.ADMIN],
    isSubPage: true
  },
  {
    id: 'administration-posologie',
    title: 'Posologie Produits',
    description: 'Gestion de la posologie',
    path: '/administration/posologie-produits',
    category: 'Administration',
    icon: 'Pill',
    keywords: ['posologie', 'dosage', 'médicaments', 'prescription'],
    allowedRoles: [ROLES.ADMIN],
    isSubPage: true
  },

  // REPORTING & STATISTIQUES
  {
    id: 'database-check',
    title: 'Diagnostic Base de Données',
    description: 'Vérification et diagnostic de la base de données',
    path: '/database-check',
    category: 'Paramétrage',
    icon: 'Database',
    keywords: ['database', 'diagnostic', 'vérification', 'motifs', 'actes'],
    allowedRoles: [ROLES.ADMIN, ROLES.DOCTOR],
    isMainPage: true
  },
  {
    id: 'statistics',
    title: 'Statistiques',
    description: 'Statistiques du cabinet',
    path: '/statistics',
    category: 'Reporting',
    icon: 'BarChart3',
    keywords: ['statistiques', 'rapports', 'analytics', 'données'],
    allowedRoles: [ROLES.ADMIN],
    isMainPage: true
  },
  {
    id: 'reporting',
    title: 'Reporting',
    description: 'Rapports et analyses',
    path: '/reporting',
    category: 'Reporting',
    icon: 'FileBarChart',
    keywords: ['reporting', 'rapports', 'analyses', 'export'],
    allowedRoles: [ROLES.ADMIN],
    isMainPage: true
  },
  {
    id: 'historiques-archives',
    title: 'Historiques & Archives',
    description: 'Gestion des historiques et archives',
    path: '/historiques-archives',
    category: 'Reporting',
    icon: 'Archive',
    keywords: ['historiques', 'archives', 'sauvegarde', 'backup'],
    allowedRoles: [ROLES.ADMIN],
    isMainPage: true
  },

  // PARAMÈTRES
  {
    id: 'settings',
    title: 'Paramètres',
    description: 'Configuration du système',
    path: '/settings',
    category: 'Paramètres',
    icon: 'Settings',
    keywords: ['paramètres', 'configuration', 'réglages', 'options'],
    allowedRoles: [ROLES.ADMIN],
    isMainPage: true
  }
];

// Fonction pour rechercher dans les pages
export const searchPages = (query, userRole) => {
  if (!query || query.length < 2) return [];

  const normalizedQuery = query.toLowerCase().trim();
  
  return PAGES_CONFIG
    .filter(page => {
      // Vérifier les permissions
      if (!page.allowedRoles.includes(userRole)) return false;
      
      // Recherche dans le titre
      if (page.title.toLowerCase().includes(normalizedQuery)) return true;
      
      // Recherche dans la description
      if (page.description.toLowerCase().includes(normalizedQuery)) return true;
      
      // Recherche dans les mots-clés
      if (page.keywords.some(keyword => keyword.includes(normalizedQuery))) return true;
      
      // Recherche dans la catégorie
      if (page.category.toLowerCase().includes(normalizedQuery)) return true;
      
      return false;
    })
    .sort((a, b) => {
      // Prioriser les pages principales
      if (a.isMainPage && !b.isMainPage) return -1;
      if (!a.isMainPage && b.isMainPage) return 1;
      
      // Puis par pertinence (titre exact > description > mots-clés)
      const aTitle = a.title.toLowerCase().includes(normalizedQuery);
      const bTitle = b.title.toLowerCase().includes(normalizedQuery);
      
      if (aTitle && !bTitle) return -1;
      if (!aTitle && bTitle) return 1;
      
      return a.title.localeCompare(b.title);
    })
    .slice(0, 10); // Limiter à 10 résultats
};

// Fonction pour obtenir les suggestions populaires
export const getPopularSuggestions = (userRole) => {
  const popularPages = [
    'dashboard',
    'patients',
    'calendar',
    'waiting-queue',
    'consultations'
  ];
  
  return PAGES_CONFIG
    .filter(page => 
      popularPages.includes(page.id) && 
      page.allowedRoles.includes(userRole)
    )
    .slice(0, 5);
};

// Fonction pour obtenir les pages par catégorie
export const getPagesByCategory = (userRole) => {
  const categories = {};
  
  PAGES_CONFIG
    .filter(page => page.allowedRoles.includes(userRole))
    .forEach(page => {
      if (!categories[page.category]) {
        categories[page.category] = [];
      }
      categories[page.category].push(page);
    });
  
  return categories;
};
