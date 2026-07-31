import { supabase } from '../lib/supabase';

/**
 * Valide la date de naissance d'un patient
 * @param {string} dateNaissance - La date de naissance au format ISO
 * @returns {Object} - { valid: boolean, error: string|null }
 */
export const validateBirthDate = (dateNaissance) => {
  if (!dateNaissance) {
    return { valid: false, error: 'La date de naissance est obligatoire' };
  }

  const birthDate = new Date(dateNaissance);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normaliser à minuit pour comparaison juste
  const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());

  if (birthDate > today) {
    return { valid: false, error: 'La date de naissance ne peut pas être postérieure à aujourd\'hui' };
  }

  if (birthDate > oneYearAgo) {
    return { valid: false, error: 'Le patient doit être âgé d\'au moins 1 an' };
  }

  return { valid: true, error: null };
};

export const fetchPatients = async () => {
  const { data, error } = await supabase
    .from('patients')
    .select('id, nom, prenom, date_naissance, numero_dossier')
    .eq('actif', true)
    .order('nom');

  if (error) {
    console.error('Erreur lors du chargement des patients:', error);
    throw error;
  }
  
  return data || [];
};

/**
 * Génère automatiquement un numéro de dossier au format séquentiel XXXXXX
 * Passe automatiquement à 7 chiffres si le maximum est atteint
 * Vérifie l'unicité du numéro généré
 * @returns {Promise<string>} Le numéro de dossier généré
 */
export const generateNumeroDossier = async () => {
  try {
    // Récupérer tous les numéros de dossier existants pour trouver le maximum
    const { data, error } = await supabase
      .from('patients')
      .select('numero_dossier')
      .not('numero_dossier', 'is', null);

    if (error) throw error;

    // Trouver le numéro maximum existant
    let maxNumber = 0;
    if (data && data.length > 0) {
      for (const patient of data) {
        const num = parseInt(patient.numero_dossier, 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    }

    // Commencer à partir du maximum + 1
    let nextNumber = maxNumber + 1;
    let maxAttempts = 50;
    let attempts = 0;

    while (attempts < maxAttempts) {
      // Déterminer le nombre de chiffres nécessaires
      let padding = 6;
      if (nextNumber > 999999) {
        padding = 7;
      } else if (nextNumber > 9999999) {
        padding = 8;
      }

      // Formater avec padding dynamique
      const paddedNumber = String(nextNumber).padStart(padding, '0');

      // Vérifier si ce numéro existe déjà
      const { data: existingData, error: checkError } = await supabase
        .from('patients')
        .select('id')
        .eq('numero_dossier', paddedNumber)
        .maybeSingle();

      if (checkError) throw checkError;

      // Si le numéro n'existe pas, on peut l'utiliser
      if (!existingData) {
        return paddedNumber;
      }

      // Si le numéro existe déjà, essayer le suivant
      nextNumber++;
      attempts++;
    }

    // Si on a atteint le nombre maximum de tentatives, utiliser un timestamp + random pour éviter les collisions
    console.warn('Impossible de générer un numéro unique après %d tentatives, utilisation du timestamp + random', maxAttempts);
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return (timestamp + random).padStart(6, '0');
  } catch (error) {
    console.error('Erreur lors de la génération du numéro de dossier:', error);
    // En cas d'erreur, retourner un format basé sur le timestamp + random
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return (timestamp + random).padStart(6, '0');
  }
};
