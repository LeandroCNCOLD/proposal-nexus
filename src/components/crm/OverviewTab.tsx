import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { brl, dateBR } from "@/lib/format";
import { updateProcessMeta } from "@/integrations/nomus/process-enrichment.functions";

export function OverviewTab({ detail, refetchKey }: { detail: any; refetchKey: string }) {
  const qc = useQueryClient();
  const update = useServerFn(updateProcessMeta);

  const meta = detail.meta ?? {};
  const parsed = detail.parsed ?? {};
  const p = detail.process;

  const [decisor, setDecisor] = useState<string>(meta.decisor ?? parsed.decisor ?? "");
  const [interesse, setInteresse] = useState<string>(meta.interesse ?? parsed.interesse ?? "");
  const [prob, setProb] = useState<string>(
    meta.probabilidade_pct?.toString() ?? parsed.probabilidade_pct?.toString() ?? "",
  );
  const [probLabel, setProbLabel] = useState<string>(meta.probabilidade_label ?? parsed.probabilidade ?? "");
  const [projeto, setProjeto] = useState<string>(meta.projeto_estado ?? parsed.projeto ?? "");
  const [segmento, setSegmento] = useState<string>(meta.segmento_override ?? parsed.segmento ?? "");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await update({
        data: {
          process_id: p.id,
          decisor: decisor || null,
          interesse: interesse || null,
          probabilidade_pct: prob ? Number(prob) : null,
          probabilidade_label: probLabel || null,
          projeto_estado: projeto || null,
          segmento_override: segmento || null,
        },
      });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["crm", "process", refetchKey] });
      qc.invalidateQueries({ queryKey: ["crm", "funnel"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const ageDays = p.data_criacao
    ? Math.floor((Date.now() - new Date(p.data_criacao).getTime()) / 86_400_000)
    : null;
  const lastChange = detail.stageChanges?.[0]?.changed_at;
  const stageDays = lastChange
    ? Math.floor((Date.now() - new Date(lastChange).getTime()) / 86_400_000)
    : null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* KPIs */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">Idade do processo</p>
        <p className="mt-1 text-2xl font-bold">{ageDays !== null ? `${ageDays}d` : "—"}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">Tempo na etapa atual</p>
        <p className="mt-1 text-2xl font-bold">{stageDays !== null ? `${stageDays}d` : "desde criação"}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">Próximo contato</p>
        <p className="mt-1 text-2xl font-bold">{dateBR(p.proximo_contato)}</p>
      </div>

      {/* Edição de meta */}
      <div className="md:col-span-3 rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Qualificação (sobrescreve o que vem da descrição do Nomus)</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Decisor</Label>
            <Select value={decisor || "_"} onValueChange={(v) => setDecisor(v === "_" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_">—</SelectItem>
                <SelectItem value="Sim">Sim</SelectItem>
                <SelectItem value="Não">Não</SelectItem>
                <SelectItem value="Parcial">Parcial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Interesse</Label>
            <Select value={interesse || "_"} onValueChange={(v) => setInteresse(v === "_" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_">—</SelectItem>
                <SelectItem value="Frio">Frio</SelectItem>
                <SelectItem value="Morno">Morno</SelectItem>
                <SelectItem value="Quente">Quente</SelectItem>
                <SelectItem value="Muito quente">Muito quente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Probabilidade (%)</Label>
            <Input type="number" min={0} max={100} value={prob} onChange={(e) => setProb(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Etiqueta de probabilidade</Label>
            <Input value={probLabel} onChange={(e) => setProbLabel(e.target.value)} placeholder="Ex: Proposta enviada" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Projeto / estado</Label>
            <Input value={projeto} onChange={(e) => setProjeto(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Segmento (override)</Label>
            <Input value={segmento} onChange={(e) => setSegmento(e.target.value)} />
          </div>
        </div>
        <Button className="mt-3" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          Salvar qualificação
        </Button>
      </div>

      {/* Resumo do Nomus */}
      <div className="md:col-span-3 rounded-lg border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Dados do Nomus</h3>
        <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
          <Field label="Cliente" value={p.pessoa} />
          <Field label="Responsável" value={p.responsavel} />
          <Field label="Equipe" value={p.equipe} />
          <Field label="Origem" value={p.origem} />
          <Field label="Prioridade" value={p.prioridade} />
          <Field label="Criado em" value={dateBR(p.data_criacao)} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-2 border-b border-border/40 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}
