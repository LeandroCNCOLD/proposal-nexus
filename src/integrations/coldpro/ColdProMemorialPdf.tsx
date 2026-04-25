import * as React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const COLORS = {
  primary: "#0d2438",
  accent: "#1e6ea7",
  text: "#1f2937",
  muted: "#6b7280",
  border: "#d1d5db",
  bgSoft: "#f3f6f9",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: COLORS.text,
  },
  cover: {
    padding: 0,
    fontFamily: "Helvetica",
    color: "#ffffff",
    backgroundColor: COLORS.primary,
  },
  coverInner: {
    flex: 1,
    padding: 50,
    justifyContent: "space-between",
  },
  coverEyebrow: {
    fontSize: 10,
    letterSpacing: 3,
    color: "#9bbcd6",
    textTransform: "uppercase",
  },
  coverTitle: {
    fontSize: 32,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.15,
    marginTop: 12,
  },
  coverSubtitle: { fontSize: 13, color: "#cfe1ee", marginTop: 8 },
  coverMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "1px solid rgba(255,255,255,0.2)",
    paddingTop: 14,
    fontSize: 9,
    color: "#cfe1ee",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: `1px solid ${COLORS.border}`,
    paddingBottom: 6,
    marginBottom: 12,
  },
  headerTitle: { fontSize: 9, color: COLORS.muted, letterSpacing: 1, textTransform: "uppercase" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 8,
    color: COLORS.muted,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: `1px solid ${COLORS.border}`,
    paddingTop: 6,
  },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold", color: COLORS.primary, marginBottom: 8 },
  h2: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: COLORS.primary,
    marginTop: 14,
    marginBottom: 6,
    borderBottom: `1px solid ${COLORS.border}`,
    paddingBottom: 3,
  },
  h3: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 4 },
  p: { lineHeight: 1.45 },
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  kpiBox: {
    flex: 1,
    backgroundColor: COLORS.bgSoft,
    borderRadius: 4,
    padding: 8,
  },
  kpiLabel: { fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValue: { fontSize: 14, fontFamily: "Helvetica-Bold", color: COLORS.primary, marginTop: 2 },
  table: { borderWidth: 1, borderColor: COLORS.border, borderStyle: "solid" },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.border },
  trLast: { flexDirection: "row" },
  th: {
    flex: 1,
    padding: 5,
    backgroundColor: COLORS.bgSoft,
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  td: {
    flex: 1,
    padding: 5,
    fontSize: 8.5,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  tdRight: { textAlign: "right" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  pill: {
    backgroundColor: COLORS.bgSoft,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    fontSize: 8.5,
  },
  envHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    color: "#ffffff",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginTop: 10,
    marginBottom: 8,
  },
  envHeaderText: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 11 },
  envHeaderMeta: { color: "#cfe1ee", fontSize: 8.5 },
  totalBox: {
    backgroundColor: COLORS.accent,
    color: "#ffffff",
    padding: 8,
    borderRadius: 3,
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalLabel: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 10 },
  totalValue: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 11 },
});

function fmt(value: unknown, digits = 2): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(
    Number.isFinite(n) ? n : 0,
  );
}

type Props = {
  project: any;
  environments: any[];
  results: any[];
  selections: any[];
  products: any[];
  generatedAt: string;
  generatedBy?: string;
};

