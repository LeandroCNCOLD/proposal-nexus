Plano para corrigir a aba Contínuo / Girofreezer do ColdPro

1. Criar o serviço de cálculo dedicado
- Adicionar `src/modules/coldpro/services/continuousGirofreezerService.ts` com a lógica enviada.
- Manter o serviço puro, sem dependência de React, para facilitar teste e reutilização.
- O serviço fará:
  - conversão de medidas para metros;
  - conversão de peso para kg;
  - conversão de ciclos para ciclos/h;
  - conversão de tempo para minutos;
  - massa por cadência;
  - prioridade da massa direta;
  - densidade implícita;
  - distância até o núcleo;
  - massa dentro do túnel;
  - coeficiente convectivo;
  - condutividade efetiva;
  - tempo estimado por Plank;
  - status do processo, erros e alertas.

2. Integrar o serviço na aba existente
- Atualizar `src/components/coldpro/ColdProTunnelForm.tsx` para importar o novo serviço.
- Como a tela atual já salva os valores normalizados em unidades base, adaptar o cálculo para enviar:
  - `dimensionScale: "m"` usando os campos já convertidos para metros;
  - `weightScale: "kg"` usando `unit_weight_kg`;
  - `cycleScale: "cycles_per_hour"` usando `cycles_per_hour`;
  - `timeScale: "min"` usando `process_time_min`.
- Preservar os seletores visuais que o usuário usa para digitar em m/cm/mm, kg/g, ciclos/h ou ciclos/min, h/min.
- Aplicar o resultado apenas para processo contínuo/girofreezer, sem quebrar a aba estática.

3. Exibir os cards técnicos na aba Contínuo / Girofreezer
- Substituir o card simples de “Massa usada” por uma grade com os indicadores solicitados:
  - Massa usada kg/h;
  - Massa calculada por cadência kg/h;
  - Massa direta kg/h;
  - Massa dentro do túnel kg;
  - Distância até o núcleo mm;
  - Densidade implícita kg/m³;
  - h efetivo W/m²K;
  - k efetivo W/mK;
  - Tempo estimado min;
  - Tempo de retenção min;
  - Status do processo.
- Usar o componente visual existente `ColdProCalculatedInfo` para manter o padrão da tela.
- Destacar status como:
  - adequado: sucesso;
  - insuficiente: alerta;
  - faltam dados/dados inválidos: alerta.

4. Exibir erros e alertas técnicos
- Mostrar uma área de “Erros de preenchimento” quando houver erros retornados pelo serviço.
- Mostrar uma área de “Alertas técnicos” quando houver warnings.
- Incluir os alertas esperados para o exemplo informado:
  - massa calculada por cadência 63 kg/h divergente da massa direta 1050 kg/h;
  - densidade implícita incompatível;
  - espessura de 200 mm alta para girofreezer;
  - validação do tempo de retenção contra o tempo estimado até núcleo.

5. Ajustar consistência com campos existentes
- Mapear nomes já usados no app:
  - `product_length_m`, `product_width_m`, `product_thickness_m`;
  - `unit_weight_kg` / `product_unit_weight_kg`;
  - `units_per_cycle`, `cycles_per_hour`, `mass_kg_hour`;
  - `process_time_min`;
  - `air_temp_c`, `air_velocity_m_s`;
  - `density_kg_m3`, `thermal_conductivity_frozen_w_m_k`, `freezing_temp_c`, `latent_heat_kcal_kg`.
- Converter o calor latente existente, que está em kcal/kg na tela, para kJ/kg antes de chamar o serviço.
- Usar `frozen_water_fraction` quando existir; caso contrário, deixar o serviço acusar falta de dados para estimativa.

6. Verificação
- Rodar build/typecheck após a implementação.
- Conferir que a aba continua salvando os dados normalizados corretamente.
- Validar o caso de referência informado:
  - 0,2 m × 0,2 m × 0,2 m;
  - 5 g;
  - 7 unidades/ciclo;
  - 30 ciclos/min;
  - massa direta 1050 kg/h.
- Confirmar que a massa por cadência fica 63 kg/h e que os alertas aparecem.