import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, num, dateBR } from "@/lib/format";
import { NomusItemDetailDialog } from "@/components/NomusItemDetailDialog";
import { ProposalTaxSummary } from "@/components/ProposalTaxSummary";
import { EmptyState, FinancialSummaryCard, LoadingState, ProposalItemsTable } from "@/modules/proposals/components";
import { PriceTablePicker } from "@/features/price-table-picker/PriceTablePicker";
import { useItemPriceTables } from "@/features/price-table-picker/use-item-price-tables";
import { computeProposalTotals } from "@/features/proposal-totals/compute-proposal-totals";

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
  cbs_recolher: number | null;
  ibs_recolher: number | null;
  ibs_estadual_recolher: number | null;
  total_tributacao: Record<string, string | number> | null;
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

  raw: Record<string, unknown> | null;
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
  price_table_name: string | null;
  price_table_nomus_id: string | null;
  price_table_match_method: string | null;
  discount: number | null;
  total: number | null;
  total_with_discount: number | null;
  prazo_entrega_dias: number | null;
  item_status: string | null;
  nomus_item_id: string | null;
  nomus_product_id: string | null;
};

export function NomusProposalDetail({
  nomusProposalId,
  localContact,
  localClient,
  localProposalId,
  selectedPriceTableId,
}: {
  nomusProposalId: string;
  localContact?: { name?: string; email?: string; phone?: string; role?: string } | null;
  localClient?: { name?: string; document?: string; city?: string; state?: string } | null;
  /** ID da proposta local (public.proposals.id) — necessário para salvar a tabela escolhida. */
  localProposalId?: string;
  /** Tabela de preço já escolhida (proposals.price_table_id). */
  selectedPriceTableId?: string | null;
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
    return <LoadingState label="Carregando dados do Nomus…" />;
  }
  if (!data?.prop) {
    return <EmptyState title="Dados do Nomus ainda não sincronizados" description="As informações detalhadas aparecerão aqui quando a proposta estiver sincronizada." />;
  }

  const p = data.prop;
  const items = data.items;

  // ─── Per-item price tables ─────────────────────────────────────────────────
  // Carrega os proposal_items locais para mapear nomus_item_id → id local +
  // estado atual da tabela escolhida (price_table_id, match_method, snapshot).
  type LocalItemSnapshot = {
    id: string;
    price_table_id: string | null;
    price_table_name: string | null;
    price_table_match_method: string | null;
    price_table_unit_price: number | null;
    price_table_selected_at: string | null;
    price_table_custo_materiais: number | null;
    price_table_custo_mod: number | null;
    price_table_custo_cif: number | null;
    price_table_custo_producao_total: number | null;
    price_table_custos_adm: number | null;
    price_table_preco_calculado: number | null;
  };
  const { data: localItemsByNomusId = new Map<string, LocalItemSnapshot>() } = useQuery({
    queryKey: ["proposal-items-local", localProposalId],
    enabled: !!localProposalId,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("proposal_items")
        .select(
          "id, nomus_item_id, price_table_id, price_table_name, price_table_match_method, price_table_unit_price, price_table_selected_at, price_table_custo_materiais, price_table_custo_mod, price_table_custo_cif, price_table_custo_producao_total, price_table_custos_adm, price_table_preco_calculado",
        )
        .eq("proposal_id", localProposalId!);
      if (error) throw error;
      const m = new Map<string, LocalItemSnapshot>();
      for (const r of (rows ?? []) as Array<LocalItemSnapshot & { nomus_item_id: string | null }>) {
        if (r.nomus_item_id) m.set(r.nomus_item_id, r);
      }
      return m;
    },
  });

  // Custo adicional vindo da simulação da taxa financeira salva na proposta.
  const { data: localProposalFinancial } = useQuery({
    queryKey: ["proposal-financial-additional-cost", localProposalId],
    enabled: !!localProposalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("financial_additional_cost")
        .eq("id", localProposalId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const financialAdditionalCost = Number(
    localProposalFinancial?.financial_additional_cost ?? 0,
  );

  // Itens enriquecidos com o id local + estado da tabela
  const itemsForHook = useMemo(
    () =>
      items.map((it) => {
        const local = it.nomus_item_id ? localItemsByNomusId.get(it.nomus_item_id) : null;
        // Em nomus_price_table_items.nomus_product_id está armazenado o
        // CÓDIGO do produto (ex.: CN-030-LT-EV-6-22T-NA), não o id interno.
        // Por isso priorizamos product_code como chave de matching.
        return {
          id: local?.id ?? it.id,
          nomusItemId: it.nomus_item_id,
          nomusProductId: it.product_code ?? it.nomus_product_id,
          description: it.description ?? "",
          quantity: Number(it.quantity ?? 1),
          unitPrice: Number(it.unit_price ?? 0),
          position: it.position,
          priceTableId: local?.price_table_id ?? null,
          priceTableSelectedAt: local?.price_table_selected_at ?? null,
          priceTableMatchMethod: local?.price_table_match_method ?? null,
          hasCostSnapshot:
            local?.price_table_custo_producao_total != null ||
            local?.price_table_custo_materiais != null,
        };
      }),
    [items, localItemsByNomusId],
  );

  const { tablesByProduct, applyAuto, applyManual } = useItemPriceTables({
    proposalId: localProposalId ?? "",
    clientUf: localClient?.state ?? null,
    items: itemsForHook,
  });

  // ─── Agregação dos totais a partir dos snapshots de custos por item ────
  // Quando os itens já têm tabela aplicada com snapshot de custos, calculamos
  // os totais agregados aqui (custo total, lucro bruto, lucro líquido etc.)
  // sobrescrevendo os valores vindos do Nomus, que podem estar zerados.
  const agg = useMemo(
    () =>
      computeProposalTotals({
        items: items.map((it) => ({
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount: it.discount,
          total: it.total,
          total_with_discount: it.total_with_discount,
          nomus_item_id: it.nomus_item_id,
        })),
        snapshots: localItemsByNomusId as unknown as Map<
          string,
          import("@/features/proposal-totals/compute-proposal-totals").ItemCostSnapshot
        >,
        nomus: p,
        // Quando a integração futura trouxer os totais oficiais Nomus,
        // popular aqui (ex.: p.nomus_totais_oficiais ?? null) e a UI passa
        // a refletir esses números automaticamente.
        nomusOfficial: null,
      }),
    [items, localItemsByNomusId, p],
  );

  // Auto-aplicar sugestão para itens sem escolha (ou auto antiga sem snapshot).
  // Não toca itens manuais. Roda uma vez por carregamento das tabelas.
  const autoAppliedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!localProposalId) return;
    if (tablesByProduct.size === 0) return;
    for (const it of itemsForHook) {
      if (!it.nomusProductId) continue;
      if (autoAppliedRef.current.has(it.id)) continue;
      const isManual = it.priceTableMatchMethod === "manual";
      const hasChoice = !!it.priceTableId;
      const shouldRefreshAuto =
        it.priceTableMatchMethod === "auto_uf_max_icms" ||
        it.priceTableMatchMethod === "auto_max_icms" ||
        it.priceTableMatchMethod === "auto_uf_min_icms" ||
        it.priceTableMatchMethod === "auto_min_icms" ||
        it.priceTableMatchMethod === "auto_latest";
      // Aplica auto se: (a) nunca foi escolhida, (b) auto antiga, ou (c) tem
      // tabela mas ainda não populamos os custos (snapshot faltando).
      if (isManual) {
        if (!it.hasCostSnapshot && it.priceTableId && it.nomusProductId) {
          // Re-grava a mesma tabela manual para preencher os custos.
          const tables = tablesByProduct.get(it.nomusProductId) ?? [];
          const current = tables.find((t) => t.id === it.priceTableId);
          if (current) applyManual(it.id, current);
        }
        autoAppliedRef.current.add(it.id);
        continue;
      }
      if (!hasChoice || shouldRefreshAuto || !it.hasCostSnapshot) {
        applyAuto(it.id, it.nomusProductId);
        autoAppliedRef.current.add(it.id);
      } else {
        autoAppliedRef.current.add(it.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablesByProduct, itemsForHook, localProposalId]);


  return (
    <div className="space-y-6">
      {/* ============ Informações gerais Nomus ============ */}
      <Section title="Informações gerais (Nomus)">
        <Grid>
          <Field label="Empresa" value={p.empresa_nome} />
          <Field
            label="Cliente"
            value={
              <div>
                <div>{p.cliente_nome ?? localClient?.name ?? "—"}</div>
                {(localClient?.document || localClient?.city) && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {localClient?.document}
                    {localClient?.document && localClient?.city ? " · " : ""}
                    {localClient?.city}
                    {localClient?.city && localClient?.state ? `/${localClient.state}` : ""}
                  </div>
                )}
              </div>
            }
          />
          <Field
            label="Contato"
            value={<ContactCell nomusName={p.contato_nome} local={localContact ?? null} />}
          />
          <Field label="Vendedor" value={p.vendedor_nome} />
          <Field label="Representante" value={p.representante_nome} />
          <Field
            label="Tabela de preço"
            value={
              localProposalId ? (
                <PriceTablePicker
                  key={`${localProposalId}-${localClient?.state ?? "no-uf"}`}
                  proposalId={localProposalId}
                  clientUf={localClient?.state ?? null}
                  selectedPriceTableId={selectedPriceTableId ?? null}
                />
              ) : (
                p.tabela_preco_nome
              )
            }
          />
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
        <ProposalItemsTable
          showPriceTableComparison={!!localProposalId}
          tablesByProduct={localProposalId ? tablesByProduct : undefined}
          clientUf={localClient?.state ?? null}
          onChangeItemTable={
            localProposalId
              ? (proposalItemId, table) => applyManual(proposalItemId, table)
              : undefined
          }
          onResetItemTable={
            localProposalId
              ? (proposalItemId, productId) => applyAuto(proposalItemId, productId)
              : undefined
          }
          items={items.map((it) => {
            const local = it.nomus_item_id
              ? localItemsByNomusId.get(it.nomus_item_id)
              : null;
            return {
              id: local?.id ?? it.id,
              position: it.position,
              productCode: it.product_code,
              nomusProductId: it.product_code ?? it.nomus_product_id,
              priceTableId: local?.price_table_id ?? null,
              priceTableName: local?.price_table_name ?? it.price_table_name,
              priceTableMatchMethod: local?.price_table_match_method ?? null,
              priceTableUnitPrice: local?.price_table_unit_price ?? null,
              priceTableCustoMateriais: local?.price_table_custo_materiais ?? null,
              priceTableCustoMod: local?.price_table_custo_mod ?? null,
              priceTableCustoCif: local?.price_table_custo_cif ?? null,
              priceTableCustoProducaoTotal: local?.price_table_custo_producao_total ?? null,
              description: it.description,
              additionalInfo: it.additional_info,
              quantity: it.quantity,
              unitPrice: it.unit_price,
              discount: it.discount,
              total: it.total_with_discount ?? it.total,
              status: it.item_status,
            };
          })}
          onOpenItem={(it) => setOpenItem(items.find((source) => source.nomus_item_id && localItemsByNomusId.get(source.nomus_item_id)?.id === it.id) ?? items.find((source) => source.id === it.id) ?? null)}
        />
      </Section>

      {/* ============ Modal de detalhes do item ============ */}
      {(() => {
        const openLocal = openItem?.nomus_item_id
          ? localItemsByNomusId.get(openItem.nomus_item_id) ?? null
          : null;
        const hasSnapshot = !!openLocal && (
          openLocal.price_table_custo_materiais != null ||
          openLocal.price_table_custo_mod != null ||
          openLocal.price_table_custo_cif != null ||
          openLocal.price_table_custo_producao_total != null
        );
        return (
          <NomusItemDetailDialog
            itemId={openItem?.id ?? null}
            prefillItem={openItem ? {
              ...openItem,
              price_table_id: openLocal?.price_table_id ?? null,
            } : null}
            open={openItem !== null}
            onOpenChange={(o) => { if (!o) setOpenItem(null); }}
            proposalTaxes={
              p.total_tributacao ??
              (Array.isArray((p.raw as { totalTributacao?: unknown[] } | null)?.totalTributacao)
                ? ((p.raw as { totalTributacao: Record<string, string | number>[] }).totalTributacao[0] ?? null)
                : null)
            }
            proposalProductsTotal={
              items.reduce((s, it) => s + Number(it.total_with_discount ?? it.total ?? 0), 0)
            }
            itemCostSnapshot={hasSnapshot && openItem ? {
              quantity: Number(openItem.quantity ?? 1),
              unitPrice: openItem.unit_price != null ? Number(openItem.unit_price) : null,
              discount: openItem.discount != null ? Number(openItem.discount) : 0,
              totalWithDiscount: openItem.total_with_discount != null
                ? Number(openItem.total_with_discount)
                : (openItem.total != null ? Number(openItem.total) : null),
              custoMateriaisUnit: openLocal?.price_table_custo_materiais ?? null,
              custoModUnit: openLocal?.price_table_custo_mod ?? null,
              custoCifUnit: openLocal?.price_table_custo_cif ?? null,
              custoProducaoTotalUnit: openLocal?.price_table_custo_producao_total ?? null,
              custosAdmUnit: openLocal?.price_table_custos_adm ?? null,
            } : null}
            proposalAnaliseLucro={{
              valor_produtos: p.valor_produtos,
              valor_descontos: p.valor_descontos,
              valor_total_com_desconto: p.valor_total_com_desconto ?? p.valor_total,
              icms_recolher: p.icms_recolher,
              icms_st_recolher: p.icms_st_recolher,
              ipi_recolher: p.ipi_recolher,
              pis_recolher: p.pis_recolher,
              cofins_recolher: p.cofins_recolher,
              issqn_recolher: p.issqn_recolher,
              simples_nacional_recolher: p.simples_nacional_recolher,
              comissoes_venda: p.comissoes_venda,
              frete_valor: p.frete_valor,
              seguros_valor: p.seguros_valor,
              despesas_acessorias: p.despesas_acessorias,
              valor_liquido: p.valor_liquido,
              custos_producao: p.custos_producao,
              custos_materiais: p.custos_materiais,
              custos_mod: p.custos_mod,
              custos_cif: p.custos_cif,
              custos_administrativos: p.custos_administrativos,
              custos_incidentes_lucro: p.custos_incidentes_lucro,
              lucro_bruto: p.lucro_bruto,
              margem_bruta_pct: p.margem_bruta_pct,
              lucro_antes_impostos: p.lucro_antes_impostos,
              lucro_liquido: p.lucro_liquido,
              margem_liquida_pct: p.margem_liquida_pct,
            }}
          />
        );
      })()}

      {/* ============ Resumo de impostos ============ */}
      <Section title="Resumo de impostos">
        <ProposalTaxSummary
          totalTributacao={
            p.total_tributacao ??
            (Array.isArray((p.raw as { totalTributacao?: unknown[] } | null)?.totalTributacao)
              ? ((p.raw as { totalTributacao: Record<string, string | number>[] }).totalTributacao[0] ?? null)
              : null)
          }
          fallback={{
            icms: p.icms_recolher,
            icms_st: p.icms_st_recolher,
            ipi: p.ipi_recolher,
            iss: p.issqn_recolher,
            pis: p.pis_recolher,
            cofins: p.cofins_recolher,
            cbs: p.cbs_recolher,
            ibs: p.ibs_recolher,
            ibs_estadual: p.ibs_estadual_recolher,
          }}
        />
      </Section>

      {/* ============ Análise de lucro ============ */}
      <Section title="Análise de lucro (Nomus)">
        {agg.hasSnapshots && (
          <div className="mb-3 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-xs text-muted-foreground">
            Totais calculados a partir das tabelas de preço aplicadas a cada item.
          </div>
        )}
        <div className="mb-4">
          <FinancialSummaryCard
            title="Leitura rápida"
            metrics={[
              { label: "Custo total", value: brl(agg.custos_producao), tone: "neutral" },
              { label: "Preço de venda", value: brl(agg.valor_total_com_desconto), tone: "info" },
              { label: "Impostos", value: brl(agg.impostos_total), tone: "warning" },
              { label: "Comissão", value: brl(p.comissoes_venda), tone: "neutral" },
              { label: "Margem", value: agg.margem_liquida_pct != null ? `${num(agg.margem_liquida_pct, 2)}%` : "—", tone: "success" },
              { label: "Resultado final", value: brl(agg.lucro_liquido), tone: "success" },
            ]}
          />
        </div>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <tbody>
              <Row label="Valor total dos produtos" value={agg.valor_produtos} />
              <Row label="(-) Descontos incondicionais" value={negate(agg.valor_descontos)} />
              {agg.hasSnapshots && (agg.desconto_concedido > 0 || agg.agio_sobre_tabela > 0) && (
                <>
                  <SubRow label=">>> Desconto concedido" value={agg.desconto_concedido} />
                  {agg.agio_sobre_tabela > 0 && (
                    <SubRow label=">>> Ágio sobre tabela" value={agg.agio_sobre_tabela} />
                  )}
                </>
              )}
              <Row
                label="(=) Valor total com desconto"
                value={agg.valor_total_com_desconto}
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
              <Row label="(=) Valor líquido do item" value={agg.valor_liquido} emphasis />
              <Row label="(-) Custos de produção" value={negate(agg.custos_producao)} />
              <SubRow label=">>> Custos de materiais" value={agg.custos_materiais} />
              <SubRow label=">>> Custos de mão de obra direta (MOD)" value={agg.custos_mod} />
              <SubRow label=">>> Custos indiretos de fabricação (CIF)" value={agg.custos_cif} />
              <Row
                label="(=) Lucro bruto"
                value={agg.lucro_bruto}
                pct={agg.margem_bruta_pct}
                emphasis
                positive
              />
              <Row label="(-) Custos administrativos" value={negate(agg.custos_administrativos)} />
              <Row label="(=) Lucro antes dos impostos" value={agg.lucro_antes_impostos} emphasis />
              <Row
                label="(-) Custos incidentes sobre lucro"
                value={negate(p.custos_incidentes_lucro)}
              />
              <Row
                label="(=) Lucro líquido"
                value={agg.lucro_liquido}
                pct={agg.margem_liquida_pct}
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

function ContactCell({
  nomusName,
  local,
}: {
  nomusName: string | null;
  local: { name?: string; email?: string; phone?: string; role?: string } | null;
}) {
  const name = local?.name || nomusName || "—";
  const phoneDigits = (local?.phone ?? "").replace(/\D/g, "");
  const waLink = phoneDigits
    ? `https://wa.me/${phoneDigits.length <= 11 ? "55" + phoneDigits : phoneDigits}`
    : null;
  return (
    <div>
      <div>{name}</div>
      {local?.role && (
        <div className="text-[11px] text-muted-foreground mt-0.5">{local.role}</div>
      )}
      {(local?.email || local?.phone) && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
          {local?.email && (
            <a
              href={`mailto:${local.email}`}
              className="text-primary hover:underline"
              title="Enviar e-mail"
            >
              {local.email}
            </a>
          )}
          {local?.phone && (
            <span className="text-muted-foreground">{local.phone}</span>
          )}
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-success hover:underline"
              title="Abrir no WhatsApp"
            >
              WhatsApp
            </a>
          )}
        </div>
      )}
      {!local?.email && !local?.phone && nomusName && (
        <div className="mt-0.5 text-[11px] text-muted-foreground italic">
          Telefone/e-mail não sincronizados
        </div>
      )}
    </div>
  );
}
