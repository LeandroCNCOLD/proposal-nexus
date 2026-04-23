export type MinimalDocumentPage = {
  id: string;
  type: string;
  title: string;
  order: number;
  visible: boolean;
};

export function getDefaultTechnicalPages(startOrder = 100): MinimalDocumentPage[] {
  return [
    {
      id: "page-caracteristicas",
      type: "caracteristicas",
      title: "Características técnicas",
      order: startOrder,
      visible: true,
    },
    {
      id: "page-investimento",
      type: "investimento",
      title: "Resumo dos itens inclusos no orçamento",
      order: startOrder + 1,
      visible: true,
    },
    {
      id: "page-impostos",
      type: "impostos",
      title: "Base de cálculo dos impostos",
      order: startOrder + 2,
      visible: true,
    },
    {
      id: "page-pagamento",
      type: "pagamento",
      title: "Condições de pagamento",
      order: startOrder + 3,
      visible: true,
    },
  ];
}
