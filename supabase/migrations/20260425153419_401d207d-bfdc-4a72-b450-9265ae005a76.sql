DROP POLICY IF EXISTS "Authenticated users can view ColdPro advanced processes" ON public.coldpro_advanced_processes;
DROP POLICY IF EXISTS "Authenticated users can create ColdPro advanced processes" ON public.coldpro_advanced_processes;
DROP POLICY IF EXISTS "Authenticated users can update ColdPro advanced processes" ON public.coldpro_advanced_processes;
DROP POLICY IF EXISTS "Authenticated users can delete ColdPro advanced processes" ON public.coldpro_advanced_processes;

CREATE POLICY "Users can view advanced processes for existing projects"
ON public.coldpro_advanced_processes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.coldpro_projects p
    WHERE p.id = coldpro_advanced_processes.project_id
  )
);

CREATE POLICY "Users can create advanced processes for existing projects"
ON public.coldpro_advanced_processes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.coldpro_projects p
    WHERE p.id = coldpro_advanced_processes.project_id
  )
);

CREATE POLICY "Users can update advanced processes for existing projects"
ON public.coldpro_advanced_processes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.coldpro_projects p
    WHERE p.id = coldpro_advanced_processes.project_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.coldpro_projects p
    WHERE p.id = coldpro_advanced_processes.project_id
  )
);

CREATE POLICY "Users can delete advanced processes for existing projects"
ON public.coldpro_advanced_processes
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.coldpro_projects p
    WHERE p.id = coldpro_advanced_processes.project_id
  )
);