
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM (
  'vendedor', 'gerente_comercial', 'engenharia',
  'orcamentista', 'diretoria', 'administrativo', 'admin'
);

CREATE TYPE public.proposal_status AS ENUM (
  'rascunho', 'em_elaboracao', 'em_revisao_tecnica', 'em_revisao_comercial',
  'em_revisao_financeira', 'aguardando_aprovacao', 'pronta_para_envio',
  'enviada', 'visualizada', 'aguardando_retorno', 'em_negociacao',
  'revisao_solicitada', 'reenviada', 'ganha', 'perdida', 'vencida',
  'prorrogada', 'cancelada'
);

CREATE TYPE public.proposal_temperature AS ENUM ('fria', 'morna', 'quente', 'muito_quente');

CREATE TYPE public.timeline_event_type AS ENUM (
  'criada', 'revisada', 'aprovada', 'enviada', 'visualizada_cliente',
  'follow_up', 'reuniao', 'visita_tecnica', 'revisao_solicitada',
  'concorrente_identificado', 'renegociada', 'ganha', 'perdida',
  'vencida', 'prorrogada', 'observacao', 'tarefa_concluida'
);

CREATE TYPE public.task_priority AS ENUM ('baixa', 'media', 'alta', 'critica');
CREATE TYPE public.task_status AS ENUM ('pendente', 'em_andamento', 'concluida', 'cancelada');

-- =========================================================
-- PROFILES + ROLES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  job_title TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  -- default role: vendedor
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'vendedor');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- CLIENTS
-- =========================================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trade_name TEXT,
  document TEXT,
  segment TEXT,
  region TEXT,
  city TEXT,
  state TEXT,
  origin TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- COMPETITORS
-- =========================================================
CREATE TABLE public.competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  region TEXT,
  strong_segments TEXT[],
  competitive_lines TEXT[],
  price_positioning TEXT,
  perceived_lead_time TEXT,
  perceived_strengths TEXT,
  perceived_weaknesses TEXT,
  strategic_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- EQUIPMENTS
-- =========================================================
CREATE TABLE public.equipment_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  family TEXT,
  description TEXT,
  application TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.equipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID REFERENCES public.equipment_lines(id),
  model TEXT NOT NULL,
  cabinet TEXT,
  cabinet_type TEXT,
  application TEXT,
  refrigerant TEXT,
  compressor_copeland TEXT,
  compressor_bitzer TEXT,
  compressor_danfoss_bock TEXT,
  compressor_dorin TEXT,
  condenser_model TEXT,
  condenser_fan TEXT,
  condenser_fan_flow NUMERIC,
  evaporator_model TEXT,
  evaporator_fan TEXT,
  evaporator_fan_flow NUMERIC,
  voltage TEXT,
  tags TEXT[],
  technical_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_equipments_line ON public.equipments(line_id);
CREATE INDEX idx_equipments_model ON public.equipments(model);

CREATE TABLE public.equipment_performance_curves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  chamber_temperature NUMERIC,
  chamber_humidity NUMERIC,
  evaporation_temperature NUMERIC,
  condensation_temperature NUMERIC,
  cooling_capacity NUMERIC,
  rejected_heat NUMERIC,
  application TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_curves_equipment ON public.equipment_performance_curves(equipment_id);

-- =========================================================
-- PROPOSALS
-- =========================================================
CREATE SEQUENCE public.proposal_number_seq START 1000;

CREATE TABLE public.proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE DEFAULT ('PROP-' || nextval('public.proposal_number_seq')::TEXT),
  title TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id),
  contact_id UUID REFERENCES public.client_contacts(id),
  segment TEXT,
  region TEXT,
  lead_origin TEXT,
  sales_owner_id UUID REFERENCES auth.users(id),
  technical_owner_id UUID REFERENCES auth.users(id),
  status public.proposal_status NOT NULL DEFAULT 'rascunho',
  temperature public.proposal_temperature DEFAULT 'morna',
  win_probability INTEGER CHECK (win_probability BETWEEN 0 AND 100),
  total_value NUMERIC(14,2) DEFAULT 0,
  discount NUMERIC(14,2) DEFAULT 0,
  estimated_margin NUMERIC(5,2),
  payment_terms TEXT,
  delivery_term TEXT,
  sent_at TIMESTAMPTZ,
  valid_until DATE,
  next_followup_at DATE,
  closed_at TIMESTAMPTZ,
  closed_value NUMERIC(14,2),
  loss_reason TEXT,
  win_reason TEXT,
  commercial_notes TEXT,
  technical_notes TEXT,
  current_version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposals_status ON public.proposals(status);
