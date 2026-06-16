-- Passo 2 — Schema: lead_tipo + campanha_id
DO $$ BEGIN
  CREATE TYPE public.sdr_lead_tipo AS ENUM (
    'cnsync','nomus','campanha','inbound','indicacao','manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.sdr_leads
  ADD COLUMN IF NOT EXISTS lead_tipo public.sdr_lead_tipo,
  ADD COLUMN IF NOT EXISTS campanha_id uuid;

CREATE INDEX IF NOT EXISTS idx_sdr_leads_lead_tipo ON public.sdr_leads(lead_tipo);
CREATE INDEX IF NOT EXISTS idx_sdr_leads_campanha_id ON public.sdr_leads(campanha_id);