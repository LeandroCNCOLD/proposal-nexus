import { cn } from "@/lib/utils";

export const COLDPRO_TAB_IDS = [
  "project",
  "dimensions",
  "surfaces",
  "process",
  "infiltration",
  "internal",
  "result",
  "equipment",
  "report",
] as const;

export const COLDPRO_TABS = [
  { id: "project", label: "Dados do Projeto" },
  { id: "dimensions", label: "Dimensões" },
  { id: "surfaces", label: "Isolamento / Superfícies" },
  { id: "process", label: "Produto / Processo" },
  { id: "infiltration", label: "Infiltração" },
  { id: "internal", label: "Cargas Internas" },
  { id: "result", label: "Resultado" },
  { id: "equipment", label: "Seleção de Equipamentos" },
  { id: "report", label: "Relatório Técnico" },
] as const;

export type ColdProTabId = typeof COLDPRO_TAB_IDS[number];

export function ColdProTabs({ active, onChange }: { active: ColdProTabId; onChange: (id: ColdProTabId) => void }) {
  return (
    <div className="overflow-x-auto border-b bg-background">
      <div className="flex min-w-max gap-1 px-2">
        {COLDPRO_TABS.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative px-3 py-3 text-xs font-medium transition",
              active === tab.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px]">{index + 1}</span>
            {tab.label}
            <span className={cn("absolute inset-x-2 bottom-0 h-0.5 rounded-full", active === tab.id ? "bg-primary" : "bg-transparent")} />
          </button>
        ))}
      </div>
    </div>
  );
}
