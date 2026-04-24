Plano para aplicar a tabela ASHRAE no CN ColdPro

1. Criar/expandir o banco de produtos térmicos
- Usar a tabela existente `coldpro_products` como catálogo operacional do cálculo.
- Expandir a estrutura para armazenar os campos completos do documento:
  - composição: umidade, proteína, gordura, carboidrato, fibra, cinzas;
  - propriedades térmicas: ponto inicial de congelamento, calor específico acima/abaixo, calor latente;
  - dados adicionais: densidade, condutividade térmica, fonte, referência e observações;
  - respiração para produtos frescos: taxas em 0, 5, 10, 15 e 20 °C.
- Manter compatibilidade com os campos atuais já usados pelo sistema (`specific_heat_above_kcal_kg_c`, `specific_heat_below_kcal_kg_c`, `latent_heat_kcal_kg`, `initial_freezing_temp_c`).

2. Importar os dados ASHRAE fornecidos
- Inserir os produtos das categorias enviadas:
  - Laticínios;
  - Queijos;
  - Embutidos e carnes processadas;
  - Doces e sobremesas;
  - Panificados;
  - Bebidas e sucos;
  - Óleos e gorduras;
  - Condimentos e temperos;
  - Produtos frescos com calor de respiração.
- Converter automaticamente as unidades do documento:
  - Cp de kJ/kg·K para kcal/kg·°C dividindo por 4,1868;
  - Calor latente de kJ/kg para kcal/kg dividindo por 4,1868.
- Marcar a fonte como “ASHRAE Refrigeration Handbook, Cap. 9/33” e a data de compilação.

3. Melhorar a seleção de produto no cálculo térmico
- Atualizar a aba “Produto / processo” para permitir selecionar um produto do catálogo ASHRAE.
- Ao selecionar o produto, preencher automaticamente:
  - calor específico acima;
  - calor específico abaixo;
  - calor latente;
  - temperatura de congelamento;
  - nome/categoria do produto.
- Manter edição manual permitida, porque receitas reais podem variar por fabricante.

4. Validar e aperfeiçoar as fórmulas de carga térmica
- Manter a lógica correta já existente para produto:
  - acima do congelamento: `Q = m × Cp_acima × (T_entrada - T_congelamento)`;
  - mudança de fase: `Q = m × L`;
  - abaixo do congelamento: `Q = m × Cp_abaixo × (T_congelamento - T_final)`;
  - sem congelamento: `Q = m × Cp × ΔT`.
- Garantir que todas as fórmulas trabalhem em kcal/h, já compatível com o restante do CN ColdPro.
- Adicionar no memorial/resultado a decomposição do produto em:
  - sensível acima;
  - latente;
  - sensível abaixo;
  - embalagem;
  - respiração, quando aplicável.

5. Aplicar calor de respiração para frutas e vegetais frescos
- Para produtos com taxa de respiração, calcular automaticamente a taxa adequada pela temperatura da câmara.
- Usar interpolação entre 0, 5, 10, 15 e 20 °C.
- Converter W/kg para kcal/h:
  - `Q_respiração = massa_kg × taxa_W_kg × 0,859845`.
- Aplicar apenas quando o produto tiver dados de respiração e a operação for armazenamento/resfriamento, não congelamento profundo.

6. Atualizar relatórios e memorial técnico
- Exibir no relatório que os dados térmicos vieram da base ASHRAE.
- Mostrar as propriedades usadas no cálculo de cada produto.
- Mostrar alertas técnicos quando:
  - produto não tiver catálogo selecionado;
  - propriedades forem preenchidas manualmente;
  - composição/propriedades tiverem valores estimados.

Detalhes técnicos
- Banco atual: `coldpro_products` já existe, mas hoje possui poucos registros e poucos campos de composição.
- Cálculo atual: `calculateProductLoad` já aplica a fórmula básica correta para congelamento e resfriamento; será expandido para retornar breakdown detalhado e somar respiração.
- UI atual: `ColdProProductForm` hoje usa campos manuais; será transformado em seleção assistida pelo catálogo com preenchimento automático.
- Não criaremos tabela paralela desnecessária se a tabela atual puder ser expandida com segurança. Isso evita duplicidade e mantém o cálculo ligado ao cadastro já usado pelo sistema.