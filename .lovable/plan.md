# Plano de implementação — Melhorias de Layout CN ColdPro

## Objetivo
Reorganizar a ferramenta CN ColdPro para ficar mais clara, visual e segura, usando as referências do SELECT COLD e a análise enviada: abas bem definidas, formulários agrupados, validação visual, prévias de cálculo por etapa e resultado mais legível.

## Estrutura final do fluxo
Manter o fluxo principal em 4 etapas, como definido anteriormente:

```text
Ambiente → Produtos → Cargas Extras → Resultado
```

A aba antiga de “Renovação de Ar” da referência será absorvida em “Cargas Extras”, porque tecnicamente pertence às cargas de infiltração/renovação. A aba “Cadastro inicial” será representada no cabeçalho/projeto e sidebar, sem virar uma etapa extra obrigatória.

## 1. Componentes base de formulário
Criar componentes reutilizáveis para padronizar o ColdPro:

- `ColdProFormSection`: card/seção com título, descrição e ícone.
- `ColdProFieldHint`: ajuda curta/tooltip para campos técnicos.
- `ColdProValidationMessage`: mensagens de alerta/erro abaixo do campo.
- `ColdProCalculatedInfo`: blocos de cálculo automático, como volume, ΔT, kg/h esperado, throughput.

Esses componentes usarão os tokens semânticos já existentes (`primary`, `muted`, `border`, `warning`, `success`, etc.), sem cores diretas hardcoded.

## 2. Refatorar Ambiente
Atualizar `ColdProEnvironmentForm.tsx` para ficar dividido em abas internas:

```text
Dados gerais | Dimensões | Condições | Isolamento
```

Campos por grupo:

- Dados gerais: nome, tipo de aplicação, operação diária, tempo de compressor.
- Dimensões: comprimento, largura, altura, volume calculado.
- Condições: temperatura interna, temperatura externa, temperatura sob piso, umidade quando for climatizado/sementes.
- Isolamento: material, parede, teto, piso, piso isolado.

Adicionar validações visuais:

- dimensões devem ser maiores que zero;
- compressor e operação entre 0 e 24 h/dia;
- fator de segurança não negativo;
- alertas quando valores essenciais estiverem ausentes.

## 3. Refatorar Produtos
Atualizar `ColdProProductForm.tsx` para usar seções/accordion:

```text
Catálogo ASHRAE
Movimentação e processo
Temperaturas e propriedades térmicas
Embalagem
```

Melhorias:

- manter seleção por grupo ASHRAE primeiro e produto depois;
- ao selecionar produto, carregar automaticamente propriedades térmicas já mapeadas;
- mostrar `kg/h esperado = kg/dia / horas de processo`;
- mostrar ΔT do produto;
- separar dados operacionais de propriedades técnicas;
- melhorar campos de densidade, condutividade, fração de água congelável e espessura característica.

Validações:

- produto obrigatório;
- massa diária/hora não negativa;
- tempo de processo maior que zero;
- aviso quando massa horária divergir muito da massa diária dividida pelo tempo;
- alerta quando temperatura final for incoerente com entrada para resfriamento/congelamento.

## 4. Refatorar Túnel
Atualizar `ColdProTunnelForm.tsx`, hoje o mais compacto, para layout em abas internas:

```text
Configuração | Produto | Ar e processo | Cargas internas
```

Melhorias:

- separar tipo de túnel e modo de operação;
- agrupar dados físicos do produto;
- calcular throughput previsto: unidades/ciclo × peso unitário × ciclos/h;
- agrupar temperatura do ar, velocidade, tempo de retenção e propriedades térmicas;
- destacar tempo estimado/conferência de retenção quando disponível pelo motor de cálculo;
- agrupar motor de esteira, ventiladores internos, embalagem e outras cargas.

## 5. Refatorar Cargas Extras
Atualizar `ColdProExtraLoadsForm.tsx` para refletir melhor as telas de referência:

```text
Infiltração / Renovação de ar
Pessoas e iluminação
Motores e outras cargas
Segurança
```

Melhorias:

- destacar renovação/infiltração como bloco próprio;
- reorganizar pessoas, iluminação, motores, ventiladores, degelo e outras cargas;
- mostrar prévia da carga térmica total da etapa quando já houver resultado calculado;
- adicionar validações para valores negativos e horas fora de 0–24.

## 6. Melhorar Resultado
Atualizar `ColdProResultCard.tsx` para ter hierarquia e visualização:

- cards principais: carga requerida, kW, TR;
- breakdown agrupado:
  - Ambiente: transmissão;
  - Produto: produto, embalagem, respiração/túnel;
  - Extras: infiltração, pessoas, iluminação, motores, ventiladores, degelo, outras;
  - Segurança;
- barras percentuais de participação por carga usando tokens de chart;
- resumo final semelhante à referência: capacidade requerida, fator de segurança, total;
- manter integração existente com seleção de equipamento e relatório.

## 7. Melhorar layout principal
Atualizar `app.coldpro.$id.tsx`:

- manter sidebar de ambientes, mas deixá-la mais visual com ícones e melhor seleção;
- melhorar espaçamento geral e largura dos cards;
- garantir scroll da lista de ambientes quando houver muitos ambientes;
- manter o stepper superior de 4 etapas;
- preservar os cards de prévia de carga por etapa;
- evitar empilhar informações demais sem separação.

## 8. Validação client-side e server-side
Adicionar validação de entrada com schemas Zod compartilhados ou auxiliares consistentes:

- client-side: feedback visual antes de salvar;
- server-side: reforçar os `.inputValidator()` em `coldpro.functions.ts` com limites e mensagens mais seguras;
- sanitizar strings com `trim()` e limitar tamanho de nomes;
- impedir números inválidos, `NaN`, infinitos e valores negativos onde não fizer sentido.

Nenhuma mudança de banco é necessária inicialmente, porque os campos já existem após as migrações anteriores.

## 9. QA e validação
Após aprovação e implementação:

- rodar `bunx tsc --noEmit`;
- rodar `bun run build`;
- abrir a rota ColdPro no preview;
- validar as 4 etapas visualmente;
- testar seleção grupo ASHRAE → produto → preenchimento automático;
- testar salvamento de ambiente, produto/túnel e cargas extras;
- confirmar que o cálculo chega ao resultado sem erro;
- revisar console e rede para falhas.

## Arquivos previstos

- `src/components/coldpro/ColdProEnvironmentForm.tsx`
- `src/components/coldpro/ColdProProductForm.tsx`
- `src/components/coldpro/ColdProTunnelForm.tsx`
- `src/components/coldpro/ColdProExtraLoadsForm.tsx`
- `src/components/coldpro/ColdProResultCard.tsx`
- `src/components/coldpro/ColdProField.tsx`
- `src/components/coldpro/ColdProStepper.tsx`
- `src/components/coldpro/ColdProSectionLoadSummary.tsx`
- `src/routes/app.coldpro.$id.tsx`
- `src/features/coldpro/coldpro.functions.ts`

## Resultado esperado
A ferramenta continuará funcional, mas com aparência mais próxima da referência SELECT COLD: navegação clara, formulários organizados por assunto, menos confusão visual, validação imediata e resultado com leitura técnica mais profissional.