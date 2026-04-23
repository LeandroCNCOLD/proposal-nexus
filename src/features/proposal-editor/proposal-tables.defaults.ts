import type {
  ProposalTableSettings,
  ProposalTableType,
  ProposalTableRow,
} from "./proposal-tables.types";

export function getDefaultTableSettings(
  type: ProposalTableType,
): ProposalTableSettings {
  switch (type) {
    case "equipamentos":
      return {
        show_header: true,
        repeat_header: true,
        currency_columns: ["valor_unitario", "valor_total"],
        sum_columns: ["valor_total"],
        columns: [
          { key: "item", label: "Item", width: 8, type: "number", align: "center" },
          { key: "descricao", label: "Descrição", width: 52, type: "multiline" },
          { key: "quantidade", label: "Qtd.", width: 10, type: "number", align: "center" },
          { key: "unidade", label: "Unidade", width: 10, type: "text", align: "center" },
          { key: "valor_total", label: "Valor Total", width: 20, type: "currency", align: "right" },
        ],
      };
    case "investimento":
      return {
        show_header: true,
        repeat_header: true,
        currency_columns: ["valor_unitario", "valor_total"],
        sum_columns: ["valor_total"],
        show_grand_total: true,
        grand_total_label: "Valor Total Geral do Investimento",
        columns: [
          { key: "item", label: "Item", width: 8, type: "number", align: "center" },
          { key: "descricao", label: "Descrição do Escopo de Fornecimento", width: 52, type: "multiline" },
          { key: "quantidade", label: "Qtd.", width: 10, type: "number", align: "center" },
          { key: "unidade", label: "Unidade", width: 10, type: "text", align: "center" },
          { key: "valor_total", label: "Valor Total", width: 20, type: "currency", align: "right" },
        ],
      };
    case "impostos":
      return {
        show_header: true,
        repeat_header: false,
        columns: [
          { key: "ipi", label: "IPI", width: 25, type: "text", align: "center" },
          { key: "icms", label: "ICMS", width: 25, type: "text", align: "center" },
          { key: "pis", label: "PIS", width: 25, type: "text", align: "center" },
          { key: "cofins", label: "Cofins", width: 25, type: "text", align: "center" },
        ],
      };
    case "pagamento":
      return {
        show_header: true,
        repeat_header: false,
        columns: [
          { key: "forma_pagamento", label: "Forma de Pagamento", width: 50, type: "text" },
          { key: "parcela", label: "Parcela", width: 20, type: "text", align: "center" },
          { key: "porcentagem", label: "Porcentagem", width: 30, type: "text", align: "center" },
        ],
      };
    case "caracteristicas":
      return {
        show_header: false,
        repeat_header: false,
        columns: [
          { key: "label", label: "Campo", width: 45, type: "text" },
          { key: "value", label: "Valor", width: 55, type: "text" },
        ],
      };
    default:
      return {
        show_header: true,
        repeat_header: false,
        columns: [],
      };
  }
}

export function getDefaultTableRows(type: ProposalTableType): ProposalTableRow[] {
  switch (type) {
    case "impostos":
      return [
        {
          ipi: "0% (Isento)",
          icms: "12,00%",
          pis: "1,65%",
          cofins: "7,60%",
        },
      ];
    case "pagamento":
      return [
        { forma_pagamento: "Depósito Bancário", parcela: "1/4", porcentagem: "40%" },
        { forma_pagamento: "Boleto Bancário", parcela: "2/4", porcentagem: "30%" },
        { forma_pagamento: "Boleto Bancário", parcela: "3/4", porcentagem: "15%" },
        { forma_pagamento: "Boleto Bancário", parcela: "4/4", porcentagem: "15%" },
      ];
    default:
      return [];
  }
}
