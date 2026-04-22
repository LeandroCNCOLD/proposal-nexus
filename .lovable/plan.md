

## Diagnóstico — Sync travada com erro 400 do Nomus

### Estado atual no banco
- `nomus_sync_state.propostas`: `running=true` desde **16:33:38** (mais de 30 minutos), `last_synced_at=NULL`, `total_synced=0`, `last_error=NULL`.
- `nomus_proposals`: **0 registros** (tabela continua vazia após o reset).
- `nomus_sync_log` mostra que toda chamada de hoje após as 15:40 falhou com:
  ```
  Nomus 400: {"descricao":"1","status":400}
  ```
- A última execução com sucesso foi às **15:40** (4 chamadas `list` com `http_status=200`), antes da mudança para a busca reversa.

### Causa raiz
O job de sync ficou marcado como `running=true` mas o handler nunca limpou a flag — provavelmente caiu por timeout do Worker (Cloudflare ~30s) ou por exceção não capturada após o erro 400 do Nomus. O endpoint `GET /propostas?pagina=N` está devolvendo `400 {"descricao":"1"}` para alguma combinação de parâmetros que `pullProposalsNewestFirst` está mandando — provavelmente quando passa de uma página que não existe, ou está enviando algum parâmetro extra que o Nomus rejeita (lembrando: `tamanhoPagina` faz a API responder 400).

### Plano de correção

**1. Liberar o estado travado** (migration de UPDATE)
- `UPDATE nomus_sync_state SET running=false, last_error='timeout/cleanup manual', updated_at=now() WHERE entity='propostas';`

**2. Endurecer `src/routes/hooks/nomus-cron.ts`**
- Envolver `pullProposalsNewestFirst` em `try/finally` que **sempre** zera `running=false` no banco, mesmo em exceção/timeout.
- Tratar `400` na listagem como "fim da paginação" em vez de erro fatal — para o loop de páginas em vez de derrubar o job.
- Garantir que somente `pagina` é enviado (sem `tamanhoPagina`, sem ordenação extra).
- Limitar tempo de execução por chamada do cron (ex.: processar no máx. 40 propostas por invocação) e re-agendar via `last_cursor` para a próxima rodada — assim cada execução fica bem abaixo do limite do Worker.

**3. Adicionar logging mais claro**
- Em cada falha gravar em `nomus_sync_log` com o `request_path` exato e o `pagina` que disparou o 400, para a gente isolar se o erro é página inexistente ou parâmetro inválido.

**4. Re-disparar a sincronização**
- Após o deploy, clico em **"Buscar do Nomus"** e fico observando `nomus_sync_state` + `nomus_sync_log` em tempo real.

### Resultado esperado
- O botão "Sincronizando..." vai parar de girar mesmo se algo falhar (já não fica preso pra sempre).
- Os 400 da paginação não vão mais matar o job — ele vai parar elegantemente quando atingir o fim da lista.
- Cada execução do cron processa um lote pequeno e atualiza o `last_cursor`, então em 2-3 ciclos automáticos (ou cliques manuais) populamos as ~150 propostas dos últimos 36 meses começando pelas mais recentes.

### Detalhe técnico (para referência)
- Arquivos a alterar: `src/routes/hooks/nomus-cron.ts` (try/finally + tratamento de 400 + lote menor), `src/integrations/nomus/client.ts` (se necessário, mapear 400 da listagem como "no more pages").
- Migration: 1 UPDATE em `nomus_sync_state`.
- Sem mudanças de UI nesta etapa — `app.propostas.index.tsx` já mostra spinner correto via polling.

