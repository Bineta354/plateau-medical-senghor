import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  Search, 
  User, 
  Settings,
  AlertTriangle,
  CheckCircle,
  Phone,
  UserCheck,
  ChevronDown,
  LogOut,
  Stethoscope,
  Command,
  Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { usePersonnalisation } from '../contexts/PersonnalisationContext';
import { getRoleDisplayName } from '../utils/permissions';
import useUserProfile from '../hooks/useUserProfile';
import {
  getDisplayNotifications,
  markAsRead,
  markAllAsRead,
  subscribeToNotifications,
  unsubscribeFromNotifications,
  isNotificationForUser,
} from '../lib/notifications';
import { unifiedNotificationService } from '../services/unifiedNotificationService';
import GlobalSearch from './GlobalSearch';

// Fonction pour jouer le son de notification
const playNotificationSound = () => {
  try {
    // Vérifier si les notifications sont activées
    const notificationsEnabled = localStorage.getItem('notifications_enabled') !== 'false';
    if (!notificationsEnabled) {
      return;
    }

    // Vérifier si le son est activé (par défaut activé si non défini)
    const soundEnabledSetting = localStorage.getItem('notification_sound_enabled');
    const soundEnabled = soundEnabledSetting === null || soundEnabledSetting === 'true';
    if (!soundEnabled) {
      return;
    }

    // Créer un contexte audio
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Séquence de notes pour notification médicale
    const notes = [
      { frequency: 800, duration: 200 },
      { frequency: 1000, duration: 200 },
      { frequency: 800, duration: 300 }
    ];
    
    let currentTime = audioContext.currentTime;
    
    notes.forEach((note) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = note.frequency;
      oscillator.type = 'sine';
      
      // Envelope pour un son plus doux
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + note.duration / 1000);
      
      oscillator.start(currentTime);
      oscillator.stop(currentTime + note.duration / 1000);
      
      currentTime += note.duration / 1000;
    });
  } catch (error) {
    console.log('Erreur lors de la lecture du son de notification:', error);
  }
};

