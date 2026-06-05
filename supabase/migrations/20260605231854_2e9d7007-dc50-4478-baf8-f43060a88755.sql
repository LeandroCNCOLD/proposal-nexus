
CREATE OR REPLACE VIEW public.v_proposal_lead_matches AS
WITH p AS (
  SELECT
    p.id AS proposal_id,
    p.nomus_id,
    p.title AS proposal_title,
    c.name AS client_name,
    NULLIF(regexp_replace(coalesce(c.document, ''), '\D', '', 'g'), '') AS cnpj_digits,
    NULLIF(upper(btrim(p.title)), '') AS title_norm
  FROM public.proposals p
  LEFT JOIN public.clients c ON c.id = p.client_id
  WHERE p.nomus_id IS NOT NULL
),
l AS (
  SELECT
    id AS lead_id,
    lead_code,
    proposal_title,
    client_name,
    NULLIF(regexp_replace(coalesce(cnpj, ''), '\D', '', 'g'), '') AS cnpj_digits,
    NULLIF(upper(btrim(proposal_title)), '') AS proposal_title_norm,
    NULLIF(upper(btrim(lead_code)), '') AS lead_code_norm
  FROM public.sdr_leads
),
cnpj_matches AS (
  SELECT p.proposal_id, l.lead_id, 'cnpj'::text AS match_type,
         p.cnpj_digits, p.proposal_title, l.lead_code, p.client_name
  FROM p JOIN l ON p.cnpj_digits = l.cnpj_digits
  WHERE p.cnpj_digits IS NOT NULL
),
title_matches AS (
  SELECT p.proposal_id, l.lead_id, 'titulo'::text AS match_type,
         p.cnpj_digits, p.proposal_title, l.lead_code, p.client_name
  FROM p JOIN l ON (
        (p.title_norm IS NOT NULL AND p.title_norm = l.proposal_title_norm)
     OR (p.title_norm IS NOT NULL AND p.title_norm = l.lead_code_norm)
     OR (p.nomus_id IS NOT NULL AND p.nomus_id::text = l.lead_code)
  )
  WHERE (p.cnpj_digits IS NULL OR l.cnpj_digits IS NULL)
    AND NOT EXISTS (SELECT 1 FROM cnpj_matches cm WHERE cm.proposal_id = p.proposal_id AND cm.lead_id = l.lead_id)
)
SELECT * FROM cnpj_matches
UNION ALL
SELECT * FROM title_matches;

GRANT SELECT ON public.v_proposal_lead_matches TO authenticated;
GRANT SELECT ON public.v_proposal_lead_matches TO service_role;
