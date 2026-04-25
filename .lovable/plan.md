Plano de implementação — ColdPro túneis com dois modelos físicos

Vou ajustar o módulo ColdPro para separar claramente os processos contínuos/girofreezer dos processos estáticos em carrinho, caixa, pallet ou massa a granel. O foco será cálculo térmico/frigorífico, sem dimensionar mecanicamente túnel, esteira, carrinho ou pallet.

1. Modelo de dados

Criar novos campos em `coldpro_tunnels` para representar o processo físico:

- `process_type`
  - `continuous_individual_freezing`
  - `continuous_girofreezer`
  - `static_cart_freezing`
  - `static_pallet_freezing`

- `arrangement_type`
  - `individual_exposed`
  - `tray_layer`
  - `boxed_product`
  - `cart_rack`
  - `pallet_block`
  - `bulk_static`

- Geometria unitária:
  - `product_length_m`
  - `product_width_m`
  - `product_thickness_m`
  - `unit_weight_kg`

- Geometria de bloco/pallet/carrinho:
  - `pallet_length_m`
  - `pallet_width_m`
  - `pallet_height_m`
  - `pallet_mass_kg`
  - `number_of_pallets`
  - `batch_time_h`
  - `layers_count`
  - `boxes_count`
  - `tray_spacing_m`

- Embalagem e passagem de ar:
  - `package_type`
  - `air_exposure_factor`
  - `thermal_penetration_factor`

- Ar e coeficientes:
  - `airflow_m3_h`
  - `convective_coefficient_manual_w_m2_k`
  - `convective_coefficient_effective_w_m2_k`

- Dimensão térmica calculada/salva para auditoria:
  - `thermal_characteristic_dimension_m`
  - `distance_to_core_m`

Manter os campos existentes como compatibilidade (`operation_mode`, `product_thickness_mm`, `product_unit_weight_kg`, `mass_kg_hour`, `process_time_min`) e mapear para os novos campos quando fizer sentido.

2. Regras padrão por tipo de arranjo

Adicionar constantes no motor ColdPro:

```text
individual_exposed: air_exposure_factor 1.00, penetration_factor 1.00
tray_layer:         air_exposure_factor 0.80, penetration_factor 0.80
cart_rack:          air_exposure_factor 0.70, penetration_factor 0.70
boxed_product:      air_exposure_factor 0.25–0.50, penetration_factor 0.35–0.60
pallet_block:       air_exposure_factor 0.10–0.20, penetration_factor 0.15–0.25
bulk_static:        air_exposure_factor 0.10, penetration_factor 0.15
```

Para `boxed_product` e `pallet_block`, usar valores conservadores por padrão e permitir edição manual pelo usuário.

3. Motor de cálculo

Atualizar `coldpro-calculation.engine.ts` para criar dois caminhos físicos.

Modelo A — contínuo/girofreezer:

- Produto tratado como unidade individual ou camada fina exposta.
- Massa usada:
  - `mass_kg_hour` informado; ou
  - `units_per_cycle × unit_weight_kg × cycles_per_hour`.
- Carga térmica:
  - `Q_kcal_h = kg/h × energia_específica_do_produto`.
- Dimensão térmica:
  - `thermal_characteristic_dimension = product_thickness_m`;
  - `distance_to_core = product_thickness_m / 2`.
- Validação:
  - `retention_time_min >= estimated_core_freezing_time_min`.

Modelo B — estático/carrinho/pallet/bloco:

- Produto tratado como massa agrupada/bloco térmico equivalente.
- Massa usada:
  - `pallet_mass_kg × number_of_pallets`, ou massa total de lote.
- Energia total:
  - `Q_total = massa_total × energia_específica_do_produto`.
- Potência:
  - `P_kW = Q_total_kJ / (batch_time_h × 3600)`.
- Dimensão térmica:
  - `thermal_characteristic_dimension = menor dimensão do bloco/pallet`;
  - `distance_to_core = menor dimensão / 2`.
- Validação:
  - comparar tempo desejado de batelada com tempo estimado até o núcleo.

4. Fórmula de tempo até núcleo

Implementar a estimativa tipo Plank generalizada:

```text
t = (ρ × L_eff / ΔT) × [ (a / h_efetivo) + (a² / (2 × k_efetivo)) ]
```

Onde:

- `h = 10 + 10 × velocidade_ar^0.8`
- `h_efetivo = h × air_exposure_factor`
- `k_efetivo = k_produto × thermal_penetration_factor`
- contínuo: `a = espessura_produto / 2`
- pallet/bloco: `a = menor_dimensão_pallet / 2`
- `L_eff` usa calor latente efetivo considerando fração congelável/fração de água quando houver.

Para pallet/bloco fechado, o sistema exibirá aviso técnico de que é estimativa conservadora e depende de embalagem, passagem real de ar, vazão e arranjo físico.

