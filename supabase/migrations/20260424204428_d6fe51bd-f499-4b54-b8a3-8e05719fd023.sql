CREATE OR REPLACE FUNCTION public.coldpro_to_numeric_from_raw(_value text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _value IS NULL OR btrim(_value) = '' OR btrim(_value) IN ('-', '—') THEN NULL
    ELSE NULLIF(
      replace(
        regexp_replace(_value, '[^0-9,\.\-]', '', 'g'),
        ',',
        '.'
      ),
      ''
    )::numeric
  END
$$;

UPDATE public.coldpro_equipment_performance_points
SET
  voltage = COALESCE(voltage, raw->>'TENSÃO ELÉTRICA [v]'),
  compressor_power_kw = COALESCE(
    compressor_power_kw,
    public.coldpro_to_numeric_from_raw(raw->>'POTÊNCIA ELÉTRICA REQUERIDA COMPRESSOR (kW)')
  ),
  fan_power_kw = COALESCE(
    fan_power_kw,
    public.coldpro_to_numeric_from_raw(raw->>'POTÊNCIA ELÉTRICA REQUERIDA VENTILADOR (kW)')
  ),
  total_power_kw = COALESCE(
    total_power_kw,
    public.coldpro_to_numeric_from_raw(raw->>'POTÊNCIA ELÉTRICA REQUERIDA TOTAL [CIRCUITO COMPLETO] (kW)'),
    public.coldpro_to_numeric_from_raw(raw->>'POTÊNCIA ELÉTRICA REQUERIDA TOTAL (kW)')
  ),
  compressor_current_a = COALESCE(
    compressor_current_a,
    public.coldpro_to_numeric_from_raw(raw->>'CORRENTE ELÉTRICA COMPRESSOR (A)')
  ),
  fan_current_a = COALESCE(
    fan_current_a,
    public.coldpro_to_numeric_from_raw(raw->>'CORRENTE ELÉTRICA VENTILADORES (A)')
  ),
  estimated_current_a = COALESCE(
    estimated_current_a,
    public.coldpro_to_numeric_from_raw(raw->>'CORRENTE ELÉTRICA ESTIMADA [CIRCUITO COMPLETO] (A)'),
    public.coldpro_to_numeric_from_raw(raw->>'CORRENTE ELÉTRICA ESTIMADA (A)')
  ),
  starting_current_a = COALESCE(
    starting_current_a,
    public.coldpro_to_numeric_from_raw(raw->>'CORRENTE ELÉTRICA DE PARTIDA [CIRCUITO COMPLETO] (A)'),
    public.coldpro_to_numeric_from_raw(raw->>'CORRENTE ELÉTRICA DE PARTIDA (A)')
  )
WHERE raw IS NOT NULL;

DROP FUNCTION public.coldpro_to_numeric_from_raw(text);