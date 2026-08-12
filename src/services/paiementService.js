import { supabase } from '../lib/supabase';
import { computeStatutPaiement } from '../utils/factureStatus';

/**
 * Moteur d'encaissement unique — utilisé par le guichet de caisse (Caisse.jsx)
 * et par l'écran de corrections comptables (EncaissementFactures.jsx).
 *
 * Garantit que toute opération d'encaissement ou de décaissement écrit
 * systématiquement dans `factures` (montant + statut) ET dans `paiements`
 * (ligne du grand livre), pour rester visible en caisse/récapitulatif/
 * arrêté mensuel/suivi des caissiers.
 *
 * Les deux écritures ne sont pas transactionnelles (pas de RPC dédiée pour
 * l'instant — voir le chantier DB listé séparément) : en cas d'échec de
 * l'insertion dans `paiements` après la mise à jour de `factures`, l'appelant
 * reçoit l'erreur et doit informer l'utilisateur qu'une vérification manuelle
 * peut être nécessaire.
 *
 * @param {Object} params
 * @param {number} params.factureId
 * @param {number} params.montant - positif pour un encaissement, négatif pour un décaissement/correction
 * @param {string} params.modePaiement
 * @param {string} [params.notes]
 * @param {number|null} [params.caissierId]
 * @returns {Promise<{facture: object, paiement: object}>}
 */
export async function enregistrerPaiement({
  factureId,
  montant,
  modePaiement,
  notes = null,
  caissierId = null,
}) {
  if (!factureId) throw new Error('factureId requis');
  const montantOperation = Number(montant) || 0;
  if (montantOperation === 0) throw new Error('Le montant doit être différent de 0');

  const { data: facture, error: fetchErr } = await supabase
    .from('factures')
    .select('id, montant_ttc, montant_paye')
    .eq('id', factureId)
    .single();
  if (fetchErr) throw fetchErr;

  const montantTtc = Number(facture.montant_ttc) || 0;
  const montantDejaPaye = Number(facture.montant_paye) || 0;
  const totalPaye = Math.max(0, montantDejaPaye + montantOperation);

  if (montantOperation > 0 && montantOperation > montantTtc - montantDejaPaye) {
    throw new Error('Le montant à encaisser dépasse le reste à payer');
  }
  if (montantOperation < 0 && Math.abs(montantOperation) > montantDejaPaye) {
    throw new Error('Le décaissement dépasse le montant déjà encaissé');
  }

  const nouveauStatut = computeStatutPaiement(totalPaye, montantTtc);
  const now = new Date().toISOString();

  const { data: factureMaj, error: updErr } = await supabase
    .from('factures')
    .update({
      montant_paye: totalPaye,
      statut_paiement: nouveauStatut,
      date_paiement: now,
      mode_paiement: modePaiement,
      notes,
    })
    .eq('id', factureId)
    .select()
    .single();
  if (updErr) throw updErr;

  const { data: paiement, error: payErr } = await supabase
    .from('paiements')
    .insert({
      facture_id: factureId,
      montant: montantOperation,
      mode_paiement: modePaiement,
      date_paiement: now,
      caissier_id: caissierId,
      notes,
      statut: 'effectue',
    })
    .select()
    .single();
  if (payErr) throw payErr;

  return { facture: factureMaj, paiement };
}

/** Conservé pour compatibilité — mise à jour générique d'une facture hors flux d'encaissement. */
export const updateFacture = async (factureId, updateData) => {
  const { data, error } = await supabase
    .from('factures')
    .update(updateData)
    .eq('id', factureId)
    .select();

  if (error) throw error;
  return data;
};

// ---------------------------------------------------------------------------
// Fonctions de lecture — extraites des requêtes directes dupliquées dans
// Caisse.jsx / RechercheRapports.jsx / EncaissementFactures.jsx / Recapitulatif.jsx /
// SuiviCaissiers.jsx (voir AUDIT_APPELS_DIRECTS_DB.md, section 4, recommandation n°1).
// ---------------------------------------------------------------------------

const PERIODE_STARTERS = {
  today: () => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate()).toISOString();
  },
  week: () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  month: () => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1).toISOString();
  },
};

