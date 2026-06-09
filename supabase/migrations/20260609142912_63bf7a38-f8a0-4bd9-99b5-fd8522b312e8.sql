-- Visibility flag for productivity items (per-item private/shared)
DO $$ BEGIN
  CREATE TYPE public.productivity_visibility AS ENUM ('private', 'shared');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.crm_agenda
  ADD COLUMN IF NOT EXISTS visibility public.productivity_visibility NOT NULL DEFAULT 'shared';

ALTER TABLE public.proposal_tasks
  ADD COLUMN IF NOT EXISTS visibility public.productivity_visibility NOT NULL DEFAULT 'shared';

ALTER TABLE public.crm_activities
  ADD COLUMN IF NOT EXISTS visibility public.productivity_visibility NOT NULL DEFAULT 'shared';