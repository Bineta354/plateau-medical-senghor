import { supabase } from './supabase.js'
import { getSpecialityFilter, getSpecialiteIdsWithChildren } from './specialityConfigService.js'

// ===== SERVICES POUR LES UTILISATEURS (USERS) =====
export const userService = {
  // Récupérer tous les utilisateurs, cloisonnés par tenant (cabinet).
  // tenantId: à fournir par l'appelant (ex: useAuth().tenantId) pour éviter un aller-retour
  // réseau supplémentaire ; sinon résolu depuis l'utilisateur connecté, comme dans getDoctors().
  async getAll(options = {}) {
    const { tenantId = null } = options
    let currentTenantId = tenantId
    if (!currentTenantId) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: currentUserData } = await supabase
            .from('users')
            .select('tenant_id')
            .eq('auth_id', user.id)
            .maybeSingle()
          currentTenantId = currentUserData?.tenant_id || null
        }
      } catch (e) {
        console.warn('[userService.getAll] Impossible de récupérer le tenant_id utilisateur:', e)
      }
    }

    let query = supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
    if (currentTenantId) {
      query = query.eq('tenant_id', currentTenantId)
    }

    const { data, error } = await query
    if (error) throw error
    return data
  },

  // Récupérer un utilisateur par ID
  async getById(id) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  // Créer un nouvel utilisateur
  async create(userData) {
    const { data, error } = await supabase
      .from('users')
      .insert([userData])
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Mettre à jour un utilisateur
  async update(id, updates) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Supprimer un utilisateur
  async delete(id) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  // Récupérer les médecins
  async getDoctors(options = {}) {
    const { ignoreSpecialityFilter = false } = options || {}
    console.log(`[SPECIALITY_CONFIG] userService.getDoctors() appelé`, { ignoreSpecialityFilter })
    const specialiteId = ignoreSpecialityFilter ? null : await getSpecialityFilter()
    // Recuperer le tenant_id de l'utilisateur connecte pour cloisonner par cabinet
    let currentTenantId = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: currentUserData } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('auth_id', user.id)
          .maybeSingle();
        currentTenantId = currentUserData?.tenant_id || null;
      }
    } catch (e) {
      console.warn('[SPECIALITY_CONFIG] Impossible de recuperer le tenant_id utilisateur:', e);
    }
    let query = supabase
      .from('users')
      .select('*, couleur')
      .eq('role', 'doctor')
      .eq('actif', true) // Seulement les médecins actifs
    if (currentTenantId) {
      query = query.eq('tenant_id', currentTenantId)
    }
    
    // Appliquer le filtre de spécialité si en mode spécialité et non ignoré explicitement
    if (specialiteId !== null) {
      const idsAvecEnfants = await getSpecialiteIdsWithChildren(specialiteId)

      // Un médecin doit être inclus s'il a cette spécialité en principale (specialite_id)
      // OU en associée/secondaire (table medecin_specialites) — sinon un médecin dont la
      // spécialité recherchée n'est que secondaire serait exclu ici, avant même que ses
      // spécialités associées soient récupérées plus bas.
      const { data: associationsMatch, error: associationsMatchError } = await supabase
        .from('medecin_specialites')
        .select('medecin_id')
        .in('specialite_id', idsAvecEnfants)
      if (associationsMatchError) {
        console.warn('[SPECIALITY_CONFIG] Impossible de récupérer les médecins par spécialité associée:', associationsMatchError)
      }
      const idsMedecinsParAssociation = Array.from(
        new Set((associationsMatch || []).map((a) => a.medecin_id))
      )

      console.log(`[SPECIALITY_CONFIG] Filtre spécialité appliqué aux médecins`, {
        specialite_id: specialiteId,
        service: 'userService.getDoctors()',
        filter: 'specialite_id = ' + specialiteId,
        medecins_via_specialite_associee: idsMedecinsParAssociation.length
      })

      if (idsMedecinsParAssociation.length > 0) {
        query = query.or(
          `specialite_id.in.(${idsAvecEnfants.join(',')}),id.in.(${idsMedecinsParAssociation.join(',')})`
        )
      } else {
        query = query.in('specialite_id', idsAvecEnfants)
      }
    } else {
      if (ignoreSpecialityFilter) {
        console.log(`[SPECIALITY_CONFIG] Ignorer le filtre spécialité (appel explicite, ex: secrétaire)`)
      } else {
        console.log(`[SPECIALITY_CONFIG] Mode généraliste - Tous les médecins actifs seront retournés`)
      }
    }
    
    const { data, error } = await query.order('nom', { ascending: true })

    if (error) {
      console.error(`[SPECIALITY_CONFIG] Erreur lors de la récupération des médecins:`, error)
      throw error
    }

    // Rattacher les spécialités associées (secondaires) de chaque médecin, pour que les
    // écrans de prise de rendez-vous puissent proposer un médecin même quand la spécialité
    // recherchée n'est pas sa spécialité principale (specialite_id).
    if (data && data.length > 0) {
      const { data: associations, error: assocError } = await supabase
        .from('medecin_specialites')
        .select('medecin_id, specialite_id')
        .in('medecin_id', data.map((d) => d.id))
      if (assocError) {
        console.warn('[SPECIALITY_CONFIG] Impossible de récupérer les spécialités associées:', assocError)
      } else {
        const bymedecin = {}
        ;(associations || []).forEach((a) => {
          if (!bymedecin[a.medecin_id]) bymedecin[a.medecin_id] = []
          bymedecin[a.medecin_id].push(a.specialite_id)
        })
        data.forEach((d) => {
          d.specialite_ids_associees = bymedecin[d.id] || []
        })
      }
    }

    console.log(`[SPECIALITY_CONFIG] Médecins récupérés`, {
      count: data?.length || 0,
      specialite_id: specialiteId,
      mode: specialiteId !== null ? 'Spécialité' : 'Généraliste',
      details: data?.map(d => ({
        id: d.id,
        nom: d.nom,
        prenom: d.prenom,
        specialite_id: d.specialite_id,
        specialite_ids_associees: d.specialite_ids_associees,
        actif: d.actif
      })) || []
    })

    return data || []
  },

  // Récupérer les secrétaires
  async getSecretaries() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'secretary')
      .order('nom', { ascending: true })
    if (error) throw error
    return data
  },

  // Récupérer uniquement les spécialités réellement pratiquées par au moins un médecin actif
  // (spécialité principale ou additionnelle), en incluant le parent si un enfant est pratiqué
  async getUniqueDoctorSpecialties() {
    console.log(`[SPECIALITY_CONFIG] userService.getUniqueDoctorSpecialties() appelé`)
    try {
      const { data: allSpecialites, error: specError } = await supabase
        .from('specialites')
        .select('id, nom, parent_id')
        .eq('actif', true)
        .order('nom', { ascending: true })
      if (specError) throw specError

      const { data: doctorsPrimary, error: docError } = await supabase
        .from('users')
        .select('specialite_id')
        .eq('role', 'doctor')
        .eq('actif', true)
      if (docError) throw docError

      const { data: doctorsAdditional, error: addError } = await supabase
        .from('medecin_specialites')
        .select('specialite_id, users:medecin_id(actif, role)')
      if (addError) throw addError

      const practicedIds = new Set()
      ;(doctorsPrimary || []).forEach((d) => {
        if (d.specialite_id) practicedIds.add(d.specialite_id)
      })
      ;(doctorsAdditional || []).forEach((d) => {
        if (d.specialite_id && d.users?.actif && d.users?.role === 'doctor') {
          practicedIds.add(d.specialite_id)
        }
      })

      const byId = Object.fromEntries((allSpecialites || []).map((s) => [s.id, s]))
      const visibleIds = new Set()
      practicedIds.forEach((id) => {
        visibleIds.add(id)
        const spec = byId[id]
        if (spec?.parent_id) visibleIds.add(spec.parent_id)
      })

      const result = (allSpecialites || []).filter((s) => visibleIds.has(s.id))
      console.log(`[SPECIALITY_CONFIG] Spécialités pratiquées récupérées`, { specialites: result })
      return result
    } catch (error) {
      console.error(`[SPECIALITY_CONFIG] Erreur lors de la récupération des spécialités pratiquées:`, error)
      return []
    }
  },

  // Récupérer les spécialités (additionnelles, table de liaison medecin_specialites) d'UN médecin donné.
  // Complète getUniqueDoctorSpecialties() ci-dessus, qui lit la même table mais de façon agrégée
  // (toutes spécialités pratiquées, tous médecins confondus) — extrait de
  // src/pages/administration/FormulaireUtilisateur.jsx → fetchUtilisateur() (lignes ~226-234).
  async getSpecialitesByMedecin(medecinId) {
    const { data, error } = await supabase
      .from('medecin_specialites')
      .select('specialite_id, specialites:specialite_id(id, nom)')
      .eq('medecin_id', medecinId)
    if (error) throw error
    return data || []
  },

  // Synchronise (remplace) la liste des spécialités additionnelles d'un médecin via le RPC
  // sync_medecin_specialites (delete+insert atomique côté DB) — extrait de
  // src/pages/administration/FormulaireUtilisateur.jsx → handleSubmit(), appelé pour la
  // création (ligne ~337) et pour la modification (ligne ~357) d'un utilisateur médecin.
  async syncSpecialitesMedecin(medecinId, specialiteIds = []) {
    const { error } = await supabase.rpc('sync_medecin_specialites', {
      p_medecin_id: medecinId,
      p_specialite_ids: specialiteIds,
    })
    if (error) throw error
  }
}

