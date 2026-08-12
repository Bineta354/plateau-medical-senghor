import { supabase } from './supabase'

/**
 * Vérifie si une notification est destinée à l'utilisateur connecté.
 */
export const isNotificationForUser = (notification, userId, userRole) => {
  if (!notification || !userId || !userRole) return false;

  if (userRole === 'doctor') {
    return Number(notification.medecin_id) === Number(userId);
  }
  if (userRole === 'secretary') {
    return Number(notification.secretaire_id) === Number(userId);
  }
  if (userRole === 'caissier' || userRole === 'cashier') {
    return Number(notification.caissier_id) === Number(userId);
  }
  return false;
};

/**
 * Supprime les doublons par id (et par contenu si besoin).
 */
export const deduplicateNotifications = (notifications) => {
  if (!Array.isArray(notifications)) return [];

  const seenIds = new Set();
  const seenKeys = new Set();
  const result = [];

  const sorted = [...notifications].sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );

  for (const notification of sorted) {
    if (notification.id != null) {
      if (seenIds.has(notification.id)) continue;
      seenIds.add(notification.id);
      result.push(notification);
      continue;
    }

    const key = [
      notification.type_notification,
      notification.medecin_id,
      notification.secretaire_id,
      notification.patient_id,
      notification.consultation_id,
      notification.waiting_queue_id,
      notification.message,
    ].join('|');

    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    result.push(notification);
  }

  return result;
};

// Types de notifications
export const NOTIFICATION_TYPES = {
  PATIENT_READY: 'patient_ready',         // Médecin → Secrétaire : "Je reçois le patient"
  PATIENT_ON_WAY: 'patient_on_way',       // Secrétaire → Médecin : "Le patient est en route"
  CONSULTATION_ENDED: 'consultation_ended', // Médecin → Secrétaire : "Consultation terminée, je suis disponible"
  FACTURATION_COMPLETE: 'facturation_complete', // Caissier → Secrétaire : "Facturation terminée, documents disponibles"
  NEW_APPOINTMENT: 'new_appointment',     // Système → Utilisateurs : "Nouveau rendez-vous créé"
  APPOINTMENT_CANCELLED: 'appointment_cancelled', // Système → Utilisateurs : "Rendez-vous annulé"
  APPOINTMENT_MODIFIED: 'appointment_modified',   // Système → Utilisateurs : "Rendez-vous modifié"
  PATIENT_CALLED: 'patient_called',       // Médecin → Secrétaire : "Patient appelé, veuillez l'envoyer"
  PATIENT_IN_CONSULTATION: 'patient_in_consultation' // Secrétaire → Médecin : "Patient envoyé dans le cabinet"
};

/**
 * Envoyer une notification
 * @param {string} type - Type de notification (NOTIFICATION_TYPES)
 * @param {string} senderId - ID de l'expéditeur
 * @param {string} receiverId - ID du destinataire
 * @param {string} consultationId - ID de la consultation (optionnel)
 * @param {string} patientName - Nom du patient
 * @param {object} additionalData - Données supplémentaires (optionnel)
 */
