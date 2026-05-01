/**
 * buildProposalDocumentContext — camada central que consolida todos os dados
 * necessários para preencher uma proposta em uma única estrutura tipada.
 *
 * Esta função roda EXCLUSIVAMENTE no servidor (recebe um cliente Supabase
 * autenticado). Ela é o ponto único a ser substituído quando a integração
 * direta com Nomus passar a entregar dados em tempo real.
 *
 * Prioridade dos dados (definida com o usuário):
 *   1. proposals.* (campos materializados)
 *   2. proposal_tables (snapshot estruturado já editado pelo usuário)
 *   3. nomus_proposals / nomus_proposal_items (snapshot do ERP)
 *   4. defaults
 *
 * Mantém compat com TODA a arquitetura atual:
 *   - não escreve no banco
 *   - não toca em proposal_documents
 *   - é puramente de leitura
 */

import {
  computeProposalTotals,
  type ItemForTotals,
  type ItemCostSnapshot,
  type NomusProposalTotals,
} from "@/features/proposal-totals/compute-proposal-totals";
import {
  normalizeDadosBancarios,
  type ProposalTemplate,
  type TemplateBancario,
} from "@/integrations/proposal-editor/template.types";
import type {
  ProposalContextBancario,
  ProposalContextColdPro,
  ProposalContextColdProEnvironment,
  ProposalContextItem,
  ProposalContextParcela,
  ProposalDocumentContext,
} from "./document-context.types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

const n = (v: unknown): number => Number((v as number | null | undefined) ?? 0);

function fmtPct(recolher: unknown, base: number, fallback: string): string {
  const v = n(recolher);
  if (!base || !v) return fallback;
  return `${((v / base) * 100).toFixed(2).replace(".", ",")}%`;
}

async function loadRevisionContext(
  supabase: SupabaseLike,
  proposalId: string,
  title: string | null,
): Promise<{
  revision: number;
  history: Array<{ numero: string; date: string | null; total_value: number | null; is_current: boolean }>;
}> {
  const m = (title ?? "").match(/(CN\d{3,})/i);
  if (!m) return { revision: 0, history: [] };
  const cn = m[1].toUpperCase();
  const { data: rows } = await supabase
    .from("proposals")
    .select("id, total_value, created_at, nomus_id")
    .ilike("title", `%${cn}%`);
  const list = (rows ?? []) as Array<{
    id: string;
    total_value: number | null;
    created_at: string;
    nomus_id: string | null;
  }>;
  if (list.length <= 1) return { revision: 0, history: [] };
  const nomusIds = list.map((r) => r.nomus_id).filter(Boolean) as string[];
  const numMap = new Map<string, { numero: string | null; criada_em_nomus: string | null; data_emissao: string | null }>();
  if (nomusIds.length > 0) {
    const { data: np } = await supabase
      .from("nomus_proposals")
      .select("nomus_id, numero, criada_em_nomus, data_emissao")
      .in("nomus_id", nomusIds);
    (np ?? []).forEach(
      (x: { nomus_id: string; numero: string | null; criada_em_nomus: string | null; data_emissao: string | null }) =>
        numMap.set(x.nomus_id, x),
    );
  }
  let currentRev = 0;
  const history = list
    .map((r) => {
      const nm = r.nomus_id ? numMap.get(r.nomus_id) ?? null : null;
      const numero = nm?.numero ?? cn;
      const revMatch = numero.match(/Rev\.?\s*(\d+)/i);
      const rev = revMatch ? parseInt(revMatch[1], 10) : 0;
      const isCurrent = r.id === proposalId;
      if (isCurrent) currentRev = rev;
      return {
        numero,
        date: nm?.criada_em_nomus ?? nm?.data_emissao ?? r.created_at,
        total_value: r.total_value,
        is_current: isCurrent,
      };
    })
    .sort((a, b) => {
      const ra = parseInt(a.numero.match(/Rev\.?\s*(\d+)/i)?.[1] ?? "0", 10);
      const rb = parseInt(b.numero.match(/Rev\.?\s*(\d+)/i)?.[1] ?? "0", 10);
      return rb - ra;
    });
  return { revision: currentRev, history };
}

