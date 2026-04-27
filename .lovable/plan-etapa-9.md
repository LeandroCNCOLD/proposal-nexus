# Etapa 9 — Page Builder com Blocos Inteligentes

> Status: planejado · Aprovação: aguardando validação do usuário antes de Fase 1
> Estratégia: refator hard, sem retrocompatibilidade. Propostas existentes serão regeneradas via "Reprocessar tudo".

---

## 1. Visão geral

Transformar o editor atual (formulário lateral + preview parcial) em um **construtor de páginas baseado em blocos inteligentes**. Cada página é uma sequência de blocos tipados, alguns auto-preenchidos do Nomus/template, outros editáveis pelo vendedor.

**Princípio:** 80% automático e estruturado, 20% editável manualmente. Sem editor 100% livre — vendedor não quebra layout, engenharia consegue customizar.

```
Template (defaults visuais + blocos padrão por tipo de página)
   ↓
Páginas (ordem + visibilidade + tipo)
   ↓
Blocos dentro da página (tipados, com source: nomus|template|manual)
   ↓
Campos automáticos do Nomus (autofill + reprocessar)
   ↓
Edição manual controlada (por bloco, com lock opcional)
   ↓
Preview A4 (renderer dedicado por tipo de bloco)
   ↓
PDF final (mesmo renderer, em @react-pdf/renderer)
```

---

## 2. Modelo de dados

### 2.1 Schema TypeScript (`src/features/page-builder/types.ts`)

```ts
export type PageType =
  | "cover"
  | "about"
  | "cases"
  | "objective"
  | "context"
  | "scope"
  | "characteristics"
  | "equipment"
  | "investment"
  | "taxes"
  | "payment"
  | "warranty"
  | "note"
  | "back-cover"
  | "attached-pdf"
  | "free";

export type BlockType =
  // Texto & mídia
  | "heading"           // título/subtítulo da página
  | "rich_text"         // texto livre (Tiptap)
  | "image"             // imagem inline ou full-page
  // Tabelas
  | "technical_table"   // tabela técnica (caracteristicas)
  | "investment_table"  // tabela de investimento (produtos + total geral)
  | "payment_table"     // condições de pagamento
  | "tax_table"         // base de cálculo de impostos
  | "characteristics_table" // dados técnicos chave/valor
  // Listas
  | "included_items"    // o que está incluso
  | "excluded_items"    // o que NÃO está incluso
  // Estruturados
  | "bank_data"         // dados bancários
  | "cover_identity"    // bloco da capa: logo + cliente + projeto + nº + data + responsável
  | "back_cover_contact"// bloco da contracapa: contato/CTA
  | "warranty_terms"    // termos de garantia
  | "signature"         // espaço de assinatura
  | "attached_pdf";     // referência a PDF anexo

export type BlockSource = "manual" | "nomus" | "template" | "computed";

export interface DocumentBlock<TData = Record<string, unknown>> {
  id: string;
  type: BlockType;
  title?: string;
  data: TData;
  source: BlockSource;       // origem do conteúdo (afeta UI: ícone + botão "voltar ao automático")
  locked?: boolean;          // true = vendedor não pode editar
  order: number;
  // Anchor estável p/ scroll-sync (opcional, default = id)
  anchor?: string;
}

export interface DocumentPage {
  id: string;
  type: PageType;
  title: string;
  order: number;
  visible: boolean;
  blocks: DocumentBlock[];
}

export interface ProposalDocumentV2 {
  id: string;
  proposal_id: string;
  template_id: string | null;
  template_version: "v2";    // schema bump
  pages: DocumentPage[];
  attached_pdf_paths: string[];
  manually_edited_block_ids: string[];
  auto_filled_at: string | null;
  last_edited_by: string | null;
  last_edited_at: string;
  created_at: string;
  updated_at: string;
}
```

### 2.2 Migração Supabase

**Refator hard:** vamos **substituir** `proposal_documents.pages` pelo novo schema e **remover** colunas obsoletas (`cover_data`, `solution_data`, `context_data`, `scope_items`, `warranty_text`, `custom_blocks`).

