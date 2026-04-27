CREATE OR REPLACE FUNCTION public.sync_normalize_text(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(upper(regexp_replace(btrim(coalesce(value, '')), '\s+', ' ', 'g')), '')
$$;

CREATE OR REPLACE FUNCTION public.sync_digits_only(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(regexp_replace(coalesce(value, ''), '\D', '', 'g'), '')
$$;

CREATE OR REPLACE FUNCTION public.sync_normalize_model(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(upper(regexp_replace(regexp_replace(btrim(coalesce(value, '')), '\s+', '', 'g'), '[^A-Z0-9._/-]', '', 'g')), '')
$$;

ALTER TABLE public.proposal_items
  ADD COLUMN IF NOT EXISTS nomus_item_id text,
  ADD COLUMN IF NOT EXISTS nomus_raw jsonb,
  ADD COLUMN IF NOT EXISTS nomus_synced_at timestamptz;

ALTER TABLE public.equipments
  ADD COLUMN IF NOT EXISTS normalized_model text;

UPDATE public.equipments
SET normalized_model = public.sync_normalize_model(model)
WHERE normalized_model IS NULL AND model IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_equipment_normalized_model()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.normalized_model := public.sync_normalize_model(NEW.model);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_equipments_normalized_model ON public.equipments;
CREATE TRIGGER trg_equipments_normalized_model
BEFORE INSERT OR UPDATE OF model ON public.equipments
FOR EACH ROW EXECUTE FUNCTION public.set_equipment_normalized_model();

CREATE TABLE IF NOT EXISTS public.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL DEFAULT 'nomus',
  entity_type text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  total_received integer NOT NULL DEFAULT 0,
  total_inserted integer NOT NULL DEFAULT 0,
  total_updated integer NOT NULL DEFAULT 0,
  total_skipped integer NOT NULL DEFAULT 0,
  total_errors integer NOT NULL DEFAULT 0,
  error_message text,
  created_by uuid
);

CREATE TABLE IF NOT EXISTS public.sync_row_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  external_id text,
  local_id uuid,
  action text NOT NULL,
  status text NOT NULL,
  error_message text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nomus_product_equipment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomus_product_id text NOT NULL,
  equipment_id uuid REFERENCES public.equipments(id) ON DELETE SET NULL,
  match_type text NOT NULL DEFAULT 'unmatched',
  confidence_score numeric(5,2) NOT NULL DEFAULT 0,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nomus_product_id)
);

ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_row_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomus_product_equipment_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_runs_select ON public.sync_runs;
CREATE POLICY sync_runs_select ON public.sync_runs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sync_row_logs_select ON public.sync_row_logs;
CREATE POLICY sync_row_logs_select ON public.sync_row_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS nomus_product_equipment_links_select ON public.nomus_product_equipment_links;
CREATE POLICY nomus_product_equipment_links_select ON public.nomus_product_equipment_links FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS nomus_product_equipment_links_modify ON public.nomus_product_equipment_links;
CREATE POLICY nomus_product_equipment_links_modify ON public.nomus_product_equipment_links
FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]));

CREATE INDEX IF NOT EXISTS idx_sync_runs_started ON public.sync_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_entity ON public.sync_runs(entity_type, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_row_logs_run ON public.sync_row_logs(sync_run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_row_logs_entity_status ON public.sync_row_logs(entity_type, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_nomus_id_not_null
  ON public.clients(nomus_id) WHERE nomus_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_document_without_nomus
  ON public.clients(public.sync_digits_only(document)) WHERE nomus_id IS NULL AND public.sync_digits_only(document) IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_email_normalized
  ON public.clients(lower(btrim(email))) WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_proposals_nomus_id_not_null
  ON public.proposals(nomus_id) WHERE nomus_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_proposals_number_without_nomus
  ON public.proposals(public.sync_normalize_text(number)) WHERE nomus_id IS NULL AND public.sync_normalize_text(number) IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_proposal_items_nomus
  ON public.proposal_items(proposal_id, nomus_item_id) WHERE nomus_item_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_nomus_proposal_items_item
  ON public.nomus_proposal_items(nomus_proposal_id, nomus_item_id) WHERE nomus_item_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_nomus_proposal_items_position_natural
  ON public.nomus_proposal_items(nomus_proposal_id, position, product_code, description) WHERE nomus_item_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_equipments_line_normalized_model
  ON public.equipments(line_id, normalized_model) WHERE line_id IS NOT NULL AND normalized_model IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_equipment_curves_unique_profile
  ON public.equipment_performance_curves(
    equipment_id,
    COALESCE(evaporation_temperature, -999999),
    COALESCE(condensation_temperature, -999999),
    COALESCE(chamber_temperature, -999999),
    COALESCE(chamber_humidity, -999999)
  );

CREATE INDEX IF NOT EXISTS idx_nomus_product_equipment_links_match_type
  ON public.nomus_product_equipment_links(match_type, created_at DESC);