Plano de correção da normalização de unidades do ColdPro

Vou implementar a separação explícita entre dados normalizados para motor em kcal e dados normalizados para motor em kJ, garantindo que o motor legado/ambiente receba apenas kcal e que nenhum campo ambíguo entre em cálculo.

1. Criar normalizadores explícitos em `unitNormalizer.ts`
- Adicionar `normalizeProductForKcalEngine(input)`:
  - retorna somente valores efetivos em kcal:
    - `cpAboveKcalKgC`
    - `cpBelowKcalKgC`
    - `latentHeatKcalKg`
  - se vier kJ, converte por `/ 4,1868`;
  - se vier kcal, usa direto;
  - registra auditoria com valor original, unidade original, valor convertido, unidade usada e fonte.
- Adicionar `normalizeProductForKjEngine(input)`:
  - retorna somente valores efetivos em kJ:
    - `cpAboveKJkgK`
    - `cpBelowKJkgK`
    - `latentHeatKJkg`
  - se vier kcal, converte por `× 4,1868`;
  - se vier kJ, usa direto;
  - registra auditoria equivalente.
- Manter compatibilidade temporária de `normalizeThermalProperties`, mas fazendo ela delegar para o normalizador correto em vez de conter lógica própria ambígua.

2. Corrigir motor legado/ambiente em `coldpro-calculation.engine.ts`
- O cálculo de carga térmica do ambiente/legado deve chamar `normalizeProductForKcalEngine`.
- As fórmulas devem usar diretamente:
  - `cpAboveKcalKgC`
  - `cpBelowKcalKgC`
  - `latentHeatKcalKg`
- O motor legado/ambiente não receberá kJ para cálculo.
- O breakdown continuará mostrando equivalentes em kJ somente como informação/auditoria.

3. Corrigir motor físico do túnel em `productThermal.ts`
- Separar claramente o contrato do motor:
  - se este motor continuar operando em kJ, ele receberá apenas campos kJ vindos de `normalizeProductForKjEngine`;
  - se for alterado para kcal, ele receberá apenas campos kcal vindos de `normalizeProductForKcalEngine`.
- Pela sua regra atual, a parte principal que calcula carga térmica em kcal será alimentada em kcal antes do cálculo, evitando calcular baixo por unidade errada.
- Ajustar nomes de retorno/breakdown para não mascarar kcal como kJ.

4. Corrigir adaptadores de entrada
- Em `formToTunnelInput.ts`:
  - quando preparar input para motor em kcal, usar `normalizeProductForKcalEngine`;
  - quando preparar input para motor em kJ, usar `normalizeProductForKjEngine`;
  - remover passagem ambígua de `cpAboveKJkgK`, `cpBelowKJkgK`, `latentHeatKJkg` para motor kcal.
- Em `databaseToTunnelInput.ts`:
  - aplicar a mesma regra para dados vindos do banco/base oficial;
  - exemplo obrigatório validado:
    - `2,85 kJ/kg.K / 4,1868 = 0,6807 kcal/kg°C`
    - `1,55 kJ/kg.K / 4,1868 = 0,3702 kcal/kg°C`
    - `134 kJ/kg / 4,1868 = 32,01 kcal/kg`

5. Corrigir payload de saída em `tunnelInputToDatabasePayload.ts`
- Persistir o breakdown com a auditoria completa de unidade.
- Garantir que valores salvos não confundam unidade efetiva do motor:
  - campos kcal em campos kcal;
  - campos kJ em campos kJ apenas quando forem equivalentes/auditáveis.
- Não salvar automaticamente: manter o comportamento atual de salvar somente quando o usuário confirmar.

6. Atualizar breakdown na tela
- Mostrar no resumo:
  - valor original;
  - unidade original;
  - valor convertido;
  - unidade usada no motor;
  - fonte da conversão (`kJ_to_kcal`, `kcal_native`, `kcal_to_kJ`, `kJ_native`, default técnico etc.).
- Deixar explícito quando o motor está calculando em kcal.
- Remover mensagens que indiquem que kcal foi convertido para kJ para cálculo no motor kcal.

7. Validação técnica
- Adicionar/ajustar verificações para confirmar:
  - sem dupla conversão;
  - sem usar kJ em motor kcal;
  - sem usar kcal em motor kJ;
  - exemplo base oficial converte corretamente para kcal.
- Rodar `typecheck` e `build` ao final.

Resultado esperado
- Para base oficial:
  - Cp acima `2,85 kJ/kg.K` entra no motor kcal como `0,6807 kcal/kg°C`;
  - Cp abaixo `1,55 kJ/kg.K` entra como `0,3702 kcal/kg°C`;
  - Latente `134 kJ/kg` entra como `32,01 kcal/kg`.
- O motor legado/ambiente não calculará com kJ.
- O breakdown mostrará claramente a conversão e a unidade efetivamente usada no cálculo.