Plano para retirar Processos Especiais desta etapa do ColdPro

1. Remover a aba da navegação
- Alterar o stepper do cálculo para ficar com 4 etapas:
  - Ambiente
  - Produtos
  - Cargas extras
  - Resultado
- Ajustar os índices das etapas na tela para que Cargas extras e Resultado ocupem os lugares corretos.
- Garantir que, ao salvar/calcular, o sistema avance para a etapa Resultado sem tentar passar por Processos Especiais.

2. Remover a tela/formulário de Processos Especiais
- Remover da página do projeto ColdPro o uso do formulário `ColdProAdvancedProcessForm`.
- Remover o botão/fluxo de salvar processo especial nessa tela.
- Remover o resumo “Prévia dos processos especiais”.
- Remover imports e hooks relacionados à aba para evitar código morto na interface.

3. Tirar Processos Especiais do cálculo de carga térmica
- Ajustar o motor `calculateColdProLoad` para não somar `advanced_processes` no subtotal.
- Manter o retorno compatível, mas com `advanced_processes` vazio e `advanced_processes_kcal_h = 0`, para relatórios antigos não quebrarem.
- Ajustar a função de cálculo do ambiente para não buscar nem enviar `coldpro_advanced_processes` ao motor.
- O cálculo final passará a considerar apenas ambiente, produtos/túnel, desumidificação de sementes, infiltração, cargas internas, ventiladores, degelo, outros e segurança.

4. Limpar relatórios e gráficos
- Remover a linha “Processos especiais” do ranking/distribuição de carga.
- Evitar que relatórios e dashboards exibam carga de processos especiais salva anteriormente.
- Preservar a compatibilidade com dados antigos, porém sem incluir essa parcela no resultado normalizado.

5. Atualizar relatórios já calculados
- Após a mudança do motor, executar uma rotina de recálculo para os ambientes já existentes.
- Isso vai sobrescrever os resultados salvos com `advanced_processes_kcal_h = 0`, refletindo a nova regra.
- Manter os cadastros antigos de processos especiais no banco sem uso, para uma futura segunda etapa se vocês quiserem reativar/migrar esses dados.

6. Validar
- Rodar verificação TypeScript.
- Rodar build de produção.
- Conferir que a página ColdPro abre com 4 abas e sem “Processos Especiais”.
- Conferir que o cálculo e o botão “Recalcular ambiente” seguem funcionando.