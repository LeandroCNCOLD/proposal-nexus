ALTER TABLE public.coldpro_environments
ADD COLUMN IF NOT EXISTS external_relative_humidity_percent numeric,
ADD COLUMN IF NOT EXISTS atmospheric_pressure_kpa numeric,
ADD COLUMN IF NOT EXISTS dimension_a_m numeric,
ADD COLUMN IF NOT EXISTS dimension_b_m numeric,
ADD COLUMN IF NOT EXISTS dimension_c_m numeric,
ADD COLUMN IF NOT EXISTS dimension_d_m numeric,
ADD COLUMN IF NOT EXISTS dimension_e_m numeric,
ADD COLUMN IF NOT EXISTS dimension_f_m numeric;