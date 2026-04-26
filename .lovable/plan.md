Plano atualizado — Tooltips técnicos do ColdPro com dicionário completo

Objetivo: corrigir os tooltips de ajuda técnica do ColdPro para que todos os textos apareçam completos, sem cortes, centralizados em um dicionário único e legíveis em desktop e mobile.

Escopo permitido:
- `src/modules/coldpro/core/fieldHelpTexts.ts`
- `src/modules/coldpro/components/FieldHelpTooltip.tsx`
- `src/modules/coldpro/components/FormFieldWithHelp.tsx`
- `src/components/coldpro/ColdProTunnelForm.tsx`, apenas para ajustar chamadas de tooltip
- Se necessário para compatibilidade das chamadas existentes, ajustar `src/components/coldpro/ColdProField.tsx` para aceitar ajuda opcional sem alterar o comportamento atual

Não alterar:
- CRM
- Nomus
- propostas
- sincronização
- seleção de equipamentos
- cálculo térmico
- migrations
- módulos fora do ColdPro

1. Criar o dicionário central `fieldHelpTexts.ts`

Criar `src/modules/coldpro/core/fieldHelpTexts.ts` com:
- `DEFAULT_FIELD_HELP`
- `COLDPRO_FIELD_HELP`
- `getColdProFieldHelp(key)`
- `validateColdProHelpTexts()`
- `console.warn` em ambiente de desenvolvimento caso existam textos problemáticos

Usar exatamente o pacote completo de textos técnicos enviado, incluindo todas as chaves:
- `tunnelType`
- `arrangementType`
- `physicalModel`
- `operationRegime`
- `productGeometry`
- `surfaceExposureModel`
- `measurementScale`
- `productLength`
- `productWidth`
- `productHeight`
- `productThickness`
- `productDiameter`
- `productSide`
- `characteristicDimension`
- `distanceToCore`
- `boxLength`
- `boxWidth`
- `boxHeight`
- `bulkLayerHeight`
- `equivalentParticleDiameter`
- `palletLength`
- `palletWidth`
- `palletHeight`
- `palletMassKg`
- `numberOfPallets`
- `staticMassKg`
- `batchTime`
- `blockExposureFactor`
- `massKgHour`
- `unitWeightKg`
- `unitsPerCycle`
- `cyclesPerHour`
- `calculatedMassKgH`
- `usedMassKgH`
- `retentionTime`
- `initialProductTemp`
- `finalProductTemp`
- `airTemp`
- `suggestedAirTemp`
- `approachAirSuggested`
- `airTempDifference`
- `freezingPoint`
- `specificHeatAbove`
- `specificHeatBelow`
- `latentHeat`
- `frozenWaterFraction`
- `density`
- `thermalConductivityFrozen`
- `thermalPenetrationFactor`
- `airflowSource`
- `airVelocity`
- `airVelocityUsed`
- `fanAirflow`
- `estimatedAirflow`
- `informedAirflow`
- `tunnelCrossSectionWidth`
- `tunnelCrossSectionHeight`
- `grossAirArea`
- `blockageFactor`
- `freeAirArea`
- `calculatedAirVelocity`
- `airDeltaT`
- `manualConvectiveCoefficient`
- `airExposureFactor`
- `hBase`
- `hEffective`
- `hSource`
- `packagingType`
- `packagingMass`
- `packagingCp`
- `beltMotorPower`
- `internalFansPower`
- `otherInternalLoads`
- `specificEnergyTotal`
- `sensibleAbove`
- `latent`
- `sensibleBelow`
- `productLoad`
- `packagingLoad`
- `internalLoad`
- `totalLoadKW`
- `totalLoadKcalH`
- `totalLoadTR`
- `freezingTime`
- `availableTime`
- `processStatus`
- `technicalWarnings`
- `simulatedAirTemp`
- `simulatedAirVelocity`
- `simulatedAirflow`
- `minTemperatureLimit`
- `maxTemperatureLimit`
- `temperatureStep`
- `minVelocityLimit`
- `maxVelocityLimit`
- `velocityStep`
- `applySimulation`
- `resetSimulation`
- `productTabComparison`

Regras do arquivo:
- Usar template strings com crase para textos longos.
- Não usar conteúdo truncado.
- Não usar `...` como substituição de texto técnico.
- Não deixar textos inline longos dentro do JSX.
- A validação deve apenas alertar no console, sem quebrar o build.

