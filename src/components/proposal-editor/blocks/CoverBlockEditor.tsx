import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CoverData } from "@/integrations/proposal-editor/types";

interface Props {
  value: CoverData;
  onChange: (next: CoverData, editedKey?: keyof CoverData) => void;
}

export function CoverBlockEditor({ value, onChange }: Props) {
  const set = <K extends keyof CoverData>(k: K, v: CoverData[K]) => {
    onChange({ ...value, [k]: v }, k);
  };
  return (
    <div className="space-y-3">
      <Field label="Cliente">
        <Input value={value.cliente ?? ""} onChange={(e) => set("cliente", e.target.value)} />
      </Field>
      <Field label="Projeto">
        <Input value={value.projeto ?? ""} onChange={(e) => set("projeto", e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nº da proposta">
          <Input value={value.numero ?? ""} onChange={(e) => set("numero", e.target.value)} />
        </Field>
        <Field label="Data">
          <Input
            type="date"
            value={value.data ?? ""}
            onChange={(e) => set("data", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Responsável">
        <Input
          value={value.responsavel ?? ""}
          onChange={(e) => set("responsavel", e.target.value)}
        />
      </Field>
      <Field label="URL da foto de capa (opcional)">
        <Input
          placeholder="https://…"
          value={value.foto_capa_url ?? ""}
          onChange={(e) => set("foto_capa_url", e.target.value)}
        />
      </Field>
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
