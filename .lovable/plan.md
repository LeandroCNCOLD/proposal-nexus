

## Migração `proposal_tables` — análise e plano de adoção

Você colou uma migração SQL que **redesenha** a tabela `proposal_tables`. Hoje a tabela já existe no banco com um schema diferente do que a sua migração propõe. Antes de aplicar é preciso decidir como conciliar.

### Comparação: schema atual × schema proposto

| Coluna | Hoje | Proposto | Observação |
|---|---|---|---|
| `id` | uuid pk | uuid pk | igual |
| `proposal_id` | uuid (sem FK) | uuid + **FK ON DELETE CASCADE** | proposto é melhor |
| `page_id` | text **NOT NULL** | text **NULL** | muda nulabilidade |
| `type` | text NOT NULL | renomeada para `table_type` | **breaking** |
| `title` | text | text | igual |
| — | — | `subtitle` text | nova |
| `rows` | jsonb | jsonb | igual |
| `columns` | jsonb | **removida** (vai para `settings.columns`) | **breaking** |
| — | — | `settings` jsonb | nova |
| — | — | `sort_order` int | nova |
| — | — | `created_by`, `updated_by` | novas |
| `created_at`/`updated_at` | sim | sim | igual |
| Unique | `(proposal_id, page_id)` | `(proposal_id, coalesce(page_id,''), table_type, sort_order)` | permite múltiplas tabelas por página |
| Trigger updated_at | não tem | tem | proposto é melhor |
| RLS | select=true / modify autenticado | select/insert/update/delete autenticado | equivalente |

### Impacto no código atual

A migração quebra os seguintes pontos do código que já está em produção:

1. **`src/integrations/proposal-editor/tables.functions.ts`** — usa `type`, `columns`, e o conflict target `proposal_id,page_id`. Tudo precisa ser atualizado para `table_type`, `settings`, e novo conflict target.
2. **`src/integrations/proposal-editor/types.ts`** — o type `ProposalTable` reflete colunas antigas.
3. **`src/components/proposal-editor/blocks/StructuredTableEditor.tsx`** e **`TableBlockEditor.tsx`** — leem/escrevem `columns` direto.
4. **Renderer PDF** (`ContentPages.tsx`/`StandardPage.tsx`) — consome `columns` direto.
5. **`src/integrations/supabase/types.ts`** — regenerado automaticamente após a migração.

### Decisão necessária

Existem 3 caminhos possíveis. Escolha um:

**Opção A — Adotar a migração nova como veio (recomendado se a tabela ainda não tem dados em produção)**
- Aplica a migração exata que você colou + um `ALTER TABLE` prévio que **dropa** a tabela antiga (ou renomeia colunas) para evitar conflito.
- Atualiza todo o código (server functions, types, editores, PDF) para o novo schema (`table_type`, `settings.columns`, `sort_order`).
- Ganhos: FK com cascade, múltiplas tabelas por página (sort_order), trigger de updated_at, settings flexível, helper `proposal_table_default_settings`.
- Custo: ~5 arquivos editados + perda dos dados atuais em `proposal_tables` (se houver).

**Opção B — Migração não-destrutiva (preserva dados existentes)**
- Em vez de recriar a tabela, gera um `ALTER TABLE`:
  - `ADD COLUMN settings jsonb`, `subtitle`, `sort_order`, `created_by`, `updated_by`
  - `RENAME COLUMN type TO table_type`
  - Move `columns` existente para `settings->'columns'` via `UPDATE`, depois `DROP COLUMN columns`
  - `ALTER COLUMN page_id DROP NOT NULL`
  - Adiciona FK `proposal_id` com cascade
  - Substitui o unique por `(proposal_id, coalesce(page_id,''), table_type, sort_order)`
  - Cria trigger `set_proposal_tables_updated_at` e função `proposal_table_default_settings`
- Atualiza o mesmo código da Opção A.
- Ganhos: preserva linhas já criadas.
- Custo: migração mais cuidadosa + mesmos ~5 arquivos.

**Opção C — Não aplicar agora**
- Mantém o schema atual; descarta a migração.

### Detalhes técnicos (se Opção A ou B aprovada)

Arquivos a editar após a migração:

```text
supabase/migrations/<timestamp>_proposal_tables_redesign.sql   (novo)
src/integrations/proposal-editor/types.ts                       (renomear campos)
src/integrations/proposal-editor/tables.functions.ts            (table_type + settings + sort_order; novo onConflict)
src/components/proposal-editor/blocks/StructuredTableEditor.tsx (ler colunas de settings.columns)
src/components/proposal-editor/blocks/TableBlockEditor.tsx      (idem)
src/integrations/proposal-editor/pdf/ContentPages.tsx           (idem; usar settings.show_header etc.)
src/integrations/proposal-editor/pdf/StandardPage.tsx           (se relevante)
```

Após a migração rodar, `src/integrations/supabase/types.ts` é regenerado automaticamente — não editar à mão.

### Pergunta antes de avançar

Qual opção seguimos?

1. **A** — recriar a tabela conforme você colou (perde dados de `proposal_tables` se houver)
2. **B** — migração não-destrutiva preservando os dados existentes
3. **C** — não aplicar agora

Se A ou B, eu também já aplico no mesmo turno a atualização do código que consome essa tabela (server functions, types, editores e PDF).