export const sendNotification = async (type, senderId, receiverId, consultationId, patientName, additionalData = {}) => {
  try {
    console.log('📤 [Notifications] Envoi notification:', { type, senderId, receiverId, patientName });
    
    // 1. Récupérer le tenant_id de l'expéditeur
    const { data: senderInfos } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', senderId)
      .single();
    
    const cabinetId = senderInfos?.tenant_id;
    
    const message = generateNotificationMessage(type, patientName, additionalData.medecinName);
    const titre = generateNotificationTitle(type);
    
    // Pour CONSULTATION_ENDED, FACTURATION_COMPLETE et PATIENT_CALLED, envoyer à TOUTES les secrétaires actives du MÊME cabinet
    // (PATIENT_CALLED est appelé avec receiverId=null depuis DoctorDashboard_Fixed.jsx dans cette
    // intention ; sans cette branche, secretaire_id finissait à null dans l'insert "normal" ci-dessous
    // et la notification n'apparaissait donc jamais pour aucune secrétaire).
    if (type === NOTIFICATION_TYPES.CONSULTATION_ENDED || type === NOTIFICATION_TYPES.FACTURATION_COMPLETE || type === NOTIFICATION_TYPES.PATIENT_CALLED) {
      console.log('🔵 [Notifications] Notification', type, '- Envoi aux secrétaires actives du cabinet');
      
      let query = supabase
        .from('users')
        .select('id')
        .eq('role', 'secretary')
        .eq('actif', true);
        
      if (cabinetId) {
        query = query.eq('tenant_id', cabinetId);
      }
      
      let { data: secretaires, error: secretairesError } = await query;
      
      if (secretairesError) {
        console.error('❌ [Notifications] Erreur récupération secrétaires:', secretairesError);
        throw secretairesError;
      }
      
      if (!secretaires || secretaires.length === 0) {
        console.warn('⚠️ [Notifications] Aucune secrétaire active trouvée, utilisation du receiverId fourni');
        // Fallback: utiliser le receiverId fourni
        secretaires = [{ id: receiverId }];
      }
      
      console.log('📊 [Notifications] Secrétaires actives trouvées:', secretaires.length);
      console.log('📊 [Notifications] IDs des secrétaires:', secretaires.map(s => s.id));
      
      // Préparer les données de base
      const baseData = {
        type_notification: type,
        titre: titre,
        message: message,
        medecin_id: senderId,
        tenant_id: cabinetId, // Ajouter tenant_id
        waiting_queue_id: additionalData.waitingQueueId || null,
        patient_id: additionalData.patientId || null,
        lu: false,
        priorite: 'normale'
      };

      // Ajouter consultation_id seulement s'il est fourni
      const consultationIdValue = consultationId || additionalData.consultationId;
      if (consultationIdValue) {
        baseData.consultation_id = consultationIdValue;
      }

      // Créer une notification pour chaque secrétaire
      const notificationsToInsert = secretaires.map(secretaire => ({
        ...baseData,
        secretaire_id: secretaire.id
      }));

      console.log('📤 [Notifications] Insertion de', notificationsToInsert.length, 'notifications (une par secrétaire)');
      
      // Insérer toutes les notifications en une seule requête
      const { data: notifications, error: insertError } = await supabase
        .from('notifications_medecin_secretaire')
        .insert(notificationsToInsert)
        .select();

      if (insertError) {
        // Si l'erreur est due à une colonne manquante (consultation_id), réessayer sans cette colonne
        if (insertError.code === '42703' && baseData.consultation_id !== undefined) {
          console.warn('⚠️ [Notifications] Colonne consultation_id non trouvée, insertion sans cette colonne');
          delete baseData.consultation_id;
          const notificationsToInsertRetry = secretaires.map(secretaire => ({
            ...baseData,
            secretaire_id: secretaire.id
          }));
          
          const { data: retryNotifications, error: retryError } = await supabase
            .from('notifications_medecin_secretaire')
            .insert(notificationsToInsertRetry)
            .select();
          
          if (retryError) {
            console.error('❌ [Notifications] Erreur insertion (retry):', retryError);
            throw retryError;
          }
          
          console.log('✅ [Notifications]', retryNotifications.length, 'notifications envoyées avec succès à toutes les secrétaires');
          // Retourner la première notification avec consultation_id ajouté
          return retryNotifications.length > 0 
            ? { ...retryNotifications[0], consultation_id: consultationIdValue }
            : null;
        }
        
        console.error('❌ [Notifications] Erreur insertion:', insertError);
        throw insertError;
      }

      console.log('✅ [Notifications]', notifications.length, 'notifications envoyées avec succès à toutes les secrétaires');
      // Retourner la première notification
      return notifications && notifications.length > 0 ? notifications[0] : null;
    }
    
    // Pour les autres types de notifications, comportement normal
    const insertData = {
      type_notification: type,
      titre: titre,
      message: message,
      medecin_id: type === NOTIFICATION_TYPES.PATIENT_ON_WAY ? receiverId : senderId,
      secretaire_id: type === NOTIFICATION_TYPES.PATIENT_ON_WAY ? senderId : receiverId,
      tenant_id: cabinetId, // Ajouter tenant_id
      waiting_queue_id: additionalData.waitingQueueId || null,
      patient_id: additionalData.patientId || null,
      lu: false,
      priorite: 'normale'
    };

    // Ajouter consultation_id seulement s'il est fourni (la colonne peut ne pas exister encore)
    const consultationIdValue = consultationId || additionalData.consultationId;
    if (consultationIdValue) {
      insertData.consultation_id = consultationIdValue;
    }

    console.log('🔍 [Notifications] Insertion dans notifications_medecin_secretaire:', {
      insertData,
      types: {
        medecin_id: typeof insertData.medecin_id,
        secretaire_id: typeof insertData.secretaire_id,
        patient_id: typeof insertData.patient_id,
        waiting_queue_id: typeof insertData.waiting_queue_id,
        consultation_id: typeof insertData.consultation_id
      },
      additionalData_keys: Object.keys(additionalData),
      additionalData_values: additionalData
    });

    // Insérer dans notifications_medecin_secretaire
    const { data: notification, error } = await supabase
      .from('notifications_medecin_secretaire')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      // Si l'erreur est due à une colonne manquante (consultation_id), réessayer sans cette colonne
      if (error.code === '42703' && insertData.consultation_id !== undefined) {
        console.warn('⚠️ [Notifications] Colonne consultation_id non trouvée, insertion sans cette colonne');
        delete insertData.consultation_id;
        const { data: retryNotification, error: retryError } = await supabase
          .from('notifications_medecin_secretaire')
          .insert(insertData)
          .select()
          .single();
        
        if (retryError) {
          console.error('❌ [Notifications] Erreur insertion (retry):', retryError);
          throw retryError;
        }
        
        // Ajouter consultation_id dans les données retournées pour utilisation ultérieure
        return { ...retryNotification, consultation_id: consultationIdValue };
      }
      
      console.error('❌ [Notifications] Erreur insertion:', error);
      throw error;
    }

    console.log('✅ [Notifications] Notification envoyée avec succès:', notification.id);
    return notification;
  } catch (error) {
    console.error('❌ [Notifications] Erreur lors de l\'envoi de la notification:', error);
    throw error;
  }
};

