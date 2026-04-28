Vou ajustar a Etapa 5 para separar claramente três coisas que hoje ficaram misturadas: capacidade operacional, ciclo de retenção e tempo físico estimado pelo modelo térmico.

O problema atual
- O item 6/7 está exibindo o `estimatedTimeMin` do motor físico, hoje 118,2 min, como se fosse a retenção necessária para processar os 195 kg do ciclo. Isso induz erro, porque o ciclo operacional definido é 11,8 min.
- O item 8 mostra 106,4 min porque está fazendo `118,2 - 11,8`. Esse ajuste só faria sentido se aceitássemos que o modelo físico exige 118,2 min; mas para a tela operacional do girofreezer isso está confundindo a análise.
- O item 11 cai para 1,65 kg/min porque usa `195 kg ÷ 118,2 min`. Por isso a capacidade/hora também despenca e a velocidade da esteira cai quase 90%.
- Ou seja: a queda de capacidade não veio da capacidade nominal do túnel; veio de tratar o tempo físico estimado de 118,2 min como novo tempo de ciclo.

Correção proposta

1. Reorganizar os itens 5, 6, 7 e 8
- Item 5: Status do ciclo
  - Deve dizer se as condições atuais são compatíveis ou se precisam de revisão.
  - Não deve afirmar que congelou; deve usar a forma correta: “compatível com o congelamento”.

- Item 6: Tempo de retenção do ciclo
  - Deve exibir 11,8 min.
  - Descrição: “tempo operacional informado/definido para o ciclo”.

- Item 7: Tempo estimado pelo modelo térmico
  - Deve continuar podendo mostrar 118,2 min, mas com rótulo claro de auditoria física, não como retenção operacional.
  - Descrição: “estimativa física do modelo até o núcleo; não altera automaticamente a capacidade nominal”.

- Item 8: Diferença entre modelo e ciclo
  - Em vez de “Ajuste de retenção” como se fosse uma ordem direta para aumentar o ciclo, mostrar a diferença de forma explicativa:
    - se modelo > ciclo: “modelo acima do ciclo em 106,4 min”
    - se modelo <= ciclo: “dentro do ciclo”
  - Isso evita sugerir automaticamente que a esteira tem que cair 90%.

2. Corrigir capacidade por minuto e capacidade por hora
- Capacidade nominal/hora: 993 kg/h.
- Capacidade por minuto: 993 ÷ 60 = 16,55 kg/min aproximadamente.
- Massa na retenção: 16,55 × 11,8 = 195,4 kg.
- Item 11 não deve mostrar 1,65 kg/min como “nova capacidade” quando o objetivo é explicar a capacidade operacional atual.
- Vou ajustar para mostrar:
  - Capacidade atual por minuto: 16,55 kg/min.
  - Capacidade atual por hora: 993 kg/h.

3. Remover o ajuste automático agressivo de velocidade/capacidade
- A tela não deve reduzir automaticamente a velocidade da esteira de 1,38 para ~0,14 m/min apenas porque o tempo físico estimado deu 118,2 min.
- Vou remover/alterar essa mensagem que diz que “a nova capacidade estimada fica em 1,65 kg/min”.
- Em vez disso, a mensagem deve explicar:
  - “Operacionalmente, o ciclo atual é 11,8 min para 195,4 kg.”
  - “A capacidade nominal permanece 993 kg/h, ou 16,55 kg/min.”
  - “O modelo térmico está estimando 118,2 min, portanto a premissa térmica precisa ser revisada antes de usar esse número para alterar retenção ou velocidade.”

4. Manter uma simulação opcional, mas com nome correto
- Se ainda for útil mostrar o cenário “se eu aceitasse os 118,2 min como retenção”, vou rotular como simulação crítica, não como nova capacidade operacional.
- Exemplo:
  - “Simulação se retenção = tempo térmico estimado”
  - Velocidade simulada: comprimento útil ÷ 118,2
  - Capacidade simulada: 195,4 ÷ 118,2 = 1,65 kg/min
- Mas isso ficará claramente separado da capacidade nominal atual, para não parecer que o sistema está mandando reduzir a esteira.

5. Ajustar textos explicativos
- Substituir frases que dão certeza indevida por frases compatíveis com validação:
  - “As condições atuais são compatíveis com o congelamento de 195,4 kg em 11,8 min” quando aprovado.
  - Quando não aprovado: “O modelo térmico estimou tempo maior que a retenção do ciclo; revisar premissas de h, vazão, temperatura, espessura, geometria ou fator de penetração antes de alterar a capacidade nominal.”

Arquivos a alterar
- `src/components/coldpro/ColdProTunnelForm.tsx`

Resultado esperado na tela, usando seus números
- 1. Capacidade nominal do túnel por hora: 993 kg/h
- 2. Capacidade por minuto: 16,55 kg/min
- 3. Massa na retenção: 195,4 kg
- 4. Retenção do ciclo: 11,8 min
- 5. Status do ciclo: compatível/não compatível conforme validação
- 6. Retenção operacional do ciclo: 11,8 min
- 7. Tempo estimado pelo modelo térmico: 118,2 min, como auditoria física
- 8. Diferença modelo × ciclo: 106,4 min acima do ciclo, sem transformar isso automaticamente em nova retenção
- 11. Capacidade atual por minuto: 16,55 kg/min
- 12. Capacidade atual por hora: 993 kg/h

Com isso, a tela deixa claro por que apareceu 118,2 e por que o cálculo anterior derrubou a capacidade, mas não apresenta essa queda como ajuste obrigatório do girofreezer.