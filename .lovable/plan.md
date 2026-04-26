Plano de implementação — ColdPro Tunnel Form

Objetivo: transformar o formulário de túnel em um fluxo técnico guiado para todos os tipos de túnel, com entrada de dados primeiro, resultado depois, diagnóstico em seguida e simulador somente no final.

Arquivos a alterar somente no módulo ColdPro:
- `src/components/coldpro/ColdProTunnelForm.tsx`
- `src/modules/coldpro/engines/tunnelEngine.ts`
- `src/modules/coldpro/adapters/formToTunnelInput.ts`
- `src/modules/coldpro/adapters/databaseToTunnelInput.ts`
- `src/modules/coldpro/physics/airflowModel.ts`
- `src/modules/coldpro/physics/geometryModel.ts`
- `src/modules/coldpro/physics/arrangementModel.ts`
- `src/modules/coldpro/core/validators.ts`

Não vou alterar CRM, Nomus, propostas, sincronização, seleção de equipamentos nem módulos fora do ColdPro.

Fluxo novo da tela

Reestruturar `ColdProTunnelForm.tsx` para uma sequência de etapas, aplicável a todos os modelos de túnel:

1. Tipo de processo
   - Tipo de túnel
   - Tipo de arranjo
   - Regime calculado: contínuo ou batelada
   - Modelo físico aplicado
   - Sem cards de resultado nesta etapa

2. Produto e geometria
   - Produto e seleção ASHRAE
   - Geometria do produto
   - Modelo de exposição
   - Dimensões condicionais por geometria
   - Separação visual entre:
     - Dimensões da unidade/caixa
     - Dimensões do pallet, carrinho, bloco ou carga agrupada
   - Para `static_pallet` com caixas paletizadas, exibir `thermalModelForPallet` com opções:
     - `box_limited`
     - `pallet_block_limited`
     - `hybrid`
   - Padrão para `palletized_boxes`: `hybrid`

3. Massa e tempo de processo
   - Contínuo:
     - massa kg/h
     - peso unitário
     - unidades por ciclo
     - ciclos por hora
     - tempo de retenção
   - Estático/batelada:
     - massa por pallet/lote
     - número de pallets/lotes
     - massa total calculada
     - tempo de batelada
   - No modo estático, não destacar massa por cadência como entrada principal

4. Temperaturas e propriedades térmicas
   - Temperatura inicial/final/ar
   - Ponto de congelamento
   - Cp acima/abaixo
   - Calor latente
   - Fração congelável
   - Densidade
   - Condutividade congelada
   - Fator de penetração térmica

5. Ar, vazão e ventilação
   - Fonte da velocidade:
     - velocidade manual
     - vazão por ventiladores
   - Se velocidade manual: velocidade do ar
   - Se vazão por ventiladores:
     - vazão dos ventiladores
     - largura/altura da seção
     - fator de bloqueio em percentual visual
     - área bruta calculada
     - área livre calculada
     - velocidade calculada

6. Cargas auxiliares
   - Embalagem conforme regime:
     - contínuo: kg/h
     - batelada: kg por batelada, convertido internamente pelo tempo de batelada
   - Cp embalagem
   - motores
   - ventiladores internos
   - outras cargas

7. Resultado técnico base
   - Exibir somente após as etapas de entrada
   - Cards organizados com:
     - energia específica total
     - sensível acima
     - latente
     - sensível abaixo
     - carga produto
     - carga embalagem
     - carga interna
     - carga total kW/kcal/h/TR
     - dimensão característica
     - distância até núcleo
     - velocidade usada
     - h base
     - h efetivo
     - k efetivo
     - tempo estimado
     - tempo disponível
     - status
     - alertas, dados faltantes e inválidos

8. Diagnóstico e consistência
   - Comparativo de fontes de carga:
     - carga calculada pelo `tunnelEngine`
     - carga vinda da aba Produtos/consolidado, quando disponível
     - diferença absoluta
     - diferença percentual
   - Se diferença > 10%, mostrar alerta de possível duplicidade/conversão/unidade
   - Não sobrescrever automaticamente nenhum valor

9. Simulador operacional
   - Aparece somente depois do Resultado Técnico Base
   - Começa fechado/expansível
   - Título: “Simulador de Condições Operacionais”
   - Subtítulo explicando que não altera o projeto original até clicar em aplicar
   - Manter ação explícita: “Aplicar simulação aprovada”
   - Não salvar simulação automaticamente

