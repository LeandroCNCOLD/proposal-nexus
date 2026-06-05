
CREATE TABLE public.crm_call_script_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  opening TEXT NOT NULL DEFAULT '',
  discovery_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  objections JSONB NOT NULL DEFAULT '[]'::jsonb,
  closing TEXT NOT NULL DEFAULT '',
  whatsapp_followup TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.crm_call_script_templates TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.crm_call_script_templates TO authenticated;
GRANT ALL ON public.crm_call_script_templates TO service_role;

ALTER TABLE public.crm_call_script_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ver scripts ativos"
  ON public.crm_call_script_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Gestores podem criar scripts"
  ON public.crm_call_script_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente_comercial'::app_role, 'diretoria'::app_role])
  );

CREATE POLICY "Gestores podem atualizar scripts"
  ON public.crm_call_script_templates FOR UPDATE
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente_comercial'::app_role, 'diretoria'::app_role])
  );

CREATE POLICY "Gestores podem deletar scripts"
  ON public.crm_call_script_templates FOR DELETE
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente_comercial'::app_role, 'diretoria'::app_role])
  );

CREATE TRIGGER crm_call_script_templates_updated_at
  BEFORE UPDATE ON public.crm_call_script_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: script padrão CN Cold
INSERT INTO public.crm_call_script_templates (name, description, is_default, opening, discovery_questions, objections, closing, whatsapp_followup)
VALUES (
  'Padrão CN Cold',
  'Script padrão de follow-up de proposta. Placeholders: {firstName}, {contactName}, {sdrName}, {company}, {value}, {proposalRef}, {leadCode}, {proposalDate}, {expectedClosing}, {validityDays}, {proposalDesc}.',
  true,
  'Olá, {firstName}! Aqui é o {sdrName} da CN Cold. Tudo bem? Estou ligando referente à proposta {proposalRef} ({leadCode}) no valor de {value} que enviamos em {proposalDate}. Tem 2 minutinhos para conversarmos?',
  '["Você conseguiu analisar a proposta da {company}?","O escopo ({proposalDesc}) atende ao que vocês precisam?","Qual a previsão de fechamento que vocês estão trabalhando?","Quem mais participa da decisão além de você?","Já receberam propostas de concorrentes? Como estamos no comparativo?"]'::jsonb,
  '[{"obj":"Preço alto","resp":"O valor de {value} reflete a engenharia CN Cold + 10 anos de garantia. Posso te mostrar o ROI vs. equipamento comercial?"},{"obj":"Sem orçamento agora","resp":"Entendi. Temos condições especiais de pagamento (entrada + parcelas). Quando seria o melhor momento para retomar?"},{"obj":"Vou pensar","resp":"Claro. Posso te ligar na semana de {expectedClosing} para falarmos?"},{"obj":"Fechei com concorrente","resp":"Sem problemas. Só por curiosidade, qual foi o fator decisivo? Isso ajuda a melhorarmos."}]'::jsonb,
  'Combinado, {firstName}. Vou agendar nosso próximo contato próximo a {expectedClosing}. Mando também por WhatsApp um resumo da proposta. Qualquer dúvida me chama. Obrigado!',
  'Olá {firstName}, aqui é o {sdrName} da CN Cold. Conforme conversamos, segue o resumo da proposta {proposalRef} no valor de {value}. Validade: {validityDays} dias. Qualquer dúvida, estou à disposição!'
);
