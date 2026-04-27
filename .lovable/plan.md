Sim, está correto: na Etapa 5 o cálculo precisa seguir esta ordem:

```text
massa processada + propriedades térmicas + temperaturas
→ carga térmica do produto
→ carga total do processo
→ vazão de ar necessária
→ velocidade do ar / h convectivo
→ tempo estimado até o núcleo
→ status
```

Hoje a tela já chama o motor, mas a vazão pode ficar baixa quando a carga do produto sai zerada ou quando a Etapa 5 prioriza valores de ar já informados antes de recalcular pela carga térmica real.

Plano de correção:

1. Ajustar o motor de cálculo para separar os níveis de cálculo
   - Carga térmica do produto deve ser calculada sempre que houver massa, temperaturas e propriedades térmicas mínimas.
   - O cálculo de carga não deve ser bloqueado por dados que pertencem apenas ao tempo até o núcleo, como densidade, condutividade ou dimensão crítica.
   - Tempo/status continuam dependendo dos dados térmicos completos.

2. Corrigir a lógica da Etapa 5 no formulário
   - Ao clicar em “Calcular”, primeiro usar `productLoadKW` e `totalKW` calculados pelo motor.
   - Depois recalcular a vazão estimada por balanço térmico:
     `vazão = carga total / (densidade do ar × Cp do ar × ΔT do ar)`.
   - Só depois usar essa vazão para sugerir ou recalcular velocidade conforme área livre/seção do túnel.

3. Evitar que a vazão informada “mascare” a vazão necessária
   - Mostrar claramente duas coisas diferentes:
     - “Vazão necessária calculada” pela carga térmica.
     - “Vazão informada dos ventiladores”.
   - Se a vazão informada for menor que a necessária, marcar como insuficiente/alerta.

4. Melhorar os cards de diagnóstico
   - Card explícito para “Carga térmica do produto” com fórmula e massa usada.
   - Card para “Carga total usada na vazão”.
   - Card para “Vazão necessária antes da velocidade”.
   - Mensagem objetiva quando a carga do produto não puder ser calculada, indicando exatamente o dado faltante: massa, tempo/cadência, temperatura inicial/final, Cp, calor latente/fração congelável quando cruzar congelamento.

5. Validar o fluxo nos regimes principais
   - Estático/pallet: massa da batelada ÷ tempo de batelada → carga do produto → vazão.
   - Estático/carrinho e blast freezer: mesma regra de batelada.
   - Contínuo/esteira e girofreezer: kg/h direto ou calculado → carga do produto → vazão.
   - Leito fluidizado: kg/h/leito → carga do produto → vazão, sem lógica de pallet.

6. Verificação final
   - Rodar typecheck.
   - Rodar build.
   - Conferir que, quando a carga do produto aumenta, a vazão necessária também aumenta.
   - Conferir que carga térmica aparece mesmo se o tempo até o núcleo ainda estiver pendente por falta de dimensão/densidade/condutividade.