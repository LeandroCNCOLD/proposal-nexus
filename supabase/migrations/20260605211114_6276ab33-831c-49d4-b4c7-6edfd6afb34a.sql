
-- 1. Templates de perfil (role -> permission_key)
CREATE TABLE public.role_permission_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permission_templates TO authenticated;
GRANT ALL ON public.role_permission_templates TO service_role;

ALTER TABLE public.role_permission_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read role templates"
ON public.role_permission_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage role templates"
ON public.role_permission_templates FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role]));

-- 2. Overrides por usuário
CREATE TABLE public.user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  effect text NOT NULL CHECK (effect IN ('grant', 'revoke')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permission_overrides TO authenticated;
GRANT ALL ON public.user_permission_overrides TO service_role;

ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own overrides"
ON public.user_permission_overrides FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role]));

CREATE POLICY "Managers manage overrides"
ON public.user_permission_overrides FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role]));

-- 3. Funções de checagem
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH from_roles AS (
    SELECT rpt.permission_key
    FROM public.user_roles ur
    JOIN public.role_permission_templates rpt ON rpt.role = ur.role
    WHERE ur.user_id = _user_id
  ),
  granted AS (
    SELECT permission_key FROM public.user_permission_overrides
    WHERE user_id = _user_id AND effect = 'grant'
  ),
  revoked AS (
    SELECT permission_key FROM public.user_permission_overrides
    WHERE user_id = _user_id AND effect = 'revoke'
  )
  SELECT permission_key FROM (
    SELECT permission_key FROM from_roles
    UNION
    SELECT permission_key FROM granted
  ) all_perms
  WHERE permission_key NOT IN (SELECT permission_key FROM revoked);
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.get_user_permissions(_user_id) p WHERE p = _permission_key)
$$;

-- 4. Seed inicial de templates
-- Admin e diretoria: todas as permissões
INSERT INTO public.role_permission_templates (role, permission_key) VALUES
-- admin / diretoria (tudo)
('admin', 'sdr.bank.view'), ('admin', 'sdr.bank.lock'), ('admin', 'sdr.bank.freeze'), ('admin', 'sdr.bank.assign'),
('admin', 'crm.view'), ('admin', 'crm.edit'), ('admin', 'crm.delete'),
('admin', 'proposals.view'), ('admin', 'proposals.create'), ('admin', 'proposals.edit'), ('admin', 'proposals.approve'), ('admin', 'proposals.delete'),
('admin', 'coldpro.view'), ('admin', 'coldpro.edit'),
('admin', 'nomus.view'), ('admin', 'nomus.sync'),
('admin', 'configuracoes.view'), ('admin', 'configuracoes.users.manage'), ('admin', 'configuracoes.permissions.manage'),
('diretoria', 'sdr.bank.view'), ('diretoria', 'sdr.bank.lock'), ('diretoria', 'sdr.bank.freeze'), ('diretoria', 'sdr.bank.assign'),
('diretoria', 'crm.view'), ('diretoria', 'crm.edit'), ('diretoria', 'crm.delete'),
('diretoria', 'proposals.view'), ('diretoria', 'proposals.create'), ('diretoria', 'proposals.edit'), ('diretoria', 'proposals.approve'), ('diretoria', 'proposals.delete'),
('diretoria', 'coldpro.view'), ('diretoria', 'coldpro.edit'),
('diretoria', 'nomus.view'), ('diretoria', 'nomus.sync'),
('diretoria', 'configuracoes.view'), ('diretoria', 'configuracoes.users.manage'), ('diretoria', 'configuracoes.permissions.manage'),
-- gerente comercial
('gerente_comercial', 'sdr.bank.view'), ('gerente_comercial', 'sdr.bank.lock'), ('gerente_comercial', 'sdr.bank.freeze'), ('gerente_comercial', 'sdr.bank.assign'),
('gerente_comercial', 'crm.view'), ('gerente_comercial', 'crm.edit'),
('gerente_comercial', 'proposals.view'), ('gerente_comercial', 'proposals.create'), ('gerente_comercial', 'proposals.edit'), ('gerente_comercial', 'proposals.approve'),
('gerente_comercial', 'coldpro.view'),
('gerente_comercial', 'nomus.view'),
('gerente_comercial', 'configuracoes.view'), ('gerente_comercial', 'configuracoes.users.manage'),
-- vendedor
('vendedor', 'sdr.bank.view'), ('vendedor', 'sdr.bank.lock'),
('vendedor', 'crm.view'), ('vendedor', 'crm.edit'),
('vendedor', 'proposals.view'), ('vendedor', 'proposals.create'), ('vendedor', 'proposals.edit'),
('vendedor', 'coldpro.view'),
('vendedor', 'nomus.view'),
-- sdr
('sdr', 'sdr.bank.view'), ('sdr', 'sdr.bank.lock'),
('sdr', 'crm.view'), ('sdr', 'crm.edit'),
-- orcamentista
('orcamentista', 'proposals.view'), ('orcamentista', 'proposals.create'), ('orcamentista', 'proposals.edit'),
('orcamentista', 'coldpro.view'), ('orcamentista', 'coldpro.edit'),
('orcamentista', 'crm.view')
ON CONFLICT (role, permission_key) DO NOTHING;
