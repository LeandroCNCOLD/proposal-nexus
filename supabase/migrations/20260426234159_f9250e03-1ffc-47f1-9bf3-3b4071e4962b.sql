ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS static_mass_mode TEXT DEFAULT 'direct_pallet_mass';

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS units_per_box NUMERIC;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS boxes_per_layer NUMERIC;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS number_of_layers NUMERIC;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS total_units_per_pallet NUMERIC;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS box_packaging_weight_kg NUMERIC;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS pallet_base_weight_kg NUMERIC;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS units_per_pallet NUMERIC;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS product_mass_per_pallet_kg NUMERIC;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS packaging_mass_per_pallet_kg NUMERIC;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS calculated_pallet_mass_kg NUMERIC;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS static_mass_kg NUMERIC;