# Cobertura de Carteira

Sistema para medir cobertura ativa da carteira de leads (SDR), com visão geral, por SDR, leads descobertos e histórico diário.

## Ajustes em relação ao prompt original

Antes de executar, três adaptações ao código real do projeto:

1. **Tabela base**: o projeto usa `public.sdr_leads` (não `crm_pipeline`). As views serão criadas em cima de `sdr_leads`. O índice antigo ainda se chama `crm_pipeline_*`, mas a tabela é `sdr_leads`.
2. **Coluna `proposal_number`** não existe — usar `lead_code` no lugar (na aba "Leads descobertos").
3. **Arquivo `src/modules/crm/services.ts`** não existe (só `services-agenda.ts`). Vou criar `src/modules/crm/services-cobertura.ts` dedicado, em vez de mexer num arquivo inexistente. Mantém o escopo isolado e respeita "não modificar arquivos existentes além de AppShell.tsx e WarRoomPanel.tsx".

Resto segue o prompt.

## 1. Migration SQL (uma só, via supabase--migration)

- View `public.crm_cobertura_carteira` (geral) — sobre `sdr_leads`
- View `public.crm_cobertura_por_sdr` — sobre `sdr_leads`
- Tabela `public.crm_cobertura_historico` + GRANTs (`authenticated`, `service_role`) + RLS + policy `FOR ALL TO authenticated USING (true)`
- Função `public.salvar_snapshot_cobertura()` com `SET search_path = public` e `SECURITY DEFINER`
- GRANT SELECT nas duas views para `authenticated`

Filtro de exclusão mantido: `sdr_status NOT IN ('Kill / Arquivar','Fechado','Perdido (com motivo)')`.

## 2. Serviços — `src/modules/crm/services-cobertura.ts` (novo)

Funções: `fetchCoberturaGeral`, `fetchCoberturaPorSdr`, `fetchCoberturaHistorico(dias)`, `fetchLeadsDescobertos(limit)`, `salvarSnapshotCobertura`.

`fetchLeadsDescobertos` consulta `sdr_leads` direto, projetando `lead_code` (renomeado como `proposal_number` no select para a UI), `client_name`, `state`, `value`, `temperature`, `priority`, `last_contact_at`, `locked_by_sdr_name`, `sdr_status`.

## 3. Hook — `src/modules/crm/hooks/use-cobertura.ts` (novo)

`useCoberturaGeral`, `useCoberturaPorSdr`, `useCoberturaHistorico`, `useLeadsDescobertos`, `useSalvarSnapshot` + helper `corCobertura(pct)`. Polling de 60s para geral/sdr, 5min para histórico.

## 4. Página principal — `src/modules/crm/components/CoberturaCarteira.tsx` (novo)

4 abas via `Tabs` shadcn:

- **Resumo**: número gigante central com cor dinâmica, barra segmentada 4 cores, 4 cards (fria, sem SDR, nunca contatadas, alta prioridade descoberta), card "Valor em risco", card "Alertas automáticos" com regras descritas no prompt.
- **Por SDR**: card por SDR com avatar (inicial), nome, total, valor, % grande, badge de meta, barra de progresso, linha de métricas.
- **Leads descobertos**: lista dos top 50 por valor, com dias sem contato (vermelho >30d), "Nunca contatado", badge de prioridade.
- **Histórico**: barras horizontais 14 dias, ou empty state.

Botão "Salvar snapshot de hoje" visível só para gestores (via `useProfile` + `is_team_manager`/`has_any_role`). Auto-save no primeiro acesso do dia controlado por `localStorage` (chave `cobertura_snapshot_<YYYY-MM-DD>`).

Tokens semânticos (`text-success`, `bg-warning/10` etc.) ao invés das cores hardcoded do prompt, para respeitar o design system.

## 5. Mini card — `src/modules/crm/components/CoberturaCarteiraMini.tsx` (novo)

Card compacto: título + % grande, barra segmentada h-2, grid 2x2 (sem SDR / nunca contatados / valor descoberto / alta prior. desc), alerta vermelho se pct_ativa < 50%.

## 6. Rota — `src/routes/app.cobertura.tsx` (novo)

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { CoberturaCarteira } from '@/modules/crm/components/CoberturaCarteira'

export const Route = createFileRoute('/app/cobertura')({
  component: CoberturaCarteira,
})
```

(O prompt original tinha JSX vazio dentro do componente — simplifico para renderizar direto.)

## 7. Sidebar e War Room

- **`src/components/AppShell.tsx`**: adicionar entrada `{ to: '/app/cobertura', label: 'Cobertura de Carteira', icon: PieChart }` no grupo OPERAÇÃO.
- **`src/modules/sdr/components/WarRoomPanel.tsx`**: importar e renderizar `<CoberturaCarteiraMini />` após os KPIs existentes.

## Validação

- Confirmar typecheck limpo nos arquivos novos/editados.
- Verificar no preview: rota `/app/cobertura` carrega, abas trocam, mini aparece em `/app/sdr/war-room`.

## Fora de escopo

- Não criar cron de snapshot automático (auto-save client-side cobre, conforme prompt).
- Não tocar em `app.sdr.wallet.tsx` ou outros arquivos além dos listados.
