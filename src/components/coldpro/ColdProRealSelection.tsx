import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles, Wind, Gauge, Zap, AlertTriangle, CheckCircle2, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  findEquipmentCandidates,
  suggestApplication,
  suggestEvaporationTemp,
  type SelectionCandidate,
  type SelectionInput,
} from "@/features/coldpro/equipment-selection.engine";
import { ColdProField, ColdProInput, ColdProSectionTitle } from "@/components/coldpro/ColdProField";

type Props = {
  environment: any;
  result: any; // resultado da carga térmica
  onSelect: (cand: SelectionCandidate) => void;
  isSelecting?: boolean;
};

function fmt(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(n);
}

export function ColdProRealSelection({ environment, result, onSelect, isSelecting }: Props) {
  const tInt = Number(environment?.internal_temp_c ?? 0);
  const tExt = Number(environment?.external_temp_c ?? 35);

  const [tEvap, setTEvap] = useState<string>(String(suggestEvaporationTemp(tInt)));
  const [tCond, setTCond] = useState<string>(String(Math.max(40, Math.round(tExt + 10))));
  const [application, setApplication] = useState<"HT" | "MT" | "LT" | "AUTO">("AUTO");
  const [refrigerant, setRefrigerant] = useState<string>("ALL");
  const [equipmentKind, setEquipmentKind] = useState<"ALL" | "plugin" | "biblock" | "split">("ALL");
  const [minQuantity, setMinQuantity] = useState<string>("1");
  const [enabled, setEnabled] = useState(false);

  const requiredKcal = Number(result?.total_required_kcal_h ?? 0);

  const input = useMemo<SelectionInput>(
    () => ({
      required_kcal_h: requiredKcal,
      internal_temp_c: tInt,
      evaporation_temp_c: Number(tEvap || suggestEvaporationTemp(tInt)),
      condensation_temp_c: Number(tCond || tExt + 10),
      application: application === "AUTO" ? suggestApplication(tInt) : application,
      refrigerant: refrigerant === "ALL" ? null : refrigerant,
      equipment_kind: equipmentKind === "ALL" ? null : equipmentKind,
      min_quantity: Math.max(1, Math.ceil(Number(minQuantity || 1))),
      volume_m3: Number(environment?.volume_m3 ?? 0),
    }),
    [requiredKcal, tInt, tExt, tEvap, tCond, application, refrigerant, equipmentKind, minQuantity, environment?.volume_m3],
  );

  const refrigerantsQuery = useQuery({
    queryKey: ["coldpro-refrigerants"],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("coldpro_equipment_models")
        .select("refrigerante")
        .not("refrigerante", "is", null);
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => r.refrigerante && set.add(r.refrigerante));
      return Array.from(set).sort();
    },
  });

  const candidatesQuery = useQuery({
    queryKey: ["coldpro-candidates", input],
    queryFn: () => findEquipmentCandidates(input),
    enabled: enabled && requiredKcal > 0,
  });

  if (requiredKcal <= 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-background p-8 text-center text-sm text-muted-foreground">
        Calcule a carga térmica antes de buscar equipamentos no catálogo.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-background p-6 shadow-sm">
        <ColdProSectionTitle>Seleção por curva real do catálogo</ColdProSectionTitle>

        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
          <ColdProField label="Carga térmica requerida" unit="kcal/h">
            <ColdProInput readOnly value={fmt(requiredKcal, 0)} />
          </ColdProField>
          <ColdProField label="Temperatura interna" unit="°C">
            <ColdProInput readOnly value={String(tInt)} />
          </ColdProField>
          <ColdProField label="Temperatura de evaporação" unit="°C">
            <ColdProInput
              type="number"
              step="0.0001"
              value={tEvap}
              onChange={(e) => setTEvap(e.target.value)}
              className="h-8 border-0 border-b border-input bg-background text-right shadow-none focus-visible:ring-0 focus-visible:border-primary"
            />
          </ColdProField>
          <ColdProField label="Temperatura de condensação" unit="°C">
            <ColdProInput
              type="number"
              step="0.0001"
              value={tCond}
              onChange={(e) => setTCond(e.target.value)}
              className="h-8 border-0 border-b border-input bg-background text-right shadow-none focus-visible:ring-0 focus-visible:border-primary"
            />
          </ColdProField>
          <ColdProField label="Aplicação">
            <Select value={application} onValueChange={(v) => setApplication(v as any)}>
              <SelectTrigger className="h-8 border-0 border-b border-input bg-background shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">Auto ({suggestApplication(tInt)})</SelectItem>
                <SelectItem value="HT">HT — Alta temperatura</SelectItem>
                <SelectItem value="MT">MT — Média temperatura</SelectItem>
                <SelectItem value="LT">LT — Baixa temperatura</SelectItem>
              </SelectContent>
            </Select>
          </ColdProField>
          <ColdProField label="Refrigerante">
            <Select value={refrigerant} onValueChange={setRefrigerant}>
              <SelectTrigger className="h-8 border-0 border-b border-input bg-background shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {(refrigerantsQuery.data ?? []).map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ColdProField>
          <ColdProField label="Tipo de equipamento">
            <Select value={equipmentKind} onValueChange={(v) => setEquipmentKind(v as any)}>
              <SelectTrigger className="h-8 border-0 border-b border-input bg-background shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="plugin">Plug-in</SelectItem>
                <SelectItem value="biblock">Bi-bloco</SelectItem>
                <SelectItem value="split">Split</SelectItem>
              </SelectContent>
            </Select>
          </ColdProField>
          <ColdProField label="Qtd. mínima de equipamentos">
            <ColdProInput
              type="number"
              step="0.0001"
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
              className="h-8 border-0 border-b border-input bg-background text-right shadow-none focus-visible:border-primary focus-visible:ring-0"
            />
          </ColdProField>
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            onClick={() => {
              setEnabled(true);
              candidatesQuery.refetch();
            }}
            disabled={candidatesQuery.isFetching}
          >
            {candidatesQuery.isFetching ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Buscando...</>
            ) : enabled ? (
              <><RefreshCw className="mr-2 h-4 w-4" /> Recalcular</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> Buscar equipamentos no catálogo</>
            )}
          </Button>
        </div>
      </div>

      {/* Resultados */}
      {enabled && candidatesQuery.data && (
        <div className="space-y-3">
          {candidatesQuery.data.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-background p-8 text-center text-sm text-muted-foreground">
              <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-500" />
              Nenhum equipamento encontrado no catálogo com esses critérios. Tente importar mais modelos ou afrouxar os filtros.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  {candidatesQuery.data.length} candidato(s) — ordenado por melhor compatibilidade
                </h3>
              </div>
              {candidatesQuery.data.slice(0, 8).map((c, idx) => (
                <CandidateCard
                  key={c.model.id}
                  candidate={c}
                  rank={idx + 1}
                  highlight={idx === 0}
                  onSelect={() => onSelect(c)}
                  isSelecting={isSelecting}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CandidateCard({
  candidate,
  rank,
  highlight,
  onSelect,
  isSelecting,
}: {
  candidate: SelectionCandidate;
  rank: number;
  highlight?: boolean;
  onSelect: () => void;
  isSelecting?: boolean;
}) {
  const surplusOk = candidate.surplus_percent >= 5 && candidate.surplus_percent <= 25;
  const surplusBad = candidate.surplus_percent < 0 || candidate.surplus_percent > 50;
  return (
    <div
      className={`rounded-2xl border bg-background p-5 shadow-sm transition ${
        highlight ? "border-primary/50 ring-2 ring-primary/10" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {highlight && <Badge className="bg-emerald-600">Recomendado</Badge>}
            <Badge variant="outline">#{rank}</Badge>
            <Badge variant="secondary">{candidate.model.linha ?? "—"}</Badge>
            {candidate.model.refrigerante && (
              <Badge variant="outline">{candidate.model.refrigerante}</Badge>
            )}
          </div>
          <h4 className="mt-2 text-lg font-semibold">{candidate.model.modelo}</h4>
          <div className="text-xs text-muted-foreground">
            {candidate.model.designacao_hp ?? "—"} · {candidate.model.gabinete ?? "—"}
          </div>
        </div>

        <Button onClick={onSelect} disabled={isSelecting} variant={highlight ? "default" : "outline"}>
          Selecionar <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric icon={<Gauge className="h-3.5 w-3.5" />} label="Capacidade unit." value={`${fmt(candidate.capacity_unit_kcal_h, 0)} kcal/h`} />
        <Metric icon={<Sparkles className="h-3.5 w-3.5" />} label="Quantidade" value={String(candidate.quantity)} />
        <Metric icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Capacidade total" value={`${fmt(candidate.capacity_total_kcal_h, 0)} kcal/h`} />
        <Metric
          icon={surplusOk ? <CheckCircle2 className="h-3.5 w-3.5" /> : surplusBad ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
          label="Sobra"
          value={`${fmt(candidate.surplus_percent, 1)}%`}
          tone={surplusOk ? "ok" : surplusBad ? "bad" : "neutral"}
        />
        <Metric icon={<Wind className="h-3.5 w-3.5" />} label="Vazão total" value={`${fmt(candidate.air_flow_total_m3_h, 0)} m³/h`} />
        <Metric label="Trocas/h" value={candidate.air_changes_hour ? fmt(candidate.air_changes_hour, 1) : "—"} />
        <Metric icon={<Zap className="h-3.5 w-3.5" />} label="Potência" value={candidate.total_power_kw ? `${fmt(candidate.total_power_kw, 2)} kW` : "—"} />
        <Metric label="COP" value={candidate.cop ? fmt(candidate.cop, 2) : "—"} />
      </div>

      <div className="mt-3 text-[11px] text-muted-foreground">
        {candidate.point_used.polynomial ? "Curva polinomial" : "Ponto de curva"}: Tevap {fmt(candidate.point_used.evaporation_temp_c)}°C · Tcond {fmt(candidate.point_used.condensation_temp_c)}°C
        {candidate.point_used.polynomial_r2 !== null && ` · R² ${fmt(candidate.point_used.polynomial_r2, 3)}`}
        {candidate.point_used.interpolated && " · interpolado"}
      </div>

      {candidate.warnings.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {candidate.warnings.map((w, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3" /> {w}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  tone?: "ok" | "bad" | "neutral";
}) {
  const toneCls =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "bad"
      ? "text-red-600"
      : "text-foreground";
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-0.5 text-sm font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}
