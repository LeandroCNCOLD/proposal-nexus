ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS engine_version TEXT,
ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMPTZ;