Analisei o código e a base atual. O CRM já está parcialmente integrado com os endpoints de Processos do Nomus, mas ainda não segue 100% as regras que você enviou.

## O que já está funcionando

- O endpoint central já está mapeado como `processos: "/processos"`.
- Existe sincronização de leitura do Nomus para o CRM:
  - `GET /processos`
  - `GET /processos/:id` em algumas rotinas de rechecagem.
- Os processos são salvos em uma tabela espelho (`nomus_processes`) com campos compatíveis:
  - `nome`, `tipo`, `etapa`, `prioridade`, `equipe`, `origem`, `responsavel`, `reportador`, `dataCriacao`, `dataHoraProgramada`, `raw`.
- O Kanban do CRM usa `tipo` como funil e `etapa` como coluna.
- Etapas novas vindas do Nomus são cadastradas automaticamente em `crm_funnel_stages`.
- Há sincronização automática/recorrente: os logs mostram chamadas recentes com sucesso para `GET /processos?pagina=1`.
- Hoje existem dados reais sincronizados:
  - 121 processos em `nomus_processes`
  - 16 etapas/funis em `crm_funnel_stages`
  - logs de integração com status 200 para processos.

## O que não está completo ou diverge das regras

1. **Sincronização bidirecional ainda não está implementada de fato**
   - Existe apenas um `pingProcessoPut`, que testa `PUT /processos/:id` sem mudar nada.
   - Não encontrei função real para alterar etapa/responsável/prioridade no Lovable e enviar `PUT` ao Nomus.
   - Também não encontrei drag-and-drop ou ação de mover card no Kanban.
   - A tabela `crm_stage_changes` existe, mas está vazia; ou seja, o sistema não está registrando mudanças de etapa.

2. **Criação de processo no Nomus ainda não está implementada**
   - O endpoint `POST /processos` está documentado na sua regra, mas o sistema atual não tem uma função de “criar processo no Nomus”.

3. **Mapeamento de campos está parcial**
   - A leitura já mapeia os principais campos, mas a tela do CRM não usa todos de forma operacional.
   - `dataHoraProgramada` é armazenada, mas o Kanban/detalhe ainda usa mais `proximo_contato`/datas locais do que a regra enviada.
   - O campo `idPrioridade` não existe em coluna própria; se vier do Nomus, fica apenas dentro do `raw`.

4. **Regra de “etapa Nomus -> status CRM” está sendo usada como espelho, não como tradução configurável**
   - Hoje o sistema usa a própria `etapa` como coluna do CRM.
   - Há uma exceção local: se uma proposta vinculada parecer “venda confirmada”, o card pode aparecer como “Venda confirmada”, mesmo que o processo no Nomus esteja em outra etapa. Isso pode criar divergência visual.

5. **Sincronização incremental atual só olha páginas/IDs recentes**
   - Isso é bom para performance, mas mudanças antigas no Nomus podem demorar ou não entrar se não forem rechecadas em uma varredura completa/manual.

6. **Há um registro suspeito sincronizado com `nomus_id = 0`**
   - Isso indica que algum detalhe retornou/salvou `{ id: 0 }` ou que a rotina aceitou um ID inválido. Deve ser tratado para evitar card/processo fantasma.

## Plano de ajuste para seguir exatamente as regras enviadas

### 1. Completar o mapeamento de Processo Nomus
- Ajustar o parser/salvamento para aceitar explicitamente:
  - `id`
  - `nome`
  - `etapa`
  - `tipo`
  - `prioridade`
  - `idPrioridade`
  - `reportador`
  - `responsavel`
  - `equipe`
  - `dataHoraProgramada`
  - `dataCriacao`
  - `origem`
- Criar coluna para `id_prioridade` se necessário.
- Bloquear salvamento de processos com `id` vazio ou `0`.

### 2. Implementar atualização real Lovable -> Nomus
- Criar uma server function segura para atualizar processo:
  - recebe `process_id` local e campos alterados.
  - busca o processo atual no banco.
  - monta payload no formato aceito pelo Nomus.
  - chama `PUT /processos/:id`.
  - se o Nomus confirmar, atualiza `nomus_processes` local.
  - registra histórico em `crm_stage_changes` quando a etapa mudar.
- Usar esse fluxo para:
  - alteração de etapa.
  - responsável.
  - prioridade/idPrioridade.
  - equipe.
  - data programada.

### 3. Adicionar movimento de etapa no CRM/Kanban
- Permitir mover cards entre colunas/etapas.
- Ao mover:
  - chamar `PUT /processos/:id` no Nomus.
  - atualizar a etapa local somente depois do sucesso.
  - exibir erro amigável se o Nomus recusar.
  - gravar histórico em `crm_stage_changes`.

### 4. Implementar criação de processo no Nomus
- Criar ação “Novo processo” no CRM.
- Enviar `POST /processos` com campos conforme sua regra:
  - `dataHoraProgramada`
  - `nome`
  - `reportador`
  - `responsavel`
  - `tipo`
  - `prioridade`/`idPrioridade`
  - `etapa`
  - `equipe`
  - `origem`
- Após criar, puxar o detalhe do processo criado e salvar no CRM local.

### 5. Separar “espelho Nomus” de “enriquecimento local”
- Manter `nomus_processes.etapa` como fonte oficial do Nomus.
- Evitar mover visualmente um card para “Venda confirmada” só por status de proposta, a menos que também exista atualização real no processo Nomus.
- Se quiser manter esse comportamento, mostrar como “sugestão/alerta”, não como etapa oficial.

### 6. Melhorar sincronização Nomus -> Lovable
- Manter sync rápido das páginas recentes.
- Adicionar uma opção administrativa de “varredura completa de processos” para reprocessar todas as páginas.
- Garantir que novas etapas/tipos encontrados continuem criando funis/colunas automaticamente.

### 7. Ajustar a tela do CRM
- Mostrar os campos operacionais enviados pelo Nomus:
  - etapa
  - tipo
  - prioridade
  - responsável
  - equipe
  - origem
  - data programada
- Adicionar botão/ação de edição do processo.
- Adicionar indicação clara quando o card está sincronizado ou quando houve falha ao enviar para o Nomus.

## Resultado esperado

Depois desses ajustes, o CRM seguirá a regra:

```text
Nomus Processo            CRM Lovable
--------------------------------------------
nome                      Título da oportunidade
etapa                     Coluna/status do Kanban
tipo                      Funil/tipo de oportunidade
responsavel               Responsável
prioridade/idPrioridade   Prioridade
dataHoraProgramada        Data programada/fechamento
origem                    Origem
```

E o fluxo ficará bidirecional:

```text
Nomus GET /processos        -> atualiza CRM
Nomus GET /processos/:id    -> atualiza detalhe local
CRM muda etapa/campos       -> PUT /processos/:id no Nomus
CRM cria processo           -> POST /processos no Nomus
Nomus muda processo         -> próximo sync atualiza CRM
```