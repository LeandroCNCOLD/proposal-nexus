## Objetivo

Criar uma tela dedicada de **Status da Integração Nomus**, mostrando, módulo a módulo, como cada sync está hoje: quando rodou pela última vez, quanto tempo levou, quantos registros entraram e quantos erros aconteceram nas últimas execuções.

Hoje essa informação existe espalhada na tela `Configurações → Nomus` (mistura ações de sincronizar com logs crus). A nova tela é **só leitura**, focada em diagnóstico, e responde de relance: "está tudo verde?".

## Onde fica

- Nova rota: `/app/configuracoes/nomus/status` (arquivo `src/routes/app.configuracoes.nomus.status.tsx`).
- Botão "Ver status detalhado" no topo da página atual `Configurações → Nomus`.
- Item no menu lateral de Configurações (se houver submenu Nomus).

## O que aparece na tela

### 1. Cabeçalho — visão geral (4 cards)
- **Módulos OK** (verde) / **Com aviso** (amarelo) / **Com erro** (vermelho) — contadores.
- **Última sincronização global** (timestamp do log mais recente, qualquer entidade).
- **Total de registros sincronizados nas últimas 24h** (soma do contador de logs `status=success`).
- **Erros nas últimas 24h** (count de logs `status=error`).

### 2. Grid por módulo (1 card por entidade)

Entidades cobertas (mesmas do array `ENTITIES` da tela atual, mais `tabelas_preco`):
Clientes, Produtos/Equipamentos, Condições de pagamento, Vendedores, Representantes, Propostas, Pedidos, Notas Fiscais, Tabelas de Preço.

Cada card mostra:

```text
┌─────────────────────────────────────────────────┐
│ ● Clientes                          [Sincronizar]│   ← bolinha de status (verde/amarelo/vermelho)
├─────────────────────────────────────