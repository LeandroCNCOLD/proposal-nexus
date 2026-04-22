` agora pra você aprovar e a gente seguir pra Etapa 1 (probe).Desculpa, errei a chamada. Deixa eu reapresentar o plano direito:

<lov-plan>

# Sondar `/tabelasPreco/{id}` para extrair custo/margem por produto

## Hipótese
`GET /tabelasPreco/{id}` no Nomus normalmente devolve produtos da tabela com `precoCusto`, `precoVenda`, `margem` e/ou `markup`. Se confirmado:
1. Custo de materiais por item vira real (substitui o rateio).
2. Margem-base da tabela aparece ao lado da margem real — com badge de erosão quando o desconto comeu margem.

Impostos ficam fora deste cálculo (conforme pedido).

## Etapa 1 — Sondagem ao vivo (descartável)
Nova rota `GET /api/public/nomus/tabela-preco-probe`:
- Sem `?id`: lista `GET /tabelasPreco` e sonda os 2-3 primeiros IDs.
- Com `?id=1,2,3`: sonda IDs específicos.
- Para cada ID retorna: chaves de primeiro nível, chaves do primeiro item do array de produtos (se houver), candidatos a custo/margem (heurística: `custo`, `preco`, `margem`, `markup`, `desconto`).
- Persiste payload bruto em `nomus_sync_log` (entity=`tabelas_preco`, operation=`probe`).

## Etapa 2 — Persistência (depende da Etapa 1)
**As tabelas `nomus_price_tables` e `nomus_price_table_items` já existem.** Só estender:
- `ALTER TABLE nomus_price_table_items` adicionando `preco_custo numeric`, `margem_pct numeric`, `markup_pct numeric` (só os campos que aparecerem no probe).
- Nova função `nomusSyncPriceTables` em `server.functions.ts`: lista `/tabelasPreco`, para cada uma busca `/tabelasPreco/{id}` e faz upsert linha-a-linha.
- Mapper `parseNomusPriceTableItem` em `parse.ts`.

## Etapa 3 — Uso no item da proposta
Em `ProposalItemLucroAnalysis.tsx`:
- Quando o item tem `nomus_product_id`, buscar em `nomus_price_table_items` usando o `tabela_preco_nomus_id` da proposta (já está em `nomus_proposals`).
- Custo de materiais real = `preco_custo × quantidade`.
- Margem-base = `margem_pct` da linha — exibida como referência.
- Lucro bruto recalculado = `total_with_discount − custo_materiais` (sem impostos).
- Badge "Desconto reduziu margem em X pp" quando `margem_real < margem_base`.
- Painel de diagnóstico para de avisar "custos não disponíveis" quando há linha na tabela.

## Etapa 4 — UI de controle
Botão **"Sincronizar tabelas de preço"** em `app.configuracoes.nomus.tsx` que dispara `nomusSyncPriceTables` sob demanda (não vai pro cron).

## Arquivos afetados
- `src/routes/api.public.nomus.tabela-preco-probe.ts` — novo
- `supabase/migrations/*` — ALTER em `nomus_price_table_items`
- `src/integrations/nomus/parse.ts` — `parseNomusPriceTableItem`
- `src/integrations/nomus/server.functions.ts` — `nomusSyncPriceTables`
- `src/components/ProposalItemLucroAnalysis.tsx` — custo real + badge de margem
- `src/routes/app.configuracoes.nomus.tsx` — botão de sync

## Fora de escopo
- MOD e CIF — não vivem em tabela de preço.
- Impostos no recálculo deste bloco.
- Histórico de variação.

## Risco
Se o probe mostrar que `/tabelasPreco/{id}` só traz `precoVenda` (sem custo/margem), Etapas 2-4 ainda valem para medir **desconto efetivo vs preço de tabela** — mas o cálculo de margem real continua impossível via API. Te aviso assim que o probe rodar.

## Próximo passo
Publicar o app → eu rodo o probe → leio `nomus_sync_log` → confirmo quais campos a sua instalação expõe → seguimos (ou ajustamos) Etapas 2-4.

