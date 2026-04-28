REVOKE ALL ON FUNCTION public.can_manage_user_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_user_access(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_manage_user_access(uuid) TO authenticated;