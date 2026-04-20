import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_VARIANT, type ProposalStatus } from "@/lib/proposal";

const VARIANTS: Record<string, string> = {
  muted: "bg-muted text-muted-foreground border-border",
  info: "bg-info/10 text-info border-info/20",
  warning: "bg-warning/15 text-warning-foreground border-warning/30",
  success: "bg-success/15 text-success border-success/30",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
};

export function StatusBadge({ status, className }: { status: ProposalStatus; className?: string }) {
  const v = STATUS_VARIANT[status];
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
      VARIANTS[v], className
    )}>
      {STATUS_LABELS[status]}
    </span>
  );
}
