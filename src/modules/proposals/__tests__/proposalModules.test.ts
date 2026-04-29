import { strict as assert } from "node:assert";
import { mapNomusItemsToProposalItems, mapNomusProposalToProposal } from "../../nomus/mappers";
import { validateProposal } from "../domain";
import { calculateFinancialSummary, compareItemsTotalWithProposalTotal } from "../financial";
import { checkDiscountApproval, checkMarginApproval, evaluateApprovalWorkflow } from "../approval";
import {
  createTemplatePreviewData,
  extractTemplateVariables,
  fillProposalTemplate,
  validateTemplateVariables,
} from "../templates";
import type { Proposal, TaxSummary } from "../types";

const emptyTaxSummary = (): TaxSummary => ({
  icms: null,
  icmsSt: null,
  ipi: null,
  iss: null,
  pis: null,
  cofins: null,
  simplesNacional: null,
  cbs: null,
  ibs: null,
  ibsEstadual: null,
  total: 0,
});

const baseProposal = (): Proposal => ({
  id: "proposal-1",
  number: "CN001",
  title: "Teste",
  source: "manual",
  status: "rascunho",
  customer: { id: "client-1", name: "Cliente Teste" },
  paymentCondition: { id: "payment-1", name: "30 dias", installments: [] },
  items: [
    {
      id: "item-1",
      description: "Equipamento",
      quantity: 2,
      unitPrice: 100,
      discount: null,
      total: 200,
      totalWithDiscount: 200,
    },
  ],
  taxSummary: emptyTaxSummary(),
  commissionSummary: { baseValue: 200, rate: 5, amount: 10 },
  financialSummary: null,
  total: 200,
  discountTotal: 0,
});

{
  const proposal = mapNomusProposalToProposal({
    id: "123",
    proposta: "CN123",
    cliente: { id: "cli-1", nome: "Frigorifico Sul" },
    condicaoPagamento: { id: "pag-1", descricao: "30/60" },
    valorTotal: "1.000,00",
    valorComissoesVenda: "50,00",
    totalTributacao: [{ valorIcms: "120,00", valorPis: "10,00" }],
    itensProposta: [
      {
        id: "it-1",
        produto: { id: "prod-1", codigo: "EQ-1", descricao: "Tunnel" },
        qtde: "2",
        valorUnitario: "400,00",
        valorTotal: "800,00",
      },
    ],
  });

  assert.equal(proposal.nomusId, "123");
  assert.equal(proposal.number, "CN123");
  assert.equal(proposal.customer?.name, "Frigorifico Sul");
  assert.equal(proposal.items[0]?.description, "Tunnel");
  assert.equal(proposal.taxSummary.total, 130);
  assert.equal(proposal.commissionSummary?.amount, 50);
}

{
  const invalid = baseProposal();
  invalid.customer = null;
  invalid.status = null;
  invalid.items = [
    {
      id: "item-1",
      description: "Sem preco",
      quantity: 1,
      unitPrice: null,
      discount: null,
      total: null,
      totalWithDiscount: null,
    },
  ];
  invalid.total = -1;

  const result = validateProposal(invalid, { minimumGrossMarginPct: 20 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === "missing_customer"));
  assert.ok(result.errors.some((item) => item.code === "missing_item_price"));
  assert.ok(result.errors.some((item) => item.code === "negative_total"));
}

{
  const comparison = compareItemsTotalWithProposalTotal(baseProposal().items, 250);
  assert.equal(comparison.matches, false);
  assert.equal(comparison.itemsTotal, 200);
  assert.equal(comparison.difference, -50);
}

{
  const proposal = baseProposal();
  proposal.taxSummary = { ...emptyTaxSummary(), icms: 20, pis: 5, total: 25 };
  const financial = calculateFinancialSummary({
    ...proposal,
    productionCostTotal: 100,
    administrativeCostTotal: 10,
    incidentCostTotal: 5,
  });
  assert.equal(financial.subtotal, 200);
  assert.equal(financial.taxTotal, 25);
  assert.equal(financial.commissionTotal, 10);
  assert.equal(financial.netProfit, 50);
}

{
  const proposal = baseProposal();
  proposal.financialSummary = { ...calculateFinancialSummary(proposal), netMarginPct: 8 };
  assert.equal(checkMarginApproval(proposal)?.approverProfile, "director");
}

{
  const proposal = baseProposal();
  proposal.discountTotal = 30;
  assert.equal(checkDiscountApproval(proposal)?.approverProfile, "director");
  assert.equal(evaluateApprovalWorkflow({ proposal }).required, true);
}

{
  const content = "Proposta {{ proposal_number }} para {{ customer_name }}";
  const variables = extractTemplateVariables(content);
  assert.deepEqual(variables, ["customer_name", "proposal_number"]);
  assert.equal(
    fillProposalTemplate(content, { proposal_number: "CN001", customer_name: "Cliente Teste" }),
    "Proposta CN001 para Cliente Teste",
  );
  assert.equal(validateTemplateVariables(variables, { proposal_number: "CN001" }).valid, false);
  assert.equal(createTemplatePreviewData(baseProposal()).customer_name, "Cliente Teste");
}

{
  const proposal = mapNomusProposalToProposal({
    id: "null-safe",
    cliente: null,
    condicaoPagamento: null,
    valorTotal: null,
    itensProposta: [
      {
        descricao: "Item parcial",
        qtde: null,
        valorUnitario: null,
      },
    ],
    totalTributacao: [{ valorIcms: null, valorPis: "" }],
  });
  const raw = proposal.raw as { itensProposta?: never[] } | null;
  const items = mapNomusItemsToProposalItems(raw?.itensProposta ?? []);
  assert.equal(proposal.customer?.name, null);
  assert.equal(proposal.total, null);
  assert.equal(proposal.taxSummary.total, 0);
  assert.equal(items[0]?.unitPrice, null);
}