CREATE INDEX idx_proposals_client ON public.proposals(client_id);
CREATE INDEX idx_proposals_sales_owner ON public.proposals(sales_owner_id);
CREATE INDEX idx_proposals_created_at ON public.proposals(created_at DESC);

CREATE TABLE public.proposal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES public.equipments(id),
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  notes TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_items_proposal ON public.proposal_items(proposal_id);

CREATE TABLE public.proposal_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  reason TEXT,
  snapshot JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(proposal_id, version_number)
);

CREATE TABLE public.proposal_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  event_type public.timeline_event_type NOT NULL,
  description TEXT,
  next_step TEXT,
  next_contact_date DATE,
  user_id UUID REFERENCES auth.users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_timeline_proposal ON public.proposal_timeline_events(proposal_id, created_at DESC);

CREATE TABLE public.proposal_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES auth.users(id),
  due_date DATE,
  priority public.task_priority NOT NULL DEFAULT 'media',
  status public.task_status NOT NULL DEFAULT 'pendente',
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_assignee ON public.proposal_tasks(assignee_id, status);
CREATE INDEX idx_tasks_due ON public.proposal_tasks(due_date);

CREATE TABLE public.proposal_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES public.competitors(id),
  competitor_price NUMERIC(14,2),
  competitor_lead_time TEXT,
  competitor_warranty TEXT,
  competitor_solution TEXT,
  competitor_payment_terms TEXT,
  differentials TEXT,
  outcome TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(proposal_id, competitor_id)
);

CREATE TABLE public.proposal_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  from_status public.proposal_status,
  to_status public.proposal_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_status_history_proposal ON public.proposal_status_history(proposal_id, created_at DESC);

-- Trigger: auto-log status changes
CREATE OR REPLACE FUNCTION public.log_proposal_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.proposal_status_history (proposal_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_proposal_status
  AFTER UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.log_proposal_status_change();

-- Generic updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_competitors_updated BEFORE UPDATE ON public.competitors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_equipments_updated BEFORE UPDATE ON public.equipments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_proposals_updated BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.proposal_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- DOCUMENTS + AI INSIGHTS + AUDIT
-- =========================================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
  competitor_id UUID REFERENCES public.competitors(id) ON DELETE SET NULL,
  equipment_id UUID REFERENCES public.equipments(id) ON DELETE SET NULL,
  extracted_text TEXT,
  metadata JSONB,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  prompt_hash TEXT,
  content TEXT NOT NULL,
  metadata JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_insights_proposal ON public.ai_insights(proposal_id, insight_type);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON public.audit_logs(entity_type, entity_id);

-- =========================================================
-- ENABLE RLS
-- =========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_performance_curves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- POLICIES
-- =========================================================
-- profiles
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- user_roles
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- clients (todos autenticados leem; vendedor+ cria; gerente/admin atualiza/deleta)
CREATE POLICY "clients_select" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_insert" ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "clients_update" ON public.clients FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['gerente_comercial','diretoria','admin']::public.app_role[]));
CREATE POLICY "clients_delete" ON public.clients FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['gerente_comercial','diretoria','admin']::public.app_role[]));

-- client_contacts
CREATE POLICY "contacts_select" ON public.client_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "contacts_modify" ON public.client_contacts FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- competitors
CREATE POLICY "competitors_select" ON public.competitors FOR SELECT TO authenticated USING (true);
CREATE POLICY "competitors_modify" ON public.competitors FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['gerente_comercial','diretoria','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['gerente_comercial','diretoria','admin']::public.app_role[]));

-- equipment_lines
CREATE POLICY "lines_select" ON public.equipment_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "lines_modify" ON public.equipment_lines FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['engenharia','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['engenharia','admin']::public.app_role[]));

-- equipments
CREATE POLICY "equipments_select" ON public.equipments FOR SELECT TO authenticated USING (true);
CREATE POLICY "equipments_modify" ON public.equipments FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['engenharia','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['engenharia','admin']::public.app_role[]));

-- equipment_performance_curves
CREATE POLICY "curves_select" ON public.equipment_performance_curves FOR SELECT TO authenticated USING (true);
CREATE POLICY "curves_modify" ON public.equipment_performance_curves FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['engenharia','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['engenharia','admin']::public.app_role[]));

-- proposals: dono ou gerente/diretoria/admin/orcamentista
CREATE POLICY "proposals_select" ON public.proposals FOR SELECT TO authenticated
  USING (
    sales_owner_id = auth.uid()
    OR technical_owner_id = auth.uid()
    OR created_by = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['gerente_comercial','diretoria','admin','orcamentista']::public.app_role[])
  );
CREATE POLICY "proposals_insert" ON public.proposals FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "proposals_update" ON public.proposals FOR UPDATE TO authenticated
  USING (
    sales_owner_id = auth.uid() OR technical_owner_id = auth.uid() OR created_by = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['gerente_comercial','diretoria','admin']::public.app_role[])
  );
CREATE POLICY "proposals_delete" ON public.proposals FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['gerente_comercial','diretoria','admin']::public.app_role[]));

