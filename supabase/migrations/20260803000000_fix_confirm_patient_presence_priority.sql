-- Migration : Corriger secretaire_confirme_patient_presence pour utiliser la priorité du rendez-vous
-- Date: 2026-08-03
-- Description: La RPC insérait toujours priority='normale' dans waiting_queue, ignorant la priorité du rendez-vous.
-- Cette modification récupère appointments.priorite et l'utilise lors de la création/mise à jour de waiting_queue.

DROP FUNCTION IF EXISTS public.secretaire_confirme_patient_presence(bigint, bigint) CASCADE;

CREATE OR REPLACE FUNCTION secretaire_confirme_patient_presence(
    p_appointment_id bigint,
    p_secretaire_id bigint
)
RETURNS jsonb AS $$
DECLARE
    v_patient_id bigint;
    v_medecin_id bigint;
    v_tenant_id uuid;
    v_secretaire_tenant_id uuid;
    v_date_heure timestamp with time zone;
    v_existing_queue_id bigint;
    v_max_order_position bigint;
    v_message text;
    v_current_statut text;
    v_current_statut_arrivee text;
    v_priorite text;
BEGIN
    RAISE NOTICE '🔍 [RPC] secretaire_confirme_patient_presence appelé avec: appointment_id=%, secretaire_id=%', p_appointment_id, p_secretaire_id;

    SELECT patient_id, medecin_id, date_heure, statut, statut_arrivee, tenant_id, priorite
    INTO v_patient_id, v_medecin_id, v_date_heure, v_current_statut, v_current_statut_arrivee, v_tenant_id, v_priorite
    FROM public.appointments
    WHERE id = p_appointment_id;

    RAISE NOTICE '📊 [RPC] Rendez-vous trouvé: patient_id=%, medecin_id=%, tenant_id=%, statut=%, statut_arrivee=%, priorite=%', v_patient_id, v_medecin_id, v_tenant_id, v_current_statut, v_current_statut_arrivee, v_priorite;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rendez-vous non trouvé: %', p_appointment_id;
    END IF;

    SELECT tenant_id INTO v_secretaire_tenant_id
    FROM public.users
    WHERE id = p_secretaire_id;

    RAISE NOTICE '👤 [RPC] Secrétaire trouvée: secretaire_id=%, secretaire_tenant_id=%', p_secretaire_id, v_secretaire_tenant_id;

    IF v_secretaire_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Secrétaire non trouvée: %', p_secretaire_id;
    END IF;

    IF v_tenant_id != v_secretaire_tenant_id THEN
        RAISE EXCEPTION 'La secrétaire n''appartient pas au même cabinet que le rendez-vous: Secrétaire tenant=%, Rendez-vous tenant=%', v_secretaire_tenant_id, v_tenant_id;
    END IF;

    RAISE NOTICE '✅ [RPC] Vérification tenant réussie: tenant_id=%', v_tenant_id;

    IF v_current_statut != 'confirme' THEN
        RAISE EXCEPTION 'Le rendez-vous doit être au statut "confirme" pour confirmer la présence. Statut actuel: %', v_current_statut;
    END IF;

    IF v_current_statut_arrivee = 'arrive' THEN
        RAISE EXCEPTION 'Ce patient a déjà été confirmé présent';
    END IF;

    UPDATE public.appointments
    SET
        statut = 'arrive',
        statut_arrivee = 'arrive',
        heure_arrivee = now()
    WHERE id = p_appointment_id
    AND tenant_id = v_tenant_id;

    RAISE NOTICE '✅ [RPC] Rendez-vous mis à jour: appointment_id=%, statut=arrive', p_appointment_id;

    SELECT id INTO v_existing_queue_id
    FROM public.waiting_queue
    WHERE patient_id = v_patient_id
    AND medecin_id = v_medecin_id
    AND tenant_id = v_tenant_id
    AND status IN ('waiting', 'present', 'in_consultation')
    LIMIT 1;

    RAISE NOTICE '🔍 [RPC] Vérification existing_queue: existing_queue_id=%', v_existing_queue_id;

    IF v_existing_queue_id IS NOT NULL THEN
        UPDATE public.waiting_queue
        SET
            status = 'waiting',
            arrived_at = now(),
            appointment_id = p_appointment_id,
            priority = COALESCE(v_priorite, 'normale')
        WHERE id = v_existing_queue_id
        AND tenant_id = v_tenant_id;

        RAISE NOTICE '🔄 [RPC] File d''attente mise à jour: queue_id=%, priority=%', v_existing_queue_id, COALESCE(v_priorite, 'normale');
        v_message := 'Patient déjà dans la file d''attente, statut mis à jour à "waiting"';
    ELSE
        SELECT COALESCE(MAX(order_position), 0) INTO v_max_order_position
        FROM public.waiting_queue
        WHERE medecin_id = v_medecin_id
        AND tenant_id = v_tenant_id;

        RAISE NOTICE '📊 [RPC] Position maximale: max_order_position=%', v_max_order_position;

        INSERT INTO public.waiting_queue (
            patient_id,
            medecin_id,
            appointment_id,
            order_position,
            status,
            arrived_at,
            priority,
            tenant_id
        )
        VALUES (
            v_patient_id,
            v_medecin_id,
            p_appointment_id,
            v_max_order_position + 1,
            'waiting',
            now(),
            COALESCE(v_priorite, 'normale'),
            v_tenant_id
        );

        RAISE NOTICE '➕ [RPC] Patient ajouté à la file d''attente: patient_id=%, medecin_id=%, tenant_id=%, order_position=%, priority=%', v_patient_id, v_medecin_id, v_tenant_id, v_max_order_position + 1, COALESCE(v_priorite, 'normale');
        v_message := 'Patient confirmé présent et ajouté à la file d''attente';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', v_message,
        'patient_id', v_patient_id,
        'medecin_id', v_medecin_id,
        'appointment_id', p_appointment_id,
        'tenant_id', v_tenant_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION secretaire_confirme_patient_presence(bigint, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION secretaire_confirme_patient_presence(bigint, bigint) TO anon;
