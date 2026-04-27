DROP POLICY IF EXISTS coldpro_materials_authenticated_access ON public.coldpro_materials;
DROP POLICY IF EXISTS coldpro_surfaces_authenticated_access ON public.coldpro_surfaces;
DROP POLICY IF EXISTS coldpro_wall_compositions_authenticated_access ON public.coldpro_wall_compositions;
DROP POLICY IF EXISTS coldpro_process_parameters_authenticated_access ON public.coldpro_process_parameters;
DROP POLICY IF EXISTS coldpro_infiltration_authenticated_access ON public.coldpro_infiltration;
DROP POLICY IF EXISTS coldpro_internal_loads_authenticated_access ON public.coldpro_internal_loads;
DROP POLICY IF EXISTS coldpro_reports_authenticated_access ON public.coldpro_reports;

CREATE POLICY coldpro_materials_read_authenticated ON public.coldpro_materials FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY coldpro_materials_write_authenticated ON public.coldpro_materials FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY coldpro_materials_update_authenticated ON public.coldpro_materials FOR UPDATE TO authenticated USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY coldpro_materials_delete_authenticated ON public.coldpro_materials FOR DELETE TO authenticated USING (auth.role() = 'authenticated');

CREATE POLICY coldpro_surfaces_read_authenticated ON public.coldpro_surfaces FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY coldpro_surfaces_write_authenticated ON public.coldpro_surfaces FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY coldpro_surfaces_update_authenticated ON public.coldpro_surfaces FOR UPDATE TO authenticated USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY coldpro_surfaces_delete_authenticated ON public.coldpro_surfaces FOR DELETE TO authenticated USING (auth.role() = 'authenticated');

CREATE POLICY coldpro_wall_compositions_read_authenticated ON public.coldpro_wall_compositions FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY coldpro_wall_compositions_write_authenticated ON public.coldpro_wall_compositions FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY coldpro_wall_compositions_update_authenticated ON public.coldpro_wall_compositions FOR UPDATE TO authenticated USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY coldpro_wall_compositions_delete_authenticated ON public.coldpro_wall_compositions FOR DELETE TO authenticated USING (auth.role() = 'authenticated');

CREATE POLICY coldpro_process_parameters_read_authenticated ON public.coldpro_process_parameters FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY coldpro_process_parameters_write_authenticated ON public.coldpro_process_parameters FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY coldpro_process_parameters_update_authenticated ON public.coldpro_process_parameters FOR UPDATE TO authenticated USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY coldpro_process_parameters_delete_authenticated ON public.coldpro_process_parameters FOR DELETE TO authenticated USING (auth.role() = 'authenticated');

CREATE POLICY coldpro_infiltration_read_authenticated ON public.coldpro_infiltration FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY coldpro_infiltration_write_authenticated ON public.coldpro_infiltration FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY coldpro_infiltration_update_authenticated ON public.coldpro_infiltration FOR UPDATE TO authenticated USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY coldpro_infiltration_delete_authenticated ON public.coldpro_infiltration FOR DELETE TO authenticated USING (auth.role() = 'authenticated');

CREATE POLICY coldpro_internal_loads_read_authenticated ON public.coldpro_internal_loads FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY coldpro_internal_loads_write_authenticated ON public.coldpro_internal_loads FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY coldpro_internal_loads_update_authenticated ON public.coldpro_internal_loads FOR UPDATE TO authenticated USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY coldpro_internal_loads_delete_authenticated ON public.coldpro_internal_loads FOR DELETE TO authenticated USING (auth.role() = 'authenticated');

CREATE POLICY coldpro_reports_read_authenticated ON public.coldpro_reports FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY coldpro_reports_write_authenticated ON public.coldpro_reports FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY coldpro_reports_update_authenticated ON public.coldpro_reports FOR UPDATE TO authenticated USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY coldpro_reports_delete_authenticated ON public.coldpro_reports FOR DELETE TO authenticated USING (auth.role() = 'authenticated');