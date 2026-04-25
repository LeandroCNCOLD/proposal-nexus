Plano para implementar as travas de validação e a fonte única de verdade no ColdPro.

## Objetivo

Criar um objeto final validado por ambiente, `thermalCalculationResult`, e fazer tela, PDF e laudo técnico consumirem esse mesmo objeto, sem recalcular subtotal, carga requerida, capacidade, sobra ou status em locais separados.

## 1. Fonte única para subtotal e carga requerida

- Criar funções puras no motor de cálculo para:
  - consolidar o subtotal pela soma obrigatória das parcelas:
    - transmissão
    - produto
    - embalagem
    - respiração
    - infiltração
    - pessoas
    - iluminação
    - motores
    - ventiladores
    - degelo
    - outros
    - e manter as cargas técnicas adicionais já existentes de forma explícita no breakdown, sem ficarem “escondidas”.
  - calcular segurança: `subtotal × fator_segurança`.
  - calcular carga requerida: `subtotal × (1 + fator_segurança)`.
- O resultado salvo em `coldpro_results` passará a carregar também uma auditoria matemática com:
  - subtotal calculado pela soma
  - subtotal exibido
  - diferença
  - carga requerida calculada
  - carga requerida exibida
  - diferença
  - alertas/erros quando a diferença passar de 1 kcal/h.

## 2. Fonte única para seleção e capacidade corrigida

- Padronizar a seleção de equipamento para distinguir claramente:
  - capacidade nominal/catálogo, quando existir;
  - capacidade unitária corrigida usada no dimensionamento;
  - capacidade total corrigida = capacidade unitária corrigida × quantidade;
  - método/fonte: polinomial, interpolado ou ponto de curva;
  - Tevap, Tcond, temperatura interna, refrigerante, modelo e R².
- Corrigir o conflito atual do PDF:
  - o campo “Capacidade na curva” não poderá usar `catalog_performance.evaporator_capacity_kcal_h` como se fosse a capacidade usada no dimensionamento quando a seleção usou outro valor corrigido.
  - se a capacidade usada for 20.405 kcal/h e a quantidade for 3, o total dimensionado será 61.215 kcal/h.
  - se a capacidade usada for 16.597 kcal/h, o PDF mostrará 16.597 como capacidade corrigida usada, e qualquer 20.405 aparecerá apenas como ponto nominal/de referência, com identificação clara.

## 3. Validação cruzada e status automático

- Criar uma função única de validação/dimensionamento que receba o resultado térmico e a seleção mais recente e gere:
  - `subtotal_validado`
  - `fator_segurança`
  - `carga_requerida_validada`
  - `capacidade_unitaria_corrigida`
  - `quantidade`
  - `capacidade_total_corrigida`
  - `sobra_percentual`
  - `status_dimensionamento`
  - lista de inconsistências bloqueantes e avisos.
- Aplicar as regras de status exatamente como solicitado:
  - capacidade total corrigida < carga requerida: `REPROVADO`
  - sobra >= 0 e < 10: `ATENÇÃO - SOBRA BAIXA`
  - sobra >= 10 e <= 30: `ADEQUADO`
  - sobra > 30: `SOBREDIMENSIONADO - VALIDAR`

## 4. Bloqueio de memorial final

- Implementar regra de emissão:
  - se houver erro bloqueante, permitir apenas emissão preliminar;
  - se não houver erro bloqueante, permitir memorial final.
- Travas bloqueantes:
  - subtotal não fecha;
  - carga requerida não fecha;
  - capacidade unitária diferente da capacidade de curva usada;
  - sobra divergente;
  - degelo zerado em câmara negativa;
  - UR interna igual a 0%;
  - infiltração zerada com porta informada;
  - produto com energia total diferente da soma das etapas.
- Mostrar esses bloqueios na tela e no PDF para rastreabilidade.

## 5. Tela, PDF e laudo sem recálculo paralelo

- Atualizar os componentes da tela para exibirem subtotal, carga requerida, capacidade, sobra e status a partir do objeto validado.
- Atualizar o PDF para usar o mesmo objeto validado em todas as seções.
- Atualizar o laudo técnico final para interpretar apenas os campos de `thermalCalculationResult`, sem recalcular capacidade, sobra ou status.
- Ajustar o prompt/análise do laudo para não gerar números próprios; ele receberá os números finais já validados.

## 6. Nova seção no PDF

Adicionar no PDF a seção:

“Auditoria matemática do dimensionamento”

Com os campos:

```text
Subtotal calculado pela soma das parcelas: X kcal/h
Subtotal exibido: X kcal/h
Diferença: X kcal/h

Carga requerida calculada: X kcal/h
Carga requerida exibida: X kcal/h
Diferença: X kcal/h

Capacidade nominal: X kcal/h
Capacidade unitária corrigida: X kcal/h
Quantidade: X
Capacidade total corrigida: X kcal/h
Tevap usada: X °C
Tcond usada: X °C
Temperatura interna: X °C
Refrigerante: X
Fonte da curva: X
R² da curva: X

Sobra técnica calculada: X%
Sobra técnica exibida: X%
Status: ADEQUADO / ATENÇÃO / REPROVADO / SOBREDIMENSIONADO
```

## 7. Log das premissas da curva

- Salvar junto da seleção, no campo de metadados existente, as premissas completas:
  - modelo
  - quantidade
  - capacidade nominal
  - capacidade corrigida
  - Tevap
  - Tcond
  - temperatura interna
  - refrigerante
  - potência elétrica
  - COP
  - vazão
  - fonte da curva
  - data da curva/seleção
  - versão do cálculo.

## 8. Ajustes técnicos previstos

Arquivos principais a alterar:

- `src/features/coldpro/coldpro-calculation.engine.ts`
  - consolidar subtotal/carga requerida em funções únicas;
  - gerar auditoria matemática e bloqueios.
- `src/features/coldpro/equipment-selection.engine.ts`
  - enriquecer candidato com capacidade nominal/de referência, capacidade corrigida usada e fonte de curva.
- `src/features/coldpro/coldpro.functions.ts`
  - salvar seleção com log de premissas completo;
  - recalcular/validar usando a seleção mais recente.
- `src/features/coldpro/coldpro.types.ts`
  - tipar o objeto `thermalCalculationResult` e auditoria.
- `src/components/coldpro/ColdProReport.tsx`, `ColdProResultCard.tsx`, `ColdProRealSelection.tsx`
  - exibir status, bloqueios e números validados.
- `src/integrations/coldpro/coldproMemorialPdfLib.ts`
  - adicionar seção de auditoria e corrigir capacidade exibida.
- `src/integrations/coldpro/coldpro-memorial.functions.ts`
  - fazer o laudo consumir apenas os números finais validados.
- `src/features/coldpro/push-coldpro-to-proposal.functions.ts`
  - usar capacidade/sobra/status validados ao inserir páginas na proposta.

## 9. Verificação

- Rodar build/typecheck para garantir que as alterações não quebram o projeto.
- Validar o caso relatado da divergência 16.597 kcal/h vs 20.405 kcal/h no PDF, garantindo que apenas a capacidade corrigida validada seja usada no dimensionamento e que o total por quantidade esteja correto.