import { supabase } from '../../lib/supabase';

export const getDossierMedical = async (patientId, currentConsultationId) => {
    if (!patientId) {
        console.warn('getDossierMedical: patient_id manquant');
        return;
    }

    try {
        const { data: consultationsData, error: consultationsError } = await supabase
            .from('consultations')
            .select(`
                id,
                date_consultation,
                motif_consultation,
                statut,
                type_consultation,
                medecin:users(nom, prenom, specialite)
            `)
            .eq('patient_id', patientId)
            .neq('id', currentConsultationId)
            .order('date_consultation', { ascending: false })
            .limit(10);
        if(consultationsError) console.error('Erreur consultations:', consultationsError);

        const { data: documentsData, error: documentsError } = await supabase
            .from('documents_patients')
            .select(`
                id,
                nom_fichier,
                type_document,
                description,
                created_at,
                statut_validation,
                url_fichier,
                taille_fichier,
                format_fichier
            `)
            .eq('patient_id', patientId)
            .eq('statut_validation', 'valide')
            .order('created_at', { ascending: false })
            .limit(20);
        if(documentsError) console.error('Erreur documents:', documentsError);
        
        const { data: consultationsIds } = await supabase
            .from('consultations')
            .select('id')
            .eq('patient_id', patientId)
            .neq('id', currentConsultationId);
        
        const consultationIds = consultationsIds?.map(c => c.id) || [];

        let historiqueData = [];
        let historiqueError = null;
        if (consultationIds.length > 0) {
            try {
                const { data: diagData, error: diagError } = await supabase
                    .from('diagnostics_consultation')
                    .select(`
                        id,
                        certitude,
                        commentaires,
                        created_at,
                        diagnostics (nom, description)
                    `)
                    .in('consultation_id', consultationIds)
                    .order('created_at', { ascending: false })
                    .limit(15);
                historiqueData = diagData;
                historiqueError = diagError;
            } catch (err) {
                historiqueError = err;
            }
        }
        if(historiqueError) console.error('Erreur historique:', historiqueError);

        const { data: allergiesData, error: allergiesError } = await supabase
            .from('antecedents_patients')
            .select(`
                id,
                commentaires,
                date_decouverte,
                antecedents (nom, description)
            `)
            .eq('patient_id', patientId)
            .eq('actif', true);
        if(allergiesError) console.error('Erreur allergies:', allergiesError);

        let traitementsData = [];
        let traitementsError = null;
        if (consultationIds.length > 0) {
            try {
                const { data: ordoData, error: ordoError } = await supabase
                    .from('ordonnances')
                    .select(`
                        id,
                        numero_ordonnance,
                        date_prescription,
                        statut,
                        instructions_generales,
                        lignes_ordonnance ( posologie, duree_traitement, medicament:medicaments(nom, dosage) )
                    `)
                    .in('consultation_id', consultationIds)
                    .eq('statut', 'active')
                    .gte('date_prescription', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
                    .order('date_prescription', { ascending: false })
                    .limit(10);
                traitementsData = ordoData;
                traitementsError = ordoError;
            } catch (err) {
                traitementsError = err;
            }
        }
        if(traitementsError) console.error('Erreur traitements:', traitementsError);

        return {
            consultationsPassees: consultationsData || [],
            documentsPatient: documentsData || [],
            historiqueMedical: historiqueData || [],
            allergiesConnues: allergiesData || [],
            traitementsCours: traitementsData || []
        };

    } catch (error) {
        console.error('Erreur générale lors du chargement du dossier médical:', error);
        throw error;
    }
};
