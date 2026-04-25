Plano para implementar o módulo "Processos Especiais / Atmosfera Controlada" no ColdPro

1. Criar a nova aba no fluxo do ColdPro
- Adicionar uma etapa no `ColdProStepper`: "Processos Especiais".
- Inserir essa etapa entre "Produtos" e "Cargas extras", mantendo o resultado final depois.
- Exibir a aba como camada opcional por ambiente, sem misturar os cálculos diretamente na aba Produtos.
- Mostrar a aba de forma especialmente orientada para aplicações como sementes, maturação, desverdecimento, controle de CO₂, atmosfera controlada e controle de umidade.

Fluxo final:
```text
Ambiente
→ Produtos
→ Processos Especiais
→ Cargas extras
→ Resultado
```

2. Criar a tabela `coldpro_advanced_processes`
- Criar migration para a nova tabela com os campos informados.
- Relacionar cada processo especial a um projeto e, para uso prático dentro da tela atual, também a um ambiente do ColdPro.
- Incluir `calculation_result` e `calculation_breakdown` em JSON para salvar memória de cálculo, resultados e alertas.
- Ativar segurança de acesso compatível com as tabelas existentes do ColdPro.
- Criar trigger de `updated_at` usando a função já existente `set_updated_at()`.

A tabela ficará preparada para salvar:
- tipo de processo avançado;
- dados de produto/câmara;
- controle de umidade;
- etileno;
- CO₂/purga;
- atmosfera controlada;
- resultado técnico e memória de cálculo.

3. Criar os tipos e funções de persistência
- Atualizar os tipos do ColdPro para incluir:
  - `ColdProAdvancedProcessType`;
  - `ColdProAdvancedProcess`;
  - resultados de umidade, etileno, CO₂, purga, respiração e atmosfera controlada.
- Atualizar `getColdProProjectBundle()` para carregar os processos especiais do projeto/ambiente.
- Criar server functions para:
  - salvar/atualizar processo especial;
  - recalcular processo especial;
  - retornar os resultados salvos junto ao bundle do projeto.
- Criar hooks em `use-coldpro.ts` para uso pela tela.

4. Criar services separados em `src/modules/coldpro/services/advancedProcesses/`
Criar a estrutura pedida:
```text
src/modules/coldpro/services/advancedProcesses/
  psychrometricHumidityService.ts
  seedHumidityControlService.ts
  ethyleneProcessService.ts
  co2ControlService.ts
  controlledAtmosphereService.ts
  advancedProcessEngine.ts
  advancedProcessValidationService.ts
```

Função de cada serviço:
- `psychrometricHumidityService.ts`: razão de umidade do ar, pressão de saturação e diferença de umidade absoluta.
- `seedHumidityControlService.ts`: água removida do ar, água removida do produto/semente e carga latente.
- `ethyleneProcessService.ts`: volume teórico de etileno em m³ e litros, tempo de exposição e alertas de segurança.
- `co2ControlService.ts`: geração de CO₂, limite máximo, vazão mínima de purga e carga térmica da purga.
- `controlledAtmosphereService.ts`: O₂/CO₂ alvo, respiração, scrubber, renovação de ar e alertas.
- `advancedProcessEngine.ts`: motor principal que combina os blocos conforme `advanced_process_type`.
- `advancedProcessValidationService.ts`: valida dados insuficientes, valores perigosos e cenários tecnicamente inválidos.

5. Implementar os cálculos do módulo

Controle de umidade:
```text
W_externo = razão de umidade externa
W_interno = razão de umidade interna desejada
ΔW = W_externo - W_interno
água_removida_ar_kg_h = vazão_ar_kg_h × ΔW
Q_latente_ar_kW = água_removida_ar_kg_h × 2500 / 3600
```

Para sementes/produto:
```text
água_removida_produto = massa_produto × (Ui - Uf) / (1 - Uf)
água_removida_kg_h = água_removida_produto / tempo_h
Q_latente_produto_kW = água_removida_kg_h × 2500 / 3600
```

Etileno:
```text
volume_etileno_m3 = volume_camara_m3 × ppm_etileno / 1.000.000
volume_etileno_litros = volume_etileno_m3 × 1000
```

