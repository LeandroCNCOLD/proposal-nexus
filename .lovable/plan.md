Plano para converter o método técnico enviado em código do sistema CN ColdPro.

## Objetivo
Substituir o modelo atual simplificado de infiltração/gelo por um modelo técnico-profissional com:
- infiltração sensível e latente;
- psicrometria por umidade absoluta;
- formação de gelo em kg/dia;
- carga de degelo calculada automaticamente;
- fatores automáticos por região, proteção da porta e perfil operacional;
- motores/equipamentos com fator de dissipação;
- memória de cálculo detalhada na tela e no memorial PDF.

## 1. Criar módulo técnico de cálculo térmico
Adicionar um módulo compartilhado em TypeScript, seguindo o conteúdo enviado, com constantes internas:
- ar: densidade 1,20 kg/m³ e Cp 0,24 kcal/kg°C;
- água/gelo: condensação 597 kcal/kg, fusão 80 kcal/kg, Cp gelo 0,50 kcal/kg°C, vapor→gelo 677 kcal/kg;
- conversões: kW→kcal/h, W→kcal/h, kcal/h→kW e TR;
- velocidades padrão: leve, normal, intenso, crítico;
- proteção de porta: sem proteção, cortina PVC, cortina de ar, antecâmara, porta rápida, antecâmara + porta rápida;
- umidade externa padrão por região;
- umidade interna padrão por tipo de aplicação.

## 2. Atualizar banco de dados para novos parâmetros operacionais
Adicionar campos à tabela de ambientes para persistir os novos dados simples de operação:
- tempo médio de porta aberta por abertura, em segundos;
- perfil operacional da porta: leve, normal, intenso ou crítico;
- tipo de proteção da porta;
- região climática;
- fator de dissipação dos motores;
- temperatura de evaporação para cálculo de degelo;
- fator de perdas do degelo, com padrão 1,25.

Os campos antigos serão preservados para compatibilidade, mas a lógica principal passará a usar o método novo.

## 3. Corrigir e ampliar o cálculo de infiltração
Trocar o cálculo atual:
```text
porta = área × aberturas × fator empírico
```
por:
```text
V_porta_dia = área_porta × velocidade_ar × segundos_aberta_dia × fator_proteção
V_contínuo_dia = (trocas_ar × volume + ar_externo_contínuo + infiltração_porta_m³/h) × 24
V_total_dia = V_porta_dia + V_contínuo_dia
```

Depois calcular:
```text
Q_sensível = V_total_dia × densidade_ar × Cp_ar × ΔT / horas_compressor
Q_latente = V_total_dia × Δumidade × 677 / horas_compressor
Q_infiltração = Q_sensível + Q_latente
```

A tela deverá mostrar a decomposição:
- infiltração por abertura de porta;
- ar externo contínuo;
- trocas de ar;
- carga sensível;
- carga latente;
- total de infiltração.

## 4. Recalcular formação de gelo e degelo automático
Usar o mesmo volume infiltrado e a diferença de umidade:
```text
gelo_kg_dia = V_total_dia × Δumidade
```

Calcular degelo recomendado:
```text
Q_degelo_dia = gelo_kg_dia × (Cp_gelo × |T_evap| + 80) × fator_perdas
Q_degelo_kcal_h = Q_degelo_dia / horas_compressor
```

A carga de degelo calculada será sugerida automaticamente e poderá preencher o campo de degelo. O sistema também mostrará:
- kg/dia de gelo formado;
- energia diária de degelo;
- kcal/h recomendados;
- fator de perdas aplicado;
- premissas utilizadas.

## 5. Revisar bloqueio por gelo no evaporador
Manter a análise de risco já existente, mas recalibrar com a nova base técnica:
- gelo kg/dia vindo da psicrometria;
- cenários normal, arriscado e complexo;
- impacto estimado no rendimento;
- carga adicional por perda de rendimento separada da carga de degelo.

Assim ficam claras duas parcelas diferentes:
- degelo: energia para remover gelo formado;
- impacto no evaporador: perda de rendimento/carga adicional por operação com gelo.

## 6. Melhorar motores e equipamentos internos/externos
Adicionar uma biblioteca de sugestões na aba “Motores e outras cargas”, por exemplo:
- empilhadeira elétrica;
- transpaleteira elétrica;
- esteira transportadora;
- agitador/misturador;
- bomba interna;
- ventilador auxiliar;
- resistência/antiembaçante.

Cada item terá potência típica em kW e fator de dissipação sugerido:
```text
interno = 1,00
parcial = 0,30 a 0,70
externo = 0,00
```

O cálculo será:
```text
Q_motor = potência_kW × 859,845 × horas_dia / horas_compressor × fator_dissipação
```

## 7. Atualizar a interface de “Cargas extras”
Na aba de cargas extras, substituir “fator infiltração” manual como principal entrada por campos operacionais mais simples:
- região climática;
- perfil operacional;
- proteção da porta;
- segundos aberta por abertura;
- aberturas por dia;
- largura/altura da porta;
- trocas de ar;
- ar externo contínuo;
- infiltração adicional em m³/h.

O fator antigo poderá aparecer como referência técnica/compatibilidade, mas não será a base principal do cálculo novo.

## 8. Atualizar resultados, prévias e memorial PDF
Incluir no resultado e no memorial técnico:
- constantes aplicadas;
- umidade externa usada, automática ou informada;
- umidade interna usada;
- pressão/umidade absoluta externa e interna;
- Δumidade;
- carga sensível e latente de infiltração;
- formação de gelo kg/dia;
- carga de degelo calculada;
- carga de motores com fator de dissipação;
- fator de segurança aplicado.

Também ajustar a “Prévia das cargas extras” para mostrar corretamente a carga de infiltração, degelo automático, motores e segurança.

## 9. Validação
Após implementar, validar com build/teste e conferir que:
- trocas de ar, ar externo contínuo e infiltração de porta entram no cálculo;
- a carga latente aparece quando há diferença de umidade;
- o gelo kg/dia muda conforme região, umidade, porta e proteção;
- o degelo sugerido deriva do gelo calculado;
- motores respeitam potência, horas e fator de dissipação;
- o fator de segurança altera o total final;
- o relatório/PDF exibe a memória de cálculo de forma auditável.