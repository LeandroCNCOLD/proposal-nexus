import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createInboundLead } from "@/lib/leads-inbound.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Flame } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/sdr/novo-lead")({
  component: NewLeadPage,
});

function NewLeadPage() {
  const navigate = useNavigate();
  const create = useServerFn(createInboundLead);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    contact_name: "", client_name: "", contact_email: "", contact_phone: "",
    city: "", state: "", segmento: "", aplicacao: "", mensagem: "",
    origem: "telefone" as "site" | "telefone" | "whatsapp" | "manual" | "evento" | "indicacao",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await create({
        data: {
          contact_name: form.contact_name,
          client_name: form.client_name,
          contact_email: form.contact_email,
          contact_phone: form.contact_phone,
          city: form.city || null,
          state: form.state || null,
          segmento: form.segmento || null,
          aplicacao: form.aplicacao || null,
          mensagem: form.mensagem || null,
          origem: form.origem,
        },
      });
      toast.success(`Lead registrado · ${res.lead_code}`);
      navigate({ to: "/app/sdr/wallet" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar lead");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F2D5E] flex items-center gap-2">
          <Flame className="w-6 h-6 text-orange-500" /> Novo lead (Inbound · P0)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre um lead que chegou pelo site, telefone, WhatsApp ou indicação. Ele entra na fila de prioridade 0 e o gestor faz a distribuição ao SDR.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 bg-card border rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nome do contato *">
            <Input required value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
          </Field>
          <Field label="Empresa / Razão social *">
            <Input required value={form.client_name} onChange={(e) => set("client_name", e.target.value)} />
          </Field>
          <Field label="E-mail *">
            <Input type="email" required value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
          </Field>
          <Field label="Telefone / WhatsApp *">
            <Input required value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
          </Field>
          <Field label="Cidade">
            <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="UF">
            <Input maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} />
          </Field>
          <Field label="Segmento">
            <Input placeholder="Ex.: Frigorífico, Sorvete, Logística" value={form.segmento} onChange={(e) => set("segmento", e.target.value)} />
          </Field>
          <Field label="Aplicação desejada">
            <Input placeholder="Ex.: Câmara fria, Túnel, Processo" value={form.aplicacao} onChange={(e) => set("aplicacao", e.target.value)} />
          </Field>
          <Field label="Origem">
            <Select value={form.origem} onValueChange={(v) => set("origem", v as typeof form.origem)}>
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
          </Field>
        </div>
        <Field label="Mensagem / necessidade">
          <Textarea rows={4} value={form.mensagem} onChange={(e) => set("mensagem", e.target.value)} />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/app/sdr/wallet" })}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar lead (P0)"}</Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
