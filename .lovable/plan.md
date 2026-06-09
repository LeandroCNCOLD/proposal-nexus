## Objetivo

Aplicar no módulo **Marketing** a mesma lógica de "carteira com lock" que já existe no SDR, padronizar os nomes (sem colidir com "Propostas" do módulo Vendas), e remover do SDR o cadastro de lead site/telefone (passa a viver só em Marketing).

---

## 1. Renomear menus (sem mudar URLs)

**Marketing** (`src/routes/app.marketing.tsx`):
- "Lista de leads" → **Banco de Leads de Marketing**
- "Novo lead" → **Registrar Lead Recebido**
- Nova aba **Minha Carteira de Marketing**
- Mantém: Dashboard, Kanban, Configurar pontuação

**SDR** (`src/components/AppShell.tsx`):
- "Banco de leads" → **Banco de Leads Qualificados**
- "Minha Carteira" → **Minha Carteira de Leads Qualificados**
- **Remover** "Novo lead (site/telefone)"

(Evita conflito com "Propostas" de Vendas.)

---

## 2. Lock de leads em Marketing (espelho do SDR)

Migration adiciona em `marketing_leads`:
- `locked_by_sdr_id uuid`, `locked_by_sdr_name text`, `locked_at timestamptz`, `lock_expires_at timestamptz`

Três funções `SECURITY DEFINER`:
- `claim_marketing_lead(_lead_id)` — bloqueia por 7 dias se livre; preenche `assigned_to`/`assigned_at` se nulo
- `release_marketing_lead(_lead_id)` — libera (dono ou gestor)
- `renew_marketing_lead_lock(_lead_id)` — estende +7 dias

Atualizar `release_expired_locks()` para tratar também `marketing_leads`.

Política RLS de UPDATE de `marketing_leads` ganha cláusula permitindo o SDR dono do lock editar o lead.

---

## 3. Nova rota: Minha Carteira de Marketing

`src/routes/app.marketing.wallet.tsx`:
- Lista leads onde `locked_by_sdr_id = auth.uid()` com lock ativo
- Ações: abrir detalhe, **renovar lock**, **devolver ao banco**, **converter em Lead Qualificado (SDR)** via `convert_marketing_lead_to_sdr` (já existe)
- Contador de dias restantes do lock

No **Banco de Leads de Marketing**:
- Esconder leads com lock ativo de outro SDR (gestor vê tudo)
- Botão "Pegar pra mim" em cada linha livre → `claim_marketing_lead`

Server functions novas em `src/lib/marketing-leads.functions.ts`: `claimMarketingLead`, `releaseMarketingLead`, `renewMarketingLeadLock`, `listMyMarketingWallet`.

---

## 4. Remover "Novo lead site/telefone" do SDR

- Apagar `src/routes/_authenticated.app.sdr.novo-lead.tsx`
- Remover link do `AppShell.tsx`
- Cadastro de lead recebido passa a ser feito em **Marketing → Registrar Lead Recebido**

---

## Fora de escopo

- Notificações automáticas pro SDR quando chega lead novo
- Métricas de tempo até o claim
- Mudança das URLs (`/app/marketing/leads` segue igual)

---

## Detalhes técnicos

- Migration única: 4 colunas + 3 funções + update em `release_expired_locks` + 1 política RLS adicional.
- `sdr_leads` não muda.
- `convert_marketing_lead_to_sdr` reaproveitada pelo botão da carteira.
- Lock de 7 dias para manter o mesmo padrão do SDR.
