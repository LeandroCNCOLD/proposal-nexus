

# Sondar tabela de preço ID 18 com foco em custo/MOD/CIF

## Contexto
Sua screenshot mostra que o Nomus armazena por item de tabela: `Custo de materiais`, `Custo de MOD`, `Custo CIF`, `Custos adm`, `Margem de lucro desejada (%)`, `Lucro líquido`, `Margem de contribuição`. Isso **resolveria** o cálculo de margem real — se a API expuser.

O probe anterior (`/tabelasPreco/{id}` em outras tabelas) só retornou `preco` por item, mas pode ter sido limitação da heurística de busca por chave, não ausência real do dado.

## Etapa 1 — Probe direcionado (descartável)

Nova rota `GET /api/public/nomus/tabela-preco-deep-probe?id=18`:

- Chama `GET /tabelasPreco/18` e salva o **payload bruto completo** em `nomus_sync_log.response` (sem filtro nem heurística — JSON cru).
- Retorna no body: status HTTP, total de itens no array, **todas** as chaves do primeiro item (sem filtro de "candidatos a custo"), e também todas as chaves dos itens 2 e 3 (caso variem).
- Procura explicitamente por: `custoMateriais`, `custoMOD`, `custoCIF`, `custosAdm`, `custoProducaoTotal`, `margemLucroDesejada`, `margemContribuicao`, `lucroLiquido`, `lucroUnitarioPrevisto`, `precoUnitarioCalculado` e variações snake_case.
- Sonda também `GET /tabelasPreco/18?query=ativo=true` — talvez paginação/filtro mude o shape.

## Etapa 2 — Decisão (depende do resultado da Etapa 1)

**Cenário A — campos de custo aparecem no payload bruto:**
Tabelas `nomus_price_table_items` (já existe) ganham colunas: `custo_materiais`, `custo_mod`, `custo_cif`, `custos_adm`, `margem_desejada_pct`, `preco_calculado`. Sync popula. `ProposalItemLucroAnalysis.tsx` casa `nomus_product_id` + `nomus_price_table_id` e calcula margem real = `(unit_price − custo_total) / unit_price`. Badge "desconto comeu X pp da margem desejada".

**Cenário B — payload bruto também só traz `preco`:**
Confirmação definitiva: API REST do Nomus não expõe custos de tabela de preço, mesmo eles existindo na UI interna. Aí ou (i) cadastro manual em `equipments`, ou (ii) você abre chamado com a Nomus pedindo expansão do endpoint.

## Arquivos afetados (Etapa 1)
- `src/routes/api.public.nomus.tabela-preco-deep-probe.ts` — nova rota descartável
- (sem migration, sem mudança de UI)

## Próximo passo
Aprovar → eu crio a rota → você publica → eu rodo `?id=18` → leio raw no `nomus_sync_log` → te trago lista exata de campos → decidimos A ou B.

