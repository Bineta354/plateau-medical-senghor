import { supabase } from '../lib/supabase';
import { computeStatutPaiement } from '../utils/factureStatus';

/**
 * Moteur d'encaissement unique — utilisé par le guichet de caisse (Caisse.jsx)
 * et par l'écran de corrections comptables (EncaissementFactures.jsx).
 *
 * Garantit que toute opération d'encaissement ou de décaissement écrit
 * systématiquement dans `factures` (montant + statut) ET dans `paiements`
 * (ligne du grand livre), pour rester visible en caisse/récapitulatif/
 * arrêté mensuel/suivi des caissiers.
 *
 * Les deux écritures ne sont pas transactionnelles (pas de RPC dédiée pour
 * l'instant — voir le chantier DB listé séparément) : en cas d'échec de
 * l'insertion dans `paiements` après la mise à jour de `factures`, l'appelant
 * reçoit l'erreur et doit informer l'utilisateur qu'une vérification manuelle
 * peut être nécessaire.
 *
 * @param {Object} params
 * @param {number} params.factureId
 * @param {number} params.montant - positif pour un encaissement, négatif pour un décaissement/correction
 * @param {string} params.modePaiement
 * @param {string} [params.notes]
 * @param {number|null} [params.caissierId]
 * @returns {Promise<{facture: object, paiement: object}>}
 */
export async function enregistrerPaiement({
  factureId,
  montant,
  modePaiement,
  notes = null,
  caissierId = null,
}) {
  if (!factureId) throw new Error('factureId requis');
  const montantOperation = Number(montant) || 0;
  if (montantOperation === 0) throw new Error('Le montant doit être différent de 0');

  const { data: facture, error: fetchErr } = await supabase
    .from('factures')
    .select('id, montant_ttc, montant_paye')
    .eq('id', factureId)
    .single();
  if (fetchErr) throw fetchErr;

  const montantTtc = Number(facture.montant_ttc) || 0;
  const montantDejaPaye = Number(facture.montant_paye) || 0;
  const totalPaye = Math.max(0, montantDejaPaye + montantOperation);

  if (montantOperation > 0 && montantOperation > montantTtc - montantDejaPaye) {
    throw new Error('Le montant à encaisser dépasse le reste à payer');
  }
  if (montantOperation < 0 && Math.abs(montantOperation) > montantDejaPaye) {
    throw new Error('Le décaissement dépasse le montant déjà encaissé');
  }

  const nouveauStatut = computeStatutPaiement(totalPaye, montantTtc);
  const now = new Date().toISOString();

  const { data: factureMaj, error: updErr } = await supabase
    .from('factures')
    .update({
      montant_paye: totalPaye,
      statut_paiement: nouveauStatut,
      date_paiement: now,
      mode_paiement: modePaiement,
      notes,
    })
    .eq('id', factureId)
    .select()
    .single();
  if (updErr) throw updErr;

  const { data: paiement, error: payErr } = await supabase
    .from('paiements')
    .insert({
      facture_id: factureId,
      montant: montantOperation,
      mode_paiement: modePaiement,
      date_paiement: now,
      caissier_id: caissierId,
      notes,
      statut: 'effectue',
    })
    .select()
    .single();
  if (payErr) throw payErr;

  return { facture: factureMaj, paiement };
}

/** Conservé pour compatibilité — mise à jour générique d'une facture hors flux d'encaissement. */
export const updateFacture = async (factureId, updateData) => {
  const { data, error } = await supabase
    .from('factures')
    .update(updateData)
    .eq('id', factureId)
    .select();

  if (error) throw error;
  return data;
};
