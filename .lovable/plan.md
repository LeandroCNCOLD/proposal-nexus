Plano de correção

1. Corrigir o motor de cálculo para o modo contínuo atual
- Ajustar a validação de massa contínua para respeitar o modo selecionado:
  - kg/h direto: exige `mass_kg_hour`.
  - unidades/h: exige peso unitário + unidades/h.
  - carregamento de esteira: exige peso unitário + unidades/fileira + fileiras/m + velocidade.
  - girofreezer por unidades/ciclo: exige peso unitário + unidades/ciclo + ciclos/h.
  - bandejas/h: exige dados de bandeja.
  - leito fluidizado: exige kg/h ou taxa de alimentação.
- Hoje o motor ainda valida parte do caminho antigo `unitWeight × unitsPerCycle × cyclesPerHour`, mesmo quando o usuário escolhe “kg/h diretamente”. Isso faz aparecer “Informe o peso unitário” e impede status completo em cenários onde kg/h direto deveria bastar.

2. Remover bloqueio indevido de geometria para placa/slab
- Ajustar a validação para não exigir comprimento e largura quando o modelo precisa apenas da espessura para tempo até o núcleo.
- Para placa/produto sobre esteira, comprimento e largura podem continuar como dados informativos, mas a dimensão crítica será a espessura.
- Resultado esperado: com espessura, massa, tempo e propriedades térmicas preenchidos, o motor calcula carga, tempo e status sem exigir dimensões irrelevantes.

3. Corrigir a origem das propriedades térmicas do catálogo
- Manter seleção ASHRAE como preenchimento das propriedades do túnel.
- Garantir que densidade, fração congelável e condutividade congelada carregadas do catálogo sejam usadas pelo motor e não sobrescritas por zero/null na tela.
- Ajustar o comportamento quando catálogo não tiver algum dado: mostrar exatamente qual propriedade falta, sem zerar a carga do produto se massa e energia específica já forem suficientes.

4. Separar cálculo de carga térmica de cálculo de tempo até o núcleo
- Carga térmica do produto deve ser calculada quando houver:
  - massa correta conforme regime;
  - temperaturas de entrada/final/congelamento;
  - Cp acima/abaixo e, quando atravessar congelamento, calor latente/fração congelável.
- Tempo até o núcleo deve continuar dependendo também de:
  - dimensão crítica;
  - densidade;
  - condutividade congelada;
  - h efetivo/velocidade do ar;
  - temperatura do ar.
- Assim, se faltar só condutividade ou dimensão crítica, a carga aparece, mas o tempo/status indica “faltam dados”.

5. Melhorar os cards e mensagens da Etapa 7
- Trocar mensagens genéricas/duplicadas por campos específicos conforme o modo ativo.
- Exibir “Carga do produto” mesmo quando o tempo ainda não puder ser estimado.
- Exibir “Tempo estimado” e “Status” apenas como pendentes pelos dados realmente faltantes.
- Corrigir a descrição da massa por cadência para o modo ativo, evitando mostrar “peso × unidades × ciclos/h” quando o modo é kg/h direto.

6. Corrigir a prévia da carga de produto no projeto
- A prévia “Total calculado da aba Produtos” hoje depende do resultado consolidado salvo em `coldpro_results`; antes de recalcular o ambiente ela pode continuar zerada.
- Ajustar a tela para mostrar, no caso de túnel, uma prévia local usando `tunnelResult.totalKcalH` enquanto o resultado consolidado ainda não foi recalculado/salvo.
- Manter o resultado consolidado oficial após o usuário executar o cálculo geral do ambiente.

7. Revisar persistência do túnel salvo
- Garantir que ao salvar túnel sejam persistidos:
  - massa calculada/usada;
  - carga do produto;
  - carga total;
  - tempo estimado;
  - status;
  - campos faltantes;
  - breakdown do cálculo.
- Confirmar que `calculateColdProEnvironment` usa o mesmo motor modular ao consolidar o resultado geral.

8. Verificação
- Testar manualmente os cenários principais:
  - túnel contínuo de esteira com kg/h direto;
  - túnel contínuo por unidades/h;
  - túnel contínuo por carregamento da esteira;
  - estático pallet por massa direta;
  - estático pallet por composição;
  - carrinho/rack e blast freezer por massa direta/composição.
- Rodar typecheck e build.

Arquivos principais a alterar
- `src/modules/coldpro/engines/tunnelEngine.ts`
- `src/modules/coldpro/physics/geometryModel.ts`, se necessário para ajustar dimensão crítica
- `src/components/coldpro/ColdProTunnelForm.tsx`
- `src/features/coldpro/coldpro-calculation.engine.ts`, se necessário para alinhar consolidação/preview

Critério de aceite
- Em kg/h direto, o motor não pede peso unitário nem cadência.
- Para placa/slab, comprimento/largura não bloqueiam cálculo quando a espessura existe.
- A carga do produto deixa de ficar zerada quando massa e propriedades energéticas estão preenchidas.
- O tempo estimado aparece quando dimensão crítica, h, densidade, fração congelável e condutividade estão preenchidos.
- O status muda para Adequado/Insuficiente quando os dados mínimos estão completos.
- A prévia da carga de produto mostra a carga do túnel mesmo antes do recálculo geral salvo.
- Typecheck e build passam.