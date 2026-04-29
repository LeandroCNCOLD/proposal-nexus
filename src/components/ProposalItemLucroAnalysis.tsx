import { brl, num } from "@/lib/format";
import { resolveNomusLucroAnalysisValues } from "@/modules/proposals/financial";

/**
 * Análise de Lucro do item da proposta.
 *
 * Reproduz EXATAMENTE as 23 linhas da tela de Análise de Lucro do Nomus
 * (na mesma ordem e com os mesmos símbolos `(=)`, `(-)`, `>>>`).
 *
 * Duas fontes possíveis:
 *  1. `analiseLucro` — vem do endpoint individual do item
 *     (`GET /propostas/{id}/itens/{itemId}.analiseLucro`). Quando presente,
 *     mostra os valores reais do item.
 *  2. Fallback rateado: quando o detail individual não está disponível
 *     (instalações do Nomus que não expõem esse endpoint), usamos os totais
 *     da PROPOSTA (`proposalAnaliseLucro`) e aplicamos `ratio` (participação
 *     do item no total dos produtos) — assim as 23 linhas aparecem
 *     preenchidas com valores estimados.
 */

type Money = number | null | undefined;

export type ProposalAnaliseLucro = {
  valor_produtos: Money;
  valor_descontos: Money;
  valor_total_com_desconto: Money;

  icms_recolher: Money;
  icms_st_recolher: Money;
  ipi_recolher: Money;
  pis_recolher: Money;
  cofins_recolher: Money;
  issqn_recolher: Money;
  simples_nacional_recolher: Money;

  comissoes_venda: Money;
  frete_valor: Money;
  seguros_valor: Money;
  despesas_acessorias: Money;

  valor_liquido: Money;

  custos_producao: Money;
  custos_materiais: Money;
  custos_mod: Money;
  custos_cif: Money;

  lucro_bruto: Money;
  margem_bruta_pct: Money;
  custos_administrativos: Money;
  lucro_antes_impostos: Money;
  custos_incidentes_lucro: Money;
  lucro_liquido: Money;
  margem_liquida_pct: Money;
};

type Props = {
  /** Análise vinda do detail individual do item (preferencial). */
  analiseLucro?: Record<string, unknown> | null;
  /** Totais da proposta — usados quando `analiseLucro` for null. */
  proposalAnaliseLucro?: ProposalAnaliseLucro | null;
  /** Participação do item no total dos produtos (0..1). */
  ratio?: number;
};

