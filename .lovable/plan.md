

# Editor de Propostas WYSIWYG (CN Cold)

## Visão geral

Editor estilo Word **dentro da proposta**, baseado no esqueleto fixo de 7 páginas do template, com:
- **Auto-preenchimento** de dados do Nomus + edição manual livre
- **Preview ao vivo** (paginado A4) enquanto edita
- **Versionamento** — ao "enviar/finalizar", PDF imutável vai para `proposal_send_versions` no Storage
- **Páginas extras**: blocos pré-definidos do catálogo, páginas em branco rich-text, anexar PDFs externos

## Stack técnica

- **Editor**: [TipTap v3](https://tiptap.dev/) (headless, extensível, já em React) — bold, itálico, listas, tabelas, imagens, headings, alinhamento, cores, links, undo/redo. Equivale a Word para uso comercial.
- **Render PDF**: HTML/CSS → PDF via **Browserless** (chamada externa) ou **react-pdf** (puro JS, Worker-compat). Decisão na implementação: `react-pdf` é mais seguro para Worker; Browserless é fiel pixel-a-pixel mas exige API key. **Vou começar com `@react-pdf/renderer`** (totalmente compatível com Cloudflare Worker, sem dependência externa).
- **Storage**: bucket `proposal-pdfs` (novo) para PDFs versionados.
- **Persistência**: documento salvo como JSON estruturado (TipTap doc) → permite re-renderizar e editar a qualquer momento.

## Modelo de dados (migration)

### Nova tabela `proposal_documents`
Um registro por proposta (1:1 com `proposals`):
- `id`, `proposal_id` (FK unique), `template_version` (text, default `'cn-cold-v1'`)
- `pages` (jsonb) — array ordenado de páginas: `[{ id, type: 'cover'|'about'|'cases'|'solution'|'context'|'scope'|'warranty'|'custom-rich'|'custom-block'|'attached-pdf', visible, order, content: {...} }]`
- `cover_data` (jsonb) — { cliente, projeto, numero, data, responsavel, foto_capa_url }
- `solution_data` (jsonb) — { intro_richtext, contempla[], diferenciais[], impacto[], conclusao_richtext }
- `context_data` (jsonb) — { cliente_razao, fantasia, cnpj, endereco, caracteristicas[], contatos[], texto_apresentacao, prazo_validade }
- `scope_items` (jsonb) — array reordenável
- `warranty_text` (richtext jsonb)
- `custom_blocks` (jsonb) — páginas extras
- `attached_pdf_paths` (text[]) — paths no Storage
- `last_edited_by` (uuid), `last_edited_at` (timestamptz)
- `auto_filled_at` (timestamptz) — última sincronização com Nomus

### Nova tabela `proposal_document_assets`
- `id`, `proposal_id`, `storage_path`, `mime_type`, `kind` (`'cover-photo'|'inline-image'|'attached-pdf'`), `uploaded_by`, `uploaded_at`

### Bucket de storage `proposal-pdfs`
- Privado, acessível só por authenticated. Path: `{proposal_id}/v{n}.pdf`

### RLS
- `proposal_documents`: SELECT autenticado; INSERT/UPDATE para criador da proposta + `gerente_comercial`/`diretoria`/`admin`/`engenharia`
- `proposal_document_assets`: idem
- Storage policies idem

## Arquitetura de UI

### Nova rota `/app/propostas/$id/editor`
Layout split-screen:
- **Esquerda (40%)**: árvore de páginas + painel contextual do bloco selecionado (campos estruturados ou TipTap toolbar)
- **Direita (60%)**: preview WYSIWYG paginado A4 (`@react-pdf/renderer` `<PDFViewer>` em dev, ou render HTML clone do PDF em produção para performance)

### Componentes novos
- `ProposalDocumentEditor.tsx` — shell do editor
- `EditorPagePanel.tsx` — sidebar com árvore drag-drop (dnd-kit) das páginas, botão "+ adicionar página"
- `EditorBlockField.tsx` — renderiza editor apropriado por tipo de bloco
- `RichTextEditor.tsx` — wrapper TipTap reutilizável (toolbar configurável)
- `EditorPreview.tsx` — preview ao vivo (debounced 500ms)
- `pdf/CoverPage.tsx`, `pdf/AboutPage.tsx`, `pdf/CasesPage.tsx`, `pdf/SolutionPage.tsx`, `pdf/ContextPage.tsx`, `pdf/ScopePage.tsx`, `pdf/WarrantyPage.tsx`, `pdf/CustomRichPage.tsx`, `pdf/AttachedPdfPage.tsx` — componentes `@react-pdf/renderer` que viram o PDF
- `pdf/ProposalDocument.tsx` — composição final
- `pdf/styles.ts` — design tokens do PDF (cores CN Cold, fontes Helvetica/Roboto, layout)

### Auto-preenchimento (botão "Sincronizar do Nomus")
- Lê `nomus_proposals` + `nomus_proposal_items` + `clients` + `client_contacts` + `nomus_sellers` da proposta
- Preenche `cover_data`, `context_data`, `scope_items` automaticamente
- Não sobrescreve campos editados manualmente (flag `manually_edited` por campo)

### Páginas extras (3 modos, conforme você escolheu)
1. **Bloco do catálogo**: dropdown com presets — "Datasheet equipamento", "Galeria de fotos do projeto", "Cronograma de instalação", "Tabela técnica detalhada", "Memorial descritivo". Cada um vira um componente PDF próprio.
2. **Página em branco rich-text**: TipTap livre, vira `CustomRichPage` no PDF.
3. **PDF anexado**: upload pra `proposal-pdfs/attachments/`, merge no final via `pdf-lib` (compatível com Worker).

## Geração e versionamento de PDF

### Server function `generateProposalPdf`
- Input: `proposalId`, `mode: 'preview' | 'final'`
- Lê `proposal_documents` + dados relacionados
- Renderiza com `@react-pdf/renderer` server-side → `Buffer`
- Se há `attached_pdf_paths` → baixa cada um, faz merge com `pdf-lib`
- **Modo `preview`**: retorna URL temporária assinada, não persiste
- **Modo `final`**:
  - Salva em `proposal-pdfs/{proposal_id}/v{n+1}.pdf`
  - Insere em `proposal_send_versions` com `version_number`, `is_current=true`, marca anteriores `is_current=false`
  - Retorna URL assinada e `version_id`

### Botões na UI
- **"Visualizar PDF"** (qualquer hora) → abre preview em nova aba
- **"Salvar versão final"** → confirma → gera versão imutável → muda status pra `pronta_para_envio`

## Auto-save

- Debounce 2s em qualquer mudança → `updateProposalDocument` server fn
- Indicador "salvando…" / "salvo às HH:MM" no header
- Conflito de edição simultânea: lock otimista por `last_edited_at`

## Implementação por etapas (entregáveis)

**Etapa 1 — Fundação** (esta sessão)
1. Migration: `proposal_documents`, `proposal_document_assets`, bucket `proposal-pdfs`, RLS
2. Server functions: `getProposalDocument`, `upsertProposalDocument`, `autoFillFromNomus`
3. Rota `/app/propostas/$id/editor` com shell vazio + link "Editar documento" na tela da proposta
4. Estrutura de páginas (sem editor ainda) + sidebar com árvore drag-drop

**Etapa 2 — Editor de blocos estruturados**
5. Componentes de campo (cliente, projeto, contatos, características, escopo) com auto-preenchimento Nomus
6. TipTap mínimo nas áreas rich-text (intro solução, conclusão, garantia)

**Etapa 3 — PDF**
7. `@react-pdf/renderer` com todos os componentes de página fiéis ao template
8. Server function `generateProposalPdf` modo preview
9. Botão "Visualizar PDF"

**Etapa 4 — Versionamento e finalização**
10. Modo final + integração com `proposal_send_versions`
11. Histórico de versões na sidebar

**Etapa 5 — Páginas extras**
12. Bloco catálogo (datasheet, galeria, cronograma)
13. Página em branco rich-text completo
14. Anexo de PDF externo + merge com pdf-lib

## Riscos e mitigações

- **Fidelidade pixel-perfect ao template original**: `@react-pdf/renderer` é HTML-like mas não 100% idêntico ao Canva original. Vou usar as mesmas cores, fontes Helvetica/proxy de Montserrat, e replicar o layout. Aceitável para v1; se precisar fidelidade absoluta depois, migramos para Browserless+HTML.
- **Imagens da capa e marca**: precisamos das fotos originais usadas no template (logo CN Cold, foto da capa "instalação industrial"). Posso usar as extraídas do PDF que você enviou como placeholder — você revisa depois e troca por arquivos definitivos.
- **Worker SSR**: `@react-pdf/renderer` e `pdf-lib` são compatíveis. TipTap roda só no client. ✅
- **Tamanho do bundle**: TipTap + extensões adiciona ~200KB. Aceitável para uma rota de editor profissional.

## O que vai ficar diferente do template original (v1)

- Fonte: Helvetica (PDF padrão) em vez da fonte custom do Canva — posso embutir Montserrat se você enviar o `.ttf`
- Imagens decorativas da capa: vou começar com a foto que extraí do seu PDF
- Cores e layout: idênticos
- Footer com telefone/site/email: presente em todas as páginas

## Próximo passo

Posso começar pela **Etapa 1** agora (migration + shell + auto-fill do Nomus) — são ~6 arquivos novos e a base que destrava todo o resto. As Etapas 2–5 vêm em sessões seguintes conforme sua prioridade.

**Confirma a Etapa 1?** Se preferir, posso também:
- (a) Começar pela Etapa 3 (PDF puro) primeiro, pra você ver o output rápido sem editor
- (b) Ir pelo plano completo numerado e fazer Etapa 1 já

