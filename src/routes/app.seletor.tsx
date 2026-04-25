import { createFileRoute } from "@tanstack/react-router";
import { ColdProSeletorApp } from "@/modules/coldpro/components/ColdProSeletorApp";

export const Route = createFileRoute("/app/seletor")({ component: ColdProSeletorApp });
export const SeletorComponent = ColdProSeletorApp;
