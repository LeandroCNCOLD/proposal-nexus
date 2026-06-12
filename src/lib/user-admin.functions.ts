import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ALL_ROLES: AppRole[] = [
  "vendedor",
  "sdr",
  "gerente_comercial",
  "engenharia",
  "orcamentista",
  "diretoria",
  "administrativo",
  "admin",
  "marketing",
];

const ROLE_ZOD = z.enum([
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

// Roles que um gerente_comercial (sem ser admin/diretoria) pode atribuir.
const GERENTE_ALLOWED_ROLES: AppRole[] = ["sdr", "vendedor", "marketing"];

const InviteSchema = z.object({
  email: z.string().trim().email().max(255),
  fullName: z.string().trim().min(1).max(120),
  role: ROLE_ZOD,
  password: z.string().min(8).max(72).optional().nullable(),
  mustChangePassword: z.boolean().optional(),
  overrides: z.array(z.object({
    permissionKey: z.string().min(1).max(120),
    effect: z.enum(["grant", "revoke"]),
  })).max(200).optional(),
});

type CallerLevel = "admin" | "gerente";

async function ensureManager(supabase: any, userId: string): Promise<CallerLevel> {
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const list = (roles ?? []).map((r: { role: AppRole }) => r.role);
  const isAdminLike = list.some((r: AppRole) => r === "admin" || r === "diretoria");
  const isGerente = list.includes("gerente_comercial");
  if (!isAdminLike && !isGerente) {
    throw new Error("Sem permissão para gerenciar usuários.");
  }
  return isAdminLike ? "admin" : "gerente";
}

function assertRoleAssignable(level: CallerLevel, role: AppRole) {
  if (level === "admin") return;
  if (!GERENTE_ALLOWED_ROLES.includes(role)) {
    throw new Error("Gerente Comercial só pode atribuir os perfis: SDR, Vendedor ou Marketing.");
  }
}

export const inviteNewUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const level = await ensureManager(supabase, userId);
    assertRoleAssignable(level, data.role);

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
        {
          id: newUserId,
          full_name: data.fullName,
          email: data.email,
          access_status: "active",
          must_change_password: !!data.mustChangePassword,
        },
        { onConflict: "id" },
      );

    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: newUserId, role: data.role },
        { onConflict: "user_id,role" },
      );

    if (data.overrides && data.overrides.length > 0) {
      await supabaseAdmin
        .from("user_permission_overrides")
        .delete()
        .eq("user_id", newUserId);
      const rows = data.overrides.map((o) => ({
        user_id: newUserId!,
        permission_key: o.permissionKey,
        effect: o.effect,
        created_by: userId,
      }));
      const { error: ovErr } = await supabaseAdmin
        .from("user_permission_overrides")
        .insert(rows);
      if (ovErr) throw new Error(ovErr.message);
    }

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
      .select("id, full_name, email, created_at, access_status, must_change_password")
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
      accessStatus: (p.access_status ?? "active") as "active" | "inactive",
      mustChangePassword: !!p.must_change_password,
      roles: rolesByUser.get(p.id) ?? [],
    }));
  });

const UpdateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: ROLE_ZOD,
});

export const setUserPrimaryRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateRoleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const level = await ensureManager(supabase, userId);
    assertRoleAssignable(level, data.role);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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

// Atualização unificada de usuário: nome, email, perfil principal e status ativo/inativo.
const UpdateUserSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  role: ROLE_ZOD,
  accessStatus: z.enum(["active", "inactive"]),
});

export const updateUserFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const level = await ensureManager(supabase, userId);
    assertRoleAssignable(level, data.role);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Atualiza auth.users (email + banir/desbanir)
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email: data.email,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
      ban_duration: data.accessStatus === "inactive" ? "876000h" : "none",
    } as any);
    if (authErr) throw new Error(authErr.message);

    // 2) Atualiza profiles
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.fullName,
        email: data.email,
        access_status: data.accessStatus,
      })
      .eq("id", data.userId);
    if (profErr) throw new Error(profErr.message);

    // 3) Substitui roles pela role solicitada
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
    const level = await ensureManager(supabase, userId);
    if (level !== "admin") {
      throw new Error("Apenas Admin e Diretoria podem remover usuários.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const SetPasswordSchema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(8).max(72),
  forceChange: z.boolean().optional(),
});

export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetPasswordSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureManager(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: !!data.forceChange })
      .eq("id", data.userId);

    return { ok: true };
  });

const SetEmailSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
});

export const setUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetEmailSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureManager(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email: data.email,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ email: data.email }).eq("id", data.userId);
    return { ok: true };
  });

export const _ASSIGNABLE_ROLES = ALL_ROLES;
export const _GERENTE_ALLOWED_ROLES = GERENTE_ALLOWED_ROLES;
