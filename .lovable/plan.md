Plano para implementar o módulo de materiais térmicos e integrar ao cálculo de transmissão do CN ColdPro.

## Objetivo
Substituir o cálculo simplificado de transmissão por um cálculo técnico baseado em composição construtiva por face:

```text
U = 1 / (Rsi + Σ(espessura / k) + Rse)
Q = U × A × ΔT
```

O usuário poderá montar paredes, teto e piso com múltiplas camadas, usando materiais padrão ou composições personalizadas.

## 1. Banco de dados

Criar uma migration com:

1. Nova tabela `coldpro_thermal_materials` para catálogo padronizado:
   - nome do material
   - categoria: isolamento, painel, estrutural, metal, madeira, etc.
   - condutividade térmica em W/mK
   - densidade
   - faixa de temperatura
   - espessura típica
   - indicação se é isolante
   - observações técnicas

2. Seed inicial com os materiais fornecidos:
   - EPS, XPS, PUR, PIR
   - lã de vidro, lã de rocha
   - painel isotérmico PUR/PIR/EPS
   - concreto, cimento, bloco, tijolo, aço, alumínio, madeira

3. Persistência das camadas por face no próprio JSON de `construction_faces`, evitando criar complexidade excessiva agora. Cada face poderá salvar:

```text
layers: [
  { material_id, material_name, thickness_m, conductivity_w_mk, position }
]
u_value_w_m2k
transmission_w
transmission_kcal_h
```

4. Manter compatibilidade com os campos atuais (`insulation_material_id`, espessuras padrão), para não quebrar projetos já existentes.

## 2. Tipos e validação

Atualizar os tipos ColdPro para incluir:

- `ColdProThermalMaterial`
- `ColdProWallLayer`
- novos campos em `ColdProConstructionFace`:
  - `layers`
  - `u_value_w_m2k`
  - `transmission_w`
  - `transmission_kcal_h`

Atualizar validação no servidor para aceitar camadas, com limites seguros:

- até 8 camadas por face
- espessura não negativa
- condutividade positiva
- nomes e categorias com tamanho limitado

## 3. Motor de cálculo térmico

Adicionar funções no engine:

```text
calculateUValue(layers)
calculateFaceTransmission(face, env)
calculateConstructionTransmission(env, fallbackInsulation)
```

Regras:

- Converter W para kcal/h usando `1 W = 0,859845 kcal/h`.
- Usar `R_internal = 0,12` e `R_external = 0,08` como padrão inicial.
- Para paredes e teto: `ΔT = temperatura externa da face ou ambiente externo - temperatura interna`.
- Para piso: se houver temperatura de piso, usar `temperatura sob o piso - temperatura interna`; caso contrário usar ΔT externo.
- Se a face tiver camadas, usar cálculo por U técnico.
- Se não tiver camadas, manter fallback atual por material isolante + espessura, para compatibilidade.

O resultado detalhado entrará em `calculation_breakdown.transmission_faces`, mostrando face, área, U, ΔT e carga.

## 4. Interface na aba Ambiente

Na aba “Dimensões e painéis”, ajustar a tabela de faces para permitir montar a composição térmica de cada face.

Proposta de UX:

- Cada linha continua representando TETO, PAREDE 1, PAREDE 2, PISO etc.
- Adicionar botão “Camadas” em cada face.
- Ao clicar, abrir um painel/modal simples com:
  - lista de camadas
  - seletor de material
  - espessura em mm
  - condutividade preenchida automaticamente pelo material
  - botão adicionar/remover camada
  - prévia automática do U da face

Exemplo de montagem:

```text
Parede 1
1. Aço carbono — 0,5 mm
2. Painel isotérmico PUR — 100 mm
3. Aço carbono — 0,5 mm
U calculado: ~0,21 W/m²K
```

## 5. Integração com carregamento de dados

Atualizar `getColdProProjectBundle` para retornar também `thermalMaterials`, ordenados por categoria/nome.

Passar `thermalMaterials` para `ColdProEnvironmentForm` pela rota `/app/coldpro/$id`.

## 6. Resultado e memorial

Atualizar visualização de resultado para incluir informação mais técnica da transmissão:

- Transmissão total continua aparecendo no card principal.
- Detalhamento opcional por face no breakdown:
  - área
  - U
  - ΔT
  - carga em kcal/h

Atualizar o memorial PDF para refletir, quando disponível, o cálculo por camadas em vez de apenas material/espessura global.

## 7. Observações importantes

- Não vou substituir os dados atuais de isolamento; vou adicionar o novo catálogo térmico e usar fallback para projetos antigos.
- A tabela sugerida pelo usuário será adaptada para o padrão de nomes do ColdPro (`coldpro_thermal_materials`) para manter consistência.
- Como estamos em modo de planejamento, a implementação começa após aprovação.

## Validação

Após implementar:

- Rodar TypeScript sem emissão.
- Rodar build de produção.
- Conferir que projetos antigos ainda calculam com fallback.
- Conferir exemplo PUR 100 mm com U aproximado de 0,21 W/m²K.
- Conferir que o cálculo de transmissão final aparece em kcal/h corretamente.