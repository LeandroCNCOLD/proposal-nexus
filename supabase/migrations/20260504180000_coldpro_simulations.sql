-- ============================================================
-- ColdPro: Tabela de Simulações Dinâmicas
-- Armazena resultados de simulação por intervalo de tempo,
-- versionados por ambiente e vinculados ao resultado estático.
-- ============================================================

-- Tabela principal de simulações
CREATE TABLE IF NOT EXISTS public.coldpro_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid NOT NULL REFERENCES public.coldpro_environments(id) ON DELETE CASCADE,
  result_id uuid REFERENCES public.coldpro_results(id) ON DELETE SET NULL,
  -- Identificação e versionamento
  name text NOT NULL DEFAULT 'Simulação',
  version integer NOT NULL DEFAULT 1,
  is_latest boolean NOT NULL DEFAULT true,
  -- Configuração da simulação
  weather_profile text NOT NULL DEFAULT 'hot_day',
  simulation_period_days integer NOT NULL DEFAULT 1,
  time_step_minutes integer NOT NULL DEFAULT 15,
  setpoint_c numeric NOT NULL DEFAULT 0,
  differential_c numeric NOT NULL DEFAULT 1,
  -- Resultados agregados (KPIs)
  max_internal_temp_c numeric,
  min_internal_temp_c numeric,
  avg_internal_temp_c numeric,
  hours_above_setpoint numeric NOT NULL DEFAULT 0,
  hours_below_setpoint numeric NOT NULL DEFAULT 0,
  compressor_on_hours numeric NOT NULL DEFAULT 0,
  compressor_on_percent numeric NOT NULL DEFAULT 0,
  total_energy_kwh numeric NOT NULL DEFAULT 0,
  avg_cop numeric,
  peak_load_kcal_h numeric NOT NULL DEFAULT 0,
  equipment_adequacy text NOT NULL DEFAULT 'adequate',
  -- Dados completos da simulação (série temporal)
  simulation_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Alertas gerados
  alerts jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Metadados
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_coldpro_simulations_env_id
  ON public.coldpro_simulations(environment_id);

CREATE INDEX IF NOT EXISTS idx_coldpro_simulations_latest
  ON public.coldpro_simulations(environment_id, is_latest)
  WHERE is_latest = true;

CREATE INDEX IF NOT EXISTS idx_coldpro_simulations_result_id
  ON public.coldpro_simulations(result_id);

-- RLS
ALTER TABLE public.coldpro_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coldpro_simulations_auth"
  ON public.coldpro_simulations
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.coldpro_environments e
      JOIN public.coldpro_projects p ON p.id = e.coldpro_project_id
      WHERE e.id = coldpro_simulations.environment_id
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.coldpro_environments e
      JOIN public.coldpro_projects p ON p.id = e.coldpro_project_id
      WHERE e.id = coldpro_simulations.environment_id
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.set_coldpro_simulations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_coldpro_simulations_updated_at
  BEFORE UPDATE ON public.coldpro_simulations
  FOR EACH ROW EXECUTE FUNCTION public.set_coldpro_simulations_updated_at();

-- Função para marcar versões anteriores como não-latest ao salvar nova
CREATE OR REPLACE FUNCTION public.mark_previous_simulations_not_latest()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_latest = true THEN
    UPDATE public.coldpro_simulations
    SET is_latest = false
    WHERE environment_id = NEW.environment_id
      AND id != NEW.id
      AND is_latest = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_coldpro_simulations_mark_latest
  AFTER INSERT OR UPDATE ON public.coldpro_simulations
  FOR EACH ROW EXECUTE FUNCTION public.mark_previous_simulations_not_latest();

-- Tabela de snapshots de cálculo (versionamento do cálculo estático)
CREATE TABLE IF NOT EXISTS public.coldpro_calculation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid NOT NULL REFERENCES public.coldpro_environments(id) ON DELETE CASCADE,
  result_id uuid REFERENCES public.coldpro_results(id) ON DELETE SET NULL,
  -- Identificação
  label text NOT NULL DEFAULT 'Cálculo',
  version integer NOT NULL DEFAULT 1,
  is_baseline boolean NOT NULL DEFAULT false,
  -- Hash do input para detectar mudanças
  input_hash text NOT NULL DEFAULT '',
  -- Dados completos do snapshot
  snapshot_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Metadados
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coldpro_snapshots_env_id
  ON public.coldpro_calculation_snapshots(environment_id);

ALTER TABLE public.coldpro_calculation_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coldpro_snapshots_auth"
  ON public.coldpro_calculation_snapshots
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.coldpro_environments e
      JOIN public.coldpro_projects p ON p.id = e.coldpro_project_id
      WHERE e.id = coldpro_calculation_snapshots.environment_id
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.coldpro_environments e
      JOIN public.coldpro_projects p ON p.id = e.coldpro_project_id
      WHERE e.id = coldpro_calculation_snapshots.environment_id
    )
  );