CO₂ / purga:
```text
CO2_gerado_m3_h = massa_produto_kg × taxa_co2_m3_kg_h
CO2_maximo_m3 = volume_camara_m3 × limite_CO2_percentual / 100
vazao_purga_m3_h = CO2_gerado_m3_h / (limite_CO2_frac - CO2_externo_frac)
Q_purga = ρ_ar × vazao_purga_m3_s × Cp_ar × ΔT
```

Respiração:
- Calcular carga de respiração quando houver taxa informada.
- Somar essa carga como componente técnico separado, sem confundir com a carga básica de produto.

6. Criar o componente da aba "Processos Especiais"
- Criar `ColdProAdvancedProcessForm.tsx`.
- Layout em blocos:
  1. Produto e objetivo
  2. Controle de umidade
  3. Etileno / maturação / desverdecimento
  4. CO₂ / respiração / purga
  5. Atmosfera controlada
- Incluir seletor `advanced_process_type` com as opções:
  - `none`
  - `seed_humidity_control`
  - `banana_ripening`
  - `citrus_degreening`
  - `potato_co2_control`
  - `controlled_atmosphere`
  - `ethylene_application`
  - `ethylene_removal`
  - `co2_scrubbing`
  - `humidity_control`
- Pré-preencher campos úteis a partir do ambiente quando existirem, como volume da câmara, temperatura interna, umidade interna e massa do produto, mas permitir edição.
- Mostrar prévia técnica dos resultados antes de salvar, quando os dados mínimos existirem.

7. Exibir cards técnicos no resultado
Adicionar no `ColdProResultCard` uma seção específica para "Processos Especiais", com cards para:
- Água removida do ar kg/h
- Água removida do produto kg/h
- Carga latente de desumidificação kW
- Volume teórico de etileno litros
- CO₂ gerado m³/h
- Vazão mínima de purga m³/h
- Carga térmica da purga kW
- Carga de respiração kW
- Alertas operacionais

Também exibir memória de cálculo resumida para provar de onde veio cada número.

8. Somar cargas adicionais ao cálculo térmico final
- Integrar o resultado do processo avançado no `calculateColdProEnvironment()`.
- A carga total passará a respeitar a separação:
```text
Carga térmica básica
+ carga de produto
+ carga de umidade
+ carga de respiração
+ carga de purga/renovação
+ parâmetros de atmosfera
```
- A carga de umidade, respiração e purga aparecerá em `calculation_breakdown`, mantendo a rastreabilidade.
- O total requerido será atualizado para incluir essas cargas quando aplicáveis.

9. Alimentar relatório e memorial
- Atualizar `ColdProReport` para incluir a seção de Processos Especiais por ambiente.
- Mostrar resultados principais e alertas técnicos no relatório.
- Preparar os dados para também entrarem no memorial PDF existente, se o gerador já consumir o breakdown/resultados do ColdPro.

10. Alertas técnicos obrigatórios
Adicionar alertas no cálculo e na interface:
- Etileno é inflamável e não deve ser dosado automaticamente sem sistema de segurança.
- CO₂ elevado oferece risco a pessoas.
- O₂ baixo oferece risco de asfixia.
- Atmosfera controlada exige sensores, alarmes e intertravamentos.
- Os cálculos são estimativas de engenharia e devem ser validados conforme projeto específico.
- Se umidade externa for menor ou igual à umidade interna alvo, não calcular remoção de umidade do ar externo.
- Se umidade inicial do produto/semente for menor ou igual à final desejada, não calcular remoção de água do produto.
- Se o limite de CO₂ for menor ou igual ao CO₂ externo, bloquear cálculo de purga e marcar como inviável.

11. Validação final
- Rodar verificação de tipos/build.
- Corrigir eventuais incompatibilidades nos tipos gerados e nos componentes.
- Conferir que a aba não quebra os fluxos existentes de Ambiente, Produtos, Cargas extras, Resultado e Seleção de equipamento.
- Conferir que o resultado mostra as cargas separadas e que o total final inclui as cargas adicionais apenas quando houver processo especial aplicável.