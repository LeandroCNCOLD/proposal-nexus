Plano para ajustar o botão "Calcular ar" da Etapa 5 do ColdPro

Escopo
- Alterar somente o cálculo local/frontend da Etapa 5 do formulário de túnel/blast freezer.
- Não alterar banco, backend, motor térmico principal, fórmulas já validadas nem seleção de equipamento.
- O clique apenas preencherá campos locais da tela; o usuário continuará salvando manualmente depois.

Arquivos previstos
- `src/components/coldpro/ColdProTunnelForm.tsx`
- Opcional, se ficar mais limpo: `src/modules/coldpro/physics/airflowModel.ts` para funções puras auxiliares de ar, sem mexer no motor térmico.

Implementação
1. Reescrever a lógica usada por `Calcular ar`
   - Hoje o botão monta um preset simples por velocidade-alvo.
   - Vou substituir por uma recomendação técnica local que usa:
     - carga térmica em kW já calculada pelo formulário;
     - ΔT do ar informado, padrão 6 K;
     - densidade do ar, padrão 1,2 kg/m³;
     - Cp do ar = 1,005 kJ/kg.K;
     - fórmula: `vazao_m3h = carga_kW × 3600 / (densidade_ar × Cp_ar × deltaT_ar)`.

2. Buscar dimensões automaticamente
   - Resolver comprimento, largura, altura, volume e temperatura interna a partir de `environment`, `form` e `tunnel`, aceitando variações como:
     - `length_m`, `width_m`, `height_m`;
     - `comprimento_m`, `largura_m`, `altura_m`;
     - valores aninhados como `environment.length`, `environment.width`, `environment.height` quando existirem.
   - Usar as dimensões da aba Ambiente como prioridade.

3. Sugerir parede e sentido de sopro
   - Calcular duas opções:
     - Parede menor: seção = menor dimensão horizontal; sopro no maior comprimento.
     - Parede maior: seção = maior dimensão horizontal; sopro no menor comprimento.
   - Para túnel/blast_freezer, preferir parede menor soprando no sentido do maior comprimento.
   - Avaliar a velocidade de cada opção e escolher a mais adequada tecnicamente.

4. Calcular seção real de passagem de ar
   - Não usar a altura total automaticamente.
   - Calcular `altura_util_ar` com regra local:
     - padrão: `altura_camara × 0,60`;
     - se houver altura de carga/pallet: `max(altura_camara - altura_carga, altura_camara × 0,30)`;
     - limitar a altura útil para evitar usar os 3 m completos em túnel/blast freezer, favorecendo uma faixa mais realista quando há carga/pallet.
   - Calcular:
     - `area_bruta_m2 = largura_secao × altura_util_ar`;
     - `area_livre_m2 = area_bruta_m2 × (1 - fator_bloqueio)`.

5. Sugerir fator de bloqueio
   - Túnel com pallet/bloco/caixas paletizadas: 50%.
   - Túnel vazio/carrinho/rack: 35%.
   - Câmara comum: 20%.
   - Exibir/preencher o campo existente de fator de bloqueio em % via valor decimal interno, mantendo o padrão atual da tela.

6. Calcular velocidade do ar no produto
   - Usar: `velocidade_m_s = vazao_m3h / 3600 / area_livre_m2`.
   - Preencher localmente:
     - fonte da velocidade = vazão por ventiladores;
     - vazão dos ventiladores informada;
     - vazão informada;
     - largura seção de passagem;
     - altura seção de passagem;
     - fator de bloqueio;
     - velocidade calculada/manual de referência.

7. Exibir campos técnicos novos na Etapa 5
   - Adicionar campos/valores locais para:
     - parede sugerida;
     - sentido de sopro;
     - justificativa técnica.
   - Esses valores ficam no estado local do formulário e só entram em persistência se o usuário clicar em salvar, mantendo o comportamento pedido.

8. Exibir card técnico após cálculo
   - Card: "Recomendação de instalação do equipamento".
   - Mostrar:
     - parede sugerida: parede menor/parede maior;
     - sentido de sopro;
     - largura útil considerada;
     - altura útil considerada;
     - área livre;
     - vazão necessária;
     - velocidade estimada no produto;
     - status: baixa/adequada/alta;
     - observação técnica.

9. Alertas de velocidade
   - Para túnel/blast_freezer:
     - < 1,5 m/s: alerta de velocidade baixa;
     - 2,0 a 5,0 m/s: adequada/ideal;
     - > 6,0 m/s: alerta de velocidade alta.
   - Para câmara fria:
     - ideal 0,2 a 0,8 m/s;
     - > 1,5 m/s: alerta de excesso.
   - Se a vazão atende ao balanço térmico, mas a velocidade ficar baixa, mostrar exatamente a mensagem solicitada sobre avaliar maior vazão, dutos, plenum, menor seção livre ou alteração da posição do equipamento.

10. Caso da imagem / validação esperada
   - Para largura 4,28 m, altura 3 m, vazão 1.658 m³/h e bloqueio 50%, o cálculo não usará 3 m como altura útil automaticamente.
   - A altura útil ficará reduzida pela regra técnica, por exemplo pela altura de carga/pallet ou fração útil, gerando velocidade mais realista.

Validação final
- Rodar typecheck/build após implementar.
- Retornar:
  - arquivos alterados;
  - regras implementadas;
  - campos preenchidos pelo botão;
  - comportamento do card técnico;
  - confirmação de que motor térmico, banco e seleção de equipamento não foram alterados;
  - confirmação de typecheck/build.