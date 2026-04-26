Plano para corrigir os campos de preenchimento numérico do ColdPro em todo o módulo.

1. Criar um comportamento numérico centralizado
- Atualizar o `ColdProInput` para tratar campos numéricos de forma consistente.
- Permitir digitação fluida de:
  - números positivos;
  - números negativos;
  - vírgula ou ponto decimal;
  - até 4 casas decimais.
- Evitar que o campo “force” valor enquanto o usuário digita, principalmente em casos como `-`, `-1`, `1,5`, `1.2345`.

2. Remover comportamento problemático das setinhas
- Para campos numéricos do ColdPro, bloquear o incremento/decremento acidental por setas quando isso estiver causando disparos.
- Preferir `inputMode="decimal"` e validação própria em vez de depender do comportamento nativo instável de `type="number"`.
- Manter aparência visual atual dos campos.

3. Melhorar parsing e validação
- Atualizar `numberOrNull` para aceitar vírgula decimal, limpar espaços e validar número com até 4 casas decimais.
- Retornar `null` apenas quando o campo estiver vazio ou em estado intermediário de digitação.
- Não transformar automaticamente número negativo em positivo.

4. Aplicar nos formulários ColdPro
- Ajustar os helpers `num(...)` usados em:
  - `ColdProEnvironmentForm.tsx`
  - `ColdProProductForm.tsx`
  - `ColdProTunnelForm.tsx`
  - `ColdProExtraLoadsForm.tsx`
  - `ColdProAdvancedProcessForm.tsx`
- Onde houver limites físicos obrigatórios, validar no salvamento/cálculo, mas não travar a digitação no meio.
- Campos que realmente não podem ser negativos continuarão exibindo alerta/erro, mas permitirão o usuário editar sem o campo “brigar” com ele.

5. Corrigir campos com clamp imediato
- Remover clamps agressivos em campos percentuais que hoje fazem `Math.min/Math.max` durante a digitação.
- Aplicar limite apenas ao salvar, calcular ou validar visualmente, para evitar pulos/valores inesperados.

6. Validação de segurança
- Manter validação client-side e server-side.
- Revisar validações em `coldpro.functions.ts`, porque hoje há regra genérica que bloqueia negativos em alguns campos; ajustar para permitir negativos onde fazem sentido, como temperaturas.
- Não permitir strings inválidas, infinitos ou números fora do padrão no backend.

7. Verificação
- Rodar typecheck.
- Rodar build.
- Critérios de aceite:
  - digitar `-18` funciona sem inverter ou disparar;
  - digitar decimais com vírgula ou ponto funciona;
  - até 4 casas decimais são aceitas;
  - setinhas não disparam valores inesperados;
  - temperaturas negativas são aceitas;
  - campos de massa, dimensões, horas e percentuais continuam validados quando não puderem ser negativos.