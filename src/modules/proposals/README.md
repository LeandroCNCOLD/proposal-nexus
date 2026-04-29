# Módulo de propostas

Este módulo é o ponto de organização do sistema de propostas da CN COLD. A migração deve ser incremental e sem quebra de rotas existentes.

## Estrutura

- `screens/`: telas e composições de rota relacionadas a propostas.
- `components/`: componentes visuais reutilizáveis e sem regra de negócio pesada.
- `services/`: chamadas de API, funções de persistência e orquestração de dados.
- `types/`: tipos TypeScript de domínio, DTOs e contratos.
- `templates/`: editor, modelos, blocos e utilitários de templates.
- `approval/`: regras, serviços e tipos de aprovação por alçada.
- `financial/`: cálculos financeiros, tributários e análise econômica.

## Regras

Componentes React não devem conter cálculo financeiro, tributário ou térmico. Essas regras devem ficar em `financial/`, `services/` ou módulos puros equivalentes.