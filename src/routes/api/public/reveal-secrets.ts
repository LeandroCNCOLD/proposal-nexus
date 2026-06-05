import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/reveal-secrets")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = request.headers.get("x-reveal-token");
        const expected = process.env.REVEAL_TOKEN;

        if (!expected) {
          return new Response(
            JSON.stringify({ error: "REVEAL_TOKEN not configured" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }

        if (!token || token !== expected) {
          return new Response(
            JSON.stringify({ error: "unauthorized" }),
            { status: 401, headers: { "content-type": "application/json" } },
          );
        }

        const payload = {
          SUPABASE_URL: process.env.SUPABASE_URL ?? null,
          SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY ?? null,
          SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? null,
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
          SUPABASE_DB_URL: process.env.SUPABASE_DB_URL ?? null,
        };

        return new Response(JSON.stringify(payload, null, 2), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
