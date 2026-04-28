## Plano para corrigir o fator de segurança (base no subtotal global do projeto)

### Objetivo
Garantir que o **fator de segurança (%)** seja aplicado sobre o **subtotal total do projeto**:

- Total Ambiente
- Total Produto/Processo
- Total Cargas Extras

E então:

- Segurança = Subtotal Projeto × (%)
- Total Projeto = Subtotal Projeto + Segurança

---

## O que vou ajustar

### 1) Alinhar a prévia da Etapa 3 com a regra global
Hoje, na Etapa 3, a prévia local de segurança usa o subtotal da própria aba de extras. Vou mudar para exibir a segurança sobre o subtotal global do projeto.

**Arquivo principal:** `src/routes/app.coldpro.$id.tsx`

**Ação:**
- Calcular um `projectSubtotalPreview` combinando:
  - carga de ambiente
  - carga de produto/processo
  - carga extras (sem segurança)
- Calcular `projectSafetyPreview` usando `safety_factor_percent` do ambiente
- Calcular `projectTotalWithSafetyPreview`
- Usar esses valores na seção de resumo da Etapa 3 para não parecer que segurança é “só da aba extras”.

---

### 2) Corrigir os textos/descrições para evitar ambiguidade
Atualmente o texto da aba sugere aplicação local (“sobre o subtotal calculado”). Vou ajustar para explicitar que é **subtotal do projeto**.

**Arquivo principal:** `src/components/coldpro/ColdProExtraLoadsForm.tsx`

**Ação:**
- Atualizar descrição de “Fator de segurança” para algo como:
  - “Margem aplicada sobre o subtotal total do projeto (ambiente + produto/processo + extras).”
- Manter o campo percentual no mesmo lugar (Etapa 3), mas deixar claro que o efeito é global.

---

### 3) Preservar o motor térmico (sem mexer na física)
O cálculo consolidado já fecha com a lógica desejada no motor (subtotal consolidado e segurança aplicada por percentual). Vou manter isso intacto e só garantir consistência de exibição e entendimento.

**Arquivo de conferência:** `src/features/coldpro/coldpro-calculation.engine.ts`

**Ação:**
- Não alterar fórmula física existente.
- Confirmar que `subtotal_kcal_h`, `safety_kcal_h` e `total_required_kcal_h` continuam:
  - subtotal consolidado de todas as parcelas
  - segurança sobre esse subtotal
  - total final = subtotal + segurança

---

### 4) Ajustar resumos para não duplicar nem omitir segurança
Validar os cards e resumos para que segurança apareça uma única vez no fechamento global.

**Arquivos de conferência/ajuste:**
- `src/components/coldpro/ColdProSectionLoadSummary.tsx`
- `src/components/coldpro/ColdProResultCard.tsx`

**Ação:**
- Garantir que “subtotal” e “segurança” não sejam somados duas vezes em prévias.
- Garantir linguagem consistente: subtotal técnico global, segurança global, total requerido.

---

## Validação após implementação

1. Alterar `% segurança` com valores de ambiente/produto/extras preenchidos e conferir:
   - Segurança = percentual × subtotal global
   - Total = subtotal global + segurança
2. Recarregar a página e confirmar que o valor salvo mantém o mesmo fechamento.
3. Executar recálculo do ambiente e validar que resultado final bate com prévia.
4. Conferir cenários com e sem túnel/processo para garantir consistência.

---

## Detalhes técnicos (resumo)
- **Escopo principal:** UI e consistência de exibição.
- **Sem alteração de física/engine principal**, apenas correção da base exibida na etapa de extras.
- **Fonte da verdade final continua no cálculo consolidado** (`calculateColdProLoad`).