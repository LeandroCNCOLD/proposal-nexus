# Enriquecer CRM com layout estilo Nomus + ficha completa do card

## Análise da referência Nomus (screenshot)

A tela de funil do Nomus carrega muito mais informação por card do que temos hoje. Vamos replicar esse padrão e ir além onde fizer sentido.

**Cabeçalho de cada coluna no Nomus:**
- Nome da etapa
- `N processos · R$ X.XXX.XXX,XX` (contagem + soma do valor das propostas vinculadas)

**Cada card mostra:**
- Nome do processo + menu kebab + ícone de anexo (se houver)
- `ID Nomus · Responsável`
- `Decisor: Sim/Não/Parcial`
- `Projeto: <descrição curta do estado>`
- `Interesse: Frio/Morno/Quente/Muito quente`
- `Probabilidade: X% – <texto>`
- `Segmento:` (do cliente, quando houver)
- `Nº proposta: CN-XXXX`
- Cliente (rodapé)
- **Valor da proposta** em destaque
- Badge de **prazo** (vermelho se vencido, verde se em dia) + **tempo na etapa**

**Filtros no topo:** Tipo, Equipe, Responsável, Pessoa, Processo, Proposta, Datas, Ordenar.

## Descoberta técnica importante

O Nomus **não entrega** vínculo direto entre processo e proposta no payload (`/processos` só tem `pessoa` = nome do cliente; `/propostas` só tem `cliente_nome`). A única ponte é o **nome do cliente** com normalização. Vamos:
1. Fazer match automático por nome (case-insensitive, trim) entre `nomus_processes.pessoa` ↔ `nomus_proposals.cliente_nome`.
2. Permitir override manual em `crm_process_proposals` quando o usuário fixa "esta proposta é deste processo".

## O que muda no Kanban (`/app/crm`)

### Cabeçalho de coluna enriquecido
```text
┌─ FRIO ─────────────────────────────┐
│ 11 processos · R$ 2.399.225,19    │
│ 5 propostas · ticket médio R$ 480k │
└────────────────────────────────────┘
```

### Card enriquecido (igual padrão Nomus + extras)
```text
┌──────────────────────────────────────┐
│ AFONSO FRANCA CONSTRUCOES… ⋮ 📎   │
│ #373 · RAFAEL HENRIQUE              │
│ Decisor: Não                         │
│ Projeto: Estudo inicial              │
│ Interesse: Morno                     │
│ Probabilidade: 10% – Proposta enviada│
│ Segmento: —                          │
│ Nº proposta: CN-2026-373             │
│ ────────────────────────────────────│
│ AFONSO FRANCA…                       │
│ R$ 600.000,00              ⏱ 1 dia │
│ 🟥 22/04/26 (vencida)                │
└──────────────────────────────────────┘
```

Cores e badges seguem tokens do design system (`destructive`, `default`, `secondary`).

### Barra de filtros no topo (estilo Nomus)
- Tipo de processo (já existe via abas — manter)
- Responsável (select)
- Equipe (select)
- Pessoa (text search)
- Processo (text search por nome ou nomus_id)
- Proposta (text search por nº/CN)
- Período (`data_criacao` between)
- Ordenar (mais recente, mais antigo, maior valor, próximo de vencer)

Estado dos filtros vai pra URL via `validateSearch` (TanStack Router) — assim a visão fica compartilhável.

### Indicadores visuais derivados

Como o Nomus não entrega "decisor" / "projeto-estado" / "interesse" / "probabilidade" como campos estruturados, vamos:
- **Extrair do HTML de `descricao`** quando possível (parse simples — esses campos costumam estar como `Decisor: X` na descrição livre).
- Quando não der, esconder a linha (não mostrar "—" todo).
- Adicionar **campos locais editáveis** em `crm_process_meta` (probabilidade, interesse, decisor) que sobrescrevem o parse e ficam visíveis tanto no card quanto na ficha.

Cálculos próprios:
- **Tempo na etapa**: `now() - última mudança de etapa local` (registramos quando muda).
- **Vencido**: `proximo_contato < hoje` ou `proposta.validade < hoje`.
- **Idade do processo**: `now() - data_criacao`.

## Ficha do card — `/app/crm/$id` com 6 abas

```text
┌─ Header ─────────────────────────────────────────────────┐
│ AFONSO FRANCA · etapa atual: Orçamento (badge)         │
│ R$ 600.000,00 · 1 proposta · idade 1 dia · ⚠ vencida    │
└──────────────────────────────────────────────────────────┘

[Visão geral] [Propostas] [Follow-up] [Atividade] [Anexos] [Nomus]
```

