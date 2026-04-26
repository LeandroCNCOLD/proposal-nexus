## Plano ajustado — separar ambiente atual x resultado geral primeiro

Você está correto: antes de evoluir os gráficos e a IA, a estrutura precisa garantir que cada bloco está lendo o escopo correto. Vou reorganizar o ColdPro para separar claramente o Resultado do Ambiente Atual do Resultado Geral do Projeto.

### Objetivo principal
Evitar qualquer mistura entre:
- dados do ambiente selecionado;
- dados consolidados do projeto inteiro;
- dados usados pela IA;
- dados usados por gráficos, auditoria e memorial.

A aba Resultado passará a ter dois blocos independentes:

```text
Resultado
├─ Resultado do ambiente atual
│  ├─ cálculo do ambiente selecionado
│  ├─ seleção de equipamento desse ambiente
│  ├─ auditoria desse ambiente
│  └─ IA desse ambiente
│
└─ Resultado Geral do Projeto
   ├─ consolidação de todos os ambientes
   ├─ totais globais
   ├─ comparativo entre ambientes
   ├─ auditoria consolidada
   └─ IA geral do projeto
```

## Etapa 1 — Separar os normalizadores

### 1. Criar/renomear normalizador do ambiente
Criar `src/modules/coldpro/core/environmentResultNormalizer.ts`.

Ele será responsável exclusivamente por um ambiente:
- `environment`
- `result` daquele ambiente
- `selection` daquele ambiente
- `products` daquele ambiente
- `advancedProcesses` daquele ambiente

Função:
```ts
normalizeColdProEnvironmentResult({ environment, result, selection, products, advancedProcesses })
```

Esse normalizador substituirá o uso genérico atual de `normalizeColdProResult` para deixar explícito que o resultado é por ambiente.

### 2. Criar consolidador do projeto
Criar `src/modules/coldpro/core/projectResultConsolidator.ts`.

Função:
```ts
consolidateColdProProjectResult({ project, environments, results, selections, products, advancedProcesses })
```

Ele vai:
- normalizar cada ambiente individualmente;
- somar carga requerida, kW, TR, segurança, subtotal e capacidade selecionada;
- montar ranking de ambientes por carga;
- consolidar distribuição global por grupo;
- consolidar alertas críticos;
- indicar se o projeto tem divergência crítica em qualquer ambiente.

## Etapa 2 — Reorganizar a aba Resultado

Atualizar `src/routes/app.coldpro.$id.tsx` e componentes ColdPro para exibir dois blocos separados:

### Bloco A — Resultado do ambiente atual
Este bloco deve usar somente:
- `selectedEnv`
- `result` do `selectedEnv`
- `selection` do `selectedEnv`
- `products` filtrados pelo `selectedEnv.id`
- `advancedProcesses` filtrados pelo `selectedEnv.id`

Título sugerido:
`Resultado do ambiente atual — {nome do ambiente}`

### Bloco B — Resultado Geral do Projeto
Este bloco deve usar todos os ambientes do projeto.

Título sugerido:
`Resultado Geral do Projeto`

Esse bloco ficará abaixo do resultado do ambiente e será visualmente identificado como consolidado.

## Etapa 3 — Separar componentes por escopo

### Ambiente atual
Manter/adaptar `ColdProResultCard.tsx` como componente de ambiente, ou criar:
```text
ColdProEnvironmentResultDashboard.tsx
```

Responsável por:
- resumo do ambiente;
- carga do ambiente;
- seleção de equipamento do ambiente;
- auditoria do ambiente;
- IA do ambiente;
- tabelas técnicas do ambiente.

### Resultado geral
Criar:
```text
ColdProProjectResultDashboard.tsx
```

Responsável por:
- resumo consolidado do projeto;
- totais globais;
- ranking de ambientes;
- capacidade total selecionada;
- alertas globais;
- IA geral do projeto;
- acesso ao memorial consolidado.

## Etapa 4 — Separar a IA por escopo

Atualizar `aiTechnicalContextBuilder.ts` para dois contextos:

```ts
buildColdProEnvironmentAIContext(normalizedEnvironmentResult)
buildColdProProjectAIContext(consolidatedProjectResult)
```

Regras:
- IA do ambiente não pode analisar totais globais como se fossem daquele ambiente.
- IA geral não pode dizer que um ambiente tem erro usando soma de outro ambiente.
- A regra crítica continua:
  - se `productKcalH = 0` e `tunnelProcessKcalH > 0`, não afirmar ausência de carga de produto;
  - classificar como produto/processo especial de túnel.

## Etapa 5 — Ajustar memorial/relatório

Atualizar `ColdProReport.tsx` para deixar claro:

1. Resumo Geral do Projeto
   - totais consolidados;
   - ranking por ambiente;
   - status global.

2. Memorial por Ambiente
   - cada ambiente com seus próprios dados;
   - auditoria individual;
   - equipamento individual;
   - alerta de túnel/processo quando aplicável.

Assim o relatório não mistura carga global com carga de ambiente.

## Etapa 6 — Revalidar gráficos existentes depois da separação

Os gráficos já criados serão mantidos, mas conectados ao normalizador correto:
- gráficos do ambiente atual usam `environmentResultNormalizer`;
- gráficos globais usam `projectResultConsolidator`.

Se algum gráfico estiver lendo array global dentro do bloco do ambiente, será corrigido.

## Etapa 7 — Validação final

Rodar:
```text
bunx tsc --noEmit
bun run build
```

Critérios de aceite desta etapa:
- Resultado do ambiente atual mostra apenas dados do ambiente selecionado.
- Resultado Geral do Projeto mostra apenas dados consolidados.
- Existe `environmentResultNormalizer`.
- Existe `projectResultConsolidator`.
- IA do ambiente recebe somente contexto do ambiente.
- IA geral recebe contexto consolidado.
- O alerta de produto direto zerado com túnel/processo permanece correto.
- Build e typecheck passam.

## Depois desta etapa
Com a separação validada, a próxima evolução será refinar os gráficos e a IA em dois níveis:
- gráficos/IA do ambiente;
- gráficos/IA do projeto consolidado.