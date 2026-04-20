

# Integração CN COLD ↔ Nomus ERP

## Objetivo

Conectar o sistema ao Nomus para que **clientes, contatos, vendedores, produtos, condições de pagamento e tabelas de preço** sejam espelhados do ERP, e **propostas + follow-ups** criados aqui sejam enviados de volta como **Propostas/Pedidos de venda** no Nomus. O Nomus continua sendo a fonte de verdade de preço; o CN COLD é a camada de gestão, template e inteligência.

## Arquitetura

```text
CN COLD (TanStack Start)        Nomus ERP
─────────────────────           ───────────────────
Edge function nomus-sync   →    GET /clientes, /contatos, /produtos,
(pull periódico + on-demand)    /vendedores, /condicoes-pagamento,
                                /tabelas-preco, /propostas
                                
Edge function nomus-push   →    POST/PUT /propostas
(quando proposta muda)          POST /propostas/{id}/eventos (follow-up)
                                POST /pedidos-venda (quando ganha)

Tabela nomus_sync_log           ← auditoria de cada chamada
Tabela nomus_settings           ← URL base, credencial, mapeamentos
Colunas nomus_id em             ← linka registro local ↔ ERP
clients/contacts/equipments/
proposals/profiles
```

## O que será construído

### 1. Configuração e credenciais
- Tela **Configurações → Integração Nomus** (`/app/configuracoes/nomus`) com: URL base (`https://{empresa}.nomus.com.br/{empresa}/rest`), chave de integração (Basic), status da última sincronização, botão "Testar conexão", botão "Sincronizar agora".
- Secret `NOMUS_API_KEY` e `NOMUS_BASE_URL` armazenados como secrets do Cloud (server-only).
- Tabela `nomus_settings` (singleton) com toggles por entidade (sincronizar clientes? produtos? etc.) e direção (pull/push/bi).

### 2. Schema — colunas e tabelas novas
Migration adicionando:
- `clients.nomus_id`, `clients.nomus_synced_at`
- `client_contacts.nomus_id`
- `equipments.nomus_id` (linka modelo CN Cold ao produto Nomus para puxar preço)
- `proposals.nomus_id`, `proposals.nomus_pedido_id`, `proposals.nomus_synced_at`
- `profiles.nomus_vendedor_id` (linka usuário ao vendedor do ERP)
- Nova tabela `nomus_payment_terms` (espelho de condições de pagamento) + FK opcional em `proposals.payment_term_id`
- Nova tabela `nomus_price_tables` + `nomus_price_table_items` (preço por produto/tabela)
- Nova tabela `nomus_sync_log` (entity, operation, direction, status, payload, error, duration_ms, created_at)
- Nova tabela `nomus_sync_state` (cursor por entidade para sync incremental)

### 3. Cliente HTTP Nomus (server-side)
`src/integrations/nomus/client.ts` (server-only):
- Wrapper `nomusFetch(path, opts)` com Basic Auth, JSON, paginação automática, **tratamento de 429** (lê `tempoAteLiberar`, aguarda, retenta até 3x), logging em `nomus_sync_log`.
- Helpers: `listAll(endpoint, query)`, `getById`, `create`, `update`.
- Tipos TS para cada recurso usado.

### 4. Edge functions (server functions TanStack)
- `nomus-sync-clientes` — pull de clientes/contatos do ERP, upsert em `clients`/`client_contacts` por `nomus_id`.
- `nomus-sync-produtos` — pull de produtos + tabelas de preço, atualiza `equipments` quando `nomus_id` bate.
- `nomus-sync-aux` — vendedores, condições de pagamento, formas de pagamento, empresas (para uso em selects).
- `nomus-sync-propostas` — pull bidirecional: traz propostas do Nomus que não estão aqui, e empurra propostas locais sem `nomus_id`.
- `nomus-push-proposta` — chamada quando proposta é criada/atualizada/muda de status localmente; cria/atualiza no Nomus e armazena `nomus_id`.
- `nomus-push-followup` — quando um `proposal_timeline_event` é criado, posta no Nomus.
- `nomus-push-pedido` — quando proposta vira `ganha`, gera Pedido de venda no Nomus.
- `nomus-test-connection` — chamada simples (`GET /empresas?pagina=1`) para validar credencial.

### 5. UI

**`/app/configuracoes/nomus`**
- Form de credenciais (URL + chave) com botão "Testar conexão".
- Cards por entidade: Clientes, Contatos, Produtos, Vendedores, Condições de pagamento, Tabelas de preço, Propostas — cada um com último sync, contagem, botão "Sincronizar agora", toggle ativo/inativo.
- Tabela de log das últimas 50 sincronizações (status, duração, erro).