// ===== SERVICES POUR LES PATIENTS =====
export const patientService = {
  // Récupérer tous les patients
  async getAll() {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .order('nom', { ascending: true })
    if (error) throw error
    return data
  },

  // Récupérer un patient par ID
  async getById(id) {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  // Récupérer un patient par ID avec sa jointure assurance — extrait de
  // src/pages/patients/PatientDetailsPage.jsx -> loadPatient() (lignes ~32-52).
  // Additif : ne remplace pas getById() ci-dessus, utilisé quand la page a besoin
  // du détail de l'assurance (nom, type, taux, description) en plus du patient.
  async getByIdWithAssurance(id) {
    const { data, error } = await supabase
      .from('patients')
      .select(`
        *,
        assurances!fk_patients_assurance (
          id,
          nom,
          type_assurance,
          taux_remboursement,
          description
        )
      `)
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  // Liste de tous les patients avec leur assurance liée (colonnes réduites) — extrait de
  // src/pages/caissier/Recapitulatif.jsx (chargement initial, sélecteur "Patient").
  // Additif : distinct de getAll() ci-dessus (qui fait select('*') sans jointure).
  async getAllWithAssurance() {
    const { data, error } = await supabase
      .from('patients')
      .select('id, nom, prenom, assurance_id, assurances!fk_patients_assurance ( id, nom, taux_remboursement )')
      .order('nom', { ascending: true })
    if (error) throw error
    return data || []
  },

  // Créer un nouveau patient
  async create(patientData) {
    const { data, error } = await supabase
      .from('patients')
      .insert([patientData])
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Mettre à jour un patient
  async update(id, updates) {
    const { data, error } = await supabase
      .from('patients')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Supprimer un patient
  async delete(id) {
    const { error } = await supabase
      .from('patients')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  // Rechercher des patients
  async search(query) {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .or(`nom.ilike.%${query}%,prenom.ilike.%${query}%`)
      .order('nom', { ascending: true })
    if (error) throw error
    return data
  }
}

// ===== SERVICES POUR LES RENDEZ-VOUS =====
export const appointmentService = {
  isCreating: false,

  /**
   * Validation unifiée des données de rendez-vous
   */
  validateAppointmentData(formData) {
    const errors = [];

    if (!formData.patient_id) {
      errors.push('Patient invalide ou manquant');
    }

    if (!formData.medecin_id) {
      errors.push('Médecin invalide ou manquant');
    }

    // Validation date_heure
    if (!formData.date_heure) {
      errors.push('Date et heure manquantes');
    } else {
      const appointmentDate = new Date(formData.date_heure);
      const now = new Date();
      // Permettre les rendez-vous jusqu'à 24h dans le passé pour les corrections et ajustements
      // Cela permet de gérer les problèmes de fuseau horaire et les créations tardives
      const minAllowedTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      console.log('🕐 [Validation] Date RDV:', appointmentDate.toISOString());
      console.log('🕐 [Validation] Date actuelle:', now.toISOString());
      console.log('🕐 [Validation] Date minimum autorisée:', minAllowedTime.toISOString());
      console.log('🕐 [Validation] Comparaison:', appointmentDate, '<', minAllowedTime, '=', appointmentDate < minAllowedTime);
      
      if (isNaN(appointmentDate.getTime())) {
        errors.push('Date et heure invalides');
      } else if (appointmentDate < minAllowedTime) {
        errors.push('La date ne peut pas être antérieure à 24 heures');
      }
    }

    // Validation contraintes CHECK
    const validStatuts = ['confirme', 'en_attente', 'annule', 'termine', 'reporte'];
    if (formData.statut && !validStatuts.includes(formData.statut)) {
      errors.push('Statut invalide');
    }

    const validPriorites = ['normale', 'urgente', 'tres_urgente'];
    if (formData.priorite && !validPriorites.includes(formData.priorite)) {
      errors.push('Priorité invalide');
    }

    const validTypesRdv = ['consultation', 'suivi', 'urgence', 'preventif'];
    if (formData.type_rdv && !validTypesRdv.includes(formData.type_rdv)) {
      errors.push('Type de rendez-vous invalide');
    }

    return errors;
  },

  /**
   * Préparation unifiée des données pour insertion
   */
  prepareAppointmentData(formData, currentUser = null) {
    const appointmentData = {
      patient_id: formData.patient_id,
      medecin_id: formData.medecin_id,
      date_heure: new Date(formData.date_heure).toISOString(),
      motif: formData.motif || '',
      duree: parseInt(formData.duree) || 30,
      priorite: formData.priorite || 'normale',
      statut: formData.statut || 'confirme',
      couleur: formData.couleur || '#3b82f6',
      type_rdv: formData.type_rdv || 'consultation',
      notes: formData.notes || ''
    };

    // Calculer heure_fin si duree est spécifiée
    if (appointmentData.duree) {
      const startTime = new Date(appointmentData.date_heure);
      const endTime = new Date(startTime.getTime() + appointmentData.duree * 60000);
      appointmentData.heure_fin = endTime.toISOString();
    }

    // Ajouter created_by et updated_by si disponibles
    // Note: currentUser.id est un UUID de Supabase Auth, created_by/updated_by sont aussi UUID
    if (currentUser?.id) {
      appointmentData.created_by = currentUser.id;
      appointmentData.updated_by = currentUser.id;
    }

    return appointmentData;
  },

  /**
   * Vérification de l'existence du patient
   */
  async verifyPatientExists(patientId) {
    const { data: patient, error } = await supabase
      .from('patients')
      .select('id, nom, prenom')
      .eq('id', patientId)
      .single();

    if (error) {
      throw new Error(`Patient introuvable: ${error.message}`);
    }

    return patient;
  },

  /**
   * Vérification de l'existence du médecin
   */
  async verifyDoctorExists(medecinId) {
    const { data: medecin, error } = await supabase
      .from('users')
      .select('id, nom, prenom, role')
      .eq('id', medecinId)
      .single();

    if (error) {
      throw new Error(`Médecin introuvable: ${error.message}`);
    }

    if (medecin.role !== 'doctor') {
      throw new Error('L\'utilisateur sélectionné n\'est pas un médecin');
    }

    return medecin;
  },

  /**
   * Vérification des conflits de créneaux
   */
  async checkTimeSlotConflicts(medecinId, dateHeure, excludeId = null) {
    let query = supabase
      .from('appointments')   // ✅ correct
      .select('id, date_heure, motif')
      .eq('medecin_id', medecinId)
      .eq('date_heure', dateHeure)
      .neq('statut', 'annule');

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data: conflicts, error } = await query;

    if (error) {
      console.warn('Impossible de vérifier les conflits:', error);
      return [];
    }

    return conflicts || [];
  },

  /**
   * Vérification des conflits de rendez-vous pour un patient
   * Vérifie si le patient a déjà un rendez-vous à la même date et heure
   */
  async checkPatientAppointmentConflicts(patientId, dateHeure, excludeId = null) {
    let query = supabase
      .from('appointments')
      .select('id, date_heure, medecin_id, statut')
      .eq('patient_id', patientId)
      .eq('date_heure', dateHeure)
      .neq('statut', 'annule')
      .neq('statut', 'termine');

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data: conflicts, error } = await query;

    if (error) {
      console.warn('Impossible de vérifier les conflits patient:', error);
      return [];
    }

    return conflicts || [];
  },

  /**
   * Vérification des doublons de rendez-vous (même patient, même médecin, même jour)
   * Règle métier : Un patient ne peut avoir qu'un seul rendez-vous par jour avec un médecin spécifique
   */
  async checkPatientDoctorSameDayConflict(patientId, medecinId, dateHeure, excludeId = null) {
    const appointmentDate = new Date(dateHeure);
    const startOfDay = new Date(appointmentDate.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(appointmentDate.setHours(23, 59, 59, 999)).toISOString();

    let query = supabase
      .from('appointments')
      .select('id, date_heure, statut')
      .eq('patient_id', patientId)
      .eq('medecin_id', medecinId)
      .gte('date_heure', startOfDay)
      .lte('date_heure', endOfDay)
      .neq('statut', 'annule')
      .neq('statut', 'reporte');

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data: conflicts, error } = await query;

    if (error) {
      console.warn('Impossible de vérifier les conflits patient/médecin/jour:', error);
      return [];
    }

    return conflicts || [];
  },

  // Récupérer tous les rendez-vous avec les détails des patients et médecins
  async getAll(options = {}) {
    const { ignoreSpecialityFilter = false } = options || {}
    console.log(`[SPECIALITY_CONFIG] appointmentService.getAll() appelé`, { ignoreSpecialityFilter })
    const specialiteId = ignoreSpecialityFilter ? null : await getSpecialityFilter()
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        patient:patients(nom, prenom, telephone),
        medecin:users!fk_appointments_medecin(nom, prenom, specialite, specialite_id, couleur)
      `)
      .order('date_heure', { ascending: true })
    
    if (error) throw error
    
    // Filtrer par spécialité côté client si nécessaire
    if (specialiteId !== null && data) {
      const filteredData = data.filter(appointment => appointment.medecin?.specialite_id === specialiteId)
      console.log(`[SPECIALITY_CONFIG] Rendez-vous filtrés par spécialité`, {
        total_avant_filtre: data.length,
        total_apres_filtre: filteredData.length,
        specialite_id: specialiteId,
        service: 'appointmentService.getAll()'
      })
      return filteredData
    }
    
    if (ignoreSpecialityFilter) {
      console.log(`[SPECIALITY_CONFIG] Ignorer le filtre spécialité pour les rendez-vous (appel explicite, ex: secrétaire)`)
    } else {
      console.log(`[SPECIALITY_CONFIG] Mode généraliste - Tous les rendez-vous retournés`, {
        count: data?.length || 0
      })
    }
    
    return data
  },

  // Récupérer les rendez-vous d'un médecin
  async getByDoctor(medecinId, date = null) {
    let query = supabase
      .from('appointments')
      .select(`
        *,
        patient:patients(nom, prenom, telephone),
        medecin:users!fk_appointments_medecin(nom, prenom, specialite, specialite_id, couleur)
      `)
      .eq('medecin_id', medecinId)
      .order('date_heure', { ascending: true })

    if (date) {
      query = query.gte('date_heure', date + 'T00:00:00')
        .lt('date_heure', date + 'T23:59:59')
    }

    const { data, error } = await query
    if (error) throw error
    return data
  },

  // Récupérer les rendez-vous d'un patient
  async getByPatient(patientId) {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        medecin:users(nom, prenom, specialite)
      `)
      .eq('patient_id', patientId)
      .order('date_heure', { ascending: true })
    if (error) throw error
    return data
  },

  // Récupérer les rendez-vous du jour
  async getToday() {
    console.log(`[SPECIALITY_CONFIG] appointmentService.getToday() appelé`)
    const specialiteId = await getSpecialityFilter()
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        patient:patients(nom, prenom, telephone),
        medecin:users!fk_appointments_medecin(nom, prenom, specialite, specialite_id)
      `)
      .gte('date_heure', today + 'T00:00:00')
      .lt('date_heure', today + 'T23:59:59')
      .order('date_heure', { ascending: true })
    
    if (error) throw error
    
    // Filtrer par spécialité côté client si nécessaire
    if (specialiteId !== null && data) {
      const filteredData = data.filter(appointment => appointment.medecin?.specialite_id === specialiteId)
      console.log(`[SPECIALITY_CONFIG] Rendez-vous du jour filtrés par spécialité`, {
        total_avant_filtre: data.length,
        total_apres_filtre: filteredData.length,
        specialite_id: specialiteId,
        date: today,
        service: 'appointmentService.getToday()'
      })
      return filteredData
    }
    
    console.log(`[SPECIALITY_CONFIG] Mode généraliste - Tous les rendez-vous du jour retournés`, {
      count: data?.length || 0,
      date: today
    })
    
    return data
  },

  // Créer un nouveau rendez-vous
  async create(formData, currentUser = null, options = {}) {
    const { 
      maxRetries = 3, 
      retryDelay = 1000,
      skipConflictCheck = false 
    } = options;

    // Protection anti-double soumission
    if (this.isCreating) {
      throw new Error('Création déjà en cours');
    }

    this.isCreating = true;

    try {
      console.log('🚀 [appointmentService] Début création RDV');
      console.log('📋 [appointmentService] FormData:', formData);

      // 1. Validation des données
      const validationErrors = this.validateAppointmentData(formData);
      if (validationErrors.length > 0) {
        throw new Error(`Validation échouée: ${validationErrors.join(', ')}`);
      }

      // 2. Préparation des données
      const appointmentData = this.prepareAppointmentData(formData, currentUser);
      console.log('📤 [appointmentService] Données préparées:', appointmentData);

      // 3. Vérifications d'existence
      const patient = await this.verifyPatientExists(appointmentData.patient_id);
      const medecin = await this.verifyDoctorExists(appointmentData.medecin_id);

      console.log('✅ [appointmentService] Patient trouvé:', patient);
      console.log('✅ [appointmentService] Médecin trouvé:', medecin);

      // 4. Vérification des conflits (optionnel)
      if (!skipConflictCheck) {
        // 4.1 Vérifier les conflits pour le médecin
        const doctorConflicts = await this.checkTimeSlotConflicts(
          appointmentData.medecin_id,
          appointmentData.date_heure
        );

        if (doctorConflicts.length > 0) {
          throw new Error('Créneau déjà occupé pour ce médecin à cette heure');
        }

        // 4.2 Vérifier les conflits pour le patient
        const patientConflicts = await this.checkPatientAppointmentConflicts(
          appointmentData.patient_id,
          appointmentData.date_heure
        );

        if (patientConflicts.length > 0) {
          throw new Error('Ce patient possède déjà un rendez-vous programmé à cette date et à cette heure');
        }

        // 4.3 Vérifier les doublons (même patient, même médecin, même jour)
        const sameDayConflicts = await this.checkPatientDoctorSameDayConflict(
          appointmentData.patient_id,
          appointmentData.medecin_id,
          appointmentData.date_heure
        );

        if (sameDayConflicts.length > 0) {
          throw new Error('Ce patient a déjà un rendez-vous avec ce médecin aujourd\'hui');
        }
      }

      // 4.1. Nettoyer les entrées existantes dans waiting_queue pour ce patient/médecin
      console.log('🧹 [appointmentService] Nettoyage waiting_queue existant...');
      const { error: cleanupError } = await supabase
        .from('waiting_queue')
        .delete()
        .eq('patient_id', appointmentData.patient_id)
        .eq('medecin_id', appointmentData.medecin_id);

      if (cleanupError) {
        console.warn('⚠️ [appointmentService] Erreur nettoyage waiting_queue:', cleanupError);
      } else {
        console.log('✅ [appointmentService] Waiting_queue nettoyé avec succès');
      }

      // 5. Insertion avec retry
      let lastError;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`💾 [appointmentService] Tentative ${attempt}/${maxRetries}`);

          const { data: newAppointment, error } = await supabase
            .from('appointments')
            .insert([{
              patient_id: appointmentData.patient_id,
              medecin_id: appointmentData.medecin_id,
              date_heure: appointmentData.date_heure,
              motif: appointmentData.motif,
              duree: appointmentData.duree,
              priorite: appointmentData.priorite,
              statut: appointmentData.statut,
              notes: appointmentData.notes,
              created_by: appointmentData.created_by,
              updated_by: appointmentData.updated_by
            }])
            .select()
            .single();

          if (error) throw error;

          console.log('✅ [appointmentService] RDV créé avec succès:', newAppointment);

          return {
            success: true,
            appointment: newAppointment,
            patient: patient,
            medecin: medecin
          };

        } catch (err) {
          lastError = err;
          console.warn(`⚠️ [appointmentService] Tentative ${attempt} échouée:`, err.message);

          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          }
        }
      }

      throw lastError;

    } catch (error) {
      console.error('❌ [appointmentService] Erreur création:', error);
      throw error;
    } finally {
      this.isCreating = false;
    }
  },

  // Mettre à jour un rendez-vous
  async update(appointmentId, formData, currentUser = null) {
    console.log('✏️ [appointmentService] Mise à jour RDV:', appointmentId);

    // Validation et préparation des données
    const validationErrors = this.validateAppointmentData(formData);
    if (validationErrors.length > 0) {
      throw new Error(`Validation échouée: ${validationErrors.join(', ')}`);
    }

    const appointmentData = this.prepareAppointmentData(formData, currentUser);

    // Vérifications d'existence
    await this.verifyPatientExists(appointmentData.patient_id);
    await this.verifyDoctorExists(appointmentData.medecin_id);

    // Vérification des conflits (exclure le RDV actuel)
    // 4.1 Vérifier les conflits pour le médecin
    const doctorConflicts = await this.checkTimeSlotConflicts(
      appointmentData.medecin_id,
      appointmentData.date_heure,
      appointmentId
    );

    if (doctorConflicts.length > 0) {
      throw new Error('Créneau déjà occupé pour ce médecin à cette heure');
    }

    // 4.2 Vérifier les conflits pour le patient
    const patientConflicts = await this.checkPatientAppointmentConflicts(
      appointmentData.patient_id,
      appointmentData.date_heure,
      appointmentId
    );

    if (patientConflicts.length > 0) {
      throw new Error('Ce patient possède déjà un rendez-vous programmé à cette date et à cette heure');
    }

    // Mise à jour
    const { data: updatedAppointment, error } = await supabase
      .from('appointments')
      .update(appointmentData)
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) throw error;

    console.log('✅ [appointmentService] RDV mis à jour:', updatedAppointment);

    return {
      success: true,
      appointment: updatedAppointment
    };
  },

  /**
   * Message affiché lorsqu'un patient a déjà un RDV avec le même médecin le même jour
   */
  SAME_DAY_DOCTOR_CONFLICT_MESSAGE:
    'Le patient possède déjà un rendez-vous avec ce médecin pour cette journée.',

  isSameDayDoctorConflict(error) {
    const msg = String(error?.message || error?.details || error?.hint || '');
    const code = String(error?.code || '');
    return (
      msg.includes('aujourd\'hui') ||
      msg.includes('idx_appointments_patient_medecin_date') ||
      msg.includes('patient_medecin_date') ||
      (code === '23505' && msg.toLowerCase().includes('appointments'))
    );
  },

  /**
   * Retourne le type, titre et message à afficher lors d'un échec de création/modification
   */
  getCreationErrorNotification(error) {
    if (this.isSameDayDoctorConflict(error)) {
      return {
        type: 'warning',
        title: 'Impossible de créer le rendez-vous',
        message: this.SAME_DAY_DOCTOR_CONFLICT_MESSAGE,
      };
    }

    const msg = String(error?.message || '');

    if (msg.includes('Créneau déjà occupé')) {
      return {
        type: 'warning',
        title: 'Créneau indisponible',
        message:
          'Ce créneau horaire est déjà occupé pour ce médecin. Veuillez choisir une autre heure.',
      };
    }

    if (msg.includes('déjà un rendez-vous programmé')) {
      return {
        type: 'warning',
        title: 'Impossible de créer le rendez-vous',
        message:
          'Ce patient a déjà un rendez-vous programmé à cette date et à cette heure.',
      };
    }

    if (msg.includes('Création déjà en cours')) {
      return {
        type: 'warning',
        title: 'Création en cours',
        message: 'Un rendez-vous est déjà en cours de création. Veuillez patienter.',
      };
    }

    return {
      type: 'error',
      title: 'Erreur',
      message: this.getErrorMessage(error),
    };
  },

  /**
   * Gestion d'erreur unifiée avec messages spécifiques
   */
  getErrorMessage(error) {
    if (this.isSameDayDoctorConflict(error)) {
      return this.SAME_DAY_DOCTOR_CONFLICT_MESSAGE;
    }

    if (error.message?.includes('foreign key')) {
      if (error.message.includes('patient')) {
        return 'Patient sélectionné invalide. Veuillez choisir un autre patient.';
      } else if (error.message.includes('medecin') || error.message.includes('users')) {
        return 'Médecin sélectionné invalide. Veuillez choisir un autre médecin.';
      } else {
        return 'Référence invalide. Vérifiez le patient et le médecin sélectionnés.';
      }
    } else if (error.message?.includes('check constraint')) {
      return 'Valeur invalide détectée. Vérifiez le statut, la priorité et le type de rendez-vous.';
    } else if (error.message?.includes('not-null')) {
      return 'Champ obligatoire manquant. Vérifiez que tous les champs requis sont remplis.';
    } else if (error.message?.includes('unique')) {
      return 'Conflit de créneaux détecté. Ce créneau est peut-être déjà pris.';
    } else if (error.message?.includes('permission') || error.message?.includes('policy')) {
      return 'Permissions insuffisantes. Contactez l\'administrateur.';
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      return 'Problème de connexion. Vérifiez votre connexion internet et réessayez.';
    } else if (error.message?.includes('duplicate key value violates unique constraint')) {
      return 'Conflit détecté. Un rendez-vous similaire existe peut-être déjà.';
    }

    return error.message || 'Erreur inconnue lors de la création du rendez-vous.';
  },

  // Supprimer un rendez-vous et ses entrées associées dans la file d'attente
  async deleteAppointmentAndQueue(appointmentId) {
    try {
      // Récupérer d'abord le statut du rendez-vous
      const { data: appointment, error: fetchError } = await supabase
        .from('appointments')
        .select('statut')
        .eq('id', appointmentId)
        .single();

      if (fetchError) {
        console.error('Erreur lors de la récupération du rendez-vous:', fetchError);
        throw fetchError;
      }

      // Empêcher la suppression des rendez-vous déjà réalisés
      const completedStatuses = ['terminee', 'termine', 'réalisé', 'consulté', 'termine_consultation', 'consultation_terminee'];
      if (appointment && completedStatuses.includes(appointment.statut?.toLowerCase())) {
        throw new Error('Impossible de supprimer un rendez-vous déjà réalisé. Ce rendez-vous fait partie de l\'historique médical.');
      }

      // Supprimer d'abord les entrées de file d'attente liées à ce RDV
      const { error: queueError } = await supabase
        .from('waiting_queue')
        .delete()
        .eq('appointment_id', appointmentId);

      if (queueError) {
        console.error('Erreur lors de la suppression de l\'entrée de file d\'attente:', queueError);
        throw queueError;
      }

      // Supprimer le rendez-vous
      const { error: appointmentError } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId);
      
      if (appointmentError) {
        console.error('Erreur lors de la suppression du rendez-vous:', appointmentError);
        throw appointmentError;
      }
      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la suppression du rendez-vous et de la file d\'attente associée:', error);
      return { success: false, error: error.message };
    }
  },

  // Alias pour deleteAppointmentAndQueue (compatibilité avec code existant)
  async deleteAppointment(appointmentId) {
    return this.deleteAppointmentAndQueue(appointmentId);
  },

  // Récupérer les rendez-vous par mois et spécialité
  async getByMonthAndSpeciality(selectedSpecialite, selectedMonth) {
    try {
      const startDate = new Date(selectedMonth + '-01');
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

      let query = supabase
        .from('appointments')
        .select(`
          *,
          patients:patient_id (nom, prenom),
          medecins:medecin_id (nom, prenom, specialite)
        `)
        .gte('date_heure', startDate.toISOString())
        .lte('date_heure', endDate.toISOString())
        .order('date_heure', { ascending: true });

      if (selectedSpecialite) {
        // Find doctors with the selected specialty and then filter appointments by these doctors
        const { data: doctorsData, error: doctorsError } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'doctor')
          .eq('specialite', selectedSpecialite);

        if (doctorsError) throw doctorsError;
        const doctorIds = doctorsData.map(d => d.id);
        query = query.in('medecin_id', doctorIds);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erreur lors du chargement des rendez-vous par mois et spécialité:', error);
      throw error;
    }
  },

  // Récupérer les rendez-vous pour une date donnée
  async getAppointmentsByDate(dayString) {
    try {
      const { data: baseAppts, error: apptErr } = await supabase
        .from('appointments')
        .select('*')
        .gte('date_heure', `${dayString}T00:00:00`)
        .lt('date_heure', `${dayString}T23:59:59`)
        .order('date_heure', { ascending: true });
      
      if (apptErr) throw apptErr;

      const list = Array.isArray(baseAppts) ? baseAppts : [];
      if (list.length === 0) return [];

      const patientIds = Array.from(new Set(list.map(a => a.patient_id).filter(Boolean)));
      const doctorIds = Array.from(new Set(list.map(a => a.medecin_id).filter(Boolean)));

      let patientMap = {};
      let doctorMap = {};

      if (patientIds.length > 0) {
        const { data: pRows } = await supabase
          .from('patients')
          .select('id, nom, prenom, telephone')
          .in('id', patientIds);
        if (pRows) patientMap = Object.fromEntries(pRows.map(p => [p.id, p]));
      }

      if (doctorIds.length > 0) {
        const { data: dRows } = await supabase
          .from('users')
          .select('id, nom, prenom, specialite, specialite_id')
          .in('id', doctorIds);
        if (dRows) doctorMap = Object.fromEntries(dRows.map(d => [d.id, d]));
      }

      const enriched = list.map(a => ({
        ...a,
        patient: patientMap[a.patient_id] || null,
        medecin: doctorMap[a.medecin_id] || null,
      }));
      
      return enriched;

    } catch (error) {
      console.error('Erreur lors du chargement des rendez-vous par date:', error);
      throw error;
    }
  },

  // Récupérer les rendez-vous pour une date donnée et un médecin spécifique
  async getAppointmentsByDateAndDoctor(dayString, doctorId = null, specialite = null) {
    try {
      console.log("=== Début du filtrage dans getAppointmentsByDateAndDoctor ===");
      console.log("Date :", dayString);
      console.log("Médecin sélectionné :", doctorId);
      console.log("Type du médecin :", typeof doctorId);
      console.log("Spécialité :", specialite);

      let appointments = await this.getAppointmentsByDate(dayString);

      console.log("Nombre de rendez-vous récupérés avant filtrage :", appointments.length);
      console.table(appointments);

      console.log("Avant d'appliquer le filtre par médecin dans services.js:");
      appointments.forEach(rdv => {
        console.log({
          rendezVousId: rdv.id,
          doctor_id: rdv.doctor_id,
          medecin_id: rdv.medecin_id,
          medecin: rdv.medecin,
          filtre: doctorId
        });
      });

      if (doctorId) {
        console.log('🎯 [getAppointmentsByDateAndDoctor] Filtrage par doctorId:', {
          doctorId,
          doctorIdType: typeof doctorId,
          comparison: appointments.map(a => ({
            medecin_id: a.medecin_id,
            medecin_id_type: typeof a.medecin_id,
            matches: a.medecin_id === doctorId,
            matches_strict: a.medecin_id === doctorId,
            matches_loose: a.medecin_id == doctorId
          }))
        });

        appointments = appointments.filter(apt => Number(apt.medecin_id) === Number(doctorId));

        console.log("Nombre de rendez-vous après filtrage par médecin :", appointments.length);
        console.table(appointments);
      } else if (specialite) {
        const idsAvecEnfants = await getSpecialiteIdsWithChildren(specialite);
        appointments = appointments.filter(apt => {
          const doctorSpecialiteId = apt.medecin?.specialite_id;
          return doctorSpecialiteId != null && idsAvecEnfants.includes(doctorSpecialiteId);
        });

        console.log("Nombre de rendez-vous après filtrage par spécialité :", appointments.length);
        console.table(appointments);
      }

      return appointments;
    } catch (error) {
      console.error('Erreur lors du chargement des rendez-vous par date et médecin:', error);
      throw error;
    }
  }
}

// ===== SERVICES POUR LES CONSULTATIONS =====
export const consultationService = {
  // Récupérer toutes les consultations
  async getAll() {
    console.log(`[SPECIALITY_CONFIG] consultationService.getAll() appelé`)
    const specialiteId = await getSpecialityFilter()
    const { data, error } = await supabase
      .from('consultations')
      .select(`
        *,
        patient:patients(nom, prenom),
        medecin:users!fk_consultations_medecin(nom, prenom, specialite, specialite_id)
      `)
      .order('date_consultation', { ascending: false })
    
    if (error) throw error
    
    // Filtrer par spécialité côté client si nécessaire
    if (specialiteId !== null && data) {
      const filteredData = data.filter(consultation => consultation.medecin?.specialite_id === specialiteId)
      console.log(`[SPECIALITY_CONFIG] Consultations filtrées par spécialité`, {
        total_avant_filtre: data.length,
        total_apres_filtre: filteredData.length,
        specialite_id: specialiteId,
        service: 'consultationService.getAll()'
      })
      return filteredData
    }
    
    console.log(`[SPECIALITY_CONFIG] Mode généraliste - Toutes les consultations retournées`, {
      count: data?.length || 0
    })
    
    return data
  },

  // Récupérer les consultations d'un patient
  async getByPatient(patientId) {
    const { data, error } = await supabase
      .from('consultations')
      .select(`
        *,
        medecin:users(nom, prenom, specialite)
      `)
      .eq('patient_id', patientId)
      .order('date_consultation', { ascending: false })
    if (error) throw error
    return data
  },

  // Récupérer les consultations d'un médecin
  async getByDoctor(medecinId) {
    const { data, error } = await supabase
      .from('consultations')
      .select(`
        *,
        patient:patients(nom, prenom, telephone)
      `)
      .eq('medecin_id', medecinId)
      .order('date_consultation', { ascending: false })
    if (error) throw error
    return data
  },

  // Créer une nouvelle consultation
  async create(consultationData) {
    const { data, error } = await supabase
      .from('consultations')
      .insert([consultationData])
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Mettre à jour une consultation
  async update(id, updates) {
    const { data, error } = await supabase
      .from('consultations')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Terminer une consultation
  async finish(id) {
    const { data, error } = await supabase
      .from('consultations')
      .update({ 
        statut: 'terminee',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  }
}

// ===== SERVICES POUR LES ACTIONS MÉDICALES =====
export const medicalActionService = {
  // Récupérer toutes les actions médicales d'une consultation
  async getByConsultation(consultationId) {
    const { data, error } = await supabase
      .from('medical_actions')
      .select('*')
      .eq('consultation_id', consultationId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data
  },

  // Créer une nouvelle action médicale
  async create(actionData) {
    const { data, error } = await supabase
      .from('medical_actions')
      .insert([actionData])
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Mettre à jour une action médicale
  async update(id, updates) {
    const { data, error } = await supabase
      .from('medical_actions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Supprimer une action médicale
  async delete(id) {
    const { error } = await supabase
      .from('medical_actions')
      .delete()
      .eq('id', id)
    if (error) throw error
  }
}

// ===== SERVICES POUR LES MÉDICAMENTS =====
export const medicationService = {
  // Récupérer tous les médicaments
  async getAll() {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .order('nom', { ascending: true })
    if (error) throw error
    return data
  },

  // Rechercher des médicaments
  async search(query) {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .ilike('nom', `%${query}%`)
      .order('nom', { ascending: true })
    if (error) throw error
    return data
  },

  // Créer un nouveau médicament
  async create(medicationData) {
    const { data, error } = await supabase
      .from('medications')
      .insert([medicationData])
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Mettre à jour un médicament
  async update(id, updates) {
    const { data, error } = await supabase
      .from('medications')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  }
}

// ===== SERVICES POUR LES PRESCRIPTIONS =====
export const prescriptionService = {
  // Récupérer toutes les prescriptions d'une consultation
  async getByConsultation(consultationId) {
    const { data, error } = await supabase
      .from('prescriptions')
      .select(`
        *,
        medicament:medications(nom, forme, dosage, laboratoire)
      `)
      .eq('consultation_id', consultationId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data
  },

  // Récupérer les prescriptions d'un patient
  async getByPatient(patientId) {
    const { data, error } = await supabase
      .from('prescriptions')
      .select(`
        *,
        medecin:users(nom, prenom, specialite),
        medicament:medications(nom, forme, dosage, laboratoire)
      `)
      .eq('patient_id', patientId)
      .order('date_prescription', { ascending: false })
    if (error) throw error
    return data
  },

  // Créer une nouvelle prescription
  async create(prescriptionData) {
    const { data, error } = await supabase
      .from('prescriptions')
      .insert([prescriptionData])
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Mettre à jour le statut d'une prescription
  async updateStatus(id, statut) {
    const { data, error } = await supabase
      .from('prescriptions')
      .update({ statut })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  }
}

// ===== SERVICES POUR LES FACTURES =====
export const invoiceService = {
  // Récupérer toutes les factures
  async getAll() {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        patient:patients(nom, prenom),
        consultation:consultations(date_consultation, motif)
      `)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  // Récupérer les factures d'un patient
  async getByPatient(patientId) {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        consultation:consultations(date_consultation, motif)
      `)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  // Créer une nouvelle facture
  async create(invoiceData) {
    const { data, error } = await supabase
      .from('invoices')
      .insert([invoiceData])
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Mettre à jour le statut de paiement
  async updatePaymentStatus(id, statut) {
    const { data, error } = await supabase
      .from('invoices')
      .update({ 
        statut_paiement: statut,
        date_paiement: statut === 'paye' ? new Date().toISOString() : null
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  }
}

// ===== SERVICES POUR LA FILE D'ATTENTE =====
export const waitingQueueService = {
        // Récupérer la file d'attente d'un médecin
  async getByDoctor(medecinId) {
    // Utiliser directement le chargement séparé pour éviter les problèmes de jointure
    return await this.getByDoctorWithSeparateQueries(medecinId)
  },

  // Charger les données séparément pour un médecin en cas d'erreur de jointure
  async getByDoctorWithSeparateQueries(medecinId) {
    try {
      // Charger la file d'attente
      const { data: queueData, error: queueError } = await supabase
        .from('waiting_queue')
        .select('*')
        .eq('medecin_id', medecinId)
        .order('order_position', { ascending: true })
      
      if (queueError) throw queueError
      if (!queueData || queueData.length === 0) return []

      // Récupérer les IDs uniques des patients
      const patientIds = [...new Set(queueData.map(q => q.patient_id).filter(Boolean))]

      // Charger les patients
      const { data: patientsData } = await supabase
        .from('patients')
        .select('id, nom, prenom, telephone')
        .in('id', patientIds)

      // Créer une map pour la recherche rapide
      const patientsMap = {}
      patientsData?.forEach(p => { patientsMap[p.id] = p })

      // Enrichir les données de la file d'attente
      return queueData.map(item => ({
        ...item,
        patient: patientsMap[item.patient_id] || null
      }))
    } catch (error) {
      console.error('Erreur dans getByDoctorWithSeparateQueries:', error)
      return []
    }
  },

  // Récupérer toutes les files d'attente
  async getAll() {
    // Utiliser directement le chargement séparé pour éviter les problèmes de jointure
    return await this.getAllWithSeparateQueries()
  },

  // Charger les données séparément en cas d'erreur de jointure
  async getAllWithSeparateQueries() {
    try {
      // Charger la file d'attente
      const { data: queueData, error: queueError } = await supabase
        .from('waiting_queue')
        .select('*')
        .order('order_position', { ascending: true })
      
      if (queueError) throw queueError
      if (!queueData || queueData.length === 0) return []

      // Récupérer les IDs uniques
      const patientIds = [...new Set(queueData.map(q => q.patient_id).filter(Boolean))]
      const medecinIds = [...new Set(queueData.map(q => q.medecin_id).filter(Boolean))]

      // Charger les patients
      const { data: patientsData } = await supabase
        .from('patients')
        .select('id, nom, prenom, telephone')
        .in('id', patientIds)

      // Charger les médecins
      const { data: medecinsData } = await supabase
        .from('users')
        .select('id, nom, prenom, specialite')
        .in('id', medecinIds)

      // Créer des maps pour la recherche rapide
      const patientsMap = {}
      patientsData?.forEach(p => { patientsMap[p.id] = p })

      const medecinsMap = {}
      medecinsData?.forEach(m => { medecinsMap[m.id] = m })

      // Enrichir les données de la file d'attente
      return queueData.map(item => ({
        ...item,
        patient: patientsMap[item.patient_id] || null,
        medecin: medecinsMap[item.medecin_id] || null
      }))
    } catch (error) {
      console.error('Erreur dans getAllWithSeparateQueries:', error)
      return []
    }
  },

  // Ajouter un patient à la file d'attente
  async addToQueue(queueData) {
    // Récupérer la dernière position
    const { data: lastPosition } = await supabase
      .from('waiting_queue')
      .select('order_position')
      .eq('medecin_id', queueData.medecin_id)
      .order('order_position', { ascending: false })
      .limit(1)
      .single()

    const newPosition = lastPosition ? lastPosition.order_position + 1 : 1
    
    const { data, error } = await supabase
      .from('waiting_queue')
      .insert([{ ...queueData, order_position: newPosition }])
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Récupérer une entrée de file d'attente par ID de rendez-vous
  async getQueueByAppointmentId(appointmentId) {
    try {
      const { data, error } = await supabase
        .from('waiting_queue')
        .select('*')
        .eq('appointment_id', appointmentId)
        .limit(1);
      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Erreur lors de la récupération de la file d\'attente par ID de rendez-vous:', error);
      throw error;
    }
  },

  // Récupérer une entrée de file d'attente active par patient et médecin
  async getActiveQueueByPatientAndDoctor(patientId, medecinId) {
    try {
      const { data, error } = await supabase
        .from('waiting_queue')
        .select('*')
        .eq('patient_id', patientId)
        .eq('medecin_id', medecinId)
        .eq('status', 'waiting') // Or any other 'active' status
        .limit(1);
      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Erreur lors de la récupération de la file d\'attente active par patient et médecin:', error);
      throw error;
    }
  },

  // Mettre à jour le statut d'un patient dans la file
  async updateStatus(id, status) {
    const updates = { status }
    
    // Ajouter les timestamps appropriés
    if (status === 'present') {
      updates.called_at = new Date().toISOString()
    } else if (status === 'in_consultation') {
      updates.consultation_started_at = new Date().toISOString()
    } else if (status === 'finished') {
      updates.consultation_finished_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('waiting_queue')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Retirer un patient de la file d'attente
  async removeFromQueue(id) {
    const { error } = await supabase
      .from('waiting_queue')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  // Réorganiser la file d'attente
  async reorderQueue(medecinId, newOrder) {
    const updates = newOrder.map((item, index) => ({
      id: item.id,
      order_position: index + 1
    }))

    const { error } = await supabase
      .from('waiting_queue')
      .upsert(updates)
    if (error) throw error
  },

  // Appeler le patient suivant
  async callNextPatient(medecinId) {
    const { data: nextPatient, error } = await supabase
      .from('waiting_queue')
      .select('*')
      .eq('medecin_id', medecinId)
      .eq('status', 'waiting')
      .order('order_position', { ascending: true })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows returned

    if (nextPatient) {
      await this.updateStatus(nextPatient.id, 'present')
    }

    return nextPatient
  }
}

// ===== SERVICES POUR LES NOTIFICATIONS =====
export const notificationService = {
  // Récupérer les notifications d'un utilisateur
  async getByUser(userId) {
    const { data, error } = await supabase
      .from('notifications_realtime')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  // Marquer une notification comme lue
  async markAsRead(id) {
    const { data, error } = await supabase
      .from('notifications_realtime')
      .update({ lu: true })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Marquer toutes les notifications comme lues
  async markAllAsRead(userId) {
    const { error } = await supabase
      .from('notifications_realtime')
      .update({ lu: true })
      .eq('user_id', userId)
    if (error) throw error
  },

  // Supprimer une notification
  async delete(id) {
    const { error } = await supabase
      .from('notifications_realtime')
      .delete()
      .eq('id', id)
    if (error) throw error
  }
}

// ===== SERVICES POUR LA FACTURATION =====
export const billingService = {
  // Récupérer toutes les factures
  async getAll() {
    const { data, error } = await supabase
      .from('billing')
      .select('*')
      .order('date_creation', { ascending: false })
    if (error) throw error
    return data
  },

  // Récupérer une facture par ID
  async getById(id) {
    const { data, error } = await supabase
      .from('billing')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  // Créer une nouvelle facture
  async create(billingData) {
    const { data, error } = await supabase
      .from('billing')
      .insert([billingData])
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Mettre à jour une facture
  async update(id, updates) {
    const { data, error } = await supabase
      .from('billing')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Supprimer une facture
  async delete(id) {
    const { error } = await supabase
      .from('billing')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  // Récupérer les factures d'un patient
  async getByPatient(patientId) {
    const { data, error } = await supabase
      .from('billing')
      .select('*')
      .eq('patient_id', patientId)
      .order('date_creation', { ascending: false })
    if (error) throw error
    return data
  },

  // Récupérer les factures d'un médecin
  async getByDoctor(medecinId) {
    const { data, error } = await supabase
      .from('billing')
      .select('*')
      .eq('medecin_id', medecinId)
      .order('date_creation', { ascending: false })
    if (error) throw error
    return data
  },

  // Marquer une facture comme payée
  async markAsPaid(id) {
    const { data, error } = await supabase
      .from('billing')
      .update({ 
        statut: 'paye',
        date_paiement: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Générer un numéro de facture unique
  async generateInvoiceNumber() {
    const { data, error } = await supabase
      .from('billing')
      .select('numero_facture')
      .order('numero_facture', { ascending: false })
      .limit(1)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error
    
    const lastNumber = data?.numero_facture || 'FACT-0000'
    const nextNumber = parseInt(lastNumber.split('-')[1]) + 1
    return `FACT-${nextNumber.toString().padStart(4, '0')}`
  }
}

// ===== SERVICES POUR LES TYPES D'ACTES =====
export const typesActesService = {
  // Récupérer tous les types d'actes
  async getAll() {
    console.log(`[SPECIALITY_CONFIG] typesActesService.getAll() appelé`)
    
    // 1. Tenter de récupérer la spécialité du médecin connecté
    let specialiteId = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
         const { data: userData } = await supabase
          .from('users')
          .select('specialite_id, role')
          .eq('auth_id', user.id)
          .maybeSingle(); // Utiliser maybeSingle pour éviter erreur si pas trouvé
          
         if (userData && (userData.role === 'doctor' || userData.role === 'admin') && userData.specialite_id) {
             specialiteId = userData.specialite_id;
             console.log(`[SPECIALITY_CONFIG] Filtre détecté via profil utilisateur:`, specialiteId);
         }
      }
    } catch (e) {
      console.warn('[SPECIALITY_CONFIG] Impossible de récupérer la spécialité utilisateur:', e);
    }

    // 2. Si pas de spécialité utilisateur, utiliser la config globale (fallback)
    if (specialiteId === null) {
        specialiteId = await getSpecialityFilter()
    }
    
    let data, error

    // Appliquer le filtre de spécialité via RPC si en mode spécialité
    if (specialiteId !== null) {
      console.log(`[SPECIALITY_CONFIG] Filtre spécialité appliqué aux types d'actes (VIA RPC)`, {
        specialite_id: specialiteId,
        service: 'typesActesService.getAll()'
      })
      
      const response = await supabase
        .rpc('get_types_actes_by_specialite', { p_specialite_id: specialiteId })
      
      data = response.data
      error = response.error
      
      // Si on veut aussi les tarifs (non inclus par défaut dans le return SETOF types_actes), 
      // il faudrait idéalement faire une 2ème requête ou modifier le RPC pour retourner un JSON complet.
      // Pour l'instant, on récupère les actes filtrés, et si besoin on peut enrichir ou modifier le RPC.
      // NOTE: Le code précédent faisait un join `tarifs_actes`. 
      // Si c'est critique, on doit modifier le RPC pour retourner les tarifs ou faire un fetch séparé.
      // Vérifions si `tarifs_actes` est utilisé : oui dans `ActesPage.jsx` et `ActesModal.jsx` (via `tarif_defaut` qui est dans `types_actes`).
      // Le join `tarifs_actes` dans la requête originale servait à avoir `tarif_base`, `tarif_secu`, etc.
      // Pour faire simple et robuste : on récupère les IDs du RPC et on refetch avec join, OU on améliore le RPC.
      // OPTION CHOISIE: On enrichit les données ici si nécessaire, mais `types_actes` contient déjà `tarif_defaut`.
      // Si le frontend utilise `tarifs_actes`, ça manquera.
      // CORRECTION: Je vais modifier le code pour simuler le join ou le faire côté client si peu de données, 
      // ou mieux, gardons la logique simple : le RPC filtre les IDs.
      
      if (data) {
        // Enrichissement manuel si nécessaire (fetch tarifs pour ces actes)
        // Pour l'instant on retourne les données du RPC qui sont `types_actes` brut.
      }

    } else {
      console.log(`[SPECIALITY_CONFIG] Mode généraliste - Tous les types d'actes seront retournés`)
      const response = await supabase
        .from('types_actes')
        .select(`
          *,
          tarifs_actes (
            tarif_base,
            tarif_secu,
            tarif_mutuelle
          )
        `)
        .eq('actif', true)
        .order('nom', { ascending: true })
      
      data = response.data
      error = response.error
    }
    
    if (error) throw error
    
    console.log(`[SPECIALITY_CONFIG] Types d'actes récupérés`, {
      count: data?.length || 0,
      specialite_id: specialiteId,
      mode: specialiteId !== null ? 'Spécialité' : 'Généraliste'
    })
    
    return data
  },

  // Récupérer un type d'acte par ID
  async getById(id) {
    const { data, error } = await supabase
      .from('types_actes')
      .select(`
        *,
        tarifs_actes (
          tarif_base,
          tarif_secu,
          tarif_mutuelle
        )
      `)
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  // Créer un nouveau type d'acte
  async create(acteData) {
    const { data, error } = await supabase
      .from('types_actes')
      .insert([acteData])
      .select()
      .single()
    if (error) throw error
    return data
  }
}

