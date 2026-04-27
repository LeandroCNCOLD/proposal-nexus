UPDATE public.nomus_sync_state
SET running = false,
    last_error = 'cleanup manual após timeout do Worker',
    updated_at = now()
WHERE entity = 'propostas';