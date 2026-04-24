import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Linha label : input [unidade] — inspirada no layout limpo do Intarcon
 * porém com tipografia/contrastes da nossa identidade.
 */
type FieldProps = {
  label: string;
  unit?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
};

export function ColdProField({ label, unit, htmlFor, children, className }: FieldProps) {
  return (
    <div className={cn("flex items-center gap-3 py-2", className)}>
      <label
        htmlFor={htmlFor}
        className="w-1/2 shrink-0 text-right text-[13px] font-medium text-muted-foreground"
      >
        {label} :
      </label>
      <div className="flex flex-1 items-center gap-2">
        <div className="flex-1">{children}</div>
        {unit ? (
          <span className="w-10 shrink-0 text-[12px] font-medium text-muted-foreground">{unit}</span>
        ) : null}
      </div>
    </div>
  );
}

/** Input numérico/texto com aparência "linha" (fundo neutro, sem moldura forte). */
export function ColdProInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { readOnlyValue?: boolean },
) {
  const { className, readOnlyValue, ...rest } = props;
  return (
    <input
      {...rest}
      className={cn(
        "h-9 w-full rounded-md border border-transparent px-3 text-right text-sm tabular-nums",
        "transition focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15",
        readOnlyValue
          ? "bg-primary/5 text-foreground"
          : "bg-muted/40 hover:bg-muted/60",
        className,
      )}
    />
  );
}

export function ColdProSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
) {
  const { className, children, ...rest } = props;
  return (
    <select
      {...rest}
      className={cn(
        "h-9 w-full rounded-md border border-transparent bg-muted/40 px-3 text-sm",
        "transition hover:bg-muted/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15",
        className,
      )}
    >
      {children}
    </select>
  );
}

/** Cabeçalho de seção centralizado com linhas decorativas. */
export function ColdProSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 flex items-center gap-4">
      <div className="h-px flex-1 bg-border" />
      <h3 className="text-[15px] font-semibold tracking-wide text-muted-foreground">
        {children}
      </h3>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