const Header = () => {
  const { currentUser, logout, hasRole } = useAuth();
  const { profile: userProfile, isLoaded: profileLoaded } = useUserProfile();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cabinetName, setCabinetName] = useState('Cabinet Médical');
  const location = useLocation();
  const navigate = useNavigate();
  const reloadNotificationsTimeoutRef = useRef(null);
  const lastToastNotificationIdRef = useRef(null);
  const notificationsPanelRef = useRef(null);
  const hasMarkedAllAsReadRef = useRef(false);

  const loadNotifications = useCallback(async () => {
    try {
      if (!userProfile?.id || !userProfile?.role) {
        return;
      }

      const displayNotifications = await getDisplayNotifications(
        userProfile.id,
        userProfile.role,
        10
      );
      const list = displayNotifications || [];
      const newUnreadCount = list.filter((n) => !n.lu).length;

      setNotifications((prev) => {
        if (newUnreadCount > prev.filter((n) => !n.lu).length && prev.length > 0) {
          playNotificationSound();
        }
        return list;
      });
      setUnreadCount(newUnreadCount);
    } catch (error) {
      console.error('❌ [Header] Erreur lors du chargement des notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [userProfile?.id, userProfile?.role]);

  const scheduleLoadNotifications = useCallback(() => {
    if (reloadNotificationsTimeoutRef.current) {
      clearTimeout(reloadNotificationsTimeoutRef.current);
    }
    reloadNotificationsTimeoutRef.current = setTimeout(() => {
      loadNotifications();
    }, 400);
  }, [loadNotifications]);

  const [cabinetLogo, setCabinetLogo] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
  /*const loadCabinetName = async () => {
    if (!userProfile?.tenant_id) return;


    const { data, error } = await supabase
      .from('tenants')
      .select('name, logo_url')
      .eq('id', userProfile.tenant_id)
      .single();

    if (!error && data?.name) {
      setCabinetName(data.name);
    }
  };*/

  const loadCabinet = async () => {
    if (!userProfile?.tenant_id) return;

    const { data, error } = await supabase
      .from('tenants')
      .select('name, logo_url')
      .eq('id', userProfile.tenant_id)
      .single();

    if (error) {
      console.error('Erreur chargement cabinet:', error);
      return;
    }

    if (data) {
      setCabinetName(data.name || 'Cabinet Médical');
      setCabinetLogo(data.logo_url || null);
    }
  };

    loadCabinet();
  }, [userProfile?.tenant_id]);

  const setupNotificationSubscription = useCallback(() => {
    if (!userProfile?.id || !userProfile?.role) {
      return null;
    }

    return subscribeToNotifications(userProfile.id, userProfile.role, (payload) => {
      const record = payload.new || payload.old;
      if (record && !isNotificationForUser(record, userProfile.id, userProfile.role)) {
        return;
      }

      if (payload.eventType === 'INSERT' && payload.new) {
        if (lastToastNotificationIdRef.current !== payload.new.id) {
          lastToastNotificationIdRef.current = payload.new.id;
          playNotificationSound();

          if (
            userProfile.role === 'secretary' &&
            (payload.new.type_notification === 'consultation_ended' ||
              payload.new.type_notification === 'consultation_terminee')
          ) {
            const titre = payload.new.titre || 'Consultation terminée';
            const message =
              payload.new.message ||
              'Une consultation a été terminée. Cliquez pour compléter la facturation.';

            unifiedNotificationService.success(
              (
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-900">{titre}</div>
                    <div className="text-xs text-gray-600 mt-1">{message}</div>
                  </div>
                </div>
              ),
              {
                autoClose: 8000,
                toastId: `notif-${payload.new.id}`,
              }
            );
          }
        }
      }

      scheduleLoadNotifications();
    });
  }, [userProfile?.id, userProfile?.role, scheduleLoadNotifications]);

  useEffect(() => {
    const notificationsEnabled = localStorage.getItem('notifications_enabled') !== 'false';

    if (currentUser?.id && userProfile?.id && userProfile?.role && notificationsEnabled) {
      loadNotifications();
      const channel = setupNotificationSubscription();

      return () => {
        if (reloadNotificationsTimeoutRef.current) {
          clearTimeout(reloadNotificationsTimeoutRef.current);
        }
        if (channel) {
          unsubscribeFromNotifications(channel);
        }
      };
    }
  }, [
    currentUser?.id,
    userProfile?.id,
    userProfile?.role,
    loadNotifications,
    setupNotificationSubscription,
  ]);

  const handleNotificationClick = async (notification) => {
    try {
      console.log('🔔 [Header] Notification cliquée:', notification);
      console.log('🔔 [Header] Type de notification:', notification.type_notification);
      
      if (!notification.lu) {
        const readAt = new Date().toISOString();
        await markAsRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, lu: true, lu_at: readAt } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      // Gérer la redirection selon le type de notification
      console.log('🔔 [Header] Vérification du type pour redirection...');
      if (notification.type_notification === 'doctor_request' || notification.type_notification === 'demande_autorisation') {
        console.log('✅ [Header] Type doctor_request/demande_autorisation détecté - Redirection vers /introduction-patient');
        // Fermer le panneau de notifications
        setShowNotifications(false);
        // Rediriger vers la page Introduction Patient
        navigate('/introduction-patient');
      } else if (notification.type_notification === 'consultation_ended' || notification.type_notification === 'consultation_terminee') {
        console.log('✅ [Header] Type consultation_ended détecté');
        
        // Les caissiers ne sont pas redirigés vers la page de completion
        const userRole = userProfile?.role;
        if (userRole === 'caissier' || userRole === 'cashier') {
          console.log('🚫 [Header] Caissier - Pas de redirection pour consultation_ended');
          setShowNotifications(false);
          return;
        }
        
        console.log('✅ [Header] Redirection vers page de completion');
        // Fermer le panneau de notifications
        setShowNotifications(false);
        
        // Récupérer consultation_id depuis la notification
        let consultationId = notification.consultation_id;
        
        // Si consultation_id n'est pas disponible, chercher la consultation terminée la plus récente pour ce patient
        if (!consultationId && notification.patient_id) {
          try {
            const { data: consultationData } = await supabase
              .from('consultations')
              .select('id')
              .eq('patient_id', notification.patient_id)
              .eq('statut', 'terminee')
              .order('updated_at', { ascending: false })
              .limit(1)
              .single();
            
            if (consultationData) {
              consultationId = consultationData.id;
            }
          } catch (err) {
            console.error('❌ [Header] Erreur récupération consultation:', err);
          }
        }
        
        if (consultationId) {
          navigate(`/consultation-completion/${consultationId}`);
        } else {
          console.warn('⚠️ [Header] Consultation ID non trouvé, redirection vers consultations terminées');
          navigate('/consultations-terminees');
        }
      } else {
        console.log('ℹ️ [Header] Type de notification:', notification.type_notification, '- Pas de redirection');
      }
    } catch (error) {
      console.error('❌ [Header] Erreur lors du marquage de la notification:', error);
    }
  };

  const formatNotificationTime = (createdAt) => {
    if (!createdAt) return '';
    
    const now = new Date();
    const notificationTime = new Date(createdAt);
    const diffInMinutes = Math.floor((now - notificationTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'À l\'instant';
    if (diffInMinutes < 60) return `Il y a ${diffInMinutes} min`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Il y a ${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `Il y a ${diffInDays} jour${diffInDays > 1 ? 's' : ''}`;
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'patient_ready':
        return <Phone className="text-blue-500" size={16} />;
      case 'patient_on_way':
        return <UserCheck className="text-green-500" size={16} />;
      case 'consultation_ended':
        return <CheckCircle className="text-purple-500" size={16} />;
      case 'patient_envoye':
        return <UserCheck className="text-green-500" size={16} />;
      case 'patient_called':
        return <Phone className="text-blue-500" size={16} />;
      case 'patient_entered':
        return <UserCheck className="text-green-500" size={16} />;
      case 'consultation_terminee':
        return <CheckCircle className="text-purple-500" size={16} />;
      case 'patient_status_change':
        return <Clock className="text-orange-500" size={16} />;
      case 'doctor_request':
      case 'demande_autorisation':
        return <Stethoscope className="text-blue-600" size={16} />;
      case 'warning':
        return <Clock className="text-yellow-500" size={16} />;
      case 'success':
        return <CheckCircle className="text-green-500" size={16} />;
      case 'alert':
        return <AlertTriangle className="text-red-500" size={16} />;
      default:
        return <Bell className="text-blue-500" size={16} />;
    }
  };

  const userRole = userProfile?.role || currentUser?.user_metadata?.role || currentUser?.app_metadata?.role;
  const userName = userProfile ? `${userProfile.prenom} ${userProfile.nom}` : `${currentUser?.user_metadata?.prenom || ''} ${currentUser?.user_metadata?.nom || ''}`;
  const userInitials = userName.split(' ').map(n => n.charAt(0)).join('').toUpperCase();

  const getPageTitle = () => {
    const path = location.pathname;
    const titles = {
      '/dashboard': 'Tableau de Bord',
      '/secretary': 'Dashboard Secrétaire',
      '/doctor': 'Dashboard Médecin',
      '/patients': 'Gestion Patients',
      '/appointments': 'Calendrier',
      '/consultations': 'Consultations',
      '/facturation': 'Facturation',
      '/parametrage': 'Paramétrage',
      '/administration': 'Administration'
    };
    //return titles[path] || 'Cabinet Médical';
    return titles[path] || cabinetName;
  };

  /*const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };*/
  const handleLogout = async () => {
  try {
    const tenantId = userProfile?.tenant_id;
    const isAdmin = userProfile?.role === 'admin';
    
    // Naviguer D'ABORD, déconnecter ensuite
    if (isAdmin || !tenantId) {
      navigate('/login');
    } else {
      navigate('/cabinet-welcome-public/' + tenantId);
    }
    
    // Petit délai pour que la navigation se fasse avant la déconnexion
    setTimeout(async () => {
      await logout();
    }, 100);
    
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
  }
};
  /*const handleLogout = async () => {
  try {
    const tenantId = userProfile?.tenant_id;
    const isAdmin = userProfile?.role === 'admin';
    
    await logout();
    
    if (isAdmin || !tenantId) {
      navigate('/login');
    } else {
      navigate('/cabinet-welcome-public/' + tenantId);
    }
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
  }
};*/
  /*const handleLogout = async () => {
    try {
      await logout();
      const lastTenantId = localStorage.getItem('lastTenantId');
      if (lastTenantId) {
        navigate('/cabinet-welcome');
      } else {
        navigate('/login');
      }
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };*/

  // Gestion des raccourcis clavier pour la recherche
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K ou Cmd+K pour ouvrir la recherche
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(true);
      }
      // Échap pour fermer les menus
      if (e.key === 'Escape') {
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!showNotifications) return;

    const handleClickOutside = (event) => {
      if (
        notificationsPanelRef.current &&
        !notificationsPanelRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
        hasMarkedAllAsReadRef.current = false;
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  const { settings } = usePersonnalisation();

  const uploadCabinetLogo = async () => {
  if (!selectedFile || !userProfile?.tenant_id) return;

  try {
    setUploadingLogo(true);

    const fileExt = selectedFile.name.split('.').pop();
    const fileName = `${userProfile.tenant_id}-${Date.now()}.${fileExt}`;
    const filePath = `logos/${fileName}`;

    // 1. UPLOAD
    const { error: uploadError } = await supabase
      .storage
      .from('cabinet-assets')
      .upload(filePath, selectedFile);

    if (uploadError) {
      console.error(uploadError);
      return;
    }

    // 2. GET PUBLIC URL
    const { data } = supabase
      .storage
      .from('cabinet-assets')
      .getPublicUrl(filePath);

    const publicUrl = data.publicUrl;

    // 3. UPDATE TENANT TABLE
    const { error: updateError } = await supabase
      .from('tenants')
      .update({ logo_url: publicUrl })
      .eq('id', userProfile.tenant_id);

    if (updateError) {
      console.error(updateError);
      return;
    }

    // 4. UPDATE UI
    setCabinetLogo(publicUrl);
    setPreviewUrl(null);
    setSelectedFile(null);

  } catch (err) {
    console.error('Erreur upload logo:', err);
  } finally {
    setUploadingLogo(false);
  }
};

  return (
    <>
      <header 
        className="transition-colors duration-200"
        style={{
          backgroundColor: settings.couleur_header_fond || 'transparent',
          borderColor: settings.couleur_bordure || 'transparent'
        }}
      >
        <div className="px-6 py-2.5">
          <div className="flex items-center justify-between w-full">
             {/* GAUCHE : Logo */}
              <div className="flex items-center space-x-3">
              {/* Logo simplifié */}
              <div className="flex items-center space-x-3 mr-6">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-white border flex items-center justify-center p-1 flex-shrink-0">
                  {cabinetLogo ? (
                    <img
                      src={cabinetLogo}
                      alt="Cabinet Logo"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Stethoscope className="w-5 h-5 text-medical-primary" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span 
                    className="text-lg font-bold"
                    style={{ 
                      color: settings.couleur_header_texte || '#111827',
                      fontFamily: settings.police_famille
                    }}
                  >
                    {cabinetName}
                  </span>
                  {/*<p className="text-xs text-gray-500">
                    {getPageTitle()}
                  </p>*/}
                  
                </div>
              </div>

              {/* Barre de recherche globale 
              <button
                onClick={() => setShowGlobalSearch(true)}
                className="flex items-center space-x-3 w-80 px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors text-left group"
              >
                <Search className="text-gray-400 group-hover:text-gray-600" size={18} />
                <span className="text-gray-500 group-hover:text-gray-700 flex-1">
                  Rechercher...
                </span>
                <div className="flex items-center space-x-1 text-xs text-gray-400">
                  <Command size={12} />
                  <span>K</span>
                </div>
              </button>*/}
            </div>

            {/* Recherche globale (déplacée à droite) */}
<button
  onClick={() => setShowGlobalSearch(true)}
  className="flex items-center space-x-3 w-80 px-4 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors text-left group"
>
  <Search className="text-gray-400 group-hover:text-gray-600" size={18} />
  <span className="text-gray-500 group-hover:text-gray-700 flex-1">
    Rechercher...
  </span>
  <div className="flex items-center space-x-1 text-xs text-gray-400">
    <Command size={12} />
    <span>K</span>
  </div>
</button>


            {/* Section droite - Actions utilisateur */}
            <div className="flex items-center space-x-3">
              {/* Notifications */}
              <div className="relative" ref={notificationsPanelRef}>
                <button
                  type="button"
                  onClick={async () => {
                    const willOpen = !showNotifications;
                    setShowNotifications(willOpen);
                    
                    // Marquer toutes les notifications comme lues lors de l'ouverture
                    if (willOpen && unreadCount > 0 && !hasMarkedAllAsReadRef.current) {
                      try {
                        await markAllAsRead(userProfile.id, userProfile.role);
                        hasMarkedAllAsReadRef.current = true;
                        setUnreadCount(0);
                        setNotifications(prev => prev.map(n => ({ ...n, lu: true, lu_at: new Date().toISOString() })));
                      } catch (error) {
                        console.error('❌ [Header] Erreur marquage toutes notifications comme lues:', error);
                      }
                    }
                  }}
                  className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Bell size={20} className="text-gray-600" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>

              {/* Dropdown notifications */}
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                  >
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900">Notifications</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Non lues et lues depuis moins de 24 h
                      </p>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">Aucune nouvelle notification</p>
                        </div>
                      ) : (
                        notifications.map((notification) => {
                          const isRead = Boolean(notification.lu);
                          return (
                          <div
                            key={notification.id}
                            className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                              isRead ? 'bg-gray-50 opacity-80' : 'bg-blue-50'
                            }`}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className="flex items-start space-x-3">
                              {getNotificationIcon(notification.type_notification)}
                              <div className="flex-1">
                                <p className={`text-sm font-medium ${isRead ? 'text-gray-600' : 'text-gray-900'}`}>
                                  {notification.titre}
                                </p>
                                <p className="text-sm mt-1 text-gray-700">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {formatNotificationTime(notification.created_at)}
                                  {isRead ? ' · Lu' : ''}
                                </p>
                                {notification.patient && (
                                  <p className="text-xs text-blue-600 mt-1">
                                    Patient: {notification.patient.prenom} {notification.patient.nom}
                                  </p>
                                )}
                              </div>
                              {!isRead && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                              )}
                            </div>
                          </div>
                          );
                        })
                      )}
                    </div>
                    <div className="p-3 border-t border-gray-200">
                      <button 
                        onClick={() => { setShowNotifications(false); navigate('/notifications'); }}
                        className="w-full text-sm text-medical-primary hover:text-medical-primary/80 font-medium"
                      >
                        Voir toutes les notifications
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

              {/* Profil utilisateur avec menu dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {userName.trim() || 'Utilisateur'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {getRoleDisplayName(userRole)}
                    </p>
                  </div>
                  {userProfile?.photo_url ? (
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-medical-primary flex-shrink-0 relative">
                      <img
                        src={userProfile.photo_url}
                        alt={userName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback vers initiales si l'image ne charge pas
                          e.target.style.display = 'none';
                          const fallback = e.target.parentElement.querySelector('.photo-fallback');
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <div className="w-10 h-10 bg-medical-primary rounded-full flex items-center justify-center text-white font-semibold photo-fallback hidden absolute inset-0">
                        {userInitials || 'U'}
                      </div>
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-medical-primary rounded-full flex items-center justify-center text-white font-semibold">
                      {userInitials || 'U'}
                    </div>
                  )}
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>

                {/* Menu utilisateur simplifié */}
                <AnimatePresence>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                    >
                      <div className="p-2">
                        <Link
                          to="/profile"
                          onClick={() => setShowUserMenu(false)}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <User size={16} />
                          <span>Mon Profil</span>
                        </Link>

                        {hasRole('admin') && (
                          <Link
                            to="/parametrage"
                            onClick={() => setShowUserMenu(false)}
                            className="w-full flex items-center space-x-2 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                          >
                            <Settings size={16} />
                            <span>Paramétrage Système</span>
                          </Link>
                        )}
                        <hr className="my-1" />
                        <button 
                          onClick={handleLogout}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <LogOut size={16} />
                          <span>Déconnexion</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </header>
      {/* Composant de recherche globale */}
      <GlobalSearch 
        isOpen={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
      />
    </>
  );
};

export default Header;

