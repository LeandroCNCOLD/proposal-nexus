ALTER TABLE public.proposal_templates
ADD COLUMN IF NOT EXISTS pages_template jsonb NOT NULL DEFAULT '[]'::jsonb;