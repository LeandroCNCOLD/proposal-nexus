-- ============================================================
-- ColdPro — Cache de Perfis Climáticos
-- Tabela que armazena perfis climáticos buscados via Open-Meteo.
-- Funciona como cache persistente: ao consultar um CEP/cidade,
-- o sistema verifica aqui primeiro antes de chamar a API externa.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coldpro_climate_cache (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Chave de lookup: código IBGE do município (7 dígitos)
  ibge_code                 text NOT NULL UNIQUE,

  -- Dados de localização
  city_name                 text NOT NULL,
  state_code                text NOT NULL,         -- UF (2 letras)
  latitude                  double precision NOT NULL,
  longitude                 double precision NOT NULL,

  -- Perfil climático mensal × horário (12 meses × 24 horas)
  -- Armazenado como JSONB para flexibilidade e queries eficientes
  temperatures_monthly      jsonb NOT NULL,        -- [[24 floats], ...] × 12 meses
  humidity_monthly          jsonb NOT NULL,        -- [[24 ints], ...] × 12 meses

  -- Estatísticas anuais (para exibição rápida)
  temp_max_c                real NOT NULL,
  temp_min_c                real NOT NULL,
  temp_avg_c                real NOT NULL,
  humidity_avg_pct          smallint NOT NULL,

  -- Metadados
  data_source               text NOT NULL DEFAULT 'open-meteo-era5',
  data_period_start         date,                  -- ex: 2010-01-01
  data_period_end           date,                  -- ex: 2023-12-31
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- Índices para lookup rápido
CREATE INDEX IF NOT EXISTS idx_climate_cache_ibge
  ON public.coldpro_climate_cache (ibge_code);

CREATE INDEX IF NOT EXISTS idx_climate_cache_state
  ON public.coldpro_climate_cache (state_code);

CREATE INDEX IF NOT EXISTS idx_climate_cache_city
  ON public.coldpro_climate_cache USING gin (to_tsvector('portuguese', city_name));

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_climate_cache_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_climate_cache_updated_at
  BEFORE UPDATE ON public.coldpro_climate_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_climate_cache_updated_at();

-- RLS: leitura pública (dados climáticos são públicos),
-- escrita apenas para usuários autenticados
ALTER TABLE public.coldpro_climate_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "climate_cache_select_all"
  ON public.coldpro_climate_cache FOR SELECT
  USING (true);

CREATE POLICY "climate_cache_insert_authenticated"
  ON public.coldpro_climate_cache FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "climate_cache_update_authenticated"
  ON public.coldpro_climate_cache FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Comentários
COMMENT ON TABLE public.coldpro_climate_cache IS
  'Cache de perfis climáticos ERA5 por município. Populado sob demanda via Open-Meteo API.';
COMMENT ON COLUMN public.coldpro_climate_cache.ibge_code IS
  'Código IBGE do município (7 dígitos). Chave primária de negócio.';
COMMENT ON COLUMN public.coldpro_climate_cache.temperatures_monthly IS
  'Array 12×24 com temperatura média (°C) por mês e hora do dia. Índice 0 = Janeiro, índice 23 = hora 23.';
COMMENT ON COLUMN public.coldpro_climate_cache.humidity_monthly IS
  'Array 12×24 com umidade relativa média (%) por mês e hora do dia.';