5. Formulário de túnel

Refatorar `ColdProTunnelForm.tsx` para deixar o preenchimento organizado:

- Aba “Modelo físico”
  - tipo de processo;
  - tipo de arranjo;
  - explicação curta do modelo aplicado.

- Aba “Produto”
  - seleção ASHRAE/CN ColdPro;
  - propriedades térmicas do produto;
  - composição quando disponível.

- Aba “Contínuo / Girofreezer”
  - comprimento, largura, espessura;
  - peso unitário;
  - kg/h ou unidades/ciclo e ciclos/h;
  - tempo de retenção.

- Aba “Estático / Pallet / Carrinho”
  - massa total/pallet;
  - dimensões do bloco/pallet/carrinho;
  - número de pallets;
  - número de camadas/caixas;
  - espaçamento entre bandejas quando aplicável;
  - tempo desejado de batelada.

- Aba “Ar e embalagem”
  - temperatura do ar;
  - velocidade do ar;
  - vazão de ar;
  - tipo de embalagem;
  - fator de exposição ao ar;
  - fator de penetração térmica;
  - coeficiente convectivo manual/opcional.

- Aba “Cargas internas”
  - embalagem em kg/h ou massa de embalagem;
  - motor esteira;
  - ventiladores internos;
  - outras cargas.

6. Validações e mensagens técnicas

Adicionar validações no formulário e no servidor:

- Processo contínuo exige produto, massa/throughput, espessura, temperatura do ar, velocidade do ar e tempo de retenção.
- Processo estático exige massa total, dimensões do bloco/pallet/carrinho e tempo de batelada.
- Se faltar densidade, condutividade congelada ou calor latente, mostrar que a validação de tempo até núcleo pode ficar incompleta.
- Se `static_pallet_freezing`, `pallet_block`, `boxed_product` ou `bulk_static`, mostrar alerta:
  - “Congelamento de pallet/bloco depende fortemente da embalagem, arranjo, vazão e passagem real de ar. Resultado deve ser validado em campo ou por ensaio.”

7. Resultado e memorial

Atualizar os resultados para exibir:

- tipo de processo;
- tipo de arranjo;
- carga térmica total a remover;
- potência requerida;
- tempo disponível;
- tempo estimado até núcleo;
- dimensão térmica usada;
- distância até núcleo;
- velocidade do ar;
- vazão de ar;
- fator de exposição ao ar;
- fator de penetração térmica;
- coeficiente convectivo efetivo;
- status técnico:
  - adequado;
  - insuficiente;
  - revisar aplicação;
  - sem dados suficientes;
- alertas técnicos.

Também atualizarei o `calculation_breakdown` para registrar as fórmulas e parâmetros usados, diferenciando dados ASHRAE, dados manuais e estimativas do sistema.

8. Isolantes térmicos e tabelas auxiliares

Analisar o pacote enviado e comparar com as tabelas existentes. Como o sistema já tem `coldpro_insulation_materials`, `coldpro_thermal_materials`, `coldpro_materials` e `coldpro_wall_compositions`, vou evitar duplicar estruturas.

A direção será:

- usar uma base técnica de materiais térmicos para seleção no ambiente;
- garantir que isolantes térmicos tenham condutividade, densidade, espessura típica, faixa de temperatura e fonte;
- facilitar preenchimento de paredes, teto e piso;
- preservar compatibilidade com o formulário atual.

9. Arquivos principais a alterar

- Migração de banco para novos campos em `coldpro_tunnels` e, se necessário, ajustes em materiais térmicos.
- `src/features/coldpro/coldpro.types.ts`
- `src/features/coldpro/coldpro-calculation.engine.ts`
- `src/features/coldpro/coldpro.functions.ts`
- `src/components/coldpro/ColdProTunnelForm.tsx`
- `src/components/coldpro/ColdProResultCard.tsx`
- `src/components/coldpro/ColdProReport.tsx`
- `src/integrations/coldpro/ColdProMemorialPdf.tsx`, se o memorial precisar refletir os novos detalhes.

10. Critérios de aceite

- O usuário consegue escolher entre contínuo/girofreezer e estático/pallet/carrinho.
- O contínuo calcula carga por kg/h e valida tempo de retenção da unidade.
- O estático calcula energia total, potência por tempo de batelada e valida penetração até o núcleo.
- O cálculo usa `air_exposure_factor`, `thermal_penetration_factor`, `h_efetivo` e dimensão térmica correta.
- O sistema avisa quando o cálculo é conservador ou depende de ensaio/campo.
- Nenhum campo de geometria, embalagem ou arranjo físico é tratado como dado ASHRAE.
- O sistema continua calculando câmaras frias e produtos simples como antes.