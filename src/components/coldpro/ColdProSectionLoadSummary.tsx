function fmt(value: unknown) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(value ?? 0));
}

type LoadRow = { label: string; value: unknown; muted?: boolean };

export function ColdProSectionLoadSummary({ title, rows, totalLabel = "Total calculado da aba", total }: { title: string; rows: LoadRow[]; totalLabel?: string; total: unknown }) {
  const hasValues = rows.some((row) => Number(row.value ?? 0) !== 0) || Number(total ?? 0) !== 0;
  return (
    <div className="rounded-xl border bg-background p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="rounded-md bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
          {totalLabel}: <span className="tabular-nums">{fmt(total)} kcal/h</span>
        </div>
      </div>
      {hasValues ? (
        <div className="grid gap-2 text-sm md:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <span className={row.muted ? "text-muted-foreground" : "text-foreground"}>{row.label}</span>
              <b className="tabular-nums">{fmt(row.value)} kcal/h</b>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Preencha esta etapa e gere o cálculo para visualizar a carga correspondente.</div>
      )}
      <div className="mt-3 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        {totalLabel}: <b className="text-foreground tabular-nums">{fmt(total)} kcal/h</b>
      </div>
    </div>
  );
}