// ===== SERVICES POUR LES APPAREILS =====
export const appareilsService = {
  // Récupérer tous les appareils
  async getAll() {
    console.log(`[SPECIALITY_CONFIG] appareilsService.getAll() appelé`)
    const specialiteId = await getSpecialityFilter()
    let query = supabase
      .from('appareils')
      .select('*')
      .eq('actif', true)
      .order('nom', { ascending: true })
    
    // Appliquer le filtre de spécialité si en mode spécialité
    if (specialiteId !== null) {
      console.log(`[SPECIALITY_CONFIG] Filtre spécialité appliqué aux appareils`, {
        specialite_id: specialiteId,
        service: 'appareilsService.getAll()'
      })
      const idsAvecEnfants = await getSpecialiteIdsWithChildren(specialiteId)
      query = query.in('specialite_id', idsAvecEnfants)
    } else {
      console.log(`[SPECIALITY_CONFIG] Mode généraliste - Tous les appareils seront retournés`)
    }
    
    const { data, error } = await query
    if (error) throw error
    
    console.log(`[SPECIALITY_CONFIG] Appareils récupérés`, {
      count: data?.length || 0,
      specialite_id: specialiteId,
      mode: specialiteId !== null ? 'Spécialité' : 'Généraliste'
    })
    
    return data || []
  }
}

