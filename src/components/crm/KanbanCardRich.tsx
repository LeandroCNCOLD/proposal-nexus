import { Link } from "@tanstack/react-router";
import { Paperclip, AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";

export type EnrichedCard = {
  id: string;
  nomus_id: string;
  nome: string | null;
  pessoa: string | null;
  etapa: string | null;
  prioridade: string | null;
  responsavel: string | null;
  proximo_contato: string | null;
  data_criacao: string | null;
  decisor: string | null;
  interesse: string | null;
  probabilidade_pct: number | null;
  probabilidade_label: string | null;
  projeto_estado: string | null;
  segmento: string | null;
  proposta_numero: string | null;
  proposta_valor: number | null;
  proposta_validade: string | null;
  propostas_count: number;
  propostas_valor_total: number;
  last_stage_change: string | null;
  attachments_count: number;
};

function timeInStage(iso: string | null, fallback: string | null): string {
  const ref = iso ?? fallback;
  if (!ref) return "—";
  const ms = Date.now() - new Date(ref).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days} dia${days > 1 ? "s" : ""}`;
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours.toString().padStart(2, "0")}h${mins.toString().padStart(2, "0")}min`;
}

function formatBRDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function interestColor(v: string | null): string {
  const x = (v ?? "").toLowerCase();
  if (x.includes("muito quente") || x.includes("quentíssim")) return "text-red-600";
  if (x.includes("quente")) return "text-orange-600";
  if (x.includes("morno")) return "text-amber-600";
  if (x.includes("frio")) return "text-sky-600";
  return "text-muted-foreground";
}

export function KanbanCardRich({ card }: { card: EnrichedCard }) {
  const validadeMs = card.proposta_validade ? new Date(card.proposta_validade).getTime() - Date.now() : null;
  const validadeOverdue = validadeMs !== null && validadeMs < 0;

  return (
    <Link
      to="/app/crm/$id"
      params={{ id: card.id }}
      className="group block rounded-md border border-border bg-card p-3 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md"
    >
      {/* Título */}
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <p className="line-clamp-2 flex-1 text-[13px] font-semibold leading-snug text-foreground">
          {(card.nome ?? card.pessoa ?? "Sem nome").trim()}
        </p>
        {card.attachments_count > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Paperclip className="h-3 w-3" />
            {card.attachments_count}
          </span>
        )}
      </div>

      {/* Linha ID · Responsável */}
      <p className="mb-1 truncate text-[11px] text-muted-foreground">
        #{card.nomus_id}
        {card.responsavel ? ` · ${card.responsavel}` : ""}
      </p>

      {/* Campos densos estilo Nomus */}
      <div className="space-y-0.5 text-[11px] leading-tight">
        {card.decisor && (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground/80">Decisor:</span> {card.decisor}
          </p>
        )}
        {card.projeto_estado && (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground/80">Projeto:</span> {card.projeto_estado}
          </p>
        )}
        {card.interesse && (
          <p className={interestColor(card.interesse)}>
            <span className="font-medium text-foreground/80">Interesse:</span> {card.interesse}
          </p>
        )}
        {(card.probabilidade_pct !== null || card.probabilidade_label) && (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground/80">Probabilidade:</span>{" "}
            {card.probabilidade_pct !== null ? `${card.probabilidade_pct}%` : ""}
            {card.probabilidade_pct !== null && card.probabilidade_label ? " – " : ""}
            {card.probabilidade_label && card.probabilidade_label.replace(/^\d+%\s*[-–]?\s*/, "")}
          </p>
        )}
        {card.segmento && (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground/80">Segmento:</span> {card.segmento}
          </p>
        )}
        {card.proposta_numero && (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground/80">Nº proposta:</span> {card.proposta_numero}
          </p>
        )}
      </div>

      {/* Rodapé */}
      <div className="mt-2 border-t border-border/60 pt-2">
        {card.pessoa && (
          <p className="mb-1 truncate text-[11px] text-muted-foreground">{card.pessoa}</p>
        )}
        <div className="flex items-end justify-between gap-2">
          <span className="text-[13px] font-bold text-emerald-700 dark:text-emerald-400">
            {card.proposta_valor !== null ? brl(card.proposta_valor) : "—"}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {timeInStage(card.last_stage_change, card.data_criacao)}
          </span>
        </div>
        {card.proposta_validade && (
          <Badge
            variant={validadeOverdue ? "destructive" : "outline"}
            className="mt-1.5 text-[10px]"
          >
            {validadeOverdue && <AlertTriangle className="mr-1 h-2.5 w-2.5" />}
            {formatBRDate(card.proposta_validade)}
            {validadeOverdue ? " (vencida)" : ""}
          </Badge>
        )}
      </div>
    </Link>
  );
}
