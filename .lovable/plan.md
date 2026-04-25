Plano para criar uma versão modernizada da tela Kitfrigor dentro da aba Ambiente do CN ColdPro.

## Objetivo
Transformar a aba “Dimensões e painéis” em uma tela técnica mais visual, parecida com o fluxo usado hoje no Kitfrigor, mas com UI moderna e integrada ao cálculo atual do ColdPro.

## 1. Layout modernizado da aba Ambiente

Reorganizar a aba para seguir esta lógica:

```text
Dados psicrométricos
↓
Escolha da geometria da câmara
↓
Dimensões externas A, B, C, D, E, F e altura H
↓
Insolação / face selecionada
↓
Tabela de teto, piso e laterais
↓
Resumo final: volume, área de piso/teto, área de paredes e carga térmica
```

A interface continuará no padrão visual do sistema atual, mas usando o layout da imagem como referência funcional.

## 2. Dados psicrométricos

Adicionar/organizar os campos no topo da aba:

- Temperatura externa °C
- Temperatura interna °C
- Umidade relativa externa %
- Umidade relativa interna %
- Pressão atmosférica kPa
- Tempo de processo h

Campos já existentes serão reaproveitados quando possível:

- Temperatura externa: `external_temp_c`
- Temperatura interna: `internal_temp_c`
- Umidade interna: `relative_humidity_percent`
- Tempo de processo: usar operação diária / tempo de processo conforme o fluxo atual

Campos novos necessários:

- `external_relative_humidity_percent`
- `atmospheric_pressure_kpa`

## 3. Geometria visual da câmara

Substituir/expandir os cards atuais de formato por opções visuais mais claras:

- Retangular
- Em L simples
- Em L com recorte duplo / irregular
- Personalizada

Cada opção terá um desenho SVG próprio, com cotas A, B, C, D, E, F e H, inspirado na imagem enviada, mas redesenhado em estilo moderno.

## 4. Dimensões A–F + H

Adicionar campos técnicos de cotas:

- Dim. A
- Dim. B
- Dim. C
- Dim. D
- Dim. E
- Dim. F
- Altura H

Mapeamento inicial:

- A/C podem representar comprimentos principais
- B/D larguras/profundidades
- E/F recortes conforme geometrias em L/irregular
- H altura

A lógica de cálculo será atualizada para gerar automaticamente:

- área de piso
- área de teto
- quantidade de paredes
- comprimentos das paredes
- volume interno final

Para geometrias personalizadas, manter edição manual por face.

## 5. Insolação por face

Criar um bloco lateral parecido com a referência:

- seletor da face principal / face norte
- preview pequeno da câmara
- opção “Piso com isolamento?”
- seleção rápida da face ativa: Teto, Piso, Lateral 1, Lateral 2, etc.

Isso vai controlar/editar a linha correspondente na tabela de faces.

## 6. Tabela técnica de faces

Modernizar a tabela existente para ficar mais parecida com a ferramenta atual, mas mantendo os recursos novos:

Colunas principais:

- Local: Teto, Piso, Lateral 1, Lateral 2...
- Material / Espessura
- Camadas térmicas
- Temperatura externa da face
- Orientação solar
- Cor
- Área vidro m²
- Tipo de vidro
- Área porta m²
- Área painel m²
- U calculado

A coluna “Material / Espessura” poderá ser preenchida automaticamente com a camada principal, por exemplo:

```text
Painel isotérmico PUR - 100mm
```

E o botão “Camadas” continuará abrindo a montagem detalhada:

```text
Aço 0,5 mm + PUR 100 mm + Aço 0,5 mm
```

## 7. Integração com cálculo

Atualizar o motor para usar as novas dimensões A–F/H e as faces geradas.

Prioridade de cálculo:

1. Se a face tiver área manual, usar área manual.
2. Se a geometria gerar área automaticamente, usar área calculada.
3. Se a face tiver camadas, calcular U por camadas.
4. Se não tiver camadas, usar fallback por material/espessura global para manter compatibilidade.

## 8. Banco de dados

Criar migration para adicionar os campos faltantes em `coldpro_environments`:

- `external_relative_humidity_percent`
- `atmospheric_pressure_kpa`
- `dimension_a_m`
- `dimension_b_m`
- `dimension_c_m`
- `dimension_d_m`
- `dimension_e_m`
- `dimension_f_m`

Os campos atuais `length_m`, `width_m`, `height_m` serão mantidos para compatibilidade e sincronizados com as dimensões principais.

## 9. Resultado visual

Na própria aba Ambiente, colocar um resumo final no rodapé da aba, após a tabela:

- Volume interno final
- Área de piso
- Área de teto
- Área total de paredes
- Área total de painéis
- Carga térmica de transmissão, quando já calculada

Isso segue sua orientação anterior: volume e áreas aparecem no final, depois de preencher as medidas.

## 10. Validação

Após implementar:

- Validar TypeScript.
- Gerar build de produção.
- Conferir que projetos antigos continuam funcionando.
- Testar que o cálculo de volume e áreas sai da geometria/cotas e da tabela de faces.
- Garantir que a tabela de materiais térmicos e camadas continue integrada ao cálculo U.