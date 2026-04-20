
-- 1. Enum source da proposta
CREATE TYPE public.proposal_source AS ENUM ('nomus', 'manual');

ALTER TABLE public.proposals
  ADD COLUMN source public.proposal_source NOT NULL DEFAULT 'nomus',
  ADD COLUMN nomus_proposal_id uuid,
  ADD COLUMN nomus_invoice_ids text[];

-- 2. Espelho ERP: propostas e itens
CREATE TABLE public.nomus_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomus_id text NOT NULL UNIQUE,
  numero text,
  cliente_nomus_id text,
  vendedor_nomus_id text,
  representante_nomus_id text,
  valor_total numeric,
  status_nomus text,
  validade date,
  data_emissao date,
  observacoes text,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_nomus_proposals_cliente ON public.nomus_proposals(cliente_nomus_id);
CREATE INDEX idx_nomus_proposals_vendedor ON public.nomus_proposals(vendedor_nomus_id);

CREATE TABLE public.nomus_proposal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomus_proposal_id uuid NOT NULL REFERENCES public.nomus_proposals(id) ON DELETE CASCADE,
  nomus_item_id text,
  nomus_product_id text,
  product_code text,
  description text,
  quantity numeric,
  unit_price numeric,
  discount numeric,
  total numeric,
  position integer,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_nomus_prop_items_proposal ON public.nomus_proposal_items(nomus_proposal_id);

-- 3. Vendedores e representantes
CREATE TABLE public.nomus_sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomus_id text NOT NULL UNIQUE,
  name text NOT NULL,
  email text,
  document text,
  is_active boolean NOT NULL DEFAULT true,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.nomus_representatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomus_id text NOT NULL UNIQUE,
  name text NOT NULL,
  email text,
  document text,
  region text,
  is_active boolean NOT NULL DEFAULT true,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Pedidos e itens
CREATE TABLE public.nomus_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomus_id text NOT NULL UNIQUE,
  numero text,
  proposal_nomus_id text,
  cliente_nomus_id text,
  vendedor_nomus_id text,
  valor_total numeric,
  status_nomus text,
  data_emissao date,
  data_entrega date,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_nomus_pedidos_proposta ON public.nomus_pedidos(proposal_nomus_id);
CREATE INDEX idx_nomus_pedidos_cliente ON public.nomus_pedidos(cliente_nomus_id);

CREATE TABLE public.nomus_pedido_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomus_pedido_id uuid NOT NULL REFERENCES public.nomus_pedidos(id) ON DELETE CASCADE,
  nomus_item_id text,
  nomus_product_id text,
  product_code text,
  description text,
  quantity numeric,
  unit_price numeric,
  total numeric,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_nomus_pedido_items_pedido ON public.nomus_pedido_items(nomus_pedido_id);

-- 5. NF-e
CREATE TABLE public.nomus_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomus_id text NOT NULL UNIQUE,
  numero text,
  serie text,
  chave_acesso text,
  pedido_nomus_id text,
  cliente_nomus_id text,
  valor_total numeric,
  status_nomus text,
  data_emissao date,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_nomus_invoices_pedido ON public.nomus_invoices(pedido_nomus_id);
CREATE INDEX idx_nomus_invoices_cliente ON public.nomus_invoices(cliente_nomus_id);

-- 6. Contas a receber (fase 2 — só estrutura)
CREATE TABLE public.nomus_receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomus_id text NOT NULL UNIQUE,
  invoice_nomus_id text,
  cliente_nomus_id text,
  valor numeric,
  data_vencimento date,
  data_pagamento date,
  status_nomus text,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Settings: novas colunas
ALTER TABLE public.nomus_settings
  ADD COLUMN sync_proposals_pull_interval_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN sync_pedidos boolean NOT NULL DEFAULT true,
  ADD COLUMN sync_invoices boolean NOT NULL DEFAULT true,
  ADD COLUMN sync_representatives boolean NOT NULL DEFAULT true,
  ADD COLUMN auto_create_local_proposal boolean NOT NULL DEFAULT true,
  ADD COLUMN auto_mark_won_on_pedido boolean NOT NULL DEFAULT true;

