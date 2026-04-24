import * as React from "react";
import { Check } from "lucide-react";

export type ColdProStep = {
  id: string;
  title: string;
  description: string;
};

export const COLDPRO_STEPS: ColdProStep[] = [
  { id: "ambiente", title: "Ambiente", description: "Dimensões e condições" },
  { id: "produtos", title: "Produtos", description: "Cargas de produto" },
  { id: "extras", title: "Cargas extras", description: "Pessoas, motores, infiltração" },
  { id: "resultado", title: "Resultado", description: "Cálculo de carga térmica" },
  { id: "equipamento", title: "Equipamento", description: "Seleção e relatório" },
];

type Props = {
  currentStep: number;
  onStepClick: (index: number) => void;
  completed: Record<number, boolean>;
};

export function ColdProStepper({ currentStep, onStepClick, completed }: Props) {
  return (
    <nav aria-label="Etapas do cálculo" className="rounded-2xl border bg-background p-4">
      <ol className="flex items-center gap-2">
        {COLDPRO_STEPS.map((step, idx) => {
          const isActive = idx === currentStep;
          const isDone = completed[idx];
          return (
            <React.Fragment key={step.id}>
              <li className="flex-1">
                <button
                  type="button"
                  onClick={() => onStepClick(idx)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : isDone
                      ? "border-primary/30 bg-background hover:bg-muted/50"
                      : "border-border bg-background hover:bg-muted/50"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isDone
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : idx + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-tight">{step.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{step.description}</span>
                  </span>
                </button>
              </li>
              {idx < COLDPRO_STEPS.length - 1 ? (
                <li aria-hidden className="hidden h-px w-4 bg-border md:block" />
              ) : null}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
