## Objetivo

Excluir o Pipeline Master (que perdeu utilidade) e consolidar tudo no Banco de Leads, que já é a fonte oficial dos leads.

## Mudanças

1. **Menu (`src/components/AppShell.tsx`)**
   - Remover o item `{ to: "/app/sdr", label: "Pipeline Master" }`.
   - "Banco de Leads" (`/app/sdr/bank`) continua como entrada principal do módulo SDR.

2. **Rota raiz do SDR (`src/routes/app.sdr.index.tsx`)**
   - Substituir a página por um `redirect` para `/app/sdr/bank` no `beforeLoad`, para que qualquer link antigo ou bookmark continue funcionando e caia direto no Banco de Leads.

3. **Arquivos obsoletos**
   - Excluir `src/modules/sdr/components/PipelineMasterTable.tsx`.
   - Excluir `src/modules/sdr/scripts/seed-pipeline.ts` (botão "Popular dados de exemplo" só existia no Pipeline Master).
   - Conferir com `rg` se restou qualquer import órfão e remover.

4. **Banco de dados**
   - Nenhuma migration. O Pipeline Master só lia dados — nenhuma tabela exclusiva dele será removida.

## Fora de escopo

- Não vou adicionar visão Kanban ao Banco de Leads agora (você pulou a pergunta). Se quiser depois, abrimos como melhoria separada.
