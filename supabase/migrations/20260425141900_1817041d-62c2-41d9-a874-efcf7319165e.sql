ALTER TABLE public.coldpro_environment_products
  ADD COLUMN IF NOT EXISTS product_load_mode text NOT NULL DEFAULT 'daily_intake',
  ADD COLUMN IF NOT EXISTS stored_mass_kg numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_turnover_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_movement_kg numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hourly_movement_kg numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovery_time_h numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_freezing_inside_storage_room boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS freezing_batch_mass_kg numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freezing_batch_time_h numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS movement_basis text NOT NULL DEFAULT 'manual_daily';

UPDATE public.coldpro_environment_products
SET
  daily_movement_kg = CASE WHEN COALESCE(daily_movement_kg, 0) <= 0 THEN COALESCE(mass_kg_day, 0) ELSE daily_movement_kg END,
  hourly_movement_kg = CASE WHEN COALESCE(hourly_movement_kg, 0) <= 0 THEN COALESCE(mass_kg_hour, 0) ELSE hourly_movement_kg END,
  recovery_time_h = CASE WHEN COALESCE(recovery_time_h, 0) <= 0 THEN COALESCE(NULLIF(process_time_h, 0), 24) ELSE recovery_time_h END,
  product_load_mode = CASE
    WHEN COALESCE(mass_kg_hour, 0) > 0 AND COALESCE(mass_kg_day, 0) <= 0 THEN 'hourly_intake'
    ELSE 'daily_intake'
  END,
  movement_basis = CASE
    WHEN COALESCE(mass_kg_hour, 0) > 0 AND COALESCE(mass_kg_day, 0) <= 0 THEN 'manual_hourly'
    ELSE 'manual_daily'
  END
WHERE product_load_mode IS NULL OR product_load_mode = 'daily_intake';

CREATE INDEX IF NOT EXISTS idx_coldpro_environment_products_load_mode ON public.coldpro_environment_products(product_load_mode);