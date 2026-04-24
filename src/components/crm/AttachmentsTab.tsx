import { dateTimeBR } from "@/lib/format";

export function AttachmentsTab({ detail }: { detail: any }) {
  const nomusAttachments: any[] = (detail.process?.raw?.arquivosAnexos as any[]) ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-3">
          <h3 className="text-sm font-semibold">Anexos do Nomus</h3>
        </div>
        {nomusAttachments.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhum anexo no Nomus.</p>
        ) : (
          <ul className="divide-y divide-border">
            {nomusAttachments.map((a: any, i: number) => (
              <li key={i} className="p-3 text-sm">
                {a.nome ?? a.name ?? `Arquivo ${i + 1}`}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-3">
          <h3 className="text-sm font-semibold">Anexos locais</h3>
        </div>
        {detail.attachments.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Upload de anexos locais será liberado em uma próxima iteração.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {detail.attachments.map((a: any) => (
              <li key={a.id} className="flex items-center justify-between p-3 text-sm">
                <span>{a.name}</span>
                <span className="text-xs text-muted-foreground">{dateTimeBR(a.uploaded_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
