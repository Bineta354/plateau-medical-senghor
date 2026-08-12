import { supabase } from '../../lib/supabase';

const dayKey = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).split('T')[0] || '';
  return date.toISOString().split('T')[0];
};

const enrichWithAppointmentMotifs = async (consultations) => {
  const list = Array.isArray(consultations) ? consultations : consultations ? [consultations] : [];
  if (list.length === 0) return consultations;

  const appointmentIds = Array.from(new Set(list.map(c => c.appointment_id).filter(Boolean)));
  const patientIds = Array.from(new Set(list.map(c => c.patient_id).filter(Boolean)));
  const doctorIds = Array.from(new Set(list.map(c => c.medecin_id).filter(Boolean)));
  const dateKeys = Array.from(new Set(list.map(c => dayKey(c.date_consultation || c.created_at)).filter(Boolean)));

  if (appointmentIds.length === 0 && (patientIds.length === 0 || doctorIds.length === 0 || dateKeys.length === 0)) {
    return consultations;
  }

  let appointments = [];
  if (appointmentIds.length > 0) {
    const { data, error } = await supabase
      .from('appointments')
      .select('id, patient_id, medecin_id, date_heure, motif')
      .in('id', appointmentIds);
    if (!error && data) appointments = data;
  }

  if (patientIds.length > 0 && doctorIds.length > 0 && dateKeys.length > 0) {
    const sortedDates = [...dateKeys].sort();
    const minDate = sortedDates[0];
    const maxDate = sortedDates[sortedDates.length - 1];
    const endDate = new Date(`${maxDate}T00:00:00.000Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);

    const { data, error } = await supabase
      .from('appointments')
      .select('id, patient_id, medecin_id, date_heure, motif')
      .in('patient_id', patientIds)
      .in('medecin_id', doctorIds)
      .gte('date_heure', `${minDate}T00:00:00.000Z`)
      .lt('date_heure', endDate.toISOString());
    if (!error && data) {
      const existingIds = new Set(appointments.map(a => a.id));
      appointments = [...appointments, ...data.filter(a => !existingIds.has(a.id))];
    }
  }

  const byId = new Map(appointments.map(a => [a.id, a]));
  const byPatientDoctorDay = new Map();
  appointments.forEach((appointment) => {
    const key = `${appointment.patient_id}:${appointment.medecin_id}:${dayKey(appointment.date_heure)}`;
    if (!byPatientDoctorDay.has(key)) byPatientDoctorDay.set(key, appointment);
  });

  const enriched = list.map((consultation) => {
    const linkedAppointment = consultation.appointment_id ? byId.get(consultation.appointment_id) : null;
    const fallbackKey = `${consultation.patient_id}:${consultation.medecin_id}:${dayKey(consultation.date_consultation || consultation.created_at)}`;
    const fallbackAppointment = byPatientDoctorDay.get(fallbackKey);
    const appointment = linkedAppointment || fallbackAppointment || null;
    const appointmentMotif = appointment?.motif || '';

    return {
      ...consultation,
      appointment: appointment || consultation.appointment || null,
      rdv_motif: appointmentMotif,
      motif_consultation: consultation.motif_consultation || consultation.motif || appointmentMotif || null,
      motif: consultation.motif || consultation.motif_consultation || appointmentMotif || null,
      appointment_id: consultation.appointment_id || appointment?.id || null
    };
  });

  return Array.isArray(consultations) ? enriched : enriched[0];
};

export const getConsultation = async (id) => {
  const { data, error } = await supabase
    .from('consultations')
    .select(`
      *,
      patients:patient_id(id, nom, prenom, numero_dossier, date_naissance, sexe),
      users:medecin_id(nom, prenom)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Erreur lors de la récupération de la consultation:', error);
    throw error;
  }

  return enrichWithAppointmentMotifs(data);
};

export const fetchConsultations = async (options = {}) => {
  const { doctorId, status, tenantId } = options;

  let query = supabase
    .from('consultations')
    .select(`
      *,
      patients:patient_id(id, nom, prenom, numero_dossier, date_naissance, sexe),
      users:medecin_id(nom, prenom)
    `);

  if (doctorId) {
    query = query.eq('medecin_id', doctorId);
  }

  if (status) {
    query = query.eq('statut', status);
  }

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data, error } = await query.order('date_consultation', { ascending: false });

  if (error) {
    console.error('Erreur lors du chargement des consultations:', error);
    throw error;
  }

  return enrichWithAppointmentMotifs(data || []);
};

