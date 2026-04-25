import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { nomusCreateClient, nomusSyncClients } from "@/integrations/nomus/server.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export const Route = createFileRoute("/app/clientes")({ component: ClientsPage });

const emptyClientForm = {
  name: "", trade_name: "", document: "", cpf: "", state_registration: "", state_registration_status: "",
  municipal_registration: "", tipoPessoa: "1", tipoContribuinteICMS: "1", crt: "", email: "", phone: "", website: "",
  zip_code: "", address: "", address_number: "", address_complement: "", district: "", city: "", state: "", country: "BRASIL",
  codigoIBGEMunicipio: "", segment: "", classification: "", region: "", notes: "",
};

function ClientsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const syncClients = useServerFn(nomusSyncClients);
  const createClient = useServerFn(nomusCreateClient);
  const [open, setOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState(emptyClientForm);

  const { data = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*, client_contacts(*)").order("name")).data ?? [],
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const res = await createClient({ data: form });
    setLoading(false);
    if (!res.ok) return toast.error(res.error ?? "Erro ao cadastrar cliente no Nomus");
    toast.success("Cliente criado no Nomus");
    setOpen(false); setForm(emptyClientForm);
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
      if ("contactsCount" in res && res.contactsCount > 0) extras.push(`${res.contactsCount} contato(s)`);
      if (res.skipped > 0) extras.push(`${res.skipped} ignorado(s)`);
      if (res.unmatched > 0) extras.push(`${res.unmatched} sem vínculo local`);
      toast.success(
        res.done
          ? `Clientes sincronizados: ${res.count}${extras.length ? ` (${extras.join(", ")})` : ""}`
          : `Lote sincronizado: ${res.count} clientes${extras.length ? ` (${extras.join(", ")})` : ""}. Clique novamente para continuar.`,
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
            <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-5xl">
              <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormInput label="Razão social / Nome *" required value={form.name} onChange={(name) => setForm({ ...form, name })} />
                  <FormInput label="Nome fantasia" value={form.trade_name} onChange={(trade_name) => setForm({ ...form, trade_name })} />
                  <FormInput label="CNPJ" value={form.document} onChange={(document) => setForm({ ...form, document })} />
                  <FormInput label="CPF" value={form.cpf} onChange={(cpf) => setForm({ ...form, cpf })} />
                  <FormInput label="Inscrição estadual" value={form.state_registration} onChange={(state_registration) => setForm({ ...form, state_registration })} />
                  <FormInput label="Situação estadual" value={form.state_registration_status} onChange={(state_registration_status) => setForm({ ...form, state_registration_status })} />
                  <FormInput label="Inscrição municipal" value={form.municipal_registration} onChange={(municipal_registration) => setForm({ ...form, municipal_registration })} />
                  <FormInput label="Tipo pessoa" value={form.tipoPessoa} onChange={(tipoPessoa) => setForm({ ...form, tipoPessoa })} />
                  <FormInput label="Contribuinte ICMS" value={form.tipoContribuinteICMS} onChange={(tipoContribuinteICMS) => setForm({ ...form, tipoContribuinteICMS })} />
                  <FormInput label="CRT" value={form.crt} onChange={(crt) => setForm({ ...form, crt })} />
                  <FormInput label="E-mail" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
                  <FormInput label="Telefone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
                  <FormInput label="Site" value={form.website} onChange={(website) => setForm({ ...form, website })} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormInput label="CEP" value={form.zip_code} onChange={(zip_code) => setForm({ ...form, zip_code })} />
                  <FormInput label="Endereço" value={form.address} onChange={(address) => setForm({ ...form, address })} />
                  <FormInput label="Número" value={form.address_number} onChange={(address_number) => setForm({ ...form, address_number })} />
                  <FormInput label="Complemento" value={form.address_complement} onChange={(address_complement) => setForm({ ...form, address_complement })} />
                  <FormInput label="Bairro" value={form.district} onChange={(district) => setForm({ ...form, district })} />
                  <FormInput label="Cidade" value={form.city} onChange={(city) => setForm({ ...form, city })} />
                  <FormInput label="UF" maxLength={2} value={form.state} onChange={(state) => setForm({ ...form, state: state.toUpperCase() })} />
                  <FormInput label="País" value={form.country} onChange={(country) => setForm({ ...form, country })} />
                  <FormInput label="Código IBGE" value={form.codigoIBGEMunicipio} onChange={(codigoIBGEMunicipio) => setForm({ ...form, codigoIBGEMunicipio })} />
                  <div className="space-y-1.5"><Label>Segmento</Label><Input value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} /></div>
                  <FormInput label="Classificação" value={form.classification} onChange={(classification) => setForm({ ...form, classification })} />
                  <div className="space-y-1.5"><Label>Região</Label><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></div>
                </div>
                <div className="space-y-1.5"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <DialogFooter><Button type="submit" disabled={loading} className="bg-[image:var(--gradient-primary)]">{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      } />

      <div className="overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-sm)]">
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Segmento</TableHead><TableHead>Região</TableHead><TableHead>Vendedor / Rep.</TableHead><TableHead>Contato</TableHead><TableHead>Cidade/UF</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">Nenhum cliente cadastrado.</TableCell></TableRow> :
              data.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelectedClient(c)}>
                  <TableCell className="min-w-[220px] font-medium">
                    <div>{c.name}</div>
                    {c.trade_name && <div className="text-xs font-normal text-muted-foreground">{c.trade_name}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{c.segment ?? "—"}</TableCell>
                  <TableCell className="text-sm">{c.region ?? "—"}</TableCell>
                  <TableCell className="min-w-[190px] text-sm">
                    <div>{c.nomus_seller_name ?? "—"}</div>
                    {c.nomus_representative_name && <div className="text-xs text-muted-foreground">Rep.: {c.nomus_representative_name}</div>}
                  </TableCell>
                  <TableCell className="min-w-[210px] text-sm">
                    {(() => {
                      const contact = (c.client_contacts ?? []).find((it) => it.is_primary) ?? c.client_contacts?.[0];
                      if (!contact) return "—";
                      return <><div>{contact.name}</div><div className="text-xs text-muted-foreground">{contact.email || contact.phone || contact.mobile || "—"}</div></>;
                    })()}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{[c.city, c.state].filter(Boolean).join(" / ") || "—"}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedClient} onOpenChange={(isOpen) => !isOpen && setSelectedClient(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-5xl">
          {selectedClient && <ClientDetails client={selectedClient} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ClientDetails({ client }: { client: any }) {
  const raw = client.nomus_raw && typeof client.nomus_raw === "object" ? client.nomus_raw : null;
  const rawEntries = raw ? Object.entries(raw).filter(([, value]) => value !== null && value !== undefined && value !== "") : [];
  const rawScalarEntries = rawEntries.filter(([, value]) => typeof value !== "object");
  const rawObjectEntries = rawEntries.filter(([, value]) => typeof value === "object");

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="text-xl">{client.name}</DialogTitle>
        <p className="text-sm text-muted-foreground">{client.trade_name || client.nomus_id ? [client.trade_name, client.nomus_id ? `Nomus #${client.nomus_id}` : null].filter(Boolean).join(" • ") : "Dados cadastrais"}</p>
      </DialogHeader>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Dados fiscais</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="CNPJ / CPF" value={client.document} />
          <DetailField label="Inscrição estadual" value={client.state_registration ?? raw?.inscricaoEstadual} />
          <DetailField label="Inscrição municipal" value={client.municipal_registration ?? raw?.inscricaoMunicipal} />
          <DetailField label="Tipo de pessoa" value={raw?.tipoPessoa} />
          <DetailField label="Tipo contribuinte ICMS" value={raw?.tipoContribuinteICMS} />
          <DetailField label="CRT" value={raw?.crt} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Dados cadastrais</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="E-mail" value={client.email ?? raw?.email} />
          <DetailField label="Telefone" value={client.phone ?? raw?.telefone} />
          <DetailField label="Site" value={client.website ?? raw?.site} />
          <DetailField label="Status" value={client.is_active ? "Ativo" : "Inativo"} />
          <DetailField label="Origem" value={client.origin} />
          <DetailField label="Criado no Nomus" value={raw?.dataCriacao} />
          <DetailField label="Modificado no Nomus" value={raw?.dataModificacao} />
          <DetailField label="Código Nomus" value={raw?.codigo ?? client.nomus_id} />
          <DetailField label="Razão social" value={raw?.razaoSocial ?? client.name} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Endereço</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="CEP" value={client.zip_code ?? raw?.cep} />
          <DetailField label="Logradouro" value={client.address ?? raw?.endereco} />
          <DetailField label="Número" value={client.address_number ?? raw?.numero} />
          <DetailField label="Complemento" value={client.address_complement ?? raw?.complemento} />
          <DetailField label="Bairro" value={client.district ?? raw?.bairro} />
          <DetailField label="Cidade" value={client.city ?? raw?.municipio} />
          <DetailField label="UF" value={client.state ?? raw?.uf} />
          <DetailField label="País" value={client.country ?? raw?.pais} />
          <DetailField label="Código IBGE" value={raw?.codigoIBGEMunicipio} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Comercial</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="Segmento / CNAE" value={client.segment ?? raw?.cnaePrincipal ?? raw?.classificacao} />
          <DetailField label="Região" value={client.region ?? raw?.regiao ?? raw?.uf} />
          <DetailField label="Vendedor" value={client.nomus_seller_name} />
          <DetailField label="Representante" value={client.nomus_representative_name} />
          <DetailField label="Início relacionamento" value={raw?.dataInicioRelacionamento} />
          <DetailField label="Término relacionamento" value={raw?.dataTerminoRelacionamento} />
        </div>
        {client.notes && <DetailField label="Observações" value={client.notes} wide />}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Contatos</h3>
        {client.client_contacts?.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {client.client_contacts.map((contact: any) => (
              <div key={contact.id} className="rounded-lg border p-3">
                <div className="font-medium">{contact.name}</div>
                <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                  <div>{contact.role || "Cargo não informado"}</div>
                  <div>{contact.email || "E-mail não informado"}</div>
                  <div>{contact.phone || contact.mobile || "Telefone não informado"}</div>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">Nenhum contato sincronizado para este cliente.</p>}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Dados completos do Nomus</h3>
        {raw ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rawScalarEntries.map(([key, value]) => <DetailField key={key} label={key} value={value} />)}
            </div>
            {rawObjectEntries.map(([key, value]) => (
              <div key={key} className="rounded-lg border p-3">
                <div className="mb-2 text-xs font-medium text-muted-foreground">{key}</div>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(value, null, 2)}</pre>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">Este cliente ainda não possui dados completos do Nomus sincronizados.</p>}
      </section>
    </div>
  );
}

function FormInput({ label, value, onChange, required, type = "text", maxLength }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; maxLength?: number }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input required={required} type={type} maxLength={maxLength} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function DetailField({ label, value, wide }: { label: string; value: unknown; wide?: boolean }) {
  const text = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div className={wide ? "rounded-lg border p-3 sm:col-span-2 lg:col-span-3" : "rounded-lg border p-3"}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm">{text}</div>
    </div>
  );
}
