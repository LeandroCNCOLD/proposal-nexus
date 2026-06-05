ALTER TABLE public.crm_call_logs
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'Telefone',
  ADD COLUMN IF NOT EXISTS proof_path text,
  ADD COLUMN IF NOT EXISTS proof_validated boolean NOT NULL DEFAULT false;

ALTER TABLE public.crm_call_logs DROP CONSTRAINT IF EXISTS crm_call_logs_channel_check;
ALTER TABLE public.crm_call_logs
  ADD CONSTRAINT crm_call_logs_channel_check
  CHECK (channel IN ('Telefone','WhatsApp','E-mail','Outro'));