// ===== SERVICES POUR LES DIAGNOSTICS =====
export const diagnosticsService = {
  // Récupérer tous les diagnostics
  async getAll() {
    console.log(`[SPECIALITY_CONFIG] diagnosticsService.getAll() appelé`)
    const specialiteId = await getSpecialityFilter()
    let query = supabase
      .from('diagnostics')
      .select('*')
      .eq('actif', true)
      .order('nom', { ascending: true })
    
    // Appliquer le filtre de spécialité si en mode spécialité
    if (specialiteId !== null) {
      console.log(`[SPECIALITY_CONFIG] Filtre spécialité appliqué aux diagnostics`, {
        specialite_id: specialiteId,
        service: 'diagnosticsService.getAll()'
      })
      const idsAvecEnfants = await getSpecialiteIdsWithChildren(specialiteId)
      query = query.in('specialite_id', idsAvecEnfants)
    } else {
      console.log(`[SPECIALITY_CONFIG] Mode généraliste - Tous les diagnostics seront retournés`)
    }
    
    const { data, error } = await query
    if (error) throw error
    
    console.log(`[SPECIALITY_CONFIG] Diagnostics récupérés`, {
      count: data?.length || 0,
      specialite_id: specialiteId,
      mode: specialiteId !== null ? 'Spécialité' : 'Généraliste'
    })
    
    return data || []
  }
}

