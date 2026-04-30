
## Objetivo

Hoje a tabela de preço é escolhida **uma vez por proposta** (campo `proposals.price_table_id`) e aplicada a todos os itens. A regra de negócio nova exige escolha **por item**, considerando apenas as tabelas em que aquele produto realmente existe, com sugestão automática por UF + maior ICMS, fallbacks e troca manual.

A boa notícia: o schema já está quase pronto. A coluna `proposal_items.price_table_id` (com `price_table_name` e `price_table_match_method`) existe e é usada hoje pelo sync do Nomus. Vamos passar a usá-la também para a escolha do vendedor.

---

## Mudanças no banco

Migration única, aditiva:

1. `ALTER TABLE proposal_items` — adicionar:
   - `price_table_match_method`: já existe; passa a aceitar valores `'auto_uf_max_icms' | 'auto_max_icms' | 'auto_latest' | 'manual' | 'nomus_sync'`.
   - `price_table_unit_price numeric(14,2)` — snapshot do preço de tabela no momento da escolha (para auditoria e para não depender de re-fetch a cada render).
   - `price_table_selected_at timestamptz` — quando foi feita a escolha atual.
2. Sem alteração em `nomus_price_tables` / `nomus_price_table_items` — já têm `ufs[]`, `is_active`, `unit_price`, `nomus_product_id`. ICMS continua extraído do nome (regex existente) — não há campo dedicado e o usuário não pediu para criar um.

Nada é destrutivo. RLS atual de `proposal_items` já cobre escrita.

---

## Server functions novas (`src/features/price-table-picker/price-table-picker.functions.ts`)

1. **`listPriceTablesForProducts({ nomusProductIds })`** — para cada produto, retorna a lista de tabelas ativas que possuem aquele produto, com `{ id, name, ufs, icmsPct, unitPrice, currency }`. Uma única query: `nomus_price_table_items JOIN nomus_price_tables` filtrando por `is_active = true` e `nomus_product_id IN (...)`. Devolve um `Map<nomusProductId, EligibleTable[]>`.

2. **`setProposalItemPriceTable({ proposalItemId, priceTableId, priceTableName, unitPrice, matchMethod })`** — UPDATE em `proposal_items` gravando os 5 campos + `price_table_selected_at = now()`. RLS já garante que só quem vê a proposta pode atualizar.

3. Manter `getPriceTableItemsForProducts` e `setProposalPriceTable` atuais para retrocompatibilidade (o picker no header ainda funciona como "tabela padrão da proposta", mas deixa de ser fonte de verdade dos itens).

---

## Lógica de seleção (cliente, em `selectTableForItem.ts`)

```text
input: tabelas elegíveis do produto, uf do cliente
1. compatíveis = tabelas.filter(t => t.is_active && t.ufs.includes(uf))
2. se compatíveis.length > 0:
     return compatíveis.sort(desc icmsPct)[0]
     reason = 'auto_uf_max_icms'
3. ativas = tabelas.filter(t => t.is_active)
4. comIcms = ativas.filter(t => t.icmsPct != null)
   se comIcms.length > 0:
     return comIcms.sort(desc icmsPct)[0]
     reason = 'auto_max_icms'  (fallback: UF não coberta)
5. se ativas.length > 0:
     return ativas.sort(desc syncedAt)[0]
     reason = 'auto_latest'
6. return null  (produto sem tabela)
```

`matchMethod = 'manual'` somente quando o vendedor troca explicitamente no dropdown.

---

## UI

### Coluna “Tabela aplicada” na tabela de itens (`ProposalItemsTable`)

Substituir a célula atual `Tabela de preço` (read-only) por um **dropdown por linha** (`PerItemPriceTablePicker`). O dropdown:

- Lista somente tabelas onde aquele `nomus_product_id` existe.
- Itens compatíveis com a UF do cliente vêm primeiro, com badge **“UF {SP}”**.
- Maior ICMS dentre as compatíveis ganha badge **“Maior ICMS”**.
- Tabela atualmente aplicada mostra o ícone de check.
- Footer do dropdown: link “Limpar / voltar à sugestão automática”.

Indicadores visuais ao lado do nome da tabela na linha:
- `match_method = auto_uf_max_icms` → chip cinza “Sugerida por UF”.
- `match_method = auto_max_icms` → chip âmbar “UF não coberta · maior ICMS geral”.
- `match_method = auto_latest` → chip âmbar “Sem ICMS cadastrado · mais recente”.
- `match_method = manual` → chip azul “Alterada manualmente”.
- `null` (nenhuma tabela disponível) → chip vermelho “Produto sem tabela de preço”.

