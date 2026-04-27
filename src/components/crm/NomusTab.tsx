export function NomusTab({ detail }: { detail: any }) {
  const p = detail.process;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Descrição (HTML do Nomus)</h3>
        {p.descricao ? (
          <div
            className="prose prose-sm max-w-none text-foreground"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: p.descricao }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Sem descrição.</p>
        )}
      </div>
      <details className="rounded-lg border border-border bg-card p-4">
        <summary className="cursor-pointer text-sm font-semibold">Payload bruto (debug)</summary>
        <pre className="mt-3 max-h-[500px] overflow-auto rounded bg-muted p-3 text-[11px]">
          {JSON.stringify(p.raw, null, 2)}
        </pre>
      </details>
    </div>
  );
}
