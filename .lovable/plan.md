Plano para atualizar o ColdPro conforme solicitado:

1. Criar uma regra única de “produto vindo do catálogo”
- Quando o usuário selecionar um produto ASHRAE/CN ColdPro, o sistema passa a tratar esse produto como fonte oficial das propriedades técnicas.
- O usuário ainda poderá editar dados operacionais do cálculo, como massa, tempo, quantidade, temperatura do processo, dimensões quando quiser ajustar a aplicação real.
- Porém as propriedades térmicas vindas da lista ficam bloqueadas nas telas de cálculo.

2. Usar os dados completos do produto para pré-preencher medidas e geometrias
- Na seleção do produto dentro do túnel, usar os campos já importados da tabela:
  - geometria/formato;
  - comprimento;
  - largura;
  - altura/espessura;
  - espessura característica;
  - volume aproximado, quando útil;
  - observações técnicas.
- Preencher automaticamente os campos correspondentes na etapa de produto/geometria.
- Se o usuário quiser ajustar medidas para uma aplicação específica, ele poderá editar esses campos depois.

3. Bloquear propriedades térmicas nas áreas de cálculo
- Nas telas de carga térmica e túnel, quando houver produto selecionado do catálogo, deixar como somente leitura os campos como:
  - calor específico acima do congelamento;
  - calor específico abaixo do congelamento;
  - calor latente;
  - temperatura inicial de congelamento;
  - densidade;
  - condutividade térmica congelada/não congelada;
  - fração/percentual de água congelável;
  - composição base usada no cálculo, quando aplicável;
  - taxa de respiração em processos especiais, quando vinda do catálogo.
- Exibir esses campos como “dados do catálogo”, com aparência visual de bloqueado/somente leitura.
- Manter editável apenas na área administrativa de produtos/catalogo, onde o cadastro técnico é mantido.

4. Garantir que os cálculos usem sempre o catálogo quando houver produto selecionado
- Ajustar a montagem dos dados antes de salvar/calcular para que, se `product_id` estiver selecionado, os cálculos priorizem os valores atuais do catálogo em vez de valores digitados anteriormente.
- Isso evita que um valor antigo ou manual sobrescreva os dados técnicos oficiais.
- Aplicar essa regra em:
  - Produtos/carga térmica da câmara;
  - Túnel de congelamento/resfriamento;
  - Processos especiais/atmosfera controlada quando usar respiração, umidade ou referências de produto.

5. Melhorar a UI para deixar claro o que é editável e o que é técnico bloqueado
- Adicionar avisos curtos próximos aos campos bloqueados, por exemplo: “Propriedade técnica carregada do catálogo; edite no cadastro de produtos”.
- Evitar confusão entre campos de aplicação editáveis e propriedades térmicas oficiais.
- Manter a experiência de pré-preenchimento: selecionou o produto, o formulário já vem completo.

6. Verificação final
- Conferir seleção por busca/nome/iniciais.
- Conferir que medidas são pré-preenchidas no túnel.
- Conferir que dados térmicos ficam bloqueados nas telas de cálculo.
- Conferir que os cálculos usam os dados do catálogo.
- Rodar typecheck e build.

Detalhes técnicos
- A mudança será principalmente nos componentes:
  - `ColdProProductForm.tsx`
  - `ColdProTunnelForm.tsx`
  - `ColdProAdvancedProcessForm.tsx`
- Também será revisado o fluxo de persistência/cálculo em `coldpro.functions` se necessário, para garantir que o backend recarregue/priorize dados do catálogo por `product_id`.
- Não está previsto mudar a estrutura do banco neste momento, porque os campos de medidas e propriedades técnicas já existem no catálogo. Se durante a implementação aparecer algum campo essencial ausente, será criada uma migração apenas para estrutura, não para dados.