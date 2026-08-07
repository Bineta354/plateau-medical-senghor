/** Statuts terminés — exclus des compteurs « actifs » */
export const WAITING_QUEUE_TERMINAL_STATUSES = [
  'finished',
  'termine',
  'absent',
  'reporte',
  'annule',
  'cancelled',
  'non_honore',
];

/** Statuts actifs utilisés dans les requêtes Supabase */
export const WAITING_QUEUE_ACTIVE_STATUSES = [
  'waiting',
  'en_attente',
  'present',
  'arrive',
  'authorized',
  'called',
  'appele',
  'en_route',
  'medecin_pret',
  'entre',
  'in_consultation',
  'en_consultation',
];

export const normalizeQueueStatus = (status) =>
  String(status ?? '')
    .toLowerCase()
    .trim();

export const isTerminalQueueStatus = (status) =>
  WAITING_QUEUE_TERMINAL_STATUSES.includes(normalizeQueueStatus(status));

/** Patient encore dans le parcours file / salle d'attente (non terminé) */
export const isActiveQueueStatus = (status) => {
  const normalized = normalizeQueueStatus(status);
  if (!normalized) return false;
  return !isTerminalQueueStatus(normalized);
};

export const isStrictlyWaitingStatus = (status) =>
  ['waiting', 'en_attente'].includes(normalizeQueueStatus(status));

export const isPresentInQueueStatus = (status) =>
  ['present', 'arrive', 'authorized'].includes(normalizeQueueStatus(status));

export const isCalledInQueueStatus = (status) =>
  ['called', 'appele', 'medecin_pret', 'en_route'].includes(
    normalizeQueueStatus(status),
  );

export const isInConsultationQueueStatus = (status) =>
  ['in_consultation', 'en_consultation', 'entre'].includes(
    normalizeQueueStatus(status),
  );

/** En salle d'attente mais pas encore en consultation */
export const isOnWaitingBench = (status) =>
  isActiveQueueStatus(status) && !isInConsultationQueueStatus(status);

export const filterActiveQueueItems = (items) =>
  (items || []).filter((item) => isActiveQueueStatus(item?.status));

export const computeQueueStats = (items) => {
  const active = filterActiveQueueItems(items);
  return {
    total: active.length,
    inWaitingRoom: active.length,
    waiting: active.filter((p) => isStrictlyWaitingStatus(p.status)).length,
    present: active.filter((p) => isPresentInQueueStatus(p.status)).length,
    called: active.filter((p) => isCalledInQueueStatus(p.status)).length,
    inConsultation: active.filter((p) => isInConsultationQueueStatus(p.status))
      .length,
    onBench: active.filter((p) => isOnWaitingBench(p.status)).length,
    urgent: active.filter((p) => isUrgentQueuePriority(p.priority)).length,
  };
};

export const isUrgentQueuePriority = (priority) =>
  priority === 'urgente' || priority === 'tres_urgente';

/** Filtre UI secrétaire (SecretaryDashboard / files d'attente) */
export const matchesQueueFilterStatus = (filterStatus, patientStatus) => {
  if (!filterStatus || filterStatus === 'all') {
    return isActiveQueueStatus(patientStatus);
  }
  if (filterStatus === 'finished') {
    return isTerminalQueueStatus(patientStatus);
  }
  if (filterStatus === 'urgent') {
    return isActiveQueueStatus(patientStatus);
  }

  const status = normalizeQueueStatus(patientStatus);

  switch (filterStatus) {
    case 'waiting':
      return isStrictlyWaitingStatus(status);
    case 'appele':
      return isCalledInQueueStatus(status);
    case 'entre':
      return status === 'entre' || isPresentInQueueStatus(status);
    case 'in_consultation':
      return isInConsultationQueueStatus(status);
    default:
      return status === normalizeQueueStatus(filterStatus);
  }
};

/**
 * Vérifie si un patient en file d'attente a un rendez-vous "passé".
 *
 * Historique / pourquoi cette fonction ne fait plus rien :
 * Elle comparait l'heure de fin théorique du RDV (date_heure + durée) à
 * "maintenant" pour détecter les patients ajoutés automatiquement à
 * waiting_queue par un trigger BDD (trg_after_insert_appointment_to_queue,
 * exécuté à la CRÉATION du rendez-vous, avant toute arrivée réelle) qui
 * ne s'étaient jamais présentés — d'où le statut "non honoré".
 *
 * Ce trigger a été supprimé (migration
 * 20260731000000_remove_auto_waiting_queue_trigger.sql). Depuis, toute
 * ligne dans waiting_queue est créée exclusivement au moment où le
 * patient est physiquement présent (confirmation de présence secrétaire,
 * accueil d'un walk-in, ajout depuis la salle d'attente, etc.) — jamais
 * à la simple création du RDV. Le statut "waiting" ne signifie donc plus
 * "pas encore arrivé", mais "arrivé, en attente d'être appelé".
 *
 * Comparer ces lignes à l'heure de fin théorique du créneau initial est
 * donc devenu un faux positif garanti : dès que le créneau d'origine
 * (souvent 30 min) est dépassé — ce qui arrive dès que le médecin prend
 * du retard — un patient pourtant bien présent se voyait badgé "Retard"
 * (SalleAttentePage), réétiqueté "Terminé" (DoctorSpecificQueue) ou pire,
 * automatiquement marqué "non_honore" en base et sorti de la file active
 * (GlobalWaitingQueue) alors qu'il attendait toujours sur place.
 *
 * On neutralise donc volontairement cette fonction (retourne toujours
 * false) plutôt que de supprimer tous les appelants un par un — voir
 * FIX_ETAPE_1_SECRETAIRE.md, point 5.
 */
export const hasPastAppointment = () => false;

/** Vérifie si une consultation est bloquée depuis trop longtemps (plus de 2 heures) */
export const isStuckInConsultation = (queueItem, now = new Date(), maxHours = 2) => {
  if (!isInConsultationQueueStatus(queueItem?.status)) return false;
  
  const consultationStart = new Date(queueItem.updated_at || queueItem.created_at);
  const hoursSinceStart = (now.getTime() - consultationStart.getTime()) / (1000 * 60 * 60);
  
  return hoursSinceStart > maxHours;
};

/** Filtre les patients en file d'attente pour exclure ceux avec des rendez-vous passés */
export const filterOutPastAppointments = (queueItems, now = new Date()) => {
  return (queueItems || []).filter(item => !hasPastAppointment(item, now));
};

/** Filtre les patients avec consultations bloquées depuis trop longtemps */
export const filterOutStuckConsultations = (queueItems, now = new Date(), maxHours = 2) => {
  return (queueItems || []).filter(item => !isStuckInConsultation(item, now, maxHours));
};

export const isAbandonedOver24h = (queueItem, now = new Date(), maxHours = 24) => {
  if (!queueItem) return false;
  const start = new Date(queueItem.arrived_at || queueItem.created_at);
  if (isNaN(start.getTime())) return false;
  const hoursSince = (now - start) / (1000 * 60 * 60);
  return hoursSince > maxHours;
};
