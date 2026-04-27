CREATE OR REPLACE FUNCTION public.sync_normalize_cn_cold_model(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(
        upper(btrim(coalesce(value, ''))),
        '^(CN)[\s._/-]*0*([0-9]+)',
        'CN\2'
      ),
      '[^A-Z0-9]',
      '',
      'g'
    ),
    ''
  )
$$;

CREATE OR REPLACE FUNCTION public.sync_jsonb_hash(payload jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT md5(coalesce(payload, '{}'::jsonb)::text)
$$;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS external_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_hash text,
  ADD COLUMN IF NOT EXISTS external_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_into_id uuid,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS external_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_hash text,
  ADD COLUMN IF NOT EXISTS external_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS merged_into_id uuid,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz;

ALTER TABLE public.proposal_items
  ADD COLUMN IF NOT EXISTS external_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_hash text,
  ADD COLUMN IF NOT EXISTS external_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS merged_into_id uuid,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz;

ALTER TABLE public.equipments
  ADD COLUMN IF NOT EXISTS external_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_hash text,
  ADD COLUMN IF NOT EXISTS external_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS normalized_model_code text,
  ADD COLUMN IF NOT EXISTS merged_into_id uuid,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz;

UPDATE public.equipments
SET normalized_model_code = public.sync_normalize_cn_cold_model(coalesce(model, normalized_model))
WHERE normalized_model_code IS NULL AND coalesce(model, normalized_model) IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_equipment_normalized_codes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.normalized_model := public.sync_normalize_model(NEW.model);
  NEW.normalized_model_code := public.sync_normalize_cn_cold_model(coalesce(NEW.model, NEW.normalized_model));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_equipments_normalized_model ON public.equipments;
DROP TRIGGER IF EXISTS trg_equipments_normalized_codes ON public.equipments;
CREATE TRIGGER trg_equipments_normalized_codes
BEFORE INSERT OR UPDATE OF model, normalized_model ON public.equipments
FOR EACH ROW EXECUTE FUNCTION public.set_equipment_normalized_codes();

ALTER TABLE public.nomus_proposals
  ADD COLUMN IF NOT EXISTS external_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_hash text,
  ADD COLUMN IF NOT EXISTS external_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.nomus_proposal_items
  ADD COLUMN IF NOT EXISTS external_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_hash text,
  ADD COLUMN IF NOT EXISTS external_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS normalized_model_code text;

ALTER TABLE public.nomus_sellers
  ADD COLUMN IF NOT EXISTS external_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_hash text,
  ADD COLUMN IF NOT EXISTS external_deleted_at timestamptz;

ALTER TABLE public.nomus_representatives
  ADD COLUMN IF NOT EXISTS external_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_hash text,
  ADD COLUMN IF NOT EXISTS external_deleted_at timestamptz;

ALTER TABLE public.nomus_processes
  ADD COLUMN IF NOT EXISTS external_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_hash text,
  ADD COLUMN IF NOT EXISTS external_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.sync_runs
  ADD COLUMN IF NOT EXISTS dry_run boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lock_key text,
  ADD COLUMN IF NOT EXISTS parent_sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS total_quarantined integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_no_change integer NOT NULL DEFAULT 0;

ALTER TABLE public.sync_row_logs
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS previous_hash text,
  ADD COLUMN IF NOT EXISTS new_hash text,
  ADD COLUMN IF NOT EXISTS reprocess_status text,
  ADD COLUMN IF NOT EXISTS reprocessed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reprocessed_sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.sync_error_codes (
  code text PRIMARY KEY,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  is_retryable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.sync_error_codes (code, description, severity, is_retryable) VALUES
  ('INVALID_CNPJ', 'CNPJ inválido ou inconsistente.', 'error', true),
  ('MISSING_EXTERNAL_ID', 'Registro sem identificador externo obrigatório.', 'error', true),
  ('DUPLICATE_NATURAL_KEY', 'Chave natural duplicada detectada.', 'warning', true),
  ('UNMATCHED_EQUIPMENT', 'Produto sem equipamento correspondente.', 'warning', true),
  ('INVALID_PROPOSAL_TOTAL', 'Total da proposta inválido ou inconsistente.', 'error', true),
  ('MISSING_REQUIRED_FIELD', 'Campo obrigatório ausente.', 'error', true),
  ('SKIPPED_NO_CHANGE', 'Registro ignorado porque não houve alteração.', 'info', false),
  ('LOCK_ALREADY_RUNNING', 'Sincronização já está em andamento para a entidade.', 'warning', false)
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  severity = EXCLUDED.severity,
  is_retryable = EXCLUDED.is_retryable;

CREATE TABLE IF NOT EXISTS public.sync_locks (
  lock_key text PRIMARY KEY,
  source_system text NOT NULL DEFAULT 'nomus',
  entity_type text NOT NULL,
  sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE SET NULL,
  acquired_by uuid,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  heartbeat_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sync_quarantine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE SET NULL,
  source_system text NOT NULL DEFAULT 'nomus',
  entity_type text NOT NULL,
  external_id text,
  error_code text REFERENCES public.sync_error_codes(code),
  reason text NOT NULL,
  raw_payload jsonb,
  normalized_payload jsonb,
  status text NOT NULL DEFAULT 'open',
  reviewed_by uuid,
  reviewed_at timestamptz,
  reprocess_sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.sync_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL DEFAULT 'nomus',
  entity_type text NOT NULL,
  external_field text NOT NULL,
  local_field text NOT NULL,
  transformation text,
  is_required boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  master_source text NOT NULL DEFAULT 'nomus',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_system, entity_type, external_field, local_field, version)
);

CREATE TABLE IF NOT EXISTS public.sync_field_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE SET NULL,
  source_system text NOT NULL DEFAULT 'nomus',
  entity_type text NOT NULL,
  local_id uuid,
  external_id text,
  field_name text NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  origin text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sync_quality_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE SET NULL,
  source_system text NOT NULL DEFAULT 'nomus',
  entity_type text NOT NULL DEFAULT 'global',
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sync_merge_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  primary_record_id uuid,
  duplicate_record_id uuid NOT NULL,
  reason text NOT NULL,
  confidence_score numeric(5,2) NOT NULL DEFAULT 0,
  relationships jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'suggested',
  merged_by uuid,
  merged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipments_normalized_model_code ON public.equipments(normalized_model_code) WHERE normalized_model_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nomus_proposal_items_normalized_model_code ON public.nomus_proposal_items(normalized_model_code) WHERE normalized_model_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sync_runs_lock_key ON public.sync_runs(lock_key, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_quarantine_status ON public.sync_quarantine(status, entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_quarantine_error_code ON public.sync_quarantine(error_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_field_changes_entity ON public.sync_field_changes(entity_type, local_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_field_mappings_entity_active ON public.sync_field_mappings(entity_type, is_active, version DESC);
CREATE INDEX IF NOT EXISTS idx_sync_merge_suggestions_status ON public.sync_merge_suggestions(status, entity_type, created_at DESC);

ALTER TABLE public.sync_error_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_quarantine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_field_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_quality_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_merge_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_error_codes_select ON public.sync_error_codes;
CREATE POLICY sync_error_codes_select ON public.sync_error_codes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sync_locks_select ON public.sync_locks;
CREATE POLICY sync_locks_select ON public.sync_locks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sync_quarantine_select ON public.sync_quarantine;
CREATE POLICY sync_quarantine_select ON public.sync_quarantine FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sync_quarantine_modify ON public.sync_quarantine;
CREATE POLICY sync_quarantine_modify ON public.sync_quarantine
FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]));

DROP POLICY IF EXISTS sync_field_mappings_select ON public.sync_field_mappings;
CREATE POLICY sync_field_mappings_select ON public.sync_field_mappings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sync_field_mappings_modify ON public.sync_field_mappings;
CREATE POLICY sync_field_mappings_modify ON public.sync_field_mappings
FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]));

