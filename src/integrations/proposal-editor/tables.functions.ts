// Server functions para tabelas estruturadas vinculadas a páginas de uma proposta
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProposalTable, TableColumn } from "./types";

const proposalIdSchema = z.object({ proposalId: z.string().uuid() });

export const listProposalTables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => proposalIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ tables: ProposalTable[] }> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("proposal_tables")
      .select("*")
      .eq("proposal_id", data.proposalId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { tables: (rows ?? []) as unknown as ProposalTable[] };
  });

const upsertSchema = z.object({
  proposalId: z.string().uuid(),
  pageId: z.string().min(1),
  tableType: z.string().min(1),
  title: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  rows: z.array(z.record(z.any())),
  columns: z.array(z.any()).nullable().optional(),
  settings: z.record(z.any()).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const upsertProposalTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Merge columns into settings if provided separately
    const settings: Record<string, unknown> = { ...(data.settings ?? {}) };
    if (data.columns !== undefined && data.columns !== null) {
      settings.columns = data.columns;
    }
    const payload = {
      proposal_id: data.proposalId,
      page_id: data.pageId,
      table_type: data.tableType,
      title: data.title ?? null,
      subtitle: data.subtitle ?? null,
      rows: data.rows as never,
      settings: settings as never,
      sort_order: data.sortOrder ?? 0,
    };
    const { data: row, error } = await supabase
      .from("proposal_tables")
      // unique index uq_proposal_tables_proposal_page_type_sort
      .upsert(payload as never, {
        onConflict: "proposal_id,page_id,table_type,sort_order",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { table: row as unknown as ProposalTable };
  });

export const deleteProposalTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("proposal_tables").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Importa tributos da proposta Nomus correspondente para a tabela "impostos"
 * de uma página. Sobrescreve as linhas existentes na página.
 */
export const importNomusTributos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        proposalId: z.string().uuid(),
        pageId: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { proposalId, pageId } = data;

    const { data: proposal, error: pErr } = await supabase
      .from("proposals")
      .select("nomus_proposal_id, nomus_id")
      .eq("id", proposalId)
      .single();
    if (pErr) throw new Error(pErr.message);

    const nomusKey = proposal.nomus_proposal_id ?? proposal.nomus_id;
    if (!nomusKey) throw new Error("Proposta não está vinculada ao Nomus.");

    const { data: np } = await supabase
      .from("nomus_proposals")
      .select(
        "valor_produtos, icms_recolher, icms_st_recolher, ipi_recolher, pis_recolher, cofins_recolher, issqn_recolher, simples_nacional_recolher, cbs_recolher, ibs_recolher, ibs_estadual_recolher",
      )
      .eq("nomus_id", nomusKey)
      .maybeSingle();
    if (!np) throw new Error("Proposta Nomus não encontrada / sem detalhes sincronizados.");

    const base = Number(np.valor_produtos ?? 0);
    const tributos: Array<{ tributo: string; valor: number }> = [
      { tributo: "ICMS", valor: Number(np.icms_recolher ?? 0) },
      { tributo: "ICMS-ST", valor: Number(np.icms_st_recolher ?? 0) },
      { tributo: "IPI", valor: Number(np.ipi_recolher ?? 0) },
      { tributo: "PIS", valor: Number(np.pis_recolher ?? 0) },
      { tributo: "COFINS", valor: Number(np.cofins_recolher ?? 0) },
      { tributo: "ISSQN", valor: Number(np.issqn_recolher ?? 0) },
      { tributo: "Simples Nacional", valor: Number(np.simples_nacional_recolher ?? 0) },
      { tributo: "CBS", valor: Number(np.cbs_recolher ?? 0) },
      { tributo: "IBS", valor: Number(np.ibs_recolher ?? 0) },
      { tributo: "IBS Estadual", valor: Number(np.ibs_estadual_recolher ?? 0) },
    ];

    const rows = tributos
      .filter((t) => t.valor > 0)
      .map((t) => ({
        tributo: t.tributo,
        aliquota: base > 0 ? Number(((t.valor / base) * 100).toFixed(2)) : null,
        base_calculo: base,
        valor: t.valor,
      }));

    const { data: row, error } = await supabase
      .from("proposal_tables")
      .upsert(
        {
          proposal_id: proposalId,
          page_id: pageId,
          table_type: "impostos",
          title: "Tributação (Nomus)",
          rows: rows as never,
          settings: {} as never,
          sort_order: 0,
        } as never,
        { onConflict: "proposal_id,page_id,table_type,sort_order" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { table: row, count: rows.length };
  });

/**
 * Popula a tabela "equipamentos" de uma página com os itens (`proposal_items`)
 * da proposta. Sobrescreve as linhas existentes da página.
 */
export const populateEquipamentosFromItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        proposalId: z.string().uuid(),
        pageId: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { proposalId, pageId } = data;

    const { data: items, error: iErr } = await supabase
      .from("proposal_items")
      .select("description, quantity, notes, position")
      .eq("proposal_id", proposalId)
      .order("position", { ascending: true });
    if (iErr) throw new Error(iErr.message);

    const localItems = items ?? [];

    let rows: Array<Record<string, unknown>> = [];

    if (localItems.length > 0) {
      rows = localItems.map((it) => ({
        modelo: (it.description ?? "").split(" - ")[0] ?? it.description ?? "",
        descricao: it.description ?? "",
        quantidade: Number(it.quantity ?? 1),
        unidade: "un",
      }));
    } else {
      // fallback: itens da proposta Nomus
      const { data: proposal } = await supabase
        .from("proposals")
        .select("nomus_proposal_id, nomus_id")
        .eq("id", proposalId)
        .single();
      const nomusKey = proposal?.nomus_proposal_id ?? proposal?.nomus_id;
      if (nomusKey) {
        const { data: np } = await supabase
          .from("nomus_proposals")
          .select("id")
          .eq("nomus_id", nomusKey)
          .maybeSingle();
        if (np) {
          const { data: nomusItems } = await supabase
            .from("nomus_proposal_items")
            .select("description, product_code, quantity, unit_value_with_unit")
            .eq("nomus_proposal_id", (np as { id: string }).id)
            .order("position", { ascending: true });
          rows = (nomusItems ?? []).map((it) => ({
            modelo: it.product_code ?? "",
            descricao: it.description ?? "",
            quantidade: Number(it.quantity ?? 1),
            unidade: it.unit_value_with_unit ?? "un",
          }));
        }
      }
    }

    if (rows.length === 0) {
      throw new Error("Nenhum item encontrado na proposta para popular.");
    }

    const { data: row, error } = await supabase
      .from("proposal_tables")
      .upsert(
        {
          proposal_id: proposalId,
          page_id: pageId,
          table_type: "equipamentos",
          title: "Equipamentos",
          rows: rows as never,
          settings: {} as never,
          sort_order: 0,
        } as never,
        { onConflict: "proposal_id,page_id,table_type,sort_order" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { table: row, count: rows.length };
  });

// Helper used by clients to read columns from a stored ProposalTable
export function getTableColumns(t: Pick<ProposalTable, "settings"> | null | undefined): TableColumn[] | null {
  if (!t) return null;
  const cols = (t.settings as Record<string, unknown> | null | undefined)?.columns;
  if (Array.isArray(cols)) return cols as TableColumn[];
  return null;
}
