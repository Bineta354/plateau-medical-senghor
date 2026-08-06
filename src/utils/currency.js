/** Formatage des montants en franc CFA (FCFA / XOF). */
export const DEVISE_LABEL = 'FCFA';

// `?? 0` ne remplace que null/undefined, pas NaN (ex: parseFloat(undefined)) — sans cette
// garde, un champ manquant en base afficherait littéralement "NaN FCFA" sur une facture.
const toSafeNumber = (montant) => (Number.isFinite(montant) ? montant : 0);

export function formatMontant(montant) {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(toSafeNumber(montant))} ${DEVISE_LABEL}`;
}

export function formatMontantDecimal(montant) {
  return `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(toSafeNumber(montant))} ${DEVISE_LABEL}`;
}

/** Nombre avec séparateur de milliers, sans unité (pour les tableaux où l'en-tête indique déjà "F CFA"). */
export function formatNombre(montant) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(toSafeNumber(montant));
}

// Intl.NumberFormat('fr-FR') sépare les milliers avec une espace fine insécable (U+202F).
// jsPDF (polices standard Helvetica/WinAnsiEncoding) ne sait pas encoder ce caractère et
// affiche un "/" à la place dans le PDF généré : on le remplace par une espace normale
// pour tout texte destiné à doc.text() de jsPDF (factures/devis PDF).
const toPdfSafe = (s) => s.replace(/ /g, ' ');

export function formatMontantPdf(montant) {
  return toPdfSafe(formatMontant(montant));
}

export function formatMontantDecimalPdf(montant) {
  return toPdfSafe(formatMontantDecimal(montant));
}
