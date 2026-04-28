Plano final ajustado para execução

Vou seguir com a reestruturação, incorporando os 3 ajustes: não travar importações antigas, documentar a Batata pré-frita como premissa CN Cold/Refrio, e manter kcal/h como padrão comercial.

1. Arquitetura oficial de unidades

Fluxo alvo:

```txt
Base térmica em kJ
→ normalização técnica em kJ
→ motor calcula kJ/kg
→ motor calcula kJ/h
→ motor calcula kW
→ apresentação converte para kcal/h, TR e BTU/h
```

Padrões internos:

```ts
ENGINE_ENERGY_UNIT = "kJ"
ENGINE_POWER_UNIT = "kW"
defaultDisplayUnit = "kcal/h"
```

A unidade comercial padrão continuará sendo kcal/h.

2. Conversões centralizadas

Criar/ajustar utilitário para:

```ts
convertThermalLoad(valueKW, targetUnit)
```

Conversões:

```txt
kW = valueKW
kcal/h = valueKW × 859.845
TR = valueKW / 3.5168525
BTU/h = valueKW × 3412.142
```

E reverso quando necessário:

```txt
kW = kcal_h / 859.845
kW = TR × 3.5168525
kW = BTU_h / 3412.142
```

3. Normalização ASHRAE sem converter antes do cálculo

A normalização passará a priorizar kJ como fonte técnica:

```txt
cpAboveKJkgK
cpBelowKJkgK
latentHeatKJkg
```

Campos kcal continuarão existindo como derivados/compatibilidade, não como fonte principal do motor.

4. Validação de divergência kJ/kcal sem travar tudo

Regra ajustada conforme sua orientação:

Se produto ASHRAE tiver kJ e kcal divergentes em mais de 1%:

- priorizar kJ no cálculo;
- registrar alerta crítico de inconsistência;
- bloquear emissão/finalização técnica quando o resultado depender desse dado inconsistente;
- permitir salvar como rascunho ou seguir para correção cadastral;
- não quebrar importação de bases antigas automaticamente.

Ou seja: não será `throw` geral no fluxo de importação/cálculo. Será uma validação auditável e bloqueante apenas para emissão final/uso técnico aprovado.

5. Motor de produto em kJ/kg, kJ/h e kW

Validar/ajustar a fórmula principal:

```ts
specificEnergyKJkg =
  cpAboveKJkgK * Math.max(initialTempC - freezingPointC, 0)
+ latentEffectiveKJkg
+ cpBelowKJkgK * Math.max(freezingPointC - finalTempC, 0)
```

Latente:

```txt
latentMode = "effective": latentEffectiveKJkg = latentHeatKJkg
latentMode = "full": latentEffectiveKJkg = latentHeatKJkg × frozenWaterFraction × latentResidualFactor
```

Carga:

```txt
productLoadKJH = massKgH × specificEnergyKJkg
productLoadKW = productLoadKJH / 3600
productLoadKcalH = productLoadKW × 859.845
```

Para batelada:

```txt
productLoadKJH = massKg × specificEnergyKJkg / timeH
productLoadKW = productLoadKJH / 3600
```

6. Compatibilidade com relatórios antigos

Manter campos antigos em kcal/h nos resultados e relatórios:

```txt
product_kcal_h
total_required_kcal_h
subtotal_kcal_h
capacity_total_kcal_h
```

Mas salvar também os equivalentes técnicos quando disponíveis:

```json
{
  "loadKW": 0,
  "loadKJH": 0,
  "loadKcalH": 0,
  "loadTR": 0,
  "loadBTUH": 0,
  "displayUnit": "kcal/h"
}
```

7. Aba Resultado com seletor de unidade

Adicionar seletor visual:

```txt
Unidade de exibição: [ kcal/h ] [ kW ] [ TR ] [ BTU/h ]
```

Ao trocar unidade:

- não recalcular o motor;
- converter somente a partir do valor base em kW;
- atualizar cards, tabelas e gráficos principais;
- manter kcal/h como padrão inicial.

8. Auditoria técnica de unidades

Adicionar seção de auditoria mostrando:

```txt
Motor interno: kJ/kg → kJ/h → kW
Unidade padrão exibida: kcal/h
Fonte dos dados térmicos: ASHRAE / CN ColdPro
Conversão aplicada somente na saída
```

E valores auditáveis, por exemplo:

```json
{
  "cpAboveKJkgK": 3.2,
  "cpBelowKJkgK": 1.8,
  "latentHeatKJkg": 260.2,
  "specificEnergyKJkg": 416.8,
  "productLoadKJH": 443778,
  "productLoadKW": 123.15,
  "productLoadKcalH": 105886
}
```

9. Correção do produto Batata pré-frita

Atualizar o cadastro da Batata pré-frita para os valores técnicos validados:

```json
{
  "specific_heat_above_kj_kg_k": 3.2,
  "specific_heat_below_kj_kg_k": 1.8,
  "latent_heat_kj_kg": 260.2,
  "initial_freezing_temp_c": -5,
  "frozen_water_fraction": 1,
  "specific_heat_above_kcal_kg_c": 0.7643,
  "specific_heat_below_kcal_kg_c": 0.4299,
  "latent_heat_kcal_kg": 62.15
}
```

Importante: vou registrar isso como premissa validada CN Cold/Refrio, não como ASHRAE pura.

Observação/fonte proposta no cadastro:

```txt
Fonte: CN Cold validado contra Refrio
Observação: substitui valor anterior inconsistente 52,55 kJ/kg / 220 kcal/kg; valores comerciais e técnicos recalculados por kJ oficial.
```

10. Testes obrigatórios

Criar teste automático para Batata pré-frita:

```txt
massa = 1063.636 kg/h
Tin = 40 °C
Tfreeze = -5 °C
Tout = -12 °C
Cp acima = 3.2 kJ/kg.K
Cp abaixo = 1.8 kJ/kg.K
Latente = 260.2 kJ/kg
```

Esperado:

```txt
Energia específica = 416.8 kJ/kg
Carga produto ≈ 123.15 kW
Carga produto ≈ 105.886 kcal/h
```

Teste falha se:

```txt
Carga produto < 100.000 kcal/h
```

Também adicionarei teste para divergência kJ/kcal:

- kJ divergente de kcal em mais de 1% gera alerta crítico;
- cálculo prioriza kJ;
- fluxo não quebra por exceção global.

11. Antes/depois que será entregue

Depois da implementação, entregarei o trace comparativo:

Antes, com base inconsistente:

```txt
latent_heat_kj_kg = 52.55
carga estimada ≈ 53.133 kcal/h
```

Depois, com premissa CN Cold/Refrio:

```txt
latent_heat_kj_kg = 260.2
carga estimada ≈ 105.886 kcal/h
```

Diagnóstico esperado:

```txt
Erro original: base da Batata pré-frita inconsistente
Normalização: será corrigida para priorizar kJ com alerta auditável
Motor: fórmula física mantida, unidade interna migrada para kJ/kW
Dupla aplicação de fatores: não deve existir; teste cobre esse risco
```