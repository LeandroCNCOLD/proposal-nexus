
## Diagnóstico

O problema principal não é a tela de propostas estar “pesada” no momento. O que encontrei é:

1. **O banco está vazio para propostas**
   - `proposals = 0`
   - `nomus_proposals = 0`
   - por isso a tela mostra “Nenhuma proposta encontrada”.

2. **O sync está travado como se estivesse rodando**
   - `nomus_sync_state.propostas.running = true`
   - `total_synced = 0`
   - `last_synced_at = null`
   - então o front fica esperando um processo que, na prática, não concluiu.

3. **O disparo do sync em background está falhando**
   - o botão “Buscar do Nomus” chama `nomusKickoffSyncProposals`
   - esse server function marca `running=true` antes de garantir que o cron realmente começou
   - depois tenta fazer um `fetch` interno para `/hooks/nomus-cron`
   - nos logs existe `kickoff fetch failed TypeError: fetch failed`
   - isso indica que, no preview/dev, ele está tentando disparar o cron por uma origem inválida/instável

4. **A tela de listagem não é a causa do vazio**
   - ela consulta `proposals` e depois busca datas em `nomus_proposals`
   - isso pode ser otimizado para o futuro, mas **agora não há registros para carregar**
   - então o gargalo atual é o **sync não preencher o banco**

## Plano de correção

### 1) Destravar o estado falso de sincronização
Criar uma migration simples para:
- colocar `running=false` em `nomus_sync_state` para `propostas`
- registrar um `last_error` claro explicando que o disparo anterior falhou

Objetivo:
- parar o spinner infinito
- deixar a UI refletir o estado real

### 2) Corrigir o disparo do sync para não depender de `localhost`
Ajustar `src/integrations/nomus/server.functions.ts` em `nomusKickoffSyncProposals` para:

- **não usar automaticamente `new URL(req.url).origin` quando a origem for `localhost` / `127.0.0.1`**
- preferir uma URL estável do projeto para preview/publicação
- só marcar `running=true` **depois** que o cron for aceito com sucesso, ou então:
  - se o disparo falhar, gravar erro no estado
  - manter `running=false`

Objetivo:
- evitar o caso “botão gira, mas nenhum job de fato começou”

### 3) Fortalecer o endpoint `/hooks/nomus-cron`
Ajustar `src/routes/hooks/nomus-cron.ts` para:

- validar corretamente o token do cron, não só o prefixo `Bearer `
- sempre usar `try/finally` para limpar `running`
- gravar `last_error` legível quando o job não inicia ou falha cedo
- preservar `last_cursor` e `total_synced` corretamente

Objetivo:
- impedir novo travamento silencioso
- deixar o estado confiável para a UI

### 4) Tornar o sync de propostas realmente incremental e mais leve
Hoje o código ainda faz:
- `listAll("/propostas")` para carregar toda a listagem primeiro
- e só depois processa em lotes de 25

Vou ajustar isso para:
- continuar em lotes pequenos
- interromper cedo ao sair da janela de 36 meses
- reduzir trabalho desnecessário antes do processamento
- manter o cursor para continuar da proposta mais recente para as anteriores

Objetivo:
- evitar lentidão desnecessária e reduzir risco de timeout

### 5) Otimizar a tela de propostas para o cenário com muitos registros
Depois de destravar o sync, preparar o front para escalar melhor:

#### `src/routes/app.propostas.index.tsx`
- limitar a carga inicial
- evitar leitura completa desnecessária
- reduzir custo do segundo lookup em `nomus_proposals`
- manter ordenação pela data real do Nomus (`criada_em_nomus` / `data_emissao`)

#### `src/routes/app.index.tsx`
- evitar puxar todas as propostas no dashboard quando bastam indicadores e poucas recentes

Objetivo:
- deixar a UI rápida quando as ~150+ propostas forem importadas

## Resultado esperado

Depois dessas mudanças:

- a tela de propostas para de ficar presa em “Sincronizando...”
- o banco volta a receber propostas normalmente
- o sistema importa da mais recente para trás, dentro da janela de 36 meses
- a lista volta a aparecer
- o front fica mais preparado para volumes maiores sem parecer travado

## Arquivos a alterar

- `supabase/migrations/<nova_migration>.sql`
- `src/integrations/nomus/server.functions.ts`
- `src/routes/hooks/nomus-cron.ts`
- `src/routes/app.propostas.index.tsx`
- `src/routes/app.index.tsx`

## Detalhe técnico

```text
Fluxo atual com problema
Botão Buscar
  -> nomusKickoffSyncProposals
  -> running=true
  -> fetch interno para /hooks/nomus-cron falha
  -> banco fica vazio
  -> UI continua esperando

Fluxo corrigido
Botão Buscar
  -> nomusKickoffSyncProposals
  -> dispara cron por URL estável
  -> cron confirma início
  -> running=true somente com job válido
  -> sync processa em lotes
  -> proposals/nomus_proposals recebem dados
  -> UI atualiza corretamente
```
