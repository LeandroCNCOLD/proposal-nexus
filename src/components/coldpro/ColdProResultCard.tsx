function fmt(value: unknown) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(value ?? 0));
}
export function ColdProResultCard({ result }: { result: any }) {
  if (!result) return <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Nenhum cálculo realizado.</div>;
  return (
    <div className="rounded-2xl border bg-background p-4">
      <h3 className="mb-3 text-base font-semibold">Resultado do cálculo</h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">Carga requerida</div><div className="text-xl font-bold">{fmt(result.total_required_kcal_h)} kcal/h</div></div>
        <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">Potência</div><div className="text-xl font-bold">{fmt(result.total_required_kw)} kW</div></div>
        <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">TR</div><div className="text-xl font-bold">{fmt(result.total_required_tr)} TR</div></div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div>Transmissão: <b>{fmt(result.transmission_kcal_h)}</b> kcal/h</div>
        <div>Produto: <b>{fmt(result.product_kcal_h)}</b> kcal/h</div>
        <div>Embalagem: <b>{fmt(result.packaging_kcal_h)}</b> kcal/h</div>
        <div>Túnel: <b>{fmt(result.tunnel_internal_load_kcal_h)}</b> kcal/h</div>
        <div>Infiltração: <b>{fmt(result.infiltration_kcal_h)}</b> kcal/h</div>
        <div>Pessoas: <b>{fmt(result.people_kcal_h)}</b> kcal/h</div>
        <div>Iluminação: <b>{fmt(result.lighting_kcal_h)}</b> kcal/h</div>
        <div>Motores: <b>{fmt(result.motors_kcal_h)}</b> kcal/h</div>
        <div>Segurança: <b>{fmt(result.safety_kcal_h)}</b> kcal/h</div>
      </div>
    </div>
  );
}
