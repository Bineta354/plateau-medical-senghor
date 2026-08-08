import { supabase } from '../lib/supabase';

/**
 * Wrapper autour des RPC de workflow "présence patient" (`confirm_patient_entry_basesql`
 * et `secretaire_confirme_patient_presence`), jusqu'ici appelées directement et de façon
 * dupliquée à l'identique à plusieurs endroits :
 * - src/pages/IntroductionPatientPage.jsx (handleConfirmPatientPresence, ligne ~653 ;
 *   handleConfirmPatientEntry, ligne ~742)
 * - src/pages/rendez-vous/PriseRendezVousPage.jsx (handleConfirmPatientPresence, ligne ~132)
 * - src/components/secretary/DoctorSpecificQueue.jsx (ligne ~296) — même RPC/paramètres
 *   que ci-dessus, non modifié par ce chantier (hors périmètre "pages")
 * - src/components/notifications/NotificationSystem.jsx (ligne ~258) — même RPC/paramètres
 *   que confirm_patient_entry_basesql ci-dessous, non modifié par ce chantier
 *
 * Les 4 call sites recensés utilisent exactement la même forme de paramètres pour
 * chaque RPC (aucune divergence à réconcilier) : `p_appointment_id` + `p_secretaire_id`
 * pour secretaire_confirme_patient_presence, `p_waiting_queue_id` + `p_secretaire_id`
 * pour confirm_patient_entry_basesql.
 */

/**
 * Confirme la présence physique d'un patient pour un rendez-vous donné (le fait
 * passer en salle d'attente). Retourne notamment `medecin_id` et `patient_id` dans
 * `data`, utilisés par l'appelant pour notifier le médecin.
 * @param {number|string} appointmentId
 * @param {number|string} secretaireId
 * @returns {Promise<{success?: boolean, medecin_id?: number, patient_id?: number, message?: string, error?: string}>}
 */
export async function confirmerPresencePatient(appointmentId, secretaireId) {
  const { data, error } = await supabase.rpc('secretaire_confirme_patient_presence', {
    p_appointment_id: appointmentId,
    p_secretaire_id: secretaireId,
  });
  if (error) throw error;
  return data;
}

/**
 * Confirme l'entrée en consultation d'un patient déjà en file d'attente
 * (transition de statut de la file d'attente) — reproduit
 * IntroductionPatientPage.jsx → handleConfirmPatientEntry (ligne ~742).
 * @param {number|string} waitingQueueId
 * @param {number|string} secretaireId
 */
export async function confirmerEntreePatient(waitingQueueId, secretaireId) {
  const { data, error } = await supabase.rpc('confirm_patient_entry_basesql', {
    p_waiting_queue_id: waitingQueueId,
    p_secretaire_id: secretaireId,
  });
  if (error) throw error;
  return data;
}
