# Mapa do Motor de Cálculo ColdPro

Auditoria técnica estática dos principais pontos do motor de carga térmica em `src/modules/coldpro/`.

| Componente | Arquivo | Função | Entrada | Saída | Fórmula / método | Unidade | Observações técnicas |
|---|---|---|---|---|---|---|---|
| Carga por transmissão | `physics/heatTransfer.ts` | `resolveTransmissionLoad` | Geometria/área, U, temperatura externa/interna | `transmissionKW` | `Q = U × A × ΔT / 1000` | kW | Mantido como componente separado no túnel. |
| Produto - energia específica | `physics/productThermal.ts` | `calculateProductSpecificEnergy` | temperaturas, Cp acima/abaixo, calor latente, fração congelável | kcal/kg e kJ/kg | sensível acima + latente + sensível abaixo | kcal/kg / kJ/kg | Considera mudança de fase quando cruza ponto de congelamento. |
| Produto - carga por processo | `core/operationalModel.ts` | `calculateProductLoadByProcessMode` | massa/processo + energia específica | `productLoadKW` | contínuo: `kg/h × kJ/kg / 3600`; batelada: `kg × kJ/kg / (h × 3600)` | kW | Não alterado pela auditoria. |
| Embalagem | `engines/tunnelEngine.ts` | `resolvePackagingLoad` | massa de embalagem, Cp, ΔT, regime | `packagingLoadKW` | kcal/h convertido para kW via 859,845 | kW | Suporta fluxo contínuo e batelada. |
| Infiltração - vazão | `physics/infiltrationCalculator.ts` | `calculateInfiltrationAirflow` | porta, aberturas, tempo, modo processo | vazão m³/h | por ciclo ou por dia | m³/h | Não alterado pela auditoria. |
| Infiltração psicrométrica | `physics/airflowModel.ts` | `calculatePsychrometricInfiltrationKW` | vazão, T/RH interna/externa, pressão | `totalKW`, sensível, latente | diferença de entalpia | kW | Fallback simplificado quando faltam dados psicrométricos. |
| Iluminação | `physics/thermalAuxLoads.ts` | `calculateLightingLoad` | potência total W | kW e kcal/h | `W × 0,86` | kW / kcal/h | Adicionado como carga auxiliar pura. |
| Motores / ventiladores | `physics/thermalAuxLoads.ts` | `calculateMotorLoad` | potência total kW | kW e kcal/h | `kW × 860` | kW / kcal/h | Usado para ventiladores + motores + outras cargas internas. |
| Pessoas | `physics/thermalAuxLoads.ts` | `calculatePeopleLoad` | número de pessoas | kW e kcal/h | `pessoas × 300` | kW / kcal/h | Adicionado para reduzir subdimensionamento. |
| Degelo | `physics/thermalAuxLoads.ts` | `calculateDefrostLoad` | carga evaporador, fator degelo | kW e kcal/h | `Q_evaporador × fator` | kW / kcal/h | Fator limitado a 0,1–0,3. |
| Fator de segurança | `engines/tunnelEngine.ts` | `resolveSafetyCoefficient` | coeficiente informado | coeficiente aplicado | default 1,10; clamp 1,05–1,30 | adimensional | Aplicado no total final. |
| Consolidação total | `engines/tunnelEngine.ts` | `calculateTunnelCore` | produto, embalagem, transmissão, infiltração, auxiliares | `totalKW`, `totalKcalH`, `breakdown` | soma base × coeficiente segurança | kW / kcal/h | Expõe `totalBaseKW`, `totalWithSafety`, percentuais. |
| Seleção de evaporador | `selection/evaporatorSelector.ts` | `selectEvaporator` | carga kW, condições, lista | melhor evaporador | capacidade requerida = kW×860×1,15 | kcal/h | Seleciona menor oversizing acima da carga. |
| Seleção de compressor | `selection/compressorSelector.ts` | `selectCompressor` | carga, Tevap, Tcond, lista | melhor compressor | capacidade >= carga; COP estimado/tabela | kW | Puro, desacoplado de banco/UI. |
| COP dinâmico | `energy/energyCalculator.ts` | `estimateCOP` | Tevap, Tcond, eficiência | COP | Carnot simplificado × eficiência | adimensional | Base para consumo quando compressor não informa COP. |
| Consumo energético | `energy/energyCalculator.ts` | `calculateEnergy` | carga, COP, horas, dias, tarifa, massa | kW, kWh/mês, custo, custo/kg | `kW_el = carga/COP`; `kWh = kW_el × horas` | kW / kWh / R$ | Puro, sem React. |
| Relatórios/PDF | `integrations/coldpro/*`, `components/coldpro/*` | vários | resultados ColdPro | PDF/cards | normalização e renderização | variadas | Fora do escopo de alteração desta auditoria. |

## Observações de metodologia

- O motor ColdPro atual é mais detalhado que KFCalc/SEQCT em produto e infiltração.
- A compatibilidade KFCalc/SEQCT exige validar também o modo simplificado por componentes.
- A maior divergência histórica observada veio da ausência de cargas auxiliares, não do cálculo de produto/infiltração.
- O comparador em `audit/kfcalcCompatEngine.ts` não altera o motor: ele replica a metodologia simplificada para auditoria.
