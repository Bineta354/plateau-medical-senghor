import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  getAllNotifications,
  isNotificationForUser,
  deduplicateNotifications,
} from '../lib/notifications';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotification, setLatestNotification] = useState(null);
  const [showUrgentModal, setShowUrgentModal] = useState(false);
  const { userProfile } = useAuth();

  // Déterminer si une notification est urgente
  const isUrgentNotification = (notification) => {
    const message = notification.message?.toLowerCase() || '';
    const type = notification.type_notification?.toLowerCase() || notification.type?.toLowerCase() || '';
    
    return (
      message.includes('urgent') ||
      message.includes('urgence') ||
      message.includes('emergency') ||
      type.includes('urgent') ||
      type.includes('emergency') ||
      message.includes('🚨') ||
      message.includes('⚠️')
    );
  };

  // Jouer un son de notification
  const playNotificationSound = useCallback((type = 'default') => {
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      
      // Différentes fréquences selon le type
      const frequencies = {
        urgent: [800, 1000, 800], // Son d'alarme
        success: [523, 659, 784], // Accord majeur
        info: [440, 554], // Son doux
        default: [440] // Son simple
      };
      
      const freqArray = frequencies[type] || frequencies.default;
      const duration = type === 'urgent' ? 0.3 : 0.2;
      
      freqArray.forEach((freq, index) => {
        setTimeout(() => {
          const osc = context.createOscillator();
          const gain = context.createGain();
          
          osc.connect(gain);
          gain.connect(context.destination);
          
          osc.frequency.value = freq;
          osc.type = type === 'urgent' ? 'square' : 'sine';
          
          gain.gain.setValueAtTime(0.2, context.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration);
          
          osc.start(context.currentTime);
          osc.stop(context.currentTime + duration);
        }, index * 150);
      });
    } catch (error) {
      console.warn('Impossible de jouer le son:', error);
    }
  }, []);

  // Vibration pour mobile
  const triggerVibration = useCallback((pattern = [200, 100, 200]) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }, []);

  // Notification du navigateur
  const showBrowserNotification = useCallback((notification) => {
    if (Notification.permission === 'granted') {
      const isUrgent = isUrgentNotification(notification);
      const title = isUrgent ? '🚨 URGENT - SeneCare' : '🔔 SeneCare';
      
      const browserNotif = new Notification(title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `notification-${notification.id}`,
        requireInteraction: isUrgent, // Les urgentes restent affichées
        silent: false,
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

      // Auto-fermeture (sauf urgentes)
      if (!isUrgent) {
        setTimeout(() => browserNotif.close(), 8000);
      }
    }
  }, []);

  // Demander permission notifications
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!userProfile?.id || !userProfile?.role) return;

    try {
      const data = await getAllNotifications(userProfile.id, userProfile.role, 100);
      const newNotifications = deduplicateNotifications(data || []);
      const unread = newNotifications.filter(n => !n.lu).length;
      
      // Détecter nouvelles notifications
      const existingIds = notifications.map(n => n.id);
      const reallyNewNotifications = newNotifications.filter(n => 
        !existingIds.includes(n.id) && !n.lu
      );
      
      if (reallyNewNotifications.length > 0) {
        const latest = reallyNewNotifications[0];
        setLatestNotification(latest);
        
        // Vérifier si c'est urgent
        const isUrgent = isUrgentNotification(latest);
        
        if (isUrgent) {
          // Notification urgente - modal plein écran
          setShowUrgentModal(true);
          playNotificationSound('urgent');
          triggerVibration([300, 200, 300, 200, 300]);
        } else {
          // Notification normale
          const type = latest.message?.includes('terminé') ? 'success' : 'info';
          playNotificationSound(type);
          triggerVibration();
        }
        
        // Notification navigateur
        showBrowserNotification(latest);
      }
      
      setNotifications(newNotifications);
      setUnreadCount(unread);
    } catch (error) {
      console.error('Erreur récupération notifications:', error);
    }
  }, [userProfile?.id, userProfile?.role, notifications, playNotificationSound, triggerVibration, showBrowserNotification]);

  // Marquer comme lu
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications_medecin_secretaire')
        .update({ lu: true })
        .eq('id', notificationId);

      if (error) throw error;
      
      // Mettre à jour l'état local
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, lu: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erreur marquage lu:', error);
    }
  }, []);

  // Marquer toutes comme lues
  const markAllAsRead = useCallback(async () => {
    if (!userProfile?.id) return;

    try {
      const { error } = await supabase
        .from('notifications_medecin_secretaire')
        .update({ lu: true })
        .or(`medecin_id.eq.${userProfile.id},secretaire_id.eq.${userProfile.id}`)
        .eq('lu', false);

      if (error) throw error;
      
      // Mettre à jour l'état local
      setNotifications(prev => prev.map(n => ({ ...n, lu: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Erreur marquage toutes lues:', error);
    }
  }, [userProfile?.id]);

  // Supprimer une notification
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications_medecin_secretaire')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => {
        const notification = notifications.find(n => n.id === notificationId);
        return notification && !notification.lu ? prev - 1 : prev;
      });
    } catch (error) {
      console.error('Erreur suppression notification:', error);
    }
  }, [notifications]);

  // Initialisation et écoute temps réel
  useEffect(() => {
    if (!userProfile?.id) return;

    // Demander permissions
    requestNotificationPermission();
    
    // Récupération initiale
    fetchNotifications();

    // Écoute temps réel
    const subscription = supabase
      .channel('notifications_realtime')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications_medecin_secretaire'
        }, 
        (payload) => {
          const newNotif = payload.new;
          if (newNotif && isNotificationForUser(newNotif, userProfile.id, userProfile.role)) {
            fetchNotifications();
          }
        }
      )
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications_medecin_secretaire'
        },
        (payload) => {
          const updated = payload.new;
          if (updated && isNotificationForUser(updated, userProfile.id, userProfile.role)) {
            fetchNotifications();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [userProfile?.id, userProfile?.role, fetchNotifications, requestNotificationPermission]);

  return {
    notifications,
    unreadCount,
    latestNotification,
    showUrgentModal,
    setShowUrgentModal,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    fetchNotifications,
    isUrgentNotification
  };
};

export default useNotifications;