async function loadColdProContext(
  supabase: SupabaseLike,
  proposalId: string,
): Promise<ProposalContextColdPro | null> {
  const { data: project } = await supabase
    .from("coldpro_projects")
    .select("id, name, application_type, status, revision")
    .eq("proposal_id", proposalId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!project) return null;

  const { data: envs } = await supabase
    .from("coldpro_environments")
    .select(
      "id, name, environment_type, volume_m3, internal_temp_c, external_temp_c",
    )
    .eq("coldpro_project_id", project.id);

  const envIds = (envs ?? []).map((e: { id: string }) => e.id);
  const [{ data: results }, { data: selections }] = await Promise.all([
    envIds.length
      ? supabase
          .from("coldpro_results")
          .select(
            "environment_id, total_required_kcal_h, total_required_kw, total_required_tr",
          )
          .in("environment_id", envIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    envIds.length
      ? supabase
          .from("coldpro_equipment_selections")
          .select(
            "environment_id, model, quantity, capacity_total_kcal_h, refrigerant, surplus_percent",
          )
          .in("environment_id", envIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const resultByEnv = new Map<string, Record<string, unknown>>();
  (results ?? []).forEach((r: Record<string, unknown>) => {
    resultByEnv.set(r.environment_id as string, r);
  });
  const selByEnv = new Map<string, Array<Record<string, unknown>>>();
  (selections ?? []).forEach((s: Record<string, unknown>) => {
    const k = s.environment_id as string;
    const arr = selByEnv.get(k) ?? [];
    arr.push(s);
    selByEnv.set(k, arr);
  });

  let totalKcal = 0;
  let totalKw = 0;
  let totalTr = 0;
  const environments: ProposalContextColdProEnvironment[] = (envs ?? []).map(
    (e: Record<string, unknown>) => {
      const id = e.id as string;
      const r = resultByEnv.get(id);
      const kcal = n(r?.total_required_kcal_h);
      const kw = n(r?.total_required_kw);
      const tr = n(r?.total_required_tr);
      totalKcal += kcal;
      totalKw += kw;
      totalTr += tr;
      return {
        id,
        name: (e.name as string) ?? "",
        environment_type: (e.environment_type as string) ?? null,
        volume_m3: (e.volume_m3 as number) ?? null,
        internal_temp_c: (e.internal_temp_c as number) ?? null,
        external_temp_c: (e.external_temp_c as number) ?? null,
        total_required_kcal_h: r ? kcal : null,
        total_required_kw: r ? kw : null,
        total_required_tr: r ? tr : null,
        selected_equipments: (selByEnv.get(id) ?? []).map((s) => ({
          model: (s.model as string) ?? null,
          quantity: (s.quantity as number) ?? null,
          capacity_total_kcal_h: (s.capacity_total_kcal_h as number) ?? null,
          refrigerant: (s.refrigerant as string) ?? null,
          surplus_percent: (s.surplus_percent as number) ?? null,
        })),
      };
    },
  );

  return {
    project_id: project.id,
    project_name: project.name ?? null,
    application_type: project.application_type ?? null,
    status: project.status ?? null,
    revision: project.revision ?? null,
    total_load_kcal_h: totalKcal,
    total_load_kw: totalKw,
    total_load_tr: totalTr,
    environments,
  };
}

export async function buildProposalDocumentContext(
  supabase: SupabaseLike,
  proposalId: string,
): Promise<ProposalDocumentContext> {
  // ─── 1) Proposta + cliente + contato ───────────────────────────────────
  const { data: proposal, error: pErr } = await supabase
    .from("proposals")
    .select(
      [
        "id, number, title, status, valid_until, payment_terms, delivery_term, total_value, created_at",
        "nomus_id, nomus_proposal_id, nomus_seller_name",
        "original_proposal_amount, monthly_financial_rate_pct, financial_rate_type, financial_avg_term_days, financial_factor_pct, financial_additional_cost, final_amount_with_financial_cost, payment_condition_snapshot, financial_preset_id",
        "clients:client_id(id, name, trade_name, document, address, address_number, address_complement, district, city, state, zip_code, email, phone, segment)",
        "client_contacts:contact_id(name, role, email, phone, mobile)",
      ].join(", "),
    )
    .eq("id", proposalId)
    .single();
  if (pErr || !proposal) {
    throw new Error(pErr?.message ?? "Proposta não encontrada.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cli = (proposal as any).clients as Record<string, unknown> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contato = (proposal as any).client_contacts as Record<string, unknown> | null;

  // ─── 2) Snapshot Nomus (proposta + itens) ──────────────────────────────
  let nomusProp: Record<string, unknown> | null = null;
  let nomusItems: Array<Record<string, unknown>> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nomusKey = (proposal as any).nomus_proposal_id ?? (proposal as any).nomus_id;
  if (nomusKey) {
    const { data: np } = await supabase
      .from("nomus_proposals")
      .select("*")
      .eq("nomus_id", nomusKey)
      .maybeSingle();
    if (np) {
      nomusProp = np as Record<string, unknown>;
      const { data: items } = await supabase
        .from("nomus_proposal_items")
        .select("*")
        .eq("nomus_proposal_id", (np as { id: string }).id)
        .order("position", { ascending: true });
      nomusItems = (items ?? []) as Array<Record<string, unknown>>;
    }
  }

  // ─── 3) Itens locais (proposal_items) — fonte primária para preço/snapshot
  const { data: localItemsRaw } = await supabase
    .from("proposal_items")
    .select(
      "id, description, quantity, unit_price, total_price, position, nomus_item_id, price_table_id, price_table_name, price_table_unit_price, price_table_custo_producao_total, price_table_custo_materiais, price_table_custo_mod, price_table_custo_cif, price_table_custos_adm",
    )
    .eq("proposal_id", proposalId)
    .order("position", { ascending: true });
  const localItems = (localItemsRaw ?? []) as Array<Record<string, unknown>>;

  // ─── 4) Tabelas estruturadas (já consolidadas no editor) ───────────────
  const { data: structuredTables } = await supabase
    .from("proposal_tables")
    .select("table_type, rows, settings, title")
    .eq("proposal_id", proposalId);
  const tablesByType = new Map<string, Record<string, unknown>>();
  (structuredTables ?? []).forEach((t: Record<string, unknown>) => {
    tablesByType.set(t.table_type as string, t);
  });

  // ─── 5) Template (cores + bancário + escopo + garantias) ───────────────
  let template: ProposalTemplate | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docTplId = (proposal as any).template_id as string | undefined;
  if (docTplId) {
    const { data: tpl } = await supabase
      .from("proposal_templates")
      .select("*")
      .eq("id", docTplId)
      .maybeSingle();
    template = tpl as ProposalTemplate | null;
  }
  if (!template) {
    const { data: tpl } = await supabase
      .from("proposal_templates")
      .select("*")
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();
    template = tpl as ProposalTemplate | null;
  }

  // ─── 6) Itens consolidados (prioriza local, completa com Nomus) ────────
  const itensSource: Array<Record<string, unknown>> =
    localItems.length > 0 ? localItems : nomusItems;
  const itens: ProposalContextItem[] = itensSource.map((raw, idx) => {
    const isLocal = localItems.length > 0;
    const desc = (raw.description as string) ?? `Item ${idx + 1}`;
    const qty = n(isLocal ? raw.quantity : raw.quantity);
    const unitSold = n(isLocal ? raw.unit_price : raw.unit_price);
    const total = n(isLocal ? raw.total_price : raw.total_with_discount ?? raw.total);
    return {
      position: idx + 1,
      description: desc,
      quantity: qty,
      unidade:
        (raw.unit_value_with_unit as string) ??
        ((raw as { unidade?: string }).unidade as string) ??
        "un",
      unit_price_table: isLocal ? (raw.price_table_unit_price as number) ?? null : null,
      unit_price_sold: unitSold,
      total,
      discount: n((raw as { discount?: number }).discount),
      price_table: isLocal
        ? {
            id: (raw.price_table_id as string) ?? null,
            name: (raw.price_table_name as string) ?? null,
          }
        : null,
      custo_producao_total: isLocal
        ? (raw.price_table_custo_producao_total as number) ?? null
        : null,
    };
  });

  // ─── 7) Totais via computeProposalTotals ───────────────────────────────
  const itemsForTotals: ItemForTotals[] = itensSource.map((raw) => ({
    quantity: Number(raw.quantity ?? 0),
    unit_price: Number(raw.unit_price ?? 0),
    discount: Number((raw as { discount?: number }).discount ?? 0),
    total: Number((raw as { total_price?: number; total?: number }).total_price ?? raw.total ?? 0),
    total_with_discount:
      Number(
        (raw as { total_with_discount?: number; total_price?: number; total?: number })
          .total_with_discount ??
          raw.total_price ??
          raw.total ??
          0,
      ),
    nomus_item_id: (raw.nomus_item_id as string) ?? null,
  }));

  const snapshots = new Map<string, ItemCostSnapshot>();
  for (const li of localItems) {
    const id = (li.nomus_item_id as string) ?? null;
    if (!id) continue;
    snapshots.set(id, {
      price_table_unit_price: (li.price_table_unit_price as number) ?? null,
      price_table_custo_materiais: (li.price_table_custo_materiais as number) ?? null,
      price_table_custo_mod: (li.price_table_custo_mod as number) ?? null,
      price_table_custo_cif: (li.price_table_custo_cif as number) ?? null,
      price_table_custo_producao_total:
        (li.price_table_custo_producao_total as number) ?? null,
      price_table_custos_adm: (li.price_table_custos_adm as number) ?? null,
    });
  }

  const nomusTotals: Partial<NomusProposalTotals> | null = nomusProp
    ? {
        valor_produtos: (nomusProp.valor_produtos as number) ?? null,
        valor_descontos: (nomusProp.valor_descontos as number) ?? null,
        valor_total_com_desconto: (nomusProp.valor_total_com_desconto as number) ?? null,
        valor_total: (nomusProp.valor_total as number) ?? null,
        valor_liquido: (nomusProp.valor_liquido as number) ?? null,
        custos_producao: (nomusProp.custos_producao as number) ?? null,
        custos_materiais: (nomusProp.custos_materiais as number) ?? null,
        custos_mod: (nomusProp.custos_mod as number) ?? null,
        custos_cif: (nomusProp.custos_cif as number) ?? null,
        custos_administrativos: (nomusProp.custos_administrativos as number) ?? null,
        custos_incidentes_lucro: (nomusProp.custos_incidentes_lucro as number) ?? null,
        lucro_bruto: (nomusProp.lucro_bruto as number) ?? null,
        margem_bruta_pct: (nomusProp.margem_bruta_pct as number) ?? null,
        lucro_antes_impostos: (nomusProp.lucro_antes_impostos as number) ?? null,
        lucro_liquido: (nomusProp.lucro_liquido as number) ?? null,
        margem_liquida_pct: (nomusProp.margem_liquida_pct as number) ?? null,
        icms_recolher: (nomusProp.icms_recolher as number) ?? null,
        icms_st_recolher: (nomusProp.icms_st_recolher as number) ?? null,
        ipi_recolher: (nomusProp.ipi_recolher as number) ?? null,
        pis_recolher: (nomusProp.pis_recolher as number) ?? null,
        cofins_recolher: (nomusProp.cofins_recolher as number) ?? null,
        issqn_recolher: (nomusProp.issqn_recolher as number) ?? null,
        simples_nacional_recolher: (nomusProp.simples_nacional_recolher as number) ?? null,
        comissoes_venda: (nomusProp.comissoes_venda as number) ?? null,
        frete_valor: (nomusProp.frete_valor as number) ?? null,
        seguros_valor: (nomusProp.seguros_valor as number) ?? null,
        despesas_acessorias: (nomusProp.despesas_acessorias as number) ?? null,
      }
    : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const additionalCost = Number((proposal as any).financial_additional_cost ?? 0);

  const totals = computeProposalTotals({
    items: itemsForTotals,
    snapshots,
    nomus: nomusTotals,
    financialAdditionalCost: additionalCost,
  });

  // ─── 8) Impostos formatados (preferindo proposal_tables se editado) ────
  const valorBaseImpostos =
    totals.valor_total_com_desconto ??
    totals.valor_produtos ??
    n(nomusProp?.valor_produtos);

  const taxRow = (() => {
    const t = tablesByType.get("impostos");
    const rows = (t?.rows as Array<Record<string, unknown>>) ?? [];
    return rows[0] ?? {};
  })();

  const impostos = {
    ipi:
      (taxRow.ipi as string) ??
      fmtPct(nomusProp?.ipi_recolher, valorBaseImpostos, "0% (Isento)"),
    icms:
      (taxRow.icms as string) ??
      fmtPct(nomusProp?.icms_recolher, valorBaseImpostos, "12,00%"),
    pis:
      (taxRow.pis as string) ??
      fmtPct(nomusProp?.pis_recolher, valorBaseImpostos, "1,65%"),
    cofins:
      (taxRow.cofins as string) ??
      fmtPct(nomusProp?.cofins_recolher, valorBaseImpostos, "7,60%"),
    ipi_valor: nomusProp ? n(nomusProp.ipi_recolher) : null,
    icms_valor: nomusProp ? n(nomusProp.icms_recolher) : null,
    pis_valor: nomusProp ? n(nomusProp.pis_recolher) : null,
    cofins_valor: nomusProp ? n(nomusProp.cofins_recolher) : null,
  };

  // ─── 9) Pagamento (prioriza proposal_tables) ───────────────────────────
  const pagTable = tablesByType.get("pagamento");
  let parcelas: ProposalContextParcela[] = [];
  if (pagTable && Array.isArray(pagTable.rows)) {
    parcelas = (pagTable.rows as Array<Record<string, unknown>>).map((r) => ({
      forma_pagamento: (r.forma_pagamento as string) ?? "",
      parcela: (r.parcela as string) ?? "",
      porcentagem: (r.porcentagem as string) ?? "",
      valor: (r.valor as number) ?? null,
      dias: (r.dias as number) ?? null,
    }));
  } else if (nomusProp?.condicao_pagamento_nome) {
    const condNome = String(nomusProp.condicao_pagamento_nome);
    const matches = condNome.match(/\d+/g);
    if (matches?.length) {
      const total = matches.length;
      const pct = Math.floor(100 / total);
      parcelas = matches.map((dias, i) => ({
        forma_pagamento: i === 0 ? "Depósito Bancário" : "Boleto Bancário",
        parcela: `${i + 1}/${total} (${dias} dias)`,
        porcentagem: i === total - 1 ? `${100 - pct * (total - 1)}%` : `${pct}%`,
        valor: null,
        dias: parseInt(dias, 10),
      }));
    }
  }

  // ─── 10) Taxa financeira ───────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pAny = proposal as any;
  const taxaFinanceira = {
    monthly_rate_pct: (pAny.monthly_financial_rate_pct as number) ?? null,
    rate_type: (pAny.financial_rate_type as string) ?? null,
    avg_term_days: (pAny.financial_avg_term_days as number) ?? null,
    factor_pct: (pAny.financial_factor_pct as number) ?? null,
    additional_cost: additionalCost,
    final_amount: (pAny.final_amount_with_financial_cost as number) ?? null,
    original_amount: (pAny.original_proposal_amount as number) ?? null,
    preset_id: (pAny.financial_preset_id as string) ?? null,
  };

  // ─── 11) Dados bancários (template) ────────────────────────────────────
  const dadosBancarios: ProposalContextBancario[] = normalizeDadosBancarios(
    template?.dados_bancarios as TemplateBancario[] | TemplateBancario | undefined,
  ).map((b) => ({
    banco: b.banco ?? "",
    agencia: b.agencia ?? null,
    conta: b.conta ?? null,
    pix: b.pix ?? null,
    titular: b.titular ?? null,
  }));

  // ─── 12) Escopo (template) ─────────────────────────────────────────────
  const inclusos = (template?.escopo_apresentacao_itens ?? []) as string[];
  const garantias = (template?.garantia_itens ?? []).map((g) => ({
    titulo: g.titulo,
    descricao: g.descricao ?? "",
  }));

  // ─── 13) Histórico de revisões + ColdPro (em paralelo) ─────────────────
  const [revCtx, coldpro] = await Promise.all([
    loadRevisionContext(supabase, proposalId, proposal.title ?? null),
    loadColdProContext(supabase, proposalId),
  ]);

  // ─── 14) Monta o contexto final ────────────────────────────────────────
  const ctx: ProposalDocumentContext = {
    schema_version: 1,
    built_at: new Date().toISOString(),
    empresa: {
      nome: template?.empresa_nome ?? null,
      cidade: template?.empresa_cidade ?? null,
      email: template?.empresa_email ?? null,
      site: template?.empresa_site ?? null,
      telefone: template?.empresa_telefone ?? null,
    },
    proposal: {
      id: proposal.id,
      numero: proposal.number ?? null,
      titulo: proposal.title ?? null,
      status: (proposal.status as string) ?? null,
      validade: (proposal.valid_until as string) ?? null,
      data_emissao:
        ((nomusProp?.data_emissao ?? nomusProp?.criada_em_nomus) as string | undefined) ??
        (proposal.created_at as string) ??
        null,
      prazo_entrega: (proposal.delivery_term as string) ?? null,
      payment_terms: (proposal.payment_terms as string) ?? null,
      total_value: (proposal.total_value as number) ?? null,
      revisao: revCtx.revision,
      historico_revisoes: revCtx.history,
    },
    cliente: {
      id: (cli?.id as string) ?? null,
      nome: (cli?.name as string) ?? null,
      fantasia: (cli?.trade_name as string) ?? null,
      documento: (cli?.document as string) ?? null,
      endereco: [cli?.address, cli?.address_number, cli?.address_complement]
        .filter(Boolean)
        .join(", ") || null,
      bairro: (cli?.district as string) ?? null,
      cidade: (cli?.city as string) ?? null,
      uf: (cli?.state as string) ?? null,
      cep: (cli?.zip_code as string) ?? null,
      email: (cli?.email as string) ?? null,
      telefone: (cli?.phone as string) ?? null,
      segmento: (cli?.segment as string) ?? null,
    },
    contato: contato
      ? {
          nome: (contato.name as string) ?? null,
          cargo: (contato.role as string) ?? null,
          email: (contato.email as string) ?? null,
          telefone: ((contato.phone ?? contato.mobile) as string) ?? null,
        }
      : null,
    vendedor: {
      nome:
        ((proposal as { nomus_seller_name?: string }).nomus_seller_name as string) ??
        ((nomusProp?.vendedor_nome as string) ?? null),
      representante: (nomusProp?.representante_nome as string) ?? null,
    },
    itens,
    totais: {
      valor_produtos: totals.valor_produtos,
      valor_total_vendido: totals.valor_total_com_desconto,
      valor_descontos: totals.valor_descontos,
      desconto_concedido: totals.desconto_concedido,
      agio_sobre_tabela: totals.agio_sobre_tabela,
      valor_liquido: totals.valor_liquido,
      custos_producao: totals.custos_producao,
      custos_administrativos: totals.custos_administrativos,
      lucro_bruto: totals.lucro_bruto,
      lucro_liquido: totals.lucro_liquido,
      margem_bruta_pct: totals.margem_bruta_pct,
      margem_liquida_pct: totals.margem_liquida_pct,
      impostos_total: totals.impostos_total,
      outras_despesas_total: totals.outras_despesas_total,
      custo_taxa_financeira: totals.custo_taxa_financeira,
      source: totals.source,
    },
    impostos,
    pagamento: {
      condicao_nome: (nomusProp?.condicao_pagamento_nome as string) ?? null,
      parcelas,
    },
    taxa_financeira: taxaFinanceira,
    dados_bancarios: dadosBancarios,
    escopo: {
      inclusos,
      nao_inclusos: [],
      garantias,
      garantia_texto: template?.garantia_texto ?? null,
    },
    coldpro,
    template: {
      id: template?.id ?? null,
      name: template?.name ?? null,
      primary_color: template?.primary_color ?? null,
      accent_color: template?.accent_color ?? null,
      accent_color_2: template?.accent_color_2 ?? null,
    },
  };

  return ctx;
}