export const getAntecedents = async (patientId) => {
  if (!patientId) return [];
  const { data, error } = await supabase
    .from('antecedents_patients')
    .select(`
      id,
      patient_id,
      antecedent_id,
      date_decouverte,
      commentaires,
      actif,
      created_at,
      antecedents (id, nom, description)
    `)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Erreur getAntecedents:', error);
    return [];
  }
  return data || [];
};

export const getConstantes = async (consultationId) => {
  if (!consultationId) return [];
  const { data, error } = await supabase
    .from('constantes_consultation')
    .select(`
      id,
      consultation_id,
      constante_id,
      valeur_mesuree,
      unite,
      commentaires,
      created_at,
      constantes (id, nom, unite, description, valeur_min, valeur_max)
    `)
    .eq('consultation_id', consultationId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Erreur getConstantes:', error);
    return [];
  }
  return data || [];
};

export const getSignesCliniques = async (consultationId) => {
  if (!consultationId) return [];
  const { data, error } = await supabase
    .from('signes_cliniques_consultation')
    .select(`
      id,
      consultation_id,
      signe_clinique_id,
      intensite,
      localisation,
      commentaires,
      created_at,
      signes_cliniques (id, nom, description)
    `)
    .eq('consultation_id', consultationId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Erreur getSignesCliniques:', error);
    return [];
  }
  return data || [];
};

export const getExamensAppareils = async (consultationId) => {
  if (!consultationId) return [];
  const { data, error } = await supabase
    .from('examens_appareils')
    .select(`
      id,
      consultation_id,
      appareil_id,
      resultat_examen,
      anomalies_detectees,
      recommandations,
      created_at,
      appareils (id, nom, description)
    `)
    .eq('consultation_id', consultationId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Erreur getExamensAppareils:', error);
    return [];
  }
  return data || [];
};

export const getSyntheses = async (consultationId) => {
  if (!consultationId) return [];
  const { data, error } = await supabase
    .from('syntheses_consultation')
    .select(`
      id,
      consultation_id,
      element_synthese_id,
      commentaires,
      created_at,
      elements_synthese (id, nom, description)
    `)
    .eq('consultation_id', consultationId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Erreur getSyntheses:', error);
    return [];
  }
  return data || [];
};

export const getAutresSignes = async (consultationId) => {
  if (!consultationId) return [];
  const { data, error } = await supabase
    .from('autres_signes_physiques')
    .select('id, consultation_id, description, categorie, created_at')
    .eq('consultation_id', consultationId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Erreur getAutresSignes:', error);
    return [];
  }
  return data || [];
};

export const getDiagnostics = async (consultationId) => {
  if (!consultationId) return [];
  const { data, error } = await supabase
    .from('diagnostics_consultation')
    .select(`
      id,
      consultation_id,
      diagnostic_id,
      commentaires,
      certitude,
      created_at,
      diagnostics (id, nom, description)
    `)
    .eq('consultation_id', consultationId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Erreur getDiagnostics:', error);
    return [];
  }
  return data || [];
};

export const getActes = async (consultationId) => {
  if (!consultationId) return [];
  const { data, error } = await supabase
    .from('actes_consultation')
    .select(`
      id,
      consultation_id,
      type_acte_id,
      quantite,
      tarif_unitaire,
      montant_total,
      notes,
      created_at,
      types_actes (id, nom, description, tarif_defaut)
    `)
    .eq('consultation_id', consultationId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Erreur getActes:', error);
    return [];
  }
  return data || [];
};

