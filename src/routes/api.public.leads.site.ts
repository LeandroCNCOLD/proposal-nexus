import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Origin",
  "Access-Control-Max-Age": "86400",
};

const schema = z.object({
  contact_name: z.string().trim().min(2).max(120),
  client_name: z.string().trim().min(2).max(160),
  contact_email: z.string().trim().email().max(160),
  contact_phone: z.string().trim().min(8).max(40),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(40).optional().nullable(),
  segmento: z.string().trim().max(80).optional().nullable(),
  aplicacao: z.string().trim().max(120).optional().nullable(),
  mensagem: z.string().trim().max(2000).optional().nullable(),
  origem_detalhe: z.record(z.string(), z.unknown()).optional().nullable(),
});

// Best-effort in-memory rate limit (per worker instance). Não é defesa robusta;
// só evita floods acidentais quando o formulário não tem captcha.
const recent: Map<string, number[]> = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const arr = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) return false;
  arr.push(now);
  recent.set(ip, arr);
  return true;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export const Route = createFileRoute("/api/public/leads/site")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown";
        if (!rateLimit(ip)) {
          return json({ ok: false, error: "Muitas tentativas. Aguarde 1 minuto." }, 429);
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return json({ ok: false, error: "JSON inválido." }, 400);
        }

        const parsed = schema.safeParse(payload);
        if (!parsed.success) {
          return json({ ok: false, error: "Dados inválidos.", issues: parsed.error.flatten() }, 400);
        }

        try {
          const { createInboundLeadAdmin } = await import("@/lib/leads-inbound.server");
          const result = await createInboundLeadAdmin({
            ...parsed.data,
            origem: "site",
            origem_detalhe: {
              ...(parsed.data.origem_detalhe ?? {}),
              user_agent: request.headers.get("user-agent") ?? null,
              referer: request.headers.get("referer") ?? null,
              ip,
            },
          });
          return json({ ok: true, protocol: result.lead_code, id: result.id });
        } catch (err) {
          console.error("[/api/public/leads/site] insert failed", err);
          return json({ ok: false, error: "Erro ao registrar lead." }, 500);
        }
      },
    },
  },
});