/** Résout `periode` (raccourci nommé ou {debut, fin} explicite) en bornes ISO. */
function resolvePeriodeRange(periode) {
  if (!periode) return null;
  if (typeof periode === 'object') {
    return { debut: periode.debut || null, fin: periode.fin || null };
  }
  const starter = PERIODE_STARTERS[periode];
  return starter ? { debut: starter(), fin: null } : null;
}

/** Reproduit Caisse.jsx:685-700 (getDateRangeForPeriod) pour les stats jour/semaine/mois. */
function getDateRangeForPeriod(period) {
  const now = new Date();
  const debut = new Date(now);
  debut.setHours(0, 0, 0, 0);
  if (period === 'jour') return { debut, fin: now };
  if (period === 'semaine') {
    const day = debut.getDay();
    const diff = debut.getDate() - day + (day === 0 ? -6 : 1);
    debut.setDate(diff);
    return { debut, fin: now };
  }
  debut.setDate(1);
  return { debut, fin: now };
}

/**
 * Liste de factures avec jointures patient/assurance/consultation — remplace les requêtes
 * dupliquées dans :
 *  - src/pages/secretary/Caisse.jsx:1062-1119 (fetchFactures : en_attente/partiel + payées)
 *  - src/pages/comptabilite/RechercheRapports.jsx:73-96 (chargerFactures)
 *  - src/pages/comptabilite/EncaissementFactures.jsx:58-122 (fetchFactures)
 *  - src/pages/caissier/Recapitulatif.jsx:67-94 (fetchRecap)
 *
 * Le `select` ci-dessous est volontairement un sur-ensemble des formes utilisées par ces
 * quatre pages (jointure directe `patients`/`assurances` ET jointure imbriquée
 * `consultations.patients.assurances`) afin de rester réutilisable telle quelle pour
 * chacune d'elles — ce n'est pas une optimisation de requête, les pages elles-mêmes
 * n'ont pas encore été migrées sur cette fonction.
 *
 * @param {Object} [params]
 * @param {string|string[]} [params.statut] - 'en_attente' | 'partiel' | 'paye' | 'impaye' | 'outstanding' (en_attente+partiel) | 'all'/undefined
 * @param {{debut?: string, fin?: string}|'today'|'week'|'month'} [params.periode] - filtre sur `dateField`
 * @param {string} [params.dateField='date_facture']
 * @param {number|string} [params.assuranceId]
 * @param {number|string} [params.medecinId] - filtré côté client (medecin_id vit sur `consultations`, pas simplement filtrable en jointure côté serveur — même limitation documentée dans RechercheRapports.jsx:105-106)
 * @param {number|string} [params.patientId]
 * @param {string} [params.type] - filtre `.eq('type', type)` (ex. 'couverture' pour ne récupérer que les factures -C), voir Caisse.jsx:fetchFactures
 * @param {boolean} [params.excludeCouverture=false] - si true, ne renvoie que les factures "parent" (facture_parent_id is null), comme Recapitulatif.jsx
 * @param {number} [params.limit=500]
 * @param {boolean} [params.ascending=false] - tri sur `dateField`
 * @returns {Promise<Array<Object>>}
 */
export async function listFactures({
  statut,
  periode,
  dateField = 'date_facture',
  assuranceId,
  medecinId,
  patientId,
  type,
  excludeCouverture = false,
  limit = 500,
  ascending = false,
} = {}) {
  let query = supabase
    .from('factures')
    .select(`
      id, numero_facture, date_facture, date_paiement, montant_ht, tva, montant_ttc, montant_paye, montant_restant,
      statut_paiement, mode_paiement, notes, type, facture_parent_id, patient_id, assurance_id,
      consultation_id, created_at, updated_at,
      patients ( id, nom, prenom, telephone, email, numero_secu, assurance_id, assurances ( id, nom, taux_remboursement ) ),
      assurances ( id, nom, taux_remboursement ),
      consultations (
        id, date_consultation, medecin_id, patient_id,
        users ( id, nom, prenom ),
        patients ( id, nom, prenom, numero_secu, assurance_id, assurances ( id, nom, taux_remboursement ) )
      )
    `)
    .order(dateField, { ascending })
    .limit(limit);

  if (statut === 'outstanding') {
    query = query.in('statut_paiement', ['en_attente', 'partiel']);
  } else if (Array.isArray(statut)) {
    query = query.in('statut_paiement', statut);
  } else if (statut && statut !== 'all') {
    query = query.eq('statut_paiement', statut);
  }

  const range = resolvePeriodeRange(periode);
  if (range?.debut) query = query.gte(dateField, range.debut);
  if (range?.fin) query = query.lte(dateField, range.fin);

  if (assuranceId) query = query.eq('assurance_id', assuranceId);
  if (patientId) query = query.eq('patient_id', patientId);
  if (type) query = query.eq('type', type);
  if (excludeCouverture) query = query.is('facture_parent_id', null);

  const { data, error } = await query;
  if (error) throw error;

  let result = data || [];
  if (medecinId) {
    result = result.filter((f) => String(f.consultations?.medecin_id) === String(medecinId));
  }
  return result;
}

