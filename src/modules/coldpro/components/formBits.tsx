export function Field({ label, children, unit }: { label: string; children: React.ReactNode; unit?: string }) {
  return <label className="grid gap-1 text-sm"><span className="text-xs font-medium text-muted-foreground">{label}{unit ? ` (${unit})` : ""}</span>{children}</label>;
}
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border bg-background p-4"><h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>{children}</section>;
}
export const inputClass = "h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
export const selectClass = inputClass;
