import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/reveal-secrets')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = request.headers.get('x-reveal-token')
        const expected = process.env.REVEAL_TOKEN

        if (!expected) {
          return new Response(JSON.stringify({ error: 'REVEAL_TOKEN not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        if (!token || token !== expected) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        return new Response(
          JSON.stringify(
            {
              SUPABASE_URL: process.env.SUPABASE_URL,
              SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
              SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
              SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
              SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
            },
            null,
            2,
          ),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      },
    },
  },
})
