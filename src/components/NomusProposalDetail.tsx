import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, num, dateBR } from "@/lib/format";
import { Loader2 } from "lucide-react";
import { NomusItemDetailDialog } from "@/components/NomusItemDetailDialog";

type NomusProposalRow = {
  id: string;
  numero: string | null;
  cliente_nome: string | null;
  empresa_nome: string | null;
  vendedor_nome: string | null;
  representante_nome: string | null;
  contato_nome: string | null;
  tabela_preco_nome: string | null;
  condicao_pagamento_nome: string | null;
  tipo_movimentacao: string | null;
  prazo_entrega_dias: number | null;
  pedido_compra_cliente: string | null;
  data_emissao: string | null;
  validade: string | null;
  criada_em_nomus: string | null;
  criada_por_nomus: string | null;
  observacoes: string | null;

  valor_produtos: number | null;
  valor_descontos: number | null;
  valor_total_com_desconto: number | null;
  valor_liquido: number | null;
  valor_total: number | null;

  icms_recolher: number | null;
  icms_st_recolher: number | null;
  ipi_recolher: number | null;
  pis_recolher: number | null;
  cofins_recolher: number | null;
  issqn_recolher: number | null;
  simples_nacional_recolher: number | null;
  comissoes_venda: number | null;
  frete_valor: number | null;
  seguros_valor: number | null;
  despesas_acessorias: number | null;

  custos_producao: number | null;
  custos_materiais: number | null;
  custos_mod: number | null;
  custos_cif: number | null;
  custos_administrativos: number | null;
  custos_incidentes_lucro: number | null;

  lucro_bruto: number | null;
  margem_bruta_pct: number | null;
  lucro_antes_impostos: number | null;
  lucro_liquido: number | null;
  margem_liquida_pct: number | null;
};

type ItemRow = {
  id: string;
  position: number | null;
  product_code: string | null;
  description: string | null;
  additional_info: string | null;
  quantity: number | null;
  unit_price: number | null;
  unit_value_with_unit: string | null;
  discount: number | null;
  total: number | null;
  total_with_discount: number | null;
  prazo_entrega_dias: number | null;
  item_status: string | null;
};

