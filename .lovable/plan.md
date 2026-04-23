

# Evolução do Editor de Propostas — Fase 1 (crítico)

Vamos implementar a **Fase 1** do briefing técnico: tipos de página reais, tabelas estruturadas, preview A4 fiel e snapshot de envio. Fase 2 (TipTap expandido, blocos avançados) fica para depois.

## Escopo desta entrega

### 1. Banco de dados (migrations)

**a) Nova tabela `proposal_tables`** — armazena tabelas estruturadas vinculadas à proposta (independente de `scope_items`):
```
proposal_tables {
  id uuid pk,
  proposal_id uuid not null,
  page_id text not null,            -- vincula à DocumentPage
  type text not null,               -- 'equipamentos' | 'impostos' | 'pagamento' | 'caracteristicas' | 'itens'
  title text,
  rows jsonb not null default '[]', -- linhas livres conforme schema do tipo
  columns jsonb,                    -- override de colunas (opcional)
  created_at, updated_at
}
```
RLS: leitura por authenticated; escrita restrita ao criador da proposta + roles `gerente_comercial/diretoria/admin/engenharia` (mesmo padrão de `proposal_documents`).

**b) Adicionar `document_snapshot jsonb` em `proposal_send_versions`** — hoje só guarda `template_snapshot`.

**c) `SINGLETON_KINDS`** — incluir `header_banner` e `footer_banner` (gap conhecido).

### 2. Renderers PDF dedicados (`src/integrations/proposal-editor/pdf/`)

Substituir o fallback `CustomRichPage` por componentes próprios em `ContentPages.tsx` (ou novo `TechnicalPages.tsx`):

| PageType | Componente | Conteúdo |
|---|---|---|
| `caracteristicas` | `CaracteristicasPage` | Tabela técnica (descrição/valor/unidade) |
| `equipamento` | `EquipamentoPage` | Repetível por item: foto + ficha técnica |
| `investimento` | `InvestimentoPage` | Tabela qtd × unitário × total + total geral |
| `impostos` | `ImpostosPage` | Tabela ICMS/IPI/PIS/COFINS (lê `nomus_proposals`) |
| `pagamento` | `PagamentoPage` | Tabela de parcelas (n × valor × vencimento) |
| `differentials` | `DifferentialsPage` | Lista numerada com ícone + descrição |
| `impact` | `ImpactPage` | Cards de impacto (KPI, valor, descrição) |
| `nota` | `NotaPage` | Bloco de nota/aviso destacado |
| `contracapa` | `ContracapaPage` | Versão fechamento (contato + assinatura) |

Regras transversais:
- Tabelas com **header repetido** (`<View fixed>` no `<Page>` parent) e linhas com `wrap={false}`.
- Cabeçalho/rodapé do template em todas (já implementado via `StandardPage`).
- Atualizar `ProposalDocument.tsx` para mapear cada `PageType` ao renderer (sem fallback genérico para os tipos acima).

### 3. Editor — Sistema de tabelas estruturadas

**Novo componente** `src/components/proposal-editor/blocks/StructuredTableEditor.tsx`:
- Grid editável (uma `<table>` HTML com inputs por célula).
- Botões "Adicionar linha" / "Remover linha".
- Cálculo automático de `valor_total = qtd × unitário` e total geral no rodapé.
- Suporte a copiar/colar (paste TSV/CSV → split por `\t`/`\n`).
- Schema de colunas por `type` (mapeamento estático no client).

**Novos editores de bloco** (chamados por `BlockEditorPanel` conforme `page.type`):
- `CaracteristicasBlockEditor`, `EquipamentoBlockEditor`, `InvestimentoBlockEditor`, `ImpostosBlockEditor`, `PagamentoBlockEditor` — todos consomem `StructuredTableEditor` com colunas pré-definidas.
- Para `equipamento`: além da tabela, suporte a "repetir por item de `proposal_items`" (toggle `repeatable`).

**Server functions** (novo arquivo `src/integrations/proposal-editor/tables.functions.ts`):
- `listProposalTables({ proposalId })`
- `upsertProposalTable({ proposalId, pageId, type, title, rows, columns })`
- `deleteProposalTable({ id })`

