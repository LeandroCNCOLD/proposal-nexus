import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ALL_ROLES: AppRole[] = [
  "vendedor",
  "gerente_comercial",
  "engenharia",
  "orcamentista",
  "diretoria",
  "administrativo",
  "admin",
];

const InviteSchema = z.object({
  email: z.string().trim().email().max(255),
  fullName: z.string().trim().min(1).max(120),
  role: z.enum([
    "vendedor",
    "gerente_comercial",
    "engenharia",
    "orcamentista",
    "diretoria",
    "administrativo",
    "admin",
  ]),
  password: z.string().min(8).max(72).optional().nullable(),
});

async function ensureManager(supabase: any, userId: string) {
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const allowed = new Set<AppRole>(["admin", "gerente_comercial", "diretoria"]);
  if (!(roles ?? []).some((r: { role: AppRole }) => allowed.has(r.role))) {
    throw new Error("Sem permissão para gerenciar usuários.");
  }
}

export const inviteNewUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureManager(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let newUserId: string | null = null;

    if (data.password && data.password.length >= 8) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      });
      if (error) throw new Error(error.message);
      newUserId = created.user?.id ?? null;
    } else {
      const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        data.email,
        { data: { full_name: data.fullName } },
      );
      if (error) throw new Error(error.message);
      newUserId = invited.user?.id ?? null;
    }

    if (!newUserId) throw new Error("Falha ao criar usuário.");

    await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: newUserId, full_name: data.fullName, email: data.email },
        { onConflict: "id" },
      );

    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: newUserId, role: data.role },
        { onConflict: "user_id,role" },
      );

    return { ok: true, userId: newUserId };
  });

export const listAppUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureManager(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error: profilesErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, created_at")
      .order("created_at", { ascending: false });
    if (profilesErr) throw new Error(profilesErr.message);

    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rolesErr) throw new Error(rolesErr.message);

    const rolesByUser = new Map<string, AppRole[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      rolesByUser.set(r.user_id, arr);
    }

    return (profiles ?? []).map((p) => ({
      id: p.id,
      fullName: p.full_name,
      email: p.email,
      createdAt: p.created_at,
      roles: rolesByUser.get(p.id) ?? [],
    }));
  });

const UpdateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum([
    "vendedor",
    "gerente_comercial",
    "engenharia",
    "orcamentista",
    "diretoria",
    "administrativo",
    "admin",
  ]),
});

export const setUserPrimaryRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateRoleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureManager(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Replace all roles with the single requested role
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (delErr) throw new Error(delErr.message);

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (insErr) throw new Error(insErr.message);

    return { ok: true };
  });

export const deleteAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.userId === userId) {
      throw new Error("Você não pode remover sua própria conta.");
    }
    await ensureManager(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const _ASSIGNABLE_ROLES = ALL_ROLES;
