Plano para liberar a finalização quando o túnel já está preenchido corretamente

O problema não está na Etapa 5 em si. A Etapa 5 calculou vazão, densidade, Cp e velocidade corretamente. O bloqueio aparece no Resultado porque a auditoria final está lendo os campos do `tunnelEngine` com nomes incompatíveis e interpreta como se produto/processo, temperatura inicial e temperatura final estivessem zerados/ausentes.

O que vou corrigir:

1. Ajustar a auditoria técnica final
   - Atualizar `src/modules/coldpro/core/technicalAudit.ts` para reconhecer os nomes reais retornados pelo motor do túnel:
     - `productLoadKW`, `usedMassKgH`, `availableTimeMin`, `energy.totalKJkg`, `calculationBreakdown.loads`, `calculationBreakdown.mass`, `calculationBreakdown.productEnergy`.
   - Manter os nomes antigos também, para não quebrar resultados já salvos.
   - Resultado esperado: não mostrar mais “Produto/processo zerado” quando a carga do túnel está calculada.

2. Corrigir leitura de temperaturas no resultado
   - Fazer a auditoria buscar temperatura de entrada/final em:
     - `initialTempC` / `finalTempC`, quando vier do motor;
     - `inlet_temp_c` / `outlet_temp_c`, quando vier do banco;
     - `calculationBreakdown` quando estiver dentro do memorial do túnel.
   - Resultado esperado: não mostrar mais “Temperatura de entrada/final ausente” quando elas estão preenchidas na Etapa 4.

3. Não bloquear por avisos técnicos normais
   - Manter como aviso, não como bloqueio, mensagens como:
     - pressão/altitude ausente;
     - infiltração psicrométrica sem dados;
     - vazão informada diferente da vazão por carga;
     - calor latente baixo do catálogo.
   - A finalização só deve bloquear quando faltar dado realmente obrigatório ou quando houver carga zero real.

4. Melhorar o texto da tela de Resultado
   - Separar visualmente “bloqueios” de “avisos”.
   - Se houver apenas avisos, mostrar como “Resultado com observações técnicas”, sem impedir seleção automática/relatório.
   - Se houver bloqueios reais, manter “Resultado preliminar” e listar o que precisa ser corrigido.

5. Ajustar a regra de produtos cadastrados para túnel/blast freezer
   - Para ambientes de túnel, não exigir registro na lista “Produtos cadastrados” se existe um `tunnel` salvo/calculado com produto válido.
   - Essa lista pode continuar mostrando “Nenhum produto/processo cadastrado”, mas não deve significar que o túnel está inválido.

6. Validar o caso “Túnel de Batata Pré-frita”
   - Confirmar que, com aproximadamente:
     - produto: Batata pré-frita;
     - 1.000 kg/h;
     - entrada/final preenchidas;
     - carga ~58,1 kW;
     - vazão recomendada ~69.351 m³/h;
   - o Resultado fica adequado ou com observações, mas não bloqueado indevidamente.

Detalhes técnicos

Arquivos principais a alterar:
- `src/modules/coldpro/core/technicalAudit.ts`
- `src/routes/app.coldpro.$id.tsx`

Não vou alterar:
- cálculo do produto;
- lógica de velocidade do túnel;
- propriedades dinâmicas do ar da Etapa 5;
- banco de dados.

Após implementar, vou rodar typecheck/build para garantir que a tela compile sem regressão.