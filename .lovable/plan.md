## Problema

Hoje existem três arquivos para o detalhe da proposta em `src/routes/`:

- `app.propostas.$id.tsx` (272 linhas) — versão **antiga e simplificada** (só Resumo + Timeline básica). Registra a rota `/app/propostas/$id` com `component: ProposalDetail`.
- `app.propostas.$id.index.tsx` (615 linhas) — versão **completa**: aba Nomus (`NomusProposalDetail`) com itens/equipamentos ofertados, anexos, envio de arquivo, timeline unificada, tarefas, agenda, criação de pedido, etc.
- `app.propostas.$id.editor.tsx` (576 linhas) — **editor** da proposta (preencher template, gerar PDF, salvar versão).

Como o `$id.tsx` é um **leaf** que renderiza UI própria em vez de servir como layout com `<Outlet />`, o TanStack Router monta sempre a versão antiga e nunca chega aos arquivos `$id.index.tsx` e `$id.editor.tsx`. Resultado: ao clicar no número da proposta, abre só o resumo simplificado — perderam-se os equipamentos ofertados, anexos, abrir/editar arquivo da proposta, etc.

## Solução

Converter `src/routes/app.propostas.$id.tsx` em uma **rota de layout pass-through** que apenas renderiza `<Outlet />`. Assim:

- `/app/propostas/$id` passa a renderizar o conteúdo de `app.propostas.$id.index.tsx` (detalhe completo com aba Nomus, equipamentos, anexos, timeline unificada, tarefas, agenda, envio de arquivo, criação de pedido).
- `/app/propostas/$id/editor` passa a renderizar `app.propostas.$id.editor.tsx` (editor da proposta e geração de PDF).

Nenhuma lógica de negócio muda — só o roteamento volta a funcionar como antes da regressão.

## Alterações

### `src/routes/app.propostas.$id.tsx`
Substituir todo o conteúdo por um layout mínimo:

```tsx
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/propostas/$id")({
  component: () => <Outlet />,
});
```

Toda a UI antiga (componente `ProposalDetail`, `Item`, queries de timeline/status, IA, etc.) é removida — ela já existe, em versão mais completa, dentro de `$id.index.tsx`.

## Verificação após implementar

1. Abrir `/app/propostas` → clicar em uma proposta → deve abrir a tela cheia com as abas (Nomus, Itens, Anexos, Timeline, Tarefas, Agenda) e botões "Abrir editor", "Enviar arquivo", "Baixar PDF".
2. Clicar em "Abrir editor" → deve carregar `/app/propostas/$id/editor` com o editor de template.
3. Não deve haver erro de "rota duplicada" no `routeTree.gen.ts` regenerado.
