Plano para ajustar a Etapa 5 — Ar, vazão e ventilação

Vou alterar apenas a Etapa 5 em `src/components/coldpro/ColdProTunnelForm.tsx`, sem mexer na Etapa 3, banco de dados, carga térmica por kg ou propriedades térmicas do produto.

## 1. Reorganizar a base de cálculo exibida

A Etapa 5 passará a tratar claramente estes valores como coisas diferentes:

- Massa no túnel, em kg
- Tempo disponível/retenção, em min
- Capacidade da esteira, em kg/h
- Tempo estimado de congelamento, em min
- Condições de ar necessárias

A capacidade da esteira será apresentada pela fórmula correta:

```text
capacidade_esteira_kg_h = massa_no_tunel_kg × 60 / tempo_retencao_min
```

Para o exemplo citado:

```text
195 kg × 60 / 11,8 min = 991,5 kg/h
```

Se a massa vier do modo “densidade superficial da esteira”, a massa física da esteira continua sendo a fonte principal. Caso contrário, a massa instantânea será derivada do fluxo e tempo de retenção, apenas como leitura informativa.

## 2. Remover a “capacidade real” baseada em tempo térmico

Vou remover da interface da Etapa 5:

- “Capacidade real possível” calculada como `massa / tempo estimado`
- “Tempo na capacidade real”
- “Margem real/nominal”
- mensagens que transformam tempo térmico em kg/h
- variáveis auxiliares que sustentam essa leitura ambígua, quando não forem mais usadas

A Etapa 5 não vai mais recalcular kg/h da esteira a partir do tempo térmico.

## 3. Ajustar a pergunta central da Etapa 5

A mensagem principal será substituída por algo no formato:

```text
Com {massa} kg dentro do túnel durante {tempo} min,
quais condições de ar são necessárias para congelar essa massa nesse tempo?
```

E a validação será apresentada assim:

```text
Com {massa} kg dentro do túnel durante {tempo} min:
O modelo estima {tempo_estimado} min para congelamento completo.
Status: Congela no tempo / Não congela no tempo.
```

## 4. Corrigir o botão “Calcular ar”

Ao clicar em “Calcular ar”, o cálculo vai assumir:

```text
massa_alvo = massa_no_tunel_kg
tempo_alvo = tempo_retencao_min
```

O botão não vai alterar massa, carga térmica por kg, propriedades do produto ou dados da Etapa 3.

Ele vai dimensionar os parâmetros operacionais de ar para tentar atingir:

```text
tempo_estimado_congelamento <= tempo_alvo
```

Ajustes previstos:

- calcular o `h necessário` para o tempo de retenção atual
- converter esse `h necessário` em velocidade de ar de referência
- calcular vazão necessária por seção livre
- manter a vazão mínima pelo balanço térmico da carga
- preencher vazão/velocidade/temperatura/ΔT/evaporação nos campos da Etapa 5
- atualizar a mensagem técnica depois do cálculo

## 5. Preservar a regra do h manual

A regra será:

- h manual continua tendo prioridade na validação final
- h calculado/sugerido aparece como referência de dimensionamento
- o sistema não vai assumir automaticamente o h calculado como manual sem o usuário confirmar
- o botão “Usar h sugerido” continua sendo a confirmação explícita do usuário

Na tela, vou deixar isso escrito com clareza para evitar a impressão de que o sistema aprovou o h automaticamente.

## 6. Ajustar os cards de resultado da Etapa 5

A área de resultados da Etapa 5 ficará focada nestes cards:

- Capacidade da esteira: `{kg/h}`
- Massa no túnel: `{kg}`
- Tempo disponível: `{min}`
- Tempo estimado: `{min}`
- Status: `Congela no tempo` ou `Não congela no tempo`
- Temperatura do ar: `{T_ar}`
- Temperatura de evaporação: `{T_evap}`
- ΔT evaporador/ar: `{ΔT}`
- Vazão necessária: `{m³/h}`
- Vazão informada/dimensionada: `{m³/h}`
- Velocidade do ar: `{m/s}`
- h manual: `{W/m²K}` ou pendente
- h estimado/necessário: `{W/m²K}` como referência

## 7. Mensagens de viabilidade

Quando estiver viável, exibir mensagem no formato:

```text
Para congelar {massa} kg em {tempo} min, são necessárias as seguintes condições:
- Temperatura do ar: {T_ar}
- Temperatura de evaporação: {T_evap}
- ΔT: {ΔT}
- Vazão: {vazao}
- Velocidade do ar: {velocidade}
- h estimado: {h}
Status: viável
```

Quando não estiver viável:

```text
O produto não congela no tempo disponível.
Ajuste os parâmetros de ar para atingir o tempo necessário.
```

Se faltar h manual, a tela indicará que a validação final depende da confirmação manual do coeficiente convectivo.

## 8. Layout

Vou manter a estrutura visual da Etapa 5 em duas áreas claras:

- topo: pergunta central + botão “Calcular ar” + status resumido
- corpo: controles operacionais à esquerda e diagnóstico/resultados à direita

A intenção é reduzir a lista longa e evitar que o usuário precise interpretar métricas contraditórias.

## 9. Validação final

Depois da implementação, vou revisar os trechos alterados para garantir que:

- não restou nenhum card de “kg/h baseado em tempo térmico”
- a capacidade exibida é sempre massa × 60 ÷ retenção
- o botão “Calcular ar” não altera massa nem propriedades do produto
- o h calculado não é aplicado como manual sem ação explícita
- a Etapa 5 responde diretamente: “com X kg por Y min, quais condições de ar são necessárias?”