/**
 * Générer le message de notification selon le type
 */
const generateNotificationMessage = (type, patientName, medecinName) => {
  switch (type) {
    case NOTIFICATION_TYPES.PATIENT_READY:
      return medecinName
        ? `${medecinName} demande à introduire ${patientName}`
        : `Le médecin demande à introduire ${patientName}`;
    case NOTIFICATION_TYPES.PATIENT_ON_WAY:
      return medecinName
        ? `Le patient se rend chez Dr. ${medecinName}`
        : `Le patient se rend au cabinet du médecin`;
    case NOTIFICATION_TYPES.CONSULTATION_ENDED:
      return medecinName
        ? `${medecinName} a terminé la consultation avec ${patientName}. Cliquez pour compléter la facturation.`
        : `Consultation du patient ${patientName} terminée. Cliquez pour compléter la facturation.`;
    case NOTIFICATION_TYPES.FACTURATION_COMPLETE:
      return `La facturation pour ${patientName} est terminée. Les documents sont disponibles pour remise au patient.`;
    case NOTIFICATION_TYPES.PATIENT_CALLED:
      return `Patient ${patientName} appelé. Veuillez l'envoyer dans le cabinet.`;
    case NOTIFICATION_TYPES.PATIENT_IN_CONSULTATION:
      return `Patient ${patientName} envoyé dans le cabinet. Consultation en cours.`;
    case 'appointment_request':
      return `Demande de rendez-vous de suivi pour ${patientName}`;
    default:
      return 'Nouvelle notification';
  }
};

/**
 * Générer le titre de notification selon le type
 */
const generateNotificationTitle = (type) => {
  switch (type) {
    case NOTIFICATION_TYPES.PATIENT_READY:
      return 'Patient prêt à être reçu';
    case NOTIFICATION_TYPES.PATIENT_ON_WAY:
      return 'Patient en route vers le médecin';
    case NOTIFICATION_TYPES.CONSULTATION_ENDED:
      return 'Consultation terminée - Compléter la facturation';
    case NOTIFICATION_TYPES.FACTURATION_COMPLETE:
      return 'Facturation terminée - Documents disponibles';
    case NOTIFICATION_TYPES.PATIENT_CALLED:
      return 'Patient appelé';
    case NOTIFICATION_TYPES.PATIENT_IN_CONSULTATION:
      return 'Patient en consultation';
    case 'appointment_request':
      return 'Demande de rendez-vous de suivi';
    default:
      return 'Notification';
  }
};

