## Diagnóstico

Existe uma inconsistência real na Etapa 5: o campo **Vazão dos ventiladores** está mantendo um valor antigo/manual maior (`59.583,75 m³/h`), enquanto o card **Vazão necessária calculada** mostra a vazão atual pelo balanço térmico (`3.700 m³/h`).

A causa principal está no pré-preenchimento da Etapa 5: a rotina atual usa `Math.max(vazão necessária, vazão já existente)`. Então, se algum valor anterior alto já estiver salvo ou digitado, ele nunca é reduzido para a vazão necessária recalculada. Isso deixa o formulário mostrando duas referências diferentes:

```text
Vazão necessária calculada = demanda térmica atual do túnel
Vazão dos ventiladores = vazão informada/disponível no equipamento
```

Esses dois valores podem ser diferentes tecnicamente, mas a tela hoje não deixa isso claro e, no pré-set automático, acaba parecendo erro.

## Plano de correção

1. **Separar claramente “necessária” de “informada”**
   - Manter o card **Vazão necessária calculada** como valor técnico de demanda.
   - Tratar **Vazão dos ventiladores** como valor informado/disponível.
   - Mostrar um aviso quando a vazão informada divergir muito da necessária.

2. **Corrigir o botão/pré-set “Calcular ar”**
   - Quando o usuário clicar em **Calcular ar**, preencher **Vazão dos ventiladores** com a vazão necessária atual, e não com o maior valor antigo.
   - Continuar calculando largura, altura, área livre e velocidade a partir dessa vazão necessária.
   - Preservar edição manual depois do preenchimento.

3. **Evitar pré-preenchimento automático enganoso**
   - Em novo cálculo sem vazão informada, pré-setar pela vazão necessária.
   - Se já existir vazão salva/manual, não sobrescrever automaticamente sem o usuário clicar no botão.
   - Se existir divergência, exibir diferença em percentual e m³/h para orientar.

4. **Melhorar os rótulos da Etapa 5**
   - Renomear/ajustar descrições para deixar claro:
     - “Vazão necessária calculada” = calculada pela carga térmica e ΔT do ar.
     - “Vazão dos ventiladores” = vazão informada/catalogada/disponível.
     - “Velocidade calculada” = vazão dos ventiladores ÷ seção livre.

5. **Validar cálculo e compilação**
   - Rodar typecheck e build.
   - Conferir se a Etapa 5 passa a preencher valores coerentes e se a divergência fica explícita quando houver vazão manual diferente da necessária.