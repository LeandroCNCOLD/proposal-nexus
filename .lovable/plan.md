## Diagnóstico do mapeamento atual

O mapeamento atual ainda está incompleto para o modelo do Nomus:

- A sincronização usa `GET /clientes` e `GET /clientes/{id}`, mas trata o retorno como se o cliente tivesse campos diretos `vendedor`, `representante`, `segmento` e `regiao`.
- Nos dados reais sincronizados, o Nomus retorna vendedores e representantes como arrays dentro da pessoa:
  - `vendedores: [{ id, nome, ... }]`
  - `representantes: [{ id, nome, ... }]`
- Por isso `nomus_seller_name`, `nomus_representative_name`, `segment` e `region` estão ficando vazios.
- Contatos ainda não estão sendo trazidos: a tabela `client_contacts` está com 0 registros, e o endpoint documentado para isso é `GET /pessoas/{idPessoa}/contatos`.
- Como o Nomus trata tudo como `pessoas`, o ID correto para contatos é o ID da pessoa/cliente vindo do Nomus, mesmo quando a listagem está em `/clientes`.
- O estado da sincronização de clientes ficou com `running=true`, apesar de `last_cursor` estar finalizado, então também precisa ser normalizado para não parecer que ainda está rodando.

## Plano de correção

1. Ajustar o mapeamento de pessoa/cliente do Nomus
   - Manter `/clientes` como fonte para trazer apenas pessoas que são clientes.
   - Tratar o payload como `pessoa`.
   - Continuar ignorando fornecedores, conforme solicitado.
   - Mapear corretamente:
     - Nome/razão social/nome fantasia
     - CPF/CNPJ
     - IE/IM
     - Endereço principal
     - E-mail/telefone principal
     - CNAE/classificação/observações quando existirem
     - Ativo/inativo

2. Corrigir vendedores e representantes vinculados
   - Ler `vendedores[]` e `representantes[]`, não apenas campos diretos.
   - Gravar o primeiro vínculo principal em:
     - `clients.nomus_seller_id`
     - `clients.nomus_seller_name`
     - `clients.nomus_representative_id`
     - `clients.nomus_representative_name`
   - Preservar todos os vínculos completos dentro de `clients.nomus_raw`.
   - Quando necessário, cruzar com as tabelas espelho `nomus_sellers` e `nomus_representatives` para enriquecer nome/documento/e-mail.

3. Implementar sincronização de contatos da pessoa
   - Para cada cliente/pessoa sincronizada, chamar `GET /pessoas/{idPessoa}/contatos`.
   - Gravar cada contato em `client_contacts` vinculado ao cliente local.
   - Mapear campos esperados:
     - `nomus_id`
     - nome
     - cargo/função
     - e-mail
     - telefone
     - celular
     - contato principal quando o Nomus informar
     - payload completo em `nomus_raw`
   - Evitar duplicidade usando chave única por contato do Nomus quando existir.

4. Ajustar a estrutura do banco se necessário
   - Adicionar uma restrição única segura para contatos Nomus, por exemplo `(client_id, nomus_id)` quando `nomus_id` existir.
   - Adicionar campos auxiliares somente se forem necessários para preservar o padrão do Nomus, como status ativo, observações do contato ou tipo do contato.
   - Manter RLS existente: usuários autenticados podem consultar; alterações operacionais continuam via backend seguro.

5. Melhorar controle de lote e limite do Nomus
   - Reduzir o risco de bloqueio por muitas chamadas de detalhe/contato no mesmo clique.
   - Processar um lote menor por execução ou limitar chamadas de detalhe/contato por lote.
   - Tratar HTTP 429 sem quebrar a sincronização inteira.
   - Garantir que `nomus_sync_state.running` volte para `false` ao finalizar ou ao dar erro.

6. Atualizar tela de clientes
   - Exibir vendedor e representante corretamente.
   - Mostrar dados de contato principal na lista ou em uma expansão/detalhe simples.
   - Atualizar o retorno do botão “Sincronizar Nomus” para informar também quantos contatos foram trazidos.

## Resultado esperado

Depois da alteração, ao clicar em “Sincronizar Nomus”:

- Clientes continuarão vindo apenas da lista de clientes do Nomus, sem fornecedores.
- Cada cliente será tratado como uma pessoa Nomus.
- Contatos cadastrados em `/pessoas/{idPessoa}/contatos` serão salvos em `client_contacts`.
- Vendedores e representantes vinculados passarão a aparecer corretamente.
- O payload completo do Nomus continuará preservado para auditoria e ajustes futuros.

## Detalhes técnicos

Arquivos principais a alterar:

- `src/integrations/nomus/endpoints.ts`
  - Usar/importar `pessoaContatosPath(idPessoa)` no sync.

- `src/integrations/nomus/server.functions.ts`
  - Criar helpers de mapeamento para arrays `vendedores[]` e `representantes[]`.
  - Criar função interna para sincronizar contatos por pessoa.
  - Retornar `{ count, contactsCount, skipped, done, nextPage }`.
  - Garantir `running=false` no fim.

- `src/routes/app.clientes.tsx`
  - Atualizar toast do sync com clientes e contatos.
  - Exibir vendedor/representante/contato conforme dados disponíveis.

- Migração Lovable Cloud, se necessário:
  - Índice/unique parcial para contatos do Nomus.
  - Campos complementares de contato, apenas se o payload real exigir.