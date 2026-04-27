ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS sync_error_code text,
  ADD COLUMN IF NOT EXISTS sync_error_message text,
  ADD COLUMN IF NOT EXISTS last_sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE SET NULL;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS sync_error_code text,
  ADD COLUMN IF NOT EXISTS sync_error_message text,
  ADD COLUMN IF NOT EXISTS last_sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE SET NULL;

ALTER TABLE public.proposal_items
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS sync_error_code text,
  ADD COLUMN IF NOT EXISTS sync_error_message text,
  ADD COLUMN IF NOT EXISTS last_sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE SET NULL;

ALTER TABLE public.equipments
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS sync_error_code text,
  ADD COLUMN IF NOT EXISTS sync_error_message text,
  ADD COLUMN IF NOT EXISTS last_sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE SET NULL;

ALTER TABLE public.nomus_proposals
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS sync_error_code text,
  ADD COLUMN IF NOT EXISTS sync_error_message text,
  ADD COLUMN IF NOT EXISTS last_sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE SET NULL;

ALTER TABLE public.nomus_proposal_items
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS sync_error_code text,
  ADD COLUMN IF NOT EXISTS sync_error_message text,
  ADD COLUMN IF NOT EXISTS last_sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE SET NULL;

ALTER TABLE public.nomus_sellers
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS sync_error_code text,
  ADD COLUMN IF NOT EXISTS sync_error_message text,
  ADD COLUMN IF NOT EXISTS last_sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE SET NULL;

ALTER TABLE public.nomus_representatives
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS sync_error_code text,
  ADD COLUMN IF NOT EXISTS sync_error_message text,
  ADD COLUMN IF NOT EXISTS last_sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.sync_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL DEFAULT 'nomus',
  entity_type text NOT NULL,
  sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE SET NULL,
  last_page integer NOT NULL DEFAULT 1,
  last_external_id text,
  last_updated_at timestamptz,
  status text NOT NULL DEFAULT 'idle',
  cursor_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_system, entity_type)
);

CREATE TABLE IF NOT EXISTS public.sync_pending_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL DEFAULT 'nomus',
  entity_type text NOT NULL,
  issue_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  external_id text,
  local_id uuid,
  sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE SET NULL,
  title text NOT NULL,
  details text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open',
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sync_entity_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL DEFAULT 'nomus',
  entity_type text NOT NULL,
  default_window_days integer,
  sync_frequency text NOT NULL DEFAULT 'daily',
  priority integer NOT NULL DEFAULT 50,
  data_temperature text NOT NULL DEFAULT 'warm',
  max_requests_per_minute integer NOT NULL DEFAULT 40,
  retry_after_seconds integer NOT NULL DEFAULT 2,
  backoff_multiplier numeric(6,2) NOT NULL DEFAULT 2,
  timeout_ms integer NOT NULL DEFAULT 25000,
  max_attempts integer NOT NULL DEFAULT 3,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_system, entity_type)
);

CREATE TABLE IF NOT EXISTS public.sync_protected_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  field_name text NOT NULL,
  reason text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, field_name)
);

CREATE TABLE IF NOT EXISTS public.outbound_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL DEFAULT 'proposal_nexus',
  target_system text NOT NULL DEFAULT 'nomus',
  entity_type text NOT NULL,
  local_id uuid NOT NULL,
  external_id text,
  operation text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  next_attempt_at timestamptz,
  last_error_code text,
  last_error_message text,
  sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sync_checkpoints_entity_status ON public.sync_checkpoints(entity_type, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_pending_issues_status ON public.sync_pending_issues(status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_pending_issues_entity ON public.sync_pending_issues(entity_type, issue_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_entity_policies_active ON public.sync_entity_policies(is_active, priority);
CREATE INDEX IF NOT EXISTS idx_outbound_sync_queue_status ON public.outbound_sync_queue(status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS idx_clients_sync_status ON public.clients(sync_status, last_synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_sync_status ON public.proposals(sync_status, last_synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_equipments_sync_status ON public.equipments(sync_status, last_synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_nomus_proposals_sync_status ON public.nomus_proposals(sync_status, last_synced_at DESC);

ALTER TABLE public.sync_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_pending_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_entity_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_protected_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_sync_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_checkpoints_select ON public.sync_checkpoints;
CREATE POLICY sync_checkpoints_select ON public.sync_checkpoints FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sync_checkpoints_modify ON public.sync_checkpoints;
CREATE POLICY sync_checkpoints_modify ON public.sync_checkpoints
FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]));

DROP POLICY IF EXISTS sync_pending_issues_select ON public.sync_pending_issues;
CREATE POLICY sync_pending_issues_select ON public.sync_pending_issues FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sync_pending_issues_modify ON public.sync_pending_issues;
CREATE POLICY sync_pending_issues_modify ON public.sync_pending_issues
FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]));

DROP POLICY IF EXISTS sync_entity_policies_select ON public.sync_entity_policies;
CREATE POLICY sync_entity_policies_select ON public.sync_entity_policies FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sync_entity_policies_modify ON public.sync_entity_policies;
CREATE POLICY sync_entity_policies_modify ON public.sync_entity_policies
FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]));