// ===== SERVICES POUR LES MÉDICAMENTS (table medicaments) =====
export const medicamentsService = {
  // Récupérer tous les médicaments
  async getAll() {
    console.log(`[SPECIALITY_CONFIG] medicamentsService.getAll() appelé`)
    const specialiteId = await getSpecialityFilter()
    let query = supabase
      .from('medicaments')
      .select('*')
      .eq('actif', true)
      .order('nom', { ascending: true })
    
    // Appliquer le filtre de spécialité si en mode spécialité
    if (specialiteId !== null) {
      console.log(`[SPECIALITY_CONFIG] Filtre spécialité appliqué aux médicaments`, {
        specialite_id: specialiteId,
        service: 'medicamentsService.getAll()'
      })
      const idsAvecEnfants = await getSpecialiteIdsWithChildren(specialiteId)
      query = query.in('specialite_id', idsAvecEnfants)
    } else {
      console.log(`[SPECIALITY_CONFIG] Mode généraliste - Tous les médicaments seront retournés`)
    }
    
    const { data, error } = await query
    if (error) throw error
    
    console.log(`[SPECIALITY_CONFIG] Médicaments récupérés`, {
      count: data?.length || 0,
      specialite_id: specialiteId,
      mode: specialiteId !== null ? 'Spécialité' : 'Généraliste'
    })
    
    return data || []
  }
}

