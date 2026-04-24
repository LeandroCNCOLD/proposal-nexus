import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const inputSchema = z.object({
  projectId: z.string().uuid(),
  mode: z.enum(["append", "replace_coldpro_items"]).optional().default("append"),
});

function fmt(value: unknown, suffix = "") {
  const n = Number(value ?? 0);
  const formatted = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
  return `${formatted}${suffix}`;
}

function buildColdProItemDescription(params: {
  env: any;
  result?: any;
  selection?: any;
}) {
  const { env, result, selection } = params;

  return [
    `CN ColdPro — ${env.name}`,
    `Tipo de aplicação: ${env.environment_type}`,
    `Dimensões externas: ${fmt(env.length_m, " m")} x ${fmt(env.width_m, " m")} x ${fmt(env.height_m, " m")}`,
    `Volume interno: ${fmt(env.volume_m3, " m³")}`,
    `Temperatura interna: ${fmt(env.internal_temp_c, " °C")}`,
    `Temperatura externa considerada: ${fmt(env.external_temp_c, " °C")}`,
    `Carga térmica requerida: ${fmt(result?.total_required_kcal_h, " kcal/h")}`,
    `Carga térmica requerida: ${fmt(result?.total_required_kw, " kW")} / ${fmt(result?.total_required_tr, " TR")}`,
    selection
      ? `Equipamento selecionado: ${fmt(selection.quantity)} x ${selection.model}`
      : `Equipamento selecionado: não definido`,
    `Capacidade total oferecida: ${fmt(selection?.capacity_total_kcal_h, " kcal/h")}`,
    `Vazão total de ar: ${fmt(selection?.air_flow_total_m3_h, " m³/h")}`,
    `Trocas internas por hora: ${fmt(selection?.air_changes_hour)}`,
    `Sobra técnica: ${fmt(selection?.surplus_percent, "%")}`,
  ].join("\n");
}

export const pushColdProToProposal = createServerFn({ method: "POST" })
  .inputValidator(inputSchema)
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;

    const { data: project, error: projectError } = await supabase
      .from("coldpro_projects")
      .select("*")
      .eq("id", data.projectId)
      .single();

    if (projectError) throw new Error(projectError.message);
    if (!project.proposal_id) {
      throw new Error("Projeto ColdPro não está vinculado a uma proposta.");
    }

    const { data: envs, error: envError } = await supabase
      .from("coldpro_environments")
      .select("*")
      .eq("coldpro_project_id", data.projectId)
      .order("sort_order", { ascending: true });

    if (envError) throw new Error(envError.message);

    const environmentIds = (envs ?? []).map((env: any) => env.id);

    const { data: results } = environmentIds.length
      ? await supabase
          .from("coldpro_results")
          .select("*")
          .in("environment_id", environmentIds)
          .order("created_at", { ascending: false })
      : { data: [] as any[] };

    const { data: selections } = environmentIds.length
      ? await supabase
          .from("coldpro_equipment_selections")
          .select("*")
          .in("environment_id", environmentIds)
      : { data: [] as any[] };

    if (data.mode === "replace_coldpro_items") {
      const { error: deleteError } = await supabase
        .from("proposal_items")
        .delete()
        .eq("proposal_id", project.proposal_id)
        .ilike("description", "CN ColdPro —%");

      if (deleteError) throw new Error(deleteError.message);
    }

    const items = (envs ?? []).map((env: any, index: number) => {
      const result = (results ?? []).find((r: any) => r.environment_id === env.id);
      const selection = (selections ?? []).find((s: any) => s.environment_id === env.id);

      return {
        proposal_id: project.proposal_id,
        equipment_id: null,
        description: buildColdProItemDescription({ env, result, selection }),
        quantity: selection?.quantity ?? 1,
        unit_price: 0,
        notes: JSON.stringify({
          source: "coldpro",
          coldpro_project_id: project.id,
          coldpro_environment_id: env.id,
          coldpro_result_id: result?.id ?? null,
          coldpro_selection_id: selection?.id ?? null,
        }),
        position: 9000 + index,
      };
    });

    if (items.length > 0) {
      const { error: itemError } = await supabase
        .from("proposal_items")
        .insert(items);

      if (itemError) throw new Error(itemError.message);
    }

    const technicalSummary = items
      .map((item: any, index: number) => `${index + 1}. ${item.description}`)
      .join("\n\n");

    const { error: proposalError } = await supabase
      .from("proposals")
      .update({
        technical_notes: `Dados técnicos enviados pelo CN ColdPro:\n\n${technicalSummary}`,
      })
      .eq("id", project.proposal_id);

    if (proposalError) throw new Error(proposalError.message);

    await supabase
      .from("proposal_timeline_events")
      .insert({
        proposal_id: project.proposal_id,
        event_type: "observacao",
        description: "Resultados técnicos do CN ColdPro enviados para a proposta.",
        metadata: {
          source: "coldpro",
          coldpro_project_id: project.id,
          inserted_items: items.length,
        },
      });

    await supabase
      .from("coldpro_projects")
      .update({ status: "sent_to_proposal" })
      .eq("id", data.projectId);

    return {
      success: true,
      inserted_items: items.length,
      proposal_id: project.proposal_id,
    };
  });
