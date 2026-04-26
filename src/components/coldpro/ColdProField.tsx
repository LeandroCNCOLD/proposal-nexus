import * as React from "react";
import { cn } from "@/lib/utils";
import { FieldHelpTooltip } from "@/modules/coldpro/components/FieldHelpTooltip";
import { type ColdProFieldHelp, type ColdProFieldHelpKey } from "@/modules/coldpro/core/fieldHelpTexts";

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
  help?: ColdProFieldHelp | null;
  helpKey?: ColdProFieldHelpKey | string | null;
};

export function ColdProField({ label, unit, htmlFor, children, className, help, helpKey }: FieldProps) {
  return (
    <div className={cn("grid min-w-0 gap-1.5 py-2 lg:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)] lg:items-center lg:gap-3", className)}>
      <label
        htmlFor={htmlFor}
        className="flex min-w-0 items-center gap-1.5 whitespace-normal break-words text-sm font-medium text-muted-foreground lg:justify-end lg:text-right"
      >
        <span className="min-w-0 whitespace-normal break-words">{label} :</span>
        {(help || helpKey) ? <FieldHelpTooltip help={help} helpKey={helpKey} /> : null}
      </label>
      <div className="flex w-full min-w-0 flex-1 items-center gap-2">
        <div className="min-w-0 flex-1">{children}</div>
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
  const { className, readOnlyValue, onFocus, onBlur, onChange, onMouseUp, onKeyDown, type, step, inputMode, value, ...rest } = props;
  const isNumeric = type === "number";
  const [isEditing, setIsEditing] = React.useState(false);
  const [draftValue, setDraftValue] = React.useState(() => formatNumericInputValue(value));
  const displayValue = isNumeric ? (isEditing ? draftValue : formatNumericInputValue(value)) : value;

  React.useEffect(() => {
    if (isNumeric && !isEditing) setDraftValue(formatNumericInputValue(value));
  }, [isNumeric, isEditing, value]);

  return (
    <input
      {...rest}
      value={displayValue}
      type={isNumeric ? "text" : type}
      inputMode={isNumeric ? "decimal" : inputMode}
      data-coldpro-numeric={isNumeric ? "true" : undefined}
      onFocus={(event) => {
        if (isNumeric) {
          setIsEditing(true);
          setDraftValue(String(event.currentTarget.value ?? ""));
        }
        onFocus?.(event);
      }}
      onBlur={(event) => {
        if (isNumeric) setIsEditing(false);
        onBlur?.(event);
      }}
      onChange={(event) => {
        if (isNumeric) setDraftValue(event.currentTarget.value);
        onChange?.(event);
      }}
      onMouseUp={(event) => {
        onMouseUp?.(event);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!event.defaultPrevented && isNumeric && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
          event.preventDefault();
        }
      }}
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-transparent px-3 text-right text-base tabular-nums sm:h-10",
        "transition focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15",
        readOnlyValue
          ? "bg-primary/5 text-foreground"
          : "bg-muted/40 hover:bg-muted/60",
        className,
      )}
    />
  );
}

function formatNumericInputValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") return value;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  const rounded = Math.round((parsed + Number.EPSILON) * 10000) / 10000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

export function ColdProSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
) {
  const { className, children, ...rest } = props;
  return (
    <select
      {...rest}
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-transparent bg-muted/40 px-3 text-sm sm:h-10",
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
