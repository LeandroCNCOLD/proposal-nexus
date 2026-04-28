CREATE TABLE IF NOT EXISTS public.user_access_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  nomus_user_id text,
  suggested_role public.app_role NOT NULL DEFAULT 'vendedor',
  status text NOT NULL DEFAULT 'pending',
  notes text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS idx_user_access_queue_status ON public.user_access_queue(status);
CREATE INDEX IF NOT EXISTS idx_user_access_queue_source ON public.user_access_queue(source);
CREATE INDEX IF NOT EXISTS idx_user_access_queue_nomus_user_id ON public.user_access_queue(nomus_user_id);

ALTER TABLE public.user_access_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_access_queue_manager_select" ON public.user_access_queue;
CREATE POLICY "user_access_queue_manager_select"
ON public.user_access_queue
FOR SELECT
TO authenticated
USING (public.can_manage_user_access(auth.uid()));

DROP POLICY IF EXISTS "user_access_queue_manager_insert" ON public.user_access_queue;
CREATE POLICY "user_access_queue_manager_insert"
ON public.user_access_queue
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_user_access(auth.uid()));

DROP POLICY IF EXISTS "user_access_queue_manager_update" ON public.user_access_queue;
CREATE POLICY "user_access_queue_manager_update"
ON public.user_access_queue
FOR UPDATE
TO authenticated
USING (public.can_manage_user_access(auth.uid()))
WITH CHECK (public.can_manage_user_access(auth.uid()));

DROP TRIGGER IF EXISTS trg_user_access_queue_updated ON public.user_access_queue;
CREATE TRIGGER trg_user_access_queue_updated
BEFORE UPDATE ON public.user_access_queue
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();