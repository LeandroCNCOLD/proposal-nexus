Plano de correção e melhoria do ColdPro

Constatação no projeto Lamar
- Projeto encontrado: `Lamar Cãmara de Sorvetes`.
- Há um erro de digitação no nome do projeto.
- Há um ambiente vazio chamado `Ambiente 1`.
- No ambiente `Câmara de Sorvetes`, o produto `Sorvete de Chocolate` aparece 3 vezes, com a mesma carga de 12.000 kg/dia e timestamps muito próximos. Isso indica que o botão de salvar produto permite múltiplos inserts quando clicado repetidamente, porque o formulário não mantém o `id` do produto salvo nem bloqueia o botão durante o salvamento.

O que vou implementar

1. Editar nome do projeto
- Adicionar função protegida para atualizar dados básicos do projeto ColdPro.
- Incluir no topo da página do projeto um modo de edição do nome.
- Permitir corrigir o nome, por exemplo de `Lamar Cãmara de Sorvetes` para `Lamar Câmara de Sorvetes`.
- Atualizar a tela imediatamente após salvar.

2. Excluir ambiente
- Adicionar função protegida para excluir ambiente.
- Incluir botão “Excluir ambiente” na área do ambiente selecionado.
- Exigir confirmação antes de excluir.
- Ao excluir, remover também dados dependentes do ambiente, como produtos, resultados, seleção de equipamento, túnel e processos vinculados, usando as regras existentes do banco ou limpeza explícita segura.
- Após excluir, selecionar automaticamente outro ambiente disponível.

3. Corrigir duplicação de produtos
- Ajustar o formulário de produto para receber e editar produto existente quando já houver produto no ambiente.
- Após salvar um produto novo, armazenar o `id` retornado para que o próximo clique faça update, não novo insert.
- Bloquear o botão enquanto o salvamento está em andamento para impedir clique duplo/triplo.
- Alterar a lógica de upsert para ser mais segura quando não houver `id`.
- Mostrar os produtos existentes do ambiente de forma clara, com opção de editar e excluir se necessário.

4. Limpar o projeto Lamar
- Corrigir o nome do projeto Lamar.
- Remover o ambiente vazio `Ambiente 1`, se ele realmente não tiver produtos/resultados úteis.
- Remover os produtos duplicados, mantendo apenas um `Sorvete de Chocolate` no ambiente `Câmara de Sorvetes`.
- Recalcular ou deixar pronto para recalcular o ambiente após a limpeza.

5. Validação
- Rodar TypeScript e build completo.
- Verificar que:
  - o projeto pode ter o nome editado;
  - ambiente pode ser excluído com confirmação;
  - salvar produto repetidamente não cria duplicatas;
  - o projeto Lamar fica com dados limpos e consistentes.

Detalhes técnicos
- Arquivos principais a alterar:
  - `src/features/coldpro/coldpro.functions.ts`
  - `src/features/coldpro/use-coldpro.ts`
  - `src/routes/app.coldpro.$id.tsx`
  - `src/components/coldpro/ColdProProductForm.tsx`
- Também farei operações pontuais nos dados existentes do projeto Lamar usando a ferramenta apropriada de atualização de dados, não migração de schema.
- Não será necessário criar novas tabelas para esta melhoria.