import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/propostas/$id")({
  component: ProposalRouteLayout,
});

function ProposalRouteLayout() {
  return <Outlet />;
}
