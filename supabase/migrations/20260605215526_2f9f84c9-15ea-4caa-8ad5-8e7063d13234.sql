
CREATE OR REPLACE FUNCTION public.get_team_members_by_role(_role app_role)
RETURNS TABLE(user_id uuid, full_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = _role
  ORDER BY p.full_name NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_members_by_role(app_role) TO authenticated;
