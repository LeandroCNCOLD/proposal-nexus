import { BarChart3, Calculator, Droplets, Gauge, Snowflake } from "lucide-react";
import { fmtColdPro } from "./ColdProFormPrimitives";

function n(value: unknown) {
  return Number(value ?? 0);
}

function LoadBar({ label, value, total }: { label: string; value: unknown; total: number }) {
  const amount = n(value);
  const pct = total > 0 ? Math.max(0, Math.min(100, (amount / total) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <b className="tabular-nums text-foreground">{fmtColdPro(amount)} kcal/h</b>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Kpi({ label, value, unit, icon }: { label: string; value: unknown; unit: string; icon: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
      </div>
      <div className="break-words text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{fmtColdPro(value)}</div>
      <div className="mt-1 text-xs text-muted-foreground">{unit}</div>
    </div>
  );
}

function Group({ title, rows }: { title: string; rows: { label: string; value: unknown }[] }) {
  const subtotal = rows.reduce((sum, row) => sum + n(row.value), 0);
  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-3 border-b pb-3">
        <h4 className="text-sm font-semibold">{title}</h4>
        <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{fmtColdPro(subtotal)} kcal/h</span>
      </div>
      <div className="space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{row.label}</span>
            <b className="tabular-nums">{fmtColdPro(row.value)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ColdProResultCard({ result }: { result: any }) {
  if (!result) return <div className="rounded-xl border border-dashed bg-background p-6 text-sm text-muted-foreground">Nenhum cálculo realizado. Preencha as etapas anteriores e clique em calcular carga térmica.</div>;

  const subtotal = n(result.subtotal_kcal_h);
  const productTotal = n(result.product_kcal_h) + n(result.packaging_kcal_h) + n(result.calculation_breakdown?.respiration_kcal_h) + n(result.tunnel_internal_load_kcal_h);
  const extraTotal = n(result.infiltration_kcal_h) + n(result.people_kcal_h) + n(result.lighting_kcal_h) + n(result.motors_kcal_h) + n(result.fans_kcal_h) + n(result.defrost_kcal_h) + n(result.other_kcal_h);
  const transmissionFaces = Array.isArray(result.calculation_breakdown?.transmission_faces) ? result.calculation_breakdown.transmission_faces : [];
  const transmissionSummary = result.calculation_breakdown?.transmission_summary ?? {};
  const tunnel = result.calculation_breakdown?.tunnel;
  const seedDehumidification = result.calculation_breakdown?.seed_dehumidification;
  const advancedProcesses = Array.isArray(result.calculation_breakdown?.advanced_processes) ? result.calculation_breakdown.advanced_processes : [];
  const productBreakdown = Array.isArray(result.calculation_breakdown?.products) ? result.calculation_breakdown.products : [];
  const bars = [
    { label: "Ambiente", value: result.transmission_kcal_h },
    { label: "Produtos", value: productTotal },
    { label: "Desumidificação", value: seedDehumidification?.total_kcal_h },
    { label: "Processos especiais", value: result.calculation_breakdown?.advanced_processes_kcal_h },
    { label: "Cargas extras", value: extraTotal },
    { label: "Segurança", value: result.safety_kcal_h },
  ];

  return (
    <div className="min-w-0 rounded-xl border bg-background p-3 shadow-sm sm:p-5">
      <div className="mb-5 flex flex-col gap-2 border-b pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Resultado do cálculo</h3>
          <p className="mt-1 text-sm text-muted-foreground">Resumo técnico da carga térmica e distribuição por origem.</p>
        </div>
        <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">Fator segurança: {fmtColdPro(result.safety_factor_percent)}%</div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi label="Carga requerida" value={result.total_required_kcal_h} unit="kcal/h" icon={<Calculator className="h-4 w-4" />} />
        <Kpi label="Potência" value={result.total_required_kw} unit="kW" icon={<Gauge className="h-4 w-4" />} />
        <Kpi label="Capacidade" value={result.total_required_tr} unit="TR" icon={<Snowflake className="h-4 w-4" />} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border p-4">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Distribuição de cargas</h4>
          </div>
          <div className="space-y-4">
            {bars.map((bar) => <LoadBar key={bar.label} label={bar.label} value={bar.value} total={n(result.total_required_kcal_h)} />)}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Group title="Ambiente" rows={[{ label: "Transmissão", value: result.transmission_kcal_h }]} />
          <Group title="Produtos" rows={[{ label: "Produto", value: result.product_kcal_h }, { label: "Embalagem", value: result.packaging_kcal_h }, { label: "Respiração", value: result.calculation_breakdown?.respiration_kcal_h }, { label: "Túnel/processo", value: result.tunnel_internal_load_kcal_h }]} />
          {seedDehumidification?.applies ? <Group title="Desumidificação" rows={[{ label: "Latente do ar", value: n(seedDehumidification.latent_air_kw) * 860 }, { label: "Latente da semente", value: n(seedDehumidification.latent_seed_kw) * 860 }, { label: "Total", value: seedDehumidification.total_kcal_h }]} /> : null}
          {advancedProcesses.length ? <Group title="Processos Especiais" rows={[{ label: "Umidade / latente", value: advancedProcesses.reduce((sum: number, item: any) => sum + n(item.humidity?.total_kcal_h), 0) }, { label: "Purga", value: advancedProcesses.reduce((sum: number, item: any) => sum + n(item.co2?.purge_thermal_load_kcal_h ?? item.controlled_atmosphere?.co2_control?.purge_thermal_load_kcal_h), 0) }, { label: "Respiração", value: advancedProcesses.reduce((sum: number, item: any) => sum + n(item.controlled_atmosphere?.respiration_load_kcal_h), 0) }]} /> : null}
          <Group title="Cargas extras" rows={[{ label: "Infiltração", value: result.infiltration_kcal_h }, { label: "Pessoas", value: result.people_kcal_h }, { label: "Iluminação", value: result.lighting_kcal_h }, { label: "Motores", value: result.motors_kcal_h }, { label: "Ventiladores", value: result.fans_kcal_h }, { label: "Degelo", value: result.defrost_kcal_h }, { label: "Outras", value: result.other_kcal_h }]} />
          <Group title="Fechamento" rows={[{ label: "Subtotal", value: subtotal }, { label: "Segurança", value: result.safety_kcal_h }, { label: "Total requerido", value: result.total_required_kcal_h }]} />
        </div>
      </div>

      {seedDehumidification?.applies ? (
        <div className="mt-5 rounded-xl border p-4">
          <div className="mb-3 flex items-center gap-2 border-b pb-3"><Droplets className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold">Controle de umidade — sementes</h4></div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
            <div>W externo: <b>{fmtColdPro(seedDehumidification.external_absolute_humidity_kg_kg, 5)} kg/kg</b></div>
            <div>W interno: <b>{fmtColdPro(seedDehumidification.internal_absolute_humidity_kg_kg, 5)} kg/kg</b></div>
            <div>ΔW: <b>{fmtColdPro(seedDehumidification.delta_w_kg_kg, 5)} kg/kg</b></div>
            <div>Vazão ar: <b>{fmtColdPro(seedDehumidification.air_flow_m3_h)} m³/h</b></div>
            <div>Água do ar: <b>{fmtColdPro(seedDehumidification.water_removed_air_kg_h, 2)} kg/h</b></div>
            <div>Água semente: <b>{fmtColdPro(seedDehumidification.water_removed_seed_kg_h, 2)} kg/h</b></div>
            <div>Latente ar: <b>{fmtColdPro(seedDehumidification.latent_air_kw, 2)} kW</b></div>
            <div>Latente semente: <b>{fmtColdPro(seedDehumidification.latent_seed_kw, 2)} kW</b></div>
            <div>Total: <b>{fmtColdPro(seedDehumidification.total_kw, 2)} kW</b></div>
            <div>Total: <b>{fmtColdPro(seedDehumidification.total_kcal_h)} kcal/h</b></div>
          </div>
          {Array.isArray(seedDehumidification.warnings) && seedDehumidification.warnings.length ? <div className="mt-3 rounded-md bg-muted p-3 text-xs text-muted-foreground">{seedDehumidification.warnings.join(" ")}</div> : null}
        </div>
      ) : null}

      {advancedProcesses.length ? (
        <div className="mt-5 rounded-xl border p-4">
          <div className="mb-3 flex items-center gap-2 border-b pb-3"><Droplets className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold">Processos Especiais — Atmosfera, maturação e pós-colheita</h4></div>
          {advancedProcesses.map((item: any, index: number) => (
            <div key={`${item.advanced_process_type}-${index}`} className="mb-3 rounded-lg bg-muted/30 p-3 text-sm last:mb-0">
              <div className="mb-2 font-semibold">{item.advanced_process_type} · {item.status}</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-4">
                <div>Água do ar: <b>{fmtColdPro(item.humidity?.water_removed_air_kg_h)} kg/h</b></div>
                <div>Água produto: <b>{fmtColdPro(item.humidity?.water_removed_product_kg_h)} kg/h</b></div>
                <div>Latente: <b>{fmtColdPro(item.humidity?.total_kw)} kW</b></div>
                <div>Etileno: <b>{fmtColdPro(item.ethylene?.ethylene_volume_l, 3)} L</b></div>
                <div>CO₂ gerado: <b>{fmtColdPro(item.co2?.co2_generated_m3_h ?? item.controlled_atmosphere?.co2_control?.co2_generated_m3_h, 5)} m³/h</b></div>
                <div>Purga mínima: <b>{fmtColdPro(item.co2?.purge_airflow_m3_h ?? item.controlled_atmosphere?.co2_control?.purge_airflow_m3_h)} m³/h</b></div>
                <div>Carga purga: <b>{fmtColdPro(item.co2?.purge_thermal_load_kw ?? item.controlled_atmosphere?.co2_control?.purge_thermal_load_kw)} kW</b></div>
                <div>Respiração: <b>{fmtColdPro(item.controlled_atmosphere?.respiration_load_kw)} kW</b></div>
              </div>
              {Array.isArray(item.warnings) && item.warnings.length ? <div className="mt-2 text-xs text-muted-foreground">{item.warnings.join(" ")}</div> : null}
            </div>
          ))}
        </div>
      ) : null}

      {transmissionFaces.length ? (
        <div className="mt-5 rounded-xl border p-4">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <h4 className="text-sm font-semibold">Transmissão por face</h4>
            <div className="text-xs text-muted-foreground">
              Total: <b className="text-foreground">{fmtColdPro(transmissionSummary.total_w)} W</b> · <b className="text-foreground">{fmtColdPro(transmissionSummary.total_kw, 2)} kW</b> · <b className="text-foreground">{fmtColdPro(transmissionSummary.total_kcal_h)} kcal/h</b> · <b className="text-foreground">{fmtColdPro(transmissionSummary.total_tr, 2)} TR</b>
            </div>
          </div>
          <div className="max-w-full overflow-x-auto">
              <table className="w-full min-w-[1020px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 text-left font-medium">Face</th>
                    <th className="py-2 text-right font-medium">Área isolada m²</th>
                    <th className="py-2 text-right font-medium">Vidro m²</th>
                    <th className="py-2 text-right font-medium">U painel</th>
                  <th className="py-2 text-right font-medium">ΔT °C</th>
                    <th className="py-2 text-right font-medium">Painel W</th>
                    <th className="py-2 text-right font-medium">Vidro W</th>
                    <th className="py-2 text-right font-medium">Solar W</th>
                    <th className="py-2 text-right font-medium">Total W</th>
                    <th className="py-2 text-right font-medium">kW</th>
                  <th className="py-2 text-right font-medium">kcal/h</th>
                  <th className="py-2 text-right font-medium">TR</th>
                </tr>
              </thead>
              <tbody>
                {transmissionFaces.map((face: any) => (
                  <tr key={face.local} className="border-b last:border-0">
                    <td className="py-2 font-medium">{face.local}</td>
                    <td className="py-2 text-right tabular-nums">{fmtColdPro(face.insulated_area_m2 ?? face.area_m2)}</td>
                    <td className="py-2 text-right tabular-nums">{fmtColdPro(face.glass_area_m2)}</td>
                    <td className="py-2 text-right tabular-nums">{fmtColdPro(face.u_value_w_m2k, 3)}</td>
                    <td className="py-2 text-right tabular-nums">{fmtColdPro(face.delta_t_c)}</td>
                    <td className="py-2 text-right tabular-nums">{fmtColdPro(face.panel_transmission_w)}</td>
                    <td className="py-2 text-right tabular-nums">{fmtColdPro(face.glass_transmission_w)}</td>
                    <td className="py-2 text-right tabular-nums">{fmtColdPro(face.glass_solar_w)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{fmtColdPro(face.transmission_w)}</td>
                    <td className="py-2 text-right tabular-nums">{fmtColdPro(face.transmission_kw, 2)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{fmtColdPro(face.transmission_kcal_h)}</td>
                    <td className="py-2 text-right tabular-nums">{fmtColdPro(face.transmission_tr, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {productBreakdown.length ? (
        <div className="mt-5 rounded-xl border p-4">
          <h4 className="mb-3 border-b pb-3 text-sm font-semibold">Base da carga de produto</h4>
          <div className="space-y-3">
            {productBreakdown.map((product: any, index: number) => (
              <div key={`${product.product_name}-${index}`} className="rounded-lg bg-muted/30 p-3 text-sm">
                <div className="mb-2 font-semibold">{product.product_name}</div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-4">
                  <div>Modo: <b>{product.product_load_mode}</b></div>
                  <div>Massa/dia: <b>{fmtColdPro(product.mass_kg_day)} kg</b></div>
                  <div>Equivalente: <b>{fmtColdPro(product.hourly_movement_kg)} kg/h</b></div>
                  <div>Tempo: <b>{fmtColdPro(product.recovery_time_h)} h</b></div>
                  <div>Energia: <b>{fmtColdPro(product.total_energy_kcal)} kcal</b></div>
                  <div>Carga: <b>{fmtColdPro(product.total_kcal_h)} kcal/h</b></div>
                  <div>Giro: <b>{fmtColdPro(product.daily_turnover_percent)}%</b></div>
                  <div>Estoque: <b>{fmtColdPro(product.stored_mass_kg)} kg</b></div>
                </div>
                {Array.isArray(product.warnings) && product.warnings.length ? <div className="mt-2 text-xs text-muted-foreground">{product.warnings.join(" ")}</div> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tunnel ? (
        <div className="mt-5 rounded-xl border p-4">
          <div className="mb-3 flex flex-col gap-1 border-b pb-3">
            <h4 className="text-sm font-semibold">Validação térmica do túnel</h4>
            <span className="text-xs text-muted-foreground">{tunnel.arrangement_label} · {tunnel.calculation_model === "static_equivalent_block" ? "massa agrupada/bloco equivalente" : "produto individual exposto"}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
            <div>Energia total: <b>{fmtColdPro(tunnel.total_energy_kcal)} kcal</b></div>
            <div>Energia específica: <b>{fmtColdPro(tunnel.q_specific_kj_kg)} kJ/kg</b></div>
            <div>Potência: <b>{fmtColdPro(tunnel.total_kw)} kW</b></div>
            <div>Tempo disponível: <b>{fmtColdPro(tunnel.process_time_min)} min</b></div>
            <div>Tempo até núcleo: <b>{tunnel.estimated_freezing_time_min ? `${fmtColdPro(tunnel.estimated_freezing_time_min)} min` : "—"}</b></div>
            <div>Temp. recomendada: <b>{tunnel.recommended_air_temp_c == null ? "—" : `${fmtColdPro(tunnel.recommended_air_temp_c)} °C`}</b></div>
            <div>Vel. recomendada: <b>{tunnel.recommended_air_velocity_m_s == null ? "—" : `${fmtColdPro(tunnel.recommended_air_velocity_m_s)} m/s`}</b></div>
            <div>Vazão calculada: <b>{fmtColdPro(tunnel.recommended_airflow_m3_h)} m³/h</b></div>
            <div>Margem: <b>{tunnel.optimization_margin_percent == null ? "—" : `${fmtColdPro(tunnel.optimization_margin_percent)}%`}</b></div>
            <div>Dimensão térmica: <b>{fmtColdPro(tunnel.thermal_characteristic_dimension_m, 3)} m</b></div>
            <div>Distância ao núcleo: <b>{fmtColdPro(tunnel.distance_to_core_m, 3)} m</b></div>
            <div>Fator exposição: <b>{fmtColdPro(tunnel.air_exposure_factor, 2)}</b></div>
            <div>Fator penetração: <b>{fmtColdPro(tunnel.thermal_penetration_factor, 2)}</b></div>
            <div>h base: <b>{fmtColdPro(tunnel.optimization_attempts?.find?.((a: any) => a.meets)?.h_base_w_m2_k ?? tunnel.base_convective_coefficient_w_m2_k)} W/m²K</b></div>
            <div>h efetivo: <b>{fmtColdPro(tunnel.convective_coefficient_effective_w_m2_k)} W/m²K</b></div>
            <div>Status: <b>{tunnel.optimization_status ?? tunnel.technical_status}</b></div>
            <div>Tentativas: <b>{fmtColdPro(tunnel.optimization_attempts_count)}</b></div>
          </div>
          {Array.isArray(tunnel.optimization_attempts) && tunnel.optimization_attempts.length ? <div className="mt-4 overflow-x-auto rounded-lg border"><table className="w-full min-w-[720px] text-xs"><thead className="bg-muted/40 text-muted-foreground"><tr><th className="px-3 py-2 text-left font-medium">Etapa</th><th className="px-3 py-2 text-right font-medium">Tar</th><th className="px-3 py-2 text-right font-medium">Vel.</th><th className="px-3 py-2 text-right font-medium">Tempo</th><th className="px-3 py-2 text-right font-medium">Potência</th><th className="px-3 py-2 text-right font-medium">Vazão</th><th className="px-3 py-2 text-right font-medium">Status</th></tr></thead><tbody>{tunnel.optimization_attempts.slice(0, 10).map((attempt: any, index: number) => <tr key={`${attempt.air_temp_c}-${attempt.air_velocity_m_s}-${index}`} className="border-t"><td className="px-3 py-2">{attempt.phase}</td><td className="px-3 py-2 text-right tabular-nums">{fmtColdPro(attempt.air_temp_c)} °C</td><td className="px-3 py-2 text-right tabular-nums">{fmtColdPro(attempt.air_velocity_m_s)} m/s</td><td className="px-3 py-2 text-right tabular-nums">{attempt.estimated_time_min == null ? "—" : `${fmtColdPro(attempt.estimated_time_min)} min`}</td><td className="px-3 py-2 text-right tabular-nums">{fmtColdPro(attempt.power_kw)} kW</td><td className="px-3 py-2 text-right tabular-nums">{fmtColdPro(attempt.airflow_m3_h)} m³/h</td><td className="px-3 py-2 text-right font-medium">{attempt.meets ? "atende" : "não atende"}</td></tr>)}</tbody></table></div> : null}
          {Array.isArray(tunnel.warnings) && tunnel.warnings.length ? <div className="mt-3 rounded-md bg-muted p-3 text-xs text-muted-foreground">{tunnel.warnings.join(" ")}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
