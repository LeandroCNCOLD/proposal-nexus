import { createFileRoute } from "@tanstack/react-router";
import { CoberturaCarteira } from "@/modules/crm/components/CoberturaCarteira";

export const Route = createFileRoute("/app/cobertura")({
  component: CoberturaCarteira,
});
