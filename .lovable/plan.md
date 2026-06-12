# Banco de Leads — Agrupamento por CNPJ como padrão

Alterações apenas em `src/routes/app.sdr.bank.tsx`. Sem migration, sem mudar outros arquivos.

## 1. Remover o toggle "Agrupar por CNPJ"

- Apagar o estado `groupByCnpj`, a leitura/escrita em `localStorage` (`bank_group_cnpj`) e o botão na barra de filtros.
- O `useMemo` do agrupamento passa a depender apenas de `[filteredLeads]`.
- A view única do banco agora é **sempre** agrupada por CNPJ.
- Leads sem CNPJ válido continuam aparecendo na seção "Sem CNPJ" no fim da lista.

## 2. Linha-mãe (grupo) sempre visível

Para cada CNPJ:
- Razão social + CNPJ formatado
- Contador de propostas (`N propostas`)
- Soma de valores
- Temperatura mais alta do grupo (`TEMP_PRIORITY` já existente)
- Badge laranja `⚠ X propostas ativas` quando ≥3 ativas (`ACTIVE_EXCLUDE` já existente)
- Botão de expandir/recolher (`expandedCnpjs` continua igual)

## 3. Ações em grupo (novo)

Na linha-mãe, lado direito, conforme o estado do grupo em relação ao SDR logado:

**a) "Pegar todas as ativas"** — quando o SDR não tem nenhuma das propostas ativas. Usa `bulkPickMut` já existente, respeita `SDR_LOCK_LIMIT` (30), feedback via `sonner`. Desabilitado se SDR no limite.

**b) "Devolver todas"** — quando o SDR tem ≥1 proposta daquele CNPJ travada para si (`locked_by_sdr_id === user.id`) e não encerrada (fora de `ARCHIVED_SDR_STATUSES` + `Fechado`). Chama `unlockLead(id)` em sequência. Toast: `"X devolvidas"` ou `"Devolvidas X de Y (Z erros)"`.

**c) Estado misto** — mostrar ambos: "Pegar restantes" + "Devolver minhas", reaproveitando as mutations com listas de IDs diferentes.

### Confirmação de "Devolver todas"

`src/components/ui/alert-dialog.tsx` **existe** — usar `AlertDialog` para a confirmação (não `confirm()` nativo).

- Estado local `returnConfirmCnpj: string | null` controla qual grupo está em confirmação.
- `<AlertDialog open={!!returnConfirmCnpj}>` com `AlertDialogContent`, título `"Devolver propostas ao banco?"`, descrição mostrando quantas propostas serão devolvidas e o nome do cliente, `AlertDialogCancel` e `AlertDialogAction` que dispara `bulkReturnMut.mutate(...)`.
- Importar de `@/components/ui/alert-dialog`.
- "Pegar todas" continua sem dialog (ação aditiva, baixo risco).

## 4. Linhas filhas (propostas individuais)

- Permanecem iguais, renderizadas via `renderLeadRow` quando o grupo está expandido.
- Botões individuais "Pegar"/"Devolver" continuam funcionando proposta-a-proposta.

## Notas técnicas

- Sem mudança de schema, sem nova migration, sem novo hook.
- Reuso: `lockLead`, `unlockLead`, `SDR_LOCK_LIMIT`, `ARCHIVED_SDR_STATUSES`, `TEMP_PRIORITY`, `normalizeCnpj`, `bulkPickMut`.
- Nova mutation `bulkReturnMut` espelhando `bulkPickMut`: `for...of` + `await unlockLead(id)` + contador local.
- `onSettled`: invalidar `['my-wallet']`, `['my-lock-count']`, e a query do banco.
- Estado inicial: nenhum CNPJ expandido. Sem persistência em `localStorage`.

## Fora de escopo

- Mudanças em outras telas.
- Filtro/ordenação por número de propostas no grupo.
- Auditoria automática por IA do grupo.
