## Objetivo

Usar os documentos das linhas LT, LT MAX, MT, BF, HT e AGRO junto com os dados já cadastrados no catálogo para criar descrições mais inteligentes, específicas por modelo e por aplicação, em vez de uma descrição genérica igual para todos.

## O que encontrei

- O catálogo já tem campos para descrição comercial e características comerciais por modelo.
- As linhas LT, MT, BF, HT, LT MAX e AGRO já têm alguma descrição preenchida.
- As linhas `LT COMPACTice` e `MT COMPACTice` ainda estão sem descrição.
- O banco já tem dados técnicos úteis para enriquecer a descrição:
  - modelo, linha, tipo de gabinete, refrigerante e degelo;
  - faixas de temperatura de aplicação;
  - faixa de capacidade frigorífica por modelo;
  - potência elétrica mínima/máxima;
  - vazão do evaporador e condensador;
  - dados de ventilador, compressores, condensador e evaporador.
- Os documentos trazem informações comerciais por linha: faixa de aplicação, vantagens, descrição geral, características técnicas, dados de aplicação e condições de operação.
- Alguns documentos tiveram parsing parcial ou falharam no extrator automático, especialmente AGRO. Na implementação, vou tratar isso com leitura/conversão alternativa para não depender só do parser.

## Ajuste proposto

### 1. Criar uma estrutura de descrição inteligente

Para cada modelo, gerar um bloco padronizado com:

- **Resumo comercial do modelo**: texto curto e vendedor, específico para o modelo.
- **Aplicação recomendada**: congelados, resfriados, climatizados, blast freezer, baixa temperatura, alta temperatura etc.
- **Faixa operacional**: temperaturas de câmara e capacidade frigorífica do próprio modelo.
- **Diferenciais técnicos**: degelo, refrigerante, tipo de gabinete, vazão de ar, alcance, potência e construção.
- **Mensagem por porte**: modelos menores com linguagem de praticidade/compactação; modelos médios com versatilidade; modelos grandes com robustez, alta vazão e aplicações severas.
- **Observações comerciais**: por exemplo, quando só houver Split, destacar aplicação para instalações maiores ou mais técnicas.

Exemplo de resultado esperado:

```text
CN 1000 LT
Equipamento de baixa temperatura para câmaras de congelados entre -25 °C e -12 °C, indicado para operações que exigem estabilidade térmica e degelo eficiente. O modelo entrega faixa de capacidade cadastrada de X a Y kcal/h, com alta vazão de ar e longo alcance, adequado para câmaras de médio/grande porte. Disponível em plug-in, bi-bloco e split, com degelo por gás quente, baixa carga de fluido e conjunto testado em fábrica.
```

### 2. Melhorar o banco para guardar a descrição enriquecida

Adicionar novos campos na tabela de modelos para separar melhor a informação:

- `smart_description`: descrição final inteligente do modelo.
- `recommended_applications`: lista de aplicações recomendadas.
- `application_summary`: resumo da aplicação da linha/modelo.
- `commercial_highlights`: bullets comerciais mais importantes.
- `technical_highlights`: bullets técnicos calculados do banco.
- `description_confidence`: indicador simples de qualidade do vínculo, por exemplo `alta`, `media`, `baixa`.
- `description_source`: origem: documento da linha + dados técnicos do banco.

Também manterei os campos atuais (`commercial_description` e `commercial_features`) para não quebrar a tela existente.

### 3. Mapear regras por linha e aplicação

Criar regras para cada linha:

- **MT**: resfriados, câmaras entre aproximadamente -4 °C e 8 °C, alta vazão, degelo por gás quente, condensador menos suscetível a obstrução.
- **LT**: congelados, câmaras entre aproximadamente -12 °C e -25 °C, degelo por gás quente e resistência auxiliar.
- **LT MAX**: congelados de maior exigência, subresfriamento adicional integrado, modelos maiores em Split.
- **BF**: blast freezing/congelamento rápido, temperaturas aproximadamente -20 °C a -35 °C, evaporador vertical de alta vazão e longo alcance, foco em processo severo.
- **HT**: climatizados/alta temperatura, aproximadamente 10 °C a 20 °C, fluidos de menor impacto ambiental conforme documento.
- **AGRO**: climatizados/agro, usar conteúdo do documento e dados do banco para descrever aplicação em conservação/climatização de produtos agro.
- **COMPACTice MT/LT**: criar descrição base usando o padrão da linha MT/LT, mas com linguagem de equipamento compacto/fechado, porque esses modelos estão sem descrição hoje.

### 4. Gerar textos por modelo com dados reais do catálogo

Para cada modelo, cruzar:

- dados gerais do modelo;
- faixa mínima/máxima de capacidade nos pontos de performance;
- faixa de temperatura de câmara;
- potência elétrica mínima/máxima;
- vazão de evaporador/condensador;
- tipo de gabinete;
- descrição e vantagens extraídas do documento da linha.

Assim, a descrição deixa de ser apenas “linha LT” ou “linha MT” e passa a refletir o tamanho e a aplicação real daquele modelo.

### 5. Ajustar a tela do catálogo

No detalhe do modelo, melhorar a aba “Geral” para exibir uma área mais clara:

- título: **Descrição inteligente do modelo**;
- resumo comercial em destaque;
- chips de aplicação recomendada;
- cards com dados importantes: faixa de temperatura, capacidade, vazão, potência e gabinete;
- listas separadas de **Diferenciais comerciais** e **Diferenciais técnicos**;
- origem da descrição, para saber se veio do documento LT, MT, BF etc.

Também posso adicionar um pequeno indicador na listagem do catálogo dizendo quais modelos já têm descrição inteligente.

## Implementação técnica

- Criar migration para os novos campos no catálogo.
- Processar os documentos enviados e extrair as regras por linha.
- Fazer atualização em lote dos modelos no banco, com `UPDATE` por modelo/linha.
- Não alterar os arquivos gerados automaticamente do backend.
- Atualizar `ColdProModelDetailDialog.tsx` para renderizar os novos blocos.
- Atualizar a listagem do catálogo se necessário para mostrar status da descrição.
- Preservar as descrições existentes e preencher os novos campos sem apagar histórico.

## Resultado esperado

Depois da implementação, cada modelo terá uma descrição mais útil para proposta comercial e seleção técnica, combinando:

```text
Documento da linha + dados reais do modelo + aplicação + porte do equipamento
```

Isso deixa o catálogo mais inteligente para o vendedor escolher o equipamento e explicar rapidamente por que aquele modelo se aplica ao projeto.