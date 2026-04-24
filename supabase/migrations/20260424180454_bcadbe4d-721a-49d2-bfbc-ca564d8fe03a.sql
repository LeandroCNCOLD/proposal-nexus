CREATE TABLE IF NOT EXISTS public.nomus_process_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  entity text NOT NULL DEFAULT 'processos',
  tipos text[] NOT NULL DEFAULT '{}',
  max_items integer NOT NULL DEFAULT 5000,
  page_size integer NOT NULL DEFAULT 50,
  current_page integer NOT NULL DEFAULT 1,
  processed_items integer NOT NULL DEFAULT 0,
  upserted_items integer NOT NULL DEFAULT 0,
  stages_discovered integer NOT NULL DEFAULT 0,
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nomus_process_sync_jobs_status_check CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  CONSTRAINT nomus_process_sync_jobs_max_items_check CHECK (max_items BETWEEN 1 AND 50000),
  CONSTRAINT nomus_process_sync_jobs_page_size_check CHECK (page_size BETWEEN 1 AND 200),
  CONSTRAINT nomus_process_sync_jobs_current_page_check CHECK (current_page >= 1),
  CONSTRAINT nomus_process_sync_jobs_processed_items_check CHECK (processed_items >= 0),
  CONSTRAINT nomus_process_sync_jobs_upserted_items_check CHECK (upserted_items >= 0)
);

CREATE INDEX IF NOT EXISTS idx_nomus_process_sync_jobs_requested_by_created
  ON public.nomus_process_sync_jobs(requested_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nomus_process_sync_jobs_status_created
  ON public.nomus_process_sync_jobs(status, created_at DESC);

ALTER TABLE public.nomus_process_sync_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nomus_process_sync_jobs_select" ON public.nomus_process_sync_jobs;
CREATE POLICY "nomus_process_sync_jobs_select"
  ON public.nomus_process_sync_jobs
  FOR SELECT
  TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role])
  );

DROP POLICY IF EXISTS "nomus_process_sync_jobs_insert" ON public.nomus_process_sync_jobs;
CREATE POLICY "nomus_process_sync_jobs_insert"
  ON public.nomus_process_sync_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (requested_by = auth.uid());

DROP POLICY IF EXISTS "nomus_process_sync_jobs_update" ON public.nomus_process_sync_jobs;
CREATE POLICY "nomus_process_sync_jobs_update"
  ON public.nomus_process_sync_jobs
  FOR UPDATE
  TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role])
  );

DROP TRIGGER IF EXISTS trg_nomus_process_sync_jobs_updated_at ON public.nomus_process_sync_jobs;
CREATE TRIGGER trg_nomus_process_sync_jobs_updated_at
  BEFORE UPDATE ON public.nomus_process_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();