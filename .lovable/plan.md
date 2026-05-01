## Objetivo

Trocar a regra de seleção automática da tabela de preço para seguir esta ordem:

1. **Filtrar por UF** do cliente — só considera tabelas que cobrem o estado.
2. **Escolher a tabela com `unitPrice` mais próximo** do preço unitário do item (vindo do Nomus).
3. **Selecionar essa tabela** e **preencher todos os campos** dependentes (tabela unit., tabela total, desconto, % desconto) automaticamente.

## Fluxo detalhado

Para cada item da proposta, ao auto-aplicar:

1. Pegar `clientUf` (estado da proposta) e `item.unitPrice` (preço Nomus).
2. **Etapa UF**: filtrar tabelas ativas onde `tabela.ufs` inclui a UF do cliente.
3. **Etapa preço mais próximo** (dentre as compatíveis com a UF):
   - Considerar apenas as que têm `unitPrice != null`.
   - Calcular `|tabela.unitPrice − item.unitPrice|`.
   - Selecionar a de **menor diferença absoluta**.
   - Tie-break em caso de empate exato: menor ICMS → mais recente (`syncedAt`).
4. **Etapa preencher campos**: persistir tabela escolhida + snapshot do `unitPrice` da tabela. Os campos derivados (tabela total = `unitPrice × quantidade`, desconto = `tabela_total − total_item`, % = `desconto / tabela_total`) já são calculados na grid a partir do snapshot.

### Fallbacks (quando a etapa 1 ou 2 não encontra nada)

- **Sem UF cadastrada no cliente** ou **nenhuma tabela cobre a UF**: usar todas as tabelas ativas e aplicar a etapa 2 (preço mais próximo) global.
- **Nenhuma tabela tem `unitPrice` cadastrado**: cair na regra antiga (menor ICMS → mais recente).
- **Item sem `unitPrice` válido (≤ 0 ou nulo)**: cair na regra antiga (UF + menor ICMS → menor ICMS → mais recente). Sem preço de referência, não dá pra comparar proximidade.

## Mudanças técnicas

### 1. `src/features/price-table-picker/select-table-for-item.ts`
- Adicionar parâmetro `itemUnitPrice: number | null` em `selectTableForItem`.
- Adicionar novos `MatchMethod`:
  - `"auto_uf_closest_price"` (UF + preço mais próximo — caso ideal)
  - `"auto_closest_price"` (preço mais próximo, UF não coberta — fallback)
- Nova ordem de prioridade:
  1. UF compatível + tabelas com `unitPrice` → menor `|diff|` → `auto_uf_closest_price`.
  2. Sem UF compatível, mas há tabelas com `unitPrice` → menor `|diff|` global → `auto_closest_price`.
  3. Item sem `unitPrice` válido → mantém regras antigas (UF + menor ICMS → menor ICMS → mais recente).
  4. Último fallback: tabela mais recente (`auto_latest`).

### 2. `src/features/price-table-picker/use-item-price-tables.ts`
- Em `applyAuto`, passar `item.unitPrice` para `selectTableForItem`.

### 3. `src/features/price-table-picker/price-table-picker.functions.ts`
- Estender o enum Zod de `matchMethod` no `setProposalItemPriceTable` para aceitar `"auto_uf_closest_price"` e `"auto_closest_price"`.

### 4. `src/components/NomusProposalDetail.tsx`
- Em `shouldRefreshAuto` (linhas ~218–223), incluir os métodos antigos (`auto_uf_min_icms`, `auto_min_icms`, `auto_uf_max_icms`, `auto_max_icms`, `auto_latest`) **e** os novos no recheck, para que itens já marcados sejam reavaliados ao recarregar a proposta com a nova regra.
- Passar `itemUnitPrice={it.unitPrice}` para o `<PerItemPriceTablePicker>` (para destacar a tabela mais próxima na lista).

### 5. `src/features/price-table-picker/PerItemPriceTablePicker.tsx`
- Aceitar prop opcional `itemUnitPrice: number | null`.
- Reordenar a lista do popover: dentro do grupo "compatíveis com UF", ordenar por proximidade do `itemUnitPrice` (ao invés de menor ICMS).
- Trocar o chip "Menor ICMS" por **"Mais próximo"** quando `itemUnitPrice` está disponível.
- Em `MatchMethodChip`, adicionar rótulos:
  - `auto_uf_closest_price` → "Sugerida por UF · preço mais próximo"
  - `auto_closest_price` → "UF não coberta · preço mais próximo"

## Banco de dados

Não exige migração: `price_table_match_method` é `text` livre. Só atualizamos o enum Zod no server function.

## Por que isso resolve o que está faltando

Hoje os campos "tabela unit.", "tabela total", "desconto", "% desconto" não aparecem porque a tabela escolhida pela regra antiga (menor ICMS) tem um `unitPrice` muito distante do preço do Nomus, então o vendedor enxerga a tabela "errada" e os números ficam desconectados. Ao casar pela proximidade de preço dentro da mesma UF, a tabela escolhida bate com o preço do item — e os campos derivados passam a fazer sentido imediatamente.
