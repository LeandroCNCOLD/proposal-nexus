import { useState } from "react";
import { useProposalAgenda, useCreateAgendaEntry, useUpdateAgendaStatus } from "@/hooks/use-proposal-agenda";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, MapPin, Link as LinkIcon, User } from "lucide-react";

const TIPOS = [
  "Reunião de Apresentação",
  "Reunião Técnica",
  "Reunião de Negociação",
  "Visita Técnica",
  "Demonstração",
  "Follow-up Agendado",
  "Fechamento",
  "Pós-venda",
];

export function ProposalAgendaTab({
  proposalId,
  proposalNumber,
  clientName,
  defaultCloser,
  defaultContact,
  defaultEmail,
  defaultPhone,
}: {
  proposalId: string;
  proposalNumber: string | null | undefined;
  clientName: string;
  defaultCloser: string;
  defaultContact?: string | null;
  defaultEmail?: string | null;
  defaultPhone?: string | null;
}) {
  const { data: items = [] } = useProposalAgenda(proposalNumber);
  const createMut = useCreateAgendaEntry(proposalId, proposalNumber);
  const updateMut = useUpdateAgendaStatus(proposalId, proposalNumber);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    tipo: "Reunião de Apresentação",
    data_inicio: "",
    duracao_min: 60,
    local: "",
    link_reuniao: "",
    closer_nome: defaultCloser,
    contato_cliente: defaultContact ?? "",
    email_cliente: defaultEmail ?? "",
    telefone_cliente: defaultPhone ?? "",
    observacoes: "",
  });

  const submit = () => {
    if (!form.data_inicio) return;
    createMut.mutate(
      {
        tipo: form.tipo,
        data_inicio: new Date(form.data_inicio).toISOString(),
        duracao_min: Number(form.duracao_min) || 60,
        client_name: clientName,
        closer_nome: form.closer_nome || defaultCloser || "—",
        local: form.local || null,
        link_reuniao: form.link_reuniao || null,
        contato_cliente: form.contato_cliente || null,
        email_cliente: form.email_cliente || null,
        telefone_cliente: form.telefone_cliente || null,
        observacoes: form.observacoes || null,
      },
      { onSuccess: () => setOpen(false) }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{items.length} reuniões nesta proposta</div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-3 w-3 mr-1" /> Agendar reunião
        </Button>
      </div>

      {items.length === 0 && (
        <div className="py-6 text-center text-sm text-muted-foreground">
          Nenhuma reunião. Use "Agendar reunião" — ela aparece também em /app/agenda.
        </div>
      )}

      {items.map((a) => {
        const past = new Date(a.data_inicio) < new Date();
        return (
          <div key={a.id} className="rounded-md border p-3 bg-card space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="font-medium text-sm">{a.tipo}</div>
              <Badge variant={a.status === "Realizado" ? "default" : a.status === "Cancelado" ? "destructive" : "secondary"}>
                {a.status}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(a.data_inicio).toLocaleString("pt-BR")} · {a.duracao_min} min
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{a.closer_nome}</span>
              {a.local && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{a.local}</span>}
              {a.link_reuniao && (
                <a href={a.link_reuniao} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <LinkIcon className="h-3 w-3" />Link
                </a>
              )}
            </div>
            {a.observacoes && <div className="text-xs italic text-muted-foreground mt-1">{a.observacoes}</div>}
            {past && a.status === "Agendado" && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => updateMut.mutate({ id: a.id, status: "Realizado" })}>
                  Marcar realizada
                </Button>
                <Button size="sm" variant="ghost" onClick={() => updateMut.mutate({ id: a.id, status: "Cliente não compareceu" })}>
                  Não compareceu
                </Button>
                <Button size="sm" variant="ghost" onClick={() => updateMut.mutate({ id: a.id, status: "Cancelado" })}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        );
      })}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova reunião</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Tipo</Label>
              <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Data e hora *</Label>
                <Input type="datetime-local" value={form.data_inicio} onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Duração (min)</Label>
                <Input type="number" value={form.duracao_min} onChange={(e) => setForm((f) => ({ ...f, duracao_min: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Closer / Vendedor *</Label>
              <Input value={form.closer_nome} onChange={(e) => setForm((f) => ({ ...f, closer_nome: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Local</Label>
                <Input value={form.local} onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Link da reunião</Label>
                <Input value={form.link_reuniao} onChange={(e) => setForm((f) => ({ ...f, link_reuniao: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Contato cliente</Label>
              <Input value={form.contato_cliente} onChange={(e) => setForm((f) => ({ ...f, contato_cliente: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="E-mail" value={form.email_cliente} onChange={(e) => setForm((f) => ({ ...f, email_cliente: e.target.value }))} />
              <Input placeholder="Telefone" value={form.telefone_cliente} onChange={(e) => setForm((f) => ({ ...f, telefone_cliente: e.target.value }))} />
            </div>
            <Textarea placeholder="Observações" rows={2} value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={!form.data_inicio || createMut.isPending}>Agendar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
