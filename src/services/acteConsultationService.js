import { supabase } from '../lib/supabase';

/**
 * Service pour la page src/pages/facturation/Actes.jsx (table `actes_consultation`,
 * jointures `consultations`/`patients`/`users`/`types_actes`, tarifs actifs de
 * `tarifs_actes`).
 *
 * ATTENTION — ne pas confondre avec `src/services/consultation/acteService.js`, qui
 * cible une table différente (`actes_medicaux`) et n'est pas concerné par ce service.
 */

/** Consultations pour le sélecteur du formulaire — reproduit Actes.jsx:fetchData (consultations). */
export async function listConsultationsForDropdown() {
  const { data, error } = await supabase
    .from('consultations')
    .select(`
      id,
      date_consultation,
      patients (nom, prenom),
      users (nom, prenom)
    `)
    .order('date_consultation', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Tarifs actifs — reproduit Actes.jsx:fetchData (tarifs_actes). */
export async function listTarifsActifs() {
  const { data, error } = await supabase
    .from('tarifs_actes')
    .select('*')
    .eq('actif', true);
  if (error) throw error;
  return data || [];
}

/** Liste des actes de consultation avec jointures — reproduit Actes.jsx:fetchActes. */
export async function listActesConsultation() {
  const { data, error } = await supabase
    .from('actes_consultation')
    .select(`
      *,
      consultations (
        date_consultation,
        patients (nom, prenom),
        users (nom, prenom)
      ),
      types_actes (nom, description)
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Crée un acte de consultation — reproduit Actes.jsx:handleSubmit (branche création). */
export async function createActeConsultation(data) {
  const { error } = await supabase.from('actes_consultation').insert(data);
  if (error) throw error;
}

/** Met à jour un acte de consultation — reproduit Actes.jsx:handleSubmit (branche édition). */
export async function updateActeConsultation(id, data) {
  const { error } = await supabase.from('actes_consultation').update(data).eq('id', id);
  if (error) throw error;
}

/** Supprime un acte de consultation — reproduit Actes.jsx:handleDelete. */
export async function deleteActeConsultation(id) {
  const { error } = await supabase.from('actes_consultation').delete().eq('id', id);
  if (error) throw error;
}
