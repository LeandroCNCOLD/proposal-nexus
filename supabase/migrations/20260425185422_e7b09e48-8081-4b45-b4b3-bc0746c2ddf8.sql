ALTER TABLE public.coldpro_environments
ADD COLUMN IF NOT EXISTS door_open_seconds_per_opening numeric NOT NULL DEFAULT 60,
ADD COLUMN IF NOT EXISTS door_operation_profile text NOT NULL DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS door_protection_type text NOT NULL DEFAULT 'none',
ADD COLUMN IF NOT EXISTS climate_region text NOT NULL DEFAULT 'sp_capital_abcd',
ADD COLUMN IF NOT EXISTS motors_dissipation_factor numeric NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS evaporator_temp_c numeric NOT NULL DEFAULT -31,
ADD COLUMN IF NOT EXISTS defrost_loss_factor numeric NOT NULL DEFAULT 1.25;