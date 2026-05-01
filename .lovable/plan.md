## Objetivo

Corrigir a seção "Análise de lucro" para que:

1. **"Valor total dos produtos"** = soma dos **totais de tabela** (Tabela total = preço de tabela × qtd), não dos preços de venda.
2. **"Descontos incondicionais"** = diferença entre o total de tabela e o total de venda, com tratamento explícito para casos em que a venda está **acima** da tabela (ágio).
3. **"Valor total com desconto"** = total de venda real (o que o cliente paga hoje), garantindo que `tabela − desconto = venda`.
4. Deixar o agregador local **preparado para ser substituído** pela integração futura com o Nomus, sem reescrever a UI.

## Como funcionará o cálculo

Para cada item:

```text
total_tabela_item = preço_tabela_unit × quantidade
total_venda_item  = preço_venda_unit  × quantidade − desconto_item
delta_item        = total_tabela_item − total_venda_item
                    (positivo = desconto; negativo = ágio)
```

Agregando a proposta:

```text
Valor total dos produtos     = Σ total_tabela_item
Desconto bruto (concedido)   = Σ max(0,  delta_item)
Ágio bruto (acima da tabela) = Σ max(0, -delta_item)
Desconto líquido             = Desconto bruto − Ágio bruto
Valor total com desconto     = Valor total dos produtos − Desconto líquido
                             = Σ total_venda_item   (identidade garantida)
```

### Sugestão para o caso "venda acima da tabela"

Como a linha "(-) Descontos incondicionais" precisa fechar a conta, vamos exibir o **desconto líquido** (pode ficar negativo, indicando ágio). Para dar visibilidade ao usuário sem poluir a tabela, adicionamos **duas sub-linhas informativas** abaixo (estilo das sub-linhas de custo de produção que já existem):

```text
(-) Descontos incondicionais          -R$ 20.745
    >>> Desconto concedido            R$ 17.001  (itens 01, 03, 04)
    >>> Ágio sobre tabela             R$  3.744  (itens 02, 06 − valor "a mais")
```

Assim o usuário vê o líquido (que fecha a soma) e entende a composição. Quando não houver ágio, as sub-linhas ficam ocultas para não poluir.

## Preparação para substituição futura pelo Nomus

Hoje o agregador `agg` mistura cálculo local + fallback para campos do Nomus dentro do componente `NomusProposalDetail`. Vamos isolar isso:

- Criar `src/features/proposal-totals/compute-proposal-totals.ts` exportando uma função pura `computeProposalTotals({ items, snapshots, nomus })` que retorna o objeto `agg` no formato que a UI já consome.
- Criar tipo `ProposalTotalsSource = "snapshot_local" | "nomus"` no retorno, para a UI mostrar o aviso ("Totais calculados a partir das tabelas aplicadas" vs. "Totais oficiais do Nomus").
- Regra de prioridade dentro da função:
  1. Se a proposta tem `nomus_totais_oficiais` (campo a ser preenchido no futuro pela integração), usar Nomus direto.
  2. Caso contrário, calcular localmente a partir dos snapshots dos itens (lógica atual + correções de tabela/desconto/ágio acima).
- A UI (`NomusProposalDetail.tsx`) só consome `computeProposalTotals(...)` — quando a integração com Nomus chegar, basta alterar a função, não a UI.

## Arquivos a alterar

- **Novo**: `src/features/proposal-totals/compute-proposal-totals.ts` — função pura + tipos.
- **Editar**: `src/components/NomusProposalDetail.tsx`
  - Substituir o `useMemo` `agg` por `useMemo(() => computeProposalTotals(...), [...])`.
  - Adicionar as duas `SubRow` ("Desconto concedido" / "Ágio sobre tabela") logo abaixo da linha de "(-) Descontos incondicionais", renderizadas condicionalmente.

Nada muda em rotas, banco de dados ou outras telas.

## Resultado esperado (com os números atuais)

```text
Valor total dos produtos              R$ 291.866
(-) Descontos incondicionais          -R$  20.745
    >>> Desconto concedido            R$  17.001
    >>> Ágio sobre tabela             R$   3.744
(=) Valor total com desconto          R$ 271.121
... (resto inalterado)
```
