-- =========================================================================
-- Presets de condição de pagamento + financeiro da proposta + auditoria
-- =========================================================================

-- 1) Tabela de presets
CREATE TABLE public.payment_condition_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ux_payment_presets_active_name
  ON public.payment_condition_presets (lower(name))
  WHERE is_active = true;

-- 2) Parcelas dos presets
CREATE TABLE public.payment_condition_preset_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id uuid NOT NULL REFERENCES public.payment_condition_presets(id) ON DELETE CASCADE,
  description text NOT NULL,
  percentage numeric(6,3) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  days integer NOT NULL CHECK (days >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_preset_installments_preset
  ON public.payment_condition_preset_installments (preset_id, sort_order);

-- 3) Triggers de updated_at
CREATE TRIGGER trg_payment_presets_updated_at
  BEFORE UPDATE ON public.payment_condition_presets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_preset_installments_updated_at
  BEFORE UPDATE ON public.payment_condition_preset_installments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) RLS dos presets
ALTER TABLE public.payment_condition_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_condition_preset_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presets_select_authenticated"
  ON public.payment_condition_presets
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "presets_modify_managers"
  ON public.payment_condition_presets
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]));

CREATE POLICY "preset_installments_select_authenticated"
  ON public.payment_condition_preset_installments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "preset_installments_modify_managers"
  ON public.payment_condition_preset_installments
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]));

-- 5) Colunas financeiras na proposta
ALTER TABLE public.proposals
  ADD COLUMN original_proposal_amount numeric(14,2),
  ADD COLUMN monthly_financial_rate_pct numeric(6,3),
  ADD COLUMN financial_rate_type text CHECK (financial_rate_type IN ('compostos','simples')) DEFAULT 'compostos',
  ADD COLUMN financial_avg_term_days numeric(8,2),
  ADD COLUMN financial_factor_pct numeric(8,4),
  ADD COLUMN financial_additional_cost numeric(14,2) DEFAULT 0,
  ADD COLUMN final_amount_with_financial_cost numeric(14,2),
  ADD COLUMN payment_condition_snapshot jsonb,
  ADD COLUMN financial_preset_id uuid REFERENCES public.payment_condition_presets(id) ON DELETE SET NULL;

-- 6) Auditoria/histórico
CREATE TABLE public.proposal_financial_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  user_id uuid,
  previous_financial_additional_cost numeric(14,2),
  new_financial_additional_cost numeric(14,2),
  previous_final_amount numeric(14,2),
  new_final_amount numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_proposal_financial_history_proposal
  ON public.proposal_financial_history (proposal_id, created_at DESC);

ALTER TABLE public.proposal_financial_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_history_select_authenticated"
  ON public.proposal_financial_history
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "financial_history_insert_self"
  ON public.proposal_financial_history
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 7) Seed dos 4 presets obrigatórios
WITH p AS (
  INSERT INTO public.payment_condition_presets (name, description, is_active)
  VALUES
    ('À vista',          '100% à vista',                                  true),
    ('50/50',            '50% sinal + 50% em 30 dias',                    true),
    ('40/30/15/15',      '40% sinal + 30% em 28d + 15% em 56d + 15% em 84d', true),
    ('30/30/20/20',      '30% sinal + 30% em 28d + 20% em 56d + 20% em 84d', true)
  RETURNING id, name
)
INSERT INTO public.payment_condition_preset_installments (preset_id, description, percentage, days, sort_order)
SELECT p.id, i.description, i.percentage, i.days, i.sort_order
FROM p
JOIN LATERAL (
  VALUES
    ('À vista',     'Pagamento à vista', 100.000, 0,  0),
    ('50/50',       'Sinal',              50.000, 0,  0),
    ('50/50',       '30 dias',            50.000, 30, 1),
    ('40/30/15/15', 'Sinal',              40.000, 0,  0),
    ('40/30/15/15', '28 dias',            30.000, 28, 1),
    ('40/30/15/15', '56 dias',            15.000, 56, 2),
    ('40/30/15/15', '84 dias',            15.000, 84, 3),
    ('30/30/20/20', 'Sinal',              30.000, 0,  0),
    ('30/30/20/20', '28 dias',            30.000, 28, 1),
    ('30/30/20/20', '56 dias',            20.000, 56, 2),
    ('30/30/20/20', '84 dias',            20.000, 84, 3)
) AS i(preset_name, description, percentage, days, sort_order) ON i.preset_name = p.name;
