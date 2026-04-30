ALTER TABLE public.nomus_price_tables
ADD COLUMN IF NOT EXISTS ufs text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_nomus_price_tables_ufs
ON public.nomus_price_tables USING gin (ufs);