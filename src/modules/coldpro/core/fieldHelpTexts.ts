export type ColdProFieldHelp = {
  title: string;
  content: string | string[];
};

export const DEFAULT_FIELD_HELP = {
  title: "Ajuda do campo",
  content: `Campo técnico utilizado no cálculo térmico. Verifique a unidade indicada e preencha conforme os dados reais do projeto. Este valor pode influenciar a carga térmica, o tempo estimado, a velocidade do ar, a troca térmica ou a validação do processo.`,
};

export const COLDPRO_FIELD_HELP = {
  tunnelType: {
    title: "Tipo de túnel",
    content: `Define o regime físico principal do processo. Pode ser túnel contínuo de esteira, girofreezer, túnel estático com carrinhos, túnel estático com pallets, leito fluidizado ou câmara/túnel de ar forçado. Essa escolha altera quais campos serão exibidos e qual modelo matemático será usado: contínuo em kg/h ou batelada em massa total por tempo.`,
  },
  arrangementType: {
    title: "Tipo de arranjo",
    content: `Define como o produto está disposto dentro do túnel: individual, em bandejas, em caixas, empilhado, paletizado, suspenso ou a granel. O arranjo altera a exposição ao ar, o bloqueio de passagem e a eficiência da troca térmica. Produtos mais expostos ao ar trocam calor melhor; produtos empilhados ou encaixotados exigem cálculo mais conservador.`,
  },
  physicalModel: {
    title: "Modelo físico aplicado",
    content: `Indica qual modelo de cálculo o sistema está usando para interpretar o processo. Exemplo: contínuo em esteira, batelada em pallet, bloco térmico equivalente, caixa individual ou modelo híbrido. Esse campo ajuda a entender se o cálculo está tratando o produto como unidade isolada, caixa, bloco ou carga agrupada.`,
  },
  operationRegime: {
    title: "Regime de operação",
    content: `Indica se o processo é contínuo ou em batelada. No regime contínuo, a carga térmica é calculada por vazão mássica em kg/h. No regime de batelada, a carga térmica é calculada pela massa total do lote dividida pelo tempo de processo.`,
  },
  productGeometry: {
    title: "Geometria do produto",
    content: `Define a forma física usada no cálculo de tempo até o núcleo. A geometria pode ser placa, bloco retangular, cubo, cilindro, esfera, caixa, granel ou irregular. Essa escolha define a dimensão característica e a distância térmica até o centro do produto.`,
  },
  surfaceExposureModel: {
    title: "Modelo de exposição",
    content: `Define quanto da superfície do produto está efetivamente exposta ao ar. Produto totalmente exposto troca calor melhor. Produto em bandeja, caixa, pallet ou pilha tem menor exposição e, portanto, menor h efetivo. Esse modelo corrige a troca térmica de acordo com a realidade operacional.`,
  },
  measurementScale: {
    title: "Escala das medidas",
    content: `Define a unidade usada para preencher as dimensões, como metros, centímetros ou milímetros. O sistema converte internamente para metros. Verifique com atenção para evitar erro de escala, pois uma medida informada em cm como se fosse m altera drasticamente o cálculo.`,
  },
  productLength: {
    title: "Comprimento do produto",
    content: `Dimensão longitudinal do produto. É usada para determinar a geometria, área exposta e, em alguns casos, a dimensão característica. Informe o valor real da unidade, bloco ou embalagem conforme o modelo selecionado.`,
  },
  productWidth: {
    title: "Largura do produto",
    content: `Dimensão transversal do produto. É usada junto com comprimento e altura/espessura para calcular a menor dimensão relevante e estimar o caminho térmico até o núcleo.`,
  },
  productHeight: {
    title: "Altura do produto",
    content: `Altura do produto, bloco ou embalagem. Em blocos retangulares e caixas, pode ser a menor dimensão e, portanto, influenciar diretamente o tempo estimado de congelamento.`,
  },
  productThickness: {
    title: "Espessura do produto",
    content: `Dimensão crítica para produtos tipo placa, manta, hambúrguer, filé ou produto achatado. Normalmente é a principal distância térmica. O sistema usa a espessura para calcular a dimensão característica e considera metade dela como distância até o núcleo.`,
  },
  productDiameter: {
    title: "Diâmetro do produto",
    content: `Usado para produtos cilíndricos ou esféricos. Em cilindros, o diâmetro geralmente domina o caminho radial de congelamento. Em esferas, a distância até o núcleo é metade do diâmetro.`,
  },
  productSide: {
    title: "Lado do cubo",
    content: `Usado quando a geometria do produto é cúbica. A dimensão característica é o lado do cubo e a distância até o núcleo é metade desse valor.`,
  },
  characteristicDimension: {
    title: "Dimensão característica",
    content: `Dimensão crítica usada para estimar o caminho térmico até o núcleo do produto. Em placas e hambúrgueres, geralmente é a espessura. Em blocos, caixas ou pallets, costuma ser a menor dimensão relevante. Quanto maior essa dimensão, maior tende a ser o tempo de congelamento. A escolha correta dessa dimensão é uma das partes mais importantes do cálculo de tempo até o núcleo.`,
  },
  distanceToCore: {
    title: "Distância até o núcleo",
    content: `Metade da dimensão característica. Representa a distância aproximada que o frio precisa percorrer da superfície até o centro térmico do produto, caixa, bloco ou pallet equivalente. É usada na estimativa de tempo de congelamento. Quanto maior a distância até o núcleo, mais lento será o processo.`,
  },
  boxLength: {
    title: "Comprimento da caixa",
    content: `Comprimento da embalagem ou caixa individual. Em produtos encaixotados, a caixa pode ser usada como dimensão térmica quando o modelo considera que o ar circula ao redor das caixas.`,
  },
  boxWidth: {
    title: "Largura da caixa",
    content: `Largura da embalagem ou caixa individual. Junto com comprimento e altura, ajuda a definir a menor dimensão da caixa e o caminho térmico estimado até o centro.`,
  },
  boxHeight: {
    title: "Altura da caixa",
    content: `Altura da embalagem ou caixa individual. Em muitos casos, essa é a menor dimensão da caixa e pode influenciar diretamente o tempo estimado de congelamento.`,
  },
  bulkLayerHeight: {
    title: "Altura da camada a granel",
    content: `Altura da camada de produto quando o material está a granel. Quanto maior a camada, mais difícil é a penetração do frio até o interior. Esse campo é usado para estimar a dimensão característica do leito ou camada.`,
  },
  equivalentParticleDiameter: {
    title: "Diâmetro equivalente da partícula",
    content: `Dimensão média equivalente de partículas pequenas, grãos, pedaços ou produtos IQF. É usada para estimar a troca térmica em produto solto ou leito fluidizado. Quanto menor a partícula, mais rápida tende a ser a troca térmica.`,
  },
  palletLength: {
    title: "Comprimento do pallet/bloco",
    content: `Comprimento total da carga paletizada, bloco ou lote agrupado. Esse valor representa a dimensão externa da carga, não da caixa individual. É usado quando o modelo trata o pallet como bloco térmico equivalente ou aplica penalização por paletização.`,
  },
  palletWidth: {
    title: "Largura do pallet/bloco",
    content: `Largura total da carga paletizada, bloco ou lote agrupado. Deve representar a dimensão real ocupada pela carga dentro do túnel.`,
  },
  palletHeight: {
    title: "Altura da carga",
    content: `Altura total da carga sobre o pallet, carrinho ou bloco. Em cargas compactas, essa dimensão pode influenciar o cálculo do caminho térmico e a dificuldade de circulação de ar.`,
  },
  palletMassKg: {
    title: "Massa por pallet/lote",
    content: `Massa de produto contida em cada pallet, carrinho, rack ou lote. No cálculo em batelada, o sistema multiplica essa massa pela quantidade de pallets ou lotes para obter a massa total do processo.`,
  },
  numberOfPallets: {
    title: "Número de pallets/lotes",
    content: `Quantidade de pallets, carrinhos, racks ou lotes processados simultaneamente na batelada. Multiplicado pela massa por pallet/lote, gera a massa total usada no cálculo térmico.`,
  },
  staticMassKg: {
    title: "Massa total da batelada",
    content: `Massa total processada no túnel estático. É calculada por massa por pallet/lote multiplicada pelo número de pallets/lotes. Essa é a massa principal usada no cálculo de carga térmica em batelada.`,
  },
  batchTime: {
    title: "Tempo de batelada",
    content: `Tempo disponível para o produto permanecer no túnel estático, carrinho, rack, câmara ou pallet. O sistema compara esse tempo com o tempo estimado até o núcleo para determinar se o processo está adequado. Se o tempo estimado for maior que o tempo de batelada, o processo será classificado como insuficiente.`,
  },
  blockExposureFactor: {
    title: "Fator de exposição do bloco",
    content: `Fator aplicado quando o produto é tratado como bloco térmico equivalente, pallet ou carga agrupada. Representa a perda de eficiência de troca térmica causada por empilhamento, caixas, contato entre produtos e baixa circulação de ar no interior da carga. Quanto menor o valor, mais conservador será o cálculo do tempo de congelamento. Exemplo: produto individual exposto pode usar 1,00; caixas paletizadas podem usar valores entre 0,25 e 0,45, dependendo da circulação de ar.`,
  },
  massKgHour: {
    title: "Massa kg/h",
    content: `Vazão mássica de produto processado por hora. É usada em túneis contínuos, esteiras e girofreezers. Em processos estáticos, esse campo não deve ser a massa principal; nesses casos, use massa total da batelada.`,
  },
  unitWeightKg: {
    title: "Peso unitário",
    content: `Peso médio de cada unidade de produto. Usado para calcular a massa por cadência quando há unidades por ciclo e ciclos por hora. Exemplo: 0,12 kg por hambúrguer.`,
  },
  unitsPerCycle: {
    title: "Unidades por ciclo",
    content: `Quantidade de unidades processadas a cada ciclo, linha, fileira, bandeja ou intervalo de produção. Junto com peso unitário e ciclos por hora, permite estimar a massa por hora.`,
  },
  cyclesPerHour: {
    title: "Ciclos por hora",
    content: `Quantidade de ciclos produtivos por hora. O sistema usa esse valor para calcular massa por cadência: peso unitário × unidades por ciclo × ciclos por hora.`,
  },
  calculatedMassKgH: {
    title: "Massa por cadência",
    content: `Massa calculada automaticamente a partir de peso unitário, unidades por ciclo e ciclos por hora. É útil para conferir se a massa direta em kg/h está coerente com a capacidade produtiva informada.`,
  },
  usedMassKgH: {
    title: "Massa usada no cálculo",
    content: `Massa efetivamente usada pelo motor térmico. Em processos contínuos, pode vir da massa direta em kg/h ou da massa por cadência. Em processos estáticos, a massa principal deve ser a massa total da batelada.`,
  },
  retentionTime: {
    title: "Tempo de retenção",
    content: `Tempo que o produto permanece dentro do túnel contínuo, esteira ou girofreezer. O sistema compara esse tempo com o tempo estimado de congelamento até o núcleo. Em sistemas contínuos, esse tempo depende do comprimento útil, velocidade da esteira e percurso do produto.`,
  },
  initialProductTemp: {
    title: "Temperatura inicial do produto",
    content: `Temperatura do produto ao entrar no túnel. Quanto maior a temperatura inicial, maior será a energia que precisa ser removida. Deve representar a condição real de entrada do produto no processo.`,
  },
  finalProductTemp: {
    title: "Temperatura final do produto",
    content: `Temperatura desejada do produto na saída do túnel ou ao final da batelada. É usada para calcular o calor sensível removido antes e depois do congelamento.`,
  },
  airTemp: {
    title: "Temperatura do ar",
    content: `Temperatura do ar dentro do túnel ou na região de contato com o produto. Ela influencia diretamente o diferencial térmico entre ar e produto, o tempo estimado de congelamento e a viabilidade do processo.`,
  },
  suggestedAirTemp: {
    title: "Temperatura de ar sugerida",
    content: `Temperatura de ar recomendada pelo sistema a partir da temperatura final desejada do produto e do approach definido. Exemplo: produto final a -18 °C com approach de 8 K resulta em ar sugerido de -26 °C.`,
  },
  approachAirSuggested: {
    title: "Approach do ar sugerido",
    content: `É a diferença recomendada entre a temperatura final desejada do produto e a temperatura do ar do túnel. Exemplo: se o produto deve sair a -18 °C e o approach é 8 K, o ar sugerido será -26 °C. Um approach menor exige mais capacidade frigorífica e maior controle de evaporação; um approach maior torna o ar mais agressivo, podendo aumentar o risco de ressecamento superficial, congelamento desigual ou perda de qualidade.`,
  },
  airTempDifference: {
    title: "Diferença do ar",
    content: `Diferença entre a temperatura de ar informada e a temperatura de ar sugerida. Ajuda a verificar se o projeto está usando ar mais frio ou mais quente do que a condição recomendada pelo sistema.`,
  },
  freezingPoint: {
    title: "Ponto de congelamento",
    content: `Temperatura na qual começa a mudança de fase relevante do produto. Para alimentos, pode ser menor que 0 °C por causa de sais, açúcares, sólidos e composição. Esse valor define quando o cálculo passa de calor sensível para calor latente.`,
  },
  specificHeatAbove: {
    title: "Cp acima do congelamento",
    content: `Calor específico do produto acima do ponto de congelamento. Indica quanta energia precisa ser removida para reduzir a temperatura do produto antes da mudança de fase. Pode ser informado em kJ/kg.K ou kcal/kg.°C, conforme o campo do sistema. Produtos com maior teor de água normalmente possuem Cp mais alto.`,
  },
  specificHeatBelow: {
    title: "Cp abaixo do congelamento",
    content: `Calor específico do produto após congelado. Normalmente é menor que o Cp acima do congelamento, pois parte da água já virou gelo. Esse valor é usado para calcular a energia retirada depois que o produto passa pelo ponto de congelamento até atingir a temperatura final desejada.`,
  },
  latentHeat: {
    title: "Calor latente",
    content: `Energia necessária para congelar a fração de água do produto, sem mudança direta de temperatura durante a mudança de fase. É uma das maiores parcelas da carga térmica em processos de congelamento. O valor depende da composição do produto, principalmente teor de água e sólidos.`,
  },
  frozenWaterFraction: {
    title: "Fração congelável",
    content: `Parte da água ou massa do produto que efetivamente participa da mudança de fase no processo. Valor entre 0 e 1. Exemplo: 0,75 significa que 75% da fração considerada congela. Esse fator multiplica o calor latente e tem grande impacto na carga térmica do produto.`,
  },
  density: {
    title: "Densidade",
    content: `Massa específica do produto, em kg/m³. É usada em estimativas de tempo de congelamento e comportamento térmico. Produtos mais densos tendem a ter maior inércia térmica.`,
  },
  thermalConductivityFrozen: {
    title: "Condutividade congelada",
    content: `Capacidade do produto congelado de conduzir calor internamente, em W/m.K. Quanto maior a condutividade, mais facilmente o frio chega ao núcleo. Produtos compactos, embalagens, caixas e pallets podem ter condutividade efetiva menor que o produto isolado.`,
  },
  thermalPenetrationFactor: {
    title: "Fator de penetração térmica",
    content: `Corrige a condutividade térmica efetiva do produto ou bloco conforme a dificuldade de o frio penetrar até o núcleo. Valores menores representam produto mais difícil de congelar internamente, carga compacta, embalagem fechada, pallet denso ou pouca circulação de ar. Valor 1,00 significa sem redução adicional. Valores entre 0,30 e 0,70 tornam o cálculo mais conservador para blocos, caixas e pallets.`,
  },
  airflowSource: {
    title: "Fonte da velocidade",
    content: `Define como a velocidade do ar será obtida. Pode ser informada manualmente pelo engenheiro ou calculada a partir da vazão dos ventiladores e da área livre de passagem. A velocidade usada afeta o coeficiente convectivo e o tempo estimado de congelamento.`,
  },
  airVelocity: {
    title: "Velocidade do ar",
    content: `Velocidade média do ar passando pelo produto, em m/s. Ela influencia o coeficiente convectivo e o tempo estimado de congelamento. Velocidade baixa reduz a troca térmica e aumenta o tempo até o núcleo. Velocidade muito alta pode causar desidratação, perda de peso, arraste de produto, maior consumo elétrico e queda de pressão elevada. O valor deve representar a velocidade real na região do produto, não apenas a velocidade nominal do ventilador.`,
  },
  airVelocityUsed: {
    title: "Velocidade usada no cálculo",
    content: `Velocidade efetivamente adotada pelo motor térmico. Pode ser a velocidade manual informada ou a velocidade calculada pela vazão dos ventiladores e área livre de passagem. Essa velocidade alimenta o cálculo do coeficiente convectivo quando o h manual não é informado.`,
  },
  fanAirflow: {
    title: "Vazão dos ventiladores",
    content: `Volume de ar movimentado pelos ventiladores, em m³/h. O sistema usa essa vazão junto com a seção livre de passagem para calcular a velocidade real do ar no produto. A velocidade calculada depende da área livre, que deve descontar bloqueios causados por produto, esteira, bandejas, caixas, pallets e estrutura interna.`,
  },
  estimatedAirflow: {
    title: "Vazão de ar estimada",
    content: `Vazão de ar estimada pelo sistema a partir da carga térmica e do ΔT do ar. Serve como referência para comparar com a vazão real dos ventiladores. Diferenças grandes podem indicar subdimensionamento, superdimensionamento ou parâmetros de ΔT inadequados.`,
  },
  informedAirflow: {
    title: "Vazão de ar informada",
    content: `Vazão real ou prevista dos ventiladores informada pelo usuário. O sistema pode comparar essa vazão com a vazão estimada para verificar coerência do projeto.`,
  },
  tunnelCrossSectionWidth: {
    title: "Largura da seção de passagem do ar",
    content: `Largura útil da região por onde o ar passa no túnel, em metros. Deve representar a seção real disponível para o fluxo de ar, considerando a geometria interna do túnel.`,
  },
  tunnelCrossSectionHeight: {
    title: "Altura da seção de passagem do ar",
    content: `Altura útil da região por onde o ar passa no túnel, em metros. Junto com a largura, define a área bruta de passagem do ar.`,
  },
  grossAirArea: {
    title: "Área bruta de passagem",
    content: `Área total calculada pela largura multiplicada pela altura da seção de passagem do ar. Antes de calcular a velocidade real, o sistema desconta o bloqueio causado por produto, estrutura, esteira, bandejas, caixas ou pallets.`,
  },
  blockageFactor: {
    title: "Fator de bloqueio",
    content: `Percentual da seção de passagem do ar bloqueada por produto, esteira, bandejas, caixas, pallet ou estrutura. Exemplo: 30% significa que apenas 70% da área está livre para passagem de ar. Bloqueio alto aumenta a velocidade local calculada, mas pode indicar má distribuição de ar e perda de eficiência. No sistema, o usuário deve informar em percentual visual, como 30%, e o cálculo interno converte para 0,30.`,
  },
  freeAirArea: {
    title: "Área livre estimada",
    content: `Área efetivamente livre para passagem do ar após descontar o fator de bloqueio. É calculada por área bruta × parcela livre. Exemplo: área bruta de 10 m² com bloqueio de 30% resulta em área livre de 7 m².`,
  },
  calculatedAirVelocity: {
    title: "Velocidade calculada no produto",
    content: `Velocidade estimada do ar na região do produto, calculada pela vazão dos ventiladores dividida pela área livre de passagem. Essa velocidade pode ser diferente da velocidade nominal do ventilador e é mais relevante para o cálculo de troca térmica.`,
  },
  airDeltaT: {
    title: "ΔT do ar",
    content: `Diferença de temperatura estimada entre o ar que entra e o ar que sai do evaporador ou do túnel. É usada para estimar a vazão de ar necessária pelo balanço térmico. Valores comuns em túneis de congelamento ficam aproximadamente entre 4 K e 8 K, dependendo do produto, evaporador, velocidade de ar e regime de operação. ΔT menor exige maior vazão de ar; ΔT maior reduz vazão, mas pode piorar a uniformidade térmica.`,
  },
  manualConvectiveCoefficient: {
    title: "Coeficiente convectivo manual",
    content: `Valor manual de h em W/m².K informado pelo engenheiro. Quando preenchido, ele prevalece sobre o cálculo automático por velocidade do ar. Use somente quando houver referência técnica, ensaio, literatura, histórico de projeto ou critério de engenharia. Se este campo ficar vazio, o sistema estima o h com base na velocidade do ar, fator de exposição e condição de arranjo.`,
  },
  airExposureFactor: {
    title: "Fator de exposição ao ar",
    content: `Coeficiente que corrige a eficiência da troca térmica conforme o quanto o produto está realmente exposto ao fluxo de ar. Produto totalmente exposto usa valor próximo de 1,00. Produto apoiado em esteira, dentro de bandeja, caixa, pilha ou pallet deve usar valores menores, pois parte da superfície não recebe ar diretamente. Esse fator reduz o h efetivo quando o coeficiente convectivo é calculado automaticamente. Se o h manual for informado pelo engenheiro, o valor manual deve prevalecer.`,
  },
  hBase: {
    title: "h base",
    content: `Coeficiente convectivo calculado antes das correções de exposição e arranjo. Normalmente é estimado pela velocidade do ar. Representa a capacidade básica do ar de remover calor da superfície do produto.`,
  },
  hEffective: {
    title: "h efetivo",
    content: `Coeficiente convectivo final usado no cálculo de tempo de congelamento. Considera a velocidade do ar e os fatores de exposição, bloqueio ou arranjo. Se o coeficiente convectivo manual for informado, ele deve prevalecer sobre o cálculo automático.`,
  },
  hSource: {
    title: "Fonte do h",
    content: `Indica se o coeficiente convectivo foi calculado automaticamente pela velocidade do ar ou informado manualmente pelo engenheiro. Essa informação ajuda na rastreabilidade do cálculo.`,
  },
  packagingType: {
    title: "Tipo de embalagem",
    content: `Define como a embalagem participa do processo térmico. Embalagens leves têm baixa influência; caixas, bandejas ou materiais com maior massa podem aumentar a carga térmica e dificultar a troca de calor.`,
  },
  packagingMass: {
    title: "Massa de embalagem",
    content: `Massa da embalagem associada ao produto. Em processo contínuo, pode ser informada em kg/h. Em batelada, deve representar a massa total de embalagem do lote ou ser convertida proporcionalmente. A embalagem adiciona carga sensível ao processo.`,
  },
  packagingCp: {
    title: "Cp da embalagem",
    content: `Calor específico do material de embalagem. É usado para calcular a energia necessária para resfriar ou congelar a embalagem junto com o produto. Papelão, plástico e metal possuem comportamentos térmicos diferentes.`,
  },
  beltMotorPower: {
    title: "Motor da esteira",
    content: `Potência do motor da esteira ou sistema de movimentação que dissipa calor dentro do túnel. Essa potência entra como carga interna adicional quando está dentro do volume refrigerado.`,
  },
  internalFansPower: {
    title: "Ventiladores internos",
    content: `Potência dos ventiladores localizados dentro do ambiente refrigerado. A energia elétrica consumida pelos motores é convertida em calor e deve ser adicionada à carga térmica.`,
  },
  otherInternalLoads: {
    title: "Outras cargas internas",
    content: `Outras fontes de calor dentro do túnel, como iluminação, resistências, equipamentos auxiliares, motores, pessoas ou infiltrações específicas não consideradas em outro campo.`,
  },
  specificEnergyTotal: {
    title: "Energia específica total",
    content: `Energia total removida por kg de produto. É a soma do calor sensível acima do congelamento, calor latente e calor sensível abaixo do congelamento. Serve como base para calcular a carga térmica do produto.`,
  },
  sensibleAbove: {
    title: "Sensível acima",
    content: `Parcela de energia removida para reduzir a temperatura do produto desde a temperatura inicial até o ponto de congelamento. É calculada usando o Cp acima do congelamento.`,
  },
  latent: {
    title: "Latente",
    content: `Parcela de energia removida durante a mudança de fase da água no produto. É calculada pelo calor latente multiplicado pela fração congelável. Em congelamento, geralmente é uma das maiores parcelas da carga térmica.`,
  },
  sensibleBelow: {
    title: "Sensível abaixo",
    content: `Parcela de energia removida após o produto passar pelo ponto de congelamento até atingir a temperatura final desejada. É calculada usando o Cp abaixo do congelamento.`,
  },
  productLoad: {
    title: "Carga térmica do produto",
    content: `Potência frigorífica necessária para retirar calor do produto, considerando massa, temperaturas, calor sensível, calor latente e tempo de processo. Em processos contínuos, é calculada pela vazão mássica em kg/h. Em batelada, é calculada pela massa total dividida pelo tempo de processo.`,
  },
  packagingLoad: {
    title: "Carga térmica da embalagem",
    content: `Potência frigorífica necessária para resfriar ou congelar a embalagem junto com o produto. Depende da massa da embalagem, do calor específico e da variação de temperatura.`,
  },
  internalLoad: {
    title: "Carga interna",
    content: `Carga térmica gerada por motores, ventiladores, iluminação ou outros equipamentos dentro do túnel. Essa energia precisa ser removida pelo sistema de refrigeração.`,
  },
  totalLoadKW: {
    title: "Carga total em kW",
    content: `Soma da carga térmica do produto, embalagem e cargas internas. É a potência frigorífica total estimada para o processo. Essa carga é usada para seleção preliminar de equipamento, mas deve ser analisada junto com tempo estimado até o núcleo e condições de troca térmica.`,
  },
  totalLoadKcalH: {
    title: "Carga total em kcal/h",
    content: `Carga total convertida para kcal/h. Essa unidade ainda é comum em refrigeração industrial e facilita comparação com catálogos e históricos de projeto. A conversão usada é aproximadamente 1 kW = 859,845 kcal/h.`,
  },
  totalLoadTR: {
    title: "Carga total em TR",
    content: `Conversão da carga frigorífica total para toneladas de refrigeração. 1 TR equivale aproximadamente a 3,517 kW ou 3.024 kcal/h. Essa unidade é comum em refrigeração, mas o cálculo interno deve manter kW e kcal/h para rastreabilidade.`,
  },
  freezingTime: {
    title: "Tempo estimado",
    content: `Estimativa do tempo necessário para o frio atingir o núcleo do produto ou bloco conforme geometria, velocidade do ar, coeficiente convectivo, condutividade, calor latente, densidade e temperaturas. Esse tempo é comparado com o tempo disponível de processo para indicar se o túnel está adequado ou insuficiente.`,
  },
  availableTime: {
    title: "Tempo disponível",
    content: `Tempo real disponível para o processo. Em túnel contínuo, é o tempo de retenção. Em túnel estático, é o tempo de batelada. O sistema compara esse valor com o tempo estimado até o núcleo.`,
  },
  processStatus: {
    title: "Status do processo",
    content: `Indica se o processo está adequado, insuficiente, incompleto ou inválido. Adequado significa que o tempo estimado é menor ou igual ao tempo disponível. Insuficiente significa que o tempo estimado até o núcleo é maior que o tempo disponível. Dados incompletos indicam ausência de informações obrigatórias. Dados inválidos indicam valores fora da faixa aceitável.`,
  },
  technicalWarnings: {
    title: "Alertas técnicos",
    content: `Lista de inconsistências, premissas conservadoras ou pontos que exigem atenção do engenheiro. Os alertas não necessariamente impedem o cálculo, mas indicam que algum dado deve ser revisado.`,
  },
  simulatedAirTemp: {
    title: "Temperatura do ar simulada",
    content: `Temperatura do ar usada apenas no cenário de simulação. Alterar esse campo permite avaliar o impacto de trabalhar com ar mais frio ou mais quente sem alterar imediatamente o projeto original.`,
  },
  simulatedAirVelocity: {
    title: "Velocidade do ar simulada",
    content: `Velocidade do ar usada apenas no cenário simulado. Permite analisar o impacto de aumentar ou reduzir a velocidade sobre o h efetivo, tempo estimado e viabilidade do processo.`,
  },
  simulatedAirflow: {
    title: "Vazão de ar simulada",
    content: `Vazão de ar usada no cenário de simulação. O sistema pode recalcular a velocidade no produto a partir da vazão e da área livre de passagem, permitindo comparar diferentes condições de ventilação.`,
  },
  minTemperatureLimit: {
    title: "Limite mínimo de temperatura",
    content: `Menor temperatura de ar usada na análise paramétrica do simulador. Permite testar vários cenários entre temperatura mínima e máxima para encontrar uma condição operacional adequada.`,
  },
  maxTemperatureLimit: {
    title: "Limite máximo de temperatura",
    content: `Maior temperatura de ar usada na análise paramétrica do simulador. Deve ser coerente com a temperatura final desejada do produto e com a capacidade do sistema frigorífico.`,
  },
  temperatureStep: {
    title: "Passo de temperatura",
    content: `Intervalo usado entre uma simulação de temperatura e outra. Exemplo: passo de 2 °C simula -30, -28, -26 e assim por diante. Passos menores geram análise mais detalhada, porém com mais cálculos.`,
  },
  minVelocityLimit: {
    title: "Limite mínimo de velocidade",
    content: `Menor velocidade de ar usada na análise paramétrica. Ajuda a avaliar a condição mínima de ventilação necessária para manter o tempo de processo adequado.`,
  },
  maxVelocityLimit: {
    title: "Limite máximo de velocidade",
    content: `Maior velocidade de ar usada na análise paramétrica. Deve respeitar limites práticos do produto, ventiladores, consumo de energia, desidratação e queda de pressão.`,
  },
  velocityStep: {
    title: "Passo de velocidade",
    content: `Intervalo entre as velocidades simuladas. Exemplo: passo de 0,5 m/s simula 1,0; 1,5; 2,0; 2,5 m/s. Passos menores geram análise mais detalhada.`,
  },
  applySimulation: {
    title: "Aplicar simulação aprovada",
    content: `Copia os parâmetros simulados para o formulário principal do projeto. Use somente após revisar o resultado simulado. A simulação não deve sobrescrever o projeto automaticamente sem confirmação do usuário.`,
  },
  resetSimulation: {
    title: "Restaurar simulação",
    content: `Restaura os campos do simulador para os valores atuais do projeto. Use quando quiser descartar alterações simuladas e voltar ao cenário base.`,
  },
  productTabComparison: {
    title: "Comparativo com aba Produtos",
    content: `Compara a carga calculada pelo motor do túnel com a carga consolidada da aba Produtos. Diferenças grandes podem indicar duplicidade, conversão incorreta, dados divergentes ou uso de modelos diferentes. O sistema deve alertar, mas não sobrescrever automaticamente os valores.`,
  },
} as const satisfies Record<string, ColdProFieldHelp>;

export type ColdProFieldHelpKey = keyof typeof COLDPRO_FIELD_HELP;

export function getColdProFieldHelp(key: ColdProFieldHelpKey | string) {
  return COLDPRO_FIELD_HELP[key as ColdProFieldHelpKey] ?? DEFAULT_FIELD_HELP;
}

export function validateColdProHelpTexts() {
  const problems: string[] = [];

  Object.entries(COLDPRO_FIELD_HELP).forEach(([key, value]) => {
    if (!value.title || value.title.trim().length === 0) problems.push(`${key}: title vazio`);
    const content = Array.isArray(value.content) ? value.content.join("\n") : value.content;
    if (!content || content.trim().length === 0) problems.push(`${key}: content vazio`);
    if (content && content.trim().endsWith("...")) problems.push(`${key}: content parece cortado com reticências`);
    if (content && content.trim().length < 40) problems.push(`${key}: content muito curto`);
  });

  return problems;
}

if (typeof window !== "undefined" && import.meta.env.DEV) {
  const helpTextProblems = validateColdProHelpTexts();
  if (helpTextProblems.length > 0) {
    console.warn("Problemas encontrados nos textos de ajuda do ColdPro:", helpTextProblems);
  }
}
