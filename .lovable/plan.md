Plano — melhorar a etapa “Produtos / Carga de produto” no ColdPro

O ajuste correto é separar melhor os conceitos que hoje estão misturados em “movimentação diária”, “movimentação horária” e “tempo de processo”. A tela precisa explicar e calcular conforme o cenário real: armazenamento, entrada diária, pico horário ou tentativa de congelar dentro da própria câmara.

1. Separar a etapa Produto em modos de aplicação

Adicionar um campo de uso/cálculo do produto, por exemplo `product_load_mode`:

- `storage_turnover`
  - Câmara de armazenagem.
  - O usuário informa carga total estocada e percentual movimentado por dia.
  - O sistema calcula a massa movimentada/dia.

- `daily_intake`
  - Produto recebido/processado por dia.
  - O usuário informa diretamente kg/dia.
  - O sistema divide pelo tempo de processo/recuperação para obter kcal/h.

- `hourly_intake`
  - Processo com alimentação contínua ou pico conhecido.
  - O usuário informa diretamente kg/h.
  - O sistema usa kg/h como base principal, sem depender de kg/dia.

- `room_pull_down_or_freezing`
  - Câmara de armazenagem sendo usada também para resfriar/congelar produto novo.
  - O usuário informa uma massa que entra em determinado período e o tempo desejado de recuperação/congelamento.
  - O sistema calcula a potência necessária nesse intervalo e alerta que câmara de estocagem não substitui túnel de congelamento quando a carga for pesada.

2. Novos campos para carga estocada e movimentação

Adicionar campos na tabela de produtos do ambiente (`coldpro_environment_products`):

- `product_load_mode`
- `stored_mass_kg`
- `daily_turnover_percent`
- `daily_movement_kg`
- `hourly_movement_kg`
- `recovery_time_h`
- `is_freezing_inside_storage_room`
- `freezing_batch_mass_kg`
- `freezing_batch_time_h`
- `movement_basis`
  - `calculated_from_stock`
  - `manual_daily`
  - `manual_hourly`
  - `batch_recovery`

Manter compatibilidade com os campos atuais:

- `mass_kg_day`
- `mass_kg_hour`
- `process_time_h`

Mas a tela passará a explicar qual deles está sendo usado.

3. Regra de cálculo por modo

Modo A — Carga estocada com giro diário

```text
massa_movimentada_dia = carga_estocada_kg × percentual_movimentado / 100
carga_kcal_h = energia_total_da_massa_movimentada / tempo_recuperacao_h
```

Exemplo:

```text
Carga estocada: 10.000 kg
Movimentação diária: 30%
Massa movimentada: 3.000 kg/dia
Tempo de recuperação: 20 h
Base horária: 150 kg/h equivalente
```

Aqui o “kg/h” é calculado para distribuir a carga no período de recuperação.

Modo B — Entrada diária direta

```text
massa_dia = kg/dia informado
carga_kcal_h = energia_total_da_massa_dia / tempo_processo_h
```

Uso típico:

- câmara recebe produto todo dia;
- produto entra já resfriado ou precisa apenas equalizar temperatura;
- o compressor tem algumas horas para recuperar.

Modo C — Entrada horária direta

```text
carga_kcal_h = kg/h informado × energia_específica_do_produto
```

Uso típico:

- linha contínua;
- recebimento concentrado por hora;
- pico operacional conhecido;
- quando o usuário já sabe a vazão horária real.

Nesse modo, o sistema deve deixar claro que kg/h substitui kg/dia dividido por tempo.

Modo D — Congelamento/resfriamento dentro da câmara de armazenagem

```text
energia_total = massa_lote × energia_específica_do_produto
potência_requerida = energia_total / tempo_desejado_h
```

Uso típico:

- cliente quer armazenar e congelar na mesma câmara;
- não há túnel dedicado;
- entra uma quantidade de produto quente/resfriado/congelando em determinado período.

O sistema deve mostrar alerta técnico:

```text
Câmara de armazenagem pode recuperar temperatura de produto, mas congelamento de carga nova dentro da câmara depende de circulação de ar, embalagem, empilhamento, área exposta e tempo disponível. Para congelamento intenso ou recorrente, recomenda-se túnel ou processo dedicado.
```

