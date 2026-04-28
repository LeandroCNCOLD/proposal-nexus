ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coldpro';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS access_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS nomus_user_id text,
  ADD COLUMN IF NOT EXISTS blocked_reason text;

CREATE INDEX IF NOT EXISTS idx_profiles_access_status ON public.profiles(access_status);
CREATE INDEX IF NOT EXISTS idx_profiles_access_source ON public.profiles(access_source);
CREATE INDEX IF NOT EXISTS idx_profiles_nomus_user_id ON public.profiles(nomus_user_id);

CREATE OR REPLACE FUNCTION public.can_manage_user_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(_user_id, ARRAY['admin'::public.app_role, 'gerente_comercial'::public.app_role, 'diretoria'::public.app_role])
$$;

DROP POLICY IF EXISTS "profiles_manage_access" ON public.profiles;
CREATE POLICY "profiles_manage_access"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.can_manage_user_access(auth.uid()))
WITH CHECK (public.can_manage_user_access(auth.uid()));

DROP POLICY IF EXISTS "user_roles_select_own_or_admin" ON public.user_roles;
CREATE POLICY "user_roles_select_own_or_manager"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.can_manage_user_access(auth.uid()));

DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;
CREATE POLICY "user_roles_manager_all"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.can_manage_user_access(auth.uid()))
WITH CHECK (public.can_manage_user_access(auth.uid()));