UPDATE public.nomus_sync_state
SET running = false,
    last_error = 'cleanup: 400 tamanhoPagina/page-out-of-range travou o flag',
    updated_at = now()
WHERE entity = 'propostas';