import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/app/propostas/nova")({ component: NewProposal });

function NewProposal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "", client_id: "", segment: "", region: "",
    total_value: "", valid_until: "", commercial_notes: "",
    temperature: "morna" as const,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-options"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      return data ?? [];
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return toast.error("Informe o título");
    setLoading(true);
    const { data, error } = await supabase.from("proposals").insert({
      title: form.title,
      client_id: form.client_id || null,
      segment: form.segment || null,
      region: form.region || null,
      total_value: form.total_value ? Number(form.total_value) : 0,
      valid_until: form.valid_until || null,
      commercial_notes: form.commercial_notes || null,
      temperature: form.temperature,
      sales_owner_id: user?.id,
      created_by: user?.id,
    }).select("id").single();
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data) {
      // log timeline
      await supabase.from("proposal_timeline_events").insert({
        proposal_id: data.id, event_type: "criada",
        description: "Proposta criada", user_id: user?.id,
      });
      toast.success("Proposta criada");
      navigate({ to: "/app/propostas/$id", params: { id: data.id } });
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/propostas" })} className="mb-4">
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
      </Button>
      <PageHeader title="Nova proposta" subtitle="Cadastro inicial — você poderá detalhar itens, anexos e versões depois" />

      <form onSubmit={submit} className="max-w-3xl space-y-6 rounded-xl border bg-card p-6 shadow-[var(--shadow-sm)]">
        <div className="space-y-1.5">
          <Label htmlFor="title">Título *</Label>
          <Input id="title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Câmara fria 200m³ — Frigorífico XYZ" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {clients.length === 0 ? <SelectItem value="_" disabled>Cadastre um cliente primeiro</SelectItem> :
                  clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Temperatura comercial</Label>
            <Select value={form.temperature} onValueChange={(v: any) => setForm({ ...form, temperature: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fria">Fria</SelectItem>
                <SelectItem value="morna">Morna</SelectItem>
                <SelectItem value="quente">Quente</SelectItem>
                <SelectItem value="muito_quente">Muito quente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Segmento</Label>
            <Input value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} placeholder="Ex: Frigorífico, Laticínios..." />
          </div>
          <div className="space-y-1.5">
            <Label>Região</Label>
            <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Ex: SP, Sul..." />
          </div>
          <div className="space-y-1.5">
            <Label>Valor total (R$)</Label>
            <Input type="number" step="0.01" value={form.total_value} onChange={(e) => setForm({ ...form, total_value: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Validade</Label>
            <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Observações comerciais</Label>
          <Textarea rows={4} value={form.commercial_notes} onChange={(e) => setForm({ ...form, commercial_notes: e.target.value })} />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate({ to: "/app/propostas" })}>Cancelar</Button>
          <Button type="submit" disabled={loading} className="bg-[image:var(--gradient-primary)]">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar proposta
          </Button>
        </div>
      </form>
    </>
  );
}