4. Melhorar nomes e ajuda da interface

Na tela `ColdProProductForm`, reorganizar a seção “Movimentação e processo” para ficar mais didática:

- “Como esta carga entra na câmara?”
  - Estoque com giro percentual
  - Entrada diária informada
  - Entrada horária informada
  - Lote para resfriar/congelar dentro da câmara

Exibir campos conforme a escolha:

- Estoque com giro percentual:
  - carga total estocada kg;
  - percentual movimentado/dia;
  - massa movimentada calculada kg/dia;
  - tempo de recuperação h.

- Entrada diária:
  - kg/dia;
  - tempo de recuperação/processo h;
  - kg/h equivalente calculado.

- Entrada horária:
  - kg/h;
  - observação de que é vazão/pico direto.

- Lote dentro da câmara:
  - massa do lote kg;
  - tempo desejado h;
  - opção “inclui mudança de fase/congelamento”; 
  - temperaturas de entrada/final/congelamento.

5. Ajustar o motor de cálculo

Atualizar `calculateProductLoadBreakdown` para escolher a massa e o divisor correto conforme o modo:

- Para `storage_turnover`:
  - calcular kg/dia a partir do estoque e percentual;
  - dividir pelo tempo de recuperação.

- Para `daily_intake`:
  - usar kg/dia informado;
  - dividir pelo tempo de processo.

- Para `hourly_intake`:
  - usar kg/h diretamente;
  - não dividir de novo por tempo.

- Para `room_pull_down_or_freezing`:
  - usar massa do lote;
  - dividir pelo tempo desejado;
  - manter cálculo sensível + latente + sensível abaixo quando cruzar a temperatura de congelamento.

6. Deixar o cálculo transparente

No `calculation_breakdown.products`, incluir:

- modo selecionado;
- massa estocada;
- percentual movimentado;
- kg/dia calculado;
- kg/h equivalente;
- tempo de recuperação/processo;
- energia específica do produto;
- carga sensível acima;
- carga latente;
- carga sensível abaixo;
- alertas técnicos.

7. Atualizar resultado e relatório

Em `ColdProResultCard` e `ColdProReport`, mostrar a carga de produto de forma mais compreensível:

- “Base de cálculo: estoque com 30% de giro”
- “Massa movimentada: 3.000 kg/dia”
- “Tempo de recuperação: 20 h”
- “Equivalente: 150 kg/h”
- “Carga de produto: X kcal/h”

Para congelamento em câmara, destacar:

- carga térmica exigida;
- tempo informado;
- aviso de limitação do método;
- recomendação de validar circulação/empilhamento ou considerar túnel.

8. Validações

Adicionar validações para evitar ambiguidade:

- Se modo for estoque, exigir carga estocada e percentual.
- Se modo for diário, exigir kg/dia e tempo.
- Se modo for horário, exigir kg/h.
- Se modo for lote/congelamento em câmara, exigir massa do lote e tempo desejado.
- Avisar quando o usuário preencher kg/dia e kg/h ao mesmo tempo, explicando qual será usado.

9. Arquivos principais

- Migração para novos campos em `coldpro_environment_products`.
- `src/features/coldpro/coldpro.types.ts`
- `src/features/coldpro/coldpro.functions.ts`
- `src/features/coldpro/coldpro-calculation.engine.ts`
- `src/components/coldpro/ColdProProductForm.tsx`
- `src/components/coldpro/ColdProResultCard.tsx`
- `src/components/coldpro/ColdProReport.tsx`

Resultado esperado

A etapa Produto deixará claro que:

- carga estocada não é automaticamente carga térmica;
- o que gera carga térmica é a movimentação/entrada/recuperação de temperatura;
- kg/dia é usado quando a entrada é diária e distribuída no tempo de recuperação;
- kg/h é usado quando existe vazão horária ou pico conhecido;
- tempo de processo em câmara é tempo de recuperação térmica;
- congelamento em câmara é possível de calcular como carga de recuperação/congelamento, mas precisa de alerta técnico porque depende de circulação, embalagem, empilhamento e área exposta.