### Recálculo

Ao trocar a tabela, o cliente já tem todos os dados (`listPriceTablesForProducts` retorna `unitPrice` por tabela), então as colunas existentes recalculam imediatamente:
- `Tabela unit.` = `unitPrice` da tabela escolhida
- `Tabela total` = `unitPrice * quantidade`
- `Desconto (R$)` = `tableTotal - saleTotal`
- `Desconto (%)` = `(tableUnit - offered) / tableUnit * 100`
- `Margem estimada` = adicionar coluna opcional quando `unit_cost` existir no item (já temos `nomus_price_table_items.custos_*`); fora deste escopo se o usuário quiser, deixa-se um TODO no código. **Vou implementar margem só se `preco_liquido` ou `custo_producao_total` estiver disponível** — mostrando “—” caso contrário, sem inventar valor.

A persistência é otimista: dispara o `setProposalItemPriceTable` em background, com toast de sucesso/erro. Em caso de erro, reverte o estado local.

### Auto-aplicar sugestão na primeira renderização

Quando carregamos os itens, para cada item **sem `price_table_id`** (ou sem `price_table_selected_at` — nunca tocado pelo usuário), aplicamos a regra de seleção automática e salvamos. Isso roda uma vez por carregamento, em paralelo, com toast silencioso. Se o item já tem escolha manual (`match_method = 'manual'`), nunca sobrescrevemos.

### Picker global (header) — o que fazer

Mantemos o `PriceTablePicker` atual no campo “Tabela de preço” do cabeçalho **como atalho “Aplicar a todos”**: trocar a label para “Tabela padrão da proposta (aplicar a todos os itens)” e, ao escolher, aplicar a todos os itens que ainda não estão `manual`. Isso preserva o comportamento anterior sem conflito.

---

## Arquivos

**Novos**
- `src/features/price-table-picker/select-table-for-item.ts` — lógica pura de seleção + tipos (testável, isomórfica).
- `src/features/price-table-picker/PerItemPriceTablePicker.tsx` — dropdown por linha.
- `src/features/price-table-picker/use-item-price-tables.ts` — hook React Query que carrega `listPriceTablesForProducts` e expõe `tablesByProduct`, `applyAuto`, `applyManual`.

**Editados**
- `src/features/price-table-picker/price-table-picker.functions.ts` — adicionar `listPriceTablesForProducts` e `setProposalItemPriceTable`.
- `src/modules/proposals/components/ProposalVisuals.tsx` — `ProposalItemsTable` recebe `tablesByProduct`, `clientUf`, `onChangeItemTable`; renderiza o picker por linha + chips de status; calcula colunas a partir do `priceTableUnitPrice` snapshot do item.
- `src/components/NomusProposalDetail.tsx` — usar o novo hook em vez do `getPriceTableItemsForProducts` global; remover dependência de `selectedPriceTableId` para popular preços; disparar auto-aplicação na montagem.
- `src/routes/app.propostas.$id.index.tsx` — sem alteração de contrato (já passa `localClient.state` e `localProposalId`).

**Migration** — `proposal_items: + price_table_unit_price, + price_table_selected_at`.

---

## Detalhes técnicos relevantes

- O ICMS continua sendo parseado de `nomus_price_tables.name` (regex `/ICMS\s*([0-9]+(?:[.,][0-9]+)?)/i`). Tabelas sem padrão de nome retornam `icmsPct = null` e caem para o fallback `auto_latest`.
- `nomus_price_table_items` tem unique `(price_table_id, nomus_product_id)` → garante 1 preço por par. Boa para o lookup.
- A query principal `listPriceTablesForProducts` deve usar `.in("nomus_product_id", ids)` com chunks de 500 (limite do schema atual já documentado).
- `proposal_items.price_table_id ON DELETE SET NULL` já está configurado, então não precisamos tratar tabelas removidas — viram “sem tabela” automaticamente.
- A regra **“não altera preço de venda do Nomus”** é respeitada: `unit_price` (preço vendido) nunca é tocado; só `price_table_*` mudam.

---

## O que NÃO está incluído

- Coluna “Margem estimada” real só aparece se a tabela tiver `preco_liquido`/`custos_*` para o item (dados do CSV de custos). Caso contrário mostra “—”. Se quiser uma análise mais profunda, é outra task.
- Nenhuma mudança no fluxo de aprovações/PDF/templates — escopo foi explicitamente “bloco de itens da proposta”.
