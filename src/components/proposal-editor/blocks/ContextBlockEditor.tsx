import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import type { ContextContact, ContextData } from "@/integrations/proposal-editor/types";

interface Props {
  value: ContextData;
  onChange: (next: ContextData, editedKey?: keyof ContextData) => void;
}

export function ContextBlockEditor({ value, onChange }: Props) {
  const set = <K extends keyof ContextData>(k: K, v: ContextData[K]) => {
    onChange({ ...value, [k]: v }, k);
  };

  const caracteristicas = value.caracteristicas ?? [];
  const contatos = value.contatos ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Razão social">
          <Input
            value={value.cliente_razao ?? ""}
            onChange={(e) => set("cliente_razao", e.target.value)}
          />
        </Field>
        <Field label="Nome fantasia">
          <Input
            value={value.fantasia ?? ""}
            onChange={(e) => set("fantasia", e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="CNPJ">
          <Input value={value.cnpj ?? ""} onChange={(e) => set("cnpj", e.target.value)} />
        </Field>
        <Field label="Endereço">
          <Input value={value.endereco ?? ""} onChange={(e) => set("endereco", e.target.value)} />
        </Field>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Características do projeto</Label>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2"
            onClick={() => set("caracteristicas", [...caracteristicas, ""])}
          >
            <Plus className="mr-1 h-3 w-3" /> Adicionar
          </Button>
        </div>
        <div className="space-y-1.5">
          {caracteristicas.map((c, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={c}
                onChange={(e) => {
                  const next = [...caracteristicas];
                  next[i] = e.target.value;
                  set("caracteristicas", next);
                }}
                placeholder={`Característica ${i + 1}`}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 shrink-0"
                onClick={() =>
                  set(
                    "caracteristicas",
                    caracteristicas.filter((_, idx) => idx !== i),
                  )
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {caracteristicas.length === 0 && (
            <div className="text-xs text-muted-foreground">Nenhuma característica.</div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Contatos</Label>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2"
            onClick={() =>
              set("contatos", [...contatos, { nome: "", cargo: "", email: "", telefone: "" }])
            }
          >
            <Plus className="mr-1 h-3 w-3" /> Adicionar
          </Button>
        </div>
        <div className="space-y-2">
          {contatos.map((c, i) => (
            <div key={i} className="rounded-md border bg-muted/20 p-2 space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Nome"
                  value={c.nome ?? ""}
                  onChange={(e) => updateContact(contatos, i, { nome: e.target.value }, set)}
                />
                <Input
                  placeholder="Cargo"
                  value={c.cargo ?? ""}
                  onChange={(e) => updateContact(contatos, i, { cargo: e.target.value }, set)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Email"
                  value={c.email ?? ""}
                  onChange={(e) => updateContact(contatos, i, { email: e.target.value }, set)}
                />
                <Input
                  placeholder="Telefone"
                  value={c.telefone ?? ""}
                  onChange={(e) => updateContact(contatos, i, { telefone: e.target.value }, set)}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-destructive hover:text-destructive"
                  onClick={() =>
                    set(
                      "contatos",
                      contatos.filter((_, idx) => idx !== i),
                    )
                  }
                >
                  <Trash2 className="mr-1 h-3 w-3" /> Remover
                </Button>
              </div>
            </div>
          ))}
          {contatos.length === 0 && (
            <div className="text-xs text-muted-foreground">Nenhum contato.</div>
          )}
        </div>
      </div>

      <Field label="Texto de apresentação">
        <Textarea
          rows={3}
          value={value.texto_apresentacao ?? ""}
          onChange={(e) => set("texto_apresentacao", e.target.value)}
          placeholder="Breve apresentação do contexto…"
        />
      </Field>

      <Field label="Prazo / validade">
        <Input
          value={value.prazo_validade ?? ""}
          onChange={(e) => set("prazo_validade", e.target.value)}
          placeholder="Ex.: Validade 30 dias"
        />
      </Field>
    </div>
  );
}

function updateContact(
  list: ContextContact[],
  index: number,
  patch: Partial<ContextContact>,
  set: (k: "contatos", v: ContextContact[]) => void,
) {
  const next = [...list];
  next[index] = { ...next[index], ...patch };
  set("contatos", next);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
