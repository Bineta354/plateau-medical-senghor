import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLayoutPreferences } from '../hooks/useLayoutPreferences';
import { ROLES } from '../utils/permissions';
import Sidebar from './Sidebar';
import Header from './Header';

const VALID_ROLES = [...new Set(Object.values(ROLES))];

const FULL_HEIGHT_ROUTES = ['/secretary-calendar', '/my-calendar'];

const Layout = ({ children }) => {
  const {
    sidebarWidth,
    isCollapsed,
    toggleCollapsed,
    startResize,
    isResizing,
  } = useLayoutPreferences();
  const { pathname } = useLocation();
  const { currentUser, userProfile, profileLoading } = useAuth();
  const isFullHeightRoute = FULL_HEIGHT_ROUTES.includes(pathname);

  // Si pas d'utilisateur connecté, ne pas afficher le layout
  if (!currentUser) {
    return null;
  }

  // Éviter un refus d'accès prématuré si le profil (et donc le rôle) n'est pas encore chargé
  if (profileLoading && !userProfile?.role) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-medical-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  // Vérifier si l'utilisateur a un rôle valide
  const userRole = userProfile?.role || currentUser.user_metadata?.role || currentUser.app_metadata?.role;
  if (!userRole || !VALID_ROLES.includes(userRole)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Accès non autorisé</h2>
          <p className="text-gray-600">Votre compte n'a pas les permissions nécessaires.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        width={sidebarWidth}
        isCollapsed={isCollapsed}
        onToggleCollapsed={toggleCollapsed}
      />
      {!isCollapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionner le menu"
          title="Glisser pour ajuster la largeur du menu"
          onMouseDown={startResize}
          className={`w-1.5 flex-shrink-0 cursor-col-resize transition-colors ${
            isResizing ? 'bg-blue-500' : 'bg-slate-200 hover:bg-blue-400'
          }`}
        />
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main
          className={
            isFullHeightRoute
              ? 'flex-1 min-h-0 overflow-hidden flex flex-col p-0'
              : 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 xs:p-3 sm:p-4 md:p-5 lg:p-6'
          }
        >
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;

