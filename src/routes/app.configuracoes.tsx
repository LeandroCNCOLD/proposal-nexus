import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/configuracoes")({ component: SettingsLayout });

function SettingsLayout() {
  return <Outlet />;
}
