

# Análise: Configurações Nomus vs. Integração Atual

## O que a tela do Nomus mostra

A tela é a configuração do ERP **dentro do Nomus** (não do nosso sistema). Pontos relevantes:

| Configuração no Nomus | Valor atual | Impacto na nossa integração |
|---|---|---|
| **Chave de acesso REST** | `aW50ZWdyYWRvcmVycDppTFBrSnRMY1p3WjdLUks=` | É a chave que usamos como `NOMUS_API_KEY` (Basic Auth). **Confere com a que você enviou.** |
| Integração via SOAP | Não | OK — usamos REST |
| Seleção de ERP por SOAP | (vazio) | OK — irrelevante |
| **Autenticação da Integração Habilitada** | **Não** | ⚠️ Precisa verificar — ver abaixo |
| Data para buscar registros (dias para trás) | 0 | Limita o que a API retorna (ver abaixo) |
| Intervalo de busca | 5 min | OK — só afeta cron |
| Bloqueio de campos de pedidos da integração | Sim | OK |
| **URL de acesso ao webservice ERP** | (vazio) | Esse campo é para SOAP/ERP externo, **não** afeta nossa REST |
| Habilitar criação/edição de pedidos no Nomus mesmo com Alterdata | Não | Só relevante se houver Alterdata |

## Diagnóstico do problema atual

A chave **bate** com `aW50ZWdyYWRvcmVycDppTFBrSnRMY1p3WjdLUks=` (decodificada: `integradorerp:iLPkJtLcZwZ7KRK`). Os erros vinham de questões diferentes (Seroval/serverFn ID), agora resolvidos.

**Dois pontos da tela do Nomus que merecem ação:**

1. **"Autenticação da Integração Habilitada = Não"** — Em algumas versões do Nomus, esse toggle define se a chave REST acima será exigida. Se estiver "Não", a API pode aceitar sem auth (ou rejeitar tudo). Vale conferir com o suporte Nomus qual o comportamento esperado e, se for o caso, **mudar para "Sim"**.

2. **"Data para buscar registros (dias para trás) = 0"** — Em alguns endpoints isso significa "trazer só do dia atual", deixando `/propostas` retornar vazio. Recomendo **aumentar para 30 ou 90 dias** pelo menos para a sincronização inicial.

## O que NÃO precisa mudar no nosso sistema

- A chave Basic Auth está correta no formato (`Authorization: Basic <chave>`)
- A `NOMUS_BASE_URL` deve apontar para a URL REST do Nomus (algo como `https://<empresa>.nomus.com.br/nomusweb/integracaoErp` — confirme com o suporte; **não** é o "URL de acesso ao webservice ERP" da tela, que é para SOAP de saída)
- O fluxo de pull (clientes, vendedores, propostas, itens) já está mapeado

## Ações recomendadas

### Do seu lado, no Nomus (tela do print):
1. Mudar **"Autenticação da Integração Habilitada"** para **Sim** (confirmar com suporte Nomus)
2. Aumentar **"Data para buscar registros"** para **30** ou **90** dias
3. Salvar

### Do meu lado (após confirmação):
1. Rodar **Buscar do Nomus** novamente
2. Inspecionar a primeira linha de `nomus_proposals.raw` (e `nomus_sync_log`) para confirmar nomes reais dos campos JSON e ajustar os `pickStr/pickNum` se necessário (ex.: `valorTotal` vs `valor_total`, `idCliente` vs `cliente.id`)
3. Validar que o `NOMUS_BASE_URL` cadastrado é a URL correta da REST do Nomus (caminho `integracaoErp`)

## Próximo passo sugerido

Confirme dois pontos para eu seguir:
- Qual o valor atual de `NOMUS_BASE_URL`? (pode colar aqui — não é segredo)
- Você consegue ajustar os 2 campos no Nomus (autenticação habilitada + dias para trás)?

Com isso eu rodo o sync e mostro o que voltou no `raw` para fecharmos o mapeamento de campos.

