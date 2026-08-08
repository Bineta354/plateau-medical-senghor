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
      users ( prenom, nom )
    `)
    .order('date_reversement', { ascending: false })
    .limit(limit);
  if (dateDebut) q = q.gte('date_reversement', dateDebut);
  if (dateFin) q = q.lte('date_reversement', dateFin);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
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
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