```sql
-- Migration: refactor proposal_documents to block-based schema
ALTER TABLE public.proposal_documents
  DROP COLUMN IF EXISTS cover_data,
  DROP COLUMN IF EXISTS solution_data,
  DROP COLUMN IF EXISTS context_data,
  DROP COLUMN IF EXISTS scope_items,
  DROP COLUMN IF EXISTS warranty_text,
  DROP COLUMN IF EXISTS custom_blocks,
  DROP COLUMN IF EXISTS manually_edited_fields;

ALTER TABLE public.proposal_documents
  ADD COLUMN manually_edited_block_ids text[] NOT NULL DEFAULT '{}';

UPDATE public.proposal_documents SET template_version = 'v2', pages = '[]'::jsonb;
```

> Tabelas estruturadas (`proposal_tables`) **continuam existindo** porque ainda são úteis para tabelas grandes editadas linha-a-linha. Cada bloco do tipo `*_table` referencia uma `proposal_table` por id (`data.table_id`) ou armazena rows inline (`data.rows`) — definido por bloco.

### 2.3 Snapshot de envio

`proposal_send_versions.document_snapshot` passa a guardar o `ProposalDocumentV2` completo + blocos resolvidos (sem placeholders, sem refs).

---

## 3. Arquitetura de código

```
src/features/page-builder/
  types.ts                       # tipos acima
  block-registry.ts              # registry { type → { editor, renderer, defaults, label, icon } }
  defaults/
    page-templates.ts            # blocos default por tipo de página
    block-defaults.ts            # data inicial por tipo de bloco
  serializers/
    document-v2.serializer.ts    # parse/stringify seguro do JSON do banco
  autofill/
    apply-nomus-to-blocks.ts     # mapeia dados do Nomus para blocos[].data
    apply-template-to-blocks.ts  # aplica defaults do template aos blocos
  hooks/
    use-document-builder.ts      # estado central: pages, blocks, dirty, autosave
    use-block-mutations.ts       # add/remove/reorder/update bloco
    use-active-page-scroll.ts    # scroll-sync sidebar ↔ preview

src/components/page-builder/
  PageBuilderEditor.tsx          # raiz: topbar + sidebar fina + canvas A4
  PagesSidebar.tsx               # lista compacta de páginas (drag p/ reordenar)
  BlockPalette.tsx               # paleta de blocos disponíveis (drag-source)
  PageCanvas.tsx                 # uma página A4 renderizada com blocos
  BlockSlot.tsx                  # wrapper p/ cada bloco no canvas (toolbar + drop zone)
  blocks/
    HeadingBlock.tsx
    RichTextBlock.tsx
    ImageBlock.tsx
    TechnicalTableBlock.tsx
    InvestmentTableBlock.tsx
    PaymentTableBlock.tsx
    TaxTableBlock.tsx
    CharacteristicsTableBlock.tsx
    IncludedItemsBlock.tsx
    ExcludedItemsBlock.tsx
    BankDataBlock.tsx
    CoverIdentityBlock.tsx
    BackCoverContactBlock.tsx
    WarrantyTermsBlock.tsx
    SignatureBlock.tsx
    AttachedPdfBlock.tsx
  registry.tsx                   # mapeia BlockType → componente Editor + Preview
```

> `src/integrations/proposal-editor/pdf/*` ganha um renderer paralelo por tipo de bloco para gerar o PDF final do mesmo schema.

---

## 4. UX final

### 4.1 Layout do editor (substitui o atual)

