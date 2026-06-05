import { createFileRoute } from "@tanstack/react-router";

// TEMPORARY ENDPOINT — DELETE AFTER USE
// Returns server-only Supabase credentials when called with the correct REVEAL_TOKEN header.
export const Route = createFileRoute("/api/public/reveal-secrets")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env.REVEAL_TOKEN;
        if (!expected || expected.length < 16) {
          return new Response("REVEAL_TOKEN not configured", { status: 500 });
        }

        const provided = request.headers.get("x-reveal-token");
        if (!provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        return Response.json({
          SUPABASE_URL: process.env.SUPABASE_URL ?? null,
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
          SUPABASE_DB_URL: process.env.SUPABASE_DB_URL ?? null,
          SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? null,
          SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY ?? null,
        });
      },
    },
  },
});
