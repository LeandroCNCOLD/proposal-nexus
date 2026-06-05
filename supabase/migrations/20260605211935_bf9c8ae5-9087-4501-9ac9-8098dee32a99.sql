GRANT SELECT, INSERT, UPDATE, DELETE ON public.sdr_leads TO authenticated;
GRANT ALL ON public.sdr_leads TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_call_logs TO authenticated;
GRANT ALL ON public.crm_call_logs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_weekly_reviews TO authenticated;
GRANT ALL ON public.crm_weekly_reviews TO service_role;