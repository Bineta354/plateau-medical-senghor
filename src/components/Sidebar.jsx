import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Clock, 
  FileText,
  Coins,
  BarChart3, 
  Settings, 
  UserCheck, 
  Building2, 
  Shield,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Archive,
  Activity,
  Search,
  Calculator,
  UserPlus,
  Stethoscope,
  ClipboardList,
  CalendarDays,
  Clock3,
  Cog,
  Award,
  CalendarPlus,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Database,
  CheckCircle
} from 'lucide-react';
import { usePersonnalisation } from '../contexts/PersonnalisationContext';
import { useAuth } from '../contexts/AuthContext';
import { ROLES, getRoleDisplayName, getRoleColor } from '../utils/permissions';
import { getFinanceRoutesForRole } from '../config/financeNavigation';

/** Convertit les entrées FINANCE_ROUTES d'une section en items de menu sidebar. */
const financeSection = (roleKey, section, sectionLabel, sectionIcon) => {
  const items = getFinanceRoutesForRole(roleKey)
    .filter((r) => r.section === section)
    .map((r) => ({ name: r.label, icon: r.icon, path: r.path }));
  return items.length ? [{ name: sectionLabel, icon: sectionIcon, items }] : [];
};

const Sidebar = ({
  width = 256,
  isCollapsed: isCollapsedProp,
  onToggleCollapsed,
}) => {
  const [isCollapsedInternal, setIsCollapsedInternal] = useState(false);
  const isCollapsed =
    typeof isCollapsedProp === 'boolean' ? isCollapsedProp : isCollapsedInternal;
  const toggleCollapsed =
    onToggleCollapsed ||
    (() => setIsCollapsedInternal((prev) => !prev));
  const [expandedModules, setExpandedModules] = useState({});
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, userProfile, logout, hasRole } = useAuth();
  const { settings } = usePersonnalisation();

  const toggleModule = (moduleName) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleName]: !prev[moduleName]
    }));
  };

  const navigationItems = {
    secretaire: [
      {
        name: 'PRINCIPAL',
        icon: LayoutDashboard,
        items: [
          { name: 'Tableau de bord', icon: LayoutDashboard, path: '/secretary' },
          { name: 'Calendrier', icon: Calendar, path: '/secretary-calendar' },
        ]
      },
      {
        name: 'PATIENTS',
        icon: Users,
        items: [
          { name: 'Liste des Patients', icon: Users, path: '/patients' },
        ]
      },
      {
        name: 'RENDEZ-VOUS',
        icon: CalendarDays,
        items: [
          { name: 'Prise de Rendez-vous', icon: CalendarPlus, path: '/rendez-vous/prise-rendez-vous' },
          { name: 'Salle d\'attente', icon: Clock3, path: '/salle-attente' },
          { name: 'Recherche Rendez-vous', icon: Search, path: '/appointments/recherche' },
          { name: 'Rappels SMS', icon: MessageSquare, path: '/rendez-vous/rappels-sms' },
        ]
      },
      {
        name: 'CONSULTATION',
        icon: Stethoscope,
        items: [
          { name: 'Consultations Terminées', icon: CheckCircle, path: '/consultations-terminees' },
        ]
      },
      ...financeSection(ROLES.SECRETARY, 'facturation', 'FACTURATION', Coins),
    ],
    caissier: [
      ...financeSection(ROLES.CAISSIER, 'guichet', 'PRINCIPAL', LayoutDashboard),
      ...financeSection(ROLES.CAISSIER, 'suivi', 'SUIVI & RELANCES', Calculator),
    ],
    accounting: [
      ...financeSection(ROLES.ACCOUNTING, 'pilotage', 'PRINCIPAL', LayoutDashboard),
      ...financeSection(ROLES.ACCOUNTING, 'guichet', 'GUICHET & CORRECTIONS', Coins),
      ...financeSection(ROLES.ACCOUNTING, 'suivi', 'SUIVI & IMPAYÉS', BarChart3),
      ...financeSection(ROLES.ACCOUNTING, 'facturation', 'FACTURATION', FileText),
    ],
    medecin: [
      {
        name: 'PRINCIPAL',
        icon: LayoutDashboard,
        items: [
          { name: 'Tableau de bord', icon: LayoutDashboard, path: '/dashboard' },
          { name: 'Mes Rendez-vous', icon: Calendar, path: '/my-calendar' },
        ]
      },
      {
        name: 'PATIENTS',
        icon: Users,
        items: [
          { name: 'Patients', icon: Users, path: '/patients' },
        ]
      },
      {
        name: 'CONSULTATION',
        icon: Stethoscope,
        items: [
          { name: 'Consultations', icon: Stethoscope, path: '/consultations' },
          { name: 'Actes', icon: ClipboardList, path: '/actes' },
          { name: 'BCDS', icon: FileText, path: '/bcds' },
        ]
      },
      {
        name: 'PARAMÉTRAGE',
        icon: Settings,
        items: [
          { name: 'États Dentaires', icon: Activity, path: '/parametrage/etats-dentaires' },
        ]
      }
    ],
    admin: [
      {
        name: 'PRINCIPAL',
        icon: LayoutDashboard,
        items: [
          { name: 'Tableau de bord', icon: LayoutDashboard, path: '/dashboard' },
          { name: 'Calendrier', icon: Calendar, path: '/appointments' },
          { name: 'Recherche Rendez-vous', icon: Search, path: '/appointments/recherche' },
        ]
      },
      ...financeSection(ROLES.ADMIN, 'guichet', 'CAISSE & CORRECTIONS', Coins),
      ...financeSection(ROLES.ADMIN, 'suivi', 'SUIVI & IMPAYÉS', BarChart3),
      ...financeSection(ROLES.ADMIN, 'pilotage', 'COMPTABILITÉ', Calculator),
      ...financeSection(ROLES.ADMIN, 'facturation', 'FACTURATION', FileText),
      {
        name: 'GESTION',
        icon: Users,
        items: [
          { name: 'Utilisateurs', icon: Users, path: '/administration/gestion-utilisateurs' },
          { name: 'Médecins', icon: Stethoscope, path: '/administration/gestion-medecins' },
          { name: 'Secrétaires', icon: UserCheck, path: '/administration/gestion-secretaires' },
          { name: 'Comptables', icon: Calculator, path: '/administration/gestion-comptables' },
          { name: 'Caissiers', icon: Calculator, path: '/administration/gestion-caissiers' },
          { name: 'Administrateurs', icon: Shield, path: '/administration/gestion-admins' },
          { name: 'Patients', icon: Users, path: '/patients' },
        ]
      },
      {
        name: 'PARAMÉTRAGE',
        icon: Cog,
        items: [
          { name: 'Paramétrage', icon: Settings, path: '/parametrage' },
          { name: 'Spécialités', icon: Award, path: '/parametrage/specialites' },
          { name: 'Personnalisation', icon: Sparkles, path: '/administration/personnalisation' },
          { name: 'États Dentaires', icon: Activity, path: '/parametrage/etats-dentaires' },
        ]
      },
      {
        name: 'SÉCURITÉ',
        icon: Shield,
        items: [
          { name: 'Sécurité', icon: Shield, path: '/security' },
        ]
      },
      {
        name: 'REPORTING',
        icon: BarChart3,
        items: [
          { name: 'Statistiques', icon: BarChart3, path: '/statistics' },
          { name: 'Historiques & Archives', icon: Archive, path: '/historiques-archives' },
        ]
      }
    ]
  };

  const getCurrentRole = () => {
    if (hasRole(ROLES.ADMIN)) return 'admin';
    if (hasRole(ROLES.DOCTOR)) return 'medecin';
    if (hasRole(ROLES.SECRETARY)) return 'secretaire';
    if (hasRole(ROLES.CAISSIER)) return 'caissier';
    if (hasRole(ROLES.ACCOUNTING)) return 'accounting';
    return null; // Pas de rôle par défaut pour la sécurité
  };

  const currentRole = getCurrentRole();
  
  // Si pas de rôle valide, ne pas afficher le sidebar
  if (!currentRole) {
    console.warn('⚠️ Aucun rôle valide trouvé pour l\'utilisateur:', currentUser?.email);
    return null;
  }
  
  const modules = navigationItems[currentRole] || [];
  
  // Log pour debug des permissions (seulement une fois par changement de rôle ou de modules)
  const userRole = currentUser?.profile?.role || userProfile?.role || currentUser?.user_metadata?.role || currentUser?.app_metadata?.role;
  const roleDisplayName = userRole ? getRoleDisplayName(userRole) : 'non défini';
  const lastLoggedRoleRef = useRef(null);
  const lastLoggedModulesRef = useRef(null);
  
  useEffect(() => {
    const modulesKey = modules.map(m => m.name).join(',');
    if (lastLoggedRoleRef.current !== userRole || lastLoggedModulesRef.current !== modulesKey) {
      console.log(`🔐 Utilisateur ${currentUser?.email} connecté avec le rôle: ${roleDisplayName} (${userRole || 'non défini'})`);
      console.log(`📋 Modules disponibles pour ${currentRole}:`, modules.map(m => m.name));
      lastLoggedRoleRef.current = userRole;
      lastLoggedModulesRef.current = modulesKey;
    }
  }, [userRole, currentRole, currentUser?.email, roleDisplayName, modules]);

  const isActive = (path) => {
    return location.pathname === path;
  };

  // Même logique que le menu Profil (Header.jsx) : naviguer d'abord, puis
  // déconnecter avec un léger délai pour laisser la navigation se faire.
  const handleLogout = async () => {
    try {
      const tenantId = userProfile?.tenant_id;
      const isAdmin = userProfile?.role === 'admin';

      if (isAdmin || !tenantId) {
        navigate('/login');
      } else {
        navigate('/cabinet-welcome-public/' + tenantId);
      }

      setTimeout(async () => {
        await logout();
      }, 100);
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  return (
    <motion.div
      className="backdrop-blur-apple border-r border-white/10 shadow-apple-lg h-screen flex flex-col flex-shrink-0 transition-[width] duration-200"
      style={{
        width: isCollapsed ? 64 : width,
        minWidth: isCollapsed ? 64 : width,
        maxWidth: isCollapsed ? 64 : width,
        background: settings.couleur_sidebar_fond || 'linear-gradient(to bottom, #1e293b, #0f172a)',
        color: settings.couleur_sidebar_texte || '#F1F5F9'
      }}
      initial={{ x: -100 }}
      animate={{ x: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        {!isCollapsed && (
          <motion.h2 
            className="text-xl font-bold"
            style={{ color: settings.couleur_sidebar_texte || '#ffffff' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {settings.titre_sidebar || 'Cabinet Médical'}
          </motion.h2>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
          title={isCollapsed ? 'Agrandir le menu' : 'Réduire le menu'}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        <AnimatePresence>
          {modules.map((module, moduleIndex) => (
            <motion.div
              key={module.name}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: moduleIndex * 0.1 }}
              className="space-y-1"
            >
              {/* Module Header */}
             <button
                 onClick={() => toggleModule(module.name)}
                 className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${
                   expandedModules[module.name] 
                     ? 'bg-gradient-to-r from-medical-primary to-medical-secondary text-white shadow-medical' 
                     : 'hover:bg-white/10'
                 }`}
                 style={!expandedModules[module.name] ? { color: settings.couleur_sidebar_texte ? `${settings.couleur_sidebar_texte}cc` : '#cbd5e1' } : {}}
               >
                <div className="flex items-center space-x-3">
                  <module.icon size={20} />
                  {!isCollapsed && (
                    <span className="font-medium text-sm">{module.name}</span>
                  )}
                </div>
                {!isCollapsed && (
                  <motion.div
                    animate={{ rotate: expandedModules[module.name] ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {expandedModules[module.name] ? (
                      <ChevronUp size={16} />
                    ) : (
                      <ChevronDown size={16} />
                    )}
                  </motion.div>
                )}
              </button>

              {/* Module Items */}
              <AnimatePresence>
                {expandedModules[module.name] && !isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="ml-6 space-y-1"
                  >
                    {module.items.map((item, itemIndex) => (
                      <motion.div
                        key={`${module.name}-${item.name}-${item.path}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: itemIndex * 0.05 }}
                      >
                                                 <Link
                           to={item.path}
                           className={`flex items-center space-x-3 p-2 rounded-lg transition-all duration-200 text-sm ${
                             isActive(item.path)
                               ? 'bg-gradient-to-r from-medical-primary/20 to-medical-secondary/20 border-l-2 border-medical-primary'
                               : 'hover:bg-white/10'
                           }`}
                           style={isActive(item.path) ? { color: '#ffffff' } : { color: settings.couleur_sidebar_texte ? `${settings.couleur_sidebar_texte}b3` : '#cbd5e1' }}
                         >
                          <item.icon size={16} />
                          <span>{item.name}</span>
                        </Link>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center space-x-3 mb-4">
          {userProfile?.photo_url ? (
            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-medical-primary flex-shrink-0 relative">
              <img
                src={userProfile.photo_url}
                alt={userProfile.prenom && userProfile.nom ? `${userProfile.prenom} ${userProfile.nom}` : currentUser?.email || 'Utilisateur'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback vers initiales si l'image ne charge pas
                  e.target.style.display = 'none';
                  const fallback = e.target.parentElement.querySelector('.photo-fallback');
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="w-8 h-8 bg-gradient-to-r from-medical-primary to-medical-secondary rounded-full flex items-center justify-center photo-fallback hidden absolute inset-0">
                <span className="text-white text-sm font-medium">
                  {userProfile.prenom && userProfile.nom 
                    ? `${userProfile.prenom.charAt(0)}${userProfile.nom.charAt(0)}`.toUpperCase()
                    : currentUser?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 bg-gradient-to-r from-medical-primary to-medical-secondary rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {userProfile?.prenom && userProfile?.nom 
                  ? `${userProfile.prenom.charAt(0)}${userProfile.nom.charAt(0)}`.toUpperCase()
                  : currentUser?.email?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
          )}
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: settings.couleur_sidebar_texte || '#ffffff' }}>
                {userProfile?.prenom && userProfile?.nom 
                  ? `${userProfile.prenom} ${userProfile.nom}`
                  : currentUser?.email || 'Utilisateur'}
              </p>
              <p className={`text-xs capitalize ${getRoleColor(userRole)}`}>
                {getRoleDisplayName(userRole)}
              </p>
            </div>
          )}
        </div>
        
        <button
          onClick={handleLogout}
          className={`w-full flex items-center space-x-3 p-2 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-colors ${
            isCollapsed ? 'justify-center' : ''
          }`}
          style={{ color: settings.couleur_sidebar_texte ? `${settings.couleur_sidebar_texte}cc` : '#cbd5e1' }}
        >
          <LogOut size={20} />
          {!isCollapsed && <span className="text-sm">Déconnexion</span>}
        </button>
      </div>
    </motion.div>
  );
};

export default Sidebar;

