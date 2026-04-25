import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import type { ColdProResult } from "../types/coldPro.types";
import { listColdProEquipmentSuggestions } from "../services/coldProPersistence.functions";
import { Section } from "./formBits";
import { Button } from "@/components/ui/button";

function fmt(v: number, d = 2) { return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d }).format(v); }

export function EquipmentSelectionTab({ result }: { result: ColdProResult }) {
  const listSuggestions = useServerFn(listColdProEquipmentSuggestions);
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  async function load() { setLoading(true); try { setItems(await listSuggestions({ data: { requiredKw: result.correctedTotalKw, limit: 8 } })); } finally { setLoading(false); } }
  return <Section title="Seleção de Equipamentos"><div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Comparação da carga corrigida com a capacidade nominal da base de equipamentos existente.</p><Button onClick={load} disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Buscando</> : "Buscar equipamentos"}</Button></div>
    {items.length ? <div className="space-y-3">{items.map((item, index) => <div key={item.id} className="rounded-md border p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs text-primary">{index === 0 ? "Equipamento sugerido" : `Opção ${index + 1}`}</div><h3 className="font-semibold">{item.model}</h3><p className="text-xs text-muted-foreground">{item.line ?? "Linha não informada"} · {item.refrigerant ?? "Fluido não informado"}</p></div><div className="text-right text-sm"><b>{fmt(item.nominalCapacityKw)} kW</b><div className="text-xs text-muted-foreground">{fmt(item.nominalCapacityKcalH, 0)} kcal/h</div></div></div><div className="mt-2 text-sm">Margem: <b>{fmt(item.marginPercent, 1)}%</b>{item.undersized ? <span className="ml-2 text-destructive">Subdimensionado</span> : null}{item.oversized ? <span className="ml-2 text-amber-600">Superdimensionado</span> : null}</div></div>)}</div> : <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Clique em buscar para comparar com a base de equipamentos.</div>}
  </Section>;
}
