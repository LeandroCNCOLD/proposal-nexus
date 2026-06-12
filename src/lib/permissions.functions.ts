import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ROLE_ENUM = z.enum([
  "vendedor",
  "sdr",
  "gerente_comercial",
  "engenharia",
  "orcamentista",
  "diretoria",
  "administrativo",
  "admin",
  "marketing",
]);

async function ensureCanManagePermissions(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const allowed = new Set<AppRole>(["admin", "gerente_comercial", "diretoria"]);
  if (!(data ?? []).some((r: { role: AppRole }) => allowed.has(r.role))) {
    throw new Error("Sem permissão para gerenciar permissões.");
  }
}

// Lista permissões efetivas do usuário logado
export const getMyPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.rpc("get_user_permissions", {
      _user_id: userId,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as string[];
  });

// Lista todos os templates de perfil
export const listRoleTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("role_permission_templates")
      .select("role, permission_key");
    if (error) throw new Error(error.message);
    const byRole = new Map<AppRole, string[]>();
    for (const row of data ?? []) {
      const arr = byRole.get(row.role as AppRole) ?? [];
      arr.push(row.permission_key);
      byRole.set(row.role as AppRole, arr);
    }
    return Object.fromEntries(byRole) as Record<AppRole, string[]>;
  });

// Substitui as permissões de um template
export const setRoleTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      role: ROLE_ENUM,
      permissionKeys: z.array(z.string().min(1).max(120)).max(200),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureCanManagePermissions(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: delErr } = await supabaseAdmin
      .from("role_permission_templates")
      .delete()
      .eq("role", data.role);
    if (delErr) throw new Error(delErr.message);

    if (data.permissionKeys.length > 0) {
      const rows = data.permissionKeys.map((k) => ({
        role: data.role,
        permission_key: k,
      }));
      const { error: insErr } = await supabaseAdmin
        .from("role_permission_templates")
        .insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });

// Lista overrides de um usuário
export const listUserOverrides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureCanManagePermissions(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [overridesRes, rolesRes] = await Promise.all([
      supabaseAdmin
        .from("user_permission_overrides")
        .select("permission_key, effect")
        .eq("user_id", data.userId),
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", data.userId),
    ]);

    if (overridesRes.error) throw new Error(overridesRes.error.message);
    if (rolesRes.error) throw new Error(rolesRes.error.message);

    const userRoles = (rolesRes.data ?? []).map((r) => r.role as AppRole);

    let inherited: string[] = [];
    if (userRoles.length > 0) {
      const { data: templateRows, error: tErr } = await supabaseAdmin
        .from("role_permission_templates")
        .select("permission_key")
        .in("role", userRoles);
      if (tErr) throw new Error(tErr.message);
      inherited = Array.from(
        new Set((templateRows ?? []).map((t) => t.permission_key)),
      );
    }

    return {
      roles: userRoles,
      inherited,
      overrides: (overridesRes.data ?? []) as Array<{
        permission_key: string;
        effect: "grant" | "revoke";
      }>,
    };
  });

// Atualiza overrides em lote para um usuário (substitui tudo)
export const setUserOverrides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      userId: z.string().uuid(),
      overrides: z.array(
        z.object({
          permissionKey: z.string().min(1).max(120),
          effect: z.enum(["grant", "revoke"]),
        }),
      ).max(200),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureCanManagePermissions(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: delErr } = await supabaseAdmin
      .from("user_permission_overrides")
      .delete()
      .eq("user_id", data.userId);
    if (delErr) throw new Error(delErr.message);

    if (data.overrides.length > 0) {
      const rows = data.overrides.map((o) => ({
        user_id: data.userId,
        permission_key: o.permissionKey,
        effect: o.effect,
        created_by: userId,
      }));
      const { error: insErr } = await supabaseAdmin
        .from("user_permission_overrides")
        .insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });
