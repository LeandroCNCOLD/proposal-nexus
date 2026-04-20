import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrencyBRL } from "@/lib/format";

export const Route = createFileRoute("/app/propostas/pedidos-nf")({
  component: PedidosNFPage,
});

function PedidosNFPage() {
  const { data: pedidos = [] } = useQuery({
    queryKey: ["nomus_pedidos"],
    queryFn: async () =>
      (await supabase.from("nomus_pedidos").select("*").order("data_emissao", { ascending: false }).limit(200)).data ?? [],
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["nomus_invoices"],
    queryFn: async () =>
      (await supabase.from("nomus_invoices").select("*").order("data_emissao", { ascending: false }).limit(200)).data ?? [],
  });

  return (
    <>
      <PageHeader title="Pedidos & Notas Fiscais" subtitle="Visão consolidada do que veio do Nomus ERP" />
      <Tabs defaultValue="pedidos">
        <TabsList>
          <TabsTrigger value="pedidos">Pedidos ({pedidos.length})</TabsTrigger>
          <TabsTrigger value="nf">Notas Fiscais ({invoices.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pedidos">
          <div className="rounded-xl border bg-card shadow-[var(--shadow-sm)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Proposta Nomus</TableHead>
                  <TableHead>Cliente Nomus</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Nenhum pedido sincronizado.</TableCell></TableRow>
                ) : pedidos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs font-medium">{p.numero ?? p.nomus_id}</TableCell>
                    <TableCell className="text-xs">{p.proposal_nomus_id ?? "—"}</TableCell>
                    <TableCell className="text-xs">{p.cliente_nomus_id ?? "—"}</TableCell>
                    <TableCell className="text-xs">{p.status_nomus ?? "—"}</TableCell>
                    <TableCell className="text-xs">{p.data_emissao ? new Date(p.data_emissao).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell className="text-xs text-right">{p.valor_total ? formatCurrencyBRL(Number(p.valor_total)) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="nf">
          <div className="rounded-xl border bg-card shadow-[var(--shadow-sm)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número/Série</TableHead>
                  <TableHead>Pedido Nomus</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Nenhuma NF sincronizada.</TableCell></TableRow>
                ) : invoices.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="text-xs font-medium">{n.numero}/{n.serie ?? "—"}</TableCell>
                    <TableCell className="text-xs">{n.pedido_nomus_id ?? "—"}</TableCell>
                    <TableCell className="text-xs">{n.cliente_nomus_id ?? "—"}</TableCell>
                    <TableCell className="text-xs">{n.status_nomus ?? "—"}</TableCell>
                    <TableCell className="text-xs">{n.data_emissao ? new Date(n.data_emissao).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell className="text-xs text-right">{n.valor_total ? formatCurrencyBRL(Number(n.valor_total)) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
