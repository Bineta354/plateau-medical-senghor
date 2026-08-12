import { supabase } from '../lib/supabase';

/**
 * Service pour gérer l'inactivité des patients
 * Permet de marquer automatiquement les patients inactifs après N jours sans activité
 * 
 * IMPORTANT : Deux niveaux de statut patient existent :
 * 1. Statut DOSSIER (long terme) : 'actif' ou 'inactif' - géré par ce service
 *    - Stocké dans patients.statut_patient
 *    - Change automatiquement après N jours d'inactivité
 *    - Réactivé automatiquement lors d'un nouveau RDV ou consultation
 * 
 * 2. Statut VISITE (court terme) : 'waiting', 'called', 'in_consultation', etc.
 *    - Stocké dans waiting_queue.status
 *    - Change en temps réel lors de la gestion de la file d'attente
 *    - Indique la position actuelle du patient dans le flux de consultation
 */
const PatientInactivityService = {
  
  /**
   * Récupérer le paramètre jours_inactivité pour un cabinet
   * @param {number} cabinetId - ID du cabinet
   * @returns {Promise<number>} Nombre de jours d'inactivité
   */
  async getInactivityDays(cabinetId) {
    try {
      const { data, error } = await supabase
        .from('parametres_cabinet')
        .select('jours_inactivite')
        .eq('id', cabinetId)
        .single();

      if (error) throw error;
      
      return data?.jours_inactivite || 365; // Valeur par défaut: 365 jours
    } catch (error) {
      console.error('Erreur récupération jours_inactivite:', error);
      return 365; // Valeur par défaut en cas d'erreur
    }
  },

  /**
   * Mettre à jour le paramètre jours_inactivité pour un cabinet
   * @param {number} cabinetId - ID du cabinet
   * @param {number} days - Nombre de jours
   * @returns {Promise<boolean>} Succès de la mise à jour
   */
  async updateInactivityDays(cabinetId, days) {
    try {
      const { error } = await supabase
        .from('parametres_cabinet')
        .update({ jours_inactivite: days })
        .eq('id', cabinetId);

      if (error) throw error;
      
      console.log(`✅ Paramètre jours_inactivite mis à jour: ${days} jours pour cabinet ${cabinetId}`);
      return true;
    } catch (error) {
      console.error('Erreur mise à jour jours_inactivite:', error);
      return false;
    }
  },

  /**
   * Marquer les patients inactifs manuellement
   * @param {number} cabinetId - ID du cabinet (optionnel)
   * @returns {Promise<number>} Nombre de patients marqués inactifs
   */
  async markInactivePatients(cabinetId = null) {
    try {
      const { data, error } = await supabase.rpc('mark_inactive_patients', {
        cabinet_id_param: cabinetId
      });

      if (error) throw error;
      
      console.log(`✅ ${data} patients marqués comme inactifs`);
      return data;
    } catch (error) {
      console.error('Erreur marquage patients inactifs:', error);
      return 0;
    }
  },

  /**
   * Réactiver un patient manuellement
   * @param {number} patientId - ID du patient
   * @returns {Promise<boolean>} Succès de la réactivation
   */
  async reactivatePatient(patientId) {
    try {
      const { error } = await supabase
        .from('patients')
        .update({ 
          statut_patient: 'actif',
          derniere_activite: new Date().toISOString()
        })
        .eq('id', patientId);

      if (error) throw error;
      
      console.log(`✅ Patient ${patientId} réactivé`);
      return true;
    } catch (error) {
      console.error('Erreur réactivation patient:', error);
      return false;
    }
  },

  /**
   * Mettre à jour l'activité d'un patient (appelé automatiquement par triggers)
   * @param {number} patientId - ID du patient
   * @returns {Promise<boolean>} Succès de la mise à jour
   */
  async updatePatientActivity(patientId) {
    try {
      const { error } = await supabase.rpc('update_patient_activity', {
        patient_id: patientId
      });

      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Erreur mise à jour activité patient:', error);
      return false;
    }
  },

  /**
   * Récupérer les statistiques d'activité des patients
   * @param {number} cabinetId - ID du cabinet
   * @returns {Promise<Object>} Statistiques
   */
  async getActivityStats(cabinetId) {
    try {
      const { data: activePatients, error: activeError } = await supabase
        .from('patients')
        .select('id', { count: 'exact' })
        .eq('statut_patient', 'actif');

      const { data: inactivePatients, error: inactiveError } = await supabase
        .from('patients')
        .select('id', { count: 'exact' })
        .eq('statut_patient', 'inactif');

      if (activeError || inactiveError) throw activeError || inactiveError;

      const joursInactivite = await this.getInactivityDays(cabinetId);

      return {
        actifs: activePatients?.length || 0,
        inactifs: inactivePatients?.length || 0,
        total: (activePatients?.length || 0) + (inactivePatients?.length || 0),
        joursInactivite: joursInactivite
      };
    } catch (error) {
      console.error('Erreur récupération statistiques:', error);
      return {
        actifs: 0,
        inactifs: 0,
        total: 0,
        joursInactivite: 365
      };
    }
  },

  /**
   * Récupérer les patients inactifs (avec pagination)
   * @param {number} cabinetId - ID du cabinet
   * @param {number} page - Page courante
   * @param {number} limit - Nombre par page
   * @returns {Promise<Object>} Patients inactifs
   */
  async getInactivePatients(cabinetId, page = 1, limit = 20) {
    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, error, count } = await supabase
        .from('patients')
        .select('*', { count: 'exact' })
        .eq('statut_patient', 'inactif')
        .order('derniere_activite', { ascending: false, nullsFirst: false })
        .range(from, to);

      if (error) throw error;

      return {
        patients: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      console.error('Erreur récupération patients inactifs:', error);
      return {
        patients: [],
        total: 0,
        page,
        limit,
        totalPages: 0
      };
    }
  },

  /**
   * Exécuter le job planifié de marquage des inactifs
   * Cette fonction est appelée par le cron job quotidien
   * @returns {Promise<Object>} Résultat du job
   */
  async runDailyInactivityJob() {
    console.log('🔄 [InactivityJob] Démarrage du job quotidien de marquage des inactifs...');
    
    try {
      // Récupérer tous les cabinets
      const { data: cabinets, error: cabinetsError } = await supabase
        .from('parametres_cabinet')
        .select('id, nom_cabinet, jours_inactivite');

      if (cabinetsError) throw cabinetsError;

      let totalMarkedInactive = 0;
      const results = [];

      // Pour chaque cabinet, marquer les patients inactifs
      for (const cabinet of cabinets || []) {
        console.log(`🏥 [InactivityJob] Traitement cabinet: ${cabinet.nom_cabinet} (${cabinet.jours_inactivite} jours)`);
        
        const marked = await this.markInactivePatients(cabinet.id);
        totalMarkedInactive += marked;
        
        results.push({
          cabinetId: cabinet.id,
          cabinetName: cabinet.nom_cabinet,
          joursInactivite: cabinet.jours_inactivite,
          patientsInactifs: marked
        });
      }

      console.log(`✅ [InactivityJob] Job terminé: ${totalMarkedInactive} patients marqués inactifs`);
      
      return {
        success: true,
        totalMarkedInactive,
        results,
        executedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ [InactivityJob] Erreur exécution job:', error);
      return {
        success: false,
        error: error.message,
        executedAt: new Date().toISOString()
      };
    }
  }
}

export default PatientInactivityService;