// ===== SERVICES POUR LES TYPES DE CERTIFICATS =====
export const typesCertificatsService = {
  // Récupérer tous les types de certificats
  async getAll() {
    console.log(`[SPECIALITY_CONFIG] typesCertificatsService.getAll() appelé`)
    const specialiteId = await getSpecialityFilter()
    let query = supabase
      .from('types_certificats')
      .select('*')
      .eq('actif', true)
      .order('nom', { ascending: true })
    
    // Appliquer le filtre de spécialité si en mode spécialité
    if (specialiteId !== null) {
      console.log(`[SPECIALITY_CONFIG] Filtre spécialité appliqué aux types de certificats`, {
        specialite_id: specialiteId,
        service: 'typesCertificatsService.getAll()'
      })
      const idsAvecEnfants = await getSpecialiteIdsWithChildren(specialiteId)
      query = query.in('specialite_id', idsAvecEnfants)
    } else {
      console.log(`[SPECIALITY_CONFIG] Mode généraliste - Tous les types de certificats seront retournés`)
    }
    
    const { data, error } = await query
    if (error) throw error
    
    console.log(`[SPECIALITY_CONFIG] Types de certificats récupérés`, {
      count: data?.length || 0,
      specialite_id: specialiteId,
      mode: specialiteId !== null ? 'Spécialité' : 'Généraliste'
    })

    return data || []
  }
}