export function ProposalItemLucroAnalysis({
  analiseLucro,
  proposalAnaliseLucro,
  ratio = 0,
}: Props) {
  const useDetail = !!analiseLucro;
  const r = useDetail ? 1 : ratio;
  const lucro = resolveNomusLucroAnalysisValues({ analiseLucro, proposalAnaliseLucro, ratio });

  const noData = !useDetail && !proposalAnaliseLucro;
  if (noData) {
    return (
      <div className="rounded-md border bg-secondary/30 p-3 text-sm text-muted-foreground">
        Análise de lucro não disponível.
      </div>
    );
  }

  // ============= Diagnóstico de campos zerados/ausentes =============
  // Verifica grupos importantes e identifica a origem provável do problema.
  const diagnostics = buildDiagnostics({
    useDetail,
    hasProposalData: !!proposalAnaliseLucro,
    ratio: r,
    groups: {
      "Impostos (ICMS/IPI/PIS/COFINS)": [lucro.icms, lucro.ipi, lucro.pis, lucro.cofins],
      "Custos de produção (Materiais/MOD/CIF)": [
        lucro.custosProducao,
        lucro.custosMateriais,
        lucro.custosMod,
        lucro.custosCif,
      ],
      "Despesas comerciais (Comissões/Frete/Seguros)": [
        lucro.comissoes,
        lucro.frete,
        lucro.seguros,
      ],
      "Custos administrativos": [lucro.custosAdministrativos],
      "Resultado (Lucro bruto/líquido)": [lucro.lucroBruto, lucro.lucroLiquido],
    },
  });

  return (
    <div className="space-y-3">
      {!useDetail && (
        <div className="text-[11px] text-muted-foreground">
          Valores rateados a partir da análise de lucro da proposta — participação deste item:{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {(r * 100).toFixed(2)}%
          </span>
        </div>
      )}

      {diagnostics.length > 0 && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
          <div className="mb-1.5 font-semibold text-warning-foreground">
            ⚠ Campos sem dados detectados
          </div>
          <ul className="space-y-1 text-muted-foreground">
            {diagnostics.map((d, i) => (
              <li key={i}>
                <span className="font-medium text-foreground">{d.group}:</span>{" "}
                <span>{d.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <tbody>
            <Row label="Valor total dos produtos" value={lucro.valorProdutos} />
            <Row label="(-) Descontos incondicionais" value={negate(lucro.descontos)} />
            <Row label="(=) Valor total com desconto" value={lucro.valorComDesconto} emphasis />

            <Row label="(-) ICMS a recolher" value={negate(lucro.icms)} />
            <Row label="(-) ICMS ST a recolher" value={negate(lucro.icmsSt)} />
            <Row label="(-) IPI a recolher" value={negate(lucro.ipi)} />
            <Row label="(-) PIS a recolher" value={negate(lucro.pis)} />
            <Row label="(-) COFINS a recolher" value={negate(lucro.cofins)} />
            <Row label="(-) ISSQN a recolher" value={negate(lucro.issqn)} />
            <Row label="(-) Simples Nacional a recolher" value={negate(lucro.simples)} />

            <Row label="(-) Comissões de venda" value={negate(lucro.comissoes)} />
            <Row label="(-) Frete" value={negate(lucro.frete)} />
            <Row label="(-) Seguros" value={negate(lucro.seguros)} />
            <Row label="(-) Outras despesas acessórias" value={negate(lucro.outrasDespesas)} />

            <Row label="(=) Valor líquido do item" value={lucro.valorLiquido} emphasis />

            <Row label="(-) Custos de produção" value={negate(lucro.custosProducao)} />
            <SubRow label=">>> Custos de materiais" value={lucro.custosMateriais} />
            <SubRow label=">>> Custos de mão de obra direta (MOD)" value={lucro.custosMod} />
            <SubRow label=">>> Custos indiretos de fabricação (CIF)" value={lucro.custosCif} />

            <Row
              label="(=) Lucro bruto"
              value={lucro.lucroBruto}
              pct={lucro.margemBruta}
              emphasis
              positive
            />
            <SubRow label="Margem de lucro bruto" value={null} pct={lucro.margemBruta} />

            <Row label="(-) Custos administrativos" value={negate(lucro.custosAdministrativos)} />
            <Row label="(=) Lucro antes dos impostos" value={lucro.lucroAntesImpostos} emphasis />
            <Row label="(-) Custos incidentes sobre lucro" value={negate(lucro.custosIncidentes)} />

            <Row
              label="(=) Lucro líquido"
              value={lucro.lucroLiquido}
              pct={lucro.margemLiquida}
              emphasis
              positive
            />
            <SubRow label="Margem de lucro líquido" value={null} pct={lucro.margemLiquida} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============= helpers =============

type Diagnostic = { group: string; reason: string };

/**
 * Mensagens fixas por grupo. Reflete a realidade da API do Nomus desta
 * instalação: o endpoint `GET /propostas/{id}` retorna apenas os campos
 * básicos + o bloco `totalTributacao` (impostos calculados). Os blocos de
 * Custos de Produção, Despesas Comerciais, Custos Administrativos e
 * Lucro Bruto/Líquido **não são expostos pela API REST** — só existem no
 * relatório interno de Análise de Lucro do ERP.
 */
const GROUP_REASONS: Record<string, string> = {
  "Impostos (ICMS/IPI/PIS/COFINS)":
    "API do Nomus retornou bloco `totalTributacao` vazio — verifique se o cálculo de tributação foi executado no ERP antes do sync.",
  "Custos de produção (Materiais/MOD/CIF)":
    "A API REST do Nomus não expõe custos de produção em /propostas/{id} — esses dados só existem no relatório interno de Análise de Lucro do ERP.",
  "Despesas comerciais (Comissões/Frete/Seguros)":
    "A API REST do Nomus não expõe comissões/frete/seguros em /propostas/{id} — campos só existem no relatório interno de Análise de Lucro.",
  "Custos administrativos":
    "A API REST do Nomus não expõe custos administrativos em /propostas/{id} — campo só existe no relatório interno de Análise de Lucro.",
  "Resultado (Lucro bruto/líquido)":
    "Lucro bruto/líquido depende dos blocos de custos acima — como a API não os expõe, não é possível calcular pela integração.",
};

function buildDiagnostics(args: {
  useDetail: boolean;
  hasProposalData: boolean;
  ratio: number;
  groups: Record<string, Array<number | null>>;
}): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [group, values] of Object.entries(args.groups)) {
    const allNull = values.every((v) => v === null);
    const allZero = !allNull && values.every((v) => v === null || v === 0);
    if (!allNull && !allZero) continue;

    if (!args.useDetail && args.ratio === 0 && !allNull) {
      out.push({
        group,
        reason: "rateio zerou os valores (este item tem 0% de participação no total da proposta).",
      });
      continue;
    }
    out.push({ group, reason: GROUP_REASONS[group] ?? "campo ausente no payload do Nomus." });
  }
  return out;
}

function negate(v: number | null): number | null {
  if (v === null) return null;
  return v === 0 ? 0 : -Math.abs(v);
}

function Row({
  label,
  value,
  emphasis,
  positive,
  pct,
}: {
  label: string;
  value: number | null;
  emphasis?: boolean;
  positive?: boolean;
  pct?: number | null;
}) {
  return (
    <tr className={emphasis ? "border-t bg-secondary/30" : "border-t"}>
      <td
        className={
          "px-3 py-1.5 " + (emphasis ? "font-semibold " : "") + (positive ? "text-success" : "")
        }
      >
        {label}
      </td>
      <td
        className={
          "px-3 py-1.5 text-right tabular-nums " +
          (emphasis ? "font-semibold " : "") +
          (positive ? "text-success" : "")
        }
      >
        {value === null ? "—" : brl(value)}
      </td>
      <td className="px-3 py-1.5 text-right text-xs text-muted-foreground tabular-nums w-24">
        {pct != null ? `${num(pct, 2)} %` : ""}
      </td>
    </tr>
  );
}

function SubRow({
  label,
  value,
  pct,
}: {
  label: string;
  value: number | null;
  pct?: number | null;
}) {
  return (
    <tr className="border-t">
      <td className="px-3 py-1 pl-8 text-xs text-muted-foreground">{label}</td>
      <td className="px-3 py-1 text-right text-xs text-muted-foreground tabular-nums">
        {value === null ? "" : brl(value)}
      </td>
      <td className="px-3 py-1 text-right text-xs text-muted-foreground tabular-nums w-24">
        {pct != null ? `${num(pct, 2)} %` : ""}
      </td>
    </tr>
  );
}
