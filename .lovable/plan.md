

# Nomus como fonte da proposta — camada de gestão e envio

## Mudança de paradigma

A proposta deixa de nascer no CN COLD. Ela **nasce no Nomus** e o sistema atua como camada de **gestão, geração de arquivo, envio, follow-up, versionamento e analytics**. A integração passa a ser **predominantemente pull** (Nomus → CN COLD), com push apenas de eventos/follow-ups e atualizações de status.

```text
NOMUS (fonte de verdade)         CN COLD (gestão e envio)
──────────────────────           ─────────────────────────
Proposta criada      ─────────►  nomus_proposals (espelho cru)
Cliente / Vendedor                       │
Itens / Preços                           ▼
Pedido de venda      ─────────►  proposals (camada de gestão)
NF-e                 ─────────►        │
Conta a receber      ─────────►        ├─► proposal_send_versions (PDF gerado)
                                       ├─► proposal_send_events  (envio, abertura)
                                       ├─► proposal_timeline_events (interno)
                                       └─► nomus_pedidos / nomus_invoices (vínculo)

CN COLD ─────► NOMUS:
  - follow-ups (eventos da proposta)
  - mudança de status comercial
  - vínculo "envio realizado em DD/MM"
```

## Modelo de dados (novas tabelas e ajustes)

**Espelho ERP (read-only, populadas por sync):**
- `nomus_proposals` — espelho cru das propostas do ERP (`nomus_id`, `numero`, `cliente_nomus_id`, `vendedor_nomus_id`, `valor_total`, `status_nomus`, `validade`, `raw jsonb`, `synced_at`)
- `nomus_proposal_items` — itens da proposta no ERP (produto, qtde, preço unit., desconto, raw)
- `nomus_sellers` — vendedores
- `nomus_representatives` — representantes
- `nomus_pedidos` — pedidos de venda (vinculados a `nomus_id` da proposta quando existir)
- `nomus_pedido_items`
- `nomus_invoices` — NF-e (número, série, chave, valor, data emissão, status, vínculo a pedido)
- `nomus_receivables` — contas a receber (fase 2; criar tabela mas sem sync ainda)

**Camada de gestão CN COLD (já existe `proposals`, ajustar):**
- `proposals.source` enum novo: `nomus` | `manual` (default `nomus`)
- `proposals.nomus_proposal_id` FK lógica para `nomus_proposals.id`
- `proposals.nomus_pedido_id` (já existe) passa a referenciar `nomus_pedidos.id`
- `proposals.nomus_invoice_ids` (array) — NFs vinculadas

**Envio e versionamento:**
- `proposal_send_versions` — cada versão de arquivo gerada
  - `proposal_id`, `version_number`, `pdf_storage_path`, `template_snapshot jsonb`, `generated_by`, `generated_at`, `is_current`
- `proposal_send_events` — cada envio realizado
  - `proposal_id`, `version_id`, `channel` (email | whatsapp | manual), `recipient`, `subject`, `sent_at`, `sent_by`, `delivery_status`, `opened_at`, `metadata`

**Settings novos:**
- `nomus_settings` ganha: `sync_proposals_pull_interval_minutes`, `sync_pedidos`, `sync_invoices`, `sync_representatives`

**Storage:**
- Bucket `proposal-files` (privado) para armazenar PDFs gerados, com RLS por proposta.

## Server functions (novas)

Em `src/integrations/nomus/server.functions.ts`:
- `nomusSyncSellers` — pull de vendedores
- `nomusSyncRepresentatives` — pull de representantes
- `nomusSyncProposalsFull` — pull de propostas + itens; cria registro em `nomus_proposals` e, se ainda não existir, cria espelho em `proposals` com `source='nomus'`, vinculando cliente/vendedor por `nomus_id`
- `nomusSyncPedidos` — pull de pedidos; quando `idProposta` bate com proposta local, atualiza `proposals.nomus_pedido_id` e seta status `ganha` automaticamente (configurável)
- `nomusSyncInvoices` — pull de NF-e; vincula a pedido e a proposta
- `nomusGetProposalRefresh(proposalId)` — força refresh de uma proposta específica (puxa última versão do ERP e atualiza espelho + valor/itens)

Substituir/depreciar `nomusPushProposal` (a proposta não nasce aqui). Push passa a ser:
- `nomusPushProposalStatus(proposalId, status)` — atualiza apenas status comercial no Nomus
- `nomusPushFollowup` (já existe, mantém)
- `nomusPushSendEvent(proposalId, versionId, channel)` — registra no Nomus que a proposta foi enviada (data + canal)

## Geração e envio do arquivo

- `generateProposalFile(proposalId)` server function — busca proposta + itens (espelho Nomus), aplica template, gera PDF, sobe no bucket `proposal-files`, cria registro em `proposal_send_versions` com `is_current=true` (e desmarca anterior).
- `sendProposalFile(proposalId, { channel, recipient, subject, message })` — registra evento em `proposal_send_events`, dispara push para Nomus, marca `proposals.sent_at` e cria evento na timeline. Versão 1 só registra envio manual + email; canais reais (SMTP, WhatsApp) ficam para iteração futura, com hook pronto.

