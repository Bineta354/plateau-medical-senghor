import { supabase } from '../lib/supabase';

/**
 * Encapsule la table `sessions_caisse` (ouverture/fermeture quotidienne de la caisse) et les
 * RPC `fermer_session_caisse` / `get_arrete_comptable_mensuel`, jusqu'ici appelées directement
 * dans src/pages/secretary/Caisse.jsx (×6 : select session ouverte, select alertes,
 * select vérif avant ouverture, insert, rpc fermer_session_caisse, rpc get_arrete_comptable_mensuel)
 * et src/pages/caissier/ArreteMensuel.jsx (rpc get_arrete_comptable_mensuel).
 */

/**
 * Session de caisse ouverte du jour pour un caissier donné (ou session "sans caissier" —
 * `caissier_id is null` — utilisée par le secrétariat) — remplace
 * src/pages/secretary/Caisse.jsx:345-367 (fetchSessionCaisse) et la vérification faite
 * avant ouverture à src/pages/secretary/Caisse.jsx:1174-1187 (même requête).
 *
 * @param {Object} [params]
 * @param {number|string|null} [params.caissierId] - null/omis => session sans caissier (`is('caissier_id', null)`)
 * @param {string} [params.dateSession] - format 'YYYY-MM-DD', défaut aujourd'hui
 * @returns {Promise<Object|null>}
 */
export async function getSessionOuverte({ caissierId = null, dateSession } = {}) {
  const jour = dateSession || new Date().toISOString().split('T')[0];
  let q = supabase
    .from('sessions_caisse')
    .select('*')
    .eq('date_session', jour)
    .eq('statut', 'ouverte');
  q = caissierId != null && caissierId !== '' ? q.eq('caissier_id', caissierId) : q.is('caissier_id', null);
  const { data, error } = await q.maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

/**
 * Liste de toutes les sessions de caisse actuellement ouvertes (tous caissiers confondus) —
 * remplace src/pages/secretary/Caisse.jsx:401-405 (utilisée dans fetchSupervisionData pour
 * générer les alertes "session(s) ouverte(s)").
 *
 * @returns {Promise<Array<Object>>}
 */
export async function getAlertes() {
  const { data, error } = await supabase.from('sessions_caisse').select('*').eq('statut', 'ouverte');
  if (error) throw error;
  return data || [];
}

/**
 * Ouvre une nouvelle session de caisse avec un fond de caisse initial, après avoir vérifié
 * qu'aucune session n'est déjà ouverte aujourd'hui pour ce caissier — remplace
 * src/pages/secretary/Caisse.jsx:1174-1206 (handleOpenCaisse : vérification + insert).
 * Lève une erreur `SESSION_DEJA_OUVERTE` si une session est déjà ouverte (à l'appelant de
 * traduire ce code en message utilisateur, comme le fait actuellement la page).
 *
 * @param {Object} params
 * @param {number|string|null} [params.caissierId]
 * @param {number} [params.fondCaisse=0]
 * @param {string} [params.dateSession] - format 'YYYY-MM-DD', défaut aujourd'hui
 * @returns {Promise<Object>} la session créée
 */
export async function ouvrirSession({ caissierId = null, fondCaisse = 0, dateSession } = {}) {
  const jour = dateSession || new Date().toISOString().split('T')[0];
  const existing = await getSessionOuverte({ caissierId, dateSession: jour });
  if (existing) {
    throw new Error('SESSION_DEJA_OUVERTE');
  }
  const { data, error } = await supabase
    .from('sessions_caisse')
    .insert({
      date_session: jour,
      fond_caisse: Number(fondCaisse) || 0,
      caissier_id: caissierId,
      statut: 'ouverte',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Ferme une session de caisse (le calcul du montant journalier est fait côté serveur par la
 * fonction SQL) — remplace src/pages/secretary/Caisse.jsx:1234-1237 (handleCloseCaisse).
 *
 * @param {number|string} sessionId
 * @returns {Promise<Object>} résultat de la RPC (inclut `montant_journalier`)
 */
export async function fermerSession(sessionId) {
  if (!sessionId) throw new Error('sessionId requis');
  const { data, error } = await supabase.rpc('fermer_session_caisse', { p_session_id: sessionId });
  if (error) throw error;
  return data;
}

/**
 * Arrêté comptable mensuel (fonds de caisse, encaissements, solde par jour de session) —
 * remplace src/pages/secretary/Caisse.jsx:1269-1282 (fetchArreteMensuel) et
 * src/pages/caissier/ArreteMensuel.jsx:25-41 (fetchArrete).
 *
 * @param {Object} params
 * @param {number} params.annee
 * @param {number} params.mois - 1-12
 * @returns {Promise<Array<Object>>}
 */
export async function getArreteComptableMensuel({ annee, mois } = {}) {
  if (!annee || !mois) throw new Error('annee et mois requis');
  const { data, error } = await supabase.rpc('get_arrete_comptable_mensuel', {
    p_annee: annee,
    p_mois: mois,
  });
  if (error) throw error;
  return data || [];
}
