import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/app/concorrentes")({ component: CompetitorsPage });

function CompetitorsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", region: "", price_positioning: "", perceived_strengths: "", perceived_weaknesses: "" });

  const { data = [] } = useQuery({
    queryKey: ["competitors"],
    queryFn: async () => (await supabase.from("competitors").select("*").order("name")).data ?? [],
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.from("competitors").insert(form);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Concorrente cadastrado"); setOpen(false);
    setForm({ name: "", region: "", price_positioning: "", perceived_strengths: "", perceived_weaknesses: "" });
    qc.invalidateQueries({ queryKey: ["competitors"] });
  };

  return (
    <>
      <PageHeader title="Concorrentes" subtitle={`${data.length} mapeados`} actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-[image:var(--gradient-primary)]"><Plus className="mr-1.5 h-4 w-4" /> Novo concorrente</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo concorrente</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5"><Label>Nome *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Região</Label><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Posicionamento de preço</Label><Input value={form.price_positioning} onChange={(e) => setForm({ ...form, price_positioning: e.target.value })} placeholder="Baixo / Médio / Premium" /></div>
              </div>
              <div className="space-y-1.5"><Label>Fortalezas percebidas</Label><Textarea rows={2} value={form.perceived_strengths} onChange={(e) => setForm({ ...form, perceived_strengths: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Fragilidades percebidas</Label><Textarea rows={2} value={form.perceived_weaknesses} onChange={(e) => setForm({ ...form, perceived_weaknesses: e.target.value })} /></div>
              <DialogFooter><Button type="submit" disabled={loading} className="bg-[image:var(--gradient-primary)]">{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      } />

      <div className="rounded-xl border bg-card shadow-[var(--shadow-sm)]">
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Região</TableHead><TableHead>Preço</TableHead><TableHead>Fortalezas</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-12">Nenhum concorrente.</TableCell></TableRow> :
              data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm">{c.region ?? "—"}</TableCell>
                  <TableCell className="text-sm">{c.price_positioning ?? "—"}</TableCell>
                  <TableCell className="text-sm max-w-md truncate">{c.perceived_strengths ?? "—"}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
