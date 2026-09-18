// Allergies d'un patient = texte libre du dossier (patients.allergies) + antécédents
// actifs de type allergie. Sans cette fusion, une allergie saisie dans l'onglet
// Antécédents n'apparaîtrait pas dans les cartes/panneaux d'allergies.
export const buildAllergiesList = (patient, antecedents = []) => {
  const fromAntecedents = (antecedents || [])
    .filter((a) => a.actif !== false && /allerg/i.test(a.antecedents?.nom || ''))
    .map((a) => ({
      label: a.antecedents?.nom,
      detail: a.commentaires || null
    }));

  const fromText = (patient?.allergies || '')
    .split(/[\n;]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((label) => ({ label, detail: null }));

  const seen = new Set();
  return [...fromText, ...fromAntecedents].filter((a) => {
    const key = (a.label || '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