Correções matemáticas e regras de cálculo

1. Modo estático/pallet
   - `staticMassKg = palletMassKg × numberOfPallets`
   - Carga do produto:
     `Qproduto(kW) = staticMassKg × specificEnergyKJkg / (batchTimeH × 3600)`
   - Não usar `massKgH` como principal em batelada
   - Não gerar warning de divergência entre massa direta e massa por cadência no estático
   - Labels específicos:
     - “Massa total da batelada”
     - “Tempo de batelada”
     - “Massa usada no cálculo”
     - “Menor dimensão da carga/bloco”

2. Caixa individual versus pallet/bloco
   - `boxLengthM`, `boxWidthM`, `boxHeightM`: caixa individual
   - `palletLengthM`, `palletWidthM`, `palletHeightM`: bloco/carga paletizada
   - Implementar `thermalModelForPallet` no input e no cálculo:
     - `box_limited`: dimensão crítica = menor dimensão da caixa; exposição 0,35–0,45
     - `pallet_block_limited`: dimensão crítica = menor dimensão do pallet/bloco; exposição 0,25–0,35; warning conservador
     - `hybrid`: dimensão crítica = caixa; exposição 0,35; warning explicando modelo híbrido
   - Registrar o modelo usado no preview e no `calculationBreakdown.geometry`

3. Fator de bloqueio
   - UI mostra e recebe percentual de 0 a 95
   - Internamente salvar/usar decimal de 0 a 0,95
   - Se usuário digitar 1 na UI, tratar como 1%, ou seja, 0,01
   - Se valor interno >= 0,95, invalidar com mensagem clara
   - Calcular:
     - `grossAreaM2 = width × height`
     - `freeAreaM2 = grossAreaM2 × (1 - blockageFactorDecimal)`
     - `airflowM3S = fanAirflowM3H / 3600`
     - `calculatedAirVelocityMS = airflowM3S / freeAreaM2`

4. Embalagem em contínuo versus batelada
   - Adicionar normalização lógica:
     - contínuo usa `packagingMassKgH`
     - batelada usa `packagingMassKgBatch`, convertido para kg/h equivalente pelo `batchTimeH`
   - Ajustar labels no formulário e fórmulas no engine/breakdown

5. Diferença de vazão no simulador
   - Comparar vazão base usada/informada contra vazão simulada usada/informada
   - Retornar/mostrar:
     - `baseFanAirflowM3H`
     - `simulatedFanAirflowM3H`
     - `deltaFanAirflowM3H`
   - Se base não tiver vazão informada, comparar contra vazão estimada e deixar o label explícito

6. Nota técnica sobre carga que não muda com velocidade/h
   - Quando `totalKW` variar menos de 2% e `estimatedTimeMin` variar mais de 5%, mostrar:
     “A carga térmica requerida é determinada principalmente pela massa, energia específica e tempo de processo. Alterações de velocidade do ar afetam principalmente o tempo estimado de congelamento e a viabilidade da troca térmica.”

7. Estado visual do cálculo
   - Antes de dados obrigatórios: “Aguardando dados”
   - Com campos faltantes: “Dados incompletos” e lista
   - Com inválidos: “Dados inválidos” e lista
   - Tempo estimado > disponível: “Insuficiente” com explicação
   - Tempo estimado <= disponível: “Adequado”

Validação final

Após implementar:
- Rodar `npm run typecheck`
- Rodar `npm run build`
- Corrigir qualquer erro de TypeScript/build

Critérios de aceite

- A tela fica em ordem: entrada → cálculo → diagnóstico → simulação
- O simulador aparece somente após o resultado base e começa fechado
- Todos os tipos de túnel seguem o wizard técnico
- Estático usa massa total da batelada e tempo de batelada
- Contínuo usa kg/h e tempo de retenção
- Caixa individual e bloco/pallet ficam separados visual e matematicamente
- `static_pallet` tem `thermalModelForPallet`
- Fator de bloqueio é percentual na UI e decimal no cálculo
- Área livre e velocidade calculada ficam corretas
- Diferença de vazão do simulador passa a comparar base versus simulado
- Divergência entre `tunnelEngine` e aba Produtos é diagnosticada, não sobrescrita
- Typecheck e build passam