import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/app/clientes")({ component: ClientsPage });

function ClientsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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

  return (
    <>
      <PageHeader title="Clientes" subtitle={`${data.length} cadastrados`} actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-[image:var(--gradient-primary)]"><Plus className="mr-1.5 h-4 w-4" /> Novo cliente</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5"><Label>Nome *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Segmento</Label><Input value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Região</Label><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Cidade</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>UF</Label><Input maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} /></div>
              </div>
              <DialogFooter><Button type="submit" disabled={loading} className="bg-[image:var(--gradient-primary)]">{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      } />

      <div className="rounded-xl border bg-card shadow-[var(--shadow-sm)]">
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Segmento</TableHead><TableHead>Região</TableHead><TableHead>Cidade/UF</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-12">Nenhum cliente cadastrado.</TableCell></TableRow> :
              data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm">{c.segment ?? "—"}</TableCell>
                  <TableCell className="text-sm">{c.region ?? "—"}</TableCell>
                  <TableCell className="text-sm">{[c.city, c.state].filter(Boolean).join(" / ") || "—"}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