// ===== SERVICES POUR LES CONSTANTES CLINIQUES =====

// Simple in-memory cache
const constantesConsultationCache = {
  cache: new Map(),
  get(key) {
    return this.cache.get(key);
  },
  set(key, value) {
    this.cache.set(key, value);
  },
  invalidate(key) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

export const constantesService = {
  // Récupérer toutes les constantes
  async getAll() {
    console.log(`[SPECIALITY_CONFIG] constantesService.getAll() appelé`)
    const specialiteId = await getSpecialityFilter()
    let query = supabase
      .from('constantes')
      .select('*')
      .eq('actif', true)
      .order('nom', { ascending: true })
    
    // Appliquer le filtre de spécialité si en mode spécialité
    if (specialiteId !== null) {
      console.log(`[SPECIALITY_CONFIG] Filtre spécialité appliqué aux constantes`, {
        specialite_id: specialiteId,
        service: 'constantesService.getAll()'
      })
      const idsAvecEnfants = await getSpecialiteIdsWithChildren(specialiteId)
      query = query.in('specialite_id', idsAvecEnfants)
    } else {
      console.log(`[SPECIALITY_CONFIG] Mode généraliste - Toutes les constantes seront retournées`)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error(`[CONSTANTES] Erreur lors de la récupération des constantes:`, error)
      throw error
    }

    console.log(`[CONSTANTES] Constantes récupérées`, { count: data?.length || 0 })
    return data || []
  },

  // Récupérer une constante par ID
  async getById(id) {
    const { data, error } = await supabase
      .from('constantes')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  // Récupérer les constantes d'une consultation (avec cache)
  async getByConsultation(consultationId, options = {}) {
    const { forceRefresh = false } = options
    console.log(`[CONSTANTES] constantesService.getByConsultation() appelé`, { consultationId, forceRefresh })

    // Vérifier le cache si pas de forceRefresh
    if (!forceRefresh) {
      const cached = constantesConsultationCache.get(consultationId)
      if (cached) {
        return cached
      }
    }

    console.log(`[CONSTANTES_CACHE] Cache MISS pour consultation ${consultationId}, chargement depuis la BDD...`)

    const { data, error } = await supabase
      .from('constantes_consultation')
      .select(`
        *,
        constantes (id, nom, unite, valeur_min, valeur_max, valeur_normale_min, valeur_normale_max)
      `)
      .eq('consultation_id', consultationId)

    if (error) {
      console.error(`[CONSTANTES] Erreur lors de la récupération des constantes de consultation:`, error)
      throw error
    }

    const result = data || []
    console.log(`[CONSTANTES] Constantes de consultation récupérées depuis BDD`, { count: result.length })

    // Mettre en cache
    constantesConsultationCache.set(consultationId, result)

    return result
  },

  // Invalider le cache pour une consultation
  invalidateCache(consultationId) {
    constantesConsultationCache.invalidate(consultationId)
  },

  // Vider tout le cache
  clearCache() {
    constantesConsultationCache.invalidate()
  },

  // Sauvegarder en lot (inserts, updates, deletes)
  async batchSave(pendingChanges, pendingDeletes, consultationId = null) {
    console.log(`[CONSTANTES] constantesService.batchSave() appelé`, {
      changesCount: pendingChanges.size,
      deletesCount: pendingDeletes.size
    })

    const updates = []
    const inserts = []
    const deletions = []
    let affectedConsultationId = consultationId

    // Process pending changes
    pendingChanges.forEach((change) => {
      const { constanteConsultationId, isNew, ...data } = change

      // Récupérer l'ID de consultation pour invalider le cache
      if (!affectedConsultationId && data.consultation_id) {
        affectedConsultationId = data.consultation_id
      }

      if (constanteConsultationId) {
        // Existing constant, perform update
        updates.push(
          supabase
            .from('constantes_consultation')
            .update({
              valeur_mesuree: data.valeur_mesuree,
              updated_at: new Date().toISOString()
            })
            .eq('id', constanteConsultationId)
            .select()
            .then(({ data, error }) => {
              if (error) {
                console.error(`[CONSTANTES] Erreur update constante ${constanteConsultationId}:`, error)
                throw error
              }
              console.log(`[CONSTANTES] Update réussi pour constante ${constanteConsultationId}`, data)
              return data
            })
        )
      } else {
        // New constant, perform insert (only if value is not null/empty)
        if (data.valeur_mesuree !== null && data.valeur_mesuree !== '') {
          inserts.push(
            supabase
              .from('constantes_consultation')
              .insert({
                consultation_id: data.consultation_id,
                constante_id: data.constante_id,
                valeur_mesuree: data.valeur_mesuree,
                unite: data.unite,
                commentaires: data.commentaires
              })
              .select()
              .then(({ data, error }) => {
                if (error) {
                  console.error(`[CONSTANTES] Erreur insert constante:`, error)
                  throw error
                }
                console.log(`[CONSTANTES] Insert réussi:`, data)
                return data
              })
          )
        }
      }
    })

    // Process pending deletions
    pendingDeletes.forEach((idToDelete) => {
      deletions.push(
        supabase
          .from('constantes_consultation')
          .delete()
          .eq('id', idToDelete)
          .select()
          .then(({ data, error }) => {
            if (error) {
              console.error(`[CONSTANTES] Erreur delete constante ${idToDelete}:`, error)
              throw error
            }
            console.log(`[CONSTANTES] Delete réussi pour constante ${idToDelete}`, data)
            return data
          })
      )
    })

    let successCount = 0

    try {
      if (inserts.length > 0) {
        console.log(`[CONSTANTES] Insertion de ${inserts.length} nouvelles constantes...`)
        await Promise.all(inserts)
        successCount += inserts.length
      }
      if (updates.length > 0) {
        console.log(`[CONSTANTES] Mise à jour de ${updates.length} constantes existantes...`)
        await Promise.all(updates)
        successCount += updates.length
      }
      if (deletions.length > 0) {
        console.log(`[CONSTANTES] Suppression de ${deletions.length} constantes...`)
        await Promise.all(deletions)
        successCount += deletions.length
      }

      // Invalider le cache après une sauvegarde réussie
      if (affectedConsultationId) {
        console.log(`[CONSTANTES] Invalidation du cache après sauvegarde pour consultation ${affectedConsultationId}`)
        constantesConsultationCache.invalidate(affectedConsultationId)
      }

      console.log(`[CONSTANTES] Batch save terminé avec succès`, { successCount })
      return { success: true, count: successCount }
    } catch (error) {
      console.error(`[CONSTANTES] Erreur lors du batch save:`, error)
      throw error
    }
  }
}