DROP POLICY IF EXISTS sync_protected_fields_select ON public.sync_protected_fields;
CREATE POLICY sync_protected_fields_select ON public.sync_protected_fields FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sync_protected_fields_modify ON public.sync_protected_fields;
CREATE POLICY sync_protected_fields_modify ON public.sync_protected_fields
FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]));

DROP POLICY IF EXISTS outbound_sync_queue_select ON public.outbound_sync_queue;
CREATE POLICY outbound_sync_queue_select ON public.outbound_sync_queue FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS outbound_sync_queue_modify ON public.outbound_sync_queue;
CREATE POLICY outbound_sync_queue_modify ON public.outbound_sync_queue
FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]));

INSERT INTO public.sync_entity_policies (entity_type, default_window_days, sync_frequency, priority, data_temperature, max_requests_per_minute, retry_after_seconds, backoff_multiplier, timeout_ms, max_attempts) VALUES
  ('propostas', 7, '15-30min', 10, 'hot', 30, 3, 2, 25000, 3),
  ('clientes', 30, 'daily', 30, 'warm', 40, 2, 2, 25000, 3),
  ('representantes', 30, 'daily', 35, 'warm', 40, 2, 2, 25000, 3),
  ('vendedores', 30, 'daily', 35, 'warm', 40, 2, 2, 25000, 3),
  ('produtos', 1, 'daily_or_on_demand', 60, 'cold', 25, 3, 2, 25000, 3),
  ('equipamentos', 1, 'daily_or_on_demand', 60, 'cold', 25, 3, 2, 25000, 3),
  ('pedidos', 7, '30min', 20, 'hot', 30, 3, 2, 25000, 3),
  ('notas_fiscais', 7, '30min', 25, 'hot', 30, 3, 2, 25000, 3)
ON CONFLICT (source_system, entity_type) DO UPDATE SET
  default_window_days = EXCLUDED.default_window_days,
  sync_frequency = EXCLUDED.sync_frequency,
  priority = EXCLUDED.priority,
  data_temperature = EXCLUDED.data_temperature,
  max_requests_per_minute = EXCLUDED.max_requests_per_minute,
  retry_after_seconds = EXCLUDED.retry_after_seconds,
  backoff_multiplier = EXCLUDED.backoff_multiplier,
  timeout_ms = EXCLUDED.timeout_ms,
  max_attempts = EXCLUDED.max_attempts,
  is_active = true,
  updated_at = now();

INSERT INTO public.sync_protected_fields (entity_type, field_name, reason) VALUES
  ('propostas', 'status', 'Status comercial interno do Proposal Nexus.'),
  ('propostas', 'temperature', 'Temperatura do lead é informação comercial local.'),
  ('propostas', 'notes', 'Observações internas não devem ser substituídas pelo Nomus.'),
  ('propostas', 'priority', 'Prioridade comercial local.'),
  ('propostas', 'tags', 'Tags são classificação local.'),
  ('propostas', 'assigned_to', 'Responsável interno é controle local.'),
  ('clients', 'notes', 'Observações internas de cliente são locais.'),
  ('clients', 'owner_id', 'Responsável interno é controle local.'),
  ('clients', 'tags', 'Tags são classificação local.')
ON CONFLICT (entity_type, field_name) DO UPDATE SET
  reason = EXCLUDED.reason,
  is_active = true;

INSERT INTO public.sync_error_codes (code, description, severity, is_retryable) VALUES
  ('NOMUS_RATE_LIMITED', 'Nomus limitou requisições; execução deve aguardar e tentar novamente.', 'warning', true),
  ('NOMUS_TIMEOUT', 'Chamada ao Nomus excedeu o tempo limite.', 'warning', true),
  ('MISSING_CNPJ', 'Cliente sem CNPJ para conciliação segura.', 'warning', true),
  ('PROPOSAL_WITHOUT_ITEMS', 'Proposta sem itens vinculados.', 'warning', true),
  ('ITEM_WITHOUT_VALUE', 'Item de proposta sem valor.', 'warning', true),
  ('REPRESENTATIVE_NOT_FOUND', 'Representante não encontrado para vínculo automático.', 'warning', true),
  ('DUPLICATE_CLIENT_CNPJ', 'Clientes duplicados pelo mesmo CNPJ.', 'error', true),
  ('DUPLICATE_PROPOSAL_NUMBER', 'Propostas duplicadas pelo mesmo número.', 'error', true),
  ('DUPLICATE_PRODUCT_CODE', 'Produtos duplicados pelo mesmo código.', 'error', true),
  ('DUPLICATE_EQUIPMENT_MODEL', 'Equipamentos duplicados pelo mesmo modelo normalizado.', 'error', true),
  ('DUPLICATE_PROPOSAL_ITEM', 'Itens duplicados na mesma proposta.', 'error', true)
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  severity = EXCLUDED.severity,
  is_retryable = EXCLUDED.is_retryable;