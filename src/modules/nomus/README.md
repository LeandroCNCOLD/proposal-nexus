# Módulo Nomus

Este módulo centraliza a integração com o Nomus e deve ser usado como fronteira entre dados externos e o domínio interno da aplicação.

## Estrutura

- `services/`: clientes, sincronizações e operações de API.
- `types/`: tipos dos payloads externos e contratos normalizados.
- `mappers/`: conversões entre formato Nomus e formato interno.

## Regras

Conversões de dados do Nomus devem ficar em `mappers/`. Telas e componentes não devem conhecer detalhes do payload bruto quando existir um tipo normalizado.