export function ColdProMemorialPdf({
  project,
  environments,
  results,
  selections,
  products,
  generatedAt,
  generatedBy,
}: Props) {
  const totals = environments.reduce(
    (acc, env) => {
      const r = results.find((x: any) => x.environment_id === env.id);
      acc.kcal += Number(r?.total_required_kcal_h ?? 0);
      acc.kw += Number(r?.total_required_kw ?? 0);
      acc.tr += Number(r?.total_required_tr ?? 0);
      return acc;
    },
    { kcal: 0, kw: 0, tr: 0 },
  );

  return (
    <Document
      title={`Memorial CN ColdPro — ${project?.name ?? ""}`}
      author="CN COLD"
      subject="Memorial técnico de cálculo de carga térmica"
    >
      {/* CAPA */}
      <Page size="A4" style={styles.cover}>
        <View style={styles.coverInner}>
          <View>
            <Text style={styles.coverEyebrow}>CN ColdPro · Memorial Técnico</Text>
            <Text style={styles.coverTitle}>{project?.name ?? "Projeto"}</Text>
            <Text style={styles.coverSubtitle}>
              Cálculo de carga térmica e seleção de equipamentos
            </Text>
          </View>
          <View>
            <View style={[styles.kpiRow, { marginBottom: 16 }]}>
              <View style={[styles.kpiBox, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
                <Text style={[styles.kpiLabel, { color: "#9bbcd6" }]}>Carga total</Text>
                <Text style={[styles.kpiValue, { color: "#ffffff" }]}>{fmt(totals.kcal, 0)} kcal/h</Text>
              </View>
              <View style={[styles.kpiBox, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
                <Text style={[styles.kpiLabel, { color: "#9bbcd6" }]}>Potência</Text>
                <Text style={[styles.kpiValue, { color: "#ffffff" }]}>{fmt(totals.kw)} kW</Text>
              </View>
              <View style={[styles.kpiBox, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
                <Text style={[styles.kpiLabel, { color: "#9bbcd6" }]}>Toneladas</Text>
                <Text style={[styles.kpiValue, { color: "#ffffff" }]}>{fmt(totals.tr)} TR</Text>
              </View>
            </View>
            <View style={styles.coverMetaRow}>
              <Text>Aplicação: {project?.application_type ?? "—"}</Text>
              <Text>Revisão {project?.revision ?? 0}</Text>
              <Text>{generatedAt}</Text>
            </View>
          </View>
        </View>
      </Page>

      {/* CONTEÚDO */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Text style={styles.headerTitle}>CN ColdPro · Memorial Técnico</Text>
          <Text style={styles.headerTitle}>{project?.name ?? ""}</Text>
        </View>

        <Text style={styles.h1}>Resumo do projeto</Text>
        <Text style={[styles.p, { marginBottom: 8 }]}>
          Este documento consolida o cálculo da carga térmica e a seleção técnica
          de equipamentos para os ambientes refrigerados do projeto, conforme
          metodologia do CN ColdPro.
        </Text>

        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Ambientes</Text>
            <Text style={styles.kpiValue}>{environments.length}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Carga total</Text>
            <Text style={styles.kpiValue}>{fmt(totals.kcal, 0)} kcal/h</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Potência</Text>
            <Text style={styles.kpiValue}>{fmt(totals.kw)} kW</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>TR</Text>
            <Text style={styles.kpiValue}>{fmt(totals.tr)} TR</Text>
          </View>
        </View>

        <Text style={styles.h2}>Lista de ambientes</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, { flex: 0.4 }]}>#</Text>
            <Text style={[styles.th, { flex: 2 }]}>Ambiente</Text>
            <Text style={styles.th}>Tipo</Text>
            <Text style={[styles.th, styles.tdRight]}>Vol. (m³)</Text>
            <Text style={[styles.th, styles.tdRight]}>Tint (°C)</Text>
            <Text style={[styles.th, styles.tdRight, { borderRightWidth: 0 }]}>Carga (kcal/h)</Text>
          </View>
          {environments.map((env, idx) => {
            const r = results.find((x: any) => x.environment_id === env.id);
            const last = idx === environments.length - 1;
            return (
              <View key={env.id} style={last ? styles.trLast : styles.tr}>
                <Text style={[styles.td, { flex: 0.4 }]}>{idx + 1}</Text>
                <Text style={[styles.td, { flex: 2 }]}>{env.name}</Text>
                <Text style={styles.td}>{env.environment_type}</Text>
                <Text style={[styles.td, styles.tdRight]}>{fmt(env.volume_m3)}</Text>
                <Text style={[styles.td, styles.tdRight]}>{fmt(env.internal_temp_c)}</Text>
                <Text style={[styles.td, styles.tdRight, { borderRightWidth: 0 }]}>
                  {fmt(r?.total_required_kcal_h, 0)}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) =>
          `CN ColdPro  ·  Memorial gerado em ${generatedAt}${generatedBy ? `  ·  por ${generatedBy}` : ""}  ·  Página ${pageNumber} de ${totalPages}`
        } />
      </Page>

      {/* PÁGINAS POR AMBIENTE */}
      {environments.map((env, idx) => {
        const result = results.find((r: any) => r.environment_id === env.id);
        const selection = selections.find((s: any) => s.environment_id === env.id);
        const envProducts = products.filter((p: any) => p.environment_id === env.id);

        return (
          <Page key={env.id} size="A4" style={styles.page}>
            <View style={styles.header} fixed>
              <Text style={styles.headerTitle}>CN ColdPro · {project?.name}</Text>
              <Text style={styles.headerTitle}>Ambiente {idx + 1} de {environments.length}</Text>
            </View>

            <View style={styles.envHeader}>
              <Text style={styles.envHeaderText}>{idx + 1}. {env.name}</Text>
              <Text style={styles.envHeaderMeta}>{env.environment_type}</Text>
            </View>

            <Text style={styles.h3}>Dados do ambiente</Text>
            <View style={styles.pillRow}>
              <Text style={styles.pill}>Dim.: {fmt(env.length_m)} × {fmt(env.width_m)} × {fmt(env.height_m)} m</Text>
              <Text style={styles.pill}>Volume: {fmt(env.volume_m3)} m³</Text>
              <Text style={styles.pill}>T int: {fmt(env.internal_temp_c)} °C</Text>
              <Text style={styles.pill}>T ext: {fmt(env.external_temp_c)} °C</Text>
              <Text style={styles.pill}>UR: {fmt(env.relative_humidity_percent)}%</Text>
              <Text style={styles.pill}>Painel: {fmt(env.wall_thickness_mm)} mm</Text>
              <Text style={styles.pill}>Compressor: {fmt(env.compressor_runtime_hours_day)} h/dia</Text>
              <Text style={styles.pill}>Aberturas porta: {fmt(env.door_openings_per_day)}/dia</Text>
            </View>

            {envProducts.length > 0 && (
              <>
                <Text style={styles.h3}>Produtos / processos</Text>
                <View style={styles.table}>
                  <View style={styles.tr}>
                    <Text style={[styles.th, { flex: 2 }]}>Produto</Text>
                    <Text style={[styles.th, styles.tdRight]}>kg/dia</Text>
                    <Text style={[styles.th, styles.tdRight]}>T entrada</Text>
                    <Text style={[styles.th, styles.tdRight]}>T final</Text>
                    <Text style={[styles.th, styles.tdRight, { borderRightWidth: 0 }]}>Tempo (h)</Text>
                  </View>
                  {envProducts.map((p, i) => {
                    const last = i === envProducts.length - 1;
                    return (
                      <View key={p.id} style={last ? styles.trLast : styles.tr}>
                        <Text style={[styles.td, { flex: 2 }]}>{p.product_name}</Text>
                        <Text style={[styles.td, styles.tdRight]}>{fmt(p.mass_kg_day)}</Text>
                        <Text style={[styles.td, styles.tdRight]}>{fmt(p.inlet_temp_c)} °C</Text>
                        <Text style={[styles.td, styles.tdRight]}>{fmt(p.outlet_temp_c)} °C</Text>
                        <Text style={[styles.td, styles.tdRight, { borderRightWidth: 0 }]}>{fmt(p.process_time_h)}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {result && (
              <>
                <Text style={styles.h3}>Decomposição da carga térmica</Text>
                <View style={styles.table}>
                  {[
                    ["Transmissão (paredes/teto/piso)", result.transmission_kcal_h],
                    ["Produto (sensível + latente)", result.product_kcal_h],
                    ["Embalagem", result.packaging_kcal_h],
                    ["Infiltração de ar", result.infiltration_kcal_h],
                    ["Pessoas", result.people_kcal_h],
                    ["Iluminação", result.lighting_kcal_h],
                    ["Motores / movimentação", result.motors_kcal_h],
                    ["Ventiladores do evaporador", result.fans_kcal_h],
                    ["Degelo", result.defrost_kcal_h],
                    ["Outros", result.other_kcal_h],
                    ["Carga interna do túnel", result.tunnel_internal_load_kcal_h],
                  ].map(([label, val], i, arr) => (
                    <View key={String(label)} style={i === arr.length - 1 ? styles.trLast : styles.tr}>
                      <Text style={[styles.td, { flex: 3 }]}>{label as string}</Text>
                      <Text style={[styles.td, styles.tdRight, { borderRightWidth: 0 }]}>{fmt(val, 0)} kcal/h</Text>
                    </View>
                  ))}
                </View>

                {Array.isArray(result.calculation_breakdown?.transmission_faces) && result.calculation_breakdown.transmission_faces.length ? (
                  <>
                    <Text style={styles.h3}>Transmissão por face</Text>
                    <Text style={styles.p}>Total: {fmt(result.calculation_breakdown?.transmission_summary?.total_w, 0)} W · {fmt(result.calculation_breakdown?.transmission_summary?.total_kw)} kW · {fmt(result.calculation_breakdown?.transmission_summary?.total_kcal_h, 0)} kcal/h · {fmt(result.calculation_breakdown?.transmission_summary?.total_tr)} TR</Text>
                    <View style={styles.table}>
                      {result.calculation_breakdown.transmission_faces.map((face: any, i: number, arr: any[]) => (
                        <View key={face.local} style={i === arr.length - 1 ? styles.trLast : styles.tr}>
                          <Text style={[styles.td, { flex: 1.2 }]}>{face.local}</Text>
                          <Text style={[styles.td, styles.tdRight]}>Opaca {fmt(face.insulated_area_m2 ?? face.area_m2)} m²</Text>
                          <Text style={[styles.td, styles.tdRight]}>Vidro {fmt(face.glass_area_m2)} m²</Text>
                          <Text style={[styles.td, styles.tdRight]}>ΔT {fmt(face.delta_t_c)}</Text>
                          <Text style={[styles.td, styles.tdRight]}>Solar {fmt(face.glass_solar_w, 0)} W</Text>
                          <Text style={[styles.td, styles.tdRight, { borderRightWidth: 0 }]}>{fmt(face.transmission_w, 0)} W / {fmt(face.transmission_kcal_h, 0)} kcal/h</Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}

                <View style={[styles.kpiRow, { marginTop: 8 }]}>
                  <View style={styles.kpiBox}>
                    <Text style={styles.kpiLabel}>Subtotal</Text>
                    <Text style={styles.kpiValue}>{fmt(result.subtotal_kcal_h, 0)}</Text>
                  </View>
                  <View style={styles.kpiBox}>
                    <Text style={styles.kpiLabel}>Segurança ({fmt(result.safety_factor_percent)}%)</Text>
                    <Text style={styles.kpiValue}>{fmt(result.safety_kcal_h, 0)}</Text>
                  </View>
                </View>

                <View style={styles.totalBox}>
                  <Text style={styles.totalLabel}>Carga total requerida</Text>
                  <Text style={styles.totalValue}>
                    {fmt(result.total_required_kcal_h, 0)} kcal/h  ·  {fmt(result.total_required_kw)} kW  ·  {fmt(result.total_required_tr)} TR
                  </Text>
                </View>
              </>
            )}

            {selection && (
              <>
                <Text style={styles.h3}>Equipamento selecionado</Text>
                <View style={styles.table}>
                  <View style={styles.tr}>
                    <Text style={[styles.th, { flex: 2 }]}>Modelo</Text>
                    <Text style={[styles.th, styles.tdRight]}>Qtd.</Text>
                    <Text style={[styles.th, styles.tdRight]}>Cap. unit.</Text>
                    <Text style={[styles.th, styles.tdRight]}>Cap. total</Text>
                    <Text style={[styles.th, styles.tdRight, { borderRightWidth: 0 }]}>Sobra</Text>
                  </View>
                  <View style={styles.trLast}>
                    <Text style={[styles.td, { flex: 2 }]}>{selection.model}</Text>
                    <Text style={[styles.td, styles.tdRight]}>{fmt(selection.quantity)}</Text>
                    <Text style={[styles.td, styles.tdRight]}>{fmt(selection.capacity_unit_kcal_h, 0)} kcal/h</Text>
                    <Text style={[styles.td, styles.tdRight]}>{fmt(selection.capacity_total_kcal_h, 0)} kcal/h</Text>
                    <Text style={[styles.td, styles.tdRight, { borderRightWidth: 0 }]}>{fmt(selection.surplus_percent)}%</Text>
                  </View>
                </View>
                <View style={[styles.pillRow, { marginTop: 6 }]}>
                  <Text style={styles.pill}>Vazão total: {fmt(selection.air_flow_total_m3_h, 0)} m³/h</Text>
                  <Text style={styles.pill}>Trocas/h: {fmt(selection.air_changes_hour)}</Text>
                  <Text style={styles.pill}>Potência: {selection.total_power_kw ? `${fmt(selection.total_power_kw)} kW` : "—"}</Text>
                  <Text style={styles.pill}>COP: {selection.cop ? fmt(selection.cop) : "—"}</Text>
                  <Text style={styles.pill}>Método: {selection.selection_method === "polynomial" ? "curva polinomial" : selection.selection_method === "interpolated" ? "interpolado" : "ponto de curva"}</Text>
                  {selection.notes && <Text style={styles.pill}>{selection.notes}</Text>}
                </View>
              </>
            )}

            <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) =>
              `CN ColdPro  ·  Memorial gerado em ${generatedAt}  ·  Página ${pageNumber} de ${totalPages}`
            } />
          </Page>
        );
      })}
    </Document>
  );
}
