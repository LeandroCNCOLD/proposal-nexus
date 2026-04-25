import { createFileRoute } from "@tanstack/react-router";
import { ColdProSeletorApp } from "@/modules/coldpro/components/ColdProSeletorApp";

export const Route = createFileRoute("/app/seletor")({ component: SeletorComponent });

function SeletorComponent() {
  return <ColdProSeletorApp />;
}
