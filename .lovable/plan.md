Vou corrigir a carga térmica baixa mantendo o escopo restrito ao módulo ColdPro e preservando o comportamento visual/funcional, exceto pela correção do cálculo.

Diagnóstico encontrado
- O resultado exibido mostra energia específica de apenas 23,8 kJ/kg e calor latente 0 kJ/kg.
- Para o cenário informado, isso indica que o motor não está entrando no ramo de congelamento com mudança de fase.
- A causa provável está na regra atual: `crossesFreezingPoint = initialTempC > freezingPointC && finalTempC < freezingPointC`.
- Para produtos como sorvete, o catálogo usa ponto inicial de congelamento por volta de -2,5°C a -5,6°C. Se a temperatura final informada estiver acima desse ponto, o motor calcula apenas carga sensível acima do congelamento e ignora calor latente, resultando em carga muito baixa.
- Além disso, `frozen_water_fraction` está nulo no catálogo de sorvetes; a tela calcula fallback local para exibição/simulador, mas o adaptador oficial `formToTunnelInput` envia zero quando o campo está nulo, o que também pode impedir carga latente/tempo estimado em cenários de congelamento.

Plano de implementação

1. Corrigir normalização térmica no adaptador
- Atualizar `src/modules/coldpro/adapters/formToTunnelInput.ts` para normalizar `frozenWaterFraction` com fallback coerente:
  - usar `frozen_water_fraction` quando > 0;
  - senão usar `freezable_water_content_percent / 100` quando > 0;
  - senão usar `water_content_percent / 100` quando > 0;
  - senão usar fallback técnico conservador já adotado pela tela, sem alterar fórmulas principais.
- Aplicar a mesma regra em `databaseToTunnelInput.ts`, para cálculos salvos/recarregados não voltarem a zerar a fração congelável.

2. Corrigir critério de mudança de fase do produto
- Atualizar `src/modules/coldpro/physics/productThermal.ts` para usar tipos oficiais em vez de `any`.
- Ajustar a detecção de carga latente para reconhecer congelamento quando houver redução térmica em direção a temperaturas de congelamento/subcongelamento e `allowPhaseChange !== false`, sem depender exclusivamente de `finalTempC < freezingPointC`.
- Manter a fórmula de energia igual quando há mudança de fase:
  - sensível acima = `Cp acima × max(Tentrada - Tcongelamento, 0)`
  - latente = `calor latente × fração congelável`
  - sensível abaixo = `Cp abaixo × max(Tcongelamento - Tfinal, 0)`
- Isso deve fazer o cenário de sorvete sair de ~23,8 kJ/kg para uma energia específica compatível com congelamento, incluindo latente.

3. Preservar validações e mensagens técnicas
- Ajustar `productLoadMissingFields` e campos obrigatórios, se necessário, para exigir calor latente/fração congelável quando o motor classificar o processo como mudança de fase.
- Não alterar layout, sequência das etapas, textos principais nem persistência fora do necessário.

4. Adicionar cobertura de teste para o erro reportado
- Criar/atualizar teste em `src/modules/coldpro/engines/tunnelEngine.test.ts` com cenário semelhante ao da tela:
  - massa 2.000 kg;
  - 8 h;
  - sorvete/bloco/pallet;
  - entrada positiva ou resfriada, final típica de congelado;
  - ponto de congelamento de sorvete;
  - calor latente e fração congelável.
- Validar que:
  - `latentKJkg > 0`;
  - `totalKJkg` não fica limitado ao sensível acima;
  - `productLoadKW` fica coerente e significativamente maior que o valor atual incorreto;
  - campos faltantes não acusam fração congelável quando fallback válido existir.

5. Verificação final
- Executar:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
- Conferir que o módulo ColdPro continua sem `any` novo no caminho alterado e que os contratos tipados continuam consistentes.

Arquivos previstos
- `src/modules/coldpro/physics/productThermal.ts`
- `src/modules/coldpro/adapters/formToTunnelInput.ts`
- `src/modules/coldpro/adapters/databaseToTunnelInput.ts`
- `src/modules/coldpro/engines/tunnelEngine.ts` apenas se for necessário alinhar validações/missing fields
- `src/modules/coldpro/engines/tunnelEngine.test.ts`

Critério de aceite
- A carga térmica do túnel não fica artificialmente baixa por zerar calor latente.
- O breakdown mostra `Latente > 0` quando o processo representa congelamento.
- O cenário de sorvete/pallet/batelada passa a exibir energia específica e carga compatíveis com congelamento.
- Typecheck, testes e build passam.