export const getOrdonnances = async (consultationId) => {
  if (!consultationId) return [];
  const { data, error } = await supabase
    .from('ordonnances')
    .select(`
      id,
      consultation_id,
      numero_ordonnance,
      date_prescription,
      instructions_generales,
      statut,
      created_at,
      lignes_ordonnance (
        id,
        ordonnance_id,
        medicament_id,
        posologie,
        quantite,
        duree_traitement,
        instructions_particulieres,
        medicaments (id, nom, forme_pharmaceutique, dosage)
      )
    `)
    .eq('consultation_id', consultationId)
    .order('date_prescription', { ascending: false });
  if (error) {
    console.error('Erreur getOrdonnances:', error);
    return [];
  }
  return data || [];
};

export const getCertificats = async (consultationId) => {
  if (!consultationId) return [];
  const { data, error } = await supabase
    .from('certificats_medicaux')
    .select(`
      id,
      consultation_id,
      type_certificat_id,
      duree_jours,
      motif,
      restrictions,
      date_debut,
      date_fin,
      statut,
      created_at,
      types_certificats (id, nom, description)
    `)
    .eq('consultation_id', consultationId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Erreur getCertificats:', error);
    return [];
  }
  return data || [];
};

// Retourne l'historique des synthèses du patient, regroupées par consultation
// (une entrée par consultation ayant au moins une synthèse, avec sa liste de
// synthèses) — c'est la forme attendue par la vue "Historique complet" de
// SyntheseTab.jsx (consultation.date_consultation / medecin_prenom / medecin_nom
// / is_current / syntheses).
export const getSyntheseHistorique = async (patientId, currentConsultationId = null) => {
  if (!patientId) return [];
  const { data: consultations, error: consultationsError } = await supabase
    .from('consultations')
    .select('id, date_consultation, users:medecin_id (prenom, nom)')
    .eq('patient_id', patientId)
    .order('date_consultation', { ascending: false })
    .limit(20);
  if (consultationsError) {
    console.error('Erreur getSyntheseHistorique (consultations):', consultationsError);
    return [];
  }
  const consultationIds = (consultations || []).map((c) => c.id);
  if (consultationIds.length === 0) return [];
  const { data, error } = await supabase
    .from('syntheses_consultation')
    .select(`
      id,
      consultation_id,
      commentaires,
      created_at,
      elements_synthese (nom, description, categorie, type_element)
    `)
    .in('consultation_id', consultationIds)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Erreur getSyntheseHistorique (syntheses):', error);
    return [];
  }

  const syntheseParConsultation = {};
  (data || []).forEach((s) => {
    if (!syntheseParConsultation[s.consultation_id]) syntheseParConsultation[s.consultation_id] = [];
    syntheseParConsultation[s.consultation_id].push({
      id: s.id,
      element_nom: s.elements_synthese?.nom,
      element_description: s.elements_synthese?.description,
      element_categorie: s.elements_synthese?.categorie,
      element_type: s.elements_synthese?.type_element,
      commentaires: s.commentaires,
      created_at: s.created_at,
    });
  });

  return consultations
    .filter((c) => syntheseParConsultation[c.id]?.length)
    .map((c) => ({
      consultation_id: c.id,
      date_consultation: c.date_consultation,
      medecin_prenom: c.users?.prenom,
      medecin_nom: c.users?.nom,
      is_current: currentConsultationId != null && String(c.id) === String(currentConsultationId),
      syntheses: syntheseParConsultation[c.id],
    }));
};

export const toggleAntecedentStatus = async (antecedentPatientId, currentActif) => {
  const newActif = !currentActif;
  const { data, error } = await supabase
    .from('antecedents_patients')
    .update({ actif: newActif })
    .eq('id', antecedentPatientId)
    .select()
    .single();
  if (error) {
    console.error('Erreur toggleAntecedentStatus:', error);
    throw error;
  }
  return data;
};

