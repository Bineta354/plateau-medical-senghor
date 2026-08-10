import { supabase } from '../lib/supabase';

/**
 * CRUD basique sur `reversements_bancaires`, appelée directement dans
 * src/pages/caissier/ReversementBancaire.jsx:53-73 (fetchReversements) et
 * src/pages/caissier/ReversementBancaire.jsx:97-106 (handleSubmit).
 */

/**
 * Historique des reversements bancaires (avec le caissier qui les a enregistrés) —
 * remplace src/pages/caissier/ReversementBancaire.jsx:53-73 (fetchReversements).
 *
 * @param {Object} [params]
 * @param {string} [params.dateDebut] - format 'YYYY-MM-DD', filtre gte sur date_reversement
 * @param {string} [params.dateFin] - format 'YYYY-MM-DD', filtre lte sur date_reversement
 * @param {number} [params.limit=500]
 * @returns {Promise<Array<Object>>}
 */
export async function listReversements({ dateDebut, dateFin, limit = 500 } = {}) {
  let q = supabase
    .from('reversements_bancaires')
    .select(`
      id,
      date_reversement,
      montant,
      mode,
      reference_banque,
      banque_nom,
      compte_iban,
      notes,
      caissier_id,
      session_caisse_id,
      users ( prenom, nom ),
      sessions_caisse ( date_session )
    `)
    .order('date_reversement', { ascending: false })
    .limit(limit);
  if (dateDebut) q = q.gte('date_reversement', dateDebut);
  if (dateFin) q = q.lte('date_reversement', dateFin);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// Garde-fou sur le volume de paiements chargés pour reconstituer la répartition par mode d'une
// période — même logique que COUVERTURE_FETCH_LIMIT (src/config/creances.js) : un plafond de
// sécurité, pas une pagination, pour ne jamais planter sur un gros mois sans avertir.
const PAIEMENTS_FETCH_LIMIT = 3000;

/**
 * Sessions de caisse clôturées sur une période, enrichies de la répartition des encaissements
 * par mode de paiement (espèces / wave / carte / ...) et du montant déjà reversé en banque pour
 * chacune — sert à afficher, pour "fin de session", ce qui a été encaissé et ce qu'il reste à
 * mettre en banque, et à pré-remplir un reversement lié (session_caisse_id) depuis cette liste.
 *
 * Seules les sessions déjà fermées sont retournées : `montant_journalier` n'est calculé par
 * `fermer_session_caisse` qu'à la fermeture (voir la RPC), une session ouverte n'a donc pas de
 * total fiable à reverser.
 *
 * @param {Object} [params]
 * @param {string} [params.dateDebut] - format 'YYYY-MM-DD'
 * @param {string} [params.dateFin] - format 'YYYY-MM-DD'
 * @returns {Promise<{ sessions: Array<Object>, truncated: boolean }>}
 */
export async function getSessionsAvecEncaissements({ dateDebut, dateFin } = {}) {
  let sessionsQuery = supabase
    .from('sessions_caisse')
    .select('id, date_session, caissier_id, fond_caisse, montant_journalier, solde_final, users ( prenom, nom )')
    .eq('statut', 'fermee')
    .order('date_session', { ascending: false });
  if (dateDebut) sessionsQuery = sessionsQuery.gte('date_session', dateDebut);
  if (dateFin) sessionsQuery = sessionsQuery.lte('date_session', dateFin);
  const { data: sessions, error: sessionsError } = await sessionsQuery;
  if (sessionsError) throw sessionsError;
  if (!sessions || sessions.length === 0) return { sessions: [], truncated: false };

  const sessionIds = sessions.map((s) => s.id);

  // Même prédicat que la fonction SQL calculer_montant_journalier_session : les paiements d'un
  // jour donné sont attribués à la session dont la date correspond ET dont caissier_id
  // correspond (y compris les deux `null` pour une session "sans caissier").
  let paiementsQuery = supabase
    .from('paiements')
    .select('montant, mode_paiement, caissier_id, date_paiement')
    .eq('statut', 'effectue')
    .order('date_paiement', { ascending: false })
    .limit(PAIEMENTS_FETCH_LIMIT);
  if (dateDebut) paiementsQuery = paiementsQuery.gte('date_paiement', `${dateDebut}T00:00:00`);
  if (dateFin) paiementsQuery = paiementsQuery.lte('date_paiement', `${dateFin}T23:59:59`);
  const { data: paiements, error: paiementsError } = await paiementsQuery;
  if (paiementsError) throw paiementsError;
  const truncated = (paiements || []).length >= PAIEMENTS_FETCH_LIMIT;

  const { data: reversementsExistants, error: reversementsError } = await supabase
    .from('reversements_bancaires')
    .select('session_caisse_id, montant')
    .in('session_caisse_id', sessionIds);
  if (reversementsError) throw reversementsError;

  const dejaReverseParSession = (reversementsExistants || []).reduce((acc, r) => {
    if (r.session_caisse_id == null) return acc;
    acc[r.session_caisse_id] = (acc[r.session_caisse_id] || 0) + parseFloat(r.montant || 0);
    return acc;
  }, {});

  return {
    sessions: sessions.map((s) => {
      const paiementsSession = (paiements || []).filter((p) => {
        const memeJour = p.date_paiement && p.date_paiement.slice(0, 10) === s.date_session;
        const memeCaissier = s.caissier_id == null ? p.caissier_id == null : p.caissier_id === s.caissier_id;
        return memeJour && memeCaissier;
      });
      const parMode = paiementsSession.reduce((acc, p) => {
        const mode = p.mode_paiement || 'autre';
        acc[mode] = (acc[mode] || 0) + parseFloat(p.montant || 0);
        return acc;
      }, {});
      const especes = parMode.especes || 0;
      const dejaReverse = dejaReverseParSession[s.id] || 0;

      return {
        id: s.id,
        date_session: s.date_session,
        caissier: s.users,
        fond_caisse: parseFloat(s.fond_caisse || 0),
        montant_journalier: parseFloat(s.montant_journalier || 0),
        par_mode: parMode,
        especes,
        deja_reverse: dejaReverse,
        reste_a_reverser: especes - dejaReverse,
      };
    }),
    truncated,
  };
}

/**
 * Enregistre un nouveau reversement bancaire (versement de la caisse vers le compte du
 * cabinet) — remplace src/pages/caissier/ReversementBancaire.jsx:87-107 (handleSubmit).
 *
 * @param {Object} params
 * @param {string} params.dateReversement - format 'YYYY-MM-DD'
 * @param {number} params.montant
 * @param {string} params.mode - 'virement' | 'depot_especes' | 'remise_cheques' | 'autre'
 * @param {string} [params.referenceBanque]
 * @param {string} [params.banqueNom]
 * @param {string} [params.compteIban]
 * @param {string} [params.notes]
 * @param {number|string|null} [params.caissierId]
 * @param {number|string|null} [params.sessionCaisseId] - lie le reversement à une session de
 *   caisse clôturée (traçabilité "montant encaissé ce jour" -> "montant mis en banque")
 * @returns {Promise<Object>}
 */
export async function createReversement({
  dateReversement,
  montant,
  mode,
  referenceBanque = null,
  banqueNom = null,
  compteIban = null,
  notes = null,
  caissierId = null,
  sessionCaisseId = null,
}) {
  const montantNum = parseFloat(montant);
  if (!montantNum || montantNum <= 0) throw new Error('Montant invalide');
  const { data, error } = await supabase
    .from('reversements_bancaires')
    .insert({
      date_reversement: dateReversement,
      montant: montantNum,
      mode,
      reference_banque: referenceBanque || null,
      banque_nom: banqueNom || null,
      compte_iban: compteIban || null,
      notes: notes || null,
      caissier_id: caissierId || null,
      session_caisse_id: sessionCaisseId || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
