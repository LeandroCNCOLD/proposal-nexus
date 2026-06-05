ALTER TABLE public.crm_pipeline 
  ADD COLUMN IF NOT EXISTS locked_by_sdr_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS locked_by_sdr_name text,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS lock_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS crm_pipeline_locked_idx 
  ON public.crm_pipeline(locked_by_sdr_id);

CREATE OR REPLACE FUNCTION public.release_expired_locks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.crm_pipeline
  SET locked_by_sdr_id = NULL,
      locked_by_sdr_name = NULL,
      locked_at = NULL,
      lock_expires_at = NULL
  WHERE lock_expires_at < now()
    AND locked_by_sdr_id IS NOT NULL;
END;
$$;