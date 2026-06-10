# ColdPro — Arquitetura do módulo

> Módulo de dimensionamento técnico de câmaras frias, túneis de
> congelamento e sistemas de refrigeração industrial, com geração de
> memorial de cálculo e integração com propostas comerciais.
>
> ~23.500 linhas / 113 arquivos distribuídos em 5 camadas.

## Visão geral das camadas

```
src/routes/app.coldpro.*.tsx        → Rotas/páginas (UI de topo)
src/components/coldpro/             → Formulários e cards do wizard
src/features/coldpro/                → Orquestração, tipos e motor de cálculo principal  ◄── você está aqui
src/modules/coldpro/                 → Motores físicos, simulação, gráficos, adapters DB
src/integrations/coldpro/            → Geração de PDF do memorial técnico
```

## Fluxo de dados (ponta a ponta)

```
app.coldpro.index.tsx (lista de projetos)
   └─> app.coldpro.$id.tsx (wizard com Stepper)
         ├─ ColdProEnvironmentForm / ColdProTunnelForm /
         │  ColdProProductForm / ColdProExtraLoadsForm
         │     └─ adapters/formToTunnelInput.ts
         │           → coldpro-calculation.engine.ts (câmaras/túneis)
         │           → modules/coldpro/engines/tunnelEngine.ts (túneis - motor com cobertura de teste)
         │           → modules/coldpro/services/continuousGirofreezerService.ts (giro-freezer contínuo)
         ├─ ColdRoomSimulationTab → useColdRoomSimulation.ts
         │     → modules/coldpro/simulation/services/coldRoomDynamicSimulationService.ts
         ├─ ColdProResultCard / ColdProProjectResultDashboard
         │     (gráficos: src/modules/coldpro/components/charts/*)
         ├─ ColdProAIInsightPanel → modules/coldpro/ai/projectRecommendationBuilder.ts
         └─ ColdProReport / ColdRoomFinalReportTab
               → src/integrations/coldpro/coldproMemorialPdfLib.ts (PDF)
```

Persistência via `modules/coldpro/adapters/{formToTunnelInput,
tunnelInputToDatabasePayload, databaseToTunnelInput}.ts`, gravando nas
tabelas `coldpro_projects`, `coldpro_environments`, `coldpro_tunnels`,
`coldpro_results`, `coldpro_simulations`, `coldpro_equipment_*`, etc.
(28 tabelas `coldpro_*` no Supabase, 22 em uso ativo).

## Onde está "a fonte da verdade" de cada cálculo?

O módulo tem **3 motores de cálculo**, cada um com escopo próprio —
isso já causou confusão de tipos no passado, então a regra é:

| Motor | Local | Escopo | Status |
|---|---|---|---|
| `coldpro-calculation.engine.ts` | `src/features/coldpro/` | Carga térmica de câmaras/ambientes e processo térmico de túneis (cp, calor latente, infiltração agregada, etc.) | ✅ Ativo — motor principal usado pelo wizard e pelo memorial PDF |
| `tunnelEngine.ts` | `src/modules/coldpro/engines/` | Dimensionamento físico do túnel (geometria, arranjo, ar, congelamento por Plank) | ✅ Ativo — único motor com teste unitário (`tunnelEngine.test.ts`) |
| `continuousGirofreezerService.ts` | `src/modules/coldpro/services/` | Giro-freezer contínuo (regime permanente, balanço de massa contínuo) | ✅ Ativo — usado por `ColdProTunnelForm.tsx` para o modo "contínuo" |
| `thermal-calculations.ts` | `src/features/coldpro/` | Tabelas/constantes de referência (perfil de operação, proteção de porta, clima) usadas no preview de cargas extras | ✅ Ativo (suporte) — usado por `extra-loads-preview.ts` e `ColdProExtraLoadsForm.tsx` |
| ~~`src/lib/coldpro/*`~~ | — | Resíduo de refatoração antiga | ❌ Removido (0 imports) |

**Regra prática**: para *novas* funcionalidades de cálculo de carga
térmica de ambiente/produto, usar `coldpro-calculation.engine.ts`. Para
cálculos específicos de geometria/aerodinâmica de túnel, usar
`modules/coldpro/engines/tunnelEngine.ts` (e adicionar teste em
`tunnelEngine.test.ts`). Não recriar um motor paralelo em `src/lib/`.

## Tipos compartilhados

Os tipos centrais (`ColdProEnvironmentProduct`, `ColdProTunnel`, etc.)
vivem em `src/features/coldpro/coldpro.types.ts` e são reexportados via
`src/features/coldpro/index.ts`. Campos opcionais usados pelos motores
(ex.: `latentMode?: "effective" | "full" | null`) devem ser declarados
ali e replicados nos tipos de parâmetros internos dos motores em
`modules/coldpro/physics/*` quando aplicável, para manter consistência.

## Processos avançados

`src/features/coldpro/advancedProcesses/` contém serviços específicos
para atmosfera controlada, CO₂, etileno, umidade de sementes, etc. —
camada adicional acima do cálculo de carga base, acionada pelo
`ColdProAdvancedProcessForm.tsx`.

## Tabelas `coldpro_*` sem uso no código (roadmap / a decidir)

`coldpro_booster_models`, `coldpro_climate_cache`, `coldpro_materials`,
`coldpro_refrigerant_properties`, `coldpro_report_settings`,
`coldpro_wall_compositions` — todas com 0 linhas. Avaliar se devem ser
implementadas, removidas ou documentadas como roadmap futuro antes de
criar novas tabelas com propósito semelhante.

## Testes

Único arquivo de teste do módulo: `modules/coldpro/engines/tunnelEngine.test.ts`.
Para qualquer correção em motores físicos
(`tunnelEngine.ts`, `coldpro-calculation.engine.ts`,
`continuousGirofreezerService.ts`, `infiltrationCalculator.ts`),
considerar adicionar um teste de regressão correspondente — esses
cálculos definem o dimensionamento de equipamento real vendido ao
cliente.
