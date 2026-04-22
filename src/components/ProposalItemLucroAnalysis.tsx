import { brl, num } from "@/lib/format";

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

export function ProposalItemLucroAnalysis({ analiseLucro, proposalAnaliseLucro, ratio = 0 }: Props) {
  const useDetail = !!analiseLucro;
  const r = useDetail ? 1 : ratio;

  // Resolve valor: se temos detail, lê do detail; senão, rateia do total da proposta.
  const v = (detailKeys: string[], proposalKey: keyof ProposalAnaliseLucro): number | null => {
    if (useDetail && analiseLucro) {
      const x = pickNum(analiseLucro, ...detailKeys);
      return x;
    }
    if (proposalAnaliseLucro) {
      const raw = proposalAnaliseLucro[proposalKey];
      if (raw == null) return null;
      return Number(raw) * r;
    }
    return null;
  };

  // Margens não são rateadas — são percentuais; vêm prontas da proposta.
  const margin = (detailKeys: string[], proposalKey: keyof ProposalAnaliseLucro): number | null => {
    if (useDetail && analiseLucro) return pickNum(analiseLucro, ...detailKeys);
    if (proposalAnaliseLucro) {
      const raw = proposalAnaliseLucro[proposalKey];
      return raw == null ? null : Number(raw);
    }
    return null;
  };

  const valorProdutos        = v(["valorProdutos", "valorTotalProdutos", "valorTotal"], "valor_produtos");
  const descontos            = v(["valorDescontos", "descontos", "valorDesconto"], "valor_descontos");
  const valorComDesconto     = v(["valorTotalComDesconto", "valorComDesconto"], "valor_total_com_desconto");

  const icms                 = v(["valorIcms", "valorIcmsRecolher"], "icms_recolher");
  const icmsSt               = v(["valorIcmsSt", "valorIcmsStRecolher"], "icms_st_recolher");
  const ipi                  = v(["valorIpi", "valorIpiRecolher"], "ipi_recolher");
  const pis                  = v(["valorPis", "valorPisRecolher"], "pis_recolher");
  const cofins               = v(["valorCofins", "valorCofinsRecolher"], "cofins_recolher");
  const issqn                = v(["valorIssqn", "valorIss", "valorIssqnRecolher"], "issqn_recolher");
  const simples              = v(["valorSimplesNacional", "valorSimplesNacionalRecolher"], "simples_nacional_recolher");

  const comissoes            = v(["valorComissoesVenda", "comissoesVenda"], "comissoes_venda");
  const frete                = v(["valorFrete", "frete"], "frete_valor");
  const seguros              = v(["valorSeguros", "seguros"], "seguros_valor");
  const outrasDespesas       = v(["valorOutrasDespesasAcessorias", "despesasAcessorias", "outrasDespesas"], "despesas_acessorias");

  const valorLiquido         = v(["valorLiquido", "valorLiquidoItem"], "valor_liquido");

  const custosProducao       = v(["custosProducao", "valorCustoProducao"], "custos_producao");
  const cMat                 = v(["custosMateriais", "valorCustoMateriais"], "custos_materiais");
  const cMod                 = v(["custosMod", "valorCustoMod", "custosMOD"], "custos_mod");
  const cCif                 = v(["custosCif", "valorCustoCif", "custosCIF"], "custos_cif");

  const lucroBruto           = v(["lucroBruto", "valorLucroBruto"], "lucro_bruto");
  const margemBruta          = margin(["margemBruta", "margemLucroBruto", "margemBrutaPct", "percentualMargemBruta"], "margem_bruta_pct");

  const custosAdmin          = v(["custosAdministrativos"], "custos_administrativos");
  const lucroAntesImpostos   = v(["lucroAntesImpostos"], "lucro_antes_impostos");
  const custosIncidentes     = v(["custosIncidentesLucro", "custosIncidentesSobreLucro"], "custos_incidentes_lucro");
  const lucroLiquido         = v(["lucroLiquido", "valorLucroLiquido"], "lucro_liquido");
  const margemLiquida        = margin(["margemLiquida", "margemLucroLiquido", "margemLiquidaPct", "percentualMargemLiquida"], "margem_liquida_pct");

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
      "Impostos (ICMS/IPI/PIS/COFINS)": [icms, ipi, pis, cofins],
      "Custos de produção (Materiais/MOD/CIF)": [custosProducao, cMat, cMod, cCif],
      "Despesas comerciais (Comissões/Frete/Seguros)": [comissoes, frete, seguros],
      "Custos administrativos": [custosAdmin],
      "Resultado (Lucro bruto/líquido)": [lucroBruto, lucroLiquido],
    },
  });

  return (
    <div className="space-y-3">
      {!useDetail && (
        <div className="text-[11px] text-muted-foreground">
          Valores rateados a partir da análise de lucro da proposta — participação deste item:{" "}
          <span className="font-semibold text-foreground tabular-nums">{(r * 100).toFixed(2)}%</span>
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
            <Row label="Valor total dos produtos"                 value={valorProdutos} />
            <Row label="(-) Descontos incondicionais"             value={negate(descontos)} />
            <Row label="(=) Valor total com desconto"             value={valorComDesconto} emphasis />

            <Row label="(-) ICMS a recolher"                      value={negate(icms)} />
            <Row label="(-) ICMS ST a recolher"                   value={negate(icmsSt)} />
            <Row label="(-) IPI a recolher"                       value={negate(ipi)} />
            <Row label="(-) PIS a recolher"                       value={negate(pis)} />
            <Row label="(-) COFINS a recolher"                    value={negate(cofins)} />
            <Row label="(-) ISSQN a recolher"                     value={negate(issqn)} />
            <Row label="(-) Simples Nacional a recolher"          value={negate(simples)} />

            <Row label="(-) Comissões de venda"                   value={negate(comissoes)} />
            <Row label="(-) Frete"                                value={negate(frete)} />
            <Row label="(-) Seguros"                              value={negate(seguros)} />
            <Row label="(-) Outras despesas acessórias"           value={negate(outrasDespesas)} />

            <Row label="(=) Valor líquido do item"                value={valorLiquido} emphasis />

            <Row label="(-) Custos de produção"                   value={negate(custosProducao)} />
            <SubRow label=">>> Custos de materiais"               value={cMat} />
            <SubRow label=">>> Custos de mão de obra direta (MOD)" value={cMod} />
            <SubRow label=">>> Custos indiretos de fabricação (CIF)" value={cCif} />

            <Row label="(=) Lucro bruto"                          value={lucroBruto} pct={margemBruta} emphasis positive />
            <SubRow label="Margem de lucro bruto"                  value={null} pct={margemBruta} />

            <Row label="(-) Custos administrativos"               value={negate(custosAdmin)} />
            <Row label="(=) Lucro antes dos impostos"             value={lucroAntesImpostos} emphasis />
            <Row label="(-) Custos incidentes sobre lucro"        value={negate(custosIncidentes)} />

            <Row label="(=) Lucro líquido"                        value={lucroLiquido} pct={margemLiquida} emphasis positive />
            <SubRow label="Margem de lucro líquido"               value={null} pct={margemLiquida} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============= helpers =============

function pickNum(o: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const raw = o[k];
    if (raw === null || raw === undefined || raw === "") continue;
    const n = typeof raw === "number" ? raw : Number(String(raw).replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function negate(v: number | null): number | null {
  if (v === null) return null;
  return v === 0 ? 0 : -Math.abs(v);
}

function Row({
  label, value, emphasis, positive, pct,
}: {
  label: string;
  value: number | null;
  emphasis?: boolean;
  positive?: boolean;
  pct?: number | null;
}) {
  return (
    <tr className={emphasis ? "border-t bg-secondary/30" : "border-t"}>
      <td className={"px-3 py-1.5 " + (emphasis ? "font-semibold " : "") + (positive ? "text-success" : "")}>
        {label}
      </td>
      <td className={"px-3 py-1.5 text-right tabular-nums " + (emphasis ? "font-semibold " : "") + (positive ? "text-success" : "")}>
        {value === null ? "—" : brl(value)}
      </td>
      <td className="px-3 py-1.5 text-right text-xs text-muted-foreground tabular-nums w-24">
        {pct != null ? `${num(pct, 2)} %` : ""}
      </td>
    </tr>
  );
}

function SubRow({ label, value, pct }: { label: string; value: number | null; pct?: number | null }) {
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
