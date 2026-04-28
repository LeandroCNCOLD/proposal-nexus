Plano para ajustar a autenticação via Nomus conforme o documento enviado e o fluxo que você descreveu.

## Objetivo

Quando o gestor buscar usuários do Nomus e aprovar um usuário:

1. O sistema cria ou ativa o login desse usuário internamente.
2. O gestor informa uma senha provisória na tela.
3. O usuário acessa em `/login` com e-mail + senha provisória.
4. No primeiro acesso, o sistema obriga a troca da senha.
5. Não haverá envio de e-mail neste momento.

## O que já existe

A base do fluxo já foi iniciada:

- A tela de Configurações já tem “Gestão de perfis e usuários”.
- Já existe busca de usuários internos no Nomus tentando endpoints como `/usuarios`, `/users`, `/colaboradores`, `/funcionarios` e `/pessoas`.
- Já existe fila `user_access_queue` com pendência por padrão.
- Já existe criação/ativação de usuário com senha provisória.
- Já existe campo `must_change_password` para forçar troca no primeiro acesso.
- Já existe bloqueio no `/app` pedindo “Troque sua senha”.

## Ajustes que vou fazer

### 1. Melhorar a leitura do arquivo/brief de autenticação

Como o arquivo DOCX enviado fala de “Autenticação via Nomus - Controle de Usuários e Perfis”, vou consolidar o comportamento no app para refletir esse fluxo:

```text
Nomus -> Busca usuários internos -> Fila pendente -> Gestor aprova + senha provisória -> Login criado -> Usuário troca senha no primeiro acesso
```

### 2. Remover dependência de e-mail no fluxo de aprovação

Vou garantir que o botão “Aprovar” não tente convite por e-mail nem reset por e-mail.

Na aprovação, a função seguirá usando criação direta do login com:

- e-mail do usuário vindo do Nomus ou cadastro manual;
- nome completo;
- origem `nomus:*` ou `manual`;
- ID do usuário no Nomus, quando disponível;
- senha provisória informada pelo gestor;
- e-mail já confirmado internamente para permitir login imediato;
- `must_change_password = true`.

### 3. Deixar a tela de gestão mais clara para o gestor

Na seção “Pendentes de liberação”, vou ajustar textos e campos para deixar explícito:

- “Senha provisória” é obrigatória para aprovar.
- “Entregue essa senha manualmente ao usuário”.
- “No primeiro acesso ele será obrigado a trocar”.
- O botão “Aprovar” criará o login imediatamente.

Também vou ajustar as mensagens de sucesso para dizer algo como:

- “Usuário criado. Informe ao usuário o e-mail e a senha provisória para o primeiro acesso.”
- “Usuário existente ativado com nova senha provisória.”

### 4. Fortalecer o login provisório

No `/login`, vou ajustar os textos para esse modelo:

- A aba principal será “Entrar”.
- O texto explicará que o usuário deve usar o e-mail e a senha provisória recebidos do gestor.
- A criação livre de conta precisa ser revista, porque o fluxo definido agora é aprovação por gestor. Vou remover ou ocultar a aba “Criar conta” para não permitir autocadastro fora da fila de aprovação, a menos que você peça o contrário depois.

### 5. Melhorar a tela obrigatória de troca de senha

No bloqueio de primeiro acesso, vou manter a troca obrigatória e melhorar a experiência:

- validar mínimo de 8 caracteres;
- confirmar a nova senha;
- mostrar mensagem clara;
- depois de trocar, liberar o acesso ao sistema;
- limpar `must_change_password` no perfil.

### 6. Melhorar a busca de usuários no Nomus

Vou revisar a função que busca usuários internos no Nomus para:

- priorizar endpoints de usuários/colaboradores antes de `/pessoas`, evitando trazer clientes;
- ignorar registros sem e-mail;
- deduplicar por e-mail;
- preservar o ID do Nomus;
- definir status sempre como pendente por padrão;
- não aprovar automaticamente;
- retornar na tela quais fontes/endpoints foram tentados quando não encontrar usuários.

### 7. Manter controle de perfis “TODOS”

Como você indicou “Níveis de acesso: TODOS”, vou manter os perfis disponíveis para o gestor selecionar:

- Admin
- Diretoria
- Gerente comercial
- Engenharia
- Orçamentista
- Administrativo
- Vendedor
- ColdPro

A atribuição continuará em tabela separada de perfis/cargos, não dentro do cadastro principal do usuário.

## Detalhes técnicos

Arquivos que serão ajustados:

- `src/integrations/nomus/server.functions.ts`
  - Revisar importação de usuários internos do Nomus.
  - Garantir criação direta de usuário com senha provisória.
  - Garantir reset manual de senha provisória.
  - Remover qualquer dependência de convite por e-mail.

- `src/routes/app.configuracoes.index.tsx`
  - Melhorar UI da fila de aprovação.
  - Melhorar textos e mensagens.
  - Reforçar campo de senha provisória.
  - Melhorar a busca/importação de usuários Nomus.

- `src/routes/login.tsx`
  - Ajustar texto para login com senha provisória.
  - Ocultar/remover autocadastro livre para que o acesso nasça pela aprovação do gestor.

- `src/routes/app.tsx`
  - Refinar tela obrigatória de troca de senha, mantendo o bloqueio até a troca ser concluída.

Banco de dados:

- Não deve precisar de nova estrutura grande, porque já existem `profiles`, `user_roles`, `user_access_queue` e `must_change_password`.
- Se durante a implementação for necessário guardar algum detalhe adicional do Nomus ou auditoria de aprovação, criarei uma migração pequena com políticas de acesso adequadas.

## Resultado esperado para o usuário final

Fluxo prático:

1. Gestor entra em Configurações > Gestão de perfis e usuários.
2. Clica em “Buscar usuários internos no Nomus”.
3. O sistema lista os usuários encontrados como pendentes.
4. Gestor escolhe/valida o perfil.
5. Gestor digita uma senha provisória.
6. Clica em “Aprovar”.
7. O usuário já consegue entrar no sistema usando e-mail + senha provisória.
8. Ao entrar, o sistema força a troca da senha.
9. Depois da troca, o usuário acessa normalmente conforme os perfis liberados.