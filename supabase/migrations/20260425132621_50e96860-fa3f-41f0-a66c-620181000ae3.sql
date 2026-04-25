ALTER TABLE public.nomus_processes
  ADD COLUMN IF NOT EXISTS id_prioridade integer,
  ADD COLUMN IF NOT EXISTS last_push_error text,
  ADD COLUMN IF NOT EXISTS last_pull_error text;

CREATE INDEX IF NOT EXISTS idx_nomus_processes_id_prioridade
  ON public.nomus_processes(id_prioridade);

DELETE FROM public.nomus_processes
WHERE nomus_id IS NULL OR btrim(nomus_id) = '' OR btrim(nomus_id) = '0';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'nomus_processes_nomus_id_valid_check'
      AND conrelid = 'public.nomus_processes'::regclass
  ) THEN
    ALTER TABLE public.nomus_processes
      ADD CONSTRAINT nomus_processes_nomus_id_valid_check
      CHECK (btrim(nomus_id) <> '' AND btrim(nomus_id) <> '0');
  END IF;
END $$;