2. Criar/ajustar `FieldHelpTooltip.tsx`

Criar `src/modules/coldpro/components/FieldHelpTooltip.tsx` com suporte a:
- `title`
- `content`
- `content` como string ou array de strings
- múltiplos parágrafos
- quebras de linha
- listas simples quando aplicável
- fallback via `DEFAULT_FIELD_HELP`

Configuração visual obrigatória do `TooltipContent`:

```tsx
<TooltipContent className="z-[9999] max-w-[calc(100vw-32px)] sm:max-w-[520px] max-h-[70vh] overflow-y-auto whitespace-normal break-words text-left leading-relaxed">
  {title && <div className="mb-1 font-semibold">{title}</div>}
  <div>{content}</div>
</TooltipContent>
```

Também garantir:
- sem `truncate`
- sem `line-clamp`
- sem `overflow-hidden` no texto
- `z-[9999]` para ficar acima de cards/inputs
- uso do portal padrão do Tooltip/Radix para evitar corte por containers pai
- hover em desktop e tap/click em mobile pelo comportamento padrão do componente

3. Criar/ajustar `FormFieldWithHelp.tsx`

Criar `src/modules/coldpro/components/FormFieldWithHelp.tsx` para compor:
- label completo sem corte
- ícone de ajuda ao lado do label
- tooltip sem empurrar o input
- layout flexível em grid/card/accordion
- fallback para `DEFAULT_FIELD_HELP` se uma chave não existir

4. Integrar no `ColdProTunnelForm.tsx`

Ajustar chamadas dos principais campos para usar o dicionário central:

Exemplo esperado:

```tsx
help={COLDPRO_FIELD_HELP.approachAirSuggested}
```

ou, se for usada chave:

```tsx
helpKey="approachAirSuggested"
```

Não usar:

```tsx
help={{ content: "texto técnico longo..." }}
```

Campos prioritários para receber ajuda:
- Tipo de túnel
- Tipo de arranjo
- Modelo físico aplicado
- Regime calculado
- Geometria do produto
- Modelo de exposição
- Escala das medidas
- Todas as dimensões do produto/caixa/pallet/bloco
- Massa por pallet/lote
- Número de pallets/lotes
- Massa kg/h
- Peso unitário
- Unidades por ciclo
- Ciclos por hora
- Tempo de retenção
- Tempo de batelada
- Temperaturas
- Cp acima/abaixo
- Calor latente
- Fração congelável
- Densidade
- Condutividade congelada
- Fator de penetração térmica
- Fonte da velocidade
- Velocidade do ar
- Vazão dos ventiladores
- Largura/altura da seção
- Fator de bloqueio
- ΔT do ar
- Coeficiente convectivo manual
- Embalagem, Cp embalagem e cargas internas
- Cards de resultado principais, se o componente aceitar ajuda sem poluir o layout

5. Compatibilidade com `ColdProField`

Se for mais limpo, adicionar props opcionais em `ColdProField`:
- `help?: { title: string; content: string | string[] }`
- ou `helpKey?: keyof typeof COLDPRO_FIELD_HELP | string`

Isso mantém as chamadas existentes funcionando e permite incluir o ícone de ajuda ao lado do label sem criar wrappers em todos os pontos.

6. Validação final

Rodar:
- `bunx tsc --noEmit`
- `bun run build`

Corrigir qualquer erro de TypeScript/build.

Critérios de aceite

- Nenhum texto de tooltip aparece cortado.
- Nenhum tooltip usa ellipsis, truncate ou line-clamp.
- Tooltips aceitam textos longos e múltiplos parágrafos.
- Tooltips têm largura adequada em desktop e mobile.
- Tooltips usam `max-w-[calc(100vw-32px)] sm:max-w-[520px]`.
- Tooltips usam `max-h-[70vh] overflow-y-auto`.
- Tooltips ficam acima de cards e inputs com `z-[9999]`.
- Textos principais estão centralizados em `fieldHelpTexts.ts`.
- `ColdProTunnelForm.tsx` referencia o dicionário/chaves em vez de textos longos inline.
- O pacote completo de textos fornecido está preservado sem cortes.
- Typecheck passa.
- Build passa.