import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { notificationDeduplicationService } from '../services/notificationDeduplicationService';

/**
 * Hook personnalisé pour gérer les notifications avec déduplication automatique
 * @param {Object} options - Options de configuration
 * @param {string} options.componentName - Nom du composant pour le debug
 * @param {number} options.fetchInterval - Intervalle minimum entre les fetch (ms)
 * @param {number} options.maxNotifications - Nombre maximum de notifications à récupérer
 * @param {boolean} options.enableRealtime - Activer les mises à jour temps réel
 * @returns {Object} - État et fonctions des notifications
 */
export const useNotificationDeduplication = (options = {}) => {
  const {
    componentName = 'UnknownComponent',
    fetchInterval = 2000,
    maxNotifications = 50,
    enableRealtime = true
  } = options;

  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Refs pour éviter les fuites mémoire
  const isMountedRef = useRef(true);
  const subscriptionRef = useRef(null);
  const lastFetchRef = useRef(0);

  // Fonction de fetch originale
  const originalFetchNotifications = useCallback(async () => {
    if (!userProfile?.id) {
      console.log(`❌ [${componentName}] Pas d'userProfile, arrêt fetchNotifications`);
      return [];
    }

    console.log(`🔄 [${componentName}] Récupération notifications pour:`, userProfile.id);

    try {
      const { data, error } = await supabase
        .from('notifications_medecin_secretaire')
        .select('*')
        .or(`medecin_id.eq.${userProfile.id},secretaire_id.eq.${userProfile.id}`)
        .order('created_at', { ascending: false })
        .limit(maxNotifications);

      if (error) throw error;

      console.log(`📨 [${componentName}] Notifications récupérées:`, data?.length || 0);
      return data || [];
    } catch (error) {
      console.error(`❌ [${componentName}] Erreur récupération notifications:`, error);
      throw error;
    }
  }, [userProfile?.id, componentName, maxNotifications]);

  // Fonction de fetch avec déduplication
  const fetchNotifications = useCallback(async (force = false) => {
    // Vérifier le throttling
    const now = Date.now();
    if (!force && (now - lastFetchRef.current) < fetchInterval) {
      console.log(`⏳ [${componentName}] Fetch trop récent, ignoré`);
      return;
    }

    if (!isMountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      // Utiliser le service de déduplication
      const rawNotifications = await notificationDeduplicationService.debouncedFetch(
        originalFetchNotifications,
        `${componentName}_${userProfile?.id}`
      );

      if (!rawNotifications || !isMountedRef.current) return;

      // Traitement avec déduplication
      const processedNotifications = notificationDeduplicationService.processNotifications(rawNotifications);
      
      const unread = processedNotifications.filter(n => !n.lu).length;
      
      console.log(`📊 [${componentName}] Stats après déduplication:`, {
        raw: rawNotifications.length,
        processed: processedNotifications.length,
        unread: unread
      });

      if (isMountedRef.current) {
        setNotifications(processedNotifications);
        setUnreadCount(unread);
        lastFetchRef.current = now;
      }
    } catch (err) {
      console.error(`❌ [${componentName}] Erreur fetch notifications:`, err);
      if (isMountedRef.current) {
        setError(err.message);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [originalFetchNotifications, componentName, userProfile?.id, fetchInterval]);

  // Marquer une notification comme lue
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications_medecin_secretaire')
        .update({ lu: true, lu_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      // Mettre à jour l'état local
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, lu: true, lu_at: new Date().toISOString() }
            : n
        )
      );
      
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      console.log(`✅ [${componentName}] Notification ${notificationId} marquée comme lue`);
    } catch (error) {
      console.error(`❌ [${componentName}] Erreur marquage lu:`, error);
      setError(error.message);
    }
  }, [componentName]);

  // Marquer toutes les notifications comme lues
  const markAllAsRead = useCallback(async () => {
    if (!userProfile?.id) return;

    try {
      const { error } = await supabase
        .from('notifications_medecin_secretaire')
        .update({ lu: true, lu_at: new Date().toISOString() })
        .or(`medecin_id.eq.${userProfile.id},secretaire_id.eq.${userProfile.id}`)
        .eq('lu', false);

      if (error) throw error;

      // Mettre à jour l'état local
      setNotifications(prev => 
        prev.map(n => ({ ...n, lu: true, lu_at: new Date().toISOString() }))
      );
      
      setUnreadCount(0);
      
      console.log(`✅ [${componentName}] Toutes les notifications marquées comme lues`);
    } catch (error) {
      console.error(`❌ [${componentName}] Erreur marquage toutes lues:`, error);
      setError(error.message);
    }
  }, [userProfile?.id, componentName]);

  // Supprimer une notification
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications_medecin_secretaire')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      // Mettre à jour l'état local
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // Ajuster le compteur non lues si nécessaire
      const deletedNotification = notifications.find(n => n.id === notificationId);
      if (deletedNotification && !deletedNotification.lu) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      console.log(`🗑️ [${componentName}] Notification ${notificationId} supprimée`);
    } catch (error) {
      console.error(`❌ [${componentName}] Erreur suppression:`, error);
      setError(error.message);
    }
  }, [notifications, componentName]);

  // Obtenir les statistiques du cache
  const getCacheStats = useCallback(() => {
    return notificationDeduplicationService.getCacheStats();
  }, []);

  // Vider le cache
  const clearCache = useCallback(() => {
    notificationDeduplicationService.clearCache();
    console.log(`🗑️ [${componentName}] Cache de déduplication vidé`);
  }, [componentName]);

  // Configuration de l'écoute temps réel
  useEffect(() => {
    if (!enableRealtime || !userProfile?.id) return;

    console.log(`🔄 [${componentName}] Configuration écoute temps réel pour:`, userProfile.id);

    // Fetch initial
    fetchNotifications(true);

    // Subscription Realtime
    const subscription = supabase
      .channel(`notifications_${componentName}_${userProfile.id}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications_medecin_secretaire',
          filter: `medecin_id=eq.${userProfile.id}`
        }, 
        (payload) => {
          console.log(`📨 [${componentName}] Nouvelle notification temps réel:`, payload);
          // Délai pour éviter les conflits avec d'autres fetch
          setTimeout(() => fetchNotifications(), 500);
        }
      )
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications_medecin_secretaire',
          filter: `secretaire_id=eq.${userProfile.id}`
        }, 
        (payload) => {
          console.log(`📨 [${componentName}] Nouvelle notification temps réel (secrétaire):`, payload);
          setTimeout(() => fetchNotifications(), 500);
        }
      )
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'notifications_medecin_secretaire'
        }, 
        () => {
          console.log(`🔄 [${componentName}] Notification mise à jour`);
          setTimeout(() => fetchNotifications(), 300);
        }
      )
      .subscribe();

    subscriptionRef.current = subscription;

    return () => {
      console.log(`🔌 [${componentName}] Nettoyage subscription`);
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [userProfile?.id, enableRealtime, componentName, fetchNotifications]);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, []);

  return {
    // État
    notifications,
    unreadCount,
    loading,
    error,
    
    // Actions
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    
    // Utilitaires
    getCacheStats,
    clearCache,
    
    // Informations
    componentName,
    userProfile
  };
};

export default useNotificationDeduplication;
