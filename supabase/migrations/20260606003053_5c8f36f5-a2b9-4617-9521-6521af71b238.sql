
-- 1. Map profile → Nomus seller (explicit when known)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nomus_seller_id text;

-- 2. Indexes for fast seller wallet & agenda-by-proposal lookups
CREATE INDEX IF NOT EXISTS idx_proposals_nomus_seller_name ON public.proposals (lower(nomus_seller_name));
CREATE INDEX IF NOT EXISTS idx_proposals_sales_owner_id ON public.proposals (sales_owner_id);
CREATE INDEX IF NOT EXISTS idx_nomus_proposals_vendedor_nomus_id ON public.nomus_proposals (vendedor_nomus_id);
CREATE INDEX IF NOT EXISTS idx_nomus_proposals_vendedor_nome ON public.nomus_proposals (lower(vendedor_nome));
CREATE INDEX IF NOT EXISTS idx_crm_agenda_proposal_number ON public.crm_agenda (proposal_number);

-- 3. Helper: list proposal IDs owned by a user (CN Cold owner OR Nomus seller match)
CREATE OR REPLACE FUNCTION public.proposals_for_seller(_user_id uuid)
RETURNS TABLE(proposal_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT p.id AS user_id, p.full_name, p.nomus_seller_id
    FROM public.profiles p
    WHERE p.id = _user_id
  )
  SELECT pr.id
  FROM public.proposals pr, me
  WHERE pr.sales_owner_id = me.user_id
     OR (me.nomus_seller_id IS NOT NULL AND pr.nomus_id IN (
            SELECT np.nomus_id FROM public.nomus_proposals np
            WHERE np.vendedor_nomus_id = me.nomus_seller_id
        ))
     OR (
       me.full_name IS NOT NULL
       AND (
         lower(coalesce(pr.nomus_seller_name,'')) = lower(me.full_name)
         OR pr.nomus_id IN (
            SELECT np.nomus_id FROM public.nomus_proposals np
            WHERE lower(coalesce(np.vendedor_nome,'')) = lower(me.full_name)
         )
       )
     );
$$;

GRANT EXECUTE ON FUNCTION public.proposals_for_seller(uuid) TO authenticated;