export const addSignesCliniques = async (consultationId, signes) => {
  if (!consultationId || !signes?.length) return { count: 0 };
  const rows = signes.map((s) => ({
    consultation_id: parseInt(consultationId, 10),
    signe_clinique_id: s.signe_clinique_id,
    intensite: s.intensite || null,
    localisation: s.localisation || null,
    commentaires: s.commentaires || null,
  }));
  const { data, error } = await supabase
    .from('signes_cliniques_consultation')
    .insert(rows)
    .select();
  if (error) {
    console.error('Erreur addSignesCliniques:', error);
    throw error;
  }
  return { data, count: data?.length ?? 0 };
};

export const addAutreSigne = async (consultationId, description) => {
  if (!consultationId || !description?.trim()) throw new Error('Consultation et description requis');
  const { data, error } = await supabase
    .from('autres_signes_physiques')
    .insert({
      consultation_id: parseInt(consultationId, 10),
      description: description.trim(),
      categorie: null,
    })
    .select()
    .single();
  if (error) {
    console.error('Erreur addAutreSigne:', error);
    throw error;
  }
  return data;
};

export const updateDentalState = async (consultationId, dentalState) => {
  const { data, error } = await supabase
    .from('consultations')
    .update({ dental_state: dentalState })
    .eq('id', consultationId)
    .select()
    .single();

  if (error) {
    console.error('Erreur lors de la sauvegarde de l\'état dentaire:', error);
    throw error;
  }

  return data;
};

// Récupère le dernier état dentaire connu du patient, en remontant ses
// consultations précédentes (peu importe le médecin), pour que le schéma
// dentaire ne reparte jamais de zéro quand une nouvelle consultation démarre.
export const getLastDentalStateForPatient = async (patientId, excludeConsultationId = null) => {
  if (!patientId) return null;

  let query = supabase
    .from('consultations')
    .select('id, dental_state, date_consultation')
    .eq('patient_id', patientId)
    .not('dental_state', 'is', null)
    .order('date_consultation', { ascending: false })
    .limit(5); // on prend les 5 dernières au cas où certaines auraient un dental_state vide {}

  if (excludeConsultationId) {
    query = query.neq('id', excludeConsultationId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erreur lors de la récupération du dernier état dentaire:', error);
    return null;
  }

  if (!data || data.length === 0) return null;

  // On cherche la première consultation qui a un dental_state réellement rempli
  const found = data.find(
    (c) => c.dental_state && Object.keys(c.dental_state).length > 0
  );

  return found ? found.dental_state : null;
};

export const createConsultation = async (consultationData) => {
  const { data, error } = await supabase
    .from('consultations')
    .insert(consultationData)
    .select(`
      *,
      patients (
        id,
        nom,
        prenom,
        date_naissance,
        numero_dossier
      )
    `)
    .single();

  if (error) {
    console.error('Erreur insertion consultation:', error);
    throw error;
  }
  
  return data;
};

export const updateConsultationStatus = async (consultationId, newStatus) => {
  const { error } = await supabase
    .from('consultations')
    .update({ statut: newStatus })
    .eq('id', consultationId);

  if (error) {
    console.error('Erreur lors de la mise à jour du statut:', error);
    throw error;
  }
};

export const deleteConsultation = async (consultationId) => {
  const { error } = await supabase
    .from('consultations')
    .delete()
    .eq('id', consultationId);

  if (error) {
    console.error('Erreur lors de la suppression:', error);
    throw error;
  }
};

export const generateRapport = async (consultationId, format = 'complet') => {
    const { data, error } = await supabase
      .from('rapports_consultation')
      .insert({
        consultation_id: consultationId,
        type_rapport: 'pdf',
        format_rapport: format,
        statut: 'en_cours'
      })
      .select()
      .single();

    if (error) {
      console.error('Erreur lors de la génération du rapport:', error);
      throw error;
    }

    // Simulation de génération (comme dans le code original)
    // Dans une vraie implémentation, cela serait géré par un backend/worker
    setTimeout(() => {
      supabase
        .from('rapports_consultation')
        .update({
          statut: 'termine',
          url_fichier: `/rapports/consultation_${consultationId}_${format}.pdf`,
          taille_fichier: 1024 * 100
        })
        .eq('id', data.id);
    }, 2000);

    return data;
};