## UI

**`/app/propostas` (lista) — atualizada:**
- Coluna "Origem" (badge Nomus / Manual).
- Coluna "Pedido" (mostra `nomus_pedido_id` se existir).
- Filtro "só não sincronizadas / só com pedido / com NF".
- Botão "Sincronizar do Nomus" no header (chama `nomusSyncProposalsFull`).

**`/app/propostas/$id` — reorganizada em abas:**
- **Resumo** — dados vindos do espelho Nomus (somente leitura para campos do ERP) + campos de gestão CN COLD editáveis (temperatura, win_probability, observações, próximo follow-up).
- **Itens** — lê de `nomus_proposal_items` (read-only, com botão "Atualizar do Nomus").
- **Envio** — lista de `proposal_send_versions` com botão "Gerar nova versão do arquivo"; cada versão tem download do PDF e botão "Enviar"; histórico de `proposal_send_events`.
- **Timeline** — eventos internos + follow-ups (já existe, com toggle "enviar para Nomus").
- **Pedido & NF** — card mostrando pedido vinculado (número, valor, data) e NFs (chave, série, valor, status financeiro). Botão "Atualizar do Nomus".
- **IA** (mantém).

**`/app/configuracoes/nomus` — atualizada:**
- Cards novos: Vendedores, Representantes, Propostas, Pedidos, NF-e.
- Toggle "Auto-criar proposta local quando vier do Nomus" (default on).
- Toggle "Marcar proposta como ganha quando pedido for criado no Nomus" (default on).

**Navegação:** sub-item "Pedidos & NF" em Propostas (lista cross-cutting de pedidos e NFs do ERP).

## Triggers automáticos e cron

- Cron a cada **15 min**: `nomusSyncProposalsFull` (incremental por `dataAlteracao`)
- Cron a cada **30 min**: `nomusSyncPedidos` + `nomusSyncInvoices`
- Cron diário: `nomusSyncSellers`, `nomusSyncRepresentatives`, `nomusSyncProducts`
- Trigger de banco: ao inserir em `nomus_pedidos` com `proposal_nomus_id`, atualiza `proposals.nomus_pedido_id` e dispara mudança de status.

## Detalhes técnicos

- **Endpoints Nomus a confirmar no primeiro pull real:** `/propostas`, `/propostas/{id}/itens`, `/pedidos-venda`, `/notas-fiscais`, `/vendedores`, `/representantes`. Mapeamento de campos será refinado após primeira resposta JSON (estrutura abaixo é hipótese baseada em padrão Nomus).
- **Conflitos:** dados do ERP sempre vencem em campos de origem (cliente, itens, valor); campos de gestão (temperatura, observações comerciais, follow-up) são exclusivos do CN COLD.
- **Idempotência:** todos os upserts usam `nomus_id` como `onConflict`. Sync incremental usa `dataAlteracao>{last_synced_at}` quando suportado pelo endpoint.
- **PDF:** geração inicial com `@react-pdf/renderer` (pure JS, compatível com Worker). Template baseado em layout CN Cold com header, dados do cliente, tabela de itens, condições, validade.
- **Storage RLS:** `proposal-files` acessível só por usuários com permissão na proposta (mesma regra de `proposals_select`).
- **Logs:** todo sync e todo envio entram em `nomus_sync_log` / `proposal_send_events` para auditoria.

## Ordem de implementação

1. **Schema**: nova migration com `nomus_proposals`, `nomus_proposal_items`, `nomus_sellers`, `nomus_representatives`, `nomus_pedidos`, `nomus_pedido_items`, `nomus_invoices`, `nomus_receivables`, `proposal_send_versions`, `proposal_send_events`, ajustes em `proposals` (source, nomus_proposal_id), bucket de storage e RLS.
2. **Server functions de pull**: `nomusSyncSellers`, `nomusSyncRepresentatives`, `nomusSyncProposalsFull`, `nomusSyncPedidos`, `nomusSyncInvoices`, `nomusGetProposalRefresh`.
3. **UI configurações Nomus**: cards das novas entidades + toggles.
4. **UI proposta**: refator das abas (Resumo / Itens / Envio / Timeline / Pedido & NF / IA), badges de origem.
5. **Geração de arquivo**: `generateProposalFile` + tela de Envio + bucket.
6. **Push de eventos**: depreciar `nomusPushProposal`, criar `nomusPushSendEvent` e `nomusPushProposalStatus`.
7. **Cron jobs**: rotas em `src/routes/hooks/` + agendamento via `pg_cron`.

## Fora desta entrega

- Envio real por email/WhatsApp (estrutura fica pronta, integração de canal vem depois).
- Conta a receber: tabela criada, sync fica para fase 2.
- Reconciliação manual de conflitos (versão 1 = ERP vence em campos de origem).
- Edição de itens da proposta dentro do CN COLD (itens são read-only e vêm do Nomus).

## O que preciso de você antes de começar

Confirmar uma decisão e responder duas perguntas — vou perguntar agora via tool de questions na próxima ação.

