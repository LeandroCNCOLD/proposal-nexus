import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import {
  proposalIdSchema,
  saveProposalFinancialSchema,
} from "./payment-presets.schema";
import { computeFinancial, validateInstallments } from "./financial-math";

export const getProposalFinancial = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => proposalIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { data: prop, error } = await supabaseAdmin
      .from("proposals")
      .select(
        "id, total_value, original_proposal_amount, monthly_financial_rate_pct, financial_rate_type, financial_avg_term_days, financial_factor_pct, financial_additional_cost, final_amount_with_financial_cost, payment_condition_snapshot, financial_preset_id",
      )
      .eq("id", data.proposalId)
      .single();
    if (error) throw new Error(error.message);

    const { data: history } = await supabaseAdmin
      .from("proposal_financial_history")
      .select("*")
      .eq("proposal_id", data.proposalId)
      .order("created_at", { ascending: false })
      .limit(10);

    return { proposal: prop, history: history ?? [] };
  });

export const saveProposalFinancial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveProposalFinancialSchema.parse(data))
  .handler(async ({ data, context }) => {
    const validation = validateInstallments(data.installments);
    if (!validation.ok) throw new Error(validation.errors.join(" "));

    const { data: prop, error: pErr } = await supabaseAdmin
      .from("proposals")
      .select(
        "id, total_value, original_proposal_amount, financial_additional_cost, final_amount_with_financial_cost",
      )
      .eq("id", data.proposalId)
      .single();
    if (pErr) throw new Error(pErr.message);

    const currentTotal = Number(prop.total_value ?? 0);
    const previouslyLockedOriginal =
      prop.original_proposal_amount != null
        ? Number(prop.original_proposal_amount)
        : null;

    // Define o valor original travado:
    // - se o usuário pediu refresh OU não há valor travado ainda → usa o total_value atual.
    // - caso contrário, mantém o valor travado anterior (impede acumular taxa sobre taxa).
    const originalAmount =
      data.refreshOriginalAmount || previouslyLockedOriginal == null
        ? currentTotal
        : previouslyLockedOriginal;

    // Recálculo SEMPRE sobre o valor original — substitui resultado anterior, não acumula.
    const result = computeFinancial({
      originalAmount,
      monthlyRatePct: data.monthlyRatePct,
      type: data.rateType,
      installments: data.installments,
    });

    const previousAdditionalCost =
      prop.financial_additional_cost != null
        ? Number(prop.financial_additional_cost)
        : null;
    const previousFinalAmount =
      prop.final_amount_with_financial_cost != null
        ? Number(prop.final_amount_with_financial_cost)
        : null;

    const snapshot = {
      installments: result.installments.map((i) => ({
        description: i.description,
        percentage: i.percentage,
        days: i.days,
        value: i.value,
      })),
      averageTermDays: result.averageTermDays,
      factorPct: result.factorPct,
      totalInstallments: result.totalInstallments,
      computedAt: new Date().toISOString(),
    } as unknown as Json;

    const { error: upErr } = await supabaseAdmin
      .from("proposals")
      .update({
        original_proposal_amount: originalAmount,
        monthly_financial_rate_pct: data.monthlyRatePct,
        financial_rate_type: data.rateType,
        financial_avg_term_days: result.averageTermDays,
        financial_factor_pct: result.factorPct,
        financial_additional_cost: result.additionalCost,
        final_amount_with_financial_cost: result.finalAmount,
        payment_condition_snapshot: snapshot,
        financial_preset_id: data.presetId ?? null,
      })
      .eq("id", data.proposalId);
    if (upErr) throw new Error(upErr.message);

    const { error: hErr } = await supabaseAdmin
      .from("proposal_financial_history")
      .insert({
        proposal_id: data.proposalId,
        user_id: context.userId,
        previous_financial_additional_cost: previousAdditionalCost,
        new_financial_additional_cost: result.additionalCost,
        previous_final_amount: previousFinalAmount,
        new_final_amount: result.finalAmount,
      });
    if (hErr) throw new Error(hErr.message);

    return {
      ok: true,
      originalAmount,
      result,
    };
  });
