

# Buscar custo via `/produtos/{id}` usando query (`?query=codigo=...`)

## Descoberta-chave
Você está certo: a Nomus suporta `?query=campo=valor`. Já está documentado em `docs/nomus-endpoints.md`:
- `GET /produtos/{id}` — produto por ID
- `GET /produtos?query=codigo=CN-200-LT-...` — produto por código

Confirmado também: `/tabelasPreco/{id}` **só traz preço de venda** (`preco`), zero custo. Então a única chance de custo via API é no nível do **produto individual**, não da tabela.

E ainda não temos prova ao vivo de quais campos `/produtos/{id}` expõe nesta instância — o probe rodou mas o raw não foi persistido pro log (só o sumário). Por isso a Etapa 1 ainda é necessária.

## Etapa 1 — Re-rodar probe de produtos com persistência do raw

Ajustar `src/routes/api.public.nomus.produto-probe.ts` para:
- Persistir o **payload bruto** completo em `nomus_sync_log.response` (hoje só guarda o sumário).
- Sondar 3 IDs reais já presentes (8576, 687, 6575).
- Heurística atual já cobre `custo`, `preco`, `margem`, `compra`, `medio`.

Rodar e ler via psql pra confirmar quais campos de custo o seu Nomus expõe (ex.: `precoCusto`, `custoMedio`, `valorUltimaCompra`, `margemBase`, etc.).

## Etapa 2 — Persistência (depende da Etapa 1)

**Não criar tabela nova.** Adicionar colunas em `equipments` (já tem `nomus_id`):
- `custo_unitario numeric` — preço de custo do produto
- `custo_medio numeric` — custo médio se existir
- `margem_base_pct numeric` — margem cadastrada se existir
- `nomus_raw_produto jsonb` — payload bruto pra debug
- `nomus_detail_synced_at timestamptz`

Só criar as colunas que aparecerem de verdade na Etapa 1.

## Etapa 3 — Sync de detalhes de produto

Nova função `nomusSyncProductDetails` em `server.functions.ts`:
- Para cada `equipments` com `nomus_id`, chama `GET /produtos/{nomus_id}`.
- Mapper `parseNomusProductDetail` em `parse.ts` extrai os campos confirmados na Etapa 1.
- Faz update no `equipments`.
- **Sob demanda** (não vai pro cron): centenas de chamadas seriam pesadas.

## Etapa 4 — Uso no item da proposta

Em `ProposalItemLucroAnalysis.tsx`:
- Quando o item tem `nomus_product_id` que casa com um `equipment.nomus_id`, usa `equipment.custo_unitario × quantidade` como **custo real de materiais**.
- Lucro bruto recalculado = `total_with_discount − custo_materiais` (sem impostos, conforme pedido anterior).
- Se `margem_base_pct` existir, exibe badge "Desconto reduziu margem em X pp" quando margem real < margem base.
- Painel de diagnóstico para de avisar "custos não disponíveis" quando o equipamento tem custo sincronizado.

## Etapa 5 — UI de controle

Botão **"Sincronizar custos de produtos"** em `app.configuracoes.nomus.tsx` que dispara `nomusSyncProductDetails`. Mostra contador (X/Y produtos sincronizados).

## Arquivos afetados
- `src/routes/api.public.nomus.produto-probe.ts` — ajuste pra persistir raw
- `supabase/migrations/*` — colunas de custo em `equipments`
- `src/integrations/nomus/parse.ts` — `parseNomusProductDetail`
- `src/integrations/nomus/server.functions.ts` — `nomusSyncProductDetails`
- `src/components/ProposalItemLucroAnalysis.tsx` — usar custo real + badge de margem
- `src/routes/app.configuracoes.nomus.tsx` — botão de sync

## Fora de escopo
- MOD e CIF — não vivem em cadastro de produto.
- Impostos no recálculo deste bloco.
- Endpoint `?query=codigo=...` — só faz sentido se você quiser buscar produto por código a partir do item da proposta, mas o item já vem com `idProduto`, então `/produtos/{id}` é mais direto.

## Risco
Se a Etapa 1 mostrar que `/produtos/{id}` nesta instância **também não traz custo** (igual `/tabelasPreco`), as Etapas 2-5 perdem o sentido. Aí a conclusão é definitiva: custos não estão na API REST do Nomus pra esta chave/instalação, e a única alternativa vira cadastro manual no `equipments`. Te aviso assim que rodar.

## Próximo passo (precisa de você)
Aprovar o plano → eu ajusto o probe pra salvar o raw → publicar → rodo e mostro os campos exatos.