```
┌──────────────────────────────────────────────────────────────────┐
│ Topbar: Voltar · Editor · Salvando… · Template ▾ · Sincronizar  │
│         Reprocessar · Salvar · Materializar · PDF · Enviar       │
├──────┬───────────────────────────────────────────────────────────┤
│ Pgs  │   ╔═══════════════════════════════════════════╗           │
│ ─ ─  │   ║  PÁGINA A4 (canvas WYSIWYG, edição inline)║           │
│ Capa │   ║                                            ║           │
│●Sobr │   ║   [bloco: cover_identity]                  ║           │
│ Obj  │   ║   [bloco: heading]                         ║           │
│ Cont │   ║   [bloco: rich_text] ← clica e edita       ║           │
│ Esc  │   ║   [+ adicionar bloco]                      ║           │
│ Inv  │   ╚═══════════════════════════════════════════╝           │
│ Imp  │   ╔═══════════════════════════════════════════╗           │
│ Pag  │   ║  PRÓXIMA PÁGINA                            ║           │
│ Gar  │   ║  ...                                       ║           │
│ Note │   ╚═══════════════════════════════════════════╝           │
│ Cont │                                                            │
│ + add│   [paleta de blocos arrastáveis — overlay flutuante]      │
└──────┴───────────────────────────────────────────────────────────┘
```

- Sidebar esquerda **fina** (~200px): só lista de páginas. Drag p/ reordenar. Botão "+ Adicionar página" abre menu com tipos.
- Canvas central **ocupa o resto**: páginas A4 empilhadas, scroll vertical contínuo. Edição inline em cada bloco.
- Clicar numa página na sidebar → scroll suave até ela no canvas (intersection observer destaca página ativa na sidebar).
- Adicionar bloco: botão "+" entre blocos abre dropdown filtrado pela página, OU paleta flutuante (toggle no topbar) com drag-source.
- Cada bloco tem toolbar contextual no hover: ⋮⋮ (drag), 🔒 (lock), ↻ (voltar ao automático), 🗑 (remover).
- Source visual: ícone discreto no canto do bloco — 🔌 nomus, 📋 template, ✏️ manual, ⚙️ computed.

### 4.2 Adicionar página

Modal/menu com tipos pré-configurados. Cada tipo nasce com blocos default:

| Tipo                  | Blocos default                                                          |
|-----------------------|-------------------------------------------------------------------------|
| `cover`               | cover_identity                                                          |
| `about`               | heading + rich_text (do template)                                       |
| `cases`               | heading + rich_text (do template)                                       |
| `objective`           | heading + rich_text                                                     |
| `context`             | heading + rich_text + characteristics_table (cliente)                   |
| `scope`               | heading + rich_text + included_items + excluded_items                   |
| `characteristics`     | heading + characteristics_table                                         |
| `equipment`           | heading + technical_table                                               |
| `investment`          | heading + investment_table                                              |
| `taxes`               | heading + tax_table + rich_text (observação)                            |
| `payment`             | heading + payment_table + bank_data                                     |
| `warranty`            | heading + warranty_terms                                                |
| `note`                | heading + rich_text                                                     |
| `back-cover`          | back_cover_contact                                                      |
| `attached-pdf`        | attached_pdf                                                            |
| `free`                | (vazio — vendedor monta do zero)                                        |

### 4.3 Autofill do Nomus

Botão "Sincronizar do Nomus" na topbar percorre os blocos e popula `data` quando `source === "nomus"` (ou quando `overwriteManualFields=true`):

- `cover_identity` → cliente, projeto, número, data, responsável
- `investment_table` → linhas de produtos
- `payment_table` → parcelas
- `tax_table` → alíquotas
- `characteristics_table` (context) → CNPJ, endereço, contatos
- demais blocos: ignorados

---

## 5. Fases de execução

> Cada fase é uma mensagem separada. Ao final de cada fase: app funciona, sem regressão. Próxima fase só começa quando você validar.

### Fase 1 — Fundamentos (próxima mensagem após você aprovar este plano)

1. Migration do `proposal_documents` (drop colunas antigas + reset `pages`).
2. Tipos novos em `src/features/page-builder/types.ts`.
3. Registry vazio (apenas mapa `BlockType → { label, defaultData }`).
4. Defaults de páginas (`page-templates.ts`).
5. **Substituir** rota `app.propostas.$id.editor.tsx` por uma versão simplificada que: lê `pages: DocumentPage[]` do doc, renderiza placeholder por bloco ("Bloco {type} — em construção"), permite adicionar página com tipo, salva.
6. Botão "Inicializar com defaults do template" (cria pages a partir do template selecionado).

