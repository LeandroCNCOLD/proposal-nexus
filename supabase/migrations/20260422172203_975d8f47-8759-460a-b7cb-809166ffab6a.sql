INSERT INTO public.nomus_sync_state (entity, running, total_synced, last_cursor, last_synced_at, last_error, updated_at)
VALUES ('propostas', false, 39, '138', now(), 'Pausado por rate limit do Nomus (HTTP 429). Clique em "Buscar do Nomus" para continuar.', now())
ON CONFLICT (entity) DO UPDATE
  SET running = false,
      last_error = EXCLUDED.last_error,
      updated_at = now();