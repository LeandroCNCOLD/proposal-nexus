import { createFileRoute } from "@tanstack/react-router";
import { testNomusConnection } from "@/integrations/nomus/client";

export const Route = createFileRoute("/api/nomus/test")({
  server: {
    handlers: {
      GET: async () => {
        const result = await testNomusConnection(null);
        return new Response(JSON.stringify(result, null, 2), {
          status: result.success ? 200 : 502,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
