CREATE OR REPLACE FUNCTION public.import_sdr_leads_batch(payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  WITH src AS (
    SELECT * FROM jsonb_to_recordset(payload) AS x(
      lead_code text, proposal_version int, proposal_status text, temperature text,
      client_name text, razao_social text, cnpj text, contact_name text,
      contact_email text, contact_phone text, contact_mobile text,
      city text, state text, value numeric, discount_pct numeric,
      delivery_term text, validity_days int, proposal_title text, proposal_desc text,
      proposal_date date, expected_delivery date, expected_closing date,
      last_contact_at date, next_contact_at date,
      internal_note text, call_observation text, sdr_name text
    )
  ),
  ins AS (
    INSERT INTO public.sdr_leads AS t (
      lead_code, proposal_version, proposal_status, temperature,
      client_name, razao_social, cnpj, contact_name, contact_email,
      contact_phone, contact_mobile, city, state, value, discount_pct,
      delivery_term, validity_days, proposal_title, proposal_desc,
      proposal_date, expected_delivery, expected_closing,
      last_contact_at, next_contact_at, internal_note, call_observation, sdr_name,
      sdr_status
    )
    SELECT
      lead_code, proposal_version, proposal_status, COALESCE(temperature,'Morno'),
      COALESCE(client_name, razao_social, lead_code) AS client_name,
      razao_social, cnpj, contact_name, contact_email,
      contact_phone, contact_mobile, city, state, COALESCE(value,0), discount_pct,
      delivery_term, validity_days, proposal_title, proposal_desc,
      proposal_date, expected_delivery, expected_closing,
      last_contact_at, next_contact_at, internal_note, call_observation, sdr_name,
      'Não Contatado'
    FROM src
    ON CONFLICT (lead_code) DO UPDATE SET
      proposal_version=EXCLUDED.proposal_version,
      proposal_status=EXCLUDED.proposal_status,
      client_name=COALESCE(EXCLUDED.client_name, t.client_name),
      razao_social=COALESCE(EXCLUDED.razao_social, t.razao_social),
      cnpj=COALESCE(EXCLUDED.cnpj, t.cnpj),
      contact_name=COALESCE(EXCLUDED.contact_name, t.contact_name),
      contact_email=COALESCE(EXCLUDED.contact_email, t.contact_email),
      contact_phone=COALESCE(EXCLUDED.contact_phone, t.contact_phone),
      contact_mobile=COALESCE(EXCLUDED.contact_mobile, t.contact_mobile),
      city=COALESCE(EXCLUDED.city, t.city),
      state=COALESCE(EXCLUDED.state, t.state),
      value=COALESCE(EXCLUDED.value, t.value),
      discount_pct=COALESCE(EXCLUDED.discount_pct, t.discount_pct),
      delivery_term=COALESCE(EXCLUDED.delivery_term, t.delivery_term),
      validity_days=COALESCE(EXCLUDED.validity_days, t.validity_days),
      proposal_title=COALESCE(EXCLUDED.proposal_title, t.proposal_title),
      proposal_desc=COALESCE(EXCLUDED.proposal_desc, t.proposal_desc),
      proposal_date=COALESCE(EXCLUDED.proposal_date, t.proposal_date),
      expected_delivery=COALESCE(EXCLUDED.expected_delivery, t.expected_delivery),
      expected_closing=COALESCE(EXCLUDED.expected_closing, t.expected_closing),
      last_contact_at=COALESCE(EXCLUDED.last_contact_at, t.last_contact_at),
      next_contact_at=COALESCE(EXCLUDED.next_contact_at, t.next_contact_at),
      internal_note=COALESCE(EXCLUDED.internal_note, t.internal_note),
      call_observation=COALESCE(EXCLUDED.call_observation, t.call_observation),
      sdr_name=COALESCE(t.sdr_name, EXCLUDED.sdr_name),
      temperature=COALESCE(t.temperature, EXCLUDED.temperature),
      updated_at=now()
    RETURNING 1
  )
  SELECT count(*) INTO n FROM ins;
  RETURN n;
END;
$$;
DELETE FROM public.sdr_leads WHERE lead_code='__TEST__';