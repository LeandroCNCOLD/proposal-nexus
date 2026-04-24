import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ColdProStep = {
  id: string;
  title: string;
  description: string;
};

export const COLDPRO_STEPS: ColdProStep[] = [
  { id: "ambiente", title: "Ambiente", description: "Dimensões e condições" },
  { id: "produtos", title: "Produtos", description: "Cargas de produto" },
  { id: "extras", title: "Cargas extras", description: "Pessoas, motores, infiltração" },
  { id: "resultado", title: "Resultado", description: "Cálculo, seleção e relatório" },
];

type Props = {
  currentStep: number;
  onStepClick: (index: number) => void;
  completed: Record<number, boolean>;
};

/**
 * Tabs horizontais inspiradas no layout do Intarcon: rótulo simples com
 * underline azul na aba ativa. Adicionamos um indicador de check para
 * etapas concluídas e um contador numérico discreto.
 */
export function ColdProStepper({ currentStep, onStepClick, completed }: Props) {
  return (
    <nav aria-label="Etapas do cálculo" className="border-b border-border bg-background">
      <ol className="flex items-center gap-1 overflow-x-auto px-2">
        {COLDPRO_STEPS.map((step, idx) => {
          const isActive = idx === currentStep;
          const isDone = completed[idx];
          return (
            <li key={step.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onStepClick(idx)}
                className={cn(
                  "group relative flex items-center gap-2 px-4 py-3 text-sm transition",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isDone
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground group-hover:bg-muted/80",
                  )}
                >
                  {isDone ? <Check className="h-3 w-3" /> : idx + 1}
                </span>
                <span className="font-medium">{step.title}</span>
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-2 -bottom-px h-0.5 rounded-full transition",
                    isActive ? "bg-primary" : "bg-transparent",
                  )}
                />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
