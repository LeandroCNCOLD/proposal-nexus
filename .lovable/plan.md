Plano de implementação — Sync Nomus/Proposal Nexus em nível profissional

Vou incorporar os 14 pontos como uma segunda camada sobre a base anti-duplicidade já iniciada, mantendo o objetivo central: sincronização idempotente, auditável, segura e previsível.

## 1. Governança de “fonte mestre” por campo

Criar uma tabela de configuração para definir quem manda em cada campo:

- Nomus: razão social, CNPJ, endereço fiscal, proposta, itens, valores, impostos.
- Proposal Nexus: status comercial interno, temperatura do lead, observações internas, timeline, anexos, templates.

A sincronização passará a consultar essa configuração antes de atualizar campos locais, para impedir que uma sync sobrescreva informações estratégicas editadas manualmente.

## 2. Campos de controle de sincronização

Adicionar campos nas entidades sincronizadas principais, quando ainda não existirem:

- `external_updated_at`
- `last_synced_at`
- `sync_hash`
- `external_deleted_at`
- `is_active` onde faltar

Entidades alvo:

- clientes
- propostas locais
- itens de proposta
- equipamentos
- propostas espelhadas do Nomus
- itens espelhados do Nomus
- representantes/vendedores
- processos do CRM

## 3. Hash de payload normalizado

Implementar utilitário único para:

- normalizar payloads vindos do Nomus
- ordenar chaves de JSON de forma estável
- remover campos voláteis
- gerar `sync_hash`

Regra:

- hash igual ao anterior: registrar `skipped_no_change`, sem update desnecessário
- hash diferente: atualizar apenas campos permitidos pela fonte mestre e gravar histórico por campo

## 4. Soft delete / inativação

Não apagar registros locais se sumirem do Nomus.

A rotina marcará como:

- `is_active = false`
- `external_deleted_at = now()`

Isso será aplicado de forma conservadora: apenas quando uma sincronização completa ou uma janela confiável indicar que o registro não veio mais do Nomus.

## 5. Bloqueio de concorrência

Criar tabela `sync_locks` e funções auxiliares para:

- adquirir lock por entidade/fonte
- impedir duas syncs simultâneas da mesma entidade
- expirar lock antigo em caso de falha
- liberar lock no `finally`

Também vou substituir gradualmente o uso simples de `running` em `nomus_sync_state` por esse lock transacional.

## 6. Dry-run / homologação

Adicionar modo `dryRun` às rotinas principais de sincronização.

O dry-run fará todo o processamento, mas sem gravar dados. Resultado esperado:

- seriam inseridos: X
- seriam atualizados: Y
- seriam ignorados: Z
- teriam erro: W
- seriam enviados para quarentena: Q

## 7. Quarentena de dados ruins

Criar `sync_quarantine` para registros incompletos ou incoerentes, por exemplo:

- CNPJ inválido
- cliente sem nome
- produto sem código
- proposta sem número
- item sem valor
- item sem equipamento vinculado

A sincronização não criará cadastros duplicados “na dúvida”; vai registrar o caso na quarentena para revisão.

## 8. Reprocessamento individual de erros

Adicionar suporte para reprocessar:

- uma linha específica da quarentena
- linhas por código de erro
- propostas com erro
- clientes sem CNPJ
- produtos unmatched

A execução de reprocessamento criará novo `sync_run` vinculado ao erro original.

## 9. Mapeamento de campos versionado

Criar `sync_field_mappings` para registrar:

- entidade
- campo Nomus
- campo local
- transformação aplicada
- se é obrigatório
- se está ativo
- versão

Isso permitirá ajustar mapeamentos quando o Nomus mudar campos, sem espalhar regras fixas pelo código.

## 10. Relatório de qualidade da sync

Criar serviço de indicadores com métricas como:

- % registros com `nomus_id`
- clientes sem CNPJ
- produtos unmatched
- propostas sem itens
- itens sem equipamento vinculado
- duplicidades detectadas
- última sync bem-sucedida
- últimas falhas por entidade

Esse relatório será disponibilizado na área de auditoria/sync.

## 11. Histórico de alterações por campo

Criar `sync_field_changes` para cada update relevante:

- entidade
- registro local
- campo alterado
- valor anterior
- valor novo
- origem
- sync_run_id
- data

Isso deixará claro exatamente o que a sincronização alterou.

## 12. Merge seguro de duplicidades

Nunca excluir duplicado diretamente.

Implementar fluxo seguro:

1. detectar duplicidade
2. sugerir registro principal
3. listar relacionamentos impactados
4. transferir vínculos
5. marcar duplicado como `merged`
6. manter histórico, sem apagar fisicamente

Criar tabela `sync_merge_suggestions` / `entity_merge_history` para registrar isso.

## 13. Normalização forte de modelos CN Cold

Melhorar o normalizador de equipamentos/produtos para gerar `normalized_model_code`, tratando variações como:

- `CN-010-HT-MB-6-22M-CP`
- `CN 010 HT MB 6 22M CP`
- `010HTMB622MCP`

Todas devem convergir para uma chave comparável. Essa chave será usada para matching de produto/equipamento antes de enviar para unmatched/quarentena.

## 14. Biblioteca padronizada de erros

Criar `sync_error_codes` com códigos como:

- `INVALID_CNPJ`
- `MISSING_EXTERNAL_ID`
- `DUPLICATE_NATURAL_KEY`
- `UNMATCHED_EQUIPMENT`
- `INVALID_PROPOSAL_TOTAL`
- `MISSING_REQUIRED_FIELD`
- `SKIPPED_NO_CHANGE`

Os logs e a quarentena passarão a usar esses códigos, deixando o diagnóstico mais profissional.

## Ajustes técnicos nos fluxos existentes

Vou aplicar esses recursos principalmente em:

- sincronização de clientes
- sincronização de propostas
- itens de proposta
- produtos/equipamentos
- vendedores/representantes
- processos do CRM
- cron de propostas/CRM

O fluxo final ficará assim:

```text
Nomus payload
  -> normalização
  -> validação
  -> hash
  -> lock por entidade
  -> dry-run ou persistência real
  -> regra de fonte mestre
  -> upsert idempotente
  -> histórico por campo
  -> logs por linha
  -> quarentena se inválido
  -> relatório de qualidade
```

## Validação

Após implementar, vou validar com:

- checagem TypeScript
- inspeção das queries e constraints
- teste lógico de idempotência: rodar a mesma sync não deve criar duplicados
- verificação dos logs de auditoria
- verificação de dry-run sem gravação

Resultado esperado:

- sincronizar 1 vez ou 10 vezes gera o mesmo estado
- não duplica clientes, propostas, itens, produtos, equipamentos ou representantes
- campos locais estratégicos não são sobrescritos
- dados ruins vão para quarentena
- erros podem ser reprocessados
- cada alteração fica rastreável por campo
- duplicidades são tratadas por merge seguro, sem exclusão física imediata