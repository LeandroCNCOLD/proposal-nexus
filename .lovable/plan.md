## Plano

Implementar na página de Clientes uma abertura de detalhes ao clicar em qualquer linha da tabela.

### O que será exibido

- Cabeçalho do cliente com nome, razão social/nome fantasia e ID Nomus.
- Dados fiscais:
  - CNPJ/CPF
  - Inscrição estadual
  - Inscrição municipal
  - Tipo de pessoa / contribuinte quando disponível no payload Nomus
- Dados cadastrais:
  - e-mail
  - telefone
  - site
  - status ativo/inativo
  - origem Nomus
- Endereço completo:
  - CEP
  - logradouro
  - número
  - complemento
  - bairro
  - cidade/UF
  - país
- Dados comerciais:
  - segmento/classificação/CNAE
  - região
  - vendedor vinculado
  - representante vinculado
- Contatos cadastrados vinculados ao cliente, quando existirem.
- Uma seção “Dados completos do Nomus” com os demais campos do `nomus_raw`, para mostrar tudo que foi sincronizado e não tem campo próprio ainda.

### Como será a interação

- A linha da tabela ficará clicável.
- Ao clicar no cliente, abrirá um modal grande com rolagem interna.
- O usuário poderá fechar e voltar à lista sem sair da página.

### Arquivo principal

- `src/routes/app.clientes.tsx`

### Observação

Para clientes que ainda não tiveram detalhe completo sincronizado, alguns campos continuarão vazios até a sincronização passar por eles. O modal mostrará os campos locais disponíveis e, quando houver `nomus_raw`, também exibirá o payload cadastral completo do Nomus.