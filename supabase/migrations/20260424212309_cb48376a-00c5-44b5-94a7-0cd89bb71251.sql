ALTER TABLE public.coldpro_equipment_models
ADD COLUMN IF NOT EXISTS electrical_configuration text,
ADD COLUMN IF NOT EXISTS voltage_value_v integer,
ADD COLUMN IF NOT EXISTS phase_count integer,
ADD COLUMN IF NOT EXISTS frequency_hz integer,
ADD COLUMN IF NOT EXISTS catalog_variant_key text;

WITH electrical_summary AS (
  SELECT
    equipment_model_id,
    min(voltage) FILTER (WHERE voltage IS NOT NULL AND btrim(voltage) <> '') AS voltage,
    min(NULLIF(substring(voltage from '(\d+)\s*v'), '')::integer) FILTER (WHERE voltage IS NOT NULL AND voltage ~* '\d+\s*v') AS voltage_value_v,
    min(NULLIF(substring(voltage from '(\d+)\s*f'), '')::integer) FILTER (WHERE voltage IS NOT NULL AND voltage ~* '\d+\s*f') AS phase_count,
    min(NULLIF(substring(voltage from '(\d+)\s*hz'), '')::integer) FILTER (WHERE voltage IS NOT NULL AND voltage ~* '\d+\s*hz') AS frequency_hz
  FROM public.coldpro_equipment_performance_points
  GROUP BY equipment_model_id
)
UPDATE public.coldpro_equipment_models m
SET
  electrical_configuration = COALESCE(m.electrical_configuration, e.voltage),
  voltage_value_v = COALESCE(m.voltage_value_v, e.voltage_value_v),
  phase_count = COALESCE(m.phase_count, e.phase_count),
  frequency_hz = COALESCE(m.frequency_hz, e.frequency_hz),
  catalog_variant_key = COALESCE(
    m.catalog_variant_key,
    concat_ws('|',
      upper(btrim(m.modelo)),
      upper(btrim(COALESCE(m.refrigerante, ''))),
      upper(btrim(COALESCE(m.gabinete, ''))),
      upper(btrim(COALESCE(e.voltage, 'SEM TENSAO')))
    )
  )
FROM electrical_summary e
WHERE e.equipment_model_id = m.id;

UPDATE public.coldpro_equipment_models m
SET catalog_variant_key = COALESCE(
  catalog_variant_key,
  concat_ws('|',
    upper(btrim(modelo)),
    upper(btrim(COALESCE(refrigerante, ''))),
    upper(btrim(COALESCE(gabinete, ''))),
    upper(btrim(COALESCE(electrical_configuration, 'SEM TENSAO')))
  )
)
WHERE catalog_variant_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS coldpro_equipment_models_catalog_variant_key_idx
ON public.coldpro_equipment_models (catalog_variant_key)
WHERE catalog_variant_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS coldpro_equipment_models_electrical_idx
ON public.coldpro_equipment_models (voltage_value_v, phase_count, frequency_hz);