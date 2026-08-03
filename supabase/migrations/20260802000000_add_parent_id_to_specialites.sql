-- Migration: Ajouter parent_id à la table specialites (hiérarchie spécialité / sous-spécialité)
-- Contexte: cette colonne existe déjà en base de production (ajoutée manuellement à un moment
-- donné) mais aucune migration committée ne la crée. Tout le code front (Specialites.jsx,
-- SpecialitesForm.jsx, FormulaireUtilisateur.jsx, useAppointmentForm.js) en dépend fortement.
-- Sans cette migration, un nouvel environnement (recette, autre cabinet, disaster recovery)
-- reparti des migrations committées n'aurait pas cette colonne et la fonctionnalité
-- spécialités/sous-spécialités + filtrage par spécialité des rendez-vous serait cassée.

ALTER TABLE public.specialites
    ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES public.specialites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_specialites_parent_id ON public.specialites(parent_id);
