Vou aplicar o ajuste exatamente como camada de apresentação e diagnóstico da Etapa 5, sem alterar motor térmico, banco de dados ou cálculo de carga.

## Objetivo

Deixar a Etapa 5 responder diretamente:

```text
Quantos kg estão realmente dentro do túnel neste tempo de retenção?
Essa massa consegue congelar no tempo disponível?
```

Separando visualmente:

- Capacidade nominal: kg/h
- Massa instantânea no túnel: kg
- Massa física na esteira: kg
- Tempo disponível/retenção: min
- Tempo necessário pelo modelo térmico: min

## Alterações planejadas

### 1. Criar cálculos auxiliares apenas para exibição

No `ColdProTunnelForm.tsx`, vou calcular:

```text
capacidade_kg_h = tunnelResult.usedMassKgH

tempo_disponivel_min = tunnelResult.availableTimeMin

tempo_estimado_min = tunnelResult.estimatedTimeMin

massa_no_tempo_disponivel_kg = capacidade_kg_h × tempo_disponivel_min / 60

massa_equivalente_tempo_estimado_kg = capacidade_kg_h × tempo_estimado_min / 60
```

Para esteira por densidade superficial:

```text
massa_esteira_kg = beltSurface.massOnBeltKg
```

E, se `massOnBeltKg` não vier pronto mas houver área e densidade:

```text
massa_esteira_kg = beltSurface.areaM2 × beltSurface.surfaceDensityKgM2
```

### 2. Corrigir a leitura de kg/m² vs kg

Na Etapa 5, a densidade superficial continuará sendo mostrada como **kg/m²** somente quando for realmente densidade.

A massa física resultante será mostrada como **kg**:

```text
Densidade superficial: 6 kg/m²
Massa sobre a esteira: 195 kg
```

Não vou exibir “195 kg/m²” quando o valor for massa sobre a esteira.

### 3. Reorganizar a coluna de respostas da Etapa 5

A coluna de leitura/resultado será reorganizada nesta ordem crítica:

1. Carga térmica do produto
2. Capacidade nominal usada no motor, em kg/h
3. Tempo disponível/retenção
4. Massa no tempo disponível
5. Massa sobre a esteira, se existir
6. Tempo estimado de congelamento
7. Massa equivalente no tempo estimado
8. Vazão necessária pela carga
9. Velocidade do ar
10. Área e seção livre

### 4. Usar massa física da esteira como referência principal quando existir

Quando o modo de cálculo tiver dados de esteira (`beltSurface.massOnBeltKg`, `areaM2`, `surfaceDensityKgM2`), a UI vai destacar essa massa como a massa física real presente sobre a esteira.

A massa por fluxo continuará aparecendo como conferência operacional:

```text
Massa no tempo disponível = kg/h × retenção / 60
Massa sobre a esteira = área × densidade superficial
```

### 5. Adicionar alerta de consistência entre fluxo e esteira

Se houver massa calculada por fluxo e massa física da esteira, e elas divergirem de forma relevante, exibir alerta:

```text
Diferença entre massa calculada por fluxo e massa física na esteira.
Verificar velocidade, área útil ou densidade superficial.
```

Vou usar uma tolerância prática para evitar alerta por arredondamento pequeno.

### 6. Adicionar diagnóstico obrigatório de tempo insuficiente

Se:

```text
tempo_estimado > tempo_disponivel
```

Exibir mensagem direta:

```text
Com {capacidade} kg/h e {tempo_disponivel} min de retenção,
há aproximadamente {massa_no_tempo_disponivel} kg dentro do túnel.

O modelo estima {tempo_estimado} min para congelar até o núcleo.

Portanto, o tempo atual não é suficiente para congelamento completo.
```

### 7. Manter intacto o cálculo técnico existente

Não vou alterar:

- `tunnelEngine`
- cálculo de carga térmica
- cálculo de vazão
- banco de dados
- regras de persistência

A alteração será de apresentação, organização e diagnóstico na Etapa 5.

## Arquivo principal

- `src/components/coldpro/ColdProTunnelForm.tsx`

## Resultado esperado

A Etapa 5 passará a mostrar, sem ambiguidade:

- Se o projeto é 1.000 kg/h e a retenção é 11 min, a tela mostrará cerca de 183 kg no intervalo.
- Se a esteira tiver massa física calculada, ela aparecerá como kg, não kg/m².
- Se o modelo térmico exigir 57 min, a tela mostrará claramente que 11 min não são suficientes para congelamento completo.
- O usuário não precisará interpretar sozinho a relação entre kg/h, kg no túnel e tempo térmico.