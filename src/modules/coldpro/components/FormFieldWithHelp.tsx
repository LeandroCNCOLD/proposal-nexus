import * as React from "react";
import { FieldHelpTooltip } from "./FieldHelpTooltip";
import { type ColdProFieldHelp, type ColdProFieldHelpKey } from "../core/fieldHelpTexts";

type FormFieldWithHelpProps = {
  label: React.ReactNode;
  help?: ColdProFieldHelp | null;
  helpKey?: ColdProFieldHelpKey | string | null;
  className?: string;
};

export function FormFieldWithHelp({ label, help, helpKey, className }: FormFieldWithHelpProps) {
  return (
    <span className={className ?? "inline-flex min-w-0 flex-wrap items-center justify-end gap-1.5 whitespace-normal break-words"}>
      <span className="min-w-0 whitespace-normal break-words">{label}</span>
      {(help || helpKey) ? <FieldHelpTooltip help={help} helpKey={helpKey} /> : null}
    </span>
  );
}
