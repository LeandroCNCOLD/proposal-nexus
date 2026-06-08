ALTER TABLE public.sdr_leads ADD COLUMN IF NOT EXISTS proposal_status text;
CREATE INDEX IF NOT EXISTS idx_sdr_leads_proposal_status ON public.sdr_leads(proposal_status);