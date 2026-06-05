# Separar CRM SDR de Propostas Nomus

Hoje o CRM SDR usa a tabela `crm_pipeline` e a UI fala "Proposta", o que causa confusão com as propostas formais do Nomus (`nomus_proposals`). Vamos isolar o módulo SDR como um sistema de **gestão de leads de pré-venda**, sem duplicar dados nem quebrar o que existe.

## O que muda

### 1. Banco — renomear tabela
- `crm_pipeline` → `sdr_leads` (mantém todas as colunas, dados, índices e policies)
- Atualizar a função `release_expired_locks()` para apontar para `sdr_leads`
- Migração usa `ALTER TABLE ... RENAME` (não perde dado nenhum)

### 2. Módulo frontend
- `src/modules/crm/` → `src/modules/sdr/`
- Componentes:
  - `PipelineMasterTable` → `LeadsTable`
  - `CallLogDrawer` permanece
  - `WarRoomPanel`, `SdrPerformanceCard` permanecem
- Hooks: `use-crm-pipeline` → `use-sdr-leads`
- Services: todas as queries passam a apontar para `sdr_leads`
- Types: `CrmPipelineRow` → `SdrLead`

### 3. Rotas
- `/app/crm-sdr/*` → `/app/sdr/*`
  - `/app/sdr/bank` — Banco de Leads (era Banco de Propostas)
  - `/app/sdr/wallet` — Minha Carteira
  - `/app/sdr/hot-deals` — Hot Leads
  - `/app/sdr/war-room` — War Room
  - `/app/sdr/sdr-performance` — Performance
  - `/app/sdr/` (index) — Pipeline Master

### 4. Linguagem da UI
Em todo o módulo SDR, trocar:
- "Proposta" → "Lead"
- "Nº Proposta" → "Código / Ref" (campo `proposal_number` vira `lead_code` no DB)
- "Banco de Propostas" → "Banco de Leads"
- "Propostas Ativas" → "Leads Ativos"

Isso deixa claro que **Lead (SDR) ≠ Proposta (Nomus)**.

### 5. Sidebar
Renomear o grupo "CRM / SDR" para **"SDR — Pré-Venda"** com os mesmos itens sob a nova rota.

## O que NÃO muda

- Propostas Nomus (`nomus_proposals`, `proposals`) — intocadas
- Lógica de travamento de leads (lock por SDR, limite de 30, expiração 7 dias)
- Seed script — só ajusta nome da tabela
- Histórico de chamadas, war room, performance — mesma lógica, novo nome

## Detalhes técnicos

```text
Migração SQL (não destrutiva):
  ALTER TABLE public.crm_pipeline RENAME TO sdr_leads;
  ALTER TABLE public.sdr_leads RENAME COLUMN proposal_number TO lead_code;
  -- recriar release_expired_locks() apontando para sdr_leads
  -- renomear policies/índices para refletir novo nome

Frontend:
  - rg + sed para trocar 'crm_pipeline' → 'sdr_leads' em services/hooks
  - rg + sed para trocar 'proposal_number' → 'lead_code'
  - Renomear arquivos de rota app.crm-sdr.* → app.sdr.*
  - Atualizar src/integrations/supabase/types.ts será regenerado automaticamente
  - Atualizar AppShell sidebar
```

## Fora de escopo (perguntar depois se quiser)

- Sincronização automática Nomus → sdr_leads (hoje é seed manual)
- Conversão "Lead virou Proposta" (criar `nomus_proposal` a partir de um `sdr_lead` ganho)
- Renomear `crm_call_logs`, `crm_followups`, `crm_funnel_stages` etc. — mantemos prefixo `crm_` nessas (são genéricas de pré-venda)

## Próximo passo

Quando você aprovar este plano, eu executo em 3 fases:
1. Migração SQL (renomear tabela + coluna + função)
2. Refatoração frontend (módulo, rotas, sidebar, textos)
3. Verificar build e testar no preview
