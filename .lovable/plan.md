Plano para corrigir o menu responsivo:

1. Remover o menu horizontal superior criado para telas menores.
   - O menu não deve virar uma barra superior com todos os links.
   - O cabeçalho continuará apenas com busca/usuário/botão de menu.

2. Implementar menu lateral responsivo correto.
   - Em desktop: manter a sidebar lateral fixa à esquerda.
   - Em tablet/mobile: usar um botão no topo para abrir/fechar o menu lateral em gaveta.
   - O menu deve aparecer pela lateral, não como faixa superior.

3. Usar o padrão de sidebar já existente no projeto.
   - Aproveitar `SidebarProvider`, `Sidebar`, `SidebarTrigger`, `SidebarContent`, `SidebarMenu` etc.
   - Configurar `collapsible="icon"` ou gaveta mobile para o menu não sumir sem opção de retorno.
   - Manter destaque visual da rota ativa.

4. Preservar responsividade do conteúdo.
   - Manter os ajustes de formulários, tabelas e espaçamentos responsivos já aplicados.
   - Garantir que o conteúdo principal não estoure lateralmente quando a sidebar estiver aberta ou recolhida.

5. Validar.
   - Rodar verificação TypeScript para confirmar que a alteração não quebrou o app.
   - Conferir especificamente o layout em largura parecida com a atual do usuário, aproximadamente 768px.