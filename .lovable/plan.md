Implementarei a regra central: o ColdPro não “sugere” temperatura, velocidade ou vazão por preset; ele usa presets apenas como condição inicial e só apresenta a recomendação final quando ela for provada por cálculo iterativo.

## Objetivo

Na aba de túnel/processo, a recomendação final passará a seguir este fluxo:

```text
Entrada do usuário
→ calcula energia específica do produto
→ calcula potência frigorífica requerida
→ estima tempo até núcleo na condição atual
→ compara com tempo desejado
→ testa combinações de Tar e velocidade dentro dos limites
→ calcula vazão necessária para cada tentativa
→ retorna a menor condição que atende, com memória de cálculo
```

## Alterações no motor de cálculo

1. Criar `optimizeProcessAirCondition()` em `coldpro-calculation.engine.ts`.

A função receberá os dados do túnel/processo:
- tipo de processo: contínuo/girofreezer/estático/pallet;
- tipo de arranjo: individual, bandeja, carrinho, caixa, pallet/bloco, granel;
- propriedades do produto carregadas do catálogo ou preenchidas manualmente;
- massa ou kg/h;
- temperatura inicial e final do produto;
- tempo desejado;
- geometria/dimensão térmica e distância até o núcleo;
- temperatura inicial do ar, velocidade inicial e ΔT do ar;
- limites técnicos de temperatura e velocidade;
- densidade do ar;
- fatores de exposição ao ar e penetração térmica.

2. Para cada tentativa, calcular:
- energia específica `q`;
- potência requerida `P_kW`;
- `h_base = 10 + 10 × velocidade^0.8`;
- `h_efetivo = h_base × fator_exposicao_ar`;
- `k_efetivo = k_produto × fator_penetracao`;
- tempo estimado até núcleo;
- vazão necessária:

```text
Vazao_m3_s = P_kW / (ρ_ar × Cp_ar × ΔT_ar)
Vazao_m3_h = Vazao_m3_s × 3600
```

3. Implementar a busca iterativa em ordem técnica:
- primeiro validar a condição atual do usuário;
- se não atender, reduzir a temperatura do ar passo a passo até o limite mínimo;
- se ainda não atender, aumentar velocidade do ar passo a passo até o limite máximo;
- para cada combinação, recalcular tempo, h efetivo, potência e vazão;
- escolher a menor condição que atende ao tempo desejado, evitando recomendar condição mais severa que o necessário;
- se nenhuma combinação atender, retornar status de inviabilidade/revisão técnica.

4. Não permitir recomendação sem cálculo.

Se faltarem dados essenciais, o resultado será “revisar aplicação” ou “sem dados suficientes”, com alerta técnico, em vez de inventar condição de ar.

## Campos e limites técnicos

Vou adicionar campos opcionais ao modelo de túnel para que os limites não fiquem escondidos no código:

- `air_delta_t_k`: ΔT do ar usado para calcular vazão;
- `min_air_temp_c` e `max_air_temp_c`: limites de temperatura do ar;
- `min_air_velocity_m_s` e `max_air_velocity_m_s`: limites de velocidade;
- `air_temp_step_c`: passo de iteração da temperatura;
- `air_velocity_step_m_s`: passo de iteração da velocidade;
- campos de saída/memória: condição recomendada, status, margem, quantidade de tentativas e memória de cálculo.

Os valores iniciais continuarão existindo, mas serão tratados como “ponto inicial”, não como recomendação final.

## Ajustes no banco/backend

1. Criar migração para expandir `coldpro_tunnels` com os novos campos de limites, ΔT de ar e resultado da otimização.
2. Atualizar a validação do salvamento do túnel para aceitar os novos campos.
3. Manter compatibilidade com túneis já cadastrados: quando os campos novos estiverem vazios, usar valores iniciais técnicos como fallback apenas para iniciar a simulação.

## Ajustes na interface

Na aba “Ar e embalagem”, vou reorganizar para separar claramente:

1. Condição inicial informada
- temperatura inicial do ar;
- velocidade inicial do ar;
- ΔT do ar para cálculo de vazão.

2. Limites técnicos de iteração
- temperatura mínima/máxima permitida;
- velocidade mínima/máxima permitida;
- passo de temperatura e velocidade.

3. Fatores físicos do arranjo
- fator de exposição ao ar;
- fator de penetração térmica;
- embalagem/arranjo.

Também vou ajustar textos para deixar claro que esses campos alimentam a otimização, e não são “presets finais”.

## Resultado e memória de cálculo

No card de resultado, a seção “Validação térmica do túnel” passará a mostrar:

- status: adequado, insuficiente, revisar aplicação ou inviável;
- condição inicial testada;
- condição recomendada calculada;
- temperatura do ar recomendada;
- velocidade mínima recomendada;
- vazão necessária;
- potência frigorífica requerida;
- tempo desejado;
- tempo estimado;
- margem percentual;
- energia específica;
- `h_base`;
- `h_efetivo`;
- `k_efetivo`;
- dimensão térmica usada;
- fator de exposição ao ar;
- fator de penetração térmica;
- número de tentativas testadas;
- alertas técnicos.

Também incluirei uma tabela/resumo das tentativas principais para evidenciar a prova matemática, por exemplo:

```text
Tar       Velocidade      Tempo estimado      Status
-30°C     3 m/s           95 min              não atende
-35°C     3 m/s           78 min              não atende
-40°C     3 m/s           66 min              não atende
-40°C     4 m/s           58 min              atende
```

## Regras técnicas que serão aplicadas

- Preset não será resultado final.
- Toda recomendação precisa ter tentativa calculada.
- Se o tempo estimado for maior que o desejado, o sistema tentará primeiro temperatura, depois velocidade.
- A vazão será consequência da potência e do ΔT do ar, não um número chutado.
- Produto em caixa, pallet, bloco ou granel continuará gerando alerta técnico por depender de embalagem, passagem real de ar e arranjo físico.
- Se faltar densidade, condutividade, calor latente, temperatura de congelamento, dimensão térmica ou tempo desejado, o sistema não recomendará condição final.

## Arquivos que serão alterados

- `src/features/coldpro/coldpro-calculation.engine.ts`
- `src/features/coldpro/coldpro.types.ts`
- `src/features/coldpro/coldpro.functions.ts`
- `src/components/coldpro/ColdProTunnelForm.tsx`
- `src/components/coldpro/ColdProResultCard.tsx`
- nova migração em `supabase/migrations/` para os novos campos do túnel

## Resultado esperado

Ao final, o ColdPro mostrará algo no estilo:

```text
Condição calculada para atender 60 min:
Tar: -40°C
Velocidade mínima: 4 m/s
Vazão necessária: 32.500 m³/h
Potência requerida: 85 kW
Tempo estimado: 58 min
Margem: 3,3%
Status: adequado

Base: 4 tentativas calculadas. A condição inicial não atendia; a temperatura foi reduzida até o limite e depois a velocidade foi elevada até encontrar a menor condição viável.
```

Assim, a recomendação deixa de ser um preset fixo e passa a ser uma conclusão comprovada pela memória de cálculo.