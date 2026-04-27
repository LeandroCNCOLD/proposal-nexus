
-- Tabela principal de templates
CREATE TABLE public.proposal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  -- Branding
  primary_color text NOT NULL DEFAULT '#0B2545',
  accent_color text NOT NULL DEFAULT '#1FB6FF',
  accent_color_2 text NOT NULL DEFAULT '#2AA9E0',
  -- Footer info
  empresa_nome text NOT NULL DEFAULT 'CN Cold',
  empresa_telefone text NOT NULL DEFAULT '(11) 4054-4192',
  empresa_site text NOT NULL DEFAULT 'cncold.com.br',
  empresa_email text NOT NULL DEFAULT 'contato@cncold.com.br',
  empresa_cidade text NOT NULL DEFAULT 'Diadema - SP',
  -- Conteúdos fixos das páginas (preenchidos por padrão com base no PDF)
  capa_tagline text DEFAULT 'NOSSA ESPECIALIDADE É O FRIO!',
  capa_titulo text DEFAULT 'PROPOSTA TÉCNICA E COMERCIAL',
  capa_subtitulo text DEFAULT 'Projeto de Refrigeração Industrial com Estabilidade Térmica e Eficiência Energética',
  sobre_titulo text DEFAULT 'CN Cold – Engenharia Térmica com Responsabilidade Técnica e Performance Real.',
  sobre_paragrafos jsonb NOT NULL DEFAULT '[]'::jsonb,
  sobre_diferenciais jsonb NOT NULL DEFAULT '[]'::jsonb,
  cases_titulo text DEFAULT 'Cases / Projetos',
  cases_subtitulo text DEFAULT 'Empresas que já confiam em nossas soluções:',
  cases_itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  clientes_titulo text DEFAULT 'Principais Clientes',
  clientes_lista jsonb NOT NULL DEFAULT '[]'::jsonb,
  escopo_apresentacao_itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  garantia_texto text,
  garantia_itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  dados_bancarios jsonb NOT NULL DEFAULT '{}'::jsonb,
  prazo_entrega_padrao text DEFAULT '45 dias úteis após a assinatura do contrato e confirmação do pagamento do sinal pelo Departamento Financeiro.',
  validade_padrao_dias integer DEFAULT 5,
  -- Configuração de páginas (quais habilitadas, ordem)
  pages_config jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- Apenas um template padrão por vez
CREATE UNIQUE INDEX idx_proposal_templates_one_default
  ON public.proposal_templates (is_default)
  WHERE is_default = true;

CREATE INDEX idx_proposal_templates_active ON public.proposal_templates(is_active);

-- Trigger updated_at
CREATE TRIGGER trg_proposal_templates_updated_at
  BEFORE UPDATE ON public.proposal_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.proposal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY templates_select ON public.proposal_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY templates_insert ON public.proposal_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role, 'engenharia'::app_role]));

CREATE POLICY templates_update ON public.proposal_templates
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role, 'engenharia'::app_role]));

CREATE POLICY templates_delete ON public.proposal_templates
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role]));

-- Assets do template (imagens)
CREATE TABLE public.proposal_template_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.proposal_templates(id) ON DELETE CASCADE,
  asset_kind text NOT NULL, -- 'logo', 'header_band', 'cover_photo', 'about_photo', 'about_photo_2', 'case_photo', 'icon_phone', 'icon_web', 'icon_email', 'icon_location', 'equipment_photo', 'closing_photo'
  label text,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  position integer DEFAULT 0,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid
);

CREATE INDEX idx_template_assets_template ON public.proposal_template_assets(template_id);
CREATE INDEX idx_template_assets_kind ON public.proposal_template_assets(template_id, asset_kind);

ALTER TABLE public.proposal_template_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY template_assets_select ON public.proposal_template_assets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY template_assets_insert ON public.proposal_template_assets
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role, 'engenharia'::app_role]));

CREATE POLICY template_assets_update ON public.proposal_template_assets
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role, 'engenharia'::app_role]));

CREATE POLICY template_assets_delete ON public.proposal_template_assets
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role, 'engenharia'::app_role]));

-- Vínculo do documento da proposta com o template usado
ALTER TABLE public.proposal_documents
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.proposal_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_proposal_documents_template ON public.proposal_documents(template_id);

-- Bucket de storage para assets dos templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposal-template-assets', 'proposal-template-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Policies storage: leitura pública, escrita restrita
CREATE POLICY "template_assets_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'proposal-template-assets');

CREATE POLICY "template_assets_authenticated_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'proposal-template-assets'
    AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role, 'engenharia'::app_role])
  );

CREATE POLICY "template_assets_authenticated_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'proposal-template-assets'
    AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role, 'engenharia'::app_role])
  );

CREATE POLICY "template_assets_authenticated_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'proposal-template-assets'
    AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role, 'engenharia'::app_role])
  );

