Plano para reestruturar a Etapa 5 — Ar, vazão e ventilação do ColdPro

Objetivo funcional

Transformar a Etapa 5 em uma tela de resposta operacional direta:

“Com X kg sobre a esteira durante Y min, o produto congela até o núcleo? Se não, quais parâmetros de ar, vazão, temperatura e h seriam necessários?”

A tela passará a separar claramente:
- capacidade nominal/operacional em kg/h;
- massa instantânea no túnel em kg;
- tempo de retenção disponível em min;
- tempo térmico estimado até o núcleo em min;
- capacidade real possível pelo tempo térmico em kg/h.

O que será alterado

1. Reorganizar a Etapa 5 em dois modos

Adicionar um seletor no topo da Etapa 5:

1. Validar configuração atual
2. Dimensionar para tempo solicitado

Modo “Validar configuração atual”
- Usa os valores informados pelo usuário:
  - vazão dos ventiladores;
  - velocidade do ar;
  - seção de passagem;
  - bloqueio;
  - temperatura do ar;
  - ΔT evaporador/ar;
  - temperatura de evaporação;
  - h manual, quando informado.
- Calcula e exibe:
  - velocidade real do ar;
  - área livre;
  - h sugerido;
  - h efetivo;
  - tempo estimado até o núcleo;
  - capacidade real pelo tempo térmico;
  - status suficiente/insuficiente.

Modo “Dimensionar para tempo solicitado”
- Objetivo: fazer tempo_estimado <= tempo_retenção.
- Ao clicar em “Calcular ar”, o sistema tentará encontrar parâmetros operacionais para fechar o tempo solicitado.
- Calculará/preencherá:
  - vazão necessária;
  - velocidade do ar necessária;
  - temperatura do ar sugerida;
  - temperatura de evaporação sugerida;
  - h necessário como referência.
- Se não fechar dentro de limites operacionais, exibirá:
  “Mesmo nos limites operacionais, o tempo solicitado não fecha.”

2. Criar a pergunta central da etapa

Adicionar um bloco principal, visualmente destacado, com a mensagem:

“Com {massa_esteira} kg sobre a esteira e {tempo_retenção} min, o modelo estima {tempo_estimado} min para congelar até o núcleo.”

E logo abaixo:
- Capacidade nominal: {kg/h}
- Capacidade real: {kg/h}
- Status: suficiente / insuficiente / faltam dados

3. Separar capacidade horária de massa instantânea

Na Etapa 5, o cálculo conceitual ficará:

- massa_esteira_kg = área física da esteira × densidade superficial
- capacidade_nominal_kg_h = massa_esteira_kg × 60 / tempo_retenção_min
- capacidade_real_termica_kg_h = massa_esteira_kg × 60 / tempo_estimado_min

Quando o modo da Etapa 3 for por densidade superficial da esteira, a massa instantânea virá obrigatoriamente da massa física sobre a esteira.

Para outros modos, manter fallback atual:
- massa instantânea = kg/h × tempo disponível / 60

4. Temperatura do ar com fonte controlada

Adicionar/organizar seletor:

Fonte da temperatura do ar:
- Usar ambiente/psicrométrico
- Definir túnel manualmente

Regras:
- Se usar ambiente: T_ar = temperatura interna do ambiente.
- Se manual: T_ar é independente.
- Alterar T_ar manual não deve alterar automaticamente o ambiente.
- Adicionar botão:
  “Aplicar temperatura do túnel ao ambiente”

Esse botão fará uma ação explícita do usuário para copiar T_ar para o campo de ambiente interno, sem efeito automático escondido.

5. Temperatura de evaporação e ΔT

Adicionar controles na Etapa 5:

- Temperatura do ar (°C)
- ΔT evaporador/ar (K)
- Temperatura de evaporação (°C)
- Base de cálculo:
  - editar T_ar
  - editar T_evap

Regras:
- Se base = editar T_ar:
  - T_evap = T_ar - ΔT
- Se base = editar T_evap:
  - T_ar = T_evap + ΔT
- Nunca recalcular os dois ao mesmo tempo.

Observação técnica: se ainda não existir campo persistido para T_evap no banco, manter T_evap como campo calculado/informativo no formulário para cumprir “não alterar banco de dados”. Persistência nova só seria feita em uma etapa futura se você solicitar.

6. Vazão e velocidade bidirecionais

Manter e reforçar a lógica bidirecional já existente:

