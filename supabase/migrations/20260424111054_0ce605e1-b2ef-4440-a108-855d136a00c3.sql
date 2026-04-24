-- Etapa 9 - Fase 1: Hard refactor do schema de proposal_documents para Page Builder com Blocos Inteligentes
-- Drop colunas legadas (cover_data, context_data, solution_data, scope_items, warranty_text, custom_blocks, manually_edited_fields)
-- Reset coluna pages para [] (novo schema: DocumentPage { id, type, title, order, visible, blocks: DocumentBlock[] })

ALTER TABLE public.proposal_documents
  DROP COLUMN IF EXISTS cover_data,
  DROP COLUMN IF EXISTS context_data,
  DROP COLUMN IF EXISTS solution_data,
  DROP COLUMN IF EXISTS scope_items,
  DROP COLUMN IF EXISTS warranty_text,
  DROP COLUMN IF EXISTS custom_blocks,
  DROP COLUMN IF EXISTS manually_edited_fields;

-- Reset pages de todas as propostas existentes (refator hard, sem retrocompat)
UPDATE public.proposal_documents
SET pages = '[]'::jsonb,
    auto_filled_at = NULL,
    template_version = 'cn-cold-v2-blocks';

-- Bump template_version default para o novo schema
ALTER TABLE public.proposal_documents
  ALTER COLUMN template_version SET DEFAULT 'cn-cold-v2-blocks';