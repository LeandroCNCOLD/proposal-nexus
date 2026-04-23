

## Diagnóstico: lentidão no editor de propostas

Você está percebendo lentidão no editor (rota `/app/propostas/.../editor`). Analisei a arquitetura e identifiquei os gargalos principais.

### O que está acontecendo (causas reais)

**1. PDF é regenerado do zero a cada alteração (gargalo principal)**
Hoje, toda vez que você muda qualquer campo na prévia ao vivo (`ProposalPreviewLive.tsx`), o fluxo é:
- Server function `generateProposalPdf` roda no Worker
- Renderiza o documento completo (capa + sobre + cases + clientes + escopo + características + equipamentos + investimento + impostos + garantia + contracapa) com `@react-pdf/renderer`
- Faz **upload** do PDF gerado para o storage do Lovable Cloud
- Gera **signed URL**
- O cliente faz `fetch` da URL, converte em **Blob**, e cria `URL.createObjectURL`

Cada ciclo desses leva vários segundos. Os PDFs de template têm imagens enormes embutidas (`cover_full` 6.4 MB, `about_full` 6 MB — vi nos logs), o que multiplica o tempo de render e o tamanho do upload/download.

**2. Sem debounce agressivo / sem cancelamento**
Se você digita rápido, várias gerações de PDF disparam em paralelo (ou enfileiradas) e nenhuma é cancelada. A última vence, mas todas consomem CPU do Worker e largura de banda.

**3. Cada save dispara recarga total**
Salvar um bloco invalida toda a query do documento, que recarrega proposta + template + assets + anexos + tabelas. Não há atualização incremental.

**4. Imagens do template não são otimizadas**
PNGs de 6 MB são embarcados como base64 no PDF a cada render. Isso é lento no Worker (CPU + memória) e pesado no transporte.

**5. TipTap com várias extensões**
RichTextEditor agora carrega Image + Table + TableRow + TableCell + TableHeader + StarterKit. Em páginas com muitos blocos rich-text, cada instância tem custo de mount.

### Plano de otimização (ordem de impacto)

**Fase A — Ganhos imediatos (fazer primeiro)**

1. **Debounce + cancelamento na prévia ao vivo**
   - Aumentar debounce de regeneração de PDF para ~1.5s após a última edição
   - Usar `AbortController` para cancelar a geração anterior quando uma nova começa
   - Usar `useMutation` do TanStack Query com `mutationKey` para deduplicar

2. **Modo "preview rápido" sem upload**
   - Criar variante `mode: "preview-inline"` em `generateProposalPdf` que retorna o PDF como **base64/binário diretamente na resposta**, pulando upload + signed URL
   - Cliente cria Blob direto da resposta. Elimina 2 round-trips (upload + fetch).

3. **Botão "Atualizar prévia" opcional**
   - Adicionar toggle "Auto-atualizar" (default ligado mas com debounce maior); quando desligado, prévia só atualiza ao clicar em "Atualizar". Útil quando o usuário sabe que vai fazer várias edições seguidas.

**Fase B — Otimização das imagens do template**

4. **Comprimir imagens do template**
   - Reprocessar `cover_full` e `about_full` para JPEG ~85% qualidade, redimensionar para no máx 2000px no maior lado. Esperado: 6 MB → ~400 KB cada.
   - Cachear os bytes das imagens no servidor entre renders consecutivos da mesma proposta.

5. **Lazy-load de assets no PDF**
   - Carregar do storage só os assets das páginas visíveis no template em vez de todos.

**Fase C — Render incremental (se ainda for lento depois de A e B)**

6. **Render parcial por página**
   - Permitir gerar só a(s) página(s) afetada(s) pela última edição (ex.: editou capa → regera só a capa). Requer mudanças no `ProposalDocument` para suportar render seletivo + merge no cliente.

7. **Preview HTML em vez de PDF para edição**
   - Usar `EditorPreviewStub` (HTML/CSS) durante edição ativa, e só gerar PDF real ao salvar / clicar "Visualizar PDF". O HTML já existe no projeto — basta promovê-lo a default em modo edição.

### Detalhes técnicos

```text
Fluxo atual (lento):
[edit] → debounce → genPdf server → @react-pdf render (~2-4s)
       → upload storage (~500ms-1s) → sign URL (~200ms)
       → client fetch PDF (~500ms-2s) → Blob → iframe

Fluxo proposto Fase A:
[edit] → debounce 1.5s + abort prev → genPdf inline mode
       → @react-pdf render → return base64 in response
       → client Blob → iframe
       (corta upload + sign + fetch externo)
```

Arquivos que mudam na Fase A:
- `src/integrations/proposal-editor/server.functions.ts` — adicionar `mode: "preview-inline"` que retorna `{ contentBase64, mime }`
- `src/components/proposal-editor/ProposalPreviewLive.tsx` — debounce maior, AbortController, consumir base64
- (opcional) toggle "Auto-atualizar" no painel da prévia

### Pergunta antes de implementar

Quer que eu **comece pela Fase A** (debounce + cancelamento + preview inline sem upload — maior ganho com menor risco) e depois meçamos novamente, ou prefere começar pela **compressão das imagens do template** (Fase B), que também tem impacto grande mas exige reprocessar e re-upar os assets?

