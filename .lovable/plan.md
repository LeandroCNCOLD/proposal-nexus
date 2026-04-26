## Plano de implementação — túneis estáticos ColdPro

### Objetivo
Corrigir o fluxo de túneis estáticos para separar corretamente:

```text
Produto individual / caixa
→ formação do pallet/lote
→ massa por pallet/lote
→ massa total da batelada
→ carga térmica
→ tempo até o núcleo
→ status adequado/insuficiente
```

A implementação ficará restrita ao módulo ColdPro e aos campos necessários da tabela de túneis.

## 1. Banco de dados

Adicionar os campos em `coldpro_tunnels` para salvar o modo de massa e os resultados da formação do pallet/lote:

- `static_mass_mode`
- `units_per_box`
- `boxes_per_layer`
- `number_of_layers`
- `total_units_per_pallet`
- `box_packaging_weight_kg`
- `pallet_base_weight_kg`
- `units_per_pallet`
- `product_mass_per_pallet_kg`
- `packaging_mass_per_pallet_kg`
- `calculated_pallet_mass_kg`
- `static_mass_kg`

Usarei uma migration com `ADD COLUMN IF NOT EXISTS` para manter compatibilidade com dados existentes.

## 2. Etapa 2 — Produto, caixa e geometria

Atualizar `ColdProTunnelForm.tsx` para guiar o preenchimento em túneis estáticos:

- Para `static_pallet + palletized_boxes`:
  - sugerir `product_geometry = packed_box`
  - sugerir `surface_exposure_model = stacked`
  - sugerir `thermal_model_for_pallet = hybrid`
  - mostrar claramente as dimensões da caixa/unidade separadas das dimensões do pallet/bloco.

- Para `palletized_blocks`:
  - sugerir `product_geometry = rectangular_prism`
  - sugerir `surface_exposure_model = stacked`
  - sugerir `thermal_model_for_pallet = pallet_block_limited`

- Para `bulk_on_pallet`:
  - sugerir `product_geometry = bulk`
  - sugerir `surface_exposure_model = bulk_layer`
  - sugerir `thermal_model_for_pallet = pallet_block_limited`

- Para `static_cart`:
  - `trays_on_racks` → `tray_contact`
  - `boxes_on_cart` → `packed_box`, `boxed`, `hybrid`
  - `hanging_product` → `fully_exposed`

As sugestões serão aplicadas quando o arranjo for alterado, preservando o que já estiver preenchido sempre que possível.

## 3. Etapa 3 — Massa e tempo de processo

Adicionar o campo:

```text
Como deseja informar a massa da batelada?
- Informar massa do pallet/lote diretamente
- Calcular pela formação do pallet/lote
```

### Modo A — massa direta
Mostrar somente:

- massa por pallet/lote
- número de pallets/lotes
- tempo de batelada

Cálculo:

```text
massa_total_batelada = pallet_mass_kg × number_of_pallets
```

Nesse modo, não exigir peso unitário, unidades por caixa, caixas por camada, camadas ou densidade implícita da unidade.

### Modo B — formação do pallet/lote
Mostrar bloco “Formação do pallet/lote” com:

- peso unitário do pote/produto
- unidades por caixa
- caixas por camada
- número de camadas
- unidades totais por pallet/lote, opcional
- peso de embalagens/caixas por pallet
- peso do pallet/base
- número de pallets/lotes
- tempo de batelada

Cálculo:

```text
unitsPerPallet = total_units_per_pallet > 0
  ? total_units_per_pallet
  : units_per_box × boxes_per_layer × number_of_layers

productMassPerPalletKg = unitsPerPallet × unit_weight_kg
packagingMassPerPalletKg = box_packaging_weight_kg + pallet_base_weight_kg
calculatedPalletMassKg = productMassPerPalletKg + packagingMassPerPalletKg
staticMassKg = calculatedPalletMassKg × number_of_pallets
```

Exibir cards:

- unidades por pallet/lote
- massa de produto por pallet
- massa de embalagem/base por pallet
- massa calculada por pallet/lote
- massa total da batelada
- fórmula usada

## 4. Adapters

Atualizar:

- `src/modules/coldpro/adapters/formToTunnelInput.ts`
- `src/modules/coldpro/adapters/databaseToTunnelInput.ts`

Para calcular e enviar corretamente ao motor:

- `staticMassMode`
- `unitsPerPallet`
- `productMassPerPalletKg`
- `packagingMassPerPalletKg`
- `calculatedPalletMassKg`
- `palletMassKg`
- `staticMassKg`

Prioridade em dados salvos:

1. `static_mass_kg` salvo, se existir e for maior que zero
2. massa calculada pela formação do pallet/lote
3. `pallet_mass_kg × number_of_pallets`

## 5. Motor de cálculo

Atualizar `tunnelEngine.ts` para operação estática/batelada:

- nunca usar `kg/h` como massa principal no modo estático;
- priorizar:
  1. `staticMassKg`
  2. `calculatedPalletMassKg × numberOfPallets`
  3. `palletMassKg × numberOfPallets`
- calcular carga do produto por:

```text
productLoadKW = staticMassKg × energia_específica / (batchTimeH × 3600)
```

- não gerar alerta de divergência massa direta × cadência para estático;
- melhorar `missingFields` com mensagens objetivas para tempo até o núcleo:
  - massa total da batelada
  - tempo de batelada
  - geometria do produto
  - dimensão crítica para tempo até o núcleo
  - temperatura do ar
  - velocidade do ar ou vazão dos ventiladores
  - densidade do produto
  - calor latente
  - fração congelável
  - condutividade congelada
  - fator de penetração térmica

## 6. Densidade implícita não bloqueante no estático

Atualizar `continuousGirofreezerService.ts` para aceitar contexto estático:

- `tunnelType`
- `operationRegime`
- `staticMassMode`

Quando for estático/batch:

- não retornar `invalid_input` por densidade implícita baixa da unidade;
- converter para warning orientativo:

```text
Densidade implícita da unidade parece baixa, mas o cálculo estático está usando massa do pallet/lote.
```

A validação bloqueante de densidade implícita continuará valendo para processo contínuo quando a massa realmente vem de unidade + cadência.

## 7. Resultado e orientação ao usuário

Na Etapa 7/resultado técnico:

- exibir modelo térmico usado;
- exibir dimensão crítica usada no tempo até o núcleo;
- indicar se veio da caixa/unidade ou do pallet/bloco;
- quando o tempo até o núcleo não puder ser calculado, mostrar card “Tempo até o núcleo indisponível” com a lista dos dados faltantes.

## 8. Validação

Testarei os cenários:

1. `static_pallet + direct_pallet_mass`
   - 750 kg por pallet × 2 pallets = 1500 kg
   - sem bloqueio por densidade baixa da unidade

2. `static_pallet + calculated_pallet_composition`
   - 1,5 kg × 6 × 10 × 5 + 20 kg = 470 kg por pallet
   - 470 kg × 2 = 940 kg por batelada

3. `palletized_boxes`
   - geometria caixa fechada
   - modelo híbrido
   - dimensão crítica pela caixa

4. `palletized_blocks`
   - geometria bloco retangular
   - dimensão crítica pelo pallet/bloco

5. `bulk_on_pallet`
   - geometria granel
   - usa altura da camada ou diâmetro equivalente

Por fim, rodar typecheck e build.