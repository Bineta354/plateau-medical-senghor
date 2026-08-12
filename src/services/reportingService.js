import { supabase } from '../lib/supabase';

/**
 * Wrapper autour du RPC `get_resume_global` et des vues `statistiques_*`
 * utilisées par les écrans de reporting. Extrait des appels directs faits dans :
 * - src/pages/reporting/Reporting.jsx
 * - src/pages/rendez-vous/StatistiquesRealtime.jsx
 *
 * Ces vues/RPC n'avaient aucun service dédié avant ce fichier (voir
 * AUDIT_APPELS_DIRECTS_DB.md, section 4, recommandation 7).
 */

/**
 * Résumé global (KPIs) sur une période — reproduit
 * src/pages/reporting/Reporting.jsx → chargerResumeGlobal() (lignes ~69-81).
 * @param {string} dateDebut - format 'YYYY-MM-DD'
 * @param {string} dateFin - format 'YYYY-MM-DD'
 */
export async function getResumeGlobal(dateDebut, dateFin) {
  const { data, error } = await supabase.rpc('get_resume_global', {
    date_debut: dateDebut,
    date_fin: dateFin,
  });
  if (error) throw error;
  return data || [];
}

/**
 * Statistiques de consultations par spécialité sur une période — reproduit
 * Reporting.jsx → chargerConsultationsSpecialites() (lignes ~83-96).
 * @param {string} dateDebut
 * @param {string} dateFin
 */
export async function getStatsParSpecialite(dateDebut, dateFin) {
  const { data, error } = await supabase
    .from('statistiques_consultations_specialites')
    .select('*')
    .gte('premiere_consultation', dateDebut)
    .lte('derniere_consultation', dateFin);
  if (error) throw error;
  return data || [];
}

/**
 * Statistiques de consultations par médecin (top 10) sur une période — reproduit
 * Reporting.jsx → chargerConsultationsMedecins() (lignes ~98-112).
 * @param {string} dateDebut
 * @param {string} dateFin
 */
export async function getStatsParMedecin(dateDebut, dateFin) {
  const { data, error } = await supabase
    .from('statistiques_consultations_medecins')
    .select('*')
    .gte('premiere_consultation', dateDebut)
    .lte('derniere_consultation', dateFin)
    .limit(10);
  if (error) throw error;
  return data || [];
}

/**
 * Statistiques d'actes par type (top 10, actes > 0) — reproduit
 * Reporting.jsx → chargerActesTypes() (lignes ~114-127).
 */
export async function getStatsActes() {
  const { data, error } = await supabase
    .from('statistiques_actes_types')
    .select('*')
    .gt('nombre_actes', 0)
    .limit(10);
  if (error) throw error;
  return data || [];
}

/**
 * Statistiques de certificats médicaux (certificats > 0) — reproduit
 * Reporting.jsx → chargerCertificats() (lignes ~129-141).
 */
export async function getStatsCertificats() {
  const { data, error } = await supabase
    .from('statistiques_certificats')
    .select('*')
    .gt('nombre_certificats', 0);
  if (error) throw error;
  return data || [];
}

/**
 * Chiffre d'affaires par spécialité (consultations > 0) — reproduit
 * Reporting.jsx → chargerFinancesSpecialites() (lignes ~143-155).
 */
export async function getFinancesParSpecialite() {
  const { data, error } = await supabase
    .from('statistiques_finances_specialites')
    .select('*')
    .gt('nombre_consultations', 0);
  if (error) throw error;
  return data || [];
}

/**
 * Chiffre d'affaires par médecin (top 10, consultations > 0) — reproduit
 * Reporting.jsx → chargerFinancesMedecins() (lignes ~157-170).
 */
export async function getFinancesParMedecin() {
  const { data, error } = await supabase
    .from('statistiques_finances_medecins')
    .select('*')
    .gt('nombre_consultations', 0)
    .limit(10);
  if (error) throw error;
  return data || [];
}

/**
 * Revenus par type d'acte (top 10, actes > 0) — reproduit
 * Reporting.jsx → chargerFinancesActes() (lignes ~172-185).
 */
export async function getFinancesParActe() {
  const { data, error } = await supabase
    .from('statistiques_finances_actes')
    .select('*')
    .gt('nombre_actes', 0)
    .limit(10);
  if (error) throw error;
  return data || [];
}

/**
 * Statistiques temps réel (table `statistiques_realtime`), filtrables par médecin
 * et par période — reproduit
 * src/pages/rendez-vous/StatistiquesRealtime.jsx → fetchStatistiques() (lignes ~56-85).
 * @param {Object} [params]
 * @param {number|string} [params.medecinId] - filtre optionnel sur medecin_id
 * @param {'aujourd_hui'|'semaine'|'mois'|string} [params.periode] - 'aujourd_hui' = date du jour,
 *   'semaine' = 7 derniers jours, 'mois' = 30 derniers jours, toute autre valeur = pas de filtre de date
 */
export async function getStatistiquesRealtime({ medecinId, periode } = {}) {
  let query = supabase
    .from('statistiques_realtime')
    .select('*')
    .order('date_statistique', { ascending: false });

  if (medecinId) {
    query = query.eq('medecin_id', medecinId);
  }

  if (periode === 'aujourd_hui') {
    query = query.eq('date_statistique', new Date().toISOString().split('T')[0]);
  } else if (periode === 'semaine') {
    const dateLimite = new Date();
    dateLimite.setDate(dateLimite.getDate() - 7);
    query = query.gte('date_statistique', dateLimite.toISOString().split('T')[0]);
  } else if (periode === 'mois') {
    const dateLimite = new Date();
    dateLimite.setMonth(dateLimite.getMonth() - 1);
    query = query.gte('date_statistique', dateLimite.toISOString().split('T')[0]);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
