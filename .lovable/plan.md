Plano revisado para a Etapa 5 — produção primeiro, compatibilidade física depois

Vou ajustar somente `src/components/coldpro/ColdProTunnelForm.tsx`. Não vou alterar banco de dados, propriedades ASHRAE, motor térmico principal nem massa calculada na Etapa 3.

## 1. Separar duas perguntas de engenharia

A Etapa 5 passará a responder em duas camadas.

### Camada 1 — Produção / massa por ciclo

Usar os valores já calculados/vindos da Etapa 3:

```text
capacidade_nominal_kg_h
tempo_retencao_min
```

Calcular:

```text
kg_min = capacidade_nominal_kg_h / 60
massa_projetada_ciclo_kg = kg_min × tempo_retencao_min
```

Exemplo esperado:

```text
993,6 kg/h / 60 = 16,56 kg/min
16,56 × 11,8 min = 195,4 kg
```

Mensagem no topo:

```text
Com 993,6 kg/h e 11,8 min de retenção, entram 195,4 kg no túnel por ciclo.
```

### Camada 2 — Compatibilidade física até o núcleo

Depois de definida a massa do ciclo, validar:

```text
Com 195,4 kg dentro do túnel durante 11,8 min,
as condições atuais de ar são compatíveis com o congelamento até o núcleo?
```

Importante: a tela não deve afirmar de forma absoluta que “congelou 195 kg”. Ela deve afirmar compatibilidade técnica quando:

```text
tempo_estimado_congelamento_min <= tempo_retencao_min
```

Redação correta quando atende:

```text
As condições atuais são compatíveis com o congelamento de 195,4 kg em 11,8 min.
```

Redação correta quando não atende:

```text
As condições atuais não são compatíveis com o congelamento de 195,4 kg em 11,8 min. O modelo estima {tempo_estimado} min.
```

## 2. Remover a lógica incorreta de massa congelada proporcional

Vou remover da apresentação a fórmula atual:

```text
massa_congelada = massa_projetada × tempo_disponivel / tempo_termico
```

Ela não será mais usada para reduzir a massa congelada exibida no ciclo.

O tempo térmico estimado continuará existindo, mas somente como validação física separada:

```text
tempo_estimado_congelamento_min <= tempo_retencao_min
```

## 3. Status correto da configuração atual

Criar a validação principal:

```text
fisica_compativel = tempo_estimado_congelamento_min <= tempo_retencao_min
```

Status:

```text
ATENDE: condições compatíveis com o congelamento no tempo disponível
INSUFICIENTE: condições não compatíveis; tempo estimado maior que a retenção
PRELIMINAR: sem h manual informado, usando h sugerido apenas como referência
```

Se faltar h manual, manter alerta:

```text
Para validação final, informe o coeficiente convectivo manual. O h sugerido é apenas referência.
```

## 4. Reorganizar os cards principais

No topo da Etapa 5, mostrar:

1. Capacidade nominal — kg/h
2. kg/min — capacidade nominal ÷ 60
3. Tempo de retenção — min
4. Massa projetada por ciclo — kg
5. Status atual — atende / insuficiente / preliminar
6. Tempo estimado com configuração atual — min

Substituir/remover o card “Massa congelada na retenção” para evitar a leitura errada de 19,4 kg. A tela deve mostrar “Massa projetada por ciclo” ou “Massa congelável pela capacidade”, calculada por kg/h × tempo / 60.

## 5. Alternativa A — ajustar esteira quando não atender

Quando `tempo_estimado_congelamento_min > tempo_retencao_min`, mostrar:

```text
retencao_necessaria_min = tempo_estimado_congelamento_min
velocidade_esteira_nova_m_min = comprimento_util_esteira_m / retencao_necessaria_min
nova_capacidade_kg_h = massa_projetada_ciclo_kg × 60 / retencao_necessaria_min
```

Mensagem:

```text
Se mantiver as condições atuais de ar, será necessário aumentar a retenção para {retencao_necessaria} min, reduzindo a velocidade da esteira para {velocidade_nova} m/min. A capacidade cairá para aproximadamente {nova_capacidade} kg/h.
```

## 6. Alternativa B — manter produção e ajustar ar

Quando não atender, mostrar referência de projeto para manter a mesma massa em 11,8 min:

- h necessário
- velocidade de ar estimada necessária
- vazão necessária
- temperatura do ar necessária, quando houver referência calculável
- evaporação estimada

Regras:

- h manual continua sendo o valor principal de validação final
- h necessário aparece como referência de projeto
- h sugerido não substitui h manual automaticamente
- botão “Usar h sugerido” continua sendo ação explícita do usuário

Se a velocidade/h necessários ultrapassarem limites operacionais configurados, marcar a alternativa como inviável ou fora da faixa.

## 7. Alternativa C — simulação rápida por temperatura do ar

Criar uma tabela para comparar cenários:

- temperatura atual do ar
- -30 °C
- -35 °C
- -40 °C

Para cada cenário, exibir:

- T_ar
- tempo estimado até o núcleo usando o h efetivo atual
- vazão necessária pelo balanço térmico nessa temperatura/propriedades do ar
- velocidade necessária pela seção livre
- status: atende / não atende

A tabela responderá:

```text
Se eu reduzir a temperatura do ar para -40 °C, as condições ficam compatíveis com 195 kg em 11,8 min?
```

## 8. Manter controles sem loop

Preservar a lógica existente:

- fonte da temperatura do ar: usar ambiente ou definir túnel manualmente
- ao alterar T_ar manual, não alterar automaticamente o ambiente
- manter botão “Aplicar temperatura do túnel ao ambiente”

E manter a relação:

```text
T_evap = T_ar - ΔT
T_ar = T_evap + ΔT
```

com seletor para editar T_ar ou T_evap, evitando loop ao atualizar apenas o campo dependente.

## 9. Vazão e velocidade

Manter/organizar as fórmulas auxiliares já presentes:

```text
vazao_m3_h = carga_kW × 3600 / (densidade_ar × Cp_ar × ΔT_ar)
area_livre = largura_secao × altura_util × (1 - bloqueio)
velocidade_ar_m_s = vazao_m3_h / 3600 / area_livre
vazao_m3_h = velocidade_ar_m_s × area_livre × 3600
```

Ao alterar vazão, velocidade, seção ou bloqueio, a interface continuará recalculando as leituras equivalentes e o status.

## 10. Resultado esperado na tela

Para o caso citado, a Etapa 5 deve exibir algo equivalente a:

```text
Capacidade nominal: 993,6 kg/h
kg/min: 16,56 kg/min
Tempo de retenção: 11,8 min
Massa projetada por ciclo: 195,4 kg
```

E a validação física separada:

```text
Com 195,4 kg dentro do túnel durante 11,8 min, as condições atuais de ar são compatíveis com o congelamento até o núcleo?
Status: atende / insuficiente / preliminar
Tempo estimado: {tempo_estimado} min
```

Não deve mais aparecer a leitura errada:

```text
Massa congelada na retenção = 19,4 kg
```
