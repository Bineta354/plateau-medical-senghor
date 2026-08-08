import { supabase } from '../lib/supabase';

/**
 * Encapsule le RPC `get_caissiers`, appelé directement dans
 * src/pages/comptabilite/SuiviCaissiers.jsx:60 (fetchData) et
 * src/pages/secretary/Caisse.jsx:373 (fetchSupervisionData).
 */

/**
 * Liste des caissiers (id, nom, prénom, username, actif — forme renvoyée par la fonction SQL).
 *
 * @returns {Promise<Array<Object>>}
 */
export async function getCaissiers() {
  const { data, error } = await supabase.rpc('get_caissiers');
  if (error) throw error;
  return data || [];
}
