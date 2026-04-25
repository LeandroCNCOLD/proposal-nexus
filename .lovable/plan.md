Plano para ajustar o módulo existente `/app/seletor` como ColdPro funcional, sem mexer em CRM, Nomus, sincronização, propostas, templates, clientes ou representantes.

## Diagnóstico do que já existe

- `/app/seletor` ainda é placeholder.
- Já existe um módulo ColdPro paralelo em `/app/coldpro` com:
  - telas de projeto, ambiente, produto, cargas extras, resultado, seleção e relatório;
  - tabelas já existentes como `coldpro_projects`, `coldpro_environments`, `coldpro_products`, `coldpro_results`, `coldpro_equipment_models`, `coldpro_equipment_performance_points`, `coldpro_equipment_selections`;
  - cálculo térmico parcial em `src/features/coldpro/coldpro-calculation.engine.ts`;
  - seleção por curva real em `src/features/coldpro/equipment-selection.engine.ts`.
- O cálculo atual já cobre parte do necessário, mas precisa ajustes importantes:
  - separar melhor os services por domínio conforme solicitado;
  - incluir portas no cálculo por superfície de forma explícita;
  - padronizar tipos de vidro com os nomes pedidos (`vidro_simples`, `vidro_duplo`, etc.);
  - corrigir infiltração para usar densidade ajustada por altitude;
  - ampliar modos de aplicação para os nomes pedidos;
  - retornar o formato final em kW/TR/kcal/h com `warnings` e `calculationMemory`;
  - transformar o fluxo em 9 abas dentro do `/app/seletor`.

## Ajustes de estrutura

Criar a nova estrutura solicitada, reaproveitando e migrando a lógica existente:

```text
src/modules/coldpro/
  types/
    coldPro.types.ts
  utils/
    conversions.ts
    numbers.ts
  services/
    surfaceAreaService.ts
    transmissionLoadService.ts
    glassLoadService.ts
    infiltrationLoadService.ts
    productLoadService.ts
    internalLoadsService.ts
    airDensityService.ts
    psychrometricService.ts
    coldProEngine.ts
    coldProValidationService.ts
  components/
    ColdProSeletorApp.tsx
    ColdProTabs.tsx
    ProjectDataTab.tsx
    DimensionsTab.tsx
    SurfacesTab.tsx
    ProductProcessTab.tsx
    InfiltrationTab.tsx
    InternalLoadsTab.tsx
    ResultTab.tsx
    EquipmentSelectionTab.tsx
    TechnicalReportTab.tsx
```

Manter os componentes antigos em `src/components/coldpro` quando úteis, mas a rota `/app/seletor` passará a usar os novos componentes em `src/modules/coldpro/components`.

## Banco de dados

Aproveitar as tabelas existentes quando equivalentes e criar apenas as que faltam/forem necessárias para persistir o modelo novo.

Já existem:
- `coldpro_projects`
- `coldpro_products`
- `coldpro_results`
- `coldpro_equipment_models`
- `coldpro_equipment_performance_points`
- `coldpro_equipment_selections`
- materiais equivalentes: `coldpro_insulation_materials` e `coldpro_thermal_materials`

Criar/ajustar para o novo fluxo:
- `coldpro_surfaces` para teto, piso, paredes, portas e vidros por projeto/ambiente;
- `coldpro_wall_compositions` para composição por superfície/material/camada;
- `coldpro_process_parameters` para resfriamento, congelamento, túneis, giro freezer, batelada/contínuo;
- `coldpro_infiltration` para portas, aberturas, renovação, altitude e parâmetros de infiltração;
- `coldpro_internal_loads` para pessoas, iluminação, motores, embalagem e respiração;
- `coldpro_reports` para memória de cálculo simples;
- avaliar se `coldpro_materials` deve ser uma nova tabela ou uma view/compatibilidade sobre `coldpro_thermal_materials`. Para evitar duplicidade, a preferência será usar a base existente e só criar `coldpro_materials` se for indispensável para o novo schema.

As tabelas terão RLS, vínculos por projeto/ambiente, timestamps, defaults seguros e políticas compatíveis com usuários autenticados.

## Cálculo térmico

Implementar os services pedidos com fórmulas em W/kW como base:

### Transmissão
- `Q = U × A × ΔT`
- Calcular separadamente:
  - teto
  - piso
  - parede 1
  - parede 2
  - parede 3
  - parede 4
  - portas
  - vidros
- Para cada superfície:
  - `area_opaca = area_total - area_vidro - area_porta`
  - `Q_opaco = area_opaca × U_opaco × ΔT`
  - `Q_vidro = area_vidro × U_vidro × ΔT`
  - `Q_porta = area_porta × U_porta × ΔT`
  - `Q_total_superficie = Q_opaco + Q_vidro + Q_porta`
