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
