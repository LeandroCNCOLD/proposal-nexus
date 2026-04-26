import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const nullableNumber = z.number().finite().nullable().optional();
const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().max(100).nullable().optional(),
  initial_freezing_temp_c: nullableNumber,
  specific_heat_above_kj_kg_k: nullableNumber,
  specific_heat_below_kj_kg_k: nullableNumber,
  specific_heat_above_kcal_kg_c: z.number().finite().min(0).default(0),
  specific_heat_below_kcal_kg_c: z.number().finite().min(0).default(0),
  latent_heat_kj_kg: nullableNumber,
  latent_heat_kcal_kg: z.number().finite().min(0).default(0),
  density_kg_m3: nullableNumber,
  water_content_percent: nullableNumber,
  protein_content_percent: nullableNumber,
  fat_content_percent: nullableNumber,
  carbohydrate_content_percent: nullableNumber,
  fiber_content_percent: nullableNumber,
  ash_content_percent: nullableNumber,
  thermal_conductivity_unfrozen_w_m_k: nullableNumber,
  thermal_conductivity_frozen_w_m_k: nullableNumber,
  frozen_water_fraction: nullableNumber,
  freezable_water_content_percent: nullableNumber,
  characteristic_thickness_m: nullableNumber,
  default_convective_coefficient_w_m2_k: nullableNumber,
  allow_phase_change: z.boolean().default(true),
  respiration_rate_0c_w_kg: nullableNumber,
  respiration_rate_5c_w_kg: nullableNumber,
  respiration_rate_10c_w_kg: nullableNumber,
  respiration_rate_15c_w_kg: nullableNumber,
  respiration_rate_20c_w_kg: nullableNumber,
  respiration_rate_0c_mw_kg: nullableNumber,
  respiration_rate_5c_mw_kg: nullableNumber,
  respiration_rate_10c_mw_kg: nullableNumber,
  respiration_rate_15c_mw_kg: nullableNumber,
  respiration_rate_20c_mw_kg: nullableNumber,
  notes: z.string().trim().max(1000).nullable().optional(),
  source: z.string().trim().max(120).nullable().optional(),
  source_reference: z.string().trim().max(300).nullable().optional(),
  is_ashrae_reference: z.boolean().default(true),
  data_confidence: z.string().trim().max(40).default("manual"),
});

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function toDbPayload(product: z.infer<typeof productSchema>) {
  return {
    ...product,
    category: product.category || null,
    source: product.source || "ASHRAE",
    source_reference: product.source_reference || null,
    thermal_conductivity_w_m_k: product.thermal_conductivity_unfrozen_w_m_k ?? null,
  };
}

function readableSupabaseError(error: unknown, fallback = "Falha temporária ao acessar o banco de dados.") {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (raw.includes("525") || raw.includes("SSL handshake failed") || raw.includes("<!DOCTYPE html")) {
    return "O backend ficou temporariamente indisponível ao carregar os produtos. Tente novamente em alguns instantes.";
  }
  return raw.trim() || fallback;
}

export const listColdProProductCatalog = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from("coldpro_products")
      .select("*")
      .order("category", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (error) throw new Error(readableSupabaseError(error));
    return data ?? [];
  } catch (error) {
    console.error("[coldpro-products] list failed", readableSupabaseError(error));
    throw new Error(readableSupabaseError(error));
  }
});

export const upsertColdProCatalogProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(productSchema)
  .handler(async ({ data }) => {
    const payload = toDbPayload(data);
    if (data.id) {
      const { data: row, error } = await supabaseAdmin
        .from("coldpro_products")
        .update(payload as never)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(readableSupabaseError(error));
      return row;
    }

    const { data: existing } = await supabaseAdmin.from("coldpro_products").select("id, name, category");
    const match = (existing ?? []).find(
      (row) => normalizeKey(row.name) === normalizeKey(data.name) && normalizeKey(row.category) === normalizeKey(data.category),
    );
    const query = match
      ? supabaseAdmin.from("coldpro_products").update(payload as never).eq("id", match.id)
      : supabaseAdmin.from("coldpro_products").insert(payload as never);
    const { data: row, error } = await query.select("*").single();
    if (error) throw new Error(readableSupabaseError(error));
    return row;
  });

export const importColdProCatalogProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ products: z.array(productSchema).min(1).max(5000) }))
  .handler(async ({ data }) => {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("coldpro_products")
      .select("id, name, category");
    if (existingError) throw new Error(existingError.message);

    const existingByKey = new Map(
      (existing ?? []).map((row) => [`${normalizeKey(row.category)}::${normalizeKey(row.name)}`, row.id]),
    );

    let created = 0;
    let updated = 0;
    for (const product of data.products) {
      const key = `${normalizeKey(product.category)}::${normalizeKey(product.name)}`;
      const id = existingByKey.get(key);
      const payload = toDbPayload(product);
      if (id) {
        const { error } = await supabaseAdmin.from("coldpro_products").update(payload as never).eq("id", id);
        if (error) throw new Error(`Falha ao atualizar ${product.name}: ${error.message}`);
        updated++;
      } else {
        const { data: inserted, error } = await supabaseAdmin
          .from("coldpro_products")
          .insert(payload as never)
          .select("id")
          .single();
        if (error) throw new Error(`Falha ao inserir ${product.name}: ${error.message}`);
        existingByKey.set(key, inserted.id);
        created++;
      }
    }

    return { created, updated, total: data.products.length };
  });