DROP POLICY IF EXISTS sync_field_changes_select ON public.sync_field_changes;
CREATE POLICY sync_field_changes_select ON public.sync_field_changes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sync_quality_reports_select ON public.sync_quality_reports;
CREATE POLICY sync_quality_reports_select ON public.sync_quality_reports FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sync_merge_suggestions_select ON public.sync_merge_suggestions;
CREATE POLICY sync_merge_suggestions_select ON public.sync_merge_suggestions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sync_merge_suggestions_modify ON public.sync_merge_suggestions;
CREATE POLICY sync_merge_suggestions_modify ON public.sync_merge_suggestions
FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]));

INSERT INTO public.sync_field_mappings (entity_type, external_field, local_field, transformation, is_required, master_source, version) VALUES
  ('clientes', 'razaoSocial', 'name', 'trim', true, 'nomus', 1),
  ('clientes', 'cnpj', 'document', 'digits_only', false, 'nomus', 1),
  ('clientes', 'endereco', 'address', 'trim', false, 'nomus', 1),
  ('clientes', 'observacoes', 'notes', 'manual_preserved', false, 'proposal_nexus', 1),
  ('propostas', 'numero', 'number', 'trim', true, 'nomus', 1),
  ('propostas', 'valorTotal', 'total_value', 'number', false, 'nomus', 1),
  ('propostas', 'validade', 'valid_until', 'date', false, 'nomus', 1),
  ('propostas', 'status', 'status', 'manual_preserved', false, 'proposal_nexus', 1),
  ('propostas', 'temperature', 'temperature', 'manual_preserved', false, 'proposal_nexus', 1),
  ('produtos', 'codigo', 'normalized_model_code', 'cn_cold_model', true, 'nomus', 1)
ON CONFLICT (source_system, entity_type, external_field, local_field, version) DO UPDATE SET
  transformation = EXCLUDED.transformation,
  is_required = EXCLUDED.is_required,
  master_source = EXCLUDED.master_source,
  is_active = true;