

# Investigar custos por produto via `/produtos/{id}` e exibir no item da proposta

## Por que isso pode resolver

Hoje o sync de `/produtos` só linka o `nomus_id` ao equipamento — descarta o resto do payload. O endpoint `GET /produtos/{id}` do Nomus normalmente expõe campos de **custo do produto** (preço de custo, custo médio, última compra, margem-base) que a proposta consolidada não traz. Se confirmado, isso preenche pelo menos parte das lacunas de "Custos de produção / Materiais" por item — sem depender do endpoint `/propostas/{id}/itens/{itemId}` (que está dando 404 nesta instância).

## Etapa 1 — Sondagem ao vivo (descoberta)

Criar uma rota de diagnóstico **temporária** `GET /api/nomus/produto-probe?id={nomusProductId}` que:
- Chama `GET /produtos/{id}` no Nomus para 3 IDs reais já presentes (8576, 687, 8490).
- Devolve a lista de **chaves de primeiro nível** + amostra mascarada do payload.
- Loga em `nomus_sync_log` para auditoria.

Isso nos dá a verdade do ambiente em vez de adivinhar nomes de campo.

## Etapa 2 — Persistência (depende do que a Etapa 1 mostrar)

Migration acrescentando ao `equipments` (ou a uma nova `nomus_products`, decisão tomada após ver o payload):
- `nomus_raw jsonb` — payload bruto do produto
- `custo_unitario numeric`, `custo_medio numeric`, `custo_ultima_compra numeric`, `preco_venda_base numeric`, `margem_base_pct numeric` — quando existirem nos dados reais
- `nomus_detail_synced_at timestamptz`

Atualizar `nomusSyncProducts` em `src/integrations/nomus/server.functions.ts` para, após o match, buscar `/produtos/{id}` e gravar esses campos. Adicionar mapper em `src/integrations/nomus/parse.ts` (`parseNomusProduct`).

## Etapa 3 — Uso no item da proposta

Em `src/components/ProposalItemLucroAnalysis.tsx`:
- Quando o item tem `nomus_product_id`, buscar o equipamento vinculado e usar `custo_unitario × quantidade` como **custo real de materiais por item** (substitui o rateio proporcional atual para esse bloco).
- Recalcular: lucro bruto do item = `total_with_discount − custo_materiais_real − impostos_rateados`.
- Atualizar o painel de diagnóstico para parar de avisar "custos não disponíveis" quando o produto trouxer custo.

## Etapa 4 — UI de controle

Em `src/routes/app.configuracoes.nomus.tsx`, adicionar botão **"Sincronizar detalhes de produtos"** que dispara o enriquecimento sob demanda (igual ao padrão atual de propostas). Evita centenas de chamadas no cron.

## Arquivos afetados
- `src/routes/api.nomus.produto-probe.ts` — novo (sondagem temporária)
- `supabase/migrations/*` — colunas de custo em `equipments`
- `src/integrations/nomus/parse.ts` — `parseNomusProduct`
- `src/integrations/nomus/server.functions.ts` — enriquecimento + nova função `nomusSyncProductDetails`
- `src/components/ProposalItemLucroAnalysis.tsx` — usar custo real no cálculo
- `src/routes/app.configuracoes.nomus.tsx` — botão de sync de detalhes

## Fora de escopo
- Custos de MOD / CIF / administrativos — esses **não vivem no cadastro de produto**; permanecem indisponíveis via API (limitação confirmada do Nomus REST nesta instalação).
- Histórico de variação de custo do produto.

## Risco/incerteza
A Etapa 1 é obrigatória antes de prometer qualquer coisa. Se `/produtos/{id}` também não expuser custos nesta instalação (possível, se a chave REST tiver permissão restrita ao módulo comercial), as etapas 2–4 perdem o sentido e a conclusão será: custos de produto também só existem no ERP interno. Eu te aviso assim que o probe rodar.

