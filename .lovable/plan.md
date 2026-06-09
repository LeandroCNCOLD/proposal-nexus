## Objetivo

Tornar o Kanban um instrumento de **comunicação**, não só de movimentação. Hoje as 5 colunas dizem onde o lead está, mas não respondem rápido a: "o que devo fazer agora?", "o vendedor já assumiu?", "este lead está parado?", "como combinamos a próxima conversa?".

## 1. Refinar as colunas

Atuais: Não Contatado · Contatado–Aguardando Retorno · Reunião Agendada · Em Negociação (Vendedor) · Encerrados.

Proposta:

```text
Não Contatado → Tentativas (1ª, 2ª, 3ª) → Aguardando Retorno → Reunião Agendada
   → Reunião Realizada → Transferido p/ Vendedor → Em Negociação → Ganho / Perdido
```

- **Tentativas**: separa "nunca liguei" de "liguei e não atendeu N vezes". Muda a cor da call-to-action e dispara alerta de "esfriando" no 3º não-atende.
- **Reunião Realizada**: estado intermediário antes da transferência — força o SDR a registrar o resultado.
- **Transferido p/ Vendedor**: handoff explícito. SDR vê em "somente leitura"; vendedor recebe o card no funil dele.
- **Ganho / Perdido** substitui "Encerrados" para alimentar métricas e motivos de perda.

## 2. Card mais comunicativo

Adicionar no card, além do que já existe:

- **Selo de temperatura visual** com borda colorida (Frio cinza, Morno âmbar, Quente vermelho) — leitura periférica.
- **"Próxima ação"** em destaque: ex. *"Ligar até 14h — 2ª tentativa"*, *"Reunião 16/12 09h"*.
- **Tempo na coluna** ("3d parado") com cor crescendo conforme SLA estourado.
- **Último contato** (data + canal: ☎️📧💬) — saber quando foi a última troca real.
- **Dono atual** (avatar SDR / vendedor) — quem está com a bola.
- **Indicador de mensagem não lida** quando o vendedor ou SDR comentou e o outro lado não viu.

## 3. Ações rápidas no card (sem abrir o lead)

Botões em hover/menu:

- **Ligar agora** (já existe) + **registrar resultado em 1 clique**: atendeu / não atendeu / caixa postal / agendar callback.
- **Agendar reunião** (mini-form: data, hora, vendedor convidado).
- **Transferir para vendedor** (dropdown com os vendedores; gera handoff oficial + notifica).
- **Comentar** (mini-chat ancorado no lead, visível para SDR e vendedor).
- **Snooze**: tirar do topo até X data (não some, só re-prioriza).

## 4. Handoff SDR → Vendedor

Hoje a transição "vira do vendedor" não é explícita. Plano:

- Ao mover para *Reunião Agendada* ou *Em Negociação*, abrir um diálogo de **handoff**: vendedor responsável, resumo do lead, anexos relevantes, próxima ação.
- O lead aparece no Kanban do vendedor em uma coluna **"Recebidos do SDR"** com badge "novo".
- O SDR continua vendo, mas o card fica em **modo monitoramento** (somente leitura + comentários). Hoje já existe a flag "somente leitura sugerida" — virar definitiva nesta etapa.
- Linha do tempo do lead registra quem transferiu, quando e por quê.

## 5. Comunicação contínua no lead

- **Thread de comentários** por lead, com @menção (SDR pode chamar o vendedor e vice-versa).
- **Atualizações automáticas** do sistema entram na mesma thread ("Reunião reagendada para 18/12", "Proposta enviada", "Nota fiscal emitida") — uma única linha do tempo.
- **Notificações** no sino quando: SDR é mencionado, vendedor comenta no lead transferido, reunião confirmada/recusada, SLA estourando.

## 6. Sinais de saúde

Cabeçalho de cada coluna ganha um chip de saúde:

- *X parados há +SLA dias* (vermelho)
- *Y reuniões a confirmar hoje*
- *Z aguardando retorno do vendedor*

E uma faixa no topo do Kanban com "**foco de hoje**": cards que precisam de ação nas próximas 4h (ordenados por urgência × valor).

## 7. Filtros e visões

- Filtro por **dono** (SDR / vendedor / qualquer).
- Filtro **"esperando minha ação"** vs **"esperando ação do outro"** — resolve "estou esperando o vendedor responder".
- Filtro por **canal** do último contato (ligação não atende vs WhatsApp respondido).
- Visão **timeline** alternativa (gantt simples) para ver compromissos da semana.

## Detalhes técnicos

Para o agente implementar (não precisa entrar no plano que o usuário lê, mas fica registrado):

- Estágios novos no enum `sdr_lead_stage` em `src/modules/sdr/types.ts` + migração: adicionar `Reunião Realizada`, `Transferido p/ Vendedor`, `Ganho`, `Perdido` (manter compat com `Encerrados`).
- Tabela `sdr_lead_handoffs` (lead_id, sdr_id, vendedor_id, motivo, resumo, criado_em).
- Tabela `sdr_lead_comments` (lead_id, autor_id, body, mentions[], lido_por[]) para a thread.
- Card: novo componente `LeadCardActions` com hover-menu; computar `tempoNaColuna`, `nextActionLabel`, `lastContactChannel` no serviço.
- Sino: novo tipo de notificação `lead_comment_mention` e `handoff_received`.
- Coluna de saúde calculada via aggregate por SDR/coluna no `services.ts`.

## Faseamento sugerido

1. Card mais rico (temperatura visual, tempo na coluna, próxima ação, dono).
2. Handoff explícito + coluna "Transferido p/ Vendedor" + visão de monitoramento.
3. Comentários + notificações + filtros "esperando minha ação".
4. Sinais de saúde nas colunas e faixa de "foco de hoje".

Posso começar pela fase 1, ou você prefere priorizar o handoff (fase 2) primeiro?
