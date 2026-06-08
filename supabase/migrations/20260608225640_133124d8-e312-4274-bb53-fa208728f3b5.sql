-- Tornar autovacuum mais agressivo em tabelas com alta rotatividade
-- (scale_factor menor = aciona com menos espaço morto acumulado)

ALTER TABLE public.nomus_processes SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 100
);

ALTER TABLE public.nomus_sync_log SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.1
);

ALTER TABLE public.nomus_proposal_items SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.1
);

ALTER TABLE public.nomus_price_table_items SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.1
);