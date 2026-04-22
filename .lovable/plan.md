

# Etapa 1 (probe exaustivo) + Etapa 2 (importador CSV)

## Decisão
Seguir com o caminho CSV, mas antes esgotar as variações de endpoint da API REST do Nomus que ainda não foram testadas. Se algum retornar custo, o sync fica automático. Se nenhum retornar, o CSV vira fonte oficial — sem retrabalho, porque a infra de banco e UI já fica pronta nesta mesma rodada.

## Etapa 1 — Probe exaustivo (descartável, ~5 min)

Nova rota `src/routes/api.public.nomus.exhaustive-probe.ts`:

Testa em sequência (com `idProposta=161`, `idItem=526`, `idProduto` real, `idTabela=18`):
- `/itensProposta/{id}` (singular)
- `/propostas/{id}/items/{idItem}` (inglês)
- `/analiseLucro/{idItem}`
- `/analiseLucro?query=idItemProposta=526`
- `/propostas/{id}?incluirAnaliseLucro=true`
- `/propostas/{id}?expand=itens.analiseLucro`
- `/propostas/{id}?fields=*,itens.analiseLucro.*`
- `/produtos/{id}/custos`
- `/produtos/{id}?incluirCusto=true`
- `/tabelasPreco/{id}/itens?incluirCustos=true`

Cada chamada salva payload bruto em `nomus_sync_log`. Resposta da rota: tabela `path → status → tem_custo? → primeiras chaves do payload`.

**Critério:** se algum endpoint retornar `custoMateriais`/`custoMOD`/`custoCIF` reais → marco como Cenário A revivido e adapto o sync. Se todos 404/sem custo → seguimos com CSV como fonte definitiva.

## Etapa 2 — Importador CSV (independe da Etapa 1)

### Migration
Adicionar em `nomus_price_table_items`:
- `custo_materiais`, `custo_mod`, `custo_cif`, `custos_adm`, `custo_producao_total`, `custos_venda` (numeric)
- `preco_calculado`, `preco_liquido` (numeric)
- `margem_desejada_pct`, `lucro_bruto`, `lucro_liquido`, `margem_contribuicao` (numeric)
- `unidade_medida` (text)
- `import_source` (text: `'csv' | 'api' | 'manual'`)
- `imported_at` (timestamptz)
- `has_cost_data` (boolean — false quando todos os custos = 0)

Nova RLS: INSERT/UPDATE/DELETE liberados para `admin`/`gerente_comercial`/`diretoria`/`engenharia`.

Nova tabela `nomus_cost_imports` (auditoria):
- `id`, `price_table_id` (FK), `filename`, `total_rows`, `inserted_count`, `updated_count`, `skipped_count`, `imported_by`, `imported_at`.
RLS: SELECT autenticado, INSERT pelos mesmos roles acima.

### Parser
`src/integrations/nomus/csv-parser.ts`: detecta encoding (Windows-1252 e UTF-8), separador `;`, decimal `,`, normaliza headers para chaves canônicas, retorna `{ rows, warnings, columnMap }`. Tolerante a colunas extras/faltantes.

### Tela de importação
Nova rota `src/routes/app.configuracoes.nomus.importar-custos.tsx` (link adicionado em `app.configuracoes.nomus.tsx`):

1. Dropdown "Tabela de preço de destino" (lendo `nomus_price_tables`).
2. Drag-drop de `.csv`.
3. Preview dos 10 primeiros itens parseados + contagens (total, com custo, sem custo, código não encontrado na tabela).
4. Modo dry-run obrigatório → mostra "X update, Y insert, Z mantidos".
5. Botão "Confirmar importação" → server function que faz upsert por `(price_table_id, nomus_product_id via product_code)` e grava em `nomus_cost_imports`.
6. Histórico das últimas 10 importações.

### Server function
`src/integrations/nomus/server.functions.ts`: `importPriceTableCostsFromCSV({ priceTableId, rows, dryRun })` com middleware de auth e checagem de role.

### Análise de margem real
`src/components/ProposalItemLucroAnalysis.tsx`:
- Lookup: `proposal.tabela_preco_nomus_id + item.product_code` → `nomus_price_table_items`.
- Quando `has_cost_data = true`:
  - Margem real = `(unit_price − custo_producao_total − custos_adm) / unit_price`.
  - Comparativo: "Desejada X% · Real Y% · Perdeu Z pp por desconto".
  - Badges: 🟢 ≥ desejada · 🟡 50–100% da desejada · 🔴 < 50% ou negativa.
- Quando `has_cost_data = false`: badge cinza "Sem custo cadastrado nesta tabela".
- Tooltip: "Custo importado em DD/MM/AAAA via CSV".

## Arquivos afetados

**Etapa 1:**
- `src/routes/api.public.nomus.exhaustive-probe.ts` (novo, descartável)

**Etapa 2:**
- Migration: colunas + RLS write em `nomus_price_table_items`, nova tabela `nomus_cost_imports`
- `src/integrations/nomus/csv-parser.ts` (novo)
- `src/routes/app.configuracoes.nomus.importar-custos.tsx` (novo)
- `src/integrations/nomus/server.functions.ts` (+ função de import)
- `src/routes/app.configuracoes.nomus.tsx` (+ link)
- `src/components/ProposalItemLucroAnalysis.tsx` (cálculo real + badges)

## Ordem de execução

1. Crio rota de probe exaustivo.
2. Você publica.
3. Eu rodo a rota e leio o resultado.
4. Te trago veredito: "achei custo em X" ou "nenhum endpoint expõe".
5. Independente do resultado, sigo com migration + parser + tela + análise (CSV vira fonte primária ou complementar).

