import { brl } from "@/lib/format";
import { calculateTaxSummary, toFinancialNumber } from "@/modules/proposals/financial";

/**
 * Resumo de impostos calculados pelo Nomus.
 * Aceita tanto o JSON cru de `totalTributacao[0]` (valores em string BR)
 * quanto valores já parseados em número.
 */
export type ProposalTaxFields = {
  valorIcms?: string | number | null;
  valorIss?: string | number | null;
  valorPis?: string | number | null;
  valorCofins?: string | number | null;
  valorCbs?: string | number | null;
  valorIbs?: string | number | null;
  valorIbsEstadual?: string | number | null;
  // Campos que o Nomus às vezes envia separadamente
  valorIcmsSt?: string | number | null;
  valorIpi?: string | number | null;
};

type Props = {
  totalTributacao?: ProposalTaxFields | Record<string, unknown> | null;
  /** Fallback quando totalTributacao não vier — usa colunas planas. */
  fallback?: {
    icms?: number | null;
    icms_st?: number | null;
    ipi?: number | null;
    iss?: number | null;
    pis?: number | null;
    cofins?: number | null;
    cbs?: number | null;
    ibs?: number | null;
    ibs_estadual?: number | null;
  };
};

export function ProposalTaxSummary({ totalTributacao, fallback }: Props) {
  const tt = (totalTributacao ?? {}) as Record<string, unknown>;

  const items: Array<{ key: string; label: string; value: number | null; hint?: string }> = [
    {
      key: "icms",
      label: "ICMS",
      value: toFinancialNumber(tt.valorIcms) ?? fallback?.icms ?? null,
    },
    {
      key: "icms_st",
      label: "ICMS ST",
      value: toFinancialNumber(tt.valorIcmsSt) ?? fallback?.icms_st ?? null,
    },
    { key: "ipi", label: "IPI", value: toFinancialNumber(tt.valorIpi) ?? fallback?.ipi ?? null },
    {
      key: "iss",
      label: "ISS / ISSQN",
      value: toFinancialNumber(tt.valorIss) ?? fallback?.iss ?? null,
    },
    { key: "pis", label: "PIS", value: toFinancialNumber(tt.valorPis) ?? fallback?.pis ?? null },
    {
      key: "cofins",
      label: "COFINS",
      value: toFinancialNumber(tt.valorCofins) ?? fallback?.cofins ?? null,
    },
    {
      key: "cbs",
      label: "CBS",
      value: toFinancialNumber(tt.valorCbs) ?? fallback?.cbs ?? null,
      hint: "Reforma tributária",
    },
    {
      key: "ibs",
      label: "IBS",
      value: toFinancialNumber(tt.valorIbs) ?? fallback?.ibs ?? null,
      hint: "Reforma tributária",
    },
    {
      key: "ibs_estadual",
      label: "IBS Estadual",
      value: toFinancialNumber(tt.valorIbsEstadual) ?? fallback?.ibs_estadual ?? null,
      hint: "Reforma tributária",
    },
  ];

  const visible = items.filter((it) => it.value !== null && it.value !== 0);
  const total = calculateTaxSummary({
    icms: items.find((it) => it.key === "icms")?.value ?? null,
    icmsSt: items.find((it) => it.key === "icms_st")?.value ?? null,
    ipi: items.find((it) => it.key === "ipi")?.value ?? null,
    iss: items.find((it) => it.key === "iss")?.value ?? null,
    pis: items.find((it) => it.key === "pis")?.value ?? null,
    cofins: items.find((it) => it.key === "cofins")?.value ?? null,
    cbs: items.find((it) => it.key === "cbs")?.value ?? null,
    ibs: items.find((it) => it.key === "ibs")?.value ?? null,
    ibsEstadual: items.find((it) => it.key === "ibs_estadual")?.value ?? null,
  }).total;

  if (visible.length === 0) {
    return (
      <div className="rounded-md border bg-secondary/30 p-4 text-sm text-muted-foreground">
        Sem informações de impostos sincronizadas para esta proposta.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="border-b bg-secondary/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Resumo de impostos (Nomus)
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border">
        {visible.map((it) => (
          <div key={it.key} className="bg-card p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-muted-foreground">{it.label}</span>
              {it.hint ? (
                <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                  {it.hint}
                </span>
              ) : null}
            </div>
            <div className="text-base font-semibold tabular-nums mt-1">{brl(it.value)}</div>
          </div>
        ))}
      </div>
      <div className="border-t bg-secondary/30 px-4 py-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Total de impostos
        </span>
        <span className="text-lg font-semibold tabular-nums">{brl(total)}</span>
      </div>
    </div>
  );
}
