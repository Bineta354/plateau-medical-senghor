/**
 * Utilitaires de gestion des permissions pour le cabinet médical
 * Centralise la logique de vérification des rôles et permissions
 */

// Définition des rôles disponibles
// NOTE: 'caissier' est le rôle canonique. 'cashier' est un alias pour compatibilité.
export const ROLES = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  SECRETARY: 'secretary',
  ACCOUNTING: 'accounting',
  CASHIER: 'caissier',  // Normalisé vers 'caissier' (valeur canonique)
  CAISSIER: 'caissier'
};

// Helper: retourne true si le rôle est un rôle caissier (accepte les deux)
export const isCaissierRole = (role) => role === 'caissier' || role === 'cashier';

// Définition des permissions par rôle
export const PERMISSIONS = {
  // Permissions pour les secrétaires
  [ROLES.SECRETARY]: {
    canViewDashboard: true,
    canManageAppointments: true,
    canManagePatients: true,
    canViewConsultations: true,
    canManageBilling: true,
    canViewReports: true,
    canManageSettings: false, // Secrétaire ne peut pas modifier les paramètres
    canViewSettings: false, // Secrétaire ne doit pas accéder aux paramètres de spécialité
    canManageAdministration: false,
    canManageUsers: false,
    canManageSecurity: false
  },
  
  // Permissions pour les médecins
  [ROLES.DOCTOR]: {
    canViewDashboard: true,
    canManageAppointments: true,
    canManagePatients: true,
    canManageConsultations: true,
    canManageBilling: true,
    canViewReports: true,
    canManageSettings: true, // Médecin peut maintenant modifier les paramètres
    canManageAdministration: false,
    canManageUsers: false,
    canManageSecurity: false
  },
  
  // Permissions pour les caissiers
  [ROLES.CAISSIER]: {
    canViewDashboard: true,
    canManageAppointments: false,
    canManagePatients: false,
    canViewConsultations: true,
    canManageBilling: true,
    canViewReports: true,
    canManageSettings: false,
    canManageAdministration: false,
    canManageUsers: false,
    canManageSecurity: false
  },

  // Permissions pour les comptables
  [ROLES.ACCOUNTING]: {
    canViewDashboard: true,
    canManageAppointments: false,
    canManagePatients: false,
    canViewConsultations: true, // Consultation pour accès aux données financières
    canManageBilling: true,
    canViewReports: true,
    canManageSettings: false,
    canManageAdministration: false,
    canManageUsers: false,
    canManageSecurity: false
  },



  [ROLES.ADMIN]: {
    canViewDashboard: true,
    canManageAppointments: true,
    canManagePatients: true,
    canManageConsultations: true,
    canManageBilling: true,
    canViewReports: true,
    canManageSettings: true,
    canManageAdministration: true,
    canManageUsers: true,
    canManageSecurity: true
  }
};

/**
 * Vérifie si un utilisateur a une permission spécifique
 * @param {string} userRole - Le rôle de l'utilisateur
 * @param {string} permission - La permission à vérifier
 * @returns {boolean} True si l'utilisateur a la permission
 */
export const hasPermission = (userRole, permission) => {
  if (!userRole || !permission) return false;
  
  // Normaliser cashier → caissier pour la recherche
  const normalizedRole = userRole === 'cashier' ? 'caissier' : userRole;
  const rolePermissions = PERMISSIONS[normalizedRole];
  if (!rolePermissions) return false;
  
  return rolePermissions[permission] === true;
};

/**
 * Vérifie si un utilisateur a l'un des rôles spécifiés
 * @param {string} userRole - Le rôle de l'utilisateur
 * @param {string|Array} allowedRoles - Rôle(s) autorisé(s)
 * @returns {boolean} True si l'utilisateur a l'un des rôles
 */
export const hasAnyRole = (userRole, allowedRoles) => {
  if (!userRole || !allowedRoles) return false;
  
  // Normaliser cashier → caissier
  const normalizedRole = userRole === 'cashier' ? 'caissier' : userRole;
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return roles.includes(normalizedRole) || roles.includes(userRole);
};

/**
 * Obtient le nom d'affichage du rôle
 * @param {string} role - Le rôle
 * @returns {string} Le nom d'affichage du rôle
 */
export const getRoleDisplayName = (role) => {
  const normalizedRole = role === 'cashier' ? 'caissier' : role;
  const roleNames = {
    [ROLES.ADMIN]: 'Administrateur',
    [ROLES.DOCTOR]: 'Médecin',
    [ROLES.SECRETARY]: 'Secrétaire',
    [ROLES.ACCOUNTING]: 'Comptabilité',
    [ROLES.CAISSIER]: 'Caissier'
  };
  
  return roleNames[normalizedRole] || 'Utilisateur';
};

/**
 * Obtient la couleur associée au rôle
 * @param {string} role - Le rôle
 * @returns {string} La classe CSS de couleur
 */
export const getRoleColor = (role) => {
  const normalizedRole = role === 'cashier' ? 'caissier' : role;
  const roleColors = {
    [ROLES.ADMIN]: 'text-red-500',
    [ROLES.DOCTOR]: 'text-blue-500',
    [ROLES.SECRETARY]: 'text-green-500',
    [ROLES.ACCOUNTING]: 'text-purple-500',
    [ROLES.CAISSIER]: 'text-orange-500'
  };
  
  return roleColors[normalizedRole] || 'text-gray-500';
};

/**
 * Obtient l'icône associée au rôle
 * @param {string} role - Le rôle
 * @returns {string} Le nom de l'icône Lucide
 */
export const getRoleIcon = (role) => {
  const normalizedRole = role === 'cashier' ? 'caissier' : role;
  const roleIcons = {
    [ROLES.ADMIN]: 'Shield',
    [ROLES.DOCTOR]: 'Stethoscope',
    [ROLES.SECRETARY]: 'Users',
    [ROLES.ACCOUNTING]: 'Award',
    [ROLES.CAISSIER]: 'Calculator'
  };
  
  return roleIcons[normalizedRole] || 'User';
};

