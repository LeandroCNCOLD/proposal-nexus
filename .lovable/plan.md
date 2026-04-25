Vou adicionar um botão de sincronização diretamente na página `/app/clientes`.

## Implementação

1. Adicionar ação no cabeçalho da página Clientes
- Incluir botão “Sincronizar Nomus” ao lado de “Novo cliente”.
- Usar ícone de atualização e estado de carregamento enquanto sincroniza.

2. Conectar com a função existente do Nomus
- Reutilizar a função já existente `nomusSyncClients` em `src/integrations/nomus/server.functions.ts`.
- Ao clicar, chamar a sincronização de clientes do Nomus.
- Exibir mensagem de sucesso com quantidade sincronizada.
- Exibir erro amigável se a integração falhar.

3. Atualizar a lista automaticamente
- Após sincronizar, invalidar/recarregar a query `clients` para a tabela mostrar os clientes trazidos do Nomus imediatamente.
- Também atualizar o estado/log de sync se necessário.

4. Ajustar responsividade
- Manter os botões do cabeçalho quebrando linha em telas menores.
- Evitar que a tabela ou os botões estourem a largura em mobile.

## Arquivo principal

- `src/routes/app.clientes.tsx`

A implementação será validada com TypeScript após sua aprovação.