/**
 * Marquer une notification comme lue
 * @param {string} notificationId - ID de la notification
 */
export const markAsRead = async (notificationId) => {
  try {
    const { error } = await supabase
      .from('notifications_medecin_secretaire')
      .update({ 
        lu: true, 
        lu_at: new Date().toISOString() 
      })
      .eq('id', notificationId);

    if (error) throw error;
    
    console.log('✅ [Notifications] Notification marquée comme lue:', notificationId);
    return true;
  } catch (error) {
    console.error('❌ [Notifications] Erreur marquage comme lu:', error);
    throw error;
  }
};

/** Durée d'affichage des notifications lues dans le panneau cloche (ms) */
export const READ_NOTIFICATION_RETENTION_MS = 24 * 60 * 60 * 1000;

const applyNotificationRoleFilters = (query, userId, userRole) => {
  if (userRole === 'doctor') {
    return query
      .eq('medecin_id', userId)
      .in('type_notification', ['patient_on_way', 'doctor_request', 'demande_autorisation']);
  }
  if (userRole === 'secretary') {
    return query
      .eq('secretaire_id', userId)
      .neq('type_notification', 'patient_on_way')
      .neq('type_notification', 'doctor_request');
  }
  if (userRole === 'caissier' || userRole === 'cashier') {
    return query.eq('caissier_id', userId);
  }
  return query;
};

/**
 * Notifications visibles dans le panneau cloche : non lues + lues depuis moins de 24 h
 */
export const getDisplayNotifications = async (userId, userRole, limit = 10) => {
  try {
    const { data: user } = await supabase.from('users').select('tenant_id').eq('id', userId).single();
    const cabinetId = user?.tenant_id;
    const readCutoff = new Date(Date.now() - READ_NOTIFICATION_RETENTION_MS).toISOString();

    let query = supabase
      .from('notifications_medecin_secretaire')
      .select(`
        *,
        medecin:users!notifications_medecin_secretaire_medecin_id_fkey(id, nom, prenom),
        secretaire:users!notifications_medecin_secretaire_secretaire_id_fkey(id, nom, prenom),
        patient:patients(id, nom, prenom)
      `)
      .or(`lu.eq.false,and(lu.eq.true,lu_at.gte.${readCutoff})`)
      .order('created_at', { ascending: false })
      .limit(limit * 3);

    if (cabinetId) {
      query = query.eq('tenant_id', cabinetId);
    }

    query = applyNotificationRoleFilters(query, userId, userRole);

    const { data, error } = await query;

    if (error) {
      console.error('❌ [Notifications] Erreur requête getDisplayNotifications:', error);
      throw error;
    }

    return deduplicateNotifications(
      (data || []).filter((n) => isNotificationForUser(n, userId, userRole))
    ).slice(0, limit);
  } catch (error) {
    console.error('❌ [Notifications] Erreur récupération notifications affichables:', error);
    return [];
  }
};

/**
 * Récupérer les notifications non lues d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur ('doctor' ou 'secretary')
 */
export const getUnreadNotifications = async (userId, userRole) => {
  try {
    const { data: user } = await supabase.from('users').select('tenant_id').eq('id', userId).single();
    const cabinetId = user?.tenant_id;

    let query = supabase
      .from('notifications_medecin_secretaire')
      .select(`
        *,
        medecin:users!notifications_medecin_secretaire_medecin_id_fkey(id, nom, prenom),
        secretaire:users!notifications_medecin_secretaire_secretaire_id_fkey(id, nom, prenom),
        patient:patients(id, nom, prenom)
      `)
      .eq('lu', false)
      .order('created_at', { ascending: false });

    if (cabinetId) {
      query = query.eq('tenant_id', cabinetId);
    }

    query = applyNotificationRoleFilters(query, userId, userRole);

    const { data, error } = await query;

    if (error) {
      console.error('❌ [Notifications] Erreur requête getUnreadNotifications:', error);
      throw error;
    }
    
    const filteredData = deduplicateNotifications(
      (data || []).filter((n) => isNotificationForUser(n, userId, userRole))
    );

    return filteredData;
  } catch (error) {
    console.error('❌ [Notifications] Erreur récupération notifications:', error);
    return [];
  }
};

