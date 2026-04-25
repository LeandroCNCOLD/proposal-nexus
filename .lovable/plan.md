Plano de implementação: sincronização Nomus em pipeline eficiente, resiliente e observável

Vou evoluir a sincronização atual sem remover as proteções já criadas: chaves únicas, hash, auditoria, quarentena, locks, mapeamento de fonte mestre e preservação de campos locais.

## 1. Estrutura de banco para operação robusta

Criar/ajustar tabelas e campos para controlar execução por lote:

- `sync_checkpoints`
  - `entity_type`
  - `last_page`
  - `last_external_id`
  - `last_updated_at`
  - `status`
  - `cursor_payload`
  - `sync_run_id`
  - `updated_at`

- `sync_pending_issues`
  - pendências operacionais, separadas de logs técnicos
  - exemplos: produto sem equipamento, cliente sem CNPJ, proposta sem item, item sem valor, representante não encontrado
  - status: `open`, `resolved`, `ignored`, `reprocessed`

- `outbound_sync_queue`
  - preparado para sincronização futura Nexus -> Nomus
  - nada será enviado diretamente; toda saída futura terá fila, status, tentativa, erro e log

- Campos nas entidades sincronizadas, onde ainda faltarem:
  - `sync_status text default 'synced'`
  - `sync_error_code text`
  - `sync_error_message text`
  - `last_sync_run_id uuid`

- Tabelas de configuração:
  - `sync_entity_policies` para frequência, janela padrão, prioridade e dados quentes/frios
  - `sync_protected_fields` para impedir sobrescrita de campos locais

## 2. Rate control e retry com backoff

A integração já trata 429 parcialmente; vou transformar isso em comportamento padronizado:

- Configuração por entidade:
  - `max_requests_per_minute`
  - `retry_after_seconds`
  - `backoff_multiplier`
  - `timeout_ms`
  - `max_attempts`

- Regras:
  - HTTP 429 respeita `Retry-After`/tempo informado, quando existir
  - timeout e 5xx fazem retry com backoff exponencial
  - falha final grava erro detalhado no lote e no log

Observação: não vou implementar rate limiting de backend para usuários. Este controle é apenas para cadenciar chamadas ao Nomus e evitar sobrecarga/429 na API externa.

## 3. Pipeline único por entidade

Refatorar o fluxo para ficar consistente:

```text
API Nomus
  -> fetch paginado/incremental
  -> checkpoint por página/lote
  -> normalize
  -> validate
  -> bulk read local
  -> diff/hash por campo
  -> bulk upsert
  -> pendências/quarentena
  -> auditoria
  -> relatório/dashboard
```

Esse pipeline será aplicado gradualmente em:

1. clientes
2. representantes/vendedores
3. produtos/equipamentos
4. propostas
5. itens de proposta
6. pedidos/notas, mantendo o mesmo padrão onde fizer sentido

## 4. Checkpoint por página/lote

A sync deixará de depender apenas de `nomus_sync_state.last_cursor`.

- Antes de processar cada lote: registrar checkpoint `running`
- Após processar lote com sucesso: atualizar `last_page`, `last_external_id`, `last_updated_at`
- Se cair no meio: próxima execução retoma do checkpoint
- Se finalizar entidade: status `completed`
- Se houver erro: status `failed`, mantendo cursor para reprocessar

## 5. Sync incremental e janelas de tempo

Adicionar opções para sincronização:

- últimos 7 dias
- últimos 30 dias
- período personalizado
- tudo
- modo incremental automático por `last_successful_sync`

Quando Nomus tiver campo de atualização, usar:

```text
updated_at > last_successful_sync
```

Quando não tiver, usar paginação + hash + checkpoint.

## 6. Dados quentes/frios e prioridade por status

Criar política de frequência:

- propostas abertas/enviadas/em negociação: alta prioridade, janela curta
- clientes ativos: diária
- produtos/equipamentos: diária ou sob demanda
- propostas encerradas/antigas: semanal ou janela maior

Para propostas:

- processar abertas/em negociação primeiro
- depois encerradas recentes
- por último antigas/canceladas/perdidas

## 7. Bulk read antes do upsert

Substituir consultas uma-a-uma por leitura em lote:

