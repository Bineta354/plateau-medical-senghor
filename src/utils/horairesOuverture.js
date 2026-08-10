/**
 * Lecture des horaires/jours ouvrables du cabinet (parametres_cabinet.horaires_ouverture,
 * exposés partout via usePersonnalisation()) et génération des créneaux de RDV qui en
 * découlent. Utilisé par le calendrier (NewCalendar) et les deux modales de prise de RDV
 * (RdvCreationModal et NewAppointmentModal/useAppointmentForm) pour qu'un jour fermé ou
 * une heure hors plage d'ouverture ne puisse pas être sélectionné.
 */

// Index JS de Date.getDay() (0 = dimanche) -> clé utilisée dans horaires_ouverture
export const JOURS_SEMAINE = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export const DEFAULT_HORAIRES_OUVERTURE = {
  lundi: { ouvert: true, debut: '08:00', fin: '18:00' },
  mardi: { ouvert: true, debut: '08:00', fin: '18:00' },
  mercredi: { ouvert: true, debut: '08:00', fin: '18:00' },
  jeudi: { ouvert: true, debut: '08:00', fin: '18:00' },
  vendredi: { ouvert: true, debut: '08:00', fin: '18:00' },
  samedi: { ouvert: false, debut: '08:00', fin: '12:00' },
  dimanche: { ouvert: false, debut: '', fin: '' },
};

export const getJourKey = (date) => JOURS_SEMAINE[new Date(date).getDay()];

/**
 * Retourne { ouvert, debut, fin } du jour de `date`, ou null si le cabinet est
 * fermé ce jour-là (ou si les horaires de ce jour sont incomplets).
 */
export const getHoraireDuJour = (horairesOuverture, date) => {
  if (!date) return null;
  const horaire = horairesOuverture?.[getJourKey(date)];
  if (!horaire || !horaire.ouvert || !horaire.debut || !horaire.fin) return null;
  return horaire;
};

export const isJourOuvrable = (horairesOuverture, date) => !!getHoraireDuJour(horairesOuverture, date);

const parseHeure = (value) => {
  const [h, m] = String(value || '00:00').split(':').map((v) => parseInt(v, 10));
  return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
};

/**
 * Génère les créneaux du jour `date` pour un médecin, bornés par les horaires
 * d'ouverture du cabinet ce jour-là (rien n'est généré si le cabinet est fermé).
 */
export const generateDoctorTimeSlotsForDay = ({
  date,
  horairesOuverture,
  doctorAppointments = [],
  duree = 30,
  editingAppointmentId = null,
  stepMinutes = 30,
}) => {
  const horaire = getHoraireDuJour(horairesOuverture, date);
  if (!horaire) return [];

  const { h: startH, m: startM } = parseHeure(horaire.debut);
  const { h: endH, m: endM } = parseHeure(horaire.fin);

  const closing = new Date(date);
  closing.setHours(endH, endM, 0, 0);

  const cursor = new Date(date);
  cursor.setHours(startH, startM, 0, 0);

  const slots = [];
  while (cursor < closing) {
    const slotDate = new Date(cursor);
    const slotEnd = new Date(slotDate.getTime() + (duree || 30) * 60000);

    const isOccupied = doctorAppointments.some((apt) => {
      if (editingAppointmentId && apt.id === editingAppointmentId) return false;
      if (apt.statut === 'annule') return false;
      const aptStart = new Date(apt.date_heure);
      const aptEnd = new Date(aptStart.getTime() + (apt.duree || 30) * 60000);
      return aptStart < slotEnd && aptEnd > slotDate;
    });

    slots.push({
      time: `${slotDate.getHours().toString().padStart(2, '0')}:${slotDate.getMinutes().toString().padStart(2, '0')}`,
      iso: slotDate.toISOString(),
      isOccupied,
    });

    cursor.setMinutes(cursor.getMinutes() + stepMinutes);
  }

  return slots;
};
