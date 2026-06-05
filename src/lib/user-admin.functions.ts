import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

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

export const inviteNewUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorization: only admin / gerente_comercial / diretoria
    const { data: roles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesErr) throw new Error(rolesErr.message);
    const allowed = new Set<AppRole>(["admin", "gerente_comercial", "diretoria"]);
    const hasPermission = (roles ?? []).some((r) => allowed.has(r.role as AppRole));
    if (!hasPermission) {
      throw new Error("Sem permissão para cadastrar usuários.");
    }

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

    // Ensure profile exists (handle_new_user trigger should also do this)
    await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: newUserId, full_name: data.fullName, email: data.email },
        { onConflict: "id" },
      );

    // Assign requested role (in addition to default 'vendedor')
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: newUserId, role: data.role },
        { onConflict: "user_id,role" },
      );
    if (roleErr) throw new Error(roleErr.message);

    return { ok: true, userId: newUserId };
  });
