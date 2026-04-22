

## Plano — Destravar e corrigir o sync de propostas (de verdade)

### O que está quebrado
1. `nomus_sync_state.propostas.running=true` desde 16:44 (travado).
2. Toda chamada de hoje retorna `Nomus 400 {"descricao":"1"}` porque a URL ainda inclui `tamanhoPagina=50` — parâmetro que o Nomus rejeita. As únicas chamadas com sucesso (15:40) usaram só `?pagina=N`.
3. O `try/finally` para liberar `running=false` em caso de erro não está funcionando (ou nunca foi colocado em `pullProposalsNewestFirst`), então o flag fica preso.

### Correções

**1. Migration — destravar o estado**
```sql
UPDATE nomus_sync_state
SET running=false,
    last_error='cleanup: bug tamanhoPagina causando 400',
    updated_at=now()
WHERE entity='propostas';
```

**2. `src/integrations/nomus/client.ts` — remover `tamanhoPagina` do `listAll`**
- Localizar onde a URL de listagem é montada e garantir que **só** `pagina` é enviado (sem `tamanhoPagina`, sem outros filtros).
- Tratar `400` na listagem como "fim da paginação" (parar o loop graciosamente em vez de lançar erro fatal).
- Logar `request_path` exato no `nomus_sync_log` para auditoria.

**3. `src/routes/hooks/nomus-cron.ts` — blindar `pullProposalsNewestFirst`**
- Envolver TODA a função num `try { ... } finally { /* sempre seta running=false e atualiza last_cursor */ }`.
- Confirmar batch pequeno (`PROPOSALS_BATCH_SIZE=25`) e respeitar `last_cursor` entre execuções.
- Em erro fatal, gravar `last_error` legível e sair sem deixar o flag preso.

**4. Re-disparar**
- Após deploy, clicar em **"Buscar do Nomus"** em `/app/propostas`.
- Acompanhar via `nomus_sync_state` + `nomus_sync_log` (vou verificar pelo banco).

### Resultado esperado
- Spinner para sozinho mesmo em erro.
- Sem mais `400 tamanhoPagina` — paginação usa só `?pagina=N`.
- Em 1-2 cliques, popula as ~150 propostas dos últimos 36 meses, da mais recente para a mais antiga, com todos os campos detalhados (tributos, lucros, itens, condição de pagamento).

### Arquivos a alterar
- `supabase/migrations/<novo>.sql` (1 UPDATE)
- `src/integrations/nomus/client.ts` (remover `tamanhoPagina`, mapear 400 como fim)
- `src/routes/hooks/nomus-cron.ts` (try/finally robusto)

Sem mudanças de UI nesta etapa.

