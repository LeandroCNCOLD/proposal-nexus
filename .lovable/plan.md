Vou corrigir a falha **“WinAnsi cannot encode”** na geração do memorial/PDF do ColdPro.

## Causa identificada

O PDF usa fonte padrão do gerador atual, que não aceita emojis/símbolos fora da codificação básica. A análise técnica pode chegar com caracteres como alerta/emoji, e o PDF quebra ao medir ou desenhar esse texto.

## Correção proposta

1. **Fortalecer a limpeza de texto do PDF**
   - Atualizar a função de sanitização em `coldproMemorialPdfLib.ts` para remover/substituir:
     - emojis
     - pictogramas
     - símbolos privados
     - caracteres invisíveis/problemáticos
     - bullets e símbolos especiais não suportados pela fonte padrão
   - Exemplo: transformar alerta/emoji em texto simples como `[Alerta]` ou remover quando não agregar informação.

2. **Garantir sanitização em todos os pontos de escrita**
   - Revisar chamadas de `drawText`, `paragraph`, `table`, rodapé e laudo final para que todo texto dinâmico passe por `clean()`.
   - Corrigir qualquer ponto que ainda escreva texto dinâmico diretamente.

3. **Proteger o laudo da IA antes do PDF**
   - Sanitizar `aiAnalysis` antes de renderizar no PDF.
   - Isso evita que respostas futuras da IA com emojis ou caracteres especiais voltem a quebrar o memorial.

4. **Validação**
   - Rodar build/typecheck.
   - Gerar/validar o fluxo de PDF novamente para confirmar que o erro não ocorre mais.

## Resultado esperado

O memorial técnico volta a ser gerado normalmente, mesmo quando a análise automática trouxer símbolos, alertas ou caracteres especiais.