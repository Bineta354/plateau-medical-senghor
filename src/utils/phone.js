// Numéros mobiles sénégalais : 9 chiffres, préfixes 70/75/76/77/78, affichés "77 777 77 77"
const SN_PHONE_PATTERN = /^(70|75|76|77|78)\d{7}$/;

export const TELEPHONE_PLACEHOLDER = '77 777 77 77';

export function normalizeTelephoneSN(value) {
  const digits = (value || '').replace(/\D/g, '');
  return digits.startsWith('221') && digits.length === 12 ? digits.slice(3) : digits;
}

/**
 * Reformate une saisie en cours (mask) au format "77 777 77 77" pendant que l'utilisateur tape.
 */
export function formatTelephoneSN(value) {
  const digits = normalizeTelephoneSN(value).slice(0, 9);
  const groups = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)];
  return groups.filter(Boolean).join(' ');
}

/**
 * true si la valeur (espaces compris) correspond à un mobile sénégalais valide.
 */
export function isValidTelephoneSN(value) {
  const digits = normalizeTelephoneSN(value);
  return SN_PHONE_PATTERN.test(digits);
}
