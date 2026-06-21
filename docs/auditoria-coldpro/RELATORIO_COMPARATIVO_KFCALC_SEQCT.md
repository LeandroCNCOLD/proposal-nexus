# Relatório Comparativo KFCalc / SEQCT / ColdPro

## Resumo executivo

- Total de casos: 2
- OK: 2
- ATENÇÃO: 0
- DIVERGENTE: 0

## Fórmulas KFCalc/SEQCT aplicadas

- Q_infiltracao = 1.2 * volume * 0.24 * deltaT * trocas_dia / 24
- Q_trocas_ar = 1.2 * volume * 0.24 * deltaT * numero_trocas / 24
- Q_produto = massa * cp * deltaT / tempo_h
- Q_iluminacao = potencia_w * 0.86
- Q_motores = potencia_w * 0.86
- Q_pessoas = numero_pessoas * 300
- Q_total_com_segurança = soma * fator_segurança

## Casos comparados

### Câmara Pequena - Conservação

- Sistema externo: KFCalc/SEQCT exemplo
- KFCalc/SEQCT: 987.94 kcal/h
- ColdPro: 987.94 kcal/h
- Diferença: 0.00%
- Status: OK
- Diagnóstico: Verificar possível duplicidade infiltração/trocas de ar. Carga de produto ausente ou simplificada. Verificar cargas auxiliares zeradas.
- Recomendações: Separar regra de infiltração e trocas de ar para evitar dupla contagem. Adicionar massa, Cp, deltaT e tempo do produto para recalcular carga do zero. Preencher motores, iluminação e pessoas antes de comparar com KFCalc/SEQCT. Conferir se todos os valores estão em kcal/h antes da comparação.

### Câmara Grande - Congelamento

- Sistema externo: KFCalc/SEQCT exemplo
- KFCalc/SEQCT: 43143.12 kcal/h
- ColdPro: 43143.12 kcal/h
- Diferença: 0.00%
- Status: OK
- Diagnóstico: Verificar cargas auxiliares zeradas.
- Recomendações: Preencher motores, iluminação e pessoas antes de comparar com KFCalc/SEQCT. Conferir se todos os valores estão em kcal/h antes da comparação.

## Principais causas prováveis

