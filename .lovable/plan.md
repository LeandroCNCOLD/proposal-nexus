## Plano unificado — preços por código em todas as telas

Hoje a regra de "achar tabelas pelo código do produto" funciona na **listagem de itens da proposta** (já corrigido), mas a aba **Preços** dentro do diálogo de detalhe do item ainda usa o id/UUID interno e por isso aparece "Nenhum preço cadastrado". O objetivo é unificar: **um único critério de matching (`product_code`)** alimentando tanto a listagem quanto o diálogo, e enriquecer a aba Preços para mostrar todas as tabelas encontradas com UF/ICMS.

---

## Causa raiz

Em `nomus_price_table_items`, a coluna `nomus_product_id` na verdade guarda o **código do produto** (ex.: `CN-030-LT-EV-6-22T-NA`) — não o UUID interno do Nomus.

- Listagem da proposta: já usa `product_code` ✅
- Diálogo "Preços" do item: ainda usa `item.nomus_product_id` ❌ (linha 2040 de `src/integrations/nomus/server.functions.ts`)

---

## Mudanças

### 1. `src/integrations/nomus/server.functions.ts` — `nomusGetItemDetail`

Na seção "5) Preços do produto em todas as tabelas de preço (Nomus)":

- Trocar a chave de busca: usar `item.product_code` como prioridade; cair para `item.nomus_product_id` apenas como fallback (compatibilidade com itens antigos onde `product_code` esteja nulo).
- Estender o `select` em `nomus_price_tables` para trazer também `ufs` (array) e qualquer coluna adicional útil para a UI (`is_active`, `currency`, `code`, `name`, `nomus_id` já vêm). O ICMS continua sendo derivado do nome via regex no cliente — mesma lógica que a listagem usa, sem coluna nova.
- Ordenar resultado por `is_active desc, unit_price asc` para apresentação consistente.

### 2. `src/components/NomusItemDetailDialog.tsx` — aba "Preços" enriquecida

A `PrecosSection` hoje mostra Tabela / Código / Moeda / Preço / Status. Agora que vão aparecer várias tabelas para o mesmo código, vamos enriquecer:

- Nova coluna **UF** — lista as UFs cobertas pela tabela (truncada se passar de 4: "SP, RJ, MG, +3").
- Nova coluna **ICMS %** — extraído do nome da tabela com a mesma regex já existente (`/ICMS\s*([0-9]+(?:[.,][0-9]+)?)/i`); mostra "—" quando não detectável.
- Linha em destaque (`bg-primary/5` + badge "aplicada") para a tabela cujo `price_table_id` corresponde à atualmente selecionada no item da proposta — comparação por id, não por preço (evita falso positivo quando duas tabelas têm o mesmo valor).
- Pequeno cabeçalho informativo: "X tabelas encontradas para o código `CN-…` · UF do cliente: SP" — ajuda o vendedor a auditar visualmente.

Para que o destaque por id funcione, o `PrefillItem` precisa expor `price_table_id` (hoje só tem `unit_price`). Ajuste:

- Adicionar `price_table_id?: string | null` ao tipo `PrefillItem`.
- Em `NomusProposalDetail.tsx`, ao montar o `prefill` passado ao `NomusItemDetailDialog`, incluir o `price_table_id` vindo de `localItemsByNomusId[...]`.

### 3. Sem migração de schema

Todos os dados já existem em `nomus_price_table_items` e `nomus_price_tables`. É só corrigir o filtro do servidor e enriquecer a renderização do diálogo.

---

## Arquivos editados

- `src/integrations/nomus/server.functions.ts` — corrigir filtro de `nomus_price_table_items` (usar `product_code`) e estender `select`.
- `src/components/NomusItemDetailDialog.tsx` — enriquecer `PrecosSection` (colunas UF/ICMS, destaque por id, cabeçalho informativo) e tipo `PrefillItem`.
- `src/components/NomusProposalDetail.tsx` — passar `price_table_id` no `prefill` para o diálogo.

## Resultado esperado

Em qualquer item da proposta (ex.: `CN-030-LT-EV-6-22T-NA`) → aba **Preços**:

- Lista todas as tabelas que contêm aquele código, com UF, ICMS %, moeda, preço e status.
- A tabela atualmente aplicada na proposta aparece destacada como "aplicada".
- A regra "matching pelo código" passa a ser **uma só** em todo o sistema (listagem + diálogo).
