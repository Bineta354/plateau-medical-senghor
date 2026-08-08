/**
 * Statuts de paiement des factures — source unique de vérité.
 * Doit rester synchronisé avec la contrainte CHECK réelle en base :
 *   factures.statut_paiement IN ('en_attente', 'partiel', 'paye', 'impaye')
 * (voir supabase/migrations/20250102000007_phase1_facturation.sql)
 *
 * Ne pas confondre avec l'ancienne nomenclature 'payee'/'impayee'/'partiellement_payee'/'annulee'
 * qui n'a jamais existé côté base et provoquait des badges de statut incorrects.
 */

export const FACTURE_STATUSES = ['en_attente', 'partiel', 'paye', 'impaye'];

export const STATUS_LABELS = {
  en_attente: 'En attente',
  partiel: 'Partiellement payée',
  paye: 'Payée',
  impaye: 'Impayée',
};

export const STATUS_COLORS = {
  en_attente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  partiel: 'bg-orange-100 text-orange-800 border-orange-200',
  paye: 'bg-green-100 text-green-800 border-green-200',
  impaye: 'bg-red-100 text-red-800 border-red-200',
};

export const DEFAULT_STATUS_COLOR = 'bg-gray-100 text-gray-800 border-gray-200';

export const getStatusLabel = (statut) => STATUS_LABELS[statut] ?? statut ?? '—';

export const getStatusColor = (statut) => STATUS_COLORS[statut] ?? DEFAULT_STATUS_COLOR;

/**
 * Calcule le statut_paiement à partir des montants, cohérent avec la colonne
 * générée factures.montant_restant (montant_ttc - montant_paye).
 * @param {number} montantPaye - total déjà payé après l'opération en cours
 * @param {number} montantTtc - montant total de la facture
 */
export const computeStatutPaiement = (montantPaye, montantTtc) => {
  const paye = Number(montantPaye) || 0;
  const ttc = Number(montantTtc) || 0;
  if (paye >= ttc && ttc > 0) return 'paye';
  if (paye > 0) return 'partiel';
  return 'en_attente';
};

/** Facture encore due (tout ou partie) — utilisé par les écrans d'impayés/relances/dashboard. */
export const isOutstanding = (statut) => statut === 'en_attente' || statut === 'partiel';
