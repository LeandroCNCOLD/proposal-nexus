
-- Renomear crm_pipeline para sdr_leads (mantém dados, índices, policies)
ALTER TABLE public.crm_pipeline RENAME TO sdr_leads;
ALTER TABLE public.sdr_leads RENAME COLUMN proposal_number TO lead_code;

-- Recriar função release_expired_locks apontando para sdr_leads
CREATE OR REPLACE FUNCTION public.release_expired_locks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sdr_leads
  SET locked_by_sdr_id = NULL,
      locked_by_sdr_name = NULL,
      locked_at = NULL,
      lock_expires_at = NULL
  WHERE lock_expires_at < now()
    AND locked_by_sdr_id IS NOT NULL;
END;
$$;
