/** Formatage des montants en franc CFA (FCFA / XOF). */
export const DEVISE_LABEL = 'FCFA';

/**
 * Formate un montant avec séparateur de milliers (espace) et sans décimales
 * @param {number} montant - Le montant à formater
 * @returns {string} - Le montant formaté (ex: 1 500 000 FCFA)
 */
export function formatMontant(montant) {
  const num = montant ?? 0;
  const formatted = new Intl.NumberFormat('fr-FR', { 
    maximumFractionDigits: 0,
    useGrouping: true 
  }).format(num);
  // Remplacer l'espace insécable par un espace normal
  return `${formatted.replace(/\u00A0/g, ' ')} ${DEVISE_LABEL}`;
}

/**
 * Formate un montant avec séparateur de milliers (espace) et décimales (virgule)
 * @param {number} montant - Le montant à formater
 * @returns {string} - Le montant formaté (ex: 1 500,50 FCFA)
 */
export function formatMontantDecimal(montant) {
  const num = montant ?? 0;
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(num);
  // Remplacer l'espace insécable par un espace normal
  return `${formatted.replace(/\u00A0/g, ' ')} ${DEVISE_LABEL}`;
}
