-- consultations.niveau_urgence existait déjà en base (ajouté par un script ad
-- hoc non suivi dans supabase/migrations/, cf. CLAUDE.md). Cette migration
-- rend son existence officielle et versionnée, de façon idempotente : elle
-- ne modifie rien si la colonne/contrainte est déjà en place.
alter table public.consultations
  add column if not exists niveau_urgence character varying default 'normale'::character varying;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'consultations_niveau_urgence_check'
  ) then
    alter table public.consultations
      add constraint consultations_niveau_urgence_check
      check (niveau_urgence::text = any (array['normale','urgente','tres_urgente']::text[]));
  end if;
end $$;

comment on column public.consultations.niveau_urgence is
  'Niveau de priorite de la consultation (normale/urgente/tres_urgente), copie depuis waiting_queue.priority / appointments.priorite au moment de la creation de la consultation. Sert a ventiler les consultations terminees par urgence (tableaux de bord, analyses futures).';