1. **Visão geral** — todos os campos do card em modo expandido, KPIs (idade, dias parado nesta etapa, dias até próximo contato), quick-edit de probabilidade/interesse/decisor.
2. **Propostas** — tabela das propostas Nomus do mesmo cliente + propostas internas (`proposals`) + botão "vincular manualmente" e "criar nova proposta a partir deste processo" (leva pra `/app/propostas/nova` pré-preenchendo cliente).
3. **Follow-up** — próximo contato editável, histórico (`crm_followups`), botões "marcar feito", "agendar próximo" com data + observação curta.
4. **Atividade** — timeline local: notas (`crm_notes`), mudanças de etapa, follow-ups concluídos, criação/edição de propostas vinculadas. Caixa pra adicionar nota.
5. **Anexos** — `arquivosAnexos` que já vêm no payload Nomus + upload local em `crm_attachments` (bucket reaproveitado).
6. **Nomus** — descrição HTML atual + JSON cru (debug) + botão "Editar descrição" com PUT no Nomus.

## Sugestões adicionais com base no que o Nomus expõe

- **Visão de gerência no topo de `/app/crm`**: cards com totais por etapa, valor total no funil, conversão por vendedor, top 5 processos parados há mais tempo.
- **Alerta de proposta vencida em processo aberto**: ícone vermelho no card.
- **Sinal de "esfriando"**: card amarelo se sem follow-up agendado há +7 dias; vermelho se passou da data de próximo contato.
- **Refresh sob demanda**: ao abrir a ficha, dispara pull leve só daquele processo + propostas do cliente (mantém Kanban geral barato).
- **Comparativo histórico**: pequeno gráfico "valor total no funil por mês" usando `data_criacao`.
- **Quick-action no kebab do card**: Mover etapa, Adicionar follow-up, Adicionar nota, Vincular proposta, Abrir no Nomus.

## Detalhes técnicos

**Banco (1 migration):**
- `crm_process_meta` — `process_id PK, decisor, interesse, probabilidade_pct, projeto_estado, segmento_override, updated_by, updated_at`
- `crm_process_proposals` — vínculo manual processo↔proposta
- `crm_followups` — `id, process_id, scheduled_for, done_at, note, created_by, created_at`
- `crm_notes` — `id, process_id, body, created_by, created_at`
- `crm_attachments` — `id, process_id, storage_path, name, mime_type, size_bytes, uploaded_by, uploaded_at`
- `crm_stage_changes` — `id, process_id, from_etapa, to_etapa, changed_at, changed_by` (alimenta "tempo na etapa" e atividade)
- RLS: SELECT autenticado; INSERT/UPDATE pelo criador ou roles `gerente_comercial`/`diretoria`/`admin`.

**Server functions novas (`process-enrichment.functions.ts`):**
- `getFunnelData(tipo, filters)` → `{ stages: [{ etapa, count, totalValue, proposalCount, avgTicket, processes: [...] }] }` — uma chamada faz tudo: busca processos filtrados, faz match com propostas, agrega por etapa, devolve cards prontos.
- `getProcessDetail(id)` → processo + meta + propostas (auto + manual) + followups + notes + attachments + stage_changes.
- `addFollowup`, `markFollowupDone`, `addNote`, `linkProposal`, `unlinkProposal`, `updateProcessMeta`, `uploadAttachment`.
- `parseProcessDescription(html)` — utilitário que tenta extrair `Decisor:`, `Interesse:`, `Probabilidade:`, `Projeto:` da descrição HTML (regex resiliente).

**Frontend:**
- `app.crm.tsx`: cabeçalho com filtros (URL search params via `validateSearch`), cabeçalhos de coluna ricos, cards reformulados, kebab menu com quick actions.
- `app.crm.$id.tsx`: reescrito com `<Tabs>` (shadcn), seis painéis em componentes isolados em `src/components/crm/` (`OverviewTab`, `ProposalsTab`, `FollowupTab`, `ActivityTab`, `AttachmentsTab`, `NomusTab`).
- Cores e badges via tokens (`destructive`, `default`, `outline`, `secondary`); valor monetário em verde-escuro como no Nomus.

**Performance:**
- `getFunnelData` cacheado por React Query (`["crm","funnel",tipo,filtersHash]`, staleTime 60s).
- Match cliente↔proposta feito numa única query SQL agregada e cruzada em memória (volume pequeno: 33×100).
- `crm_stage_changes` consultado só na ficha, não no Kanban.

## Fora desta entrega

- Drag-and-drop entre colunas com PUT no Nomus (próxima fase já planejada).
- Sincronização automática agendada (cron).
- Edição inline da descrição Nomus com WYSIWYG (botão funcional, mas com textarea simples; rich editor depois).
