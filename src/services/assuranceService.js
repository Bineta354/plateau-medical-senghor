import { supabase } from '../lib/supabase';

/**
 * Lecture/CRUD sur `assurances`, appelée directement (lecture seule jusqu'ici) dans
 * src/pages/caissier/Recapitulatif.jsx:58 (chargement pour filtres), et
 * src/pages/comptabilite/RechercheRapports.jsx:65 (chargement pour filtres), et
 * src/pages/secretary/Caisse.jsx:671-683 (fetchAssurancesList, filtre historique couverture).
 * Aucune des pages auditées ne fait de create/update/delete sur cette table à ce jour ;
 * ces fonctions sont ajoutées pour compléter le service en prévision d'un futur écran de
 * paramétrage des couvertures (voir AUDIT_APPELS_DIRECTS_DB.md, section 4, recommandation n°4).
 */

/**
 * Liste des assurances, triée par nom — remplace :
 *  - src/pages/caissier/Recapitulatif.jsx:58 (select 'id, nom, taux_remboursement')
 *  - src/pages/comptabilite/RechercheRapports.jsx:65 (select 'id, nom')
 *  - src/pages/secretary/Caisse.jsx:671-683 (fetchAssurancesList, select 'id, nom, taux_remboursement')
 *
 * @param {Object} [params]
 * @param {string} [params.fields='id, nom, taux_remboursement'] - colonnes à sélectionner (ex. 'id, nom' pour RechercheRapports)
 * @returns {Promise<Array<Object>>}
 */
export async function listAssurances({ fields = 'id, nom, taux_remboursement' } = {}) {
  const { data, error } = await supabase.from('assurances').select(fields).order('nom');
  if (error) throw error;
  return data || [];
}

/**
 * Détail d'une assurance par id.
 *
 * @param {number|string} id
 * @returns {Promise<Object|null>}
 */
export async function getAssuranceById(id) {
  if (!id) return null;
  const { data, error } = await supabase.from('assurances').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * Crée une nouvelle assurance/couverture.
 *
 * @param {Object} assurance - champs de la table `assurances` (ex. { nom, taux_remboursement })
 * @returns {Promise<Object>}
 */
export async function createAssurance(assurance) {
  const { data, error } = await supabase.from('assurances').insert(assurance).select().single();
  if (error) throw error;
  return data;
}

/**
 * Met à jour une assurance existante.
 *
 * @param {number|string} id
 * @param {Object} updateData
 * @returns {Promise<Object>}
 */
export async function updateAssurance(id, updateData) {
  if (!id) throw new Error('id requis');
  const { data, error } = await supabase.from('assurances').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

/**
 * Supprime une assurance.
 *
 * @param {number|string} id
 * @returns {Promise<void>}
 */
export async function deleteAssurance(id) {
  if (!id) throw new Error('id requis');
  const { error } = await supabase.from('assurances').delete().eq('id', id);
  if (error) throw error;
}
