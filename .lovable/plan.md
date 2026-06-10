## Minha análise

Auditei o fluxo da carteira SDR e confirmei três problemas reais por trás do que você descreveu:

1. **Lista x Kanban desigual.** Hoje o Kanban (`WalletKanban`) tem busca, filtros (temperatura, "esperando minha ação", parados), painel "Foco de hoje", sinais de SLA, badges de proposta Nomus, drag-and-drop entre etapas, e ações de Editar / Transferir SDR / Transferir Vendedor / Agendar Reunião / Encerrar (perdido/kill). A Lista (`LeadCard`) só mostra dados básicos + Ligar/Agenda/Devolver/Detalhes/Transferir SDR. Não reflete coluna (etapa), nem handoff, nem sinais — então quem prefere lista perde informação.

2. **Slot da carteira nunca é liberado.** A função `claim_sdr_lead` calcula a ocupação assim:
   ```
   COUNT(*) WHERE locked_by_sdr_id = eu AND lock_expires_at > now()
   ```
   Quer dizer: lead **transferido para vendedor** (`handoff_status='transferred'`) continua com o `locked_by_sdr_id` do SDR e ainda ocupa vaga. O mesmo vale para `sdr_status` Fechado / Perdido (com motivo) / Kill / Arquivar — o lock só vence em 7 dias. Resultado: a SDR converte ou encerra e mesmo assim não consegue pegar leads novos. Exatamente o sintoma que você relatou.

3. **Limite hoje é 30.** Subir para 45 é trivial (uma constante no SQL), mas só faz sentido depois do item 2; senão o 45 também enche de leads "mortos".

Recomendação: implementar 1+2+3 juntos. O 45 sozinho mascara o bug; o 2 sozinho já dá fôlego mesmo se mantivéssemos 30. Os dois juntos é a correção certa.

---

## Plano

### 1) Liberar slot ao transferir para vendedor e ao encerrar
- Migration alterando `public.claim_sdr_lead`: o `v_my_locks` passa a **excluir** leads onde `handoff_status = 'transferred'` OU `sdr_status IN ('Fechado','Perdido (com motivo)','Kill / Arquivar')`. Esses leads continuam aparecendo no Kanban (coluna "Em Negociação (Vendedor)" / "Encerrados") para histórico, mas não consomem vaga.
- Mesma migration ajusta `public.handoff_lead_to_seller` para, ao transferir, **limpar `lock_expires_at`** (e zerar `locked_by_sdr_name`/`locked_at`) — assim o lead sai oficialmente do "ativo" da SDR, mas mantém `sdr_id` para crédito de conversão.
- Idem em `public.handoff_lead_to_seller`: nada a mudar no crédito; o relatório de performance já lê `handoff_status='transferred'` como conversão SDR.
- Em `CloseLeadDialog` (Perdido/Kill): além de gravar `sdr_status`, chamar `release_sdr_lead` (já existe) ou estender a RPC `close_sdr_lead` para liberar o lock no mesmo movimento. Para "Fechado" o lead provavelmente já foi via handoff, mas garantimos a liberação também.

### 2) Subir o limite de 30 → 45
- Mesma migration: `v_limit int := 45;` em `claim_sdr_lead`.
- Atualizar os textos visíveis: badge "X / 45 leads" no header da carteira, mensagens de erro e `app.sdr.bank.tsx`. Procurar `30` no front (`use-sdr-metrics`, contadores) e trocar onde refletir a capacidade.

### 3) Paridade Lista ↔ Kanban
Refazer a Lista para mostrar tudo que o Kanban mostra, mantendo o formato em linhas:
- Coluna/etapa visível (mesma derivação do Kanban: Não Contatado / Aguardando Retorno / Reunião / Vendedor / Encerrados) com badge.
- Sinais (`computeSignals`): "parado", "urgente", "sua vez", "esperando outro lado", `nextActionLabel`.
- Badge "Proposta Nomus" (já existe — preservar).
- Indicador de handoff (transferido para vendedor X em DD/MM).
- Filtros do Kanban (busca, temperatura, ação) **acima da lista**, compartilhando o mesmo estado de filtros entre as duas visões.
- Painel "Foco de hoje" também na lista.
- Ações no card: Ligar/Script, Agendar Reunião (abre `MeetingScheduleQuickDialog`), Editar (`LeadEditDialog`), Transferir SDR (gestor), **Transferir Vendedor** (`TransferToSellerDialog`), **Encerrar** (`CloseLeadDialog`), Devolver, Detalhes (mantém expansor atual).
- Manter o sub-card de registro de tentativa de ligação que hoje só está na Lista — esse é o ganho real da visão linha e quero preservar.

### 4) Conversão e métricas
- Confirmar que `sdr-performance` lê handoff como "convertido". Se hoje só lê `meeting_booked`, complementar com `handoff_status='transferred'` (reunião agendada **ou** transferência direta para negociação contam como conversão).
- Perdido/Kill já entra como "encerrado/perdido" no card de performance — verificar se está computando ou se ainda fica preso por causa do lock.

### Detalhes técnicos
- Arquivos tocados: `supabase/migrations/<novo>.sql`, `src/routes/app.sdr.wallet.tsx` (Lista renovada, filtros compartilhados, header com 45), `src/components/sdr/WalletKanban.tsx` (extrair filtros + foco para um componente reaproveitável), novo `src/components/sdr/WalletList.tsx` baseado no `LeadCard` atual + ações do Kanban, `src/routes/app.sdr.bank.tsx` (mensagens/contadores 45), `src/modules/sdr/hooks/use-sdr-metrics.ts` se precisar incluir handoff como conversão.
- Sem mudança em RLS, só em funções `SECURITY DEFINER` já existentes.
- Migration roda antes da troca de código pra que a UI nova já encontre o backend correto.

### Riscos / pontos a confirmar
- Ao limpar o lock no handoff, o lead some do `my-wallet` se o filtro for por `locked_by_sdr_id`. Solução: trocar o filtro de "minha carteira" para `sdr_id = me` (assim leads transferidos continuam visíveis na coluna "Vendedor") — preciso ajustar `fetchPipeline`/`useMyWallet`.
- "Fechado" vindo do vendedor pode não passar mais pela SDR. Mantemos como histórico só, sem ocupar slot.
