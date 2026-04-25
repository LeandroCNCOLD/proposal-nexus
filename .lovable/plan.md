## Plano para auditoria completa do cálculo térmico ColdPro

Vou ajustar o motor de cálculo e o memorial técnico para eliminar premissas irreais e deixar rastreável toda a memória de infiltração, psicrometria, gelo, degelo, ventiladores, motores e produto.

### 1. Corrigir UR interna automática
- Ajustar o mapeamento de aplicações para não cair sempre em `cold_room`.
- Remover a interpretação de UR interna como `0%` quando o usuário não informou.
- Aplicar UR padrão por aplicação:
  - `freezer_room`: 85%
  - `blast_freezer` / túnel: 85%
  - `cold_room`: 75%
  - `climatized_room`: 65%
- Registrar no breakdown se a UR interna foi “automática” ou “informada pelo usuário”.
- Validar e bloquear cálculo se uma UR interna igual a 0 for explicitamente enviada.

### 2. Completar memória de infiltração
- Enriquecer `calculateTechnicalInfiltration` com todos os campos auditáveis:
  - tipo/proteção de porta;
  - largura, altura, área;
  - aberturas/dia;
  - tempo médio aberta;
  - tempo total de abertura;
  - perfil operacional;
  - velocidade de ar adotada;
  - fator de correção;
  - volume por porta, contínuo e total em m³/dia.
- Incluir fórmulas textuais no resultado para auditoria:
  - `A = largura × altura`
  - `V = A × velocidade_ar × tempo_total_abertura × fator_correcao`

### 3. Expor cálculo psicrométrico
- Exibir no breakdown e no PDF:
  - temperatura externa;
  - UR externa;
  - temperatura interna;
  - UR interna;
  - umidade absoluta externa kg/m³;
  - umidade absoluta interna kg/m³;
  - delta de umidade kg/m³ e g/m³.
- Mostrar claramente se a UR foi automática ou manual.

### 4. Separar carga sensível e latente de infiltração
- Manter o cálculo de infiltração como soma de:
  - `sensibleKcalH`
  - `latentKcalH`
  - `totalInfiltrationKcalH`
- Atualizar o PDF para mostrar `Q_sensível`, `Q_latente` e `Q_total`.

### 5. Formação de gelo e degelo obrigatório
- Tornar a formação de gelo explícita:
  - kg/dia;
  - kg/h;
  - fórmula `gelo = volume_ar_infiltrado × Δ umidade`.
- Tornar o degelo automático obrigatório para câmaras negativas com gelo calculado:
  - `energia_degelo_dia = gelo_kg_dia × (Cp_gelo × |T_evap| + 80) × fator_perdas`
  - `Q_degelo = energia_degelo_dia / horas_compressor`
- Exibir energia diária, carga equivalente, temperatura de evaporação, Cp do gelo e fator de perdas.

### 6. Ventiladores do evaporador
- Calcular ventiladores automaticamente quando o campo manual estiver zerado:
  - prioridade 1: potência de ventilador vinda da seleção/equipamento salvo (`curve_metadata.fan_power_kw`) quando disponível;
  - prioridade 2: estimativa pela vazão: 0,03 kW por 1.000 m³/h;
  - converter para kcal/h.
- Salvar no resultado se a origem foi catálogo, estimativa por vazão ou manual.
- Exibir no memorial: “Ventiladores: X kcal/h” com a origem.

### 7. Motores e dissipação
- Padronizar a memória do motor:
  - interno = 100%;
  - parcial = 30–70%;
  - externo = 0%.
- Exibir potência, horas, fator de dissipação e fórmula no PDF.
- Adicionar alerta quando houver potência de motor com fator ausente/inválido.

### 8. Consistência de produto
- Validar que a carga de produto não está duplicada.
- Incluir no breakdown por produto:
  - energia antes do congelamento;
  - energia latente;
  - energia após congelamento;
  - energia total kcal;
  - kcal/h;
  - kcal/kg;
  - diferença entre soma das etapas e total.
- Gerar erro se houver inconsistência relevante.

### 9. Alertas automáticos
- Implementar lista de alertas/erros no `calculation_breakdown.validation_alerts`:
  - erro se UR interna = 0;
  - alerta se porta > 0 e infiltração = 0;
  - alerta se câmara negativa e degelo = 0;
  - erro se produto inconsistente;
  - alerta se ventiladores zerados sem vazão/seleção suficiente.
- Exibir esses alertas no relatório e no PDF.

### 10. Atualizar o PDF/memorial
- Inserir seções específicas no PDF:
  - Memória de cálculo de infiltração;
  - Memória psicrométrica;
  - Formação de gelo no evaporador;
  - Cálculo de degelo;
  - Ventiladores do evaporador;
  - Motores e dissipação;
  - Validações automáticas;
  - Premissas automáticas x informadas manualmente.
- Garantir que o resultado final mostre a soma completa:
  - transmissão + produto + infiltração sensível/latente + degelo + motores + iluminação + pessoas + ventiladores + outros + segurança.

### 11. Integração com seleção de equipamento
- Ao calcular, buscar a seleção atual do ambiente para usar potência/vazão dos ventiladores quando já houver equipamento selecionado.
- Se a seleção ainda não existir, calcular sem quebrar e usar estimativa por vazão apenas quando houver dados suficientes.

### 12. Validação final
- Rodar build completo.
- Confirmar que o memorial não exibe mais UR interna 0%.
- Confirmar que degelo, gelo e ventiladores aparecem auditáveis no PDF.
- Confirmar que cálculos atuais continuam por ambiente e não usam base antiga.