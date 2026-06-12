## Débito técnico — simulation.functions.ts

### Problema
Função de persistência da simulação dinâmica ColdPro
usa nomes camelCase antigos que não batem com
ColdRoomSimulationSummary (snake_case atual).

### Arquivos afetados
- src/features/coldpro/simulation.functions.ts
  linhas ~111-138 (insert)
  linhas ~157+ (listSimulations/getLatestSimulation)

### O que precisa
Rewrite completo do bloco .insert() e .select()
mapeando os novos nomes:
- simResult.summary.maxInternalTempC → max_room_temperature_c
- avgCop → average_cop
- equipmentAdequacy → capacity_adequate (boolean)
- hoursAboveSetpoint → temperature_out_of_range_hours
- simResult.timeSteps → result.timeline / chart_data
- compressorOnHours → compressor_runtime_hours
- compressorOnPercent → compressor_runtime_pct

### Prioridade
Média — simulação dinâmica ainda funciona
visualmente, só não persiste os resultados.

### Estimativa
2-3 horas de trabalho focado.

---

## Débito técnico — src/modules/sdr/services.ts (4 erros TS)

### Problema
Após a reconciliação main↔lovable-sync (merge do types.ts +
port de modules/sdr), o arquivo `services.ts` (portado de
lovable-sync) tem 4 erros de tipo envolvendo o tipo `CrmPipeline`
vs o schema gerado do Supabase. É o mesmo padrão de débito que
o antigo `modules/crm/services.ts` já tinha (34 erros, removido
nesta reconciliação).

### Arquivos afetados
- src/modules/sdr/services.ts:59 — conversão de tipo para
  `CrmPipeline` sem overlap suficiente (falta `days_without_contact`)
- src/modules/sdr/services.ts:167 — `.update()` não casa com
  overload (Partial<CrmPipeline> vs RejectExcessProperties)
- src/modules/sdr/services.ts:171 — mesma conversão de tipo do :59
- src/modules/sdr/services.ts:177 — `.update({[field]: ...})`
  dinâmico não casa com índice de tipo esperado

### O que precisa
Ajustar `CrmPipeline` (em `modules/sdr/types.ts`) para incluir
`days_without_contact` no shape retornado pela query, e tipar
os updates dinâmicos com `as any`/cast explícito ou um tipo
auxiliar `Partial<Database["public"]["Tables"]["crm_pipeline"]["Update"]>`.

### Prioridade
Baixa — não bloqueia funcionalidade, é checagem de tipo estática.

### Estimativa
1-2 horas de trabalho focado.

---

## RESOLVIDO — Build: conflito @tiptap peer-deps

### Problema (original)
npm run build falhava com:
'getStyleProperty' is not exported by '@tiptap/core',
imported by '@tiptap/extension-text-style'

### Causa
@tiptap/core estava em ^2, mas @tiptap/extension-color,
@tiptap/extension-font-family e @tiptap/extension-text-style
estavam em ^3.22.4 (conflito de versões major dentro do
próprio ecossistema @tiptap), pré-existente antes desta
reconciliação.

### Solução aplicada
A correção sugerida originalmente (subir @tiptap/core para ^3)
não era viável: as demais extensões @tiptap (extension-image,
extension-link, extension-mention, starter-kit, etc.) exigem
@tiptap/core ^2.x. Em vez disso, as 3 extensões divergentes
foram rebaixadas para a v2, alinhando com o restante do
ecossistema:

npm install @tiptap/extension-color@^2.27.2 \
  @tiptap/extension-font-family@^2.27.2 \
  @tiptap/extension-text-style@^2.27.2 \
  --save --legacy-peer-deps

Build de produção verificado com sucesso após a alteração.

### Bug adicional encontrado e corrigido
Após resolver o conflito do tiptap, o build revelou um segundo
erro bloqueante não relacionado: src/features/coldpro/simulation.functions.ts
importava `runColdRoomSimulation`, mas a função exportada por
coldRoomDynamicSimulationService.ts é `runColdRoomDynamicSimulation`.
Import e chamada corrigidos.
Resolver antes do próximo deploy.

### Estimativa
30 minutos.
