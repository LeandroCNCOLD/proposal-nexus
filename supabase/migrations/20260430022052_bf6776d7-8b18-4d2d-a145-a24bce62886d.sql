CREATE TABLE IF NOT EXISTS public.nomus_price_audit_ai_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Auditoria inteligente de preços',
  report_markdown text NOT NULL DEFAULT '',
  audit_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_question text,
  last_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nomus_price_audit_ai_sessions_user_updated
  ON public.nomus_price_audit_ai_sessions (user_id, updated_at DESC);

ALTER TABLE public.nomus_price_audit_ai_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own price audit AI sessions" ON public.nomus_price_audit_ai_sessions;
CREATE POLICY "Users can view own price audit AI sessions"
ON public.nomus_price_audit_ai_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own price audit AI sessions" ON public.nomus_price_audit_ai_sessions;
CREATE POLICY "Users can create own price audit AI sessions"
ON public.nomus_price_audit_ai_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own price audit AI sessions" ON public.nomus_price_audit_ai_sessions;
CREATE POLICY "Users can update own price audit AI sessions"
ON public.nomus_price_audit_ai_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.nomus_price_audit_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.nomus_price_audit_ai_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nomus_price_audit_ai_messages_session_created
  ON public.nomus_price_audit_ai_messages (session_id, created_at ASC);

ALTER TABLE public.nomus_price_audit_ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own price audit AI messages" ON public.nomus_price_audit_ai_messages;
CREATE POLICY "Users can view own price audit AI messages"
ON public.nomus_price_audit_ai_messages
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own price audit AI messages" ON public.nomus_price_audit_ai_messages;
CREATE POLICY "Users can create own price audit AI messages"
ON public.nomus_price_audit_ai_messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_nomus_price_audit_ai_sessions_updated_at
BEFORE UPDATE ON public.nomus_price_audit_ai_sessions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();