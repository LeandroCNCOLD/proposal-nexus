Vou ajustar a Etapa 5 para seguir a nova interpretação: o tempo térmico calculado, por exemplo 60,9 min, passa a ser tratado na tela como o tempo total necessário da operação para atender a capacidade projetada nas condições atuais, não como tempo por peça, por camada ou por unidade.

Alterações propostas

1. Reescrever os rótulos e mensagens principais da Etapa 5
- Trocar “tempo estimado até o núcleo” / “auditoria física do produto” por “tempo necessário da operação”.
- Onde hoje a tela diz que o modelo não altera a capacidade, manter a separação operacional, mas com a conclusão correta:
  - A operação projetada continua sendo 993,6 kg/h, 195 kg por ciclo e 11,8 min de retenção.
  - Porém, se o modelo indica 60,9 min, a retenção atual não atende às condições atuais de ar.
- Remover/evitar textos como:
  - “tempo por unidade”
  - “tempo por camada”
  - “massa congelada proporcional”
  - “capacidade real possível” sem contexto.

2. Reorganizar o resumo da operação projetada
Na Etapa 5, mostrar de forma explícita:
- Capacidade projetada: 993,6 kg/h.
- Capacidade por minuto: 16,56 kg/min.
- Retenção atual: 11,8 min.
- Massa por ciclo: 195 kg.
- Velocidade atual da esteira: comprimento útil ÷ 11,8.

3. Reinterpretar o tempo térmico e o status
- O campo “Tempo estimado pelo modelo térmico” será renomeado para “Tempo necessário da operação”.
- A diferença será calculada como:

```text
Diferença = tempo necessário da operação - retenção atual
Exemplo: 60,9 - 11,8 = 49,1 min
```

- O status será:
  - Se tempo necessário <= retenção atual: “Atende”.
  - Se tempo necessário > retenção atual: “Não atende”.

Mensagem de insuficiência:

```text
A operação está configurada para 993,6 kg/h, com 195 kg por ciclo em 11,8 min. Nas condições atuais de ar, o modelo indica que seriam necessários 60,9 min para a operação atingir o congelamento requerido. Portanto, a retenção atual não atende.
```

4. Adicionar cenário “Ajustando esteira”
Se mantiver as condições atuais de ar e aceitar o tempo necessário calculado:
- Nova retenção = tempo necessário da operação.
- Nova velocidade da esteira = comprimento útil ÷ tempo necessário.
- Nova capacidade = massa por ciclo × 60 ÷ tempo necessário.

Exemplo esperado com seus números:

```text
nova retenção = 60,9 min
nova velocidade = comprimento útil / 60,9
nova capacidade = 195 × 60 / 60,9 = ~192,1 kg/h
```

Esse bloco será rotulado como simulação de ajuste de esteira, não como capacidade operacional atual.

5. Adicionar cenário “Mantendo produção” / “Ajuste de ar”
Se a meta for manter 993,6 kg/h e 11,8 min de retenção, a tela vai mostrar os parâmetros necessários para reduzir o tempo necessário de 60,9 min para 11,8 min:
- h necessário de referência.
- velocidade do ar necessária estimada a partir do h necessário.
- vazão necessária estimada pela seção livre.
- temperatura do ar de referência / temperatura de evaporação relacionada.

O código já possui parte dessa lógica:
- `requiredConvectiveCoefficientForTimeWM2K(...)` calcula o h necessário para fechar no tempo atual.
- A velocidade do ar pode ser estimada pela relação inversa do h sugerido.
- A vazão pode ser calculada por área livre × velocidade × 3600.

Vou organizar esses valores em cartões próprios, com texto claro de referência técnica, sem aplicar automaticamente no projeto.

6. Ajustar a lógica dos cartões existentes
Substituir os cartões atuais da Etapa 5:
- “Status do ciclo: Compatível/Revisar premissas” vira “Status: Atende/Não atende”.
- “Tempo estimado pelo modelo térmico” vira “Tempo necessário da operação”.
- “Diferença modelo × ciclo” vira “Diferença tempo necessário × retenção”.
- “Capacidade atual por minuto/hora” continua mostrando a capacidade projetada, para não confundir com a simulação de ajuste de esteira.
- A capacidade reduzida só aparece dentro do bloco “Cenário ajustando esteira”.

7. Atualizar o plano interno/documentação do ajuste
Atualizar `.lovable/plan.md` para registrar esta interpretação corrigida, substituindo a explicação anterior que tratava o tempo térmico como auditoria por peça/camada.

Arquivos a alterar
- `src/components/coldpro/ColdProTunnelForm.tsx`
- `.lovable/plan.md`

Resultado esperado na tela

Com os números citados:

```text
Operação projetada
Capacidade projetada: 993,6 kg/h
Retenção atual: 11,8 min
Massa por ciclo: 195 kg

Tempo necessário da operação
Tempo necessário: 60,9 min
Diferença: 49,1 min acima da retenção
Status: Não atende

Mensagem
A operação está configurada para 993,6 kg/h, com 195 kg por ciclo em 11,8 min. Nas condições atuais de ar, o modelo indica que seriam necessários 60,9 min para a operação atingir o congelamento requerido. Portanto, a retenção atual não atende.

Cenário ajustando esteira
Nova retenção: 60,9 min
Nova velocidade: comprimento útil / 60,9
Nova capacidade: 195 × 60 / 60,9

Cenário mantendo produção
h necessário: calculado para fechar em 11,8 min
velocidade do ar necessária: derivada do h necessário
vazão necessária: seção livre × velocidade necessária × 3600
temperatura de evaporação: T_ar - ΔT
```

Assim a tela passa a concluir corretamente que o ciclo atual é insuficiente para a operação projetada quando o tempo necessário calculado for maior que a retenção atual, e separa claramente as duas alternativas: reduzir esteira ou reforçar condição de ar.