**`/app/clientes`** (alterações)
- Badge "Nomus" em clientes vinculados, badge "Local" nos não vinculados.
- Botão "Vincular ao Nomus" abre busca de cliente no ERP.
- Ao criar cliente novo: opção "Criar também no Nomus".

**`/app/equipamentos`** (alterações)
- Coluna `nomus_id` no formulário de equipamento.
- Botão "Buscar produto no Nomus" para vincular.
- Mostra preço atual da tabela Nomus quando vinculado.

**Proposta (`/app/propostas/$id`)** (alterações)
- Card "Sincronização Nomus": status (não sincronizada / sincronizada / erro), número da proposta no Nomus, número do pedido (se ganha), botão "Enviar para Nomus", botão "Atualizar do Nomus".
- Ao escolher itens da proposta: dropdown puxa equipamentos vinculados ao Nomus e preço da tabela selecionada.
- Quando proposta muda para `ganha`: prompt "Gerar Pedido de venda no Nomus?".
- Cada evento de timeline com toggle "Enviar follow-up para o Nomus".

### 6. Triggers automáticos
- Hook em `useMutation` de criar/atualizar proposta dispara `nomus-push-proposta` em background (não bloqueia UI; mostra toast no resultado).
- Trigger em `proposal_timeline_events` (via server function) chama `nomus-push-followup`.
- Ao mudar status para `ganha`, modal pergunta sobre Pedido de venda.

### 7. Sync incremental e throttling
- Cada entidade guarda `last_synced_at` em `nomus_sync_state`.
- Pulls usam filtro `query=dataAlteracao>{last_synced_at}` quando o endpoint suportar (a confirmar quando tivermos a chave).
- Backoff exponencial + respeito ao `tempoAteLiberar` em todos os fetches.
- Limite de 1 sync simultâneo por entidade (lock leve via `nomus_sync_state.running`).

## Detalhes técnicos

- **Auth Nomus:** header `Authorization: Basic {chave-integração-rest}`, `Content-Type: application/json`. Chave armazenada como secret, nunca exposta ao cliente.
- **Base URL:** parametrizada por instalação (campo no `nomus_settings`), não hardcoded.
- **Paginação:** loop `?pagina=N` até retornar lista vazia; máximo 100 páginas por sync para segurança.
- **Mapeamento de campos** (a refinar quando rodarmos o primeiro `GET` real):
  - `clients`: nome, documento (CNPJ/CPF), endereço → `clients.name/document/city/state`
  - `produtos`: código, descrição, família → `equipments.model/technical_notes`, FK `nomus_id`
  - `propostas`: cliente, vendedor, itens, valor, validade, status → `proposals.*` + `proposal_items.*`
- **RLS:** novas tabelas só leitura para autenticados; gravação restrita a `admin`/`gerente_comercial` ou via service role (edge functions usam `supabaseAdmin`).
- **Logs:** toda chamada HTTP entra em `nomus_sync_log` para auditoria e debug; UI de configurações lê dali.
- **Erros:** edge functions retornam `{ ok, data, error }` padronizado; UI mostra toast com mensagem amigável e link para o log.

## O que precisa de você

1. **URL da sua instância Nomus** (ex.: `https://suaempresa.nomus.com.br/suaempresa/rest`) e a **chave de integração REST** (vou pedir como secret quando começarmos).
2. **Confirmação dos sentidos de sync por entidade**:
   - Clientes — Nomus → CN COLD (pull) ou bidirecional?
   - Produtos/Preços — Nomus → CN COLD (pull, sempre)?
   - Propostas — CN COLD → Nomus (push) ou bi?
   - Pedido de venda — gerado no Nomus quando proposta é ganha aqui (push)?
3. Após eu rodar o primeiro `GET /clientes` com sua chave, posso ajustar mapeamento de campos com base no JSON real (a doc pública só lista recursos, não os schemas de cada um).

## Fora do escopo desta entrega

- NF-e, contas a pagar/receber, estoque, ordens de produção, boletos (Nomus tem, mas não é foco do CN COLD).
- Webhooks do Nomus para push em tempo real (a doc não mostra suporte; usaremos polling agendado + sync manual).
- Reconciliação de conflito quando o mesmo cliente é editado nos dois lados simultaneamente — versão 1 usa "última escrita vence" com log; resolução manual via UI vem depois se necessário.

