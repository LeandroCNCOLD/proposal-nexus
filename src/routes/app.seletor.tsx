import { createFileRoute } from "@tanstack/react-router";
import { ColdProSeletorApp as ColdProSelectorModule } from "@/modules/coldpro/components/ColdProSeletorApp";

function SeletorComponent() {
  return <ColdProSelectorModule />;
}

export const Route = createFileRoute("/app/seletor")({ component: SeletorComponent });
