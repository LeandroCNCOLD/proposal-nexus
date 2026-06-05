## Objetivo

Sinalizar visualmente, nas listas já existentes, quando uma proposta do Nomus tem um lead SDR correspondente — e vice-versa — usando como chave **CNPJ** (principal) e, como fallback, **título da proposta vs `lead_code` / `proposal_title` do lead**.

## Regra de cruzamento (uma única fonte de verdade)

Criar uma função SQL `public.match_proposal_lead(proposal_id uuid)` e uma view de apoio:

```text
proposta ↔ lead casam quando:
  1. CNPJ normalizado (só dígitos) da proposta == CNPJ normalizado do lead   (match forte)
  OU
  2. CNPJ ausente em um dos lados E (
        upper(trim(proposta.title)) == upper(trim(lead.proposal_title))
        OU upper(trim(proposta.title)) == upper(trim(lead.lead_code))
        OU proposta.nomus_id::text == lead.lead_code
     )                                                                        (match fraco)
```

Entregar via **view** `public.v_proposal_lead_matches` com colunas:
`proposal_id, lead_id, match_type ('cnpj' | 'titulo'), cnpj_digits, proposal_title, lead_code, client_name`.

Acesso: `GRANT SELECT ... TO authenticated`. Sem dados sensíveis novos — só ids e títulos que o usuário já vê.

## UI — badges nas listas existentes

1. **Lista de Propostas** (`src/routes/app.propostas.index.tsx`)
   - Nova coluna/badge "Lead SDR" exibida quando a proposta aparece em `v_proposal_lead_matches`.
   - Badge `secondary` com tooltip "Casado por CNPJ" ou "Casado por título" conforme `match_type`.
   - Clique no badge → navega para `/app/sdr/bank?leadId={lead_id}` (já é a rota usada para abrir o lead).

2. **Listas SDR** (`bank`, `wallet`, `hot-deals` — todas consomem `src/modules/sdr/services.ts`)
   - Badge "Proposta Nomus" no card/linha do lead quando houver match.
   - Tooltip mostra `nomus_id` da proposta; clique abre `/app/propostas/{proposal_id}`.

3. Carregamento eficiente: uma única query no carregamento da lista busca `select proposal_id, lead_id, match_type from v_proposal_lead_matches where proposal_id in (...)` (ou `lead_id in (...)`) e monta um `Map` para lookup O(1) na renderização. Sem N+1.

## Filtros (escopo mínimo, não-bloqueante)

- Propostas: toggle "Somente com lead SDR".
- SDR (bank/wallet): toggle "Somente com proposta Nomus".

## Arquivos previstos

- **Migration:** cria `v_proposal_lead_matches` + grants.
- **Hook:** `src/hooks/use-proposal-lead-matches.ts` — recebe `proposalIds?` ou `leadIds?` e retorna o `Map`.
- **Edita:** `src/routes/app.propostas.index.tsx` (badge + filtro).
- **Edita:** `src/modules/sdr/components/*` (linha/cartão do lead — identificar o componente compartilhado das três rotas SDR e adicionar o badge ali).

## Fora de escopo

- Não cria nova página de relatório.
- Não altera a regra de negócio de "ganhar/perder" proposta.
- Não mexe em sync com Nomus.

## Resultado esperado (sanidade)

Com base no banco atual: ~45 propostas Nomus passam a mostrar o badge "Lead SDR" e ~89 leads passam a mostrar "Proposta Nomus" (números podem subir com o fallback por título).
