# Blocos Visuais de Capa CN Cold

Evoluir o Page Builder existente adicionando **3 novos `BlockType`** que renderizam capas profissionais full-page (816×1056), reaproveitando `ProposalDocumentContext` como fallback de dados. Nenhuma quebra de blocos existentes, integrações Nomus/ColdPro/financeiro/PDF engine.

## 1. Novos BlockTypes

Em `src/integrations/proposal-editor/types.ts`, adicionar à união `BlockType`:

- `cover_main_cn_cold`
- `cover_institutional_cn_cold`
- `cover_clients_cases_cn_cold`

Adicionar `defaultLayoutFor` para os três retornando `{ x:0, y:0, w:A4_W, h:A4_H }` (capa full-page).

## 2. Estrutura de `block.data` (compartilhada)

```ts
{
  background_image?: string,
  logo_url?: string,
  title?: string,
  subtitle?: string,
  paragraphs?: string[],          // capa 2
  images?: { url: string, caption?: string }[], // capa 1 (grid lateral) e capa 2
  cases?: {                        // capa 3
    title: string,
    subtitle?: string,
    image_url?: string,
    featured?: boolean,
  }[],
  client_logos?: { url: string, name?: string }[], // capa 3
  footer?: {
    telefone?: string,
    site?: string,
    email?: string,
    cidade?: string,
  },
  // específicos de capa 1 quando se quer sobrescrever o contexto:
  client_name?: string,
  proposal_number?: string,
  proposal_date?: string,
  vendedor?: string,
}
```

Regra **híbrida**: cada campo lê primeiro `block.data`, e se vazio cai em `documentContext` via helpers existentes (`resolveDynamicFieldFromCtx`, `resolveClientBox`, etc.). Cores/imagens só usam `block.data` (sem fallback).

## 3. Componentes React (editor — canvas A4)

Criar pasta `src/components/proposal-editor/cn-cold-covers/`:

- `CoverMainCnCold.tsx` — Capa 1
  - Fundo azul institucional (`#0c2340` ou `template.primary_color`) com camada de `background_image` opcional (overlay 60%).
  - Logo no topo (canto superior esquerdo).
  - Título "PROPOSTA TÉCNICA E COMERCIAL" + subtítulo editável.
  - Bloco branco/translúcido com: cliente, projeto, nº, data, responsável (resolvidos do contexto).
  - Grid lateral direito (3-4 thumbs) de `images[]` decorativas.
  - Rodapé faixa azul-escura com telefone, site, e-mail, cidade.

- `CoverInstitutionalCnCold.tsx` — Capa 2
  - Título + parágrafos institucionais (rich text múltiplos).
  - Imagem da fábrica (`images[0]` ou `background_image`).
  - Bloco "Por que escolher a CN Cold?" com lista (`paragraphs` ou items).
  - Imagem da linha de equipamentos (`images[1]`).
  - Slogan/frase institucional.
  - Rodapé padrão.

- `CoverClientsCasesCnCold.tsx` — Capa 3
  - Título "Soluções em Refrigeração Industrial" + subtítulo "Engenharia • Fabricação • Instalação • Manutenção".
  - Case principal em destaque (`cases.find(c=>c.featured)`).
  - Grid de cases (2×2 ou 2×3) restantes.
  - Grid de logos de clientes (`client_logos`).
  - Nota pequena: "Marcas exibidas pertencem aos respectivos titulares".
  - Rodapé padrão.

Cada componente recebe `{ block, setData, locked, documentContext, template }`. Modo edição: clique nos textos abre `Input`/`Textarea` inline; campos vazios mostram **placeholder** com valor do contexto (mesmo padrão dos `*_box` existentes). Imagens usam o `ImageUploadButton` já existente em `BlockRenderer`.

Helper compartilhado `cn-cold-covers/use-cover-defaults.ts` para resolver footer/identidade do contexto.

## 4. Registro no BlockRenderer (editor)

Em `src/components/proposal-editor/BlockRenderer.tsx` (`switch(block.type)` dentro de `BlockBody`), adicionar 3 novos `case` que delegam aos componentes acima, passando `documentContext` e `template`.

## 5. Renderer no PDF

Criar `src/integrations/proposal-editor/pdf/cn-cold-covers/`:

- `CoverMainCnColdPdf.tsx`, `CoverInstitutionalCnColdPdf.tsx`, `CoverClientsCasesCnColdPdf.tsx`

Cada um recebe `(block, ctx)` e retorna um `<View>` `@react-pdf/renderer` que reproduz visualmente o componente do editor (fundos, logo, grids de imagens, rodapé). Usa `proposal` já injetado em `BlockRenderContext` (cliente, número, data, vendedor, telefone, site, email).

Em `BlockPdfRenderer.tsx` adicionar 3 `case` que delegam aos novos componentes.

**Importante**: como os blocos são full-page (816×1056 ≈ A4), o ProposalCanvas/PDF já posiciona via `layout.x/y/w/h`. Os componentes apenas preenchem o retângulo recebido.

## 6. Paleta (FieldsPalette)

Em `ALL_PALETTE_GROUPS` adicionar novo grupo:

```
"Capas CN Cold":
  - Capa Principal (cover_main_cn_cold)
  - Capa Institucional (cover_institutional_cn_cold)
  - Capa Cases & Clientes (cover_clients_cases_cn_cold)
```

Usuário arrasta para a página e o bloco é criado full-page com layout default.

## 7. Defaults seed (opcional)

Em `makeDefaultBlocksForPage` deixar `case "cover"` inalterado (preserva compat). Os novos blocos são adicionados manualmente via paleta — o usuário decide quando usar.

## Arquivos novos
- `src/components/proposal-editor/cn-cold-covers/CoverMainCnCold.tsx`
- `src/components/proposal-editor/cn-cold-covers/CoverInstitutionalCnCold.tsx`
- `src/components/proposal-editor/cn-cold-covers/CoverClientsCasesCnCold.tsx`
- `src/components/proposal-editor/cn-cold-covers/use-cover-defaults.ts`
- `src/integrations/proposal-editor/pdf/cn-cold-covers/CoverMainCnColdPdf.tsx`
- `src/integrations/proposal-editor/pdf/cn-cold-covers/CoverInstitutionalCnColdPdf.tsx`
- `src/integrations/proposal-editor/pdf/cn-cold-covers/CoverClientsCasesCnColdPdf.tsx`

## Arquivos editados (mínimo, aditivo)
- `src/integrations/proposal-editor/types.ts` — 3 entradas em `BlockType` + `defaultLayoutFor`
- `src/components/proposal-editor/BlockRenderer.tsx` — 3 `case` no switch
- `src/integrations/proposal-editor/pdf/BlockPdfRenderer.tsx` — 3 `case` no switch
- `src/components/proposal-editor/FieldsPalette.tsx` — novo grupo "Capas CN Cold"

## Preservado
Page Builder, autosave, geração de PDF, versões, anexos, ColdPro, Nomus, financeiro, blocos antigos (`cover_identity` etc.), `ProposalDocumentContext`.

## Resultado
O usuário arrasta "Capa Principal" / "Capa Institucional" / "Capa Cases" da paleta para uma página em branco e obtém capas profissionais já preenchidas com dados da proposta (cliente, número, data, vendedor, contatos da empresa). Pode editar título, subtítulo, parágrafos, imagens, cases e logos inline. PDF gerado com aparência equivalente.