### 4. Preview A4 em tempo real

Substituir `EditorPreviewStub` por `<ProposalPreview mode="live" />` que usa `@react-pdf/renderer`'s `PDFViewer` (client-only, dynamic import) renderizando o **mesmo** `<ProposalDocumentPdf/>` usado no server. Vantagens: 100% fiel ao PDF final, paginação correta, header/footer/banners reais.

- Debounced re-render (500ms) ao editar.
- Fallback para o stub atual se `PDFViewer` falhar (browser sem worker).

### 5. Integração Template → Documento (consolidar)

Já existe `setProposalDocumentTemplate`. Ajustes:
- Quando trocar template, **não** sobrescrever campos de tabela já preenchidos.
- Garantir que `applyPagesConfig` traga **todos** os tipos novos do template para o documento.

### 6. Snapshot completo no envio

Atualizar a função que gera versão de envio (a criar/ajustar `createProposalSendVersion`):
```ts
{
  template_snapshot: { template_id, template_version, pages_config, primary_color, accent_color, accent_color_2, ... },
  document_snapshot: { pages, cover_data, solution_data, context_data, scope_items, warranty_text, tables: [...] },
  pdf_storage_path
}
```
Versão enviada é imutável (sem UPDATE no `document_snapshot`).

### 7. Anexos PDF (Fase 2 — apenas estrutura)

Manter `attached_pdf_paths` no schema (já existe). UI fica para Fase 2.

## Arquivos a criar/editar

**Criar:**
- `supabase/migrations/<timestamp>_proposal_tables.sql`
- `src/integrations/proposal-editor/tables.functions.ts`
- `src/integrations/proposal-editor/pdf/TechnicalPages.tsx` (Caracteristicas, Equipamento, Investimento, Impostos, Pagamento, Differentials, Impact, Nota, Contracapa)
- `src/components/proposal-editor/blocks/StructuredTableEditor.tsx`
- `src/components/proposal-editor/blocks/{Caracteristicas,Equipamento,Investimento,Impostos,Pagamento}BlockEditor.tsx`
- `src/components/proposal-editor/ProposalPreviewLive.tsx`

**Editar:**
- `src/integrations/proposal-editor/types.ts` — adicionar `differentials`, `impact`, `nota` em `PageType`; tipos de linha por tabela.
- `src/integrations/proposal-editor/pdf/ProposalDocument.tsx` — mapear novos tipos, passar `tables` como prop.
- `src/integrations/proposal-editor/server.functions.ts` — `generateProposalPdf` carrega `proposal_tables` e injeta no documento; novo `createProposalSendVersion` com snapshot completo.
- `src/integrations/proposal-editor/template.functions.ts` — adicionar `header_banner`/`footer_banner` em `SINGLETON_KINDS`.
- `src/components/proposal-editor/BlockEditorPanel.tsx` — switch por `page.type` apontando para os novos editores.
- `src/routes/app.propostas.$id.editor.tsx` — substituir `EditorPreviewStub` por `ProposalPreviewLive`; carregar `proposal_tables` via query.

## Critérios de aceite (Fase 1)

- [ ] Página "Características" renderiza tabela (PDF + preview).
- [ ] Página "Equipamentos" repete bloco por item de `proposal_items`.
- [ ] Página "Investimento" calcula totais automaticamente.
- [ ] Página "Pagamento" lista parcelas em tabela.
- [ ] Página "Impostos" exibe tributos vindos do Nomus.
- [ ] Preview A4 ao vivo bate visualmente com o PDF gerado.
- [ ] Ao enviar proposta, `proposal_send_versions` salva `template_snapshot` + `document_snapshot` (com tabelas).
- [ ] Trocar template não apaga tabelas estruturadas já preenchidas.

## Fora de escopo (Fase 2)

TipTap expandido (listas/imagens/alinhamento/tabela), upload de PDFs anexos via UI, editores de listas no template (`sobre_diferenciais`, `cases_itens`, etc.), versionamento automático de `template_version`.

