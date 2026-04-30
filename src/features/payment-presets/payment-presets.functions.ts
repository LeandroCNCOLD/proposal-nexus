import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  presetCreateSchema,
  presetIdSchema,
  presetListSchema,
  presetToggleSchema,
  presetUpdateSchema,
} from "./payment-presets.schema";
import { validateInstallments } from "./financial-math";

const MANAGER_ROLES = ["admin", "gerente_comercial", "diretoria"] as const;

async function assertManager(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(`Erro ao validar permissão: ${error.message}`);
  const roles = (data ?? []).map((r) => r.role as (typeof MANAGER_ROLES)[number]);
  if (!roles.some((r) => MANAGER_ROLES.includes(r))) {
    throw new Error("Você não tem permissão para gerenciar presets de pagamento.");
  }
}

export const listPaymentPresets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => presetListSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("payment_condition_presets")
      .select(
        "id, name, description, is_active, created_at, updated_at, payment_condition_preset_installments(id, description, percentage, days, sort_order)",
      )
      .order("name", { ascending: true });

    if (data?.onlyActive) q = q.eq("is_active", true);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    return (rows ?? []).map((p) => ({
      ...p,
      installments: [...(p.payment_condition_preset_installments ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order,
      ),
    }));
  });

export const getPaymentPreset = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => presetIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("payment_condition_presets")
      .select(
        "id, name, description, is_active, created_at, updated_at, payment_condition_preset_installments(id, description, percentage, days, sort_order)",
      )
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return {
      ...row,
      installments: [...(row.payment_condition_preset_installments ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order,
      ),
    };
  });

export const createPaymentPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => presetCreateSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertManager(context.userId);

    const validation = validateInstallments(data.installments);
    if (!validation.ok) throw new Error(validation.errors.join(" "));

    if (data.is_active) {
      const { data: existing, error: exErr } = await supabaseAdmin
        .from("payment_condition_presets")
        .select("id")
        .ilike("name", data.name)
        .eq("is_active", true)
        .maybeSingle();
      if (exErr) throw new Error(exErr.message);
      if (existing) throw new Error("Já existe um preset ativo com este nome.");
    }

    const { data: preset, error: insErr } = await supabaseAdmin
      .from("payment_condition_presets")
      .insert({
        name: data.name,
        description: data.description ?? null,
        is_active: data.is_active,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    const rows = data.installments.map((i, idx) => ({
      preset_id: preset.id,
      description: i.description,
      percentage: i.percentage,
      days: i.days,
      sort_order: idx,
    }));
    const { error: chErr } = await supabaseAdmin
      .from("payment_condition_preset_installments")
      .insert(rows);
    if (chErr) {
      await supabaseAdmin.from("payment_condition_presets").delete().eq("id", preset.id);
      throw new Error(chErr.message);
    }

    return { id: preset.id };
  });

export const updatePaymentPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => presetUpdateSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertManager(context.userId);

    const validation = validateInstallments(data.installments);
    if (!validation.ok) throw new Error(validation.errors.join(" "));

    if (data.is_active) {
      const { data: existing, error: exErr } = await supabaseAdmin
        .from("payment_condition_presets")
        .select("id")
        .ilike("name", data.name)
        .eq("is_active", true)
        .neq("id", data.id)
        .maybeSingle();
      if (exErr) throw new Error(exErr.message);
      if (existing) throw new Error("Já existe um preset ativo com este nome.");
    }

    const { error: upErr } = await supabaseAdmin
      .from("payment_condition_presets")
      .update({
        name: data.name,
        description: data.description ?? null,
        is_active: data.is_active,
      })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);

    const { error: delErr } = await supabaseAdmin
      .from("payment_condition_preset_installments")
      .delete()
      .eq("preset_id", data.id);
    if (delErr) throw new Error(delErr.message);

    const rows = data.installments.map((i, idx) => ({
      preset_id: data.id,
      description: i.description,
      percentage: i.percentage,
      days: i.days,
      sort_order: idx,
    }));
    const { error: insErr } = await supabaseAdmin
      .from("payment_condition_preset_installments")
      .insert(rows);
    if (insErr) throw new Error(insErr.message);

    return { id: data.id };
  });

export const togglePaymentPresetActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => presetToggleSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertManager(context.userId);

    if (data.is_active) {
      const { data: target } = await supabaseAdmin
        .from("payment_condition_presets")
        .select("name")
        .eq("id", data.id)
        .single();
      if (target) {
        const { data: dup } = await supabaseAdmin
          .from("payment_condition_presets")
          .select("id")
          .ilike("name", target.name)
          .eq("is_active", true)
          .neq("id", data.id)
          .maybeSingle();
        if (dup) throw new Error("Já existe outro preset ativo com este nome.");
      }
    }

    const { error } = await supabaseAdmin
      .from("payment_condition_presets")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
