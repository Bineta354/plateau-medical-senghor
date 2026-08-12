import { supabase } from '../lib/supabase';

/**
 * Factory de service CRUD pour les tables de "référentiels" de paramétrage médical
 * (antécédents, appareils, diagnostics, signes cliniques) qui partagent toutes le
 * même modèle : une table principale + une table de liaison many-to-many vers
 * `specialites` (ex: `antecedents_specialites`, fk `antecedent_id`).
 *
 * Extrait du pattern dupliqué à l'identique (à un renommage de colonne près) dans :
 * - src/pages/parametrage/AntecedentsForm.jsx (fetchAntecedent / handleSubmit, lignes ~64-170)
 *   et src/pages/parametrage/Antecedents.jsx (fetchAntecedents, lignes ~66-88 ; handleDelete, lignes ~98-112)
 * - src/pages/parametrage/Appareils.jsx (fetchAppareils lignes ~29-43, handleSubmit lignes ~51-87, handleDelete lignes ~115-125)
 * - src/pages/parametrage/Diagnostics.jsx (fetchDiagnostics lignes ~40-54, handleSubmit lignes ~62-100, handleDelete lignes ~132-142)
 * - src/pages/parametrage/SignesCliniques.jsx (fetchItems lignes ~43-56, handleSubmit lignes ~64-100, handleDelete lignes ~128-138)
 *
 * ATTENTION — ne pas confondre avec `appareilsService`/`diagnosticsService` exportés
 * par `src/lib/services.js` : ceux-ci sont en lecture seule et filtrent par une
 * colonne directe `specialite_id`, un modèle différent du many-to-many utilisé ici
 * (table de liaison `*_specialites`). Les services créés par cette factory sont un
 * remplacement distinct et plus complet, pas une extension de ceux de `lib/services.js`.
 *
 * @param {Object} config
 * @param {string} config.table - nom de la table principale (ex: 'antecedents')
 * @param {string} config.liaisonTable - nom de la table de liaison (ex: 'antecedents_specialites')
 * @param {string} config.foreignKey - colonne de la table de liaison qui référence la table principale (ex: 'antecedent_id')
 */
export function createReferentielService({ table, liaisonTable, foreignKey }) {
  const liaisonSelect = `${liaisonTable}(specialite_id, specialites(id, nom))`;

  return {
    /**
     * Liste tous les éléments de la table avec leurs spécialités liées (jointure),
     * triés par ordre_affichage puis nom — reproduit fetchAppareils/fetchDiagnostics/
     * fetchItems/fetchAntecedents.
     */
    async list() {
      const { data, error } = await supabase
        .from(table)
        .select(`*, ${liaisonSelect}`)
        .order('ordre_affichage', { ascending: true })
        .order('nom');
      if (error) throw error;
      return data || [];
    },

    /**
     * Récupère un élément par id ainsi que la liste des specialite_id qui lui sont
     * liés — reproduit AntecedentsForm.jsx → fetchAntecedent (lignes ~64-86).
     * @param {number|string} id
     * @returns {Promise<{item: object, specialiteIds: number[]}>}
     */
    async getById(id) {
      const [{ data: item, error: itemError }, { data: liaisons, error: liaisonError }] = await Promise.all([
        supabase.from(table).select('*').eq('id', id).single(),
        supabase.from(liaisonTable).select('specialite_id').eq(foreignKey, id),
      ]);
      if (itemError) throw itemError;
      if (liaisonError) throw liaisonError;
      return {
        item,
        specialiteIds: (liaisons || []).map((l) => l.specialite_id),
      };
    },

    /**
     * Crée un nouvel élément. N'écrit pas les liaisons spécialités — appeler
     * syncSpecialites() séparément après création si besoin.
     * @param {Object} data
     */
    async create(data) {
      const { data: created, error } = await supabase
        .from(table)
        .insert([data])
        .select('id')
        .single();
      if (error) throw error;
      return created;
    },

    /**
     * Met à jour un élément existant.
     * @param {number|string} id
     * @param {Object} data
     */
    async update(id, data) {
      const { error } = await supabase.from(table).update(data).eq('id', id);
      if (error) throw error;
    },

    /** Supprime un élément (les liaisons spécialités sont supprimées en cascade côté DB si configuré, sinon voir syncSpecialites). */
    async remove(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },

    /**
     * Synchronise les liaisons spécialités d'un élément : supprime toutes les
     * liaisons existantes puis réinsère la sélection fournie — reproduit le pattern
     * "delete puis insert" présent dans handleSubmit de chacune des 4 pages.
     * @param {number|string} id
     * @param {number[]} specialiteIds - liste vide = visible par toutes les spécialités
     */
    async syncSpecialites(id, specialiteIds = []) {
      const { error: deleteError } = await supabase
        .from(liaisonTable)
        .delete()
        .eq(foreignKey, id);
      if (deleteError) throw deleteError;

      if (specialiteIds.length > 0) {
        const liens = specialiteIds.map((specialite_id) => ({
          [foreignKey]: id,
          specialite_id,
        }));
        const { error: insertError } = await supabase.from(liaisonTable).insert(liens);
        if (insertError) throw insertError;
      }
    },
  };
}

/** Service référentiel pour les antécédents (table `antecedents` / liaison `antecedents_specialites`). */
export const antecedentsRefService = createReferentielService({
  table: 'antecedents',
  liaisonTable: 'antecedents_specialites',
  foreignKey: 'antecedent_id',
});

/** Service référentiel pour les appareils (table `appareils` / liaison `appareils_specialites`). */
export const appareilsRefService = createReferentielService({
  table: 'appareils',
  liaisonTable: 'appareils_specialites',
  foreignKey: 'appareil_id',
});

/** Service référentiel pour les diagnostics (table `diagnostics` / liaison `diagnostics_specialites`). */
export const diagnosticsRefService = createReferentielService({
  table: 'diagnostics',
  liaisonTable: 'diagnostics_specialites',
  foreignKey: 'diagnostic_id',
});

/** Service référentiel pour les signes cliniques (table `signes_cliniques` / liaison `signes_cliniques_specialites`). */
export const signesCliniquesRefService = createReferentielService({
  table: 'signes_cliniques',
  liaisonTable: 'signes_cliniques_specialites',
  foreignKey: 'signe_clinique_id',
});
