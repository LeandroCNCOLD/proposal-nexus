import { brl, num } from "@/lib/format";

/**
 * Renderiza a Análise de Lucro de um item de proposta vinda do Nomus.
 *
 * O Nomus expõe ~23 campos no endpoint
 * `GET /propostas/{idProposta}/itens/{idItem}`. Aqui agrupamos em 4 blocos:
 *  1. Composição do valor
 *  2. Impostos a recolher
 *  3. Custos
 *  4. Resultado (lucro / margem)
 */

type Lucro = Record<string, unknown> | null | undefined;

function n(o: NonNullable<Lucro>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (v === null || v === undefined || v === "") continue;
    const num = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function fmt(v: number | null, kind: "money" | "percent" = "money"): string {
  if (v === null) return "—";
  if (kind === "money") return brl(v);
  return `${num(v, 2)} %`;
}

export function ProposalItemLucroAnalysis({ analiseLucro }: { analiseLucro: Lucro }) {
  if (!analiseLucro) {
    return (
      <div className="rounded-md border bg-secondary/30 p-3 text-sm text-muted-foreground">
        Análise de lucro não disponível para este item. Os valores aparecem aqui
        após o detalhe completo do item ser carregado do Nomus.
      </div>
    );
  }
  const o = analiseLucro;

  const valorProdutos = n(o, "valorProdutos", "valorTotalProdutos", "valorTotal");
  const descontos = n(o, "valorDescontos", "descontos", "valorDesconto");
  const valorComDesconto = n(o, "valorTotalComDesconto", "valorComDesconto");

  const icms = n(o, "valorIcms", "valorIcmsRecolher");
  const icmsSt = n(o, "valorIcmsSt", "valorIcmsStRecolher");
  const ipi = n(o, "valorIpi", "valorIpiRecolher");
  const pis = n(o, "valorPis", "valorPisRecolher");
  const cofins = n(o, "valorCofins", "valorCofinsRecolher");
  const issqn = n(o, "valorIssqn", "valorIss", "valorIssqnRecolher");
  const simples = n(o, "valorSimplesNacional", "valorSimplesNacionalRecolher");

  const cMat = n(o, "custosMateriais", "valorCustosMateriais");
  const cMod = n(o, "custosMod", "custosMaoObraDireta", "custosMOD");
  const cCif = n(o, "custosCif", "custosIndiretosFabricacao", "custosCIF");
  const cAdm = n(o, "custosAdministrativos");
  const cInc = n(o, "custosIncidentesLucro", "custosIncidentesSobreLucro");
  const totalCustos = [cMat, cMod, cCif, cAdm, cInc].reduce<number | null>(
    (acc, v) => (v == null ? acc : (acc ?? 0) + v),
    null,
  );

  const lucroBruto = n(o, "lucroBruto", "valorLucroBruto");
  const margemBruta = n(o, "margemBruta", "margemLucroBruto", "percentualMargemBruta", "margemBrutaPct");
  const lucroAntesImpostos = n(o, "lucroAntesImpostos");
  const lucroLiquido = n(o, "lucroLiquido", "valorLucroLiquido");
  const margemLiquida = n(o, "margemLiquida", "margemLucroLiquido", "percentualMargemLiquida", "margemLiquidaPct");

  return (
    <div className="space-y-4">
      <Block title="Composição do valor">
        <Row label="Valor produtos" value={fmt(valorProdutos)} />
        <Row label="Descontos" value={descontos != null ? `- ${fmt(descontos)}` : "—"} />
        <Row label="Valor total c/ desconto" value={fmt(valorComDesconto)} strong />
      </Block>

      <Block title="Impostos a recolher">
        <Row label="ICMS" value={fmt(icms)} />
        <Row label="ICMS-ST" value={fmt(icmsSt)} />
        <Row label="IPI" value={fmt(ipi)} />
        <Row label="PIS" value={fmt(pis)} />
        <Row label="COFINS" value={fmt(cofins)} />
        <Row label="ISSQN" value={fmt(issqn)} />
        <Row label="Simples Nacional" value={fmt(simples)} />
      </Block>

      <Block title="Custos">
        <Row label="Materiais" value={fmt(cMat)} />
        <Row label="MOD" value={fmt(cMod)} />
        <Row label="CIF" value={fmt(cCif)} />
        <Row label="Administrativos" value={fmt(cAdm)} />
        <Row label="Incidentes sobre lucro" value={fmt(cInc)} />
        <Row label="Total de custos" value={fmt(totalCustos)} strong />
      </Block>

      <Block title="Resultado">
        <Row label="Lucro bruto" value={fmt(lucroBruto)} />
        <Row label="Margem bruta" value={fmt(margemBruta, "percent")} />
        <Row label="Lucro antes dos impostos" value={fmt(lucroAntesImpostos)} />
        <Row label="Lucro líquido" value={fmt(lucroLiquido)} strong />
        <Row label="Margem líquida" value={fmt(margemLiquida, "percent")} strong />
      </Block>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b bg-secondary/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="divide-y">{children}</div>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 text-sm">
      <span className={strong ? "font-medium" : "text-muted-foreground"}>{label}</span>
      <span className={`tabular-nums ${strong ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
