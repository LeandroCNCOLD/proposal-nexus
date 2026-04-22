

## Documentar e alinhar endpoints Nomus para o CNCode

Vou consolidar tudo o que você passou em um documento de referência dentro do projeto e ajustar o mapa de endpoints do código para bater 100% com o que o Nomus realmente expõe (incluindo rotas que ainda não estavam mapeadas: contatos por pessoa, processos, contas a receber, DANFE, CC-e).

Não vou mexer em fluxo de proposta, template ou banco — só endpoints, documentação e o teste de saúde.

## O que será criado

**1. `docs/nomus-endpoints.md`** — documento de referência (fonte única de verdade humana)

Conteúdo:
- Base URL do CNCode: `https://cncold.nomus.com.br/cncold/rest`
- Headers obrigatórios (`Authorization: Basic ...`, `Content-Type`, `Accept`)
- Regras de paginação (`pagina`, limite 50/página) e throttling (429 + `tempoAteLiberar`)
- Tabela com os 10 grupos de endpoints (propostas, clientes, contatos, produtos, representantes, tabelas de preço, processos, pedidos, NFes, contas a receber), cada um com:
  - método + URL
  - finalidade no CNCode
  - status (oficial documentado / validado em ambiente / a confirmar)
- Observação destacada de que **propostas é a fonte principal** e os demais são complementares
- Seção "Próximo passo" pedindo um JSON real de `/propostas/{id}` para fazer o mapeamento campo a campo

## O que será ajustado no código

**2. `src/integrations/nomus/endpoints.ts`** — completar o mapa

Adicionar entradas que faltam:
- `processos: "/processos"`
- `contas_receber: "/contasReceber"`
- Helper `pessoaContatosPath(idPessoa)` → `/pessoas/{idPessoa}/contatos` (rota aninhada, não cabe no mapa simples)
- Helpers para sub-recursos de NFe: `nfeDanfePath(id)` → `/nfes/danfe/{id}`, `nfeCcePath(id)` → `/nfes/cce/{id}`

Endpoints que já estão certos e ficam intocados: `clientes`, `produtos`, `representantes`, `vendedores`, `condicoesPagamentos`, `propostas`, `pedidos`, `nfes`, `tabelasPreco`.

**3. `src/integrations/nomus/client.ts`** — melhorar o teste de conexão

Hoje o `testNomusConnection` só bate em `/clientes`. Vou trocar para testar **3 endpoints em sequência** (`/clientes`, `/representantes`, `/propostas`) e devolver o status de cada um. Assim, quando der erro, fica claro se é problema de URL, de auth, ou de permissão num recurso específico daquela chave.

Saída do teste passa a ser algo como:
```text
clientes:        200 OK
representantes:  200 OK
propostas:       400 {"descricao":"1"}
```

Isso te dá evidência objetiva pra mostrar pro suporte Nomus exatamente qual recurso a chave de integração não está liberando.

## O que NÃO será alterado

- Banco de dados (nenhuma migration)
- Fluxo de sincronização (`nomus-cron`, `nomusKickoffSyncProposals`, mappers)
- Telas (`/app/propostas`, `/app/configuracoes/nomus`)
- Edge functions
- Mapeamento campo-a-campo do payload de proposta — esse é o **próximo passo**, depois que você me mandar um JSON real de `/propostas/{id}` (mesmo mascarado)

## Detalhes técnicos

- O documento vai em `docs/` (fora de `src/`) pra não ser bundlado e não virar ruído no build.
- Os novos helpers em `endpoints.ts` seguem o padrão atual (`proposalSubpath`) — funções puras, sem fetch.
- O teste de conexão expandido continua usando `nomusFetch` + `BasicAuth`, sem mudar contrato com a UI: `testNomusConnection` ainda devolve `{ success, message, details }`, só que `details` ganha um array `probes[]` com o resultado por recurso.
- Tela de Integração Nomus (`/app/configuracoes/nomus`) já mostra `details` cru — vai exibir os 3 probes automaticamente, sem mudança de UI.

## Resumo da entrega

Após aplicar:
- documento `docs/nomus-endpoints.md` consolidando tudo
- `endpoints.ts` com processos, contas a receber, contatos por pessoa e sub-recursos de NFe
- teste de conexão multi-recurso, mostrando status por endpoint
- base pronta pra você colar o JSON real de uma proposta e a gente fechar o mapeamento campo a campo

