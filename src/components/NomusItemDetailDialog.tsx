import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { nomusGetItemDetail } from "@/integrations/nomus/server.functions";
import { brl, num } from "@/lib/format";

export type PrefillItem = {
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
  nomus_item_id?: string | null;
  nomus_product_id?: string | null;
};

type Props = {
  itemId: string | null;
  prefillItem?: PrefillItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ItemDetailResult =
  | {
      ok: true;
      item_raw_json: string;
      proposta_raw_json: string;
      proposta_nomus_id: string | null;
      produto_raw_json: string;
      produto_error: string | null;
      equipment_json: string;
      price_table_items_json: string;
    }
  | { ok: false; error: string };

function safeParse(s: string | undefined | null): unknown {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

export function NomusItemDetailDialog({ itemId, prefillItem, open, onOpenChange }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["nomus-item-detail", itemId],
    queryFn: async () => {
      if (!itemId) return null;
      return (await nomusGetItemDetail({ data: { itemId } })) as ItemDetailResult;
    },
    enabled: !!itemId && open,
    staleTime: 60_000,
  });

  const itemRaw = data && data.ok ? safeParse(data.item_raw_json) : null;
  const produtoRaw = data && data.ok ? safeParse(data.produto_raw_json) : null;
  const produtoError = data && data.ok ? data.produto_error : null;
  const equipment = data && data.ok ? safeParse(data.equipment_json) : null;
  const priceTableItems = data && data.ok ? (safeParse(data.price_table_items_json) as unknown[] | null) ?? [] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2 flex-wrap">
            {prefillItem?.product_code ? (
              <span className="font-mono text-xs text-muted-foreground">{prefillItem.product_code}</span>
            ) : null}
            <span>{prefillItem?.description || "Detalhe do item da proposta"}</span>
            {equipment ? (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <CheckCircle2 className="h-3 w-3" /> Mapeado no catálogo
              </Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            Formulário do item — dados sincronizados, complementados pelo cadastro do produto e tabelas de preço do Nomus.
          </DialogDescription>
        </DialogHeader>

        {isLoading && !prefillItem && (
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

        {(prefillItem || (data && data.ok)) && (
          <Tabs defaultValue="geral" className="w-full flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-8 flex-shrink-0">
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="comercial">Comercial</TabsTrigger>
              <TabsTrigger value="precos">Preços</TabsTrigger>
              <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
              <TabsTrigger value="tributos">Tributos</TabsTrigger>
              <TabsTrigger value="lucro">Lucro</TabsTrigger>
              <TabsTrigger value="produto">Produto</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-3 pr-3">
              <TabsContent value="geral" className="mt-0 space-y-4">
                <GeralSection itemRaw={itemRaw} prefill={prefillItem} />
              </TabsContent>
              <TabsContent value="comercial" className="mt-0 space-y-4">
                <ComercialSection itemRaw={itemRaw} prefill={prefillItem} />
              </TabsContent>
              <TabsContent value="precos" className="mt-0 space-y-4">
                <PrecosSection priceTableItems={priceTableItems} prefill={prefillItem} loading={isLoading} />
              </TabsContent>
              <TabsContent value="fiscal" className="mt-0 space-y-4">
                <FiscalSection itemRaw={itemRaw} produtoRaw={produtoRaw} />
              </TabsContent>
              <TabsContent value="tributos" className="mt-0 space-y-4">
                <TributosSection itemRaw={itemRaw} />
              </TabsContent>
              <TabsContent value="lucro" className="mt-0 space-y-4">
                <LucroSection itemRaw={itemRaw} />
              </TabsContent>
              <TabsContent value="produto" className="mt-0 space-y-4">
                <ProdutoSection produtoRaw={produtoRaw} produtoError={produtoError} equipment={equipment} loading={isLoading} />
              </TabsContent>
              <TabsContent value="json" className="mt-0 space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Item (JSON cru)</Label>
                  <JsonView value={itemRaw} />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Produto (JSON cru)</Label>
                  {produtoError ? (
                    <div className="rounded-md border bg-secondary/30 p-3 text-sm text-muted-foreground">{produtoError}</div>
                  ) : (
                    <JsonView value={produtoRaw} />
                  )}
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Equipamento local (JSON)</Label>
                  <JsonView value={equipment} />
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =================== Sections (form-style) ===================

function GeralSection({ itemRaw, prefill }: { itemRaw: unknown; prefill?: PrefillItem | null }) {
  const o = (itemRaw ?? {}) as Record<string, unknown>;
  return (
    <FormCard title="Identificação do item">
      <FormGrid cols={3}>
        <Field label="ID do item (Nomus)" value={pickStr(o, "id", "idItem") ?? prefill?.nomus_item_id} mono />
        <Field label="Posição" value={pickAny(o, "posicao", "ordem", "sequencia") ?? (prefill?.position != null ? prefill.position + 1 : null)} />
        <Field label="Status do item" value={pickStr(o, "status", "situacao") ?? prefill?.item_status} />
        <Field label="Código do produto" value={pickStr(o, "codigoProduto", "codigo") ?? prefill?.product_code} mono />
        <Field label="ID do produto" value={pickStr(o, "idProduto", "produtoId") ?? prefill?.nomus_product_id} mono />
        <Field label="EAN/GTIN" value={pickStr(o, "ean", "gtin", "codigoBarras")} mono />
      </FormGrid>
      <FormGrid cols={1}>
        <Field label="Descrição" value={pickStr(o, "descricaoProduto", "descricao", "nome") ?? prefill?.description} multiline />
        <Field label="Informações adicionais" value={pickStr(o, "informacoesAdicionaisProduto", "informacoesAdicionais", "observacao") ?? prefill?.additional_info} multiline />
      </FormGrid>
    </FormCard>
  );
}

function ComercialSection({ itemRaw, prefill }: { itemRaw: unknown; prefill?: PrefillItem | null }) {
  const o = (itemRaw ?? {}) as Record<string, unknown>;
  return (
    <>
      <FormCard title="Quantidade e preços">
        <FormGrid cols={3}>
          <Field label="Quantidade" value={pickAny(o, "qtde", "quantidade") ?? prefill?.quantity} />
          <Field label="Unidade" value={pickStr(o, "unidade", "unidadeMedida") ?? extractUnit(prefill?.unit_value_with_unit)} />
          <Field label="Valor unitário" value={pickAny(o, "valorUnitario", "preco", "valorVenda") ?? prefill?.unit_price} money />
          <Field label="Desconto (%)" value={pickAny(o, "percentualDesconto", "descontoPercentual")} percent />
          <Field label="Desconto (R$)" value={pickAny(o, "valorDesconto", "desconto") ?? prefill?.discount} money />
          <Field label="Acréscimo" value={pickAny(o, "valorAcrescimo", "acrescimo")} money />
        </FormGrid>
        <FormGrid cols={3}>
          <Field label="Valor total" value={pickAny(o, "valorTotal", "total") ?? prefill?.total} money />
          <Field label="Valor total c/ desconto" value={pickAny(o, "valorTotalComDesconto") ?? prefill?.total_with_discount} money />
          <Field label="Valor líquido" value={pickAny(o, "valorLiquido", "valorLiquidoItem")} money />
        </FormGrid>
      </FormCard>

      <FormCard title="Entrega">
        <FormGrid cols={3}>
          <Field label="Prazo de entrega (dias)" value={pickAny(o, "prazoEntrega", "diasEntrega", "prazoEntregaDias") ?? prefill?.prazo_entrega_dias} />
          <Field label="Data prevista" value={pickStr(o, "dataPrevisaoEntrega", "dataEntrega")} />
          <Field label="Local de entrega" value={pickStr(o, "localEntrega")} />
        </FormGrid>
      </FormCard>
    </>
  );
}

function PrecosSection({
  priceTableItems,
  prefill,
  loading,
}: {
  priceTableItems: unknown[];
  prefill?: PrefillItem | null;
  loading: boolean;
}) {
  if (loading && priceTableItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }

  if (!priceTableItems || priceTableItems.length === 0) {
    return (
      <FormCard title="Tabelas de preço">
        <div className="text-sm text-muted-foreground">
          Nenhum preço cadastrado para este produto nas tabelas sincronizadas.
        </div>
        {prefill?.unit_price != null && (
          <div className="rounded-md border bg-secondary/30 p-3 text-xs">
            <span className="text-muted-foreground">Preço aplicado nesta proposta: </span>
            <span className="font-medium tabular-nums">{brl(prefill.unit_price)}</span>
          </div>
        )}
      </FormCard>
    );
  }

  return (
    <FormCard title={`Tabelas de preço (${priceTableItems.length})`}>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Tabela</th>
              <th className="px-3 py-2 text-left">Código</th>
              <th className="px-3 py-2 text-left">Moeda</th>
              <th className="px-3 py-2 text-right">Preço unitário</th>
              <th className="px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {priceTableItems.map((row, idx) => {
              const r = row as Record<string, unknown>;
              const tbl = (r.nomus_price_tables ?? {}) as Record<string, unknown>;
              const isCurrent = prefill?.unit_price != null && Number(r.unit_price) === Number(prefill.unit_price);
              return (
                <tr key={(r.id as string) ?? idx} className={`border-t ${isCurrent ? "bg-primary/5" : ""}`}>
                  <td className="px-3 py-2">{(tbl.name as string) ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{(tbl.code as string) ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{(r.currency as string) ?? (tbl.currency as string) ?? "BRL"}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {brl(Number(r.unit_price))}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {isCurrent ? (
                      <Badge variant="secondary" className="text-[10px]">aplicada</Badge>
                    ) : (tbl.is_active === false ? (
                      <span className="text-[10px] text-muted-foreground">inativa</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </FormCard>
  );
}

function FiscalSection({ itemRaw, produtoRaw }: { itemRaw: unknown; produtoRaw: unknown }) {
  const o = (itemRaw ?? {}) as Record<string, unknown>;
  const p = (produtoRaw ?? {}) as Record<string, unknown>;
  return (
    <FormCard title="Classificação fiscal">
      <FormGrid cols={3}>
        <Field label="NCM" value={pickStr(o, "ncm", "codigoNcm", "classificacaoFiscal") ?? pickStr(p, "ncm", "classificacaoFiscal")} mono />
        <Field label="CEST" value={pickStr(o, "cest") ?? pickStr(p, "cest")} mono />
        <Field label="CFOP" value={pickStr(o, "cfop", "codigoCfop") ?? pickStr(p, "cfop", "cfopPadrao")} mono />
        <Field label="CST ICMS" value={pickStr(o, "cstIcms", "cst")} mono />
        <Field label="CSOSN" value={pickStr(o, "csosn")} mono />
        <Field label="Origem do produto" value={pickStr(o, "origem", "origemProduto") ?? pickStr(p, "origem")} />
        <Field label="CST IPI" value={pickStr(o, "cstIpi")} mono />
        <Field label="CST PIS" value={pickStr(o, "cstPis")} mono />
        <Field label="CST COFINS" value={pickStr(o, "cstCofins")} mono />
        <Field label="Enquadramento IPI" value={pickStr(o, "enquadramentoIpi", "codigoEnquadramentoIpi")} />
        <Field label="Natureza da operação" value={pickStr(o, "naturezaOperacao")} />
        <Field label="Tipo de tributação" value={pickStr(o, "tipoTributacao", "regimeTributario")} />
      </FormGrid>
    </FormCard>
  );
}

function TributosSection({ itemRaw }: { itemRaw: unknown }) {
  const o = (itemRaw ?? {}) as Record<string, unknown>;
  return (
    <>
      <FormCard title="ICMS">
        <FormGrid cols={3}>
          <Field label="Base de cálculo" value={pickAny(o, "baseCalculoIcms", "valorBaseIcms")} money />
          <Field label="Alíquota (%)" value={pickAny(o, "aliquotaIcms", "percentualIcms")} percent />
          <Field label="Valor ICMS" value={pickAny(o, "valorIcms", "icms")} money />
          <Field label="Redução base (%)" value={pickAny(o, "percentualReducaoIcms")} percent />
          <Field label="Modalidade BC" value={pickStr(o, "modalidadeBaseCalculoIcms")} />
          <Field label="Valor desonerado" value={pickAny(o, "valorIcmsDesonerado")} money />
        </FormGrid>
      </FormCard>

      <FormCard title="ICMS ST">
        <FormGrid cols={3}>
          <Field label="Base ICMS ST" value={pickAny(o, "baseCalculoIcmsSt", "valorBaseIcmsSt")} money />
          <Field label="Alíquota ICMS ST (%)" value={pickAny(o, "aliquotaIcmsSt", "percentualIcmsSt")} percent />
          <Field label="MVA (%)" value={pickAny(o, "percentualMva", "mva")} percent />
          <Field label="Valor ICMS ST" value={pickAny(o, "valorIcmsSt", "icmsSt")} money />
        </FormGrid>
      </FormCard>

      <FormCard title="IPI">
        <FormGrid cols={3}>
          <Field label="Base IPI" value={pickAny(o, "baseCalculoIpi", "valorBaseIpi")} money />
          <Field label="Alíquota (%)" value={pickAny(o, "aliquotaIpi", "percentualIpi")} percent />
          <Field label="Valor IPI" value={pickAny(o, "valorIpi", "ipi")} money />
        </FormGrid>
      </FormCard>

      <FormCard title="PIS / COFINS">
        <FormGrid cols={3}>
          <Field label="Base PIS" value={pickAny(o, "baseCalculoPis", "valorBasePis")} money />
          <Field label="Alíquota PIS (%)" value={pickAny(o, "aliquotaPis", "percentualPis")} percent />
          <Field label="Valor PIS" value={pickAny(o, "valorPis", "pis")} money />
          <Field label="Base COFINS" value={pickAny(o, "baseCalculoCofins", "valorBaseCofins")} money />
          <Field label="Alíquota COFINS (%)" value={pickAny(o, "aliquotaCofins", "percentualCofins")} percent />
          <Field label="Valor COFINS" value={pickAny(o, "valorCofins", "cofins")} money />
        </FormGrid>
      </FormCard>

      <FormCard title="ISSQN / Simples Nacional">
        <FormGrid cols={3}>
          <Field label="Valor ISSQN" value={pickAny(o, "valorIssqn", "issqn")} money />
          <Field label="Alíquota ISSQN (%)" value={pickAny(o, "aliquotaIssqn", "percentualIssqn")} percent />
          <Field label="Simples Nacional" value={pickAny(o, "valorSimplesNacional", "simplesNacional")} money />
        </FormGrid>
      </FormCard>

      <FormCard title="Reforma tributária (IBS / CBS)">
        <FormGrid cols={3}>
          <Field label="Base IBS" value={pickAny(o, "baseCalculoIbs")} money />
          <Field label="Alíquota IBS (%)" value={pickAny(o, "aliquotaIbs")} percent />
          <Field label="Valor IBS" value={pickAny(o, "valorIbs")} money />
          <Field label="Base CBS" value={pickAny(o, "baseCalculoCbs")} money />
          <Field label="Alíquota CBS (%)" value={pickAny(o, "aliquotaCbs")} percent />
          <Field label="Valor CBS" value={pickAny(o, "valorCbs")} money />
        </FormGrid>
      </FormCard>

      <FormCard title="Frete / Seguro / Outras despesas">
        <FormGrid cols={3}>
          <Field label="Frete (item)" value={pickAny(o, "valorFrete", "frete")} money />
          <Field label="Seguro" value={pickAny(o, "valorSeguros", "seguros", "valorSeguro")} money />
          <Field label="Outras despesas" value={pickAny(o, "valorOutrasDespesasAcessorias", "outrasDespesas")} money />
          <Field label="Comissão de venda" value={pickAny(o, "valorComissoesVenda", "comissaoVenda")} money />
        </FormGrid>
      </FormCard>
    </>
  );
}

function LucroSection({ itemRaw }: { itemRaw: unknown }) {
  const o = (itemRaw ?? {}) as Record<string, unknown>;
  return (
    <>
      <FormCard title="Custos">
        <FormGrid cols={3}>
          <Field label="Custo de materiais" value={pickAny(o, "custosMateriais", "valorCustoMateriais")} money />
          <Field label="Custo MOD" value={pickAny(o, "custosMod", "valorCustoMod")} money />
          <Field label="Custo de produção" value={pickAny(o, "custosProducao", "valorCustoProducao")} money />
          <Field label="Custo CIF" value={pickAny(o, "custosCif", "valorCustoCif")} money />
          <Field label="Custos administrativos" value={pickAny(o, "custosAdministrativos")} money />
          <Field label="Custos incidentes lucro" value={pickAny(o, "custosIncidentesLucro")} money />
        </FormGrid>
      </FormCard>

      <FormCard title="Análise de lucro do item">
        <FormGrid cols={3}>
          <Field label="Lucro bruto" value={pickAny(o, "lucroBruto", "valorLucroBruto")} money />
          <Field label="Margem bruta (%)" value={pickAny(o, "margemBrutaPct", "percentualMargemBruta")} percent />
          <Field label="Lucro antes impostos" value={pickAny(o, "lucroAntesImpostos")} money />
          <Field label="Lucro líquido" value={pickAny(o, "lucroLiquido", "valorLucroLiquido")} money />
          <Field label="Margem líquida (%)" value={pickAny(o, "margemLiquidaPct", "percentualMargemLiquida")} percent />
          <Field label="Markup (%)" value={pickAny(o, "markup", "percentualMarkup")} percent />
        </FormGrid>
      </FormCard>
    </>
  );
}

function ProdutoSection({
  produtoRaw,
  produtoError,
  equipment,
  loading,
}: {
  produtoRaw: unknown;
  produtoError: string | null;
  equipment: unknown;
  loading: boolean;
}) {
  const o = (produtoRaw ?? {}) as Record<string, unknown>;
  const eq = (equipment ?? {}) as Record<string, unknown>;
  const eqLine = (eq.equipment_lines ?? {}) as Record<string, unknown>;

  return (
    <>
      {loading && !produtoRaw && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      )}

      {produtoError && (
        <div className="rounded-md border bg-secondary/30 p-3 text-sm text-muted-foreground">{produtoError}</div>
      )}

      {equipment && (
        <FormCard title="Equipamento mapeado no catálogo local">
          <FormGrid cols={3}>
            <Field label="Modelo" value={pickStr(eq, "model")} mono />
            <Field label="Linha" value={pickStr(eqLine, "name", "code")} />
            <Field label="Família" value={pickStr(eqLine, "family")} />
            <Field label="Aplicação" value={pickStr(eq, "application") ?? pickStr(eqLine, "application")} />
            <Field label="Voltagem" value={pickStr(eq, "voltage")} />
            <Field label="Refrigerante" value={pickStr(eq, "refrigerant")} />
            <Field label="Gabinete" value={pickStr(eq, "cabinet", "cabinet_type")} />
            <Field label="Evaporador" value={pickStr(eq, "evaporator_model")} />
            <Field label="Condensador" value={pickStr(eq, "condenser_model")} />
          </FormGrid>
          <FormGrid cols={1}>
            <Field label="Notas técnicas" value={pickStr(eq, "technical_notes")} multiline />
          </FormGrid>
        </FormCard>
      )}

      <FormCard title="Cadastro do produto (Nomus)">
        <FormGrid cols={3}>
          <Field label="ID Nomus" value={pickStr(o, "id", "idProduto")} mono />
          <Field label="Código" value={pickStr(o, "codigo")} mono />
          <Field label="EAN/GTIN" value={pickStr(o, "ean", "gtin", "codigoBarras")} mono />
          <Field label="Tipo" value={pickStr(o, "tipo", "tipoProduto")} />
          <Field label="Unidade" value={pickStr(o, "unidade", "unidadeMedida")} />
          <Field label="Ativo?" value={pickStr(o, "ativo", "situacao", "status")} />
        </FormGrid>
        <FormGrid cols={1}>
          <Field label="Descrição" value={pickStr(o, "descricao", "nome")} multiline />
          <Field label="Descrição complementar" value={pickStr(o, "descricaoComplementar", "informacoesAdicionais")} multiline />
        </FormGrid>
      </FormCard>

      <FormCard title="Classificação">
        <FormGrid cols={3}>
          <Field label="Família / Grupo" value={pickStr(o, "familia", "grupoProduto", "grupo")} />
          <Field label="Subgrupo" value={pickStr(o, "subgrupo")} />
          <Field label="Marca" value={pickStr(o, "marca")} />
          <Field label="Fabricante" value={pickStr(o, "fabricante")} />
          <Field label="NCM" value={pickStr(o, "ncm", "classificacaoFiscal")} mono />
          <Field label="CEST" value={pickStr(o, "cest")} mono />
          <Field label="CFOP padrão" value={pickStr(o, "cfop", "cfopPadrao")} mono />
          <Field label="Origem" value={pickStr(o, "origem")} />
        </FormGrid>
      </FormCard>

      <FormCard title="Dimensões e estoque">
        <FormGrid cols={3}>
          <Field label="Peso bruto" value={pickAny(o, "pesoBruto")} />
          <Field label="Peso líquido" value={pickAny(o, "pesoLiquido")} />
          <Field label="Estoque atual" value={pickAny(o, "estoque", "saldoEstoque")} />
        </FormGrid>
      </FormCard>

      <FormCard title="Preços de referência">
        <FormGrid cols={3}>
          <Field label="Preço de venda" value={pickAny(o, "precoVenda", "valorVenda")} money />
          <Field label="Preço de custo" value={pickAny(o, "precoCusto", "valorCusto")} money />
          <Field label="Margem (%)" value={pickAny(o, "margem", "percentualMargem")} percent />
        </FormGrid>
      </FormCard>
    </>
  );
}

// =================== UI primitives ===================

function FormCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b bg-secondary/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function FormGrid({ cols, children }: { cols: 1 | 2 | 3; children: React.ReactNode }) {
  const cls = cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3";
  return <div className={`grid ${cls} gap-3`}>{children}</div>;
}

function Field({
  label,
  value,
  money = false,
  percent = false,
  mono = false,
  multiline = false,
}: {
  label: string;
  value: unknown;
  money?: boolean;
  percent?: boolean;
  mono?: boolean;
  multiline?: boolean;
}) {
  const display = formatValue(value, { money, percent });
  const isEmpty = display === "—";
  const inputCls = `text-xs ${mono ? "font-mono" : ""} ${isEmpty ? "text-muted-foreground italic" : ""}`;

  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {multiline ? (
        <Textarea value={display} readOnly rows={2} className={inputCls} />
      ) : (
        <Input value={display} readOnly className={inputCls} />
      )}
    </div>
  );
}

function JsonView({ value }: { value: unknown }) {
  return (
    <ScrollArea className="h-[320px] rounded-md border bg-secondary/30 mt-1">
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

function formatValue(value: unknown, opts: { money?: boolean; percent?: boolean }): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (opts.money && Number.isFinite(n)) return brl(n);
  if (opts.percent && Number.isFinite(n)) return `${num(n, 2)} %`;
  return String(value);
}

function extractUnit(s: string | null | undefined): string | null {
  if (!s) return null;
  // Ex.: "R$ 1.234,56 / UN" -> "UN"
  const m = s.match(/\/\s*([A-Za-z]{1,4})\s*$/);
  return m ? m[1] : null;
}
