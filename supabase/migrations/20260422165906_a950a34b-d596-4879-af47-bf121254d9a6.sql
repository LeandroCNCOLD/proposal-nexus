UPDATE public.nomus_sync_state
SET running = false,
    last_error = 'cleanup: kickoff falhou em disparar o cron (origem invalida em dev)',
    updated_at = now()
WHERE entity = 'propostas';