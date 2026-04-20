
-- Linkage columns
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS nomus_id text UNIQUE;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS nomus_synced_at timestamptz;

ALTER TABLE public.client_contacts ADD COLUMN IF NOT EXISTS nomus_id text;

ALTER TABLE public.equipments ADD COLUMN IF NOT EXISTS nomus_id text UNIQUE;
ALTER TABLE public.equipments ADD COLUMN IF NOT EXISTS nomus_synced_at timestamptz;

ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS nomus_id text UNIQUE;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS nomus_pedido_id text;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS nomus_synced_at timestamptz;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nomus_vendedor_id text;

-- Settings (singleton)
CREATE TABLE IF NOT EXISTS public.nomus_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_url text,
  is_enabled boolean NOT NULL DEFAULT false,
  sync_clients boolean NOT NULL DEFAULT true,
  sync_contacts boolean NOT NULL DEFAULT true,
  sync_products boolean NOT NULL DEFAULT true,
  sync_sellers boolean NOT NULL DEFAULT true,
  sync_payment_terms boolean NOT NULL DEFAULT true,
  sync_price_tables boolean NOT NULL DEFAULT true,
  sync_proposals boolean NOT NULL DEFAULT true,
  proposals_direction text NOT NULL DEFAULT 'push',
  clients_direction text NOT NULL DEFAULT 'pull',
  auto_push_proposals boolean NOT NULL DEFAULT true,
  auto_push_followups boolean NOT NULL DEFAULT true,
  auto_create_pedido_on_won boolean NOT NULL DEFAULT true,
  last_full_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nomus_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY nomus_settings_select ON public.nomus_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY nomus_settings_modify ON public.nomus_settings FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]));

CREATE TRIGGER nomus_settings_updated BEFORE UPDATE ON public.nomus_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sync log
CREATE TABLE IF NOT EXISTS public.nomus_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  operation text NOT NULL,
  direction text NOT NULL,
  status text NOT NULL,
  http_status int,
  duration_ms int,
  request_path text,
  payload jsonb,
  response jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  triggered_by uuid
);
ALTER TABLE public.nomus_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY nomus_log_select ON public.nomus_sync_log FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS nomus_sync_log_created_idx ON public.nomus_sync_log (created_at DESC);
CREATE INDEX IF NOT EXISTS nomus_sync_log_entity_idx ON public.nomus_sync_log (entity, created_at DESC);

-- Sync state (cursor)
CREATE TABLE IF NOT EXISTS public.nomus_sync_state (
  entity text PRIMARY KEY,
  last_synced_at timestamptz,
  last_cursor text,
  running boolean NOT NULL DEFAULT false,
  last_error text,
  total_synced int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nomus_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY nomus_state_select ON public.nomus_sync_state FOR SELECT TO authenticated USING (true);

-- Payment terms
CREATE TABLE IF NOT EXISTS public.nomus_payment_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomus_id text UNIQUE NOT NULL,
  code text,
  name text NOT NULL,
  installments int,
  days_first_installment int,
  interval_days int,
  is_active boolean NOT NULL DEFAULT true,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nomus_payment_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY nomus_pt_select ON public.nomus_payment_terms FOR SELECT TO authenticated USING (true);

-- Price tables
CREATE TABLE IF NOT EXISTS public.nomus_price_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomus_id text UNIQUE NOT NULL,
  code text,
  name text NOT NULL,
  currency text DEFAULT 'BRL',
  is_active boolean NOT NULL DEFAULT true,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nomus_price_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY nomus_pricet_select ON public.nomus_price_tables FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.nomus_price_table_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_table_id uuid NOT NULL REFERENCES public.nomus_price_tables(id) ON DELETE CASCADE,
  nomus_product_id text NOT NULL,
  equipment_id uuid REFERENCES public.equipments(id) ON DELETE SET NULL,
  unit_price numeric(14,2) NOT NULL,
  currency text DEFAULT 'BRL',
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (price_table_id, nomus_product_id)
);
ALTER TABLE public.nomus_price_table_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY nomus_pti_select ON public.nomus_price_table_items FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS nomus_pti_eq_idx ON public.nomus_price_table_items (equipment_id);

-- Optional FK on proposals (just a column, no hard FK to keep flexibility)
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS payment_term_id uuid REFERENCES public.nomus_payment_terms(id) ON DELETE SET NULL;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS price_table_id uuid REFERENCES public.nomus_price_tables(id) ON DELETE SET NULL;

-- Seed singleton
INSERT INTO public.nomus_settings (id, is_enabled) 
SELECT gen_random_uuid(), false 
WHERE NOT EXISTS (SELECT 1 FROM public.nomus_settings);
