
-- Função auxiliar idempotente para parsear datas em formatos variados (BR, ISO, com hora).
CREATE OR REPLACE FUNCTION public._parse_nomus_date(s text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  trimmed text;
BEGIN
  IF s IS NULL OR s = '' THEN RETURN NULL; END IF;
  trimmed := substring(s from 1 for 10);
  -- ISO YYYY-MM-DD
  IF trimmed ~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN trimmed::date;
  END IF;
  -- BR DD/MM/YYYY
  IF trimmed ~ '^\d{2}/\d{2}/\d{4}$' THEN
    RETURN to_date(trimmed, 'DD/MM/YYYY');
  END IF;
  RETURN NULL;
END;
$$;

UPDATE public.nomus_proposals SET
  numero = COALESCE(raw->>'proposta', raw->>'numero'),
  data_emissao = public._parse_nomus_date(COALESCE(raw->>'dataHoraAbertura', raw->>'dataEmissao')),
  validade = public._parse_nomus_date(COALESCE(raw->>'validade', raw->>'dataValidade')),
  valor_total = CASE
    WHEN raw->>'valorTotal' IS NULL OR raw->>'valorTotal' = '' THEN NULL
    ELSE REPLACE(REPLACE(raw->>'valorTotal', '.', ''), ',', '.')::numeric
  END,
  cliente_nomus_id = COALESCE(raw->>'idCliente', raw->>'clienteId', cliente_nomus_id),
  vendedor_nomus_id = COALESCE(raw->>'idVendedor', raw->>'vendedorId', vendedor_nomus_id)
WHERE raw IS NOT NULL;

UPDATE public.proposals p SET
  title = COALESCE(np.raw->>'proposta', np.numero, p.nomus_id) ||
          CASE WHEN np.raw->>'nomeCliente' IS NOT NULL AND np.raw->>'nomeCliente' <> ''
               THEN ' — ' || (np.raw->>'nomeCliente') ELSE '' END,
  total_value = COALESCE(np.valor_total, 0),
  valid_until = np.validade,
  nomus_proposal_id = np.id,
  nomus_synced_at = now()
FROM public.nomus_proposals np
WHERE p.nomus_id = np.nomus_id;