-- proposal_items / versions / timeline / status_history / competitors: visível se a proposta for visível
CREATE POLICY "items_all" ON public.proposal_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id))
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "versions_all" ON public.proposal_versions FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "timeline_all" ON public.proposal_timeline_events FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "status_history_select" ON public.proposal_status_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "status_history_insert" ON public.proposal_status_history FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "prop_competitors_all" ON public.proposal_competitors FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- tasks
CREATE POLICY "tasks_select" ON public.proposal_tasks FOR SELECT TO authenticated
  USING (assignee_id = auth.uid() OR created_by = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['gerente_comercial','diretoria','admin']::public.app_role[]));
CREATE POLICY "tasks_insert" ON public.proposal_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tasks_update" ON public.proposal_tasks FOR UPDATE TO authenticated
  USING (assignee_id = auth.uid() OR created_by = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['gerente_comercial','diretoria','admin']::public.app_role[]));
CREATE POLICY "tasks_delete" ON public.proposal_tasks FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['gerente_comercial','diretoria','admin']::public.app_role[]));

-- documents
CREATE POLICY "documents_select" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "documents_insert" ON public.documents FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "documents_modify" ON public.documents FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "documents_delete" ON public.documents FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ai_insights
CREATE POLICY "insights_select" ON public.ai_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "insights_insert" ON public.ai_insights FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- audit_logs (admin/diretoria leem)
CREATE POLICY "audit_select" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['diretoria','admin']::public.app_role[]));
CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- =========================================================
-- SEEDS: equipment_lines + competitors
-- =========================================================
INSERT INTO public.equipment_lines (code, name, family, application) VALUES
  ('HT', 'High Temperature', 'Refrigeração', 'Câmaras de alta temperatura'),
  ('MT', 'Medium Temperature', 'Refrigeração', 'Câmaras de média temperatura'),
  ('LT', 'Low Temperature', 'Refrigeração', 'Câmaras de baixa temperatura'),
  ('BF', 'Blast Freezer', 'Congelamento', 'Congelamento rápido'),
  ('LT_MAX', 'LT Max', 'Refrigeração', 'Baixa temperatura reforçada'),
  ('AGRO', 'Agro', 'Agroindustrial', 'Aplicações agroindustriais'),
  ('AGRO_INV', 'Agro Inverter', 'Agroindustrial', 'Agro com inverter'),
  ('DUPLO_SP', 'Duplo Setpoint', 'Especial', 'Operação dual-temperatura'),
  ('BLAST_CHILL', 'Blast Chilling', 'Resfriamento', 'Resfriamento rápido'),
  ('COMPACT_MT_UC', 'COMPACTice MT UC', 'Compacto', 'MT compacto unidade condensadora'),
  ('COMPACT_LT_UC', 'COMPACTice LT UC', 'Compacto', 'LT compacto unidade condensadora'),
  ('COMPACT_MT_UE', 'COMPACTice MT UE', 'Compacto', 'MT compacto unidade evaporadora'),
  ('HH', 'High Humidity', 'Especial', 'Alta umidade'),
  ('DH', 'Dehumidifier', 'Especial', 'Desumidificação'),
  ('BOOSTER', 'Booster', 'Especial', 'Sistema booster')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.competitors (name, region, price_positioning) VALUES
  ('Plotter Frio', 'Sul', 'Médio'),
  ('Mebrafe', 'Nacional', 'Médio-Alto'),
  ('Refrio', 'Nacional', 'Médio'),
  ('Buffalo', 'Nacional', 'Premium')
ON CONFLICT DO NOTHING;
