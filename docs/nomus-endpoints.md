# Nomus REST API — Endpoints CNCode

Documento de referência da integração CNCode ↔ Nomus ERP.
Fonte única de verdade humana — para o mapa programático, ver `src/integrations/nomus/endpoints.ts`.

---

## 1. Base da API

**Base URL (ambiente CNCold):**

```
https://cncold.nomus.com.br/cncold/rest
```

**Headers obrigatórios em toda requisição:**

```
Authorization: Basic {{chave-integracao-rest}}
Content-Type:  application/json
Accept:        application/json
```

A `chave-integracao-rest` é gerada na tela de **API REST** do Nomus e já vem codificada em base64 (formato `usuario:senha` codificado). Não precisa codificar de novo — basta prefixar com `Basic `.

**Paginação:**

- Parâmetro: `?pagina=N` (1-indexado).
- Limite fixo: **50 registros por página** (definido pelo Nomus, não configurável).
- Última página retorna lista vazia ou com menos de 50 itens.

**Filtros:**

- Parâmetro: `?query=campo=valor` (sintaxe própria do Nomus).
- Exemplo: `?query=nome=Empresa XYZ`.

**Throttling:**

- Status `429 Too Many Requests` indica rate limit.
- Header de resposta `tempoAteLiberar` (em segundos) indica quanto esperar.
- O cliente HTTP do CNCode (`nomusFetch`) já trata isso automaticamente com retry.

---

## 2. Endpoints utilizados pelo CNCode

> ⭐ **Propostas é a fonte principal.** Os demais recursos são complementares e existem para enriquecer o que o payload de proposta não trouxer detalhado o suficiente.

| # | Recurso | Método + URL | Finalidade no CNCode | Status |
|---|---------|--------------|----------------------|--------|
| 2.1 | **Propostas** ⭐ | `GET /propostas`<br/>`GET /propostas/{id}` | Origem oficial da proposta. Preenche template, gera PDF, controla revisões/envio. | Validado em ambiente |
| 2.2 | **Clientes** | `GET /clientes`<br/>`GET /clientes/{id}`<br/>`GET /clientes?query=nome=...` | CNPJ, endereço, segmento, vendedor responsável. Preenche cabeçalho da proposta. | Oficial documentado |
| 2.3 | **Contatos** | `GET /pessoas/{idPessoa}/contatos` | E-mail, telefone, cargo do contato comercial. Usado no envio e follow-up. | Oficial documentado |
| 2.4 | **Produtos** | `GET /produtos`<br/>`GET /produtos/{id}`<br/>`GET /produtos?query=codigo=...` | Descrição técnica/comercial dos itens. Vincula item ERP ao banco técnico do CNCode. | Oficial documentado |
| 2.5 | **Representantes** | `GET /representantes`<br/>`GET /representantes/{id}` | Representante da negociação, comissão, carteira. | Oficial documentado |
| 2.6 | **Vendedores** | `GET /vendedores`<br/>`GET /vendedores/{id}` | Vendedor interno responsável pela proposta. | Oficial documentado |
| 2.7 | **Condições de Pagamento** | `GET /condicoesPagamentos`<br/>`GET /condicoesPagamentos/{id}` | Catálogo de condições para selecionar na proposta. | Oficial documentado |
| 2.8 | **Tabelas de Preço** | `GET /tabelasPreco`<br/>`GET /tabelasPreco/{id}` | Política comercial, preço base aplicado. | Oficial documentado |
| 2.9 | **Processos / CRM** | `GET /processos`<br/>`GET /processos/{id}`<br/>`POST /processos` | Espelhar pipeline ou registrar lead. **Módulo complementar** — CNCode segue como sistema principal de proposta. | A confirmar no ambiente |
| 2.10 | **Pedidos** | `GET /pedidos`<br/>`GET /pedidos/{id}`<br/>`POST /pedidos` | Converte proposta ganha em pedido de venda no ERP. | Oficial documentado |
| 2.11 | **Notas Fiscais (NFe)** | `GET /nfes`<br/>`GET /nfes/{id}`<br/>`GET /nfes/danfe/{id}`<br/>`GET /nfes/cce/{id}` | Status de faturamento, DANFE em PDF, carta de correção. Fecha o ciclo proposta → pedido → NF. | Oficial documentado |
| 2.12 | **Contas a Receber** | `GET /contasReceber`<br/>`GET /contasReceber/{id}`<br/>`GET /contasReceber?query=idPessoaCliente=...` | Inadimplência, cruzamento de venda × recebimento. Módulo financeiro opcional. | Oficial documentado |

---

## 3. Diagnóstico de conectividade

O CNCode expõe um teste multi-recurso em:

```
GET /api/nomus/test
```

Esse teste bate em sequência nos 3 recursos mais críticos (`/clientes`, `/representantes`, `/propostas`) e devolve o status individual de cada um. Isso permite distinguir três classes de problema:

- **Todos falham com 401/403** → problema de autenticação (chave inválida ou inativa).
- **Todos falham com erro de rede** → problema de URL base ou de conectividade.
- **Apenas alguns falham** → permissão por recurso desabilitada para essa chave no Nomus.

A saída tem o formato:

```json
{
  "success": true,
  "message": "...",
  "probes": [
    { "entity": "clientes",       "status": 200, "ok": true,  "durationMs": 412 },
    { "entity": "representantes", "status": 200, "ok": true,  "durationMs": 387 },
    { "entity": "propostas",      "status": 400, "ok": false, "durationMs": 290, "error": "..." }
  ]
}
```

---

## 4. Próximo passo — mapeamento de proposta

Para fechar o mapeamento campo a campo `Nomus → template CNCode`, é necessário um **JSON real** retornado por:

```
GET /propostas/{id}
```

O payload pode (e deve) vir mascarado, mas precisa preservar:

- estrutura de objetos aninhados (cliente, itens, condições, impostos);
- nomes exatos dos campos;
- tipos (string, number, boolean, array).

Com isso em mãos, será criada a tabela `Nomus → CNCode` em `docs/nomus-proposal-mapping.md` e os mappers em `src/routes/hooks/nomus-cron.ts` serão ajustados conforme necessário.
