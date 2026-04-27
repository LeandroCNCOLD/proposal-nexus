Plano ajustado: aplicar propriedades dinâmicas do ar na Etapa 5 — Ar, vazão e ventilação

Escopo confirmado
- A aplicação principal será na Etapa 5 mostrada no print: cálculo de vazão pela carga, recomendação de vazão, seção livre e validação de ventilação.
- Não vou alterar cálculo do produto, base de produtos, seleção de equipamento, banco de dados ou lógica de velocidade por túnel.
- A lógica de velocidade continua igual: vazão ÷ seção livre. O que muda é a vazão por carga térmica, que hoje usa `ρ = 1,2` e `Cp = 1,005` fixos.

1. Criar propriedades dinâmicas do ar
- Criar `src/modules/coldpro/physics/airProperties.ts` com funções puras, sem singleton global:
  - `getAirDensityKgM3(params)`
  - `getAirSpecificHeatKJkgK(params)`
  - `getWaterLatentHeatKJkg(params)`
  - `createAirPropertiesContext(params)`
- O contexto retornará:
  - densidade usada
  - Cp usado
  - calor latente da água por modo
  - pressão usada
  - temperatura em Kelvin
  - fonte: automático, override manual ou fallback
  - warnings técnicos.

2. Aplicar na Etapa 5 do formulário
Arquivo principal:
- `src/components/coldpro/ColdProTunnelForm.tsx`

Alterações na Etapa 5:
- Trocar o cálculo atual:
  - `carga ÷ densidade × Cp × ΔT`
  - com `densidade = 1,2` e `Cp = 1,005`
- Por:
  - `carga ÷ densidade dinâmica × Cp dinâmico × ΔT`
- A função local `requiredAirflowForLoadM3H` passará a aceitar também `cpAirKJkgK`.
- O card “3. Vazão por carga térmica” passará a usar o contexto dinâmico.
- O botão “Calcular ar” também usará o mesmo contexto ao gerar a recomendação.

3. Origem dos dados usados na Etapa 5
Usar os dados disponíveis no próprio cálculo/ambiente:
- temperatura do ar: `air_temp_c`, no print `-25°C`
- ΔT do ar: `air_delta_t_k`, no print `6 K`
- altitude: `environment.altitude_m`, se existir
- pressão: `environment.atmospheric_pressure_kpa`, se existir
- UR interna: `environment.relative_humidity_percent` ou campos equivalentes, se existir
- override manual: `air_density_kg_m3`, se informado pelo usuário.

Regra de prioridade:
1. Se `air_density_kg_m3` manual existir, usar manual e marcar fonte como `manual_override`.
2. Se pressão existir, calcular com pressão.
3. Se não houver pressão mas houver altitude, estimar pressão pela altitude.
4. Se faltar dado crítico, usar fallback seguro `ρ = 1,2` e `Cp = 1,005` com warning.

4. Exibir o breakdown na Etapa 5
Na própria Etapa 5, adicionar cards técnicos próximos ao card de vazão por carga:
- Densidade do ar usada, ex.: `1,35 kg/m³`
- Cp do ar usado, ex.: `1,006 kJ/kg.K`
- Temperatura base, ex.: `-25°C / 248,15 K`
- Pressão/altitude usada, ex.: `93,2 kPa / 700 m`
- UR usada, ex.: `85%`
- Fonte: `automático`, `manual_override` ou `fallback`
- Warnings, se houver.

5. Atualizar o motor para manter coerência
Arquivos envolvidos:
- `src/modules/coldpro/engines/tunnelEngine.ts`
- `src/modules/coldpro/physics/airflowModel.ts`
- `src/modules/coldpro/types/tunnelEngine.types.ts`
- `src/modules/coldpro/adapters/formToTunnelInput.ts`
- `src/modules/coldpro/adapters/databaseToTunnelInput.ts`

Objetivo:
- A Etapa 5 e o motor devem usar a mesma densidade/Cp.
- `calculationBreakdown.air` terá o contexto de propriedades do ar para auditoria.
- A vazão exibida na interface será a mesma vazão calculada no motor.

6. Aplicar também em infiltração/psicrometria, sem alterar produto
- Em `calculatePsychrometricInfiltrationKW`, usar densidade/Cp/latente vindos do contexto quando disponíveis.
- Em funções psicrométricas auxiliares, substituir uso rígido de constantes por contexto ou parâmetros opcionais.
- Manter fallback para chamadas antigas.

7. Validação do caso do print / Túnel Rafa
Caso base:
- Carga usada na vazão: `12,09 kW`
- ΔT ar: `6 K`
- Temperatura do ar: `-25°C`
- Altitude: `700 m`, se disponível
- UR interna: `85%`

Comparação esperada:
- Hardcoded atual:
  - `ρ = 1,2 kg/m³`
  - `Cp = 1,005 kJ/kg.K`
  - vazão ≈ `6.015 m³/h`, que bate com o print.
- Dinâmico esperado:
  - densidade aproximada na faixa `1,30–1,42 kg/m³`, dependendo da pressão/altitude/UR
  - Cp próximo de `1,005–1,01 kJ/kg.K`
  - vazão por carga deve cair coerentemente em relação aos `6.015 m³/h`, porque o ar mais denso carrega mais energia por m³.

8. Testes finais
- Atualizar testes do motor ColdPro para cobrir:
  - fallback antigo preservado
  - override manual
  - cálculo automático com `-25°C`, `700 m`, `85% UR`
  - vazão dinâmica menor que a vazão hardcoded para a mesma carga e ΔT.
- Rodar:
  - typecheck
  - build
  - testes do motor.

Entrega final após implementação
- Arquivos criados/alterados.
- Fórmulas usadas.
- Comparação hardcoded vs dinâmico.
- Resultado do caso Túnel Rafa/Etapa 5.
- Confirmação de que produto, base de produtos, seleção de equipamento, banco e lógica por velocidade não foram alterados.