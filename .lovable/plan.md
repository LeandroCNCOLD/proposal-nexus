## Onde colocar o memorial técnico

O texto que você enviou cabe nas páginas que o editor já tem — basta distribuir:

| Trecho | Página (já existe) |
|---|---|
| "Objetivo do Projeto" + critérios técnicos | **Contextualização** |
| "Solução Proposta para a Operação" (3 câmaras) | **Nossa solução** |
| "Diferenciais Técnicos da Solução" | **Diferenciais** |
| "Impacto Direto na Operação" + fechamento | **Impacto esperado** |

Vou adicionar também um botão **Duplicar página** na sidebar lateral, pra você criar várias páginas de Solução/Diferenciais com mesmo layout/fundo quando o conteúdo for grande.

## Assistente de IA com foco em vendas (PNL + escrita técnico-comercial)

Vou plugar a IA (Lovable AI Gateway, modelo `google/gemini-3-flash-preview`) em **todo campo de texto rico** do editor (`RichTextEditor`) — usado em Contextualização, Solução, Diferenciais, Impacto, Garantia, Página livre, Nota, Escopo, "Sobre", caixas de texto livres, etc.

### Como vai aparecer

Botão **✨ IA Vendas** na barra de ferramentas. Ao clicar, abre um popover com ações organizadas em 3 grupos:

**📝 Escrita técnica**
1. **Melhorar escrita** — corrige gramática, fluidez, clareza técnica.
2. **Resumir** — versão curta do trecho.
3. **Expandir** — desenvolve com profundidade técnica.
4. **Sugerir continuação** — completa a partir do cursor.
5. **Reescrever em bullets** — transforma parágrafo em lista.

**💼 Vendas e persuasão (PNL)**
6. **Tom consultivo** — reescreve como consultor especialista, gera autoridade.
7. **Foco em benefícios (não features)** — converte características técnicas em ganhos para o cliente (ROI, redução de perdas, eficiência energética, previsibilidade).
8. **Gatilhos PNL** — aplica âncoras de prova social, escassez, autoridade, reciprocidade e urgência calibradas para B2B industrial.
9. **Storytelling de problema → solução** — reestrutura em narrativa "dor do cliente → consequência → nossa solução → resultado".
10. **Quebra de objeções** — antecipa objeções comuns (preço, prazo, manutenção, garantia) e responde no próprio texto.
11. **Call-to-action de fechamento** — adiciona CTA suave/forte ao final.

**🎯 Análise**
12. **Analisar texto** — devolve um diagnóstico (não substitui o texto): clareza, tom, gatilhos presentes/ausentes, objeções não tratadas, score de persuasão 0–10, e 3 sugestões pontuais.
13. **Comparar variações** — gera 2 versões alternativas (uma mais técnica, uma mais comercial) lado a lado.

**Prompt livre** — caixa de texto pra você descrever ("Reescreva como se fosse pro diretor industrial", "Adapte tom para licitação pública", etc.).

O resultado aparece num **preview com diff** (antes / depois). Botões: **Aplicar**, **Inserir abaixo** ou **Descartar**. Se nada estiver selecionado, opera no bloco inteiro.

### Por trás (parte técnica)

- **Nova server function** `aiAssistText` em `src/integrations/proposal-editor/ai.functions.ts` (`createServerFn`, POST). Validação Zod: `{ action: enum, text: string, instruction?: string, contextHint?: string }`. Chama `https://ai.gateway.lovable.dev/v1/chat/completions` com `LOVABLE_API_KEY` (já está nos secrets).
- **Prompt de sistema especializado**: persona de "copywriter sênior B2B industrial + engenheiro de vendas em refrigeração". Inclui princípios PNL aplicados a vendas técnicas (rapport, calibragem, ancoragem, reframing, future pacing), framework de copy (PAS — Problem/Agitate/Solve, AIDA, FAB — Feature/Advantage/Benefit), tom consultivo Sandler/SPIN. Cada ação tem seu sub-prompt instruindo qual técnica aplicar.
- **Trata erros**: 429 → "Limite de uso atingido, aguarde um instante", 402 → "Créditos da IA esgotados, recarregue na configuração". Toast amigável.
- **Novo componente** `src/components/proposal-editor/AIAssistButton.tsx`: botão na toolbar + Popover com as 3 abas de ações + textarea de prompt livre + Dialog de preview do resultado com Aplicar/Inserir/Descartar.
- **Integração no `RichTextEditor`**: lê `editor.state.selection` (ou texto inteiro se vazio); aplica via `editor.chain().focus().insertContentAt(range, html).run()`.
- **Hint contextual**: o `BlockRenderer` passa `contextHint` (ex.: `"página: Nossa Solução, cliente: <nome>, valor proposta: R$ X"`) puxando dados da proposta atual (cliente, valor) para a IA gerar texto coerente e personalizado.

## Arquivos afetados

- novo `src/integrations/proposal-editor/ai.functions.ts`
- novo `src/components/proposal-editor/AIAssistButton.tsx`
- editado `src/components/proposal-editor/RichTextEditor.tsx` (botão IA + props de contexto)
- editado `src/components/proposal-editor/BlockRenderer.tsx` (passa contextHint)
- editado `src/components/proposal-editor/PageSidebar.tsx` (botão Duplicar página)

## Fora do escopo (faço depois se quiser)

- IA dentro de células de tabela (Equipamentos/Investimento).
- Análise da proposta inteira de uma vez (score global de persuasão).
- Histórico de gerações da IA / "desfazer IA" com versões salvas.
- Pré-popular automaticamente as 4 páginas com seu memorial — posso fazer num passo seguinte se confirmar.

Confirma que sigo?