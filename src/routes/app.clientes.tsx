import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { nomusSyncClients } from "@/integrations/nomus/server.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export const Route = createFileRoute("/app/clientes")({ component: ClientsPage });

function ClientsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const syncClients = useServerFn(nomusSyncClients);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({ name: "", segment: "", region: "", city: "", state: "" });

  const { data = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*").order("name")).data ?? [],
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.from("clients").insert({ ...form, created_by: user?.id });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cliente criado");
    setOpen(false); setForm({ name: "", segment: "", region: "", city: "", state: "" });
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  const handleSyncNomus = async () => {
    setSyncing(true);
    try {
      const res = await syncClients({});
      if (!res.ok) {
        toast.error(`Nomus: ${res.error ?? "Falha na sincronização"}`);
        return;
      }
      const extras: string[] = [];
      if (res.skipped > 0) extras.push(`${res.skipped} ignorado(s)`);
      if (res.unmatched > 0) extras.push(`${res.unmatched} sem vínculo local`);
      toast.success(
        res.done
          ? `Clientes sincronizados: ${res.count}${extras.length ? ` (${extras.join(", ")})` : ""}`
          : `Lote sincronizado: ${res.count} clientes. Clique novamente para continuar.`,
      );
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["nomus_sync_state"] });
      qc.invalidateQueries({ queryKey: ["nomus_sync_log"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado ao sincronizar clientes");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <PageHeader title="Clientes" subtitle={`${data.length} cadastrados`} actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleSyncNomus} disabled={syncing}>
            {syncing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
            Sincronizar Nomus
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-[image:var(--gradient-primary)]"><Plus className="mr-1.5 h-4 w-4" /> Novo cliente</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5"><Label>Nome *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Segmento</Label><Input value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Região</Label><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Cidade</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>UF</Label><Input maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} /></div>
                </div>
                <DialogFooter><Button type="submit" disabled={loading} className="bg-[image:var(--gradient-primary)]">{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      } />

      <div className="overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-sm)]">
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Segmento</TableHead><TableHead>Região</TableHead><TableHead>Vendedor</TableHead><TableHead>Cidade/UF</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">Nenhum cliente cadastrado.</TableCell></TableRow> :
              data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="min-w-[220px] font-medium">
                    <div>{c.name}</div>
                    {c.trade_name && <div className="text-xs font-normal text-muted-foreground">{c.trade_name}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{c.segment ?? "—"}</TableCell>
                  <TableCell className="text-sm">{c.region ?? "—"}</TableCell>
                  <TableCell className="text-sm">{c.nomus_seller_name ?? "—"}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{[c.city, c.state].filter(Boolean).join(" / ") || "—"}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
