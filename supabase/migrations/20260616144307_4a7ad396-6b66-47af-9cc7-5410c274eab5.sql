ALTER TABLE public.sdr_leads
  ADD COLUMN IF NOT EXISTS competitor_status text;

CREATE INDEX IF NOT EXISTS idx_sdr_leads_competitor_status
  ON public.sdr_leads(competitor_status)
  WHERE competitor_status IS NOT NULL;