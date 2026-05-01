import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Clock3, FileText, Loader2, RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl, num } from "@/lib/format";
import type { ProposalStatus } from "@/lib/proposal";
import { cn } from "@/lib/utils";
import {
  PerItemPriceTablePicker,
  MatchMethodChip,
} from "@/features/price-table-picker/PerItemPriceTablePicker";
import type { ItemPriceTable } from "@/features/price-table-picker/select-table-for-item";

type StateTone = "neutral" | "success" | "warning" | "destructive" | "info";

const toneStyles: Record<StateTone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning-foreground border-warning/30",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-info/10 text-info border-info/20",
};

export function ProposalStatusBadge({ status, className }: { status: ProposalStatus; className?: string }) {
  return <StatusBadge status={status} className={className} />;
}

export function LoadingState({ label = "Carregando dados…" }: { label?: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-lg border bg-card p-8 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
      {label}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed bg-card/70 p-8 text-center">
      <FileText className="mx-auto h-8 w-8 text-muted-foreground/60" />
      <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = "Não foi possível carregar os dados", description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-5 text-sm">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground">{title}</h3>
          {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function NomusSyncStatus({ statusLabel, running, hasError, cursor, onSync, syncing }: { statusLabel: string; running?: boolean; hasError?: boolean; cursor?: string | null; onSync?: () => void; syncing?: boolean }) {
  const Icon = running ? Clock3 : hasError ? AlertCircle : CheckCircle2;
  return (
    <div className="mb-4 rounded-lg border bg-card p-3 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Icon className={cn("h-4 w-4", running ? "animate-pulse text-primary" : hasError ? "text-destructive" : "text-success")} />
          <span className="truncate text-muted-foreground">{statusLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {cursor ? <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">Cursor: {cursor}</span> : null}
          {onSync ? (
            <Button size="sm" variant="outline" onClick={onSync} disabled={syncing}>
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", syncing && "animate-spin")} />
              Atualizar
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ProposalHeader({ title, number, client, status, total, margin, date, actions }: { title: string; number?: ReactNode; client?: ReactNode; status?: ProposalStatus; total?: ReactNode; margin?: ReactNode; date?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 rounded-lg border bg-card p-5 shadow-[var(--shadow-sm)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {number ? <span className="font-mono text-xs text-muted-foreground">{number}</span> : null}
            {status ? <ProposalStatusBadge status={status} /> : null}
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {client ? <p className="mt-1 text-sm text-muted-foreground">{client}</p> : null}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start lg:justify-end">
          <div className="grid grid-cols-3 gap-2 text-right sm:min-w-80">
            <HeaderMetric label="Valor" value={total ?? "—"} />
            <HeaderMetric label="Margem" value={margin ?? "—"} />
            <HeaderMetric label="Data" value={date ?? "—"} />
          </div>
          {actions ? <div className="flex flex-wrap justify-end gap-2">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}

function HeaderMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md bg-secondary/40 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function FinancialSummaryCard({ title = "Resumo financeiro", metrics }: { title?: string; metrics: Array<{ label: string; value: ReactNode; tone?: StateTone }> }) {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-[var(--shadow-sm)]">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className={cn("rounded-md border px-3 py-3", toneStyles[metric.tone ?? "neutral"])}>
            <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{metric.label}</div>
            <div className="mt-1 text-base font-semibold tabular-nums">{metric.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type ProposalItemTableRow = {
  id: string;
  position?: number | null;
  productCode?: string | null;
  nomusProductId?: string | null;
  priceTableId?: string | null;
  priceTableName?: string | null;
  priceTableMatchMethod?: string | null;
  description?: string | null;
  additionalInfo?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  /** Preço unitário vindo da tabela de preço selecionada (para comparação). */
  priceTableUnitPrice?: number | null;
  /** Snapshots de custo unitário (vindos da tabela). */
  priceTableCustoMateriais?: number | null;
  priceTableCustoMod?: number | null;
  priceTableCustoCif?: number | null;
  priceTableCustoProducaoTotal?: number | null;
  discount?: number | null;
  total?: number | null;
  status?: string | null;
};

export function ProposalItemsTable({
  items,
  onOpenItem,
  showPriceTableComparison = false,
  tablesByProduct,
  clientUf,
  onChangeItemTable,
  onResetItemTable,
}: {
  items: ProposalItemTableRow[];
  onOpenItem?: (item: ProposalItemTableRow) => void;
  showPriceTableComparison?: boolean;
  /** Quando informado, renderiza um dropdown por linha. */
  tablesByProduct?: import("@/features/price-table-picker/use-item-price-tables").PerItemTablesByProduct;
  clientUf?: string | null;
  onChangeItemTable?: (
    proposalItemId: string,
    table: import("@/features/price-table-picker/select-table-for-item").ItemPriceTable | null,
  ) => void;
  onResetItemTable?: (proposalItemId: string, productId: string | null) => void;
}) {
  if (items.length === 0) return <EmptyState title="Sem itens sincronizados" description="Os itens aparecerão aqui quando a proposta tiver dados importados." />;
  const interactive = !!tablesByProduct && !!onChangeItemTable;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/40">
            <TableHead className="w-14">#</TableHead>
            <TableHead className="w-28">Código</TableHead>
            <TableHead className="w-72">Tabela aplicada</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="text-right">Qtd.</TableHead>
            <TableHead className="text-right">Venda unit.</TableHead>
            <TableHead className="text-right">Venda total</TableHead>
            {showPriceTableComparison && <TableHead className="text-right">Tabela unit.</TableHead>}
            {showPriceTableComparison && <TableHead className="text-right">Tabela total</TableHead>}
            {showPriceTableComparison && <TableHead className="text-right">Desconto (R$)</TableHead>}
            {showPriceTableComparison && <TableHead className="text-right">Desconto (%)</TableHead>}
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const productTables = item.nomusProductId
              ? tablesByProduct?.get(item.nomusProductId) ?? []
              : [];
            // Em modo interativo, o preço da tabela vem da escolha persistida do item
            // (snapshot) OU, se não houver, da tabela atualmente selecionada.
            const selectedTable =
              productTables.find((t) => t.id === item.priceTableId) ?? null;
            const tableUnit =
              item.priceTableUnitPrice ?? selectedTable?.unitPrice ?? null;
            const offered = item.unitPrice;
            const qty = item.quantity ?? 0;
            const saleTotal = item.total ?? (offered != null ? offered * qty : null);
            const tableTotal = tableUnit != null ? tableUnit * qty : null;
            const discountValue =
              tableTotal != null && saleTotal != null ? tableTotal - saleTotal : null;
            const discountPct =
              tableUnit && offered != null && tableUnit > 0
                ? ((tableUnit - offered) / tableUnit) * 100
                : null;
            return (
              <TableRow key={item.id} className={cn(onOpenItem && "cursor-pointer hover:bg-secondary/30")} onClick={() => onOpenItem?.(item)}>
                <TableCell className="font-mono text-xs text-muted-foreground">{String((item.position ?? 0) + 1).padStart(2, "0")}</TableCell>
                <TableCell className="font-mono text-xs">{item.productCode ?? "—"}</TableCell>
                <TableCell className="text-xs font-medium">
                  {interactive && item.nomusProductId ? (
                    <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                      <PerItemPriceTablePicker
                        tables={productTables}
                        selectedTableId={item.priceTableId ?? null}
                        clientUf={clientUf ?? null}
                        itemUnitPrice={item.unitPrice ?? null}
                        onPick={(t: ItemPriceTable | null) => onChangeItemTable!(item.id, t)}
                        onResetAuto={
                          onResetItemTable
                            ? () => onResetItemTable(item.id, item.nomusProductId ?? null)
                            : undefined
                        }
                      />
                      <MatchMethodChip
                        method={item.priceTableMatchMethod ?? null}
                        hasTable={productTables.length > 0}
                      />
                    </div>
                  ) : (
                    item.priceTableName ?? "—"
                  )}
                </TableCell>
                <TableCell className="min-w-72">
                  <div className="font-medium text-foreground">{item.description ?? "—"}</div>
                  {item.additionalInfo ? <div className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{item.additionalInfo}</div> : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">{num(item.quantity, 2)}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(offered)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{brl(saleTotal)}</TableCell>
                {showPriceTableComparison && (
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {tableUnit != null ? brl(tableUnit) : "—"}
                  </TableCell>
                )}
                {showPriceTableComparison && (
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {tableTotal != null ? brl(tableTotal) : "—"}
                  </TableCell>
                )}
                {showPriceTableComparison && (
                  <TableCell className="text-right tabular-nums">
                    {discountValue == null ? "—" : (
                      <span className={cn(discountValue > 0 ? "text-amber-700" : discountValue < 0 ? "text-emerald-700" : "")}>
                        {brl(discountValue)}
                      </span>
                    )}
                  </TableCell>
                )}
                {showPriceTableComparison && (
                  <TableCell className="text-right tabular-nums">
                    {discountPct == null ? (
                      "—"
                    ) : (
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[11px] font-medium",
                        discountPct > 0 ? "bg-amber-100 text-amber-800" : discountPct < 0 ? "bg-emerald-100 text-emerald-800" : "text-muted-foreground"
                      )}>
                        {discountPct > 0 ? "-" : discountPct < 0 ? "+" : ""}{Math.abs(discountPct).toFixed(2)}%
                      </span>
                    )}
                  </TableCell>
                )}
                <TableCell>{item.status ? <span className="rounded-full border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{item.status}</span> : "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function ApprovalTimeline({ steps }: { steps: Array<{ id: string; title: string; responsible?: ReactNode; status?: ReactNode; date?: ReactNode; tone?: StateTone }> }) {
  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {steps.map((step) => (
        <li key={step.id} className="relative">
          <span className={cn("absolute -left-[27px] top-1 flex h-3 w-3 rounded-full border-2 border-card", toneStyles[step.tone ?? "neutral"])} />
          <div className="rounded-md border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">{step.title}</div>
              {step.status ? <div className="text-xs text-muted-foreground">{step.status}</div> : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {step.responsible ? <span>{step.responsible}</span> : null}
              {step.date ? <span>{step.date}</span> : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ProposalCard({ id, number, client, status, total, meta }: { id: string; number: ReactNode; client: ReactNode; status: ProposalStatus; total: ReactNode; meta?: ReactNode }) {
  return (
    <Link to="/app/propostas/$id" params={{ id }} className="block rounded-lg border bg-card p-4 shadow-[var(--shadow-sm)] transition-colors hover:bg-secondary/20 md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-xs text-muted-foreground">{number}</div>
          <div className="mt-1 truncate text-sm font-semibold">{client}</div>
        </div>
        <ProposalStatusBadge status={status} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{meta}</span>
        <span className="font-semibold tabular-nums">{total}</span>
      </div>
    </Link>
  );
}