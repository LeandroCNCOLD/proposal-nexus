ALTER TABLE public.crm_team_members ADD COLUMN IF NOT EXISTS push_token text;
ALTER TABLE public.crm_call_logs ADD COLUMN IF NOT EXISTS numero_discado text;
ALTER TABLE public.crm_call_logs ADD COLUMN IF NOT EXISTS encerrado_em timestamptz;