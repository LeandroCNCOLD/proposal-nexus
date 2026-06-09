
## Objetivo
Receber leads vindos do site institucional da CN Cold (e cadastros manuais feitos por SDR/recepção) diretamente no banco de leads existente (`sdr_leads`), marcados com **prioridade de atendimento 0** (topo de fila) e roteados para o **gestor comercial distribuir** ao SDR responsável.

## Componentes

### 1. Endpoint público (embed no site)
`POST /api/public/leads/site` (rota TanStack em `src/routes/api/public/leads.site.ts`).
- Aceita JSON (formulário pode ser HTML/iframe no site da CN Cold ou chamada AJAX).
- Sem autenticação (rota `/api/public/*`), sem captcha por enquanto (conforme escolhido).
- Valida payload com Zod, normaliza telefone/e-mail, gera `lead_code` automático (`SITE-AAAAMMDD-####`).
- Insere em `sdr_leads` via `supabaseAdmin` com:
  - `origem = 'site'`
  - `priority = 0` (campo novo)
  - `sdr_status = 'Não Contatado'`
  - `temperature = 'Quente'` (lead inbound)
  - `sdr_id = NULL`, `handoff_status = 'pending_assignment'`
- Responde `{ ok: true, protocol: lead_code }` para o site exibir confirmação.
- CORS liberado para o domínio do site institucional.

### 2. Tela interna para SDR/recepção
Rota `/app/sdr/novo-lead` (sob `_authenticated`).
- Mesmo formulário, reutilizando a mesma `createServerFn` (`createInboundLead`) que o endpoint público chama internamente.
- Botão "Salvar e abrir" → cria o lead e navega para a ficha.
- Disponível no menu SDR como "Novo lead (site/telefone)".

### 3. Campos do formulário
Base mínima (alinhada com a resposta + esperando o modelo pronto que você vai compartilhar):
- Nome completo *
- Empresa / Razão social *
- E-mail *
- Telefone / WhatsApp *
- Cidade / UF *
- Segmento *
- Aplicação desejada (câmara fria, túnel, processo, etc.) — opcional
- Mensagem / necessidade — opcional
- Origem detalhada (página, campanha, UTM) — opcional, capturado automaticamente quando vier do site

> Quando você enviar o modelo pronto do formulário, ajustamos labels, ordem e obrigatoriedade antes do build.

### 4. Priorização e fila "Novos do Site"
- Nova coluna virtual no Kanban SDR: **"🔥 Novos do site (P0)"** — primeira coluna, mostra leads com `priority = 0` e `sdr_id IS NULL`.
- Cards com badge vermelho "P0 · aguardando distribuição" e SLA visível (tempo desde a chegada).
- Banner "Foco de hoje" passa a destacar P0 não atribuídos no topo.

### 5. Distribuição pelo gestor
- No card P0, ação rápida **"Atribuir SDR"** (visível apenas para `gerente_comercial`/`diretoria`/`admin`).
- Dialog usa `suggest_seller_for_handoff` adaptado para SDRs (nova função `suggest_sdr_for_assignment` — ordena por carga ativa ascendente).
- Ao atribuir: grava `sdr_id`, `sdr_name`, zera `priority` para 1 (mantém topo da fila do SDR), registra evento e dispara notificação para o SDR escolhido (`user_notifications` tipo `lead_assigned`).

### 6. Notificações
- Quando um lead P0 entra: notifica todos os usuários com papel `gerente_comercial`/`diretoria` ("Novo lead do site: {empresa} — aguardando distribuição").
- Quando atribuído: notifica o SDR ("Novo lead atribuído: {empresa} · responda em até X min").

## Mudanças de banco (migration)
- `sdr_leads`: adicionar
  - `origem text` (default `'manual'`; valores: `site`, `telefone`, `whatsapp`, `manual`, `evento`, `indicacao`)
  - `priority smallint not null default 5` (0 = urgente, 5 = normal)
  - `origem_detalhe jsonb` (UTM, página, etc.)
  - `received_at timestamptz default now()`
- Index parcial: `(priority, received_at) WHERE sdr_id IS NULL`.
- Função `assign_lead_to_sdr(_lead_id uuid, _sdr_id uuid)` (SECURITY DEFINER, restrita a gestores) — grava atribuição + evento + notificação.
- Função `suggest_sdr_for_assignment()` — retorna SDRs ordenados por carga ativa.
- Trigger `notify_managers_on_inbound_lead` em INSERT quando `priority = 0 AND sdr_id IS NULL`.

## Detalhes técnicos
- `createInboundLead` em `src/lib/leads-inbound.functions.ts` — sem `requireSupabaseAuth` (precisa ser chamável pela rota pública); usa `supabaseAdmin` por baixo. A versão interna (tela do SDR) chama a mesma fn, repassando `created_by` do usuário logado quando disponível.
- Rota pública faz validação Zod + rate-limit leve por IP (em memória, best-effort) só para evitar floods acidentais — mesmo sem captcha.
- Tipos regenerados após migration; UI do Kanban (`WalletKanban.tsx`) ganha coluna virtual + ação de atribuição condicional por papel.

## Fora de escopo desta fase
- Captcha/Turnstile (combinado: sem proteção agora).
- Auto-atribuição round-robin (combinado: gestor distribui manualmente).
- Página de marketing/landing do formulário no site institucional (entregamos o endpoint + um snippet HTML de exemplo).

Quando você me enviar o **modelo do formulário pronto**, eu ajusto os campos exatos antes de implementar.
