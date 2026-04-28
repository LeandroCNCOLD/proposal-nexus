Plano de ajuste fino da Etapa 5 — capacidade por minuto e ajuste de retenção

Vou alterar somente `src/components/coldpro/ColdProTunnelForm.tsx`.

## Objetivo

Corrigir a leitura dos cards de ajuste da Etapa 5 para separar claramente:

1. capacidade nominal do túnel por hora;
2. capacidade operacional por minuto;
3. massa dentro da retenção atual;
4. tempo estimado até o núcleo para essa massa;
5. nova retenção/velocidade/capacidade quando a configuração atual não fecha.

## Correção principal

Hoje o card `11. Nova capacidade` está em `kg/h`. Pelo fluxo que você descreveu, ele precisa mostrar a capacidade ajustada em `kg/min`, porque a análise do ciclo está sendo feita em cima da massa que passa durante a retenção em minutos.

A lógica ficará assim:

```text
capacidade_nominal_kg_h = 993,6 kg/h
capacidade_atual_kg_min = capacidade_nominal_kg_h / 60
capacidade_atual_kg_min = 16,56 kg/min

retencao_atual_min = 11,8 min
massa_na_retencao_kg = capacidade_atual_kg_min × retencao_atual_min
massa_na_retencao_kg = 195,4 kg
```

Depois, se o tempo estimado até o núcleo for maior que 11,8 min:

```text
retencao_necessaria_min = tempo_estimado_ate_nucleo_min
nova_capacidade_kg_min = massa_na_retencao_kg / retencao_necessaria_min
nova_capacidade_kg_h = nova_capacidade_kg_min × 60
velocidade_ajustada_m_min = comprimento_util_m / retencao_necessaria_min
```

Assim, se a tela estimar que precisa de 12,1 min para compatibilizar os 195 kg:

```text
nova_capacidade_kg_min = 195,4 / 12,1 = 16,15 kg/min
nova_capacidade_kg_h = 969,0 kg/h
velocidade_ajustada = comprimento_util / 12,1
```

Ou seja: a produção cai um pouco porque a esteira precisa andar mais devagar para manter os 195 kg tempo suficiente dentro do túnel.

## Ajustes visuais nos cards

Na grade de diagnóstico da direita, vou renomear/reorganizar os cards para evitar a confusão atual:

```text
1. Capacidade nominal do túnel por hora     993,6 kg/h
2. Capacidade atual por minuto             16,56 kg/min
3. Retenção atual do ciclo                 11,8 min
4. Massa na retenção atual                 195,4 kg
5. Compatibilidade física                  Compatível / Não compatível
6. Tempo estimado até o núcleo             X min
7. Retenção necessária para 195,4 kg        X min
8. Ajuste de retenção                      +Y min
9. Velocidade atual da esteira             1,38 m/min
10. Velocidade ajustada da esteira          1,35 m/min
11. Nova capacidade por minuto              16,15 kg/min
12. Nova capacidade por hora                969,0 kg/h
```

Depois os cards técnicos de temperatura, vazão, h, área e velocidade do ar continuam na sequência.

## Ajuste de texto do alerta

Quando não atender, o alerta passará a explicar exatamente como a decisão foi tomada:

```text
Com 195,4 kg na retenção atual de 11,8 min, as condições atuais não são compatíveis.
O modelo estima 12,1 min até o núcleo para essa massa.

Para manter 195,4 kg por ciclo, a retenção precisa subir para 12,1 min.
Isso reduz a velocidade da esteira de 1,38 para 1,35 m/min.
A nova capacidade estimada fica em 16,15 kg/min, ou 969,0 kg/h.
```

Quando atender, manter a redação tecnicamente correta:

```text
As condições atuais são compatíveis com o congelamento de 195,4 kg em 11,8 min.
```

## Importante sobre o tempo estimado

Não vou tratar `tempo_estimado_ate_nucleo_min` como “massa congelada proporcional”. Ele continuará sendo a validação física do ciclo.

A tela não deve dizer:

```text
congelou 192 kg em 11,8 min
```

Ela deve dizer, quando insuficiente, algo nessa linha:

```text
Para a massa de 195,4 kg permanecer tempo suficiente até o núcleo, a retenção estimada é 12,1 min.
Com essa retenção, a nova capacidade cai para X kg/min / Y kg/h.
```

Isso responde exatamente ao raciocínio:

```text
A cada 11,8 min deveriam sair 195 kg.
Se as condições físicas exigem 12,1 min, a esteira precisa desacelerar.
Ao desacelerar, a capacidade por minuto e por hora diminuem.
```

## O que não será alterado

- Não vou alterar banco de dados.
- Não vou alterar a Etapa 3.
- Não vou alterar o motor térmico principal.
- Não vou voltar com cálculo de massa congelada proporcional como card principal.
- Vazão, velocidade do ar, temperatura do ar e h continuarão separados como parâmetros físicos de compatibilidade.