/**
 * Récupérer toutes les notifications d'un utilisateur (lues et non lues)
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur ('doctor' ou 'secretary')
 * @param {number} limit - Nombre maximum de notifications à récupérer
 */
export const getAllNotifications = async (userId, userRole, limit = 50) => {
  try {
    const { data: user } = await supabase.from('users').select('tenant_id').eq('id', userId).single();
    const cabinetId = user?.tenant_id;

    // Calculer la date d'aujourd'hui (minuit)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();

    let query = supabase
      .from('notifications_medecin_secretaire')
      .select(`
        *,
        medecin:users!notifications_medecin_secretaire_medecin_id_fkey(id, nom, prenom),
        secretaire:users!notifications_medecin_secretaire_secretaire_id_fkey(id, nom, prenom),
        patient:patients(id, nom, prenom)
      `)
      .gte('created_at', todayStart)
      .order('created_at', { ascending: false })
      .limit(limit * 2);

    if (cabinetId) {
      query = query.eq('tenant_id', cabinetId);
    }

    // Filtrer selon le rôle
    if (userRole === 'doctor') {
      // Le médecin reçoit UNIQUEMENT les notifications "patient_on_way" et "demande_autorisation"
      query = query
        .eq('medecin_id', userId)
        .in('type_notification', ['patient_on_way', 'doctor_request', 'demande_autorisation']);
    } else if (userRole === 'secretary') {
      query = query
        .eq('secretaire_id', userId)
        .neq('type_notification', 'patient_on_way')
        .neq('type_notification', 'doctor_request');
    } else if (userRole === 'caissier' || userRole === 'cashier') {
      // Le caissier reçoit uniquement les notifications qui lui sont destinées
      query = query
        .eq('caissier_id', userId);
    }

    console.log('🔍 [Notifications] Exécution de la requête getAllNotifications...');
    const { data, error } = await query;

    if (error) {
      console.error('❌ [Notifications] Erreur requête getAllNotifications:', error);
      console.error('❌ [Notifications] Détails de l\'erreur:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    let filteredData = deduplicateNotifications(
      (data || []).filter((n) => isNotificationForUser(n, userId, userRole))
    );

    filteredData = filteredData.slice(0, limit);

    return filteredData;
  } catch (error) {
    console.error('❌ [Notifications] Erreur récupération toutes notifications:', error);
    return [];
  }
};

/**
 * Marquer toutes les notifications comme lues
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur ('doctor' ou 'secretary')
 */
export const markAllAsRead = async (userId, userRole) => {
  try {
    const { data: user } = await supabase.from('users').select('tenant_id').eq('id', userId).single();
    const cabinetId = user?.tenant_id;

    let query = supabase
      .from('notifications_medecin_secretaire')
      .update({ 
        lu: true, 
        lu_at: new Date().toISOString() 
      })
      .eq('lu', false);

    if (cabinetId) {
      query = query.eq('tenant_id', cabinetId);
    }

    // Filtrer selon le rôle
    if (userRole === 'doctor') {
      // Le médecin marque UNIQUEMENT ses notifications autorisées
      query = query
        .eq('medecin_id', userId)
        .in('type_notification', ['patient_on_way', 'doctor_request', 'demande_autorisation']);
    } else if (userRole === 'secretary') {
      query = query
        .eq('secretaire_id', userId)
        .neq('type_notification', 'patient_on_way')
        .neq('type_notification', 'doctor_request');
    }

    const { error } = await query;

    if (error) throw error;
    
    console.log('✅ [Notifications] Toutes les notifications marquées comme lues');
    return true;
  } catch (error) {
    console.error('❌ [Notifications] Erreur marquage toutes comme lues:', error);
    throw error;
  }
};

/**
 * Supprimer une notification
 * @param {string} notificationId - ID de la notification
 */
export const deleteNotification = async (notificationId) => {
  try {
    const { error } = await supabase
      .from('notifications_medecin_secretaire')
      .delete()
      .eq('id', notificationId);

    if (error) throw error;
    
    console.log('✅ [Notifications] Notification supprimée:', notificationId);
    return true;
  } catch (error) {
    console.error('❌ [Notifications] Erreur suppression notification:', error);
    throw error;
  }
};

/**
 * S'abonner aux notifications en temps réel
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur ('doctor' ou 'secretary')
 * @param {function} callback - Fonction à appeler lors d'une nouvelle notification
 */
export const subscribeToNotifications = (userId, userRole, callback) => {
  try {
    if (userRole === 'doctor') {
      // Le médecin écoute uniquement ses notifications
      // Convertir l'UUID auth.users vers le bigint de la table users
      const getDoctorBigintId = async (uuid) => {
        // Si c'est déjà un nombre, retourner directement
        if (!isNaN(uuid) && Number(uuid) > 0) {
          console.log('🔔 [Notifications] ID déjà numérique:', uuid);
          return Number(uuid);
        }
        
        // Sinon chercher par auth_id
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', uuid)
          .single();
        
        if (error || !data) {
          console.error('❌ [Notifications] Erreur récupération ID bigint:', error);
          return null;
        }
        
        return data.id;
      };

      // Obtenir l'ID bigint puis s'abonner
      return getDoctorBigintId(userId).then(bigintId => {
        if (!bigintId) {
          console.error('❌ [Notifications] ID bigint non trouvé pour:', userId);
          return null;
        }

        console.log('🔔 [Notifications] Abonnement médecin avec ID bigint:', bigintId);
        
        const channel = supabase
          .channel(`notifications_doctor_${bigintId}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'notifications_medecin_secretaire',
            filter: `medecin_id=eq.${bigintId}`
          }, (payload) => {
            console.log('🔔 [Notifications] Changement détecté:', payload);
            if (callback) callback(payload);
          })
          .subscribe((status) => {
            console.log('📡 [Notifications] Statut abonnement:', status);
          });
        return channel;
      });
    } else if (userRole === 'secretary') {
      const channel = supabase
        .channel(`notifications_secretary_${userId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notifications_medecin_secretaire',
          filter: `secretaire_id=eq.${userId}`,
        }, (payload) => {
          const record = payload.new || payload.old;
          if (record && !isNotificationForUser(record, userId, userRole)) {
            return;
          }
          if (callback) callback(payload);
        })
        .subscribe((status) => {
          console.log('📡 [Notifications] Statut abonnement:', status);
        });
      return channel;
    }
    
    return null;
  } catch (error) {
    console.error('❌ [Notifications] Erreur abonnement temps réel:', error);
    return null;
  }
};

/**
 * Se désabonner des notifications
 * @param {object} channel - Canal Supabase à désabonner
 */
export const unsubscribeFromNotifications = async (channel) => {
  try {
    if (!channel) {
      console.log('⚠️ [Notifications] Aucun channel à désabonner');
      return;
    }

    // Try to unsubscribe using the channel's own method if available
    if (typeof channel.unsubscribe === 'function') {
      await channel.unsubscribe();
      console.log('✅ [Notifications] Désabonnement effectué (channel.unsubscribe)');
      return;
    }

    // Fallback: try Supabase client method
    if (typeof supabase.removeChannel === 'function') {
      try {
        supabase.removeChannel(channel);
        console.log('✅ [Notifications] Désabonnement effectué (supabase.removeChannel)');
        return;
      } catch (removeError) {
        console.log('⚠️ [Notifications] removeChannel a échoué, channel ignoré');
      }
    }

    // If neither method works, log and continue
    console.log('🔌 [Notifications] Channel ignoré (méthodes non disponibles)');
  } catch (error) {
    // Silently ignore errors - this is a cleanup operation
    console.log('⚠️ [Notifications] Erreur lors du cleanup (ignorée):', error.message);
  }
};
