

## Corrigir integração com o Nomus

Você me passou a URL real: `https://cncold.nomus.com.br/cncold/rest`. Combinada com a chave que apareceu na tela do ERP (`aW50ZWdyYWRvcmVycDppTFBrSnRMY1p3WjdLUks=`), agora dá pra fechar a configuração.

## Diagnóstico

- `NOMUS_BASE_URL` está com a **chave** salva (string base64), por isso todo fetch quebra com "Failed to parse URL".
- `NOMUS_API_KEY` provavelmente está vazia ou incorreta.
- O código (`src/integrations/nomus/client.ts`) está correto — manda a chave no header `Authorization` sem prefixo, que é o padrão do Nomus.

## O que vou fazer (após aprovação)

### 1. Atualizar os secrets do Lovable Cloud
- `NOMUS_BASE_URL` → `https://cncold.nomus.com.br/cncold/rest`
- `NOMUS_API_KEY` → `aW50ZWdyYWRvcmVycDppTFBrSnRMY1p3WjdLUks=`

### 2. Hardening defensivo no client (1 arquivo)
Em `src/integrations/nomus/client.ts`, ajustar `getNomusBaseUrl()` para detectar quando alguém colar uma chave no campo da URL e devolver mensagem clara:
> "NOMUS_BASE_URL parece ser uma chave de API, não uma URL. Mova esse valor para NOMUS_API_KEY."

Heurística: se o valor não contém `://` ou parece base64/credencial (`user:pass`), erro descritivo.

### 3. Validar a conexão
- Chamar `GET /api/nomus/test` e confirmar `success: true`.
- Se falhar, ler `nomus_sync_log` e ajustar.

### 4. Rodar sync inicial
Disparar sync de `clientes`, `propostas`, `pedidos` e `notas_fiscais` via tela **Configurações → Nomus**, e conferir no banco que `nomus_proposals`, `clients`, `nomus_pedidos`, `nomus_invoices` populam.

### 5. Conferir o frontend
- `/app/propostas` deve listar dados reais automaticamente.
- Se algum campo do payload do Nomus não estiver mapeado corretamente nos `mappers` do `src/routes/hooks/nomus-cron.ts`, ajustar pontualmente — mas só depois de ver o `raw` real chegando no banco (não dá pra adivinhar antes).

## O que NÃO será alterado

- Nenhuma tabela do banco, edge function de IA, tela de propostas, fluxo de envio, criação de pedido ou mapeamento prévio sem evidência do payload real.

## Resumo da entrega

Após aplicar:
- secrets corrigidos
- `client.ts` com mensagem de erro defensiva
- relatório do `testNomusConnection` (status + corpo)
- contagem de registros sincronizados por entidade
- se houver campo desalinhado, lista do que precisa ser ajustado nos mappers (etapa separada, com base no `raw` real)