- coletar `nomus_id`, CNPJ, número de proposta, código de produto/modelo do lote
- buscar todos os registros existentes em uma ou poucas consultas
- montar `Map` em memória:
  - `customer_nomus_id -> customer_id`
  - `product_nomus_id -> product_id/equipment_id`
  - `representative_nomus_id -> representative_id`
  - `proposal_nomus_id -> proposal_id`

Isso reduz custo, tempo e chance de timeout.

## 8. Validação antes de gravar

Separar validações por entidade:

- cliente sem ID ou sem nome: quarentena
- CNPJ inválido: quarentena/pendência
- produto sem equipamento: pendência operacional, sem criar duplicado
- proposta sem item: pendência
- item sem valor: pendência/quarentena conforme gravidade
- representante não encontrado: pendência

Regra central: registro inválido não entra no cadastro principal como duplicado.

## 9. Diff por campo e anti-sobrescrita

Antes de atualizar:

- calcular hash do payload normalizado
- se hash igual: `skip`
- se hash diferente: comparar campo a campo
- atualizar somente campos alterados e permitidos

Campos locais protegidos não serão sobrescritos pelo Nomus:

- `status_comercial_local` / status comercial interno
- `temperatura_lead`
- `observacoes_internas`
- `responsavel_interno`
- `timeline`
- `tags`
- `prioridade`
- anexos/templates/campos manuais equivalentes já existentes

## 10. Teste automático de duplicidade após sync

Ao final de cada execução:

- verificar clientes duplicados por CNPJ
- propostas duplicadas por número/nomus_id
- produtos duplicados por código
- equipamentos duplicados por modelo normalizado
- itens duplicados por proposta + item/chave natural

Resultado:

- gravar em `sync_quality_reports`
- abrir `sync_pending_issues` quando houver duplicidade
- não fazer merge automático nem exclusão física

## 11. Dashboard de saúde da sincronização

Atualizar a tela de Integração Nomus para mostrar:

- última sync OK por entidade
- status atual e progresso/checkpoint
- tempo médio de sync
- quantidade de erros
- quantidade de pendências abertas
- duplicidades detectadas
- tempo desde última atualização
- últimas execuções resumidas
- erros detalhados separados

Também incluir controles:

- sync geral na ordem correta
- sync por entidade
- seleção de janela: 7 dias, 30 dias, personalizada, tudo
- visualização de pendências operacionais

## 12. Ordem do sync geral

O botão de sincronização geral seguirá ordem segura:

1. representantes/vendedores
2. clientes
3. produtos/equipamentos
4. propostas
5. itens de proposta
6. pedidos/notas/vínculos
7. verificação de duplicidade
8. relatório de qualidade

## 13. Documentos e anexos

Não sincronizar anexos/documentos pesados automaticamente.

- sync recorrente: dados leves
- documentos/anexos: somente sob demanda
- logs devem diferenciar `data_sync` de `document_sync`

## 14. Arquivos principais que serão alterados

- `src/integrations/nomus/client.ts`
  - padronizar retry/backoff/rate pacing

- `src/integrations/nomus/server.functions.ts`
  - pipeline por lote, bulk read, diff por campo, checkpoints, janelas e sync geral

- `src/services/sync/normalization.ts`
  - helpers de diff/campos protegidos/chaves naturais quando necessário

- `src/services/sync/syncAuditService.ts`
  - checkpoint, pendências, qualidade, status por entidade e logs resumidos

- `src/routes/api.public.hooks.nomus-cron.ts`
  - adaptar cron para usar políticas, checkpoints e dados quentes/frios

- `src/routes/app.configuracoes.nomus.tsx`
  - dashboard de saúde, progresso, pendências e botões por janela

- nova migração em `supabase/migrations/...sql`
  - novas tabelas, índices, RLS e campos de status

## 15. Validação final

Após implementar, vou verificar:

- TypeScript/build
- chamadas de sync não fazem uma consulta por registro quando for possível usar lote
- segunda execução não duplica dados
- registros inválidos vão para quarentena/pendências
- campos locais protegidos não são sobrescritos
- checkpoints permitem retomar
- dashboard mostra saúde e pendências

Resultado esperado: sincronizar uma ou várias vezes deve manter o mesmo estado final, com execução mais rápida, retomável, auditável e com pendências visíveis em vez de duplicidades silenciosas.