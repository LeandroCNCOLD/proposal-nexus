ALTER TABLE public.coldpro_advanced_processes
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.coldpro_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coldpro_advanced_processes_product_id
ON public.coldpro_advanced_processes(product_id);