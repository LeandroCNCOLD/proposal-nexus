## Plano de melhoria dos relatórios do CN ColdPro

Vou evoluir o relatório para ficar alinhado ao padrão técnico/comercial informado, sem reintroduzir o antigo “Seletor Técnico”. A fonte de dados continuará sendo o cálculo atual do CodePro/ColdPro por ambiente.

### 1. Garantir dados corretos por ambiente
- Manter a regra: cada ambiente usa apenas o resultado calculado mais recente daquele ambiente.
- Aplicar a mesma regra nas seleções de equipamento, inclusive no envio para proposta, para evitar pegar seleção/cálculo antigo.
- No PDF e no laudo, deixar explícito o nome do ambiente e a carga requerida correspondente, evitando misturar total do projeto com resultado individual.

### 2. Enriquecer o bundle do relatório com dados de catálogo
- Buscar, junto da seleção salva, os dados completos do equipamento selecionado:
  - modelo, linha/série, gabinete, tipo, refrigerante, degelo, tensão/fase/frequência;
  - compressores cadastrados;
  - evaporador e condensador: modelos, vazão, área, volume interno, ventiladores, diâmetro, lançamento, carga estimada de fluido quando disponível;
  - ponto/curva de performance usado na seleção: capacidade, potência, COP, correntes, vazão, condições de evaporação/condensação/ambiente;
  - imagem do equipamento, quando cadastrada.
- Usar esses dados reais do catálogo antes de qualquer texto genérico/estimado.

### 3. Criar PDF completo no padrão de 5 páginas
- Reestruturar o gerador PDF para o formato profissional solicitado:
  1. Capa azul-marinho com cards de carga total, kW e TR.
  2. Resumo do projeto, tabela de ambientes, visão geral e gráficos de distribuição.
  3. Cálculo executado e seleção por ambiente, com componentes, subtotal, segurança, carga requerida e comparativo requerido x oferecido.
  4. Especificações técnicas e comerciais do equipamento selecionado, usando dados de catálogo.
  5. Laudo final técnico/comercial com conclusão, validações, riscos e recomendação.
- Para projetos com múltiplos ambientes, organizar a seção técnica por ambiente, mantendo cada ambiente com seu resultado e seleção.

### 4. Modernizar gráficos e curvas
- Melhorar os gráficos PDF atuais:
  - pizza de distribuição de cargas por componente;
  - barra empilhada percentual;
  - barras horizontais de componentes;
  - comparativo “Carga Requerida x Carga Oferecida”.
- Substituir a curva simples de temperatura por uma curva X/Y com tempo e temperatura:
  - X = tempo do processo ou tempo estimado;
  - Y = temperatura do produto/ar;
  - pontos principais: temperatura de entrada, congelamento/mudança de estado quando aplicável, temperatura final.
- Quando houver produto com dados suficientes, usar as etapas reais calculadas; quando faltar informação, indicar como estimativa auditável.

### 5. Criar versão curta para inserir na proposta
- Adicionar uma geração separada de PDF resumido com 2 páginas:
  - Página 1: resumo técnico do cálculo por ambiente, cargas, gráficos e resultado requerido.
  - Página 2: equipamento selecionado, capacidade ofertada, sobra técnica, principais especificações e imagem.
- Adicionar botão na tela do relatório: “Gerar resumo para proposta”.
- Salvar e anexar esse PDF resumido à proposta quando o projeto estiver vinculado, além do memorial completo continuar disponível.

### 6. Regras de validação técnica no laudo
- Aplicar status automático por ambiente:
  - carga oferecida menor que requerida: ALERTA;
  - sobra técnica menor que 10%: CRÍTICO;
  - sobra maior que 50%: SUPERDIMENSIONADO;
  - sobra entre 10% e 50%: ADEQUADO.
- Gerar recomendações coerentes:
  - déficit relevante: recomendar equipamento maior ou múltiplas unidades;
  - sobra excessiva: recomendar revisão para equipamento menor;
  - margem adequada: aprovar tecnicamente com observações de premissas.

### 7. Interface e integração
- Atualizar `ColdProReport` para exibir botões separados:
  - “Gerar memorial PDF completo”;
  - “Gerar resumo PDF para proposta”.
- Ajustar os hooks e server functions para aceitar o tipo de relatório.
- Preservar o fluxo atual de download, registro em documentos e anexo à proposta.

### 8. Validação final
- Rodar build do projeto.
- Conferir que os PDFs usam dados atuais do cálculo por ambiente.
- Conferir que o envio para proposta não usa seleção/cálculo antigo.
- Validar que projetos sem equipamento, sem imagem ou com dados de catálogo incompletos geram PDF sem quebrar, marcando os campos ausentes como “não informado”.

## Arquivos principais a alterar
- `src/integrations/coldpro/coldpro-memorial.functions.ts`
- `src/integrations/coldpro/coldproMemorialPdfLib.ts`
- `src/components/coldpro/ColdProReport.tsx`
- `src/features/coldpro/use-coldpro.ts`
- `src/routes/app.coldpro.$id.tsx`
- `src/features/coldpro/push-coldpro-to-proposal.functions.ts`

Não pretendo criar novas tabelas neste primeiro momento, porque os dados necessários já existem no catálogo e nos resultados atuais.