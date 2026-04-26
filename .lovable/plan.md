Vou ajustar a aba **Contínuo / Girofreezer** para entregar o resultado térmico completo do processo, mantendo os cards atuais de massa, geometria, densidade, h/k e tempo até núcleo.

Plano de implementação:

1. **Expandir o service do girofreezer**
   - Adicionar as interfaces `ProductThermalInput`, `AirProcessInput` e `ProductThermalResult` em `src/modules/coldpro/services/continuousGirofreezerService.ts`.
   - Implementar `calculateProductThermalLoad` com as fórmulas informadas:
     - congelamento: `Cp_acima × (Ti - Tcong) + latente × fração_congelável + Cp_abaixo × (Tcong - Tf)`
     - resfriamento simples: `Cp × |Ti - Tf|`
     - potência: `kg/h × kJ/kg / 3600`
     - embalagem: `kg/h embalagem × Cp embalagem × |Ti - Tf| / 3600`
     - vazão: `kW / (densidade_ar × 1,005 × ΔT_ar)`

2. **Integrar o cálculo térmico ao resultado principal**
   - Fazer `calculateContinuousGirofreezer` receber também temperaturas, Cp, calor latente, fração congelável, embalagem, ΔT do ar e densidade do ar.
   - Usar a `usedMassKgH` já definida pela regra de prioridade de massa.
   - Retornar `thermal` dentro do `ContinuousGirofreezerResult`, junto com massa, geometria e física.
   - Manter a densidade escolhida no cálculo do tempo por Plank.

3. **Atualizar a tela da aba Contínuo / Girofreezer**
   - Passar os campos atuais do formulário para o novo cálculo:
     - `inlet_temp_c`, `outlet_temp_c`, `freezing_temp_c`
     - `specific_heat_above_kcal_kg_c`, `specific_heat_below_kcal_kg_c`, `latent_heat_kcal_kg` convertidos para kJ
     - `frozen_water_fraction`
     - `packaging_mass_kg_hour`, `packaging_specific_heat_kcal_kg_c`
     - `air_temp_c`, `air_velocity_m_s`, `air_delta_t_k`
   - Incluir os cards solicitados junto aos cards atuais:
     - carga específica total kJ/kg
     - sensível acima kJ/kg
     - latente kJ/kg
     - sensível abaixo kJ/kg
     - carga do produto kW
     - carga embalagem kW
     - carga total kW
     - capacidade kcal/h
     - capacidade TR
     - vazão de ar necessária m³/h
   - Também exibir temperatura do ar usada e velocidade do ar usada, já que fazem parte do status técnico do processo.

4. **Adicionar ao `calculation_breakdown` do cálculo geral**
   - Atualizar `calculateTunnelLoad` em `src/features/coldpro/coldpro-calculation.engine.ts` para expor o mesmo detalhamento térmico no resultado salvo do túnel.
   - Incluir no breakdown campos claros como:
     - `q_specific_above_kj_kg`
     - `q_specific_latent_kj_kg`
     - `q_specific_below_kj_kg`
     - `q_specific_total_kj_kg`
     - `product_load_kw`
     - `packaging_load_kw`
     - `total_process_load_kw`
     - `required_airflow_m3_h`
     - `air_temperature_c`
     - `air_velocity_m_s`
     - `h_effective_w_m2_k`
     - `k_effective_w_m_k`
     - `estimated_freezing_time_min`
     - `technical_status`

5. **Validação final**
   - Rodar build/typecheck para garantir que os novos tipos e imports estão corretos.
   - Conferir que a aba continua funcionando para processo contínuo/girofreezer e que os valores antigos não foram removidos.