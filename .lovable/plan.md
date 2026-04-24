Plano para aproveitar a planilha oficial sem alterar capacidade, potência elétrica e corrente existentes

Diagnóstico inicial
- O banco atual tem 70 variações de modelos e 1.232 pontos de curva.
- Desses pontos, há 280 pontos em 220V trifásico e 952 em 380V trifásico.
- A diferença para as 288 máquinas/pontos 220V trifásico indica que faltam 8 pontos ou uma variação de modelo/linha que não foi importada corretamente.
- Os campos novos de flecha de ar e cálculo detalhado de volume dos aletados existem na estrutura, mas ainda estão vazios no banco.
- A planilha enviada tem abas por linha/produto. A pré-leitura confirmou pelo menos dados úteis de Booster com: modelo, diâmetro de ventilador, vazão, alcance/flecha, pé direito, tensões disponíveis, potência e corrente.

Regras de segurança técnica
- Não sobrescrever capacidade em kcal/h do catálogo anterior.
- Não sobrescrever potência elétrica do compressor/ventiladores/total do catálogo anterior.
- Não sobrescrever corrente elétrica do catálogo anterior.
- Usar a nova planilha como fonte complementar para campos físicos/comerciais/aplicação, principalmente:
  - flecha de ar / alcance
  - pé direito / altura de aplicação
  - diâmetro de ventilador
  - vazão de ar, apenas como campo comparativo quando já existir no banco
  - dados dimensionais dos aletados: diâmetro externo, diâmetro interno, parede, volume interno/calculado quando disponível
  - tensões disponíveis como disponibilidade comercial, sem substituir as curvas elétricas oficiais já importadas

O que será implementado

1. Criar uma rotina de análise da planilha oficial
- Ler todas as abas da planilha enviada.
- Identificar automaticamente cabeçalhos por aba, mesmo com formatos diferentes.
- Gerar um inventário por aba com:
  - quantidade de modelos encontrados
  - modelos por linha: BF, LT, MT, HT, AGRO, COMPACTice, Booster etc.
  - colunas técnicas disponíveis
  - colunas que podem ser usadas no catálogo
  - colunas que devem ser bloqueadas para não alterar dados críticos

2. Comparar planilha oficial x banco atual
- Cruzar modelos por nome normalizado, linha e quando possível por gabinete/refrigerante/tensão.
- Separar os resultados em quatro grupos:
  - match exato: modelo encontrado com segurança
  - match provável: precisa conferência por diferença de nomenclatura
  - modelo da planilha ausente no banco
  - modelo do banco ausente na planilha
- Conferir especificamente os 220V 3F para explicar a diferença entre 280 e 288.

3. Complementar campos seguros no banco
- Para evaporadores e condensadores:
  - preencher flecha de ar quando vier como “alcance” ou “flecha”
  - preencher pé direito/altura de aplicação em campo dedicado se necessário
  - preencher diâmetro do ventilador quando disponível
  - preencher diâmetro externo/interno/parede do tubo quando a aba trouxer esses dados
  - calcular volume interno somente quando houver diâmetro interno + comprimento + quantidade de tubos; caso contrário, preservar o volume informado na planilha/banco
- Para Booster:
  - criar/ajustar estrutura para tratar Booster como item técnico/acessório do catálogo, sem misturar com curvas de equipamentos frigoríficos
  - preservar potência e corrente como dados próprios de Booster, sem usar para substituir dados de modelos CN/UCN

4. Atualizar a importação do catálogo
- Ajustar o parser para reconhecer abas por linha, não apenas uma aba única.
- Adicionar aliases para nomes encontrados na planilha oficial:
  - “ALCANCE (m)” → flecha de ar
  - “PÉ DIREITO (m)” → altura de aplicação
  - “Ø VENTILADOR” → diâmetro/modelo do ventilador
  - variações de diâmetro interno/externo/parede de tubo
- Adicionar trava de importação: campos críticos de curva só serão lidos para comparação/relatório, não para atualização automática.

5. Atualizar a interface do catálogo
- Na página principal, mostrar resumo confiável:
  - total de variações
  - total 220V 3F
  - total 380V 3F
  - pontos de curva por tensão
- No detalhe do modelo, mostrar:
  - Flecha de ar / alcance
  - Pé direito / altura recomendada de aplicação
  - Diâmetro/modelo do ventilador
  - Dados do aletado: diâmetros, parede, volume informado e volume calculado
  - Aviso visual quando um dado veio da planilha complementar e não da curva original

6. Gerar um relatório de divergências
- Antes de gravar dados complementares, gerar uma tabela de conferência com:
  - modelos encontrados na planilha e no banco
  - modelos sem correspondência
  - campos que seriam preenchidos
  - campos críticos divergentes que NÃO serão alterados
  - explicação da diferença 280 vs 288 nos pontos 220V 3F

Resultado esperado
- Catálogo mais rico para análise técnica e aplicação, com flecha de ar, altura de aplicação e dados físicos dos aletados.
- Curvas críticas de capacidade, potência elétrica e corrente preservadas sem alteração.
- Diagnóstico claro dos 8 pontos/modelos 220V 3F faltantes.
- Importação mais inteligente por abas/linhas da planilha oficial.

Detalhes técnicos
- Serão necessários ajustes no parser `catalog-import.parser.ts` para ler múltiplas abas.
- Serão necessários ajustes na rotina de persistência `catalog-import.functions.ts` para atualizar apenas campos permitidos.
- Se a planilha tiver campos novos que ainda não existem no banco, será criada migração apenas para estrutura, por exemplo: `air_application_height_m`, `fan_diameter_mm`, `complementary_source`, `complementary_source_sheet`.
- Atualizações de dados serão feitas separadamente da estrutura, com relatório antes/depois.
- A tela `app/coldpro/catalogo` e o diálogo `ColdProModelDetailDialog` serão atualizados para exibir os novos campos e o resumo de qualidade dos dados.