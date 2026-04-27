Plano para melhorar a apresentação da tela ColdPro sem alterar cálculos ou backend:

1. Corrigir o efeito de “zoom”/aperto visual na página `app.coldpro.$id.tsx`
   - Reduzir densidade visual onde necessário.
   - Melhorar espaçamentos, largura máxima e comportamento responsivo.
   - Evitar que blocos grandes pareçam comprimidos em telas médias.

2. Ajustar os blocos novos de resultado
   - Revisar `EnergySummary.tsx` e `EquipmentOptimizationSummary.tsx` para usar cards e tabelas mais compactos e limpos.
   - Garantir que tabelas tenham rolagem horizontal controlada, sem estourar a tela.
   - Manter fallback “—” para dados ausentes.

3. Preservar escopo funcional
   - Não alterar motor térmico, COP, energia mensal, otimizador, banco, rotas de backend, adapters ou dados.
   - Não recalcular nenhum valor no frontend.

4. Validar
   - Executar typecheck/build.
   - Verificar visualmente a página em viewport semelhante à atual para confirmar que a apresentação ficou mais confortável e sem aparência de zoom excessivo.