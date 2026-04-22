import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertCircle } from "lucide-react";
import { nomusGetItemDetail } from "@/integrations/nomus/server.functions";
import { brl, num } from "@/lib/format";

type Props = {
  itemId: string | null;
  itemDescription?: string | null;
  productCode?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ItemDetailResult =
  | {
      ok: true;
      item_raw: unknown;
      proposta_raw: unknown;
      proposta_nomus_id: string | null;
      produto_raw: unknown;
      produto_error: string | null;
    }
  | { ok: false; error: string };

export function NomusItemDetailDialog({ itemId, itemDescription, productCode, open, onOpenChange }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["nomus-item-detail", itemId],
    queryFn: async () => {
      if (!itemId) return null;
      return (await nomusGetItemDetail({ data: { itemId } })) as ItemDetailResult;
    },
    enabled: !!itemId && open,
    staleTime: 60_000,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-base">
            {productCode ? <span className="font-mono text-xs text-muted-foreground mr-2">{productCode}</span> : null}
            {itemDescription || "Detalhe do item"}
          </DialogTitle>
          <DialogDescription>
            Dados completos do item da proposta como recebidos do Nomus, incluindo tributos, classificação fiscal e cadastro do produto.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>{(error as Error).message}</div>
          </div>
        )}

        {data && data.ok === false && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>{data.error}</div>
          </div>
        )}

        {data && data.ok && (
          <Tabs defaultValue="resumo" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="tributos">Tributos</TabsTrigger>
              <TabsTrigger value="produto">Produto</TabsTrigger>
              <TabsTrigger value="item-json">Item (JSON)</TabsTrigger>
              <TabsTrigger value="produto-json">Produto (JSON)</TabsTrigger>
            </TabsList>

            <TabsContent value="resumo">
              <ResumoView itemRaw={data.item_raw} />
            </TabsContent>
            <TabsContent value="tributos">
              <TributosView itemRaw={data.item_raw} />
            </TabsContent>
            <TabsContent value="produto">
              <ProdutoView produtoRaw={data.produto_raw} produtoError={data.produto_error} />
            </TabsContent>
            <TabsContent value="item-json">
              <JsonView value={data.item_raw} />
            </TabsContent>
            <TabsContent value="produto-json">
              {data.produto_error ? (
                <div className="rounded-md border bg-secondary/30 p-3 text-sm text-muted-foreground">
                  {data.produto_error}
                </div>
              ) : (
                <JsonView value={data.produto_raw} />
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =================== Sub-views ===================

function ResumoView({ itemRaw }: { itemRaw: unknown }) {
  const o = (itemRaw ?? {}) as Record<string, unknown>;
  const fields = [
    ["Código do produto", pickStr(o, "codigoProduto", "codigo")],
    ["ID do produto (Nomus)", pickStr(o, "idProduto", "produtoId")],
    ["Descrição", pickStr(o, "descricaoProduto", "descricao", "nome")],
    ["Quantidade", pickAny(o, "qtde", "quantidade")],
    ["Unidade", pickStr(o, "unidade", "unidadeMedida")],
    ["Valor unitário", pickAny(o, "valorUnitario", "preco")],
    ["Desconto", pickAny(o, "desconto", "valorDesconto", "percentualDesconto")],
    ["Valor total", pickAny(o, "valorTotal", "total")],
    ["Valor total c/ desconto", pickAny(o, "valorTotalComDesconto")],
    ["Valor líquido", pickAny(o, "valorLiquido", "valorLiquidoItem")],
    ["Prazo de entrega", pickAny(o, "prazoEntrega", "diasEntrega")],
    ["Status do item", pickStr(o, "status", "situacao")],
    ["Informações adicionais", pickStr(o, "informacoesAdicionaisProduto", "informacoesAdicionais")],
    ["CFOP", pickStr(o, "cfop", "codigoCfop")],
    ["NCM", pickStr(o, "ncm", "codigoNcm", "classificacaoFiscal")],
    ["CST/CSOSN", pickStr(o, "cst", "csosn", "cstIcms")],
    ["Origem do produto", pickStr(o, "origem", "origemProduto")],
  ];
  return <FieldsTable rows={fields} />;
}

function TributosView({ itemRaw }: { itemRaw: unknown }) {
  const o = (itemRaw ?? {}) as Record<string, unknown>;
  const sections: Array<[string, Array<[string, unknown]>]> = [
    [
      "ICMS",
      [
        ["Base de cálculo ICMS", pickAny(o, "baseCalculoIcms", "valorBaseIcms")],
        ["Alíquota ICMS (%)", pickAny(o, "aliquotaIcms", "percentualIcms")],
        ["Valor ICMS", pickAny(o, "valorIcms", "icms")],
        ["Base ICMS ST", pickAny(o, "baseCalculoIcmsSt", "valorBaseIcmsSt")],
        ["Alíquota ICMS ST (%)", pickAny(o, "aliquotaIcmsSt", "percentualIcmsSt")],
        ["Valor ICMS ST", pickAny(o, "valorIcmsSt", "icmsSt")],
      ],
    ],
    [
      "IPI",
      [
        ["Base IPI", pickAny(o, "baseCalculoIpi", "valorBaseIpi")],
        ["Alíquota IPI (%)", pickAny(o, "aliquotaIpi", "percentualIpi")],
        ["Valor IPI", pickAny(o, "valorIpi", "ipi")],
        ["CST IPI", pickStr(o, "cstIpi")],
      ],
    ],
    [
      "PIS / COFINS",
      [
        ["Base PIS", pickAny(o, "baseCalculoPis", "valorBasePis")],
        ["Alíquota PIS (%)", pickAny(o, "aliquotaPis", "percentualPis")],
        ["Valor PIS", pickAny(o, "valorPis", "pis")],
        ["Base COFINS", pickAny(o, "baseCalculoCofins", "valorBaseCofins")],
        ["Alíquota COFINS (%)", pickAny(o, "aliquotaCofins", "percentualCofins")],
        ["Valor COFINS", pickAny(o, "valorCofins", "cofins")],
      ],
    ],
    [
      "ISSQN / Simples Nacional",
      [
        ["Valor ISSQN", pickAny(o, "valorIssqn", "issqn")],
        ["Alíquota ISSQN (%)", pickAny(o, "aliquotaIssqn", "percentualIssqn")],
        ["Simples Nacional a recolher", pickAny(o, "valorSimplesNacional", "simplesNacional")],
      ],
    ],
    [
      "Frete / Seguro / Outras despesas",
      [
        ["Frete (item)", pickAny(o, "valorFrete", "frete")],
        ["Seguro", pickAny(o, "valorSeguros", "seguros", "valorSeguro")],
        ["Outras despesas acessórias", pickAny(o, "valorOutrasDespesasAcessorias", "outrasDespesas")],
        ["Comissão de venda", pickAny(o, "valorComissoesVenda", "comissaoVenda")],
      ],
    ],
  ];

  return (
    <div className="space-y-4">
      {sections.map(([title, rows]) => {
        const hasAny = rows.some(([, v]) => v !== null && v !== undefined && v !== "");
        if (!hasAny) {
          return (
            <div key={title} className="rounded-md border bg-secondary/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{title}</div>
              <div className="text-xs text-muted-foreground italic">Sem dados nesta seção no payload do Nomus.</div>
            </div>
          );
        }
        return (
          <div key={title} className="rounded-md border">
            <div className="border-b bg-secondary/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {title}
            </div>
            <FieldsTable rows={rows} dense />
          </div>
        );
      })}
    </div>
  );
}

function ProdutoView({ produtoRaw, produtoError }: { produtoRaw: unknown; produtoError: string | null }) {
  if (produtoError) {
    return (
      <div className="rounded-md border bg-secondary/30 p-3 text-sm text-muted-foreground">{produtoError}</div>
    );
  }
  if (!produtoRaw) {
    return (
      <div className="rounded-md border bg-secondary/30 p-3 text-sm text-muted-foreground">
        Item sem ID de produto vinculado no Nomus.
      </div>
    );
  }
  const o = produtoRaw as Record<string, unknown>;
  const rows: Array<[string, unknown]> = [
    ["ID Nomus", pickStr(o, "id", "idProduto")],
    ["Código", pickStr(o, "codigo")],
    ["Descrição", pickStr(o, "descricao", "nome")],
    ["Descrição complementar", pickStr(o, "descricaoComplementar", "informacoesAdicionais")],
    ["Família / Grupo", pickStr(o, "familia", "grupoProduto", "grupo")],
    ["Subgrupo", pickStr(o, "subgrupo")],
    ["Tipo", pickStr(o, "tipo", "tipoProduto")],
    ["Unidade de medida", pickStr(o, "unidade", "unidadeMedida")],
    ["NCM", pickStr(o, "ncm", "classificacaoFiscal")],
    ["CEST", pickStr(o, "cest")],
    ["CFOP padrão", pickStr(o, "cfop", "cfopPadrao")],
    ["Origem", pickStr(o, "origem")],
    ["EAN/GTIN", pickStr(o, "ean", "gtin", "codigoBarras")],
    ["Marca", pickStr(o, "marca")],
    ["Fabricante", pickStr(o, "fabricante")],
    ["Peso bruto", pickAny(o, "pesoBruto")],
    ["Peso líquido", pickAny(o, "pesoLiquido")],
    ["Preço de venda", pickAny(o, "precoVenda", "valorVenda")],
    ["Preço de custo", pickAny(o, "precoCusto", "valorCusto")],
    ["Margem (%)", pickAny(o, "margem", "percentualMargem")],
    ["Estoque atual", pickAny(o, "estoque", "saldoEstoque")],
    ["Ativo?", pickStr(o, "ativo", "situacao", "status")],
  ];
  return <FieldsTable rows={rows} />;
}

function JsonView({ value }: { value: unknown }) {
  return (
    <ScrollArea className="h-[480px] rounded-md border bg-secondary/30">
      <pre className="p-3 text-xs leading-relaxed font-mono whitespace-pre-wrap break-words">
        {JSON.stringify(value ?? null, null, 2)}
      </pre>
    </ScrollArea>
  );
}

// =================== Helpers ===================

function pickStr(o: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return null;
}

function pickAny(o: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

function FieldsTable({ rows, dense = false }: { rows: Array<[string, unknown]>; dense?: boolean }) {
  const visible = rows.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (visible.length === 0) {
    return (
      <div className="text-xs italic text-muted-foreground p-3">
        Nenhum campo presente no payload.
      </div>
    );
  }
  return (
    <dl className={`grid gap-2 ${dense ? "p-3 md:grid-cols-2" : "md:grid-cols-2"}`}>
      {visible.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3 border-b py-1.5 last:border-b-0 md:border-b-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-xs font-medium tabular-nums text-right break-all">{renderValue(label, value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function renderValue(label: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  // Heurística: campos chamados "Valor X" ou "Base X" formatamos em BRL
  const isMoney = /^(Valor|Base|Frete|Seguro|Comiss|Preço|Outras despesas|Simples)/i.test(label)
    && !/(%|Alíquota)/i.test(label);
  const num0 = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (isMoney && Number.isFinite(num0)) return brl(num0);
  if (/\(%\)|Alíquota|Margem/i.test(label) && Number.isFinite(num0)) return `${num(num0, 2)} %`;
  return String(value);
}
