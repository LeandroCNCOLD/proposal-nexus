// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    define: {
      "process.env.SUPABASE_URL": JSON.stringify("https://rgjfacxcunhuqglookaj.supabase.co"),
      "process.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6InJnamZhY3hjdW5odXFnbG9va2FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDE1NTgsImV4cCI6MjA5MjI3NzU1OH0.5lfEfzkhi5gPXZNaSN0jIhLYcAYSSI8OTT82FFOG2LM",
      ),
    },
  },
});
