import {
  CreditCard,
  Coins,
  AlertTriangle,
  BarChart3,
  FileText,
  Search,
  LayoutDashboard,
  Activity,
  FileSearch,
  Users,
} from 'lucide-react';
import { ROLES } from '../utils/permissions';

/**
 * Source unique de vérité pour le domaine caisse/comptabilité/caissier/facturation.
 * Consommée par :
 *  - src/App.jsx (allowedRoles des routes, via getAllowedRoles)
 *  - src/components/Sidebar.jsx (construction des menus, via getFinanceRoutesForRole)
 * pour éviter que les deux listes divergent (c'était la cause des liens sidebar
 * manquants pour admin/secrétaire malgré un accès route réel).
 */
export const FINANCE_ROUTES = [
  {
    path: '/caisse',
    label: 'Caisse',
    icon: CreditCard,
    roles: [ROLES.CAISSIER, ROLES.ADMIN],
    section: 'guichet',
  },
  {
    path: '/comptabilite/encaissement',
    label: 'Corrections comptables',
    icon: Coins,
    roles: [ROLES.ACCOUNTING, ROLES.ADMIN],
    section: 'guichet',
  },
  {
    path: '/comptabilite/impayes',
    label: 'Impayés & Relances',
    icon: AlertTriangle,
    roles: [ROLES.CAISSIER, ROLES.ACCOUNTING, ROLES.ADMIN],
    section: 'suivi',
  },
  {
    path: '/caissier/recapitulatif',
    label: 'Récapitulatif',
    icon: BarChart3,
    roles: [ROLES.CAISSIER, ROLES.ACCOUNTING, ROLES.ADMIN],
    section: 'suivi',
  },
  {
    path: '/caissier/arrete-mensuel',
    label: 'Arrêté mensuel',
    icon: FileText,
    roles: [ROLES.CAISSIER, ROLES.ACCOUNTING, ROLES.ADMIN],
    section: 'suivi',
  },
  {
    path: '/caissier/reversement-bancaire',
    label: 'Reversement bancaire',
    icon: CreditCard,
    roles: [ROLES.CAISSIER, ROLES.ADMIN],
    section: 'suivi',
  },
  {
    path: '/comptabilite/suivi-caissiers',
    label: 'Suivi des caissiers',
    icon: Users,
    roles: [ROLES.ACCOUNTING, ROLES.ADMIN],
    section: 'pilotage',
  },
  {
    path: '/accounting',
    label: 'Tableau de bord comptable',
    icon: LayoutDashboard,
    roles: [ROLES.ACCOUNTING, ROLES.ADMIN],
    section: 'pilotage',
  },
  {
    path: '/comptabilite/recherche-rapports',
    label: 'Recherche & Rapports',
    icon: Search,
    roles: [ROLES.ACCOUNTING, ROLES.ADMIN],
    section: 'pilotage',
  },
  {
    path: '/facturation/factures',
    label: 'Factures',
    icon: FileText,
    roles: [ROLES.SECRETARY, ROLES.ACCOUNTING, ROLES.ADMIN],
    section: 'facturation',
  },
  {
    path: '/facturation/actes',
    label: 'Actes',
    icon: Activity,
    roles: [ROLES.SECRETARY, ROLES.ACCOUNTING, ROLES.ADMIN],
    section: 'facturation',
  },
  {
    path: '/facturation/examens',
    label: 'Examens',
    icon: FileSearch,
    roles: [ROLES.SECRETARY, ROLES.ACCOUNTING, ROLES.ADMIN],
    section: 'facturation',
  },
];

/** Toutes les entrées visibles pour un rôle donné (clé ROLES.*, ex. ROLES.CAISSIER). */
export const getFinanceRoutesForRole = (roleKey) =>
  FINANCE_ROUTES.filter((route) => route.roles.includes(roleKey));

/** Rôles autorisés pour une route donnée — utilisé par App.jsx pour les `allowedRoles`. */
export const getAllowedRoles = (path) =>
  FINANCE_ROUTES.find((route) => route.path === path)?.roles || [];
