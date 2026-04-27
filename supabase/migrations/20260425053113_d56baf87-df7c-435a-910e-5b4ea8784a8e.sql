CREATE UNIQUE INDEX IF NOT EXISTS ux_nomus_proposal_items_full_item
  ON public.nomus_proposal_items(nomus_proposal_id, nomus_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_proposal_items_full_nomus_item
  ON public.proposal_items(proposal_id, nomus_item_id);