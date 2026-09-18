import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, AlertTriangle, Info, CheckCircle, CheckSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { sendNotification, NOTIFICATION_TYPES } from '../../services/notificationService';
import { useDeduplicatedNotifications } from '../../services/notificationDeduplicationService';

const NotificationSystem = () => {
  const [notifications, setNotifications] = useState([]);
  const [showToast, setShowToast] = useState(false);
  const [latestNotification, setLatestNotification] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const audioRef = useRef(null);
  const { userProfile } = useAuth();

  // Sons de notification
  const playNotificationSound = (type = 'default') => {
    if (audioRef.current) {
      // Différents sons selon le type de notification
      const frequency = type === 'urgent' ? 800 : type === 'success' ? 600 : 440;
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);
      
      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.5);
    }
  };

  // Vibration pour mobile
  const triggerVibration = (pattern = [200, 100, 200]) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  // Notification du navigateur
  const showBrowserNotification = (notification) => {
    if (Notification.permission === 'granted') {
      const browserNotif = new Notification(`SeneCare - ${getNotificationTitle(notification)}`, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `notification-${notification.id}`,
        requireInteraction: true,
        actions: [
          { action: 'mark-read', title: 'Marquer comme lu' },
          { action: 'view', title: 'Voir détails' }
        ]
      });

      browserNotif.onclick = () => {
        window.focus();
        markAsRead(notification.id);
        browserNotif.close();
      };

      // Auto-fermeture après 10 secondes
      setTimeout(() => browserNotif.close(), 10000);
    }
  };

  // Demander permission pour notifications navigateur
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Fonction de fetch originale
  const originalFetchNotifications = async () => {
    if (!userProfile?.id) {
      console.log('❌ [NotificationSystem] Pas d\'userProfile, arrêt fetchNotifications');
      return [];
    }

    console.log('🔄 [NotificationSystem] Récupération notifications pour:', userProfile);

    try {
      const { data, error } = await supabase
        .from('notifications_medecin_secretaire')
        .select('*')
        .or(`medecin_id.eq.${userProfile.id},secretaire_id.eq.${userProfile.id}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      console.log('📨 [NotificationSystem] Notifications récupérées:', data);
      return data || [];
    } catch (error) {
      console.error('Erreur récupération notifications:', error);
      return [];
    }
  };

  // Utilisation du service de déduplication
  const { fetchNotifications: debouncedFetch, processNotifications } = useDeduplicatedNotifications(
    originalFetchNotifications, 
    'NotificationSystem'
  );

  // Récupérer les notifications avec déduplication
  const fetchNotifications = async () => {
    try {
      const rawNotifications = await debouncedFetch();
      if (!rawNotifications) return; // Fetch annulé par le debouncing

      // Traitement avec déduplication
      const processedNotifications = processNotifications(rawNotifications);
      
      const unread = processedNotifications.filter(n => !n.lu).length;
      
      console.log('📊 [NotificationSystem] Stats après déduplication:', {
        raw: rawNotifications.length,
        processed: processedNotifications.length,
        unread: unread,
        existingCount: notifications.length
      });
      
      // Détecter nouvelles notifications
      const existingIds = notifications.map(n => n.id);
      const reallyNewNotifications = processedNotifications.filter(n => !existingIds.includes(n.id) && !n.lu);
      
      console.log('🔍 [NotificationSystem] Détection nouvelles notifications:', {
        existingIds,
        reallyNewNotifications,
        newCount: reallyNewNotifications.length
      });
      
      if (reallyNewNotifications.length > 0) {
        const latest = reallyNewNotifications[0];
        console.log('🆕 [NotificationSystem] Nouvelle notification détectée:', latest);
        
        setLatestNotification(latest);
        setShowToast(true);
        
        console.log('🎨 [NotificationSystem] Déclenchement des effets visuels...');
        
        // Effets visuels et sonores
        playNotificationSound(getNotificationType(latest));
        triggerVibration();
        showBrowserNotification(latest);
        
        // Toast personnalisé déjà géré par setShowToast(true)
        console.log('🍞 [NotificationSystem] Toast personnalisé activé...');
        
        // Animation de l'icône de notification
        setIsVisible(true);
        
        // Auto-masquer le toast après 8 secondes
        setTimeout(() => setShowToast(false), 8000);
      } else {
        console.log('ℹ️ [NotificationSystem] Aucune nouvelle notification');
      }
      
      setNotifications(processedNotifications);
      setUnreadCount(unread);
    } catch (error) {
      console.error('Erreur récupération notifications:', error);
    }
  };

  // Écouter les nouvelles notifications en temps réel
  useEffect(() => {
    if (!userProfile?.id) return;

    fetchNotifications();

    const subscription = supabase
      .channel('notifications')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications_medecin_secretaire',
          filter: `medecin_id=eq.${userProfile.id},secretaire_id=eq.${userProfile.id}`
        }, 
        (payload) => {
          console.log('Nouvelle notification reçue:', payload);
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [userProfile?.id]);

  // Marquer comme lu
  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications_medecin_secretaire')
        .update({ lu: true })
        .eq('id', notificationId);

      if (error) throw error;
      fetchNotifications();
    } catch (error) {
      console.error('Erreur marquage lu:', error);
    }
  };

  // Marquer toutes comme lues
  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications_medecin_secretaire')
        .update({ lu: true })
        .or(`medecin_id.eq.${userProfile.id},secretaire_id.eq.${userProfile.id}`)
        .eq('lu', false);

      if (error) throw error;
      fetchNotifications();
    } catch (error) {
      console.error('Erreur marquage toutes lues:', error);
    }
  };

  // Autoriser patient à aller en consultation depuis la notification
  const handleAuthorizeFromNotification = async (notification) => {
    try {
      console.log('🚀 [NotificationSystem] Tentative d\'autorisation:', notification);
      
      // Extraire les données de la notification
      const metadata = notification.metadata ? JSON.parse(notification.metadata) : {};
      const waitingQueueId = metadata.waitingQueueId || notification.waiting_queue_id;
      
      console.log('📋 [NotificationSystem] Métadonnées:', {
        metadata,
        waitingQueueId,
        notificationData: notification
      });
      
      if (!waitingQueueId) {
        console.error('❌ [NotificationSystem] waitingQueueId manquant');
        console.error('Impossible de trouver les informations du patient');
        return;
      }

      // Appeler la fonction de confirmation d'entrée
      const { data, error } = await supabase.rpc('confirm_patient_entry_basesql', {
        p_waiting_queue_id: waitingQueueId,
        p_secretaire_id: userProfile?.id
      });

      if (error) throw error;

      // Envoyer notification au médecin
      try {
        const medecinId = notification.medecin_id;
        const patientName = metadata.patientName || 'Patient';
        
        await sendNotification(
          NOTIFICATION_TYPES.PATIENT_ON_WAY,
          userProfile?.id,      // Secrétaire (expéditeur)
          medecinId,            // Médecin (destinataire)
          null,                 // Pas de consultation_id
          patientName,
          {
            waitingQueueId: waitingQueueId,
            patientId: metadata.patientId
          }
        );
      } catch (nerr) {
        console.warn('Envoi notification médecin échoué (non bloquant):', nerr);
      }

      // Marquer la notification comme lue
      await markAsRead(notification.id);
      
      console.log('✅ Patient autorisé à aller en consultation:', data?.message);
      
      // Rafraîchir les notifications
      fetchNotifications();
    } catch (error) {
      console.error('Erreur lors de l\'autorisation:', error);
      console.error('❌ Erreur lors de l\'autorisation du patient:', error.message);
    }
  };

  // Vérifier si la notification nécessite un bouton d'autorisation
  const needsAuthorizationButton = (notification) => {
    const message = notification.message?.toLowerCase() || '';
    const type = notification.type_notification?.toLowerCase() || notification.type?.toLowerCase() || '';
    
    console.log('🔍 [NotificationSystem] Vérification bouton autorisation:', {
      userRole: userProfile?.role,
      userId: userProfile?.id,
      notificationSecretaireId: notification.secretaire_id,
      notificationType: type,
      message: message,
      notification: notification
    });
    
    // VERSION TEMPORAIRE DE TEST - AFFICHE TOUJOURS LE BOUTON POUR SECRÉTAIRE
    if (userProfile?.role === 'secretary') {
      console.log('🧪 [TEST] Affichage forcé du bouton pour secrétaire');
      return true;
    }
    
    // Vérifier si c'est une notification de médecin prêt à recevoir et que l'utilisateur est secrétaire
    const isSecretary = userProfile?.role === 'secretary';
    const isForThisSecretary = notification.secretaire_id === userProfile?.id;
    const isPatientReadyType = (
      type === 'patient_ready' ||
      message.includes('je reçois le patient') ||
      message.includes('va recevoir') || 
      message.includes('prêt à recevoir') || 
      message.includes('disponible pour recevoir') ||
      type.includes('medecin_disponible') ||
      type === 'doctor_available'
    );
    
    const shouldShow = isSecretary && isForThisSecretary && isPatientReadyType;
    
    console.log('🎯 [NotificationSystem] Résultat vérification:', {
      isSecretary,
      isForThisSecretary,
      isPatientReadyType,
      shouldShow
    });
    
    return shouldShow;
  };

  // Obtenir le type de notification
  const getNotificationType = (notification) => {
    const message = notification.message?.toLowerCase() || '';
    const type = notification.type_notification?.toLowerCase() || notification.type?.toLowerCase() || '';
    
    if (message.includes('urgent') || type.includes('urgent')) return 'urgent';
    if (message.includes('terminé') || type.includes('finie')) return 'success';
    if (message.includes('autorisé') || type.includes('autorise')) return 'info';
    return 'default';
  };

  // Obtenir le titre de notification
  const getNotificationTitle = (notification) => {
    const type = getNotificationType(notification);
    switch (type) {
      case 'urgent': return 'URGENT';
      case 'success': return 'Consultation terminée';
      case 'info': return 'Autorisation';
      default: return 'Notification';
    }
  };

  // Obtenir l'icône selon le type
  const getNotificationIcon = (notification) => {
    const type = getNotificationType(notification);
    switch (type) {
      case 'urgent': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'info': return <Info className="w-5 h-5 text-blue-500" />;
      default: return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  // Le toast personnalisé est géré directement dans le JSX ci-dessous

  return (
    <>
      {/* Bouton de notifications avec badge */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className={`relative p-2 rounded-full transition-all duration-300 ${
          unreadCount > 0 
            ? 'bg-red-100 text-red-600 animate-pulse shadow-lg' 
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <Bell className={`w-6 h-6 ${unreadCount > 0 ? 'animate-bounce' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Toast de nouvelle notification */}
      {showToast && latestNotification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className={`max-w-md bg-white border-l-4 rounded-lg shadow-2xl p-4 ${
            getNotificationType(latestNotification) === 'urgent' ? 'border-red-500 bg-red-50' :
            getNotificationType(latestNotification) === 'success' ? 'border-green-500 bg-green-50' :
            getNotificationType(latestNotification) === 'info' ? 'border-blue-500 bg-blue-50' :
            'border-gray-500'
          }`}>
            <div className="flex items-start">
              <div className="flex-shrink-0 animate-pulse">
                {getNotificationIcon(latestNotification)}
              </div>
              <div className="ml-3 flex-1">
                <h4 className="text-sm font-semibold text-gray-900">
                  🔔 {getNotificationTitle(latestNotification)}
                </h4>
                <p className="text-sm text-gray-700 mt-1">
                  {latestNotification.message}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(latestNotification.created_at).toLocaleTimeString('fr-FR')}
                </p>
                {needsAuthorizationButton(latestNotification) && (
                  <div className="mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAuthorizeFromNotification(latestNotification);
                        setShowToast(false);
                      }}
                      className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                    >
                      <CheckSquare className="w-4 h-4 mr-1" />
                      Appeler patient
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setShowToast(false);
                  markAsRead(latestNotification.id);
                }}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel des notifications */}
      {isVisible && (
        <div className="fixed inset-0 z-40" onClick={() => setIsVisible(false)}>
          <div className="absolute top-16 right-4 w-96 bg-white rounded-lg shadow-2xl border max-h-96 overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Notifications ({unreadCount} non lues)
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Tout marquer lu
                  </button>
                )}
              </div>
            </div>
            
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  Aucune notification
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-b hover:bg-gray-50 ${
                      !notification.lu ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        {getNotificationIcon(notification)}
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-sm text-gray-900">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(notification.created_at).toLocaleString('fr-FR')}
                        </p>
                        {needsAuthorizationButton(notification) && (
                          <div className="mt-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAuthorizeFromNotification(notification);
                              }}
                              className="inline-flex items-center px-2 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 focus:outline-none focus:ring-1 focus:ring-green-500 transition-colors"
                            >
                              <CheckSquare className="w-3 h-3 mr-1" />
                              Autoriser
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end space-y-1">
                        {!notification.lu && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          className="text-gray-400 hover:text-gray-600 text-xs"
                        >
                          Marquer lu
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Audio element pour les sons */}
      <audio ref={audioRef} preload="auto" />

      {/* Styles CSS pour les animations */}
      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default NotificationSystem;
