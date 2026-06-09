## Objetivo

Criar um **Módulo Marketing** dedicado para receber, qualificar e converter leads do site/campanhas, e implementar um **scoring de duas trilhas** (qualificação de marketing + conversão SDR) com painel unificado para o gestor.

---

## Etapa 1 — Banco de dados (migração)

### 1.1 Nova role
- Adicionar `'marketing'` ao enum `app_role`.
- Templates de permissão para `marketing`: `marketing.view`, `marketing.manage`, `marketing.convert`, `marketing.reports.view`.

### 1.2 Tabela `marketing_leads` (separada de `sdr_leads`)
Campos principais:
- `id`, `lead_code` (MKT-YYYYMMDD-XXXX), `received_at`, `status` (enum: `novo`, `em_analise`, `tentando_contato`, `qualificado`, `convertido`, `descartado`), `discard_reason`.
- Identificação: `contact_name`, `client_name`, `contact_email`, `contact_phone`, `city`, `state`, `segmento`, `aplicacao`, `mensagem`.
- Origem: `origem` (`site`, `whatsapp`, `telefone`, `evento`, `indicacao`, `manual`), `origem_detalhe` (jsonb: utm, referer, ip, campanha).
- Atribuição: `assigned_to` (uuid → profiles, marketing ou SDR), `assigned_at`, `first_response_at`, `qualified_at`, `converted_at`, `converted_to_sdr_lead_id`.
- RLS: marketing e gestores leem/escrevem tudo; SDR lê os que estão atribuídos a ele.
- GRANTs: `authenticated` (CRUD), `service_role` (ALL).

### 1.3 Tabela `marketing_lead_events` (auditoria/timeline)
- `lead_id`, `event_type` (`criado`, `atribuido`, `primeiro_contato`, `nota`, `mudou_status`, `convertido`, `descartado`), `actor_id`, `payload jsonb`, `created_at`.

### 1.4 Tabela `sdr_score_weights` (pesos configuráveis pelo gestor)
- Linha única (singleton) com pesos: `mkt_triado`, `mkt_qualificado`, `mkt_sla_bonus`, `mkt_descarte_sem_motivo`, `sdr_tratativa`, `sdr_reuniao_agendada`, `sdr_handoff_aceito`, `sla_mkt_minutos` (default 15).
- Acessível só por gestores.

### 1.5 RPCs
- `convert_marketing_lead_to_sdr(_lead_id uuid, _sdr_id uuid NULL)`: cria `sdr_leads` (priority_level=0), marca `marketing_leads.status='convertido'`, dispara notificação ao gestor (ou SDR se já atribuído).
- `discard_marketing_lead(_lead_id, _reason)`.
- `assign_marketing_lead(_lead_id, _user_id)`.
- `get_sdr_score_daily(_user_id, _date)` retorna breakdown por trilha.

### 1.6 Trigger
- Inserir evento em `marketing_lead_events` em criação/mudança de status/atribuição.
- Notificar role `marketing` (e gestor) na criação.

### 1.7 Endpoint público
- Ajustar `/api/public/leads/site` para gravar em `marketing_leads` (não em `sdr_leads`).

---

## Etapa 2 — Backend (server functions)

`src/lib/marketing-leads.functions.ts` + `.server.ts`:
- `listMarketingLeads({status, search, range})`
- `getMarketingLead(id)` (com timeline)
- `createMarketingLeadManual(...)` (cadastro interno)
- `updateMarketingLeadStatus(id, status, note?)`
- `assignMarketingLead(id, userId)`
- `convertMarketingLead(id, sdrId?)`
- `discardMarketingLead(id, reason)`
- `getMarketingDashboard(range)` — KPIs (entrada/dia, conversão %, SLA, top origens).
- `getSdrCompositeScore(userId, range)` — score por trilha + total.
- `getScoreWeights()` / `updateScoreWeights(...)` (gestor).

---

## Etapa 3 — UI: Módulo Marketing

Layout `/app/marketing` (gate: roles `marketing`, `gerente_comercial`, `diretoria`, `admin`; SDR tem leitura limitada).

Rotas:
- `/app/marketing` — Dashboard (KPIs: novos hoje/semana, taxa de conversão, SLA médio, funil até venda).
- `/app/marketing/leads` — Lista com filtros (status, origem, período, busca) + export CSV.
- `/app/marketing/kanban` — Kanban com colunas: `Novos` · `Em análise` · `Tentando contato` · `Qualificado` · `Convertido` · `Descartado`. Cards com: nome, empresa, origem, idade, badge SLA. Drag entre colunas (gestor/marketing) atualiza status.
- `/app/marketing/leads/$id` — Detalhe com timeline, notas, ações (Atribuir, Converter para SDR, Descartar).
- `/app/marketing/relatorios` — Por origem/campanha, por período, por SLA, conversão por analista.
- `/app/marketing/novo` — Cadastro manual.

Itens na sidebar (`AppShell.tsx`): novo grupo **Marketing** com Dashboard/Leads/Kanban/Relatórios para roles com acesso.

---

## Etapa 4 — Scoring de duas trilhas

### 4.1 Painel do SDR (`/app/sdr/sdr-performance`)
Card novo "Meu score do dia" com dois blocos:
- **Marketing**: triados, qualificados, descartados, SLA médio, pontos parciais.
- **Carteira**: tratativas, reuniões agendadas, handoffs, pipeline R$, pontos parciais.
- **Total composto** + posição no ranking (se gamificação ligada).

### 4.2 Painel do gestor (`/app/gestao/produtividade` — novo, ou estender existente)
- Tabela com SDRs × score (mkt + sdr + total) + drill-down.
- Botão "Configurar pesos" → modal editando `sdr_score_weights`.

### 4.3 Regras anti-gaming (no SQL)
- "Triado" só conta se `status` mudou para `qualificado` ou `descartado` com motivo registrado.
- "Qualificado" só pontua se permanecer 48h sem reversão (computar em `get_sdr_score_daily` via `qualified_at`).
- SLA mede `first_response_at - received_at`.

---

## Etapa 5 — Migração de dados existentes

Mover os leads atuais em `sdr_leads` com `origem='site'` e `sdr_id IS NULL` (P0) para `marketing_leads` com `status='novo'`, e remover de `sdr_leads`. (Confirmar antes de rodar — incluído como script revisável na migração.)

---

## Detalhes técnicos

- Server fns protegidas → `requireSupabaseAuth`; chamadas apenas dentro de `_authenticated/`.
- Endpoint público mantém rate-limit + CORS atuais.
- Notificações reutilizam `user_notifications`.
- Auditoria reutiliza padrão de `sdr_lead_edits` para mudanças sensíveis.

---

## Itens a confirmar antes de codar

1. **Role `marketing`** agora (recomendado) ou marketing usa `gerente_comercial` por enquanto?
2. **Migrar leads existentes** P0 de `sdr_leads` → `marketing_leads`? (Sim/Não)
3. **Pesos do score**: começo com defaults sugeridos (mkt_triado=1, mkt_qualificado=3, mkt_sla_bonus=1, mkt_descarte_sem_motivo=-2, sdr_tratativa=2, sdr_reuniao=5, sdr_handoff=10, sla_mkt=15min) e gestor ajusta na tela?
4. **Gamificação visível para SDR** (ranking) ou só gestor vê?