/**
 * Liste de paiements avec jointures facture/consultation/patient/assurance/caissier —
 * remplace les requêtes dupliquées dans :
 *  - src/pages/comptabilite/SuiviCaissiers.jsx:65-84 (fetchData)
 *  - src/pages/secretary/Caisse.jsx:377-391 (fetchSupervisionData)
 *  - src/pages/secretary/Caisse.jsx:474-479 (calculateTrend)
 *  - src/pages/secretary/Caisse.jsx:535,541 (fetchEtatCaisse — voir aussi getTotauxCaisse ci-dessous)
 *  - src/pages/secretary/Caisse.jsx:585-606 (fetchDetailsJournee)
 *
 * @param {Object} [params]
 * @param {string} [params.statut='effectue']
 * @param {{debut?: string, fin?: string}|'today'|'week'|'month'} [params.periode] - filtre sur date_paiement
 * @param {number|string} [params.caissierId]
 * @param {number} [params.limit=2000]
 * @param {boolean} [params.ascending=false]
 * @returns {Promise<Array<Object>>}
 */
export async function listPaiements({
  statut = 'effectue',
  periode,
  caissierId,
  limit = 2000,
  ascending = false,
} = {}) {
  let query = supabase
    .from('paiements')
    .select(`
      *,
      factures (
        id, numero_facture, montant_ttc,
        consultations (
          id, date_consultation,
          patients ( id, nom, prenom, numero_secu, assurance_id, assurances ( id, nom, taux_remboursement ) )
        )
      ),
      users!paiements_caissier_id_fkey ( id, nom, prenom )
    `)
    .order('date_paiement', { ascending })
    .limit(limit);

  if (statut && statut !== 'all') query = query.eq('statut', statut);

  const range = resolvePeriodeRange(periode);
  if (range?.debut) query = query.gte('date_paiement', range.debut);
  if (range?.fin) query = query.lte('date_paiement', range.fin);

  if (caissierId) query = query.eq('caissier_id', caissierId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Totaux de caisse (jour + mois + répartition par mode de paiement) — remplace
 * src/pages/secretary/Caisse.jsx:522-574 (fetchEtatCaisse), partie `paiements`
 * uniquement (le fond de caisse vient de `sessionCaisseService.getSessionOuverte()` ;
 * l'appelant combine les deux comme le fait la page : `solde = fondCaisse + totalAujourdhui`).
 *
 * @param {Object} [params]
 * @param {Date|string} [params.jour=new Date()] - date de référence pour le total journalier
 * @param {Date|string} [params.mois] - date de référence pour le total mensuel (défaut : même mois que `jour`)
 * @param {number|string|null} [params.caissierId] - si fourni, ne compte que les paiements de ce caissier
 * @returns {Promise<{totalAujourdhui: number, totalMois: number, parModePaiement: Object}>}
 */
export async function getTotauxCaisse({ jour = new Date(), mois, caissierId = null } = {}) {
  const refJour = jour instanceof Date ? jour : new Date(jour);
  const debutJour = new Date(refJour);
  debutJour.setHours(0, 0, 0, 0);
  const finJour = new Date(debutJour.getTime() + 24 * 60 * 60 * 1000);

  const refMois = mois ? (mois instanceof Date ? mois : new Date(mois)) : refJour;
  const debutMois = new Date(refMois.getFullYear(), refMois.getMonth(), 1);
  debutMois.setHours(0, 0, 0, 0);

  let qJour = supabase
    .from('paiements')
    .select('montant, mode_paiement')
    .eq('statut', 'effectue')
    .gte('date_paiement', debutJour.toISOString())
    .lt('date_paiement', finJour.toISOString());
  if (caissierId) qJour = qJour.eq('caissier_id', caissierId);
  const { data: paiementsJour, error: e1 } = await qJour;
  if (e1) throw e1;

  let qMois = supabase
    .from('paiements')
    .select('montant')
    .eq('statut', 'effectue')
    .gte('date_paiement', debutMois.toISOString());
  if (caissierId) qMois = qMois.eq('caissier_id', caissierId);
  const { data: paiementsMois, error: e2 } = await qMois;
  if (e2) throw e2;

  const totalAujourdhui = (paiementsJour || []).reduce((sum, p) => sum + parseFloat(p.montant || 0), 0);
  const totalMois = (paiementsMois || []).reduce((sum, p) => sum + parseFloat(p.montant || 0), 0);
  const parModePaiement = (paiementsJour || []).reduce(
    (acc, p) => {
      const m = p.mode_paiement || 'especes';
      acc[m] = (acc[m] || 0) + parseFloat(p.montant || 0);
      return acc;
    },
    { especes: 0, carte: 0, virement: 0, cheque: 0, orange_money: 0, wave: 0, yas: 0 }
  );

  return { totalAujourdhui, totalMois, parModePaiement };
}

/**
 * Historique des factures payées d'un patient (lignes détaillées + totaux jour/semaine/mois
 * de la part patient) — remplace src/pages/secretary/Caisse.jsx:702-792 (fetchHistoriquePatient).
 * Si `caissierId` est fourni, ne renvoie que les factures encaissées par ce caissier
 * (reconstituées via `paiements`, comportement "caissier" de la page) ; sinon, renvoie
 * toutes les factures payées du patient (comportement non-caissier de la page).
 *
 * @param {number|string} patientId
 * @param {{caissierId?: number|string|null}} [options]
 * @returns {Promise<{lignes: Array<Object>, stats: {jour: number, semaine: number, mois: number}}>}
 */
export async function getHistoriquePatient(patientId, { caissierId = null } = {}) {
  if (!patientId) return { lignes: [], stats: { jour: 0, semaine: 0, mois: 0 } };

  let facturesPayeesPatient = [];

  if (caissierId) {
    const { data, error } = await supabase
      .from('paiements')
      .select(
        `id, date_paiement, mode_paiement, montant, facture_id,
         factures (
           id, numero_facture, montant_ttc, date_paiement, mode_paiement, patient_id,
           consultations ( date_consultation, patients ( id, nom, prenom, numero_secu, assurances ( id, nom, taux_remboursement ) ) )
         )`
      )
      .eq('caissier_id', caissierId)
      .order('date_paiement', { ascending: false })
      .limit(500);
    if (error) throw error;
    const byFactureId = {};
    (data || []).forEach((p) => {
      const f = p.factures;
      if (!f || String(f.patient_id) !== String(patientId)) return;
      if (!byFactureId[f.id]) {
        byFactureId[f.id] = { ...f, date_paiement: p.date_paiement, mode_paiement: p.mode_paiement || f.mode_paiement };
      }
    });
    facturesPayeesPatient = Object.values(byFactureId);
  } else {
    const { data, error } = await supabase
      .from('factures')
      .select(
        `*,
        consultations ( date_consultation, patients ( id, nom, prenom, numero_secu, assurances ( id, nom, taux_remboursement ) ) )
        `
      )
      .eq('statut_paiement', 'paye')
      .eq('patient_id', patientId)
      .is('facture_parent_id', null)
      .order('date_paiement', { ascending: false })
      .limit(500);
    if (error) throw error;
    facturesPayeesPatient = data || [];
  }

  const lignes = facturesPayeesPatient.map((f) => {
    const patient = f.consultations?.patients;
    const assurance = patient?.assurances;
    const montantFacture = parseFloat(f.montant_ttc || 0);
    const taux = Number(assurance?.taux_remboursement) || 0;
    let partCouverture = 0;
    let partPatient = montantFacture;
    if (taux > 0 && montantFacture > 0) {
      partCouverture = Math.round(montantFacture * (taux / 100));
      partPatient = montantFacture - partCouverture;
    }
    return {
      id: f.id,
      numero_facture: f.numero_facture,
      date_paiement: f.date_paiement,
      montant_ttc: montantFacture,
      partPatient,
      partCouverture,
      mode_paiement: f.mode_paiement,
      assurance: assurance?.nom,
      taux,
    };
  });

  const stats = { jour: 0, semaine: 0, mois: 0 };
  ['jour', 'semaine', 'mois'].forEach((p) => {
    const { debut } = getDateRangeForPeriod(p);
    lignes.forEach((l) => {
      const d = new Date(l.date_paiement);
      if (d >= debut) stats[p] += l.partPatient;
    });
  });

  return { lignes, stats };
}

/**
 * Historique des factures payées liées à une couverture (assurance) donnée — remplace
 * src/pages/secretary/Caisse.jsx:913-1009 (fetchHistoriqueCouverture). Même distinction
 * caissier/non-caissier que getHistoriquePatient ci-dessus.
 *
 * @param {number|string} assuranceId
 * @param {{caissierId?: number|string|null}} [options]
 * @returns {Promise<{lignes: Array<Object>, stats: {jour: number, semaine: number, mois: number}, global: {jour: number, semaine: number, mois: number}}>}
 */
export async function getHistoriqueCouverture(assuranceId, { caissierId = null } = {}) {
  if (!assuranceId) return { lignes: [], stats: { jour: 0, semaine: 0, mois: 0 }, global: {} };

  let facturesSource = [];

  if (caissierId) {
    const { data, error } = await supabase
      .from('paiements')
      .select(
        `id, date_paiement, mode_paiement, montant, facture_id,
         factures (
           id, numero_facture, montant_ttc, date_paiement, mode_paiement,
           consultations ( date_consultation, patients ( id, nom, prenom, assurance_id, assurances ( id, nom, taux_remboursement ) ) )
         )`
      )
      .eq('caissier_id', caissierId)
      .order('date_paiement', { ascending: false })
      .limit(1000);
    if (error) throw error;
    const byFactureId = {};
    (data || []).forEach((p) => {
      const f = p.factures;
      if (!f) return;
      const patient = f.consultations?.patients;
      const aid = patient?.assurance_id ?? patient?.assurances?.id;
      if (String(aid) !== String(assuranceId)) return;
      if (!byFactureId[f.id]) {
        byFactureId[f.id] = { ...f, date_paiement: p.date_paiement, mode_paiement: p.mode_paiement || f.mode_paiement };
      }
    });
    facturesSource = Object.values(byFactureId);
  } else {
    const { data, error } = await supabase
      .from('factures')
      .select(
        `*,
        consultations ( date_consultation, patients ( id, nom, prenom, assurance_id, assurances ( id, nom, taux_remboursement ) ) )
        `
      )
      .eq('statut_paiement', 'paye')
      .is('facture_parent_id', null)
      .order('date_paiement', { ascending: false })
      .limit(1000);
    if (error) throw error;
    facturesSource = data || [];
  }

  const lignes = [];
  facturesSource.forEach((f) => {
    const patient = f.consultations?.patients;
    const aid = patient?.assurance_id ?? patient?.assurances?.id;
    if (String(aid) !== String(assuranceId)) return;
    const assurance = patient?.assurances;
    const montantFacture = parseFloat(f.montant_ttc || 0);
    const taux = Number(assurance?.taux_remboursement) || 0;
    let partCouverture = 0;
    let partPatient = montantFacture;
    if (taux > 0 && montantFacture > 0) {
      partCouverture = Math.round(montantFacture * (taux / 100));
      partPatient = montantFacture - partCouverture;
    }
    if (partCouverture <= 0) return;
    lignes.push({
      id: f.id,
      numero_facture: f.numero_facture,
      date_paiement: f.date_paiement,
      patient: `${patient?.prenom || ''} ${patient?.nom || ''}`.trim(),
      montant_ttc: montantFacture,
      partPatient,
      partCouverture,
      mode_paiement: f.mode_paiement,
      assurance: assurance?.nom,
    });
  });

  const stats = { jour: 0, semaine: 0, mois: 0 };
  ['jour', 'semaine', 'mois'].forEach((p) => {
    const { debut } = getDateRangeForPeriod(p);
    lignes.forEach((l) => {
      const d = new Date(l.date_paiement);
      if (d >= debut) stats[p] += l.partCouverture;
    });
  });

  const global = { jour: stats.jour, semaine: stats.semaine, mois: stats.mois };
  return { lignes, stats, global };
}
