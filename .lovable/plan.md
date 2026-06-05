## Objetivo

Permitir atribuir acessos **por módulo** a cada usuário, partindo de **templates por perfil** (ex.: SDR, Vendedor, Gerente) que podem ser editados, e depois **acrescentar ou remover liberações** individuais para cada usuário.

## Como vai funcionar

1. **Módulos do sistema** (lista fixa, gerenciada em código): SDR, CRM, Propostas, ColdPro, Nomus, Configurações, etc. Cada módulo tem um conjunto de **permissões** (ex.: `sdr.bank.view`, `sdr.bank.lock`, `proposals.create`, `proposals.approve`, `configuracoes.users.manage`).

2. **Templates de perfil** (tabela `role_permission_templates`): para cada `app_role` (admin, diretoria, gerente_comercial, vendedor, sdr, orcamentista, etc.), uma lista padrão de permissões por módulo. Editável na tela de Configurações por admin/diretoria.

3. **Overrides por usuário** (tabela `user_permission_overrides`): cada linha é `(user_id, permission_key, effect)` onde `effect` é `grant` (adiciona) ou `revoke` (remove). Permite liberar algo extra ou tirar uma permissão herdada do perfil.

4. **Resolução**: permissão efetiva do usuário = união das permissões dos templates de todos os papéis dele, **mais** os grants do override, **menos** os revokes do override.

5. **Checagem no código**: nova função SQL `has_permission(_user_id, _permission_key)` (security definer) e hook React `usePermission('chave')`. Substituímos checagens diretas por papel pelas checagens por permissão nas telas principais.

## Telas

Em **Configurações → Acessos**, duas abas novas:

- **Perfis (templates)**: lista de papéis; ao clicar, mostra checkboxes agrupados por módulo. Salvar atualiza o template.
- **Usuários**: ao abrir um usuário, mostra a lista de permissões herdadas (em cinza, vindas dos perfis dele) e permite marcar “liberar extra” ou “bloquear”. Salva como overrides.

## Detalhes técnicos

- Migration cria: `role_permission_templates(role, permission_key)` e `user_permission_overrides(user_id, permission_key, effect)`, com RLS restrita a admin/diretoria/gerente_comercial para escrita; leitura permitida ao próprio usuário para suas permissões.
- Catálogo de módulos/permissões fica em `src/lib/permissions.ts` (tipado), com labels em PT-BR.
- Server function `getMyPermissions()` retorna o set efetivo para o usuário logado, cacheado por sessão.
- Seed inicial: popular templates a partir das checagens de papel existentes hoje (ex.: gerente_comercial recebe `sdr.bank.lock`, todos vendas recebem `proposals.create`, etc.).

## Perguntas antes de implementar

1. **Escopo agora**: começo com os módulos **SDR + Configurações** (onde acabamos de mexer) e depois expandimos para CRM/Propostas/ColdPro/Nomus? Ou já mapeio tudo de uma vez (mais demorado)?
2. **Criar novos perfis**: você quer poder **criar perfis customizados** além dos atuais (ex.: “SDR Sênior”, “Vendedor Junior”) ou só editar os templates dos perfis existentes?
3. **Granularidade**: por módulo basta ações tipo `view / create / edit / delete / approve`, ou precisa de algo mais fino (ex.: “ver só leads da própria carteira”)? Regras tipo “só os meus” continuam via RLS, separadas das permissões.
