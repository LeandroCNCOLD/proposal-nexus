Plano de correção da sincronização Nomus / Proposal Nexus

Objetivo: transformar a sincronização em um processo idempotente, rastreável e seguro, para que rodar 1 ou 10 vezes produza o mesmo resultado, sem duplicar clientes, propostas, itens, produtos/equipamentos ou representantes.

1. Banco de dados: travas contra duplicidade
- Criar uma migration para adicionar/garantir índices e constraints únicas onde ainda faltam.
- Já existem `unique` em alguns `nomus_id`, mas vou reforçar o modelo com índices idempotentes e chaves naturais:
  - clientes por `nomus_id` e por documento normalizado quando não houver `nomus_id`.
  - propostas por `nomus_id` e por número normalizado quando não houver `nomus_id`.
  - representantes/vendedores por `nomus_id`.
  - itens espelho de proposta por `nomus_proposal_id + nomus_item_id` e itens locais por `proposal_id + nomus_item_id` após adicionar a coluna necessária.
  - equipamentos por `line_id + model normalizado`.
  - curvas por equipamento + temperaturas/umidade, usando os nomes reais da base: `equipment_id`, `evaporation_temperature`, `condensation_temperature`, `chamber_temperature`, `chamber_humidity`.
- Criar as tabelas:
  - `sync_runs`
  - `sync_row_logs`
  - `nomus_product_equipment_links`
- Habilitar RLS nessas tabelas e permitir leitura para usuários autenticados; alterações serão feitas por funções servidoras confiáveis.

2. Normalização centralizada
- Criar `src/services/sync/normalization.ts` com:
  - `normalizeString`
  - `normalizeDocument`
  - `normalizePhone`
  - `normalizeEmail`
  - `normalizeModel`
  - `normalizeProposalNumber`
- Usar essas funções nos fluxos Nomus e na importação de equipamentos, evitando comparação por texto cru.

3. Serviço de auditoria de sync
- Criar `src/services/sync/syncAuditService.ts` para:
  - iniciar `sync_run`
  - registrar cada linha em `sync_row_logs`
  - contabilizar inseridos, atualizados, ignorados e erros
  - finalizar a execução com status `success`, `partial_success` ou `error`
- Substituir o padrão atual de “erros resumidos no state” por log linha a linha, mantendo o `nomus_sync_state` apenas como status rápido para a interface atual.

4. Reescrever upserts da sincronização Nomus
- Ajustar `src/integrations/nomus/server.functions.ts` para nunca usar `insert` simples em dados vindos do Nomus.
- Fluxo padrão por item:
  1. normalizar payload
  2. validar campos mínimos
  3. procurar por `nomus_id`
  4. se não achar, procurar por chave natural
  5. atualizar se existir
  6. inserir somente se não existir
  7. registrar ação em `sync_row_logs`
- Aplicar isso em:
  - clientes
  - contatos
  - produtos/equipamentos
  - representantes/vendedores
  - propostas espelho (`nomus_proposals`)
  - itens de proposta (`nomus_proposal_items` e, quando aplicável, `proposal_items`)
  - pedidos e notas fiscais, mantendo idempotência por `nomus_id`.

5. Propostas e itens sem duplicação
- Trocar o trecho que hoje apaga e insere itens da proposta por upsert com chave `nomus_proposal_id + nomus_item_id`.
- Quando o Nomus não retornar `nomus_item_id`, usar uma chave natural estável baseada em posição/código/descrição normalizada, sem gerar registros novos a cada sync.
- Espelhar proposta local com `upsert`/update por `nomus_id` ou número normalizado, não por `insert` simples.

6. Produtos Nomus x equipamentos locais
- Criar a tabela `nomus_product_equipment_links` com `match_type`:
  - `exact_model`
  - `normalized_model`
  - `manual`
  - `unmatched`
- Ajustar `nomusSyncProducts` para:
  - tentar vínculo por `nomus_id`
  - tentar modelo exato
  - tentar modelo normalizado
  - se não achar, gravar `unmatched`, sem criar equipamento duplicado
- Criar funções servidoras para listar pendências e salvar vínculo manual.

7. Serviço de deduplicação
- Criar `src/services/sync/deduplicationService.ts` com:
  - `findDuplicateCustomers` / `mergeDuplicateCustomers`
  - `findDuplicateProducts` / `mergeDuplicateProducts`
  - `findDuplicateProposals` / `mergeDuplicateProposals`
  - `findDuplicateEquipments` / `mergeDuplicateEquipments`
- Critérios de duplicidade:
  - `nomus_id` igual
  - documento igual
  - e-mail igual
  - nome muito semelhante com documento vazio
  - código/modelo igual
  - número de proposta igual
- Regra de sobrevivente:
  1. preservar registro com `nomus_id`
  2. preservar registro mais recente
  3. preservar registro com mais campos preenchidos
  4. preservar/reatribuir relacionamentos existentes antes de desativar/remover duplicado
- Registrar todo merge em `sync_row_logs` antes da alteração.

8. Importação Excel de equipamentos
- Mover a importação para função servidora em vez de fazer insert direto no cliente.
- Validar colunas obrigatórias.
- Bloquear modelo vazio; remover o comportamento atual que cria modelo aleatório.
- Aplicar `normalizeModel`.
- Usar upsert por `line_id + model normalizado`.
- Upsert de curvas pela chave única de performance.
- Gerar relatório na tela: inseridos, atualizados, ignorados e rejeitados com motivo.

9. Tela de auditoria `/app/sync-audit`
- Criar a rota `/app/sync-audit` e adicionar link no menu.
- Exibir:
  - histórico de sincronizações
  - status
  - entidade
  - totais inseridos/atualizados/ignorados/erros
  - detalhes por linha
  - filtro “ver erros”
  - botão “ver duplicidades”
  - botão “executar deduplicação”
  - botão “reprocessar erros”
- Criar também uma seção para produtos Nomus sem equipamento correspondente, permitindo vínculo manual.

10. Segurança operacional
- Verificar `.gitignore` e garantir `.env` ignorado.
- Manter somente `.env.example` se existir ou criar um exemplo sem segredos reais.
- Não mexer nos arquivos gerados da integração de backend (`client.ts`, `types.ts`, `.env`).
- Não versionar tokens, URLs privadas ou chaves sensíveis.

11. Validação final
- Rodar verificação de tipos/build.
- Validar queries de duplicidade antes/depois para clientes, propostas, equipamentos e itens.
- Executar um ciclo de sync em modo controlado e confirmar que a segunda execução não cria novos registros quando não houver mudanças.

Observação técnica importante
- A base atual já tem alguns `unique(nomus_id)`, mas há pontos de risco: itens de proposta são apagados/reinseridos, importação de equipamentos usa `insert`, produtos sem match não têm fila própria de revisão, e o log atual não audita linha a linha. O trabalho vai corrigir esses pontos e adicionar travas no banco para impedir regressão.