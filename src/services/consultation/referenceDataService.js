import { supabase } from '../../lib/supabase';
import {
  typesActesService,
  appareilsService,
  diagnosticsService,
  medicamentsService,
  typesCertificatsService,
  constantesService
} from '../../lib/services';


/**
 * Calcule l'ensemble des IDs de spécialités à prendre en compte pour la cascade :
 * la spécialité elle-même, ses sous-spécialités (si c'est un parent), et sa
 * spécialité parente (si c'est une sous-spécialité).
 */
const buildSpecialiteCascade = (specialiteId, allSpecialites) => {
  if (!specialiteId) return new Set();
  const ids = new Set([specialiteId]);
  const current = allSpecialites.find((s) => s.id === specialiteId);
  if (current?.parent_id) {
    ids.add(current.parent_id);
  }
  allSpecialites.forEach((s) => {
    if (s.parent_id === specialiteId) {
      ids.add(s.id);
    }
  });
  return ids;
};

/**
 * Filtre côté JS un tableau d'entités selon une table de correspondance.
 * Conserve :
 *  - les entités liées à une spécialité de la cascade (elle-même, parent, enfants)
 *  - les entités sans aucune liaison (visibles par tous)
 *
 * @param {Array} items              - tableau d'entités (avec .id)
 * @param {Array} liaisons           - [{element_id, specialite_id}]
 * @param {string} elementIdKey      - nom de la colonne id dans la table de liaison (ex: 'appareil_id')
 * @param {Set} idsCascade           - ensemble des IDs de spécialités à retenir (cascade)
 */
const filterBySpecialite = (items, liaisons, elementIdKey, idsCascade) => {
  // Ensemble des IDs ayant au moins une liaison
  const idsAvecLiaison = new Set(liaisons.map(l => l[elementIdKey]));
  // IDs liés à une spécialité de la cascade
  const idsSpecialite = new Set(
    liaisons.filter(l => idsCascade.has(l.specialite_id)).map(l => l[elementIdKey])
  );

  return items.filter(item =>
    // Visible si lié à la cascade de spécialités du médecin OU sans aucune liaison (générique)
    idsSpecialite.has(item.id) || !idsAvecLiaison.has(item.id)
  );
};

/**
 * Retourne les données de référence utilisées dans la consultation.
 * Si specialiteId est fourni, filtre les référentiels pour ne retourner que les
 * données liées à cette spécialité (ou sans spécialité définie = visibles par tous),
 * en tenant compte de la cascade parent/sous-spécialité.
 *
 * @param {number|null} specialiteId - ID de la spécialité du médecin connecté
 */