- vazão = carga_kW × 3600 / (ρ_ar × Cp_ar × ΔT)
- área_livre = área_bruta × (1 - bloqueio)
- velocidade = vazão / 3600 / área_livre
- inverso: vazão = velocidade × área_livre × 3600

Ao alterar:
- vazão;
- velocidade;
- largura da seção;
- altura da seção;
- bloqueio;

recalcular automaticamente:
- área livre;
- velocidade ou vazão equivalente;
- h sugerido;
- tempo estimado;
- status.

7. Regra crítica do coeficiente convectivo

Alterar a leitura da Etapa 5 para deixar claro:

- h manual: valor de engenharia informado pelo usuário;
- h sugerido: estimativa preliminar pela velocidade do ar;
- h efetivo: valor usado no cálculo térmico.

Regras:
- Se h manual informado: h_efetivo = h_manual.
- Se não informado: h_sugerido será usado apenas como simulação preliminar.
- Exibir sempre h manual, h sugerido e h efetivo.
- Adicionar botão “Usar h sugerido”, que copia o h sugerido para o campo manual.
- Para validação final, exibir alerta quando h manual estiver vazio:
  “Para validação final, informe o coeficiente convectivo manual.”

Importante: isso não altera a energia específica do produto nem propriedades térmicas. Apenas altera a transferência térmica e o tempo estimado.

8. Botão “Calcular ar”

Reformular o botão para executar a lógica do modo selecionado:

No modo Validar configuração atual:
- recalcula vazão necessária pela carga térmica e ΔT;
- atualiza velocidade pela seção livre;
- atualiza h sugerido;
- atualiza tempo e status.

No modo Dimensionar para tempo solicitado:
- calcula h necessário para atingir o tempo de retenção;
- estima velocidade de ar necessária para obter esse h sugerido;
- calcula vazão necessária pela seção livre;
- sugere T_ar/T_evap/ΔT dentro de limites operacionais;
- preenche os campos de ar e recalcula o resultado.

9. Resultados e diagnósticos da Etapa 5

Reorganizar os cards para a sequência de decisão industrial:

1. Pergunta central/status
2. Massa instantânea no túnel
3. Tempo disponível
4. Tempo estimado até o núcleo
5. Capacidade nominal/operacional
6. Capacidade real pelo tempo térmico
7. Déficit ou margem
8. Temperatura do ar
9. Temperatura de evaporação
10. ΔT evaporador/ar
11. Vazão dos ventiladores
12. Área livre / bloqueio
13. Velocidade real do ar
14. h manual / h sugerido / h efetivo
15. Densidade e Cp do ar usados

Também manter os alertas de:
- divergência entre área manual e largura × comprimento útil;
- inconsistência entre fluxo por velocidade da esteira e fluxo por retenção;
- insuficiência de tempo térmico.

10. O que não será alterado

Conforme solicitado, não será alterado:
- banco de dados;
- carga térmica do produto por kg;
- propriedades térmicas do produto;
- modelo de massa kg/h da Etapa 3;
- tabelas ou migrações.

A Etapa 5 atuará apenas sobre:
- ar;
- vazão;
- velocidade;
- temperatura;
- ΔT;
- h;
- tempo térmico;
- capacidade real possível.

Arquivos previstos

- `src/components/coldpro/ColdProTunnelForm.tsx`
  - Reestruturação visual e lógica da Etapa 5.
  - Novos estados locais para modo de operação, base de temperatura e campos derivados.
  - Botões “Calcular ar”, “Usar h sugerido” e “Aplicar temperatura do túnel ao ambiente”.

- Possível ajuste pontual em `src/modules/coldpro/physics/heatTransfer.ts` ou no próprio componente
  - Apenas se for melhor centralizar a fórmula inversa para estimar h necessário/velocidade necessária.
  - Sem alterar carga térmica ou propriedades do produto.

Critérios de aceite

A Etapa 5 estará correta quando responder claramente:

- quanto produto está fisicamente no túnel;
- quanto tempo ele fica exposto;
- quanto tempo o modelo térmico exige;
- qual capacidade real é possível;
- quais parâmetros operacionais de ar seriam necessários;
- se a configuração fecha ou não fecha tecnicamente.

Exemplo de leitura esperada:

“Com 195 kg sobre a esteira e 11 min, o modelo estima 21,2 min para congelar até o núcleo. Capacidade nominal: 1.063 kg/h. Capacidade real: 552 kg/h. Status: insuficiente.”