-- 8. Versões de envio
CREATE TABLE public.proposal_send_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  pdf_storage_path text NOT NULL,
  template_snapshot jsonb,
  generated_by uuid,
  generated_at timestamptz NOT NULL DEFAULT now(),
  is_current boolean NOT NULL DEFAULT true,
  notes text
);
CREATE INDEX idx_send_versions_proposal ON public.proposal_send_versions(proposal_id);
CREATE UNIQUE INDEX idx_send_versions_unique ON public.proposal_send_versions(proposal_id, version_number);

-- 9. Eventos de envio
CREATE TABLE public.proposal_send_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.proposal_send_versions(id) ON DELETE SET NULL,
  channel text NOT NULL,
  recipient text,
  subject text,
  message text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid,
  delivery_status text NOT NULL DEFAULT 'sent',
  opened_at timestamptz,
  metadata jsonb
);
CREATE INDEX idx_send_events_proposal ON public.proposal_send_events(proposal_id);

-- 10. Trigger: ao inserir pedido com proposal_nomus_id, vincular proposta local
CREATE OR REPLACE FUNCTION public.link_pedido_to_proposal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auto_won boolean;
BEGIN
  IF NEW.proposal_nomus_id IS NOT NULL THEN
    SELECT auto_mark_won_on_pedido INTO v_auto_won FROM public.nomus_settings LIMIT 1;

    UPDATE public.proposals
    SET nomus_pedido_id = NEW.nomus_id,
        status = CASE WHEN COALESCE(v_auto_won, true) AND status NOT IN ('ganha','perdida','cancelada')
                      THEN 'ganha'::proposal_status ELSE status END,
        closed_at = CASE WHEN COALESCE(v_auto_won, true) AND status NOT IN ('ganha','perdida','cancelada')
                         THEN now() ELSE closed_at END,
        updated_at = now()
    WHERE nomus_id = NEW.proposal_nomus_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_link_pedido_to_proposal
AFTER INSERT OR UPDATE ON public.nomus_pedidos
FOR EACH ROW EXECUTE FUNCTION public.link_pedido_to_proposal();

-- 11. RLS
ALTER TABLE public.nomus_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomus_proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomus_sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomus_representatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomus_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomus_pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomus_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomus_receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_send_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_send_events ENABLE ROW LEVEL SECURITY;

-- Espelhos ERP: SELECT para todos autenticados; sem INSERT/UPDATE/DELETE (apenas service role)
CREATE POLICY "nomus_proposals_select" ON public.nomus_proposals FOR SELECT TO authenticated USING (true);
CREATE POLICY "nomus_proposal_items_select" ON public.nomus_proposal_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "nomus_sellers_select" ON public.nomus_sellers FOR SELECT TO authenticated USING (true);
CREATE POLICY "nomus_representatives_select" ON public.nomus_representatives FOR SELECT TO authenticated USING (true);
CREATE POLICY "nomus_pedidos_select" ON public.nomus_pedidos FOR SELECT TO authenticated USING (true);
CREATE POLICY "nomus_pedido_items_select" ON public.nomus_pedido_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "nomus_invoices_select" ON public.nomus_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "nomus_receivables_select" ON public.nomus_receivables FOR SELECT TO authenticated USING (true);

-- Send versions / events
CREATE POLICY "send_versions_select" ON public.proposal_send_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "send_versions_insert" ON public.proposal_send_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "send_versions_update" ON public.proposal_send_versions FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "send_events_select" ON public.proposal_send_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "send_events_insert" ON public.proposal_send_events FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "send_events_update" ON public.proposal_send_events FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

-- 12. Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('proposal-files', 'proposal-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "proposal_files_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'proposal-files');

CREATE POLICY "proposal_files_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'proposal-files');

CREATE POLICY "proposal_files_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'proposal-files');

CREATE POLICY "proposal_files_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'proposal-files' AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]));
