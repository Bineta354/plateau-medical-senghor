-- Migration: Suppression du trigger automatique d'ajout à la file d'attente
-- Ce trigger créait automatiquement une entrée dans waiting_queue lors de la création d'un rendez-vous,
-- ce qui provoquait des comptes prématurés dans la Vue Globale.
-- La fonction RPC secretaire_confirme_patient_presence gère déjà correctement la création/mise à jour
-- de l'entrée dans waiting_queue lors de la confirmation de présence par la secrétaire.

-- ===== DOWN: Recréer le trigger (en cas de rollback) =====
-- CREATE TRIGGER trg_after_insert_appointment_to_queue
-- AFTER INSERT ON public.appointments
-- FOR EACH ROW
-- EXECUTE FUNCTION fn_after_insert_appointment_to_queue();

-- ===== UP: Supprimer le trigger =====
DROP TRIGGER IF EXISTS trg_after_insert_appointment_to_queue ON public.appointments;

-- Commentaire pour documentation
COMMENT ON FUNCTION public.fn_after_insert_appointment_to_queue() IS 
'Fonction qui insère automatiquement une entrée dans waiting_queue lors de la création d''un rendez-vous. 
NOTE: Cette fonction n''est plus utilisée car le trigger associé a été supprimé. 
La création d''entrée dans waiting_queue est maintenant gérée par secretaire_confirme_patient_presence lors de la confirmation de présence.';
