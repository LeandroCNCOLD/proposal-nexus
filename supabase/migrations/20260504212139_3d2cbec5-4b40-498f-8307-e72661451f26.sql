CREATE TABLE IF NOT EXISTS public.coldpro_climate_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ibge_code text NOT NULL UNIQUE,
  city_name text NOT NULL,
  state_code text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  temperatures_monthly jsonb NOT NULL,
  humidity_monthly jsonb NOT NULL,
  temp_max_c real NOT NULL,
  temp_min_c real NOT NULL,
  temp_avg_c real NOT NULL,
  humidity_avg_pct smallint NOT NULL,
  data_source text NOT NULL DEFAULT 'open-meteo-era5',
  data_period_start date,
  data_period_end date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_climate_cache_ibge ON public.coldpro_climate_cache (ibge_code);
CREATE INDEX IF NOT EXISTS idx_climate_cache_state ON public.coldpro_climate_cache (state_code);
CREATE INDEX IF NOT EXISTS idx_climate_cache_city ON public.coldpro_climate_cache USING gin (to_tsvector('portuguese', city_name));

CREATE OR REPLACE FUNCTION public.update_climate_cache_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_climate_cache_updated_at ON public.coldpro_climate_cache;
CREATE TRIGGER trg_climate_cache_updated_at
  BEFORE UPDATE ON public.coldpro_climate_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_climate_cache_updated_at();

ALTER TABLE public.coldpro_climate_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "climate_cache_select_all" ON public.coldpro_climate_cache;
CREATE POLICY "climate_cache_select_all" ON public.coldpro_climate_cache FOR SELECT USING (true);

DROP POLICY IF EXISTS "climate_cache_insert_authenticated" ON public.coldpro_climate_cache;
CREATE POLICY "climate_cache_insert_authenticated" ON public.coldpro_climate_cache FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "climate_cache_update_authenticated" ON public.coldpro_climate_cache;
CREATE POLICY "climate_cache_update_authenticated" ON public.coldpro_climate_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);