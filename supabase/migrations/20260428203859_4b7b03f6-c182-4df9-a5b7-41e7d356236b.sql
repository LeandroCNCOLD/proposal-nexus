ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_must_change_password
ON public.profiles(must_change_password);

DROP POLICY IF EXISTS "profiles_users_clear_own_password_change" ON public.profiles;
CREATE POLICY "profiles_users_clear_own_password_change"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());