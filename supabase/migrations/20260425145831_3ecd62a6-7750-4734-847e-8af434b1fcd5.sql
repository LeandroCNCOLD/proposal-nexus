ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS air_delta_t_k numeric NOT NULL DEFAULT 6,
ADD COLUMN IF NOT EXISTS min_air_temp_c numeric NOT NULL DEFAULT -40,
ADD COLUMN IF NOT EXISTS max_air_temp_c numeric NOT NULL DEFAULT -25,
ADD COLUMN IF NOT EXISTS min_air_velocity_m_s numeric NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_air_velocity_m_s numeric NOT NULL DEFAULT 6,
ADD COLUMN IF NOT EXISTS air_temp_step_c numeric NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS air_velocity_step_m_s numeric NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS recommended_air_temp_c numeric,
ADD COLUMN IF NOT EXISTS recommended_air_velocity_m_s numeric,
ADD COLUMN IF NOT EXISTS optimization_status text,
ADD COLUMN IF NOT EXISTS optimization_margin_percent numeric,
ADD COLUMN IF NOT EXISTS optimization_attempts_count integer,
ADD COLUMN IF NOT EXISTS optimization_memory jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_coldpro_tunnels_optimization_status
ON public.coldpro_tunnels(optimization_status);