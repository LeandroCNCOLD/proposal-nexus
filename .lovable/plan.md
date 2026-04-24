Plano para implementar as regras reais de engenharia no catálogo técnico ColdPro.

1. Estruturar propriedades dos refrigerantes
- Criar uma tabela técnica de densidade por fluido e temperatura, começando por:
  - R404A: -30°C ≈ 1,20 kg/L
  - R404A: -10°C ≈ 1,10 kg/L
  - R404A: 0°C ≈ 1,05 kg/L
- Preparar a tabela para receber R134a, R410A e outros fluidos depois.
- Criar função de busca/interpolação simples para retornar a densidade líquida mais adequada conforme refrigerante e temperatura de referência.

2. Adicionar campos calculados no condensador e evaporador
- Em `coldpro_equipment_condensers`:
  - `refrigerant_density_kg_l`
  - `refrigerant_reference_temp_c`
  - `refrigerant_occupancy_factor`
  - `estimated_refrigerant_charge_kg`
  - `estimated_refrigerant_charge_note`
- Em `coldpro_equipment_evaporators`:
  - os mesmos campos de carga estimada
  - campos de área de troca estimada:
    - `tube_external_area_m2`
    - `fin_area_multiplier`
    - `estimated_exchange_area_m2`
    - `fin_efficiency_factor`
    - `effective_exchange_area_m2`

3. Aplicar fatores de ocupação padrão
- Condensador a ar: usar padrão inicial `0,80`, dentro da faixa 0,70–0,90.
- Evaporador DX/expansão direta: usar padrão inicial `0,30`, dentro da faixa 0,20–0,35.
- Manter os fatores como campos editáveis para ajuste técnico futuro por regime/tipo.

4. Implementar fórmulas no banco
- Carga aproximada:
```text
m = V × ρ × f
```
Onde:
- `V` = volume interno corrigido em litros
- `ρ` = densidade líquida kg/L
- `f` = fator de ocupação

- Área externa dos tubos:
```text
A_tubos = π × D_ext × L_total
```

- Área total estimada do evaporador por multiplicador industrial:
```text
A_total ≈ A_tubos × fator_multiplicador
```

- Para espaçamento 2,10 mm, usar multiplicador inicial dentro da faixa indicada: `16x`.
- Para outros espaçamentos, definir regra por faixa:
  - baixa densidade de aleta: 8–12x
  - média densidade: 12–18x
  - alta densidade: 18–25x

5. Recalcular catálogo existente
- Atualizar todos os condensadores com volume calculado:
  - densidade conforme refrigerante do modelo
  - fator padrão 0,80
  - carga estimada em kg
- Atualizar todos os evaporadores com volume calculado:
  - densidade conforme refrigerante do modelo
  - fator padrão 0,30
  - carga estimada em kg
  - área de troca estimada/equivalente
- Não alterar capacidade frigorífica, potência elétrica, corrente ou performance.

6. Atualizar interface do catálogo técnico
- No detalhe técnico do modelo, exibir:
  - volume interno corrigido
  - densidade usada
  - temperatura de referência da densidade
  - fator de ocupação
  - carga estimada no condensador
  - carga estimada no evaporador
  - área externa dos tubos do evaporador
  - área estimada com aletas
  - área efetiva quando houver fator de eficiência
- Incluir nota técnica: “Cálculo aproximado por volume interno, densidade líquida e fator de ocupação. Não substitui carga final ajustada em campo.”

7. Validação
- Validar exemplos com modelos R404A, R134a e R410A.
- Conferir se os 70 condensadores calculam carga.
- Conferir se os 60 evaporadores com modelo de aletado calculam carga e área; os 10 UCN permanecerão sem área/volume se a planilha não trouxer o aletado.

Resultado esperado:
- O sistema passa a estimar a quantidade aproximada de fluido refrigerante que cabe no condensador e no evaporador, respeitando densidade do fluido e diferença operacional entre condensador e evaporador.
- O evaporador também passa a ter área de troca estimada por regra industrial, usando área de tubos e fator multiplicador por densidade de aletas.