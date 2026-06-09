import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createMarketingLead } from "@/lib/marketing-leads.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/app/marketing/novo")({
  component: NewMarketingLeadPage,
});

function NewMarketingLeadPage() {
  const navigate = useNavigate();
  const create = useServerFn(createMarketingLead);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    contact_name: "", client_name: "", contact_email: "", contact_phone: "",
    city: "", state: "", segmento: "", aplicacao: "", mensagem: "",
    origem: "site",
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await create({ data: {
        ...form,
        contact_email: form.contact_email || null,
        city: form.city || null, state: form.state || null,
        segmento: form.segmento || null, aplicacao: form.aplicacao || null,
        mensagem: form.mensagem || null,
      }});
      toast.success(`Lead cadastrado · ${res.lead_code}`);
      navigate({ to: "/app/marketing/leads/$id", params: { id: res.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally { setSaving(false); }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-[#0F2D5E] mb-4">Cadastrar lead de marketing</h1>
      <form onSubmit={onSubmit} className="bg-card border rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <F label="Empresa"><Input value={form.client_name} onChange={(e) => set("client_name", e.target.value)} /></F>
          <F label="Contato"><Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} /></F>
          <F label="E-mail"><Input type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} /></F>
          <F label="Telefone / WhatsApp"><Input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} /></F>
          <F label="Cidade"><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></F>
          <F label="UF"><Input maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} /></F>
          <F label="Segmento"><Input value={form.segmento} onChange={(e) => set("segmento", e.target.value)} /></F>
          <F label="Aplicação"><Input value={form.aplicacao} onChange={(e) => set("aplicacao", e.target.value)} /></F>
          <F label="Origem">
            <Select value={form.origem} onValueChange={(v) => set("origem", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="site">Site</SelectItem>
                <SelectItem value="telefone">Telefone</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="indicacao">Indicação</SelectItem>
                <SelectItem value="evento">Evento</SelectItem>
                <SelectItem value="manual">Outro / manual</SelectItem>
              </SelectContent>
            </Select>
          </F>
        </div>
        <F label="Mensagem"><Textarea rows={4} value={form.mensagem} onChange={(e) => set("mensagem", e.target.value)} /></F>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/app/marketing" })}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Cadastrar"}</Button>
        </div>
      </form>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
