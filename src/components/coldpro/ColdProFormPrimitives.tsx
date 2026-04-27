import * as React from "react";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type FormSectionProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function ColdProFormSection({ title, description, icon, children, className }: FormSectionProps) {
  return (
    <section className={cn("coldpro-card", className)}>
      <div className="mb-3 flex items-start gap-2 border-b pb-2.5">
        {icon ? <div className="mt-0.5 rounded bg-primary/10 p-1.5 text-primary">{icon}</div> : null}
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function ColdProFieldHint({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger type="button" className="inline-flex text-muted-foreground hover:text-foreground" aria-label="Ajuda do campo">
          <Info className="h-3.5 w-3.5" />
        </TooltipTrigger>
        <TooltipContent className="max-w-72 leading-relaxed">{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ColdProValidationMessage({ children, tone = "warning" }: { children?: React.ReactNode; tone?: "warning" | "error" }) {
  if (!children) return null;
  return (
    <div className={cn(
      "mt-1 flex items-start gap-1.5 text-xs",
      tone === "error" ? "text-destructive" : "text-warning"
    )}>
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function ColdProCalculatedInfo({ label, value, description, tone = "info" }: { label: string; value: string; description?: string; tone?: "info" | "success" | "warning" }) {
  return (
    <div className={cn(
      "min-w-0 rounded-lg border px-2.5 py-2",
      tone === "success" && "bg-success/10 text-success border-success/20",
      tone === "warning" && "bg-warning/10 text-warning border-warning/20",
      tone === "info" && "bg-primary/5 text-foreground border-primary/15"
    )}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold tabular-nums">{value}</div>
      {description ? <div className="mt-1 text-xs text-muted-foreground">{description}</div> : null}
    </div>
  );
}

export function numberOrNull(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const text = String(value).trim().replace(",", ".");
  if (text === "" || text === "-" || text === "+" || text === "." || text === "-." || text === "+.") return null;
  if (!/^[+-]?\d*(?:\.\d{0,4})?$/.test(text) || text === ".") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export function fmtColdPro(value: unknown, digits = 2) {
  if (typeof value === "string" && value.trim() && !Number.isFinite(Number(value))) return value;
  const parsed = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(Number.isFinite(parsed) ? parsed : 0);
}