- Piso sem isolamento:
  - `temperatura_solo_default = 20°C`
  - `ΔT_piso = temperatura_solo - temperatura_interna`

### Vidro e solar
- U-values:
  - `none = 0`
  - `vidro_simples = 5.8`
  - `vidro_duplo = 2.8`
  - `vidro_triplo = 1.8`
  - `low_e_duplo = 1.6`
  - `vidro_frigorifico_aquecido = 2.5`
- Solar:
  - `Q_solar_vidro = area_vidro × radiacao_solar × fator_solar`
  - `sem_sol = 0`, `moderado = 150`, `forte = 300`, `critico = 500 W/m²`

### Infiltração
- `Q_infiltracao = densidade_ar × volume_ar_infiltrado × Cp_ar × ΔT`
- `Cp_ar = 1.005 kJ/kg.K`
- Densidade por altitude:
  - `P = 101325 × (1 - 2.25577e-5 × altitude)^5.2559`
  - `densidade_ar = 1.20 × (P / 101325)`
  - se altitude `< 500 m`, usar `1.20 kg/m³`

### Produto/processo
- Resfriamento:
  - `Q_produto = massa × Cp × (Ti - Tf)`
- Congelamento:
  - `Q1 = massa × Cp_acima × (Ti - Tcong)`
  - `Q2 = massa × calor_latente × fracao_congelavel`
  - `Q3 = massa × Cp_abaixo × (Tcong - Tf)`
  - `Q_produto = Q1 + Q2 + Q3`
- Contínuo:
  - `P_produto_kW = producao_kg_h × q_especifica_kj_kg / 3600`
- Batelada:
  - `P_produto_kW = massa_lote × q_especifica_kj_kg / (tempo_h × 3600)`
- Giro freezer/túnel:
  - `massa_media_dentro = producao_kg_h × tempo_retencao_min / 60`
  - validar tempo por Plank simplificado;
  - emitir alertas de retenção adequada/insuficiente, velocidade baixa/alta e dados térmicos faltantes.

### Cargas internas
- Pessoas, iluminação, motores, embalagem e respiração conforme fórmulas enviadas.
- Respiração apenas para frutas, vegetais e sementes quando configurado.

### Resultado
O engine retornará:

```ts
{
  transmissionKw,
  infiltrationKw,
  productKw,
  packagingKw,
  respirationKw,
  peopleKw,
  lightingKw,
  motorsKw,
  pullDownKw,
  baseTotalKw,
  correctedTotalKw,
  totalKcalH,
  totalTr,
  warnings,
  calculationMemory
}
```

Com conversões:
- `kW = W / 1000`
- `kcal/h = W × 0.859845`
- `TR = kW / 3.517`

## Interface em `/app/seletor`

Substituir o placeholder por um módulo ColdPro com abas:

1. Dados do Projeto
2. Dimensões
3. Isolamento / Superfícies
4. Produto / Processo
5. Infiltração
6. Cargas Internas
7. Resultado
8. Seleção de Equipamentos
9. Relatório Técnico

A tela permitirá:
- criar/salvar cálculo;
- editar projeto depois;
- duplicar projeto;
- gerar memória de cálculo simples;
- visualizar warnings técnicos;
- navegar entre abas sem perder dados.

## Seleção de equipamentos

Na aba Seleção de Equipamentos:
- usar a base existente `coldpro_equipment_models` e `coldpro_equipment_performance_points`;
- comparar `correctedTotalKw` com capacidade do equipamento;
- mostrar:
  - equipamento sugerido;
  - capacidade nominal;
  - margem sobre a carga;
  - alerta de subdimensionamento;
  - alerta de superdimensionamento.

Não criar lógica de pedido, proposta ou Nomus nesta etapa.

## Proteções de escopo

Não alterar arquivos e fluxos de:
- CRM
- Nomus
- sincronização
- propostas
- templates
- clientes
- representantes

Também removeremos do fluxo `/app/seletor` qualquer ação de enviar para proposta/PDF vinculado a proposta que existe no ColdPro paralelo atual, porque você pediu foco exclusivo no módulo técnico.

## Validação

Após implementar:
- rodar build/typecheck;
- testar importações para evitar nova quebra da pré-visualização;
- conferir que `/app/seletor` abre e exibe as 9 abas;
- validar um cálculo exemplo com transmissão, infiltração, produto e seleção de equipamento;
- garantir que não houve alteração em CRM/Nomus/propostas/templates/clientes/representantes.