export const getReferenceData = async (specialiteId = null) => {
  try {
    // ─── Récupération de la hiérarchie des spécialités (pour la cascade) ──
    let idsCascade = new Set();
    if (specialiteId) {
      const { data: allSpecialites, error: specError } = await supabase
        .from('specialites')
        .select('id, parent_id');
      if (!specError) {
        idsCascade = buildSpecialiteCascade(specialiteId, allSpecialites || []);
      } else {
        idsCascade = new Set([specialiteId]);
      }
    }

    // ─── Actes ─────────────────────────────────────────────────────────────
    let actesData = [];
    try {
      const actesFromService = await typesActesService.getAll();
      let actes = (actesFromService || []).map(acte => ({
        id: acte.id,
        nom: acte.nom,
        description: acte.description,
        tarif_defaut: acte.tarif_defaut,
        actif: acte.actif,
        specialite_id: acte.specialite_id
      }));
      if (specialiteId) {
        actes = actes.filter(a => !a.specialite_id || idsCascade.has(a.specialite_id));
      }
      actesData = actes;
    } catch (error) {
      console.error("Erreur lors du chargement des types d'actes:", error);
    }

    // ─── Chargement parallèle des listes brutes + tables de correspondance ─
    let allAppareils = [];
    let allDiagnostics = [];
    let medicamentsData = [];
    let certificatsData = [];
    let constantesData = [];
    let antecedentsData = [];
    let synthesesData = [];

    const [
      appResult,
      diagResult,
      medResult,
      certResult,
      constResult,
      antResult,
      synthResult,
      signesResult,
      // Liaisons de spécialité
      appLiaisonsResult,
      diagLiaisonsResult,
      antLiaisonsResult,
      signesLiaisonsResult,
    ] = await Promise.allSettled([
      supabase.from('appareils').select('*').eq('actif', true).order('ordre_affichage').order('nom'),
      supabase.from('diagnostics').select('*').eq('actif', true).order('ordre_affichage').order('nom'),
      supabase.from('medicaments').select('*').eq('actif', true).order('nom'),
      supabase.from('types_certificats').select('*').eq('actif', true).order('nom'),
      // constantes = constantes vitales (tension, pouls...) utilisées ailleurs dans la consultation
      constantesService.getAll(),
      supabase.from('antecedents').select('*').eq('actif', true).order('nom'),
      supabase.from('elements_synthese').select('*').order('nom'),
      // signes_cliniques = la vraie table pour le modal "Ajouter des signes cliniques"
      supabase.from('signes_cliniques').select('*').eq('actif', true).order('categorie').order('nom'),
      // Liaisons — toujours chargées pour permettre le filtrage
      supabase.from('appareils_specialites').select('appareil_id, specialite_id'),
      supabase.from('diagnostics_specialites').select('diagnostic_id, specialite_id'),
      supabase.from('antecedents_specialites').select('antecedent_id, specialite_id'),
      supabase.from('signes_cliniques_specialites').select('signe_clinique_id, specialite_id'),
    ]);

    allAppareils = appResult.status === 'fulfilled' ? (appResult.value.data || []) : [];
    allDiagnostics = diagResult.status === 'fulfilled' ? (diagResult.value.data || []) : [];
    antecedentsData = antResult.status === 'fulfilled' ? (antResult.value.data || []) : [];
    synthesesData = synthResult.status === 'fulfilled' ? (synthResult.value.data || []) : [];
    constantesData = constResult.status === 'fulfilled' ? (constResult.value || []) : [];
    let allSignesCliniques = signesResult.status === 'fulfilled' ? (signesResult.value.data || []) : [];

    // Médicaments — filtrage par specialite_id direct, avec cascade (null = général)
    const allMedicaments = medResult.status === 'fulfilled' ? (medResult.value.data || []) : [];
    if (specialiteId) {
      medicamentsData = allMedicaments.filter(m => !m.specialite_id || idsCascade.has(m.specialite_id));
    } else {
      medicamentsData = allMedicaments;
    }

    // Certificats — filtrage par specialite_id direct, avec cascade (null = général)
    const allCertificats = certResult.status === 'fulfilled' ? (certResult.value.data || []) : [];
    if (specialiteId) {
      certificatsData = allCertificats.filter(c => !c.specialite_id || idsCascade.has(c.specialite_id));
    } else {
      certificatsData = allCertificats;
    }

    // ─── Application du filtre spécialité via tables de correspondance ─────
    const appLiaisons   = appLiaisonsResult.status === 'fulfilled'    ? (appLiaisonsResult.value.data || [])    : [];
    const diagLiaisons  = diagLiaisonsResult.status === 'fulfilled'   ? (diagLiaisonsResult.value.data || [])   : [];
    const antLiaisons   = antLiaisonsResult.status === 'fulfilled'    ? (antLiaisonsResult.value.data || [])    : [];
    const signesLiaisons= signesLiaisonsResult.status === 'fulfilled' ? (signesLiaisonsResult.value.data || []) : [];

    if (specialiteId) {
      allAppareils       = filterBySpecialite(allAppareils, appLiaisons, 'appareil_id', idsCascade);
      allDiagnostics     = filterBySpecialite(allDiagnostics, diagLiaisons, 'diagnostic_id', idsCascade);
      antecedentsData    = filterBySpecialite(antecedentsData, antLiaisons, 'antecedent_id', idsCascade);
      allSignesCliniques = filterBySpecialite(allSignesCliniques, signesLiaisons, 'signe_clinique_id', idsCascade);
    }

    return {
      antecedentsRef: antecedentsData,
      // signesCliniquesRef = signes cliniques (modal "Ajouter des signes cliniques")
      signesCliniquesRef: allSignesCliniques,
      // constantesRef = constantes vitales (tension, pouls...) pour la section constantes
      constantesRef: constantesData,
      appareilsRef: allAppareils,
      elementsSyntheseRef: synthesesData,
      diagnosticsRef: allDiagnostics,
      actesRef: actesData,
      medicamentsRef: medicamentsData,
      typesCertificatsRef: certificatsData,
    };
  } catch (error) {
    console.error('Erreur lors du chargement des données de référence:', error);
    throw error;
  }
};

export const getModelesConsultation = async () => {
  const { data, error } = await supabase
    .from('modeles_consultation')
    .select('*')
    .eq('actif', true)
    .order('nom');
  if (error) throw error;
  return data || [];
};

export const createConsultationFromModele = async (patientId, modeleId, userId) => {
  const modele = await supabase.from('modeles_consultation').select('*').eq('id', modeleId).single();
  if (modele.error) throw modele.error;

  const { data, error } = await supabase
    .from('consultations')
    .insert({
      patient_id: patientId,
      medecin_id: userId,
      motif_consultation: `Consultation ${modele.data.nom}`,
      niveau_urgence: 'normale',
      type_consultation: modele.data.type_consultation || 'standard',
      statut: 'en_cours',
      date_consultation: new Date().toISOString()
    })
    .select('id')
    .single();

  if (error) throw error;
  return data;
};