-- Insere o template padrão "Padrão CN Cold" com conteúdos do PDF
INSERT INTO public.proposal_templates (
  name, description, is_default, is_active,
  sobre_paragrafos, sobre_diferenciais,
  cases_itens, clientes_lista,
  escopo_apresentacao_itens,
  garantia_texto, garantia_itens,
  dados_bancarios,
  pages_config
) VALUES (
  'Padrão CN Cold',
  'Template padrão de proposta CN Cold com capa azul, faixa gradient e rodapé de contato.',
  true, true,
  '["Projetos de refrigeração mal dimensionados geram instabilidade térmica, aumento de consumo energético e risco direto ao produto armazenado.", "A CN Cold desenvolve soluções sob medida para eliminar esses riscos, garantindo estabilidade operacional, eficiência energética e previsibilidade no desempenho.", "Mais do que fornecer equipamentos, somos fabricantes, criamos soluções térmicas sob medida, com engenharia aplicada, para que você tenha a segurança de receber, na prática, exatamente a performance que foi prometida."]'::jsonb,
  '["Projetos dimensionados com simulação térmica avançada, garantindo projetos mais precisos, eficientes e confiáveis desde o início, diretamente da nossa fábrica.", "Antes de chegar até você, cada sistema passa por testes rigorosos em nosso laboratório próprio, assegurando que a performance prometida seja exatamente a que você verá na prática — com total transparência e segurança.", "Atendemos projetos em todo o Brasil, levando soluções térmicas personalizadas que se adaptam à realidade da sua operação, garantindo eficiência e performance em cada aplicação.", "Nosso suporte técnico acompanha você em todas as etapas — do estudo inicial ao pós-venda — garantindo mais segurança, previsibilidade e tranquilidade em todo o projeto."]'::jsonb,
  '["Câmara de armazenamento de Grãos","Câmara de Sorvetes e Açaí","Entreposto logístico","Indústria de Ovos","Armazém de Grãos e Sementes","Anti-câmara climatizada","Projeto Turn-Key (Centro Logístico)","Câmaras para amendoim","Túnel de congelamento de pescados","Câmara para insumos","Câmara FLV","Túnel de congelamento rápido"]'::jsonb,
  '["Delly","RDD Distribuidora","Ice Goela","Fazenda Canaã","Peixaria São Carlos","Agropecuária do Vale do Rio Doce","Cencora World Courier","Breadlife","Buritis","Martin Brower","Festpan Alimentos","PANCO","Life Sucos","Longping High-Tech","Adimax","Kassel Alimentos","CASUL","Natari","Hershey''s","Metta","Grupo Petrópolis","Sorvetes Gigabon","Tati Pães Congelados","Vibe Açaí","NG Distribuidora Nova Geração","Cream Color Sorvetes","EBD Grupo"]'::jsonb,
  '["Características técnicas","Objetivo","Resumo dos Itens Inclusos na Proposta","Condições de pagamento","Dados Bancários","Prazo de Entrega dos Materiais","Garantia","Nota"]'::jsonb,
  'Garantia integral de 12 (doze) meses, contados a partir da emissão da nota fiscal, cobrindo:',
  '["Defeitos e inadequações de materiais.","Danos inerentes a construção, instalação e montagem.","Incêndio e explosão.","Furto qualificado.","Riscos da Natureza."]'::jsonb,
  '{"banco":"422 - Banco Safra S/A","agencia":"0198","conta":"00582879-8","pix":"37.783.963/0001-19","titular":"CN Cold Refrigeração Industrial"}'::jsonb,
  '[
    {"id":"cover","type":"cover","title":"Capa","visible":true,"order":0},
    {"id":"about","type":"about","title":"Sobre a CN Cold","visible":true,"order":1},
    {"id":"cases","type":"cases","title":"Cases e Clientes","visible":true,"order":2},
    {"id":"solution","type":"solution","title":"Solução Proposta","visible":true,"order":3},
    {"id":"context","type":"context","title":"Contextualização","visible":true,"order":4},
    {"id":"scope-apresentacao","type":"scope-apresentacao","title":"Escopo da Apresentação","visible":true,"order":5},
    {"id":"caracteristicas","type":"caracteristicas","title":"Características Técnicas","visible":true,"order":6},
    {"id":"equipamento","type":"equipamento","title":"Equipamento","visible":true,"order":7},
    {"id":"itens-inclusos","type":"itens-inclusos","title":"Itens Inclusos / Não Inclusos","visible":true,"order":8},
    {"id":"investimento","type":"investimento","title":"Investimento","visible":true,"order":9},
    {"id":"impostos-pagamento","type":"impostos-pagamento","title":"Impostos e Pagamento","visible":true,"order":10},
    {"id":"prazo-garantia","type":"prazo-garantia","title":"Prazo e Garantia","visible":true,"order":11},
    {"id":"contracapa","type":"contracapa","title":"Contracapa","visible":true,"order":12}
  ]'::jsonb
);
