ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS state_registration text,
  ADD COLUMN IF NOT EXISTS municipal_registration text,
  ADD COLUMN IF NOT EXISTS nomus_seller_id text,
  ADD COLUMN IF NOT EXISTS nomus_seller_name text,
  ADD COLUMN IF NOT EXISTS nomus_representative_id text,
  ADD COLUMN IF NOT EXISTS nomus_representative_name text,
  ADD COLUMN IF NOT EXISTS nomus_raw jsonb;

ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS mobile text,
  ADD COLUMN IF NOT EXISTS nomus_raw jsonb;

CREATE INDEX IF NOT EXISTS idx_clients_nomus_seller_id ON public.clients(nomus_seller_id);
CREATE INDEX IF NOT EXISTS idx_clients_nomus_representative_id ON public.clients(nomus_representative_id);
CREATE INDEX IF NOT EXISTS idx_clients_segment ON public.clients(segment);
CREATE INDEX IF NOT EXISTS idx_clients_region ON public.clients(region);
CREATE INDEX IF NOT EXISTS idx_client_contacts_nomus_id ON public.client_contacts(nomus_id);