

# Integração completa de itens de proposta (com Análise de Lucro)

Documento confirma que o endpoint `GET /propostas/{idProposta}/itens/{idItem}` **existe no Nomus** e retorna tudo que está faltando: impostos discriminados (ICMS, IPI, PIS, COFINS, IBS, CBS), Análise de Lucro com 23 campos, atributos do produto, centros de custo, frete/seguro/pesos por item.

Vou conectar isso na ferramenta — sem criar uma nova tabela espelho. Como o JSON do item é grande e variável, persistimos no campo `raw` que já existe em `nomus_proposal_items` e mostramos na UI imediatamente.

## O que muda

### 1. Endpoint no mapa
`src/integrations/nomus/endpoints.ts` — adicionar helper:
```text
proposalItemDetailPath(propostaId, itemId) → /propostas/{propostaId}/itens/{itemId}
```
com 2 fallbacks (`/propostas/itens/{itemId}` e `/itensPropostas/{itemId}`) tentados em sequência se o primeiro 404'ar.

### 2. Server function `nomusGetItemDetail` (estende a atual)
`src/integrations/nomus/server.functions.ts`:
- Antes de devolver, chamar `GET /propostas/{nomusPropostaId}/itens/{nomusItemId}` no Nomus.
- Se sucesso: **fazer UPSERT no `raw` do `nomus_proposal_items`** mesclando o detalhe completo (chave `_detail`) e atualizar `synced_at`. Assim, próximas aberturas já saem instantâneas.
- Devolver no payload um novo campo `item_detail_json` (string JSON) com o retorno bruto.
- Fallback: se 404 nos 3 paths, devolver `item_detail_error` para a UI mostrar aviso amigável (não quebra).

### 3. Migração leve no banco
**Não** vamos criar `proposta_itens_detalhes` (duplicaria o que já existe em `nomus_proposal_items.raw`). Em vez disso:
- Adicionar coluna `analise_lucro JSONB` em `nomus_proposal_items` (consultas rápidas sem desserializar o `raw` inteiro).
- Adicionar coluna `impostos JSONB` em `nomus_proposal_items` (mesmo motivo).
- Índice GIN em `analise_lucro` para futuros relatórios de margem.

A função de sincronização preenche essas duas colunas a partir do detalhe que acabou de buscar.

### 4. Componente novo `ProposalItemLucroAnalysis`
`src/components/ProposalItemLucroAnalysis.tsx` — renderiza os 23 campos da Análise de Lucro em 4 blocos:
- **Composição do valor**: Valor produtos → Descontos → Valor total com desconto.
- **Impostos a recolher**: ICMS, ICMS-ST, IPI, PIS, COFINS, ISSQN, Simples.
- **Custos**: Materiais, MOD, CIF, Administrativos, Incidentes lucro → Total.
- **Resultado**: Lucro Bruto + margem %, Lucro antes impostos, Lucro Líquido + margem %.

### 5. `NomusItemDetailDialog` — abas enriquecidas
Já tem 7 abas. Vou substituir os placeholders `—` pelos dados reais vindos de `item_detail_json`:
- **Tributos**: usa `_detail.icms/ipi/pis/cofins/ibs/cbs` (base, alíquota, valor, FCP, fundamentação legal).
- **Lucro**: substitui o conteúdo atual pelo `<ProposalItemLucroAnalysis>` com `analiseLucro`.
- **Geral / Comercial / Fiscal**: completa frete, seguro, pesos, CFOP, tabela de preço, classificação financeira a partir do detail.
- Header mostra badge "Detalhe completo carregado" quando o detail veio.

## Fluxo
```text
Usuário clica num item da proposta
  → modal abre com prefill (instantâneo, dados locais)
  → server fn busca /propostas/{id}/itens/{itemId}
  → grava raw._detail + analise_lucro + impostos no Supabase
  → UI rerenderiza com tributos detalhados, análise de lucro completa,
     atributos e centros de custo
```

## Arquivos tocados
- `supabase/migrations/<novo>.sql` — colunas `analise_lucro`, `impostos` + índice GIN
- `src/integrations/nomus/endpoints.ts` — helper + fallbacks
- `src/integrations/nomus/server.functions.ts` — fetch detail + persist + retorno
- `src/components/ProposalItemLucroAnalysis.tsx` — novo
- `src/components/NomusItemDetailDialog.tsx` — preenche abas com detail real

## Fora de escopo
- Sincronização em massa de itens detalhados (vai ser sob demanda na abertura do modal — evita centenas de chamadas no cron). Posso adicionar um botão "Sincronizar todos os itens desta proposta" depois se quiser.
- Tela de relatório de margem por item (a coluna `analise_lucro` JSONB já fica pronta para isso na próxima evolução).