export function NomusProposalDetail({
  nomusProposalId,
}: {
  nomusProposalId: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["nomus-proposal-full", nomusProposalId],
    queryFn: async () => {
      const [{ data: prop }, { data: items }] = await Promise.all([
        supabase
          .from("nomus_proposals")
          .select("*")
          .eq("id", nomusProposalId)
          .maybeSingle(),
        supabase
          .from("nomus_proposal_items")
          .select("*")
          .eq("nomus_proposal_id", nomusProposalId)
          .order("position", { ascending: true }),
      ]);
      return { prop: prop as NomusProposalRow | null, items: (items as ItemRow[]) ?? [] };
    },
  });

  const [openItem, setOpenItem] = useState<ItemRow | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  if (!data?.prop) {
    return (
      <div className="rounded-md border bg-secondary/20 p-4 text-sm text-muted-foreground">
        Ainda não há dados detalhados sincronizados do Nomus para esta proposta.
      </div>
    );
  }

  const p = data.prop;
  const items = data.items;

  return (
    <div className="space-y-6">
      {/* ============ Informações gerais Nomus ============ */}
      <Section title="Informações gerais (Nomus)">
        <Grid>
          <Field label="Empresa" value={p.empresa_nome} />
          <Field label="Cliente" value={p.cliente_nome} />
          <Field label="Contato" value={p.contato_nome} />
          <Field label="Vendedor" value={p.vendedor_nome} />
          <Field label="Representante" value={p.representante_nome} />
          <Field label="Tabela de preço" value={p.tabela_preco_nome} />
          <Field label="Condição de pagamento" value={p.condicao_pagamento_nome} />
          <Field label="Tipo de movimentação" value={p.tipo_movimentacao} />
          <Field
            label="Prazo de entrega"
            value={p.prazo_entrega_dias != null ? `${p.prazo_entrega_dias} dias` : null}
          />
          <Field label="Pedido de compra do cliente" value={p.pedido_compra_cliente} />
          <Field label="Data de emissão" value={dateBR(p.data_emissao)} />
          <Field label="Validade" value={dateBR(p.validade)} />
          <Field
            label="Criada em (Nomus)"
            value={p.criada_em_nomus ? dateBR(p.criada_em_nomus) : null}
          />
          <Field label="Criada por" value={p.criada_por_nomus} />
        </Grid>
        {p.observacoes && (
          <div className="mt-3 rounded-md border bg-secondary/30 p-3 text-sm whitespace-pre-wrap">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Observações
            </div>
            {p.observacoes}
          </div>
        )}
      </Section>

      {/* ============ Itens ============ */}
      <Section title={`Itens da proposta (${items.length})`}>
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">Sem itens sincronizados.</div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Código</th>
                  <th className="px-3 py-2 text-left">Descrição</th>
                  <th className="px-3 py-2 text-right">Qtd.</th>
                  <th className="px-3 py-2 text-right">Valor unit.</th>
                  <th className="px-3 py-2 text-right">Desconto</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr
                    key={it.id}
                    className="border-t cursor-pointer hover:bg-secondary/30 transition-colors"
                    onClick={() => setOpenItem(it)}
                    title="Clique para ver detalhes completos do item (tributos, produto, JSON)"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {String((it.position ?? 0) + 1).padStart(2, "0")}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{it.product_code ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="text-primary underline-offset-2 hover:underline">{it.description}</div>
                      {it.additional_info && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground whitespace-pre-wrap">
                          {it.additional_info}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {num(it.quantity, 2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {brl(it.unit_price)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {it.discount ? brl(it.discount) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {brl(it.total_with_discount ?? it.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ============ Análise de lucro ============ */}
      <Section title="Análise de lucro (Nomus)">
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <tbody>
              <Row label="Valor total dos produtos" value={p.valor_produtos} />
              <Row label="(-) Descontos incondicionais" value={negate(p.valor_descontos)} />
              <Row
                label="(=) Valor total com desconto"
                value={p.valor_total_com_desconto ?? p.valor_total}
                emphasis
              />
              <Row label="(-) ICMS a recolher" value={negate(p.icms_recolher)} />
              <Row label="(-) ICMS ST a recolher" value={negate(p.icms_st_recolher)} />
              <Row label="(-) IPI a recolher" value={negate(p.ipi_recolher)} />
              <Row label="(-) PIS a recolher" value={negate(p.pis_recolher)} />
              <Row label="(-) COFINS a recolher" value={negate(p.cofins_recolher)} />
              <Row label="(-) ISSQN a recolher" value={negate(p.issqn_recolher)} />
              <Row
                label="(-) Simples Nacional a recolher"
                value={negate(p.simples_nacional_recolher)}
              />
              <Row label="(-) Comissões de venda" value={negate(p.comissoes_venda)} />
              <Row label="(-) Frete" value={negate(p.frete_valor)} />
              <Row label="(-) Seguros" value={negate(p.seguros_valor)} />
              <Row label="(-) Outras despesas acessórias" value={negate(p.despesas_acessorias)} />
              <Row label="(=) Valor líquido do item" value={p.valor_liquido} emphasis />
              <Row label="(-) Custos de produção" value={negate(p.custos_producao)} />
              <SubRow label=">>> Custos de materiais" value={p.custos_materiais} />
              <SubRow label=">>> Custos de mão de obra direta (MOD)" value={p.custos_mod} />
              <SubRow label=">>> Custos indiretos de fabricação (CIF)" value={p.custos_cif} />
              <Row
                label="(=) Lucro bruto"
                value={p.lucro_bruto}
                pct={p.margem_bruta_pct}
                emphasis
                positive
              />
              <Row label="(-) Custos administrativos" value={negate(p.custos_administrativos)} />
              <Row label="(=) Lucro antes dos impostos" value={p.lucro_antes_impostos} emphasis />
              <Row
                label="(-) Custos incidentes sobre lucro"
                value={negate(p.custos_incidentes_lucro)}
              />
              <Row
                label="(=) Lucro líquido"
                value={p.lucro_liquido}
                pct={p.margem_liquida_pct}
                emphasis
                positive
              />
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

// ===== helpers internos =====
function negate(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  return v === 0 ? 0 : -Math.abs(v);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-sm)]">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-3 text-sm md:grid-cols-3">{children}</dl>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5">{value || "—"}</dd>
    </div>
  );
}

function Row({
  label,
  value,
  emphasis,
  positive,
  pct,
}: {
  label: string;
  value: number | null | undefined;
  emphasis?: boolean;
  positive?: boolean;
  pct?: number | null;
}) {
  const hasValue = value !== null && value !== undefined;
  return (
    <tr className={emphasis ? "border-t bg-secondary/30" : "border-t"}>
      <td
        className={
          "px-3 py-1.5 " +
          (emphasis ? "font-semibold" : "") +
          (positive ? " text-success" : "")
        }
      >
        {label}
      </td>
      <td
        className={
          "px-3 py-1.5 text-right tabular-nums " +
          (emphasis ? "font-semibold" : "") +
          (positive ? " text-success" : "")
        }
      >
        {hasValue ? brl(value) : "—"}
      </td>
      <td className="px-3 py-1.5 text-right text-xs text-muted-foreground tabular-nums w-20">
        {pct != null ? `${num(pct, 2)} %` : ""}
      </td>
    </tr>
  );
}

function SubRow({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <tr className="border-t">
      <td className="px-3 py-1 pl-8 text-xs text-muted-foreground">{label}</td>
      <td className="px-3 py-1 text-right text-xs text-muted-foreground tabular-nums">
        {value !== null && value !== undefined ? brl(value) : "—"}
      </td>
      <td className="px-3 py-1" />
    </tr>
  );
}
