# Plano: Skills por Módulo

Vou criar **8 skills profundas** em `.agents/skills/`, uma por módulo. Cada uma é ativada automaticamente quando você (ou eu numa sessão futura) trabalhar naquele módulo — assim o agente já entra sabendo as regras, schema, fluxos e bugs comuns sem precisar redescobrir.

## Skills propostas

| # | Skill | Cobre |
|---|---|---|
| 1 | `coldpro-calculation` | Engine térmica, ambientes, produtos, túneis, cargas extras, processos avançados, simulação, memorial PDF, catálogo de equipamentos, seleção, push para proposta |
| 2 | `crm-propostas` | Pipeline CRM, leads, propostas, editor de proposta, tabelas de preço, follow-ups, agenda, fechamento, timeline unificada |
| 3 | `sdr-leads` | Wallet/Bank, hot deals, scripts, tratativas, handoff para vendedor, war room, métricas SDR, edição de leads (incl. fix recente do `update_sdr_lead_fields`) |
| 4 | `nomus-integration` | Endpoints, sync (jobs/locks/checkpoints), enrichment, parser CSV, importação de custos, probes públicos, cron, conciliação |
| 5 | `marketing-inbound` | Leads inbound, kanban, wallet marketing, remarketing queue, eventos, config |
| 6 | `auth-admin-permissions` | `has_role` + `user_roles`, RLS pattern, GRANTs, middleware (`requireSupabaseAuth`/`attachSupabaseAuth`), wizard de usuários, overrides, role_module_access |
| 7 | `atividades-agenda` | `crm_activities`, `crm_agenda`, follow-ups, painel do gestor, lembretes, regras de "atrasada/hoje/próxima" |
| 8 | `project-conventions` | Skill-raiz: stack (TanStack Start + Cloud), padrão `*.functions.ts` vs `*.server.ts`, `ColdProField` UX (select-on-focus, vírgula BR), design tokens, naming, onde NÃO mexer (`integrations/supabase/*` auto-gen) |

## Estrutura de cada skill

```text
.agents/skills/<nome>/
├── SKILL.md                  # frontmatter + visão geral + regras críticas
├── references/
│   ├── architecture.md       # mapa de arquivos, fluxo de dados
│   ├── schema.md             # tabelas, colunas-chave, RLS, GRANTs
│   ├── business-rules.md     # fórmulas, validações, edge cases
│   ├── examples.md           # snippets reais de uso correto
│   └── troubleshooting.md    # bugs conhecidos + correções aplicadas
└── (scripts/ se útil)
```

A `description:` do frontmatter é calibrada para o retrieval disparar a skill na hora certa (ex.: "Use ao mexer em cálculo térmico ColdPro: ambientes, produtos, túneis, cargas, simulação, memorial PDF").

## Fonte do conteúdo

- Código em `src/features/<modulo>/`, `src/modules/<modulo>/`, `src/components/<modulo>/`, rotas relacionadas.
- Schema via `supabase--read_query` nas tabelas listadas no contexto (ex.: 58 colunas de `coldpro_environment_products`).
- Docs do repo: `DEPLOYMENT_COLDPRO.md`, `docs/nomus-endpoints.md`, `.lovable/plan*.md`, `src/lib/coldpro/README.md`.
- Histórico recente do chat para capturar bugs já corrigidos (preview ao vivo de cargas, `freezing_temp_c`/`ashrae_density_kg_m3`, `update_sdr_lead_fields`, select-on-focus do `ColdProField`).

## Processo de execução

1. **Mapeamento (paralelo)** — 1 sub-agente `explore` por módulo lê arquivos + rotas + tabelas e devolve um sumário estruturado. Isso evita estourar contexto.
2. **Dúvidas pontuais** — antes de fechar cada skill, te pergunto só o que for ambíguo (ex.: "qual módulo é fonte da verdade para `clients`?"). Sem perguntas óbvias.
3. **Escrita em lote** — escrevo as 8 skills em paralelo (`code--write` múltiplos arquivos).
4. **Ativação** — chamo `skills--apply_draft` para cada uma, deixando todas ativas.
5. **Índice de memória** — atualizo `mem://index.md` listando as skills e quando cada uma dispara, para você ter visão geral.

## Pontos que vou checar com você durante a execução

- **Sobreposição CRM ↔ SDR ↔ Marketing**: as três mexem com leads. Vou propor uma fronteira clara (ex.: SDR = pré-venda/wallet, CRM = pós-handoff/propostas, Marketing = inbound/remarketing) e te confirmar.
- **ColdPro**: se quer uma skill única grande ou quebrar em `coldpro-core` + `coldpro-simulation` + `coldpro-catalog`. Default: única, com `references/` separados.
- **Nomus**: confirmar se a sync é considerada "intocável" (campos protegidos) — afeta o tom da skill.

## Entrega

Tudo de uma vez, conforme você pediu. Estimativa: 8 skills × ~5 arquivos = ~40 arquivos. Após `apply_draft` todas ficam ativas e disparam por contexto automaticamente — você também pode invocar manualmente digitando `/` no compositor.

Aprova esse plano?