**Critério:** Editor abre, lista páginas, adiciona/remove/reordena páginas, salva. Preview ainda é stub. Nenhum bloco tem editor real ainda.

### Fase 2 — Renderers + editores básicos

Implementar editor + preview de: `heading`, `rich_text`, `cover_identity`, `bank_data`, `signature`, `attached_pdf`. Canvas A4 começa a parecer documento real.

### Fase 3 — Renderers de tabela

`investment_table`, `payment_table`, `tax_table`, `characteristics_table`, `technical_table`. Cada um conectado às `proposal_tables` existentes (refs por id).

### Fase 4 — Listas, imagens, garantia, contracapa

`included_items`, `excluded_items`, `image`, `warranty_terms`, `back_cover_contact`.

### Fase 5 — Drag-and-drop + paleta

`@dnd-kit/core` + `@dnd-kit/sortable` para reordenar páginas, reordenar blocos, e arrastar da paleta para o canvas.

### Fase 6 — Autofill + scroll-sync + lock/source UI

Reescreve `apply-nomus-to-blocks.ts`. Botão sincronizar funciona no schema novo. Scroll-sync sidebar ↔ canvas. Toolbar de bloco com lock/source/voltar-ao-automático.

### Fase 7 — PDF renderer

Renderer paralelo em `@react-pdf/renderer` por tipo de bloco. PDF final usa o mesmo schema que o canvas.

### Fase 8 — Limpeza

Remover código morto: `BlockEditorPanel.tsx`, `EditorPagePanel.tsx`, `EditorProposalPreview.tsx`, `proposal-editor/blocks/*` antigos, `proposal-editor/preview/*` antigos, `proposal-pdf/*` antigos. Remover defaults antigos de `document-pages.defaults.ts`.

---

## 6. Decisões já tomadas

- **Sem retrocompatibilidade:** propostas existentes ficam com `pages: []` após migration. Vendedor clica "Inicializar com defaults do template" + "Sincronizar do Nomus" para regenerar.
- **Tabelas grandes ficam em `proposal_tables`:** blocos do tipo `*_table` referenciam por id, não duplicam rows no JSON do documento.
- **Scroll-sync é obrigatório:** clicar na página na sidebar rola para ela no canvas; scroll do canvas atualiza página ativa na sidebar.
- **Drag-and-drop fica para Fase 5:** Fases 1–4 usam botões "↑↓" e "+ adicionar".
- **Source visual é mandatório** desde a Fase 2: sem indicar de onde veio o dado, o vendedor vai apagar bloco automático sem perceber.

---

## 7. Riscos & mitigações

| Risco                                                         | Mitigação                                                                 |
|---------------------------------------------------------------|---------------------------------------------------------------------------|
| Vendedor edita bloco automático e perde ao reprocessar        | Botão "Reprocessar" pergunta se quer sobrescrever editados manualmente.   |
| Migration apaga dados sem volta                               | Rodar em horário combinado; backup é responsabilidade do Supabase + aviso explícito ao usuário ANTES de aprovar a migration. |
| PDF e canvas divergem visualmente                             | Renderer compartilha tokens de design (cores, espaçamentos) via `pdf/styles.ts`. Snapshot test visual em Fase 7. |
| Drag-and-drop quebra acessibilidade                           | `@dnd-kit` tem suporte nativo a teclado; manter botões "↑↓" como fallback.|
| Custo de TS check com schema grande                           | Tipar blocos com generics (`DocumentBlock<TData>`) só quando necessário; usar `Record<string, unknown>` no schema base. |

---

## 8. O que NÃO está no escopo da Etapa 9

- Versionamento de blocos individual (histórico granular).
- Comentários/aprovação inline por bloco.
- Templates de bloco salvos pelo usuário ("meus blocos favoritos").
- Multi-coluna dentro de uma página (sempre 1 coluna).
- Edição colaborativa em tempo real (multi-cursor).

Esses ficam para etapas futuras se o feedback do uso pedir.
