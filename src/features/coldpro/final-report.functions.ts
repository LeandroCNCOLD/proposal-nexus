/**
 * final-report.functions.ts
 * Server functions para geração do Relatório Final Consolidado do ColdPro.
 * Combina cálculo estático ASHRAE + simulação dinâmica em um único PDF.
 */

import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(value: unknown, digits = 1): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(
    Number.isFinite(n) ? n : 0,
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function adequacyLabel(adequacy: string): string {
  const map: Record<string, string> = {
    adequate: "Adequado",
    oversized: "Superdimensionado",
    undersized: "Subdimensionado",
    critical: "Crítico — Subdimensionamento severo",
  };
  return map[adequacy] ?? adequacy;
}

function weatherLabel(profile: string): string {
  const map: Record<string, string> = {
    hot_day: "Dia quente (38°C)",
    cold_day: "Dia frio (18°C)",
    rainy_day: "Dia chuvoso",
    dry_day: "Dia seco",
    humid_day: "Dia úmido",
    annual_average: "Média anual",
    custom: "Perfil personalizado",
  };
  return map[profile] ?? profile;
}

// ─── Buscar dados consolidados para o relatório ───────────────────────────────

export const getFinalReportData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      environmentId: z.string().uuid(),
      simulationId: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;

    // Buscar ambiente
    const { data: env, error: envError } = await supabase
      .from("coldpro_environments")
      .select("*")
      .eq("id", data.environmentId)
      .single();
    if (envError) throw new Error(envError.message);

    // Buscar projeto
    const { data: project } = await supabase
      .from("coldpro_projects")
      .select("*")
      .eq("id", env.coldpro_project_id)
      .single();

    // Buscar resultado de cálculo
    const { data: result } = await supabase
      .from("coldpro_results")
      .select("*")
      .eq("environment_id", data.environmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Buscar seleção de equipamento
    const { data: selection } = await supabase
      .from("coldpro_equipment_selections")
      .select("*")
      .eq("environment_id", data.environmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Buscar produtos
    const { data: products } = await supabase
      .from("coldpro_environment_products")
      .select("*")
      .eq("environment_id", data.environmentId);

    // Buscar simulação (a especificada ou a mais recente)
    let simulation = null;
    if (data.simulationId) {
      const { data: sim } = await supabase
        .from("coldpro_simulations")
        .select("*")
        .eq("id", data.simulationId)
        .maybeSingle();
      simulation = sim;
    } else {
      const { data: sim } = await supabase
        .from("coldpro_simulations")
        .select("*")
        .eq("environment_id", data.environmentId)
        .eq("is_latest", true)
        .maybeSingle();
      simulation = sim;
    }

    return {
      project: project ?? null,
      environment: env,
      result: result ?? null,
      selection: selection ?? null,
      products: products ?? [],
      simulation: simulation ?? null,
    };
  });

// ─── Gerar PDF do Relatório Final ────────────────────────────────────────────

export const generateFinalReportPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      environmentId: z.string().uuid(),
      simulationId: z.string().uuid().nullable().optional(),
      includeSimulation: z.boolean().default(true),
      includeBreakdown: z.boolean().default(true),
      includeEquipment: z.boolean().default(true),
      companyName: z.string().trim().max(120).nullable().optional(),
      preparedBy: z.string().trim().max(120).nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;

    // Buscar todos os dados
    const { data: env, error: envError } = await supabase
      .from("coldpro_environments")
      .select("*")
      .eq("id", data.environmentId)
      .single();
    if (envError) throw new Error(envError.message);

    const { data: project } = await supabase
      .from("coldpro_projects")
      .select("*")
      .eq("id", env.coldpro_project_id)
      .single();

    const { data: result } = await supabase
      .from("coldpro_results")
      .select("*")
      .eq("environment_id", data.environmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!result) throw new Error("Nenhum resultado de cálculo encontrado. Execute o cálculo antes de gerar o relatório.");

    const { data: selection } = await supabase
      .from("coldpro_equipment_selections")
      .select("*")
      .eq("environment_id", data.environmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: products } = await supabase
      .from("coldpro_environment_products")
      .select("*")
      .eq("environment_id", data.environmentId);

    let simulation = null;
    if (data.includeSimulation) {
      if (data.simulationId) {
        const { data: sim } = await supabase
          .from("coldpro_simulations")
          .select("*")
          .eq("id", data.simulationId)
          .maybeSingle();
        simulation = sim;
      } else {
        const { data: sim } = await supabase
          .from("coldpro_simulations")
          .select("*")
          .eq("environment_id", data.environmentId)
          .eq("is_latest", true)
          .maybeSingle();
        simulation = sim;
      }
    }

    // Montar conteúdo do relatório em Markdown para geração de PDF
    const now = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const breakdown = result.calculation_breakdown as Record<string, unknown> ?? {};

    const lines: string[] = [
      `# Relatório Final de Cálculo Térmico`,
      ``,
      `**Projeto:** ${project?.name ?? env.name}`,
      `**Ambiente:** ${env.name}`,
      data.companyName ? `**Empresa:** ${data.companyName}` : "",
      data.preparedBy ? `**Elaborado por:** ${data.preparedBy}` : "",
      `**Data:** ${now}`,
      ``,
      `---`,
      ``,
      `## 1. Dados do Ambiente`,
      ``,
      `| Parâmetro | Valor |`,
      `|-----------|-------|`,
      `| Tipo de Aplicação | ${env.environment_type} |`,
      `| Dimensões (C × L × A) | ${fmt(env.length_m)} × ${fmt(env.width_m)} × ${fmt(env.height_m)} m |`,
      `| Volume | ${fmt(env.volume_m3)} m³ |`,
      `| Temperatura Interna | ${fmt(env.internal_temp_c, 1)} °C |`,
      `| Temperatura Externa | ${fmt(env.external_temp_c, 1)} °C |`,
      `| Umidade Relativa | ${env.relative_humidity_percent ? fmt(env.relative_humidity_percent, 0) + " %" : "—"} |`,
      `| Espessura do Painel | ${fmt(env.wall_thickness_mm, 0)} mm |`,
      `| Horas de Operação | ${fmt(env.operation_hours_day, 0)} h/dia |`,
      `| Horas do Compressor | ${fmt(env.compressor_runtime_hours_day, 0)} h/dia |`,
      ``,
    ];

    // Produtos
    if ((products ?? []).length > 0) {
      lines.push(`## 2. Produtos`);
      lines.push(``);
      lines.push(`| Produto | Massa (kg/dia) | T. Entrada | T. Saída |`);
      lines.push(`|---------|---------------|-----------|---------|`);
      for (const p of products ?? []) {
        lines.push(`| ${p.product_name} | ${fmt(p.mass_kg_day)} | ${fmt(p.inlet_temp_c, 1)} °C | ${fmt(p.outlet_temp_c, 1)} °C |`);
      }
      lines.push(``);
    }

    // Cálculo estático
    if (data.includeBreakdown) {
      lines.push(`## 3. Cálculo de Carga Térmica (ASHRAE)`);
      lines.push(``);
      lines.push(`| Componente | kcal/h | kW | % do Total |`);
      lines.push(`|-----------|--------|-----|-----------|`);
      const total = Number(result.total_required_kcal_h);
      const components = [
        { label: "Transmissão", value: result.transmission_kcal_h },
        { label: "Produto", value: result.product_kcal_h },
        { label: "Embalagem", value: result.packaging_kcal_h },
        { label: "Infiltração", value: result.infiltration_kcal_h },
        { label: "Pessoas", value: result.people_kcal_h },
        { label: "Iluminação", value: result.lighting_kcal_h },
        { label: "Motores", value: result.motors_kcal_h },
        { label: "Ventiladores", value: result.fans_kcal_h },
        { label: "Degelo", value: result.defrost_kcal_h },
        { label: "Outros", value: result.other_kcal_h },
      ];
      for (const c of components) {
        const v = Number(c.value ?? 0);
        if (v === 0) continue;
        const kw = v / 860;
        const pct = total > 0 ? (v / total) * 100 : 0;
        lines.push(`| ${c.label} | ${fmt(v)} | ${fmt(kw, 2)} | ${fmt(pct, 1)} % |`);
      }
      lines.push(`| **Subtotal** | **${fmt(result.subtotal_kcal_h)}** | **${fmt(Number(result.subtotal_kcal_h) / 860, 2)}** | — |`);
      lines.push(`| Fator de Segurança (${fmt(result.safety_factor_percent, 0)} %) | ${fmt(result.safety_kcal_h)} | ${fmt(Number(result.safety_kcal_h) / 860, 2)} | — |`);
      lines.push(`| **TOTAL REQUERIDO** | **${fmt(result.total_required_kcal_h)}** | **${fmt(result.total_required_kw, 2)}** | **100 %** |`);
      lines.push(`| | | **${fmt(result.total_required_tr, 2)} TR** | |`);
      lines.push(``);
    }

    // Equipamento
    if (data.includeEquipment && selection) {
      lines.push(`## 4. Equipamento Selecionado`);
      lines.push(``);
      lines.push(`| Parâmetro | Valor |`);
      lines.push(`|-----------|-------|`);
      lines.push(`| Modelo | ${selection.model} |`);
      lines.push(`| Quantidade | ${fmt(selection.quantity, 0)} unidade(s) |`);
      lines.push(`| Capacidade Total | ${fmt(selection.capacity_total_kcal_h)} kcal/h = ${fmt(Number(selection.capacity_total_kcal_h) / 860, 2)} kW |`);
      if (selection.total_power_kw) lines.push(`| Potência Elétrica | ${fmt(selection.total_power_kw, 2)} kW |`);
      if (selection.cop) lines.push(`| COP Nominal | ${fmt(selection.cop, 2)} |`);
      lines.push(`| Sobra Técnica | ${fmt(selection.surplus_kcal_h)} kcal/h (${fmt(selection.surplus_percent, 1)} %) |`);
      if (selection.refrigerant) lines.push(`| Refrigerante | ${selection.refrigerant} |`);
      lines.push(``);
    }

    // Simulação dinâmica
    if (data.includeSimulation && simulation) {
      lines.push(`## 5. Simulação Dinâmica`);
      lines.push(``);
      lines.push(`**Perfil Climático:** ${weatherLabel(simulation.weather_profile)}`);
      lines.push(`**Período:** ${simulation.simulation_period_days} dia(s) · Passo: ${simulation.time_step_minutes} min`);
      lines.push(`**Setpoint:** ${fmt(simulation.setpoint_c, 1)} °C ± ${fmt(simulation.differential_c, 1)} °C`);
      lines.push(``);
      lines.push(`| KPI | Valor |`);
      lines.push(`|-----|-------|`);
      lines.push(`| Temperatura Máxima Interna | ${fmt(simulation.max_internal_temp_c, 1)} °C |`);
      lines.push(`| Temperatura Média Interna | ${fmt(simulation.avg_internal_temp_c, 1)} °C |`);
      lines.push(`| Horas Acima do Setpoint | ${fmt(simulation.hours_above_setpoint, 1)} h |`);
      lines.push(`| Compressor Ligado | ${fmt(simulation.compressor_on_percent, 1)} % do tempo |`);
      lines.push(`| Consumo Total | ${fmt(simulation.total_energy_kwh, 1)} kWh |`);
      if (simulation.avg_cop) lines.push(`| COP Médio Operacional | ${fmt(simulation.avg_cop, 2)} |`);
      lines.push(`| Pico de Carga | ${fmt(simulation.peak_load_kcal_h)} kcal/h |`);
      lines.push(`| Adequação do Equipamento | **${adequacyLabel(simulation.equipment_adequacy)}** |`);
      lines.push(``);

      // Alertas
      const alerts = (simulation.alerts as any[]) ?? [];
      const criticalAlerts = alerts.filter((a: any) => a.severity === "critical" || a.severity === "warning");
      if (criticalAlerts.length > 0) {
        lines.push(`### Alertas da Simulação`);
        lines.push(``);
        for (const alert of criticalAlerts) {
          const icon = alert.severity === "critical" ? "⛔" : "⚠️";
          lines.push(`${icon} **${alert.title}**: ${alert.message}`);
        }
        lines.push(``);
      }
    }

    // Conclusão
    lines.push(`## 6. Conclusão Técnica`);
    lines.push(``);

    const totalKw = Number(result.total_required_kw);
    const totalTr = Number(result.total_required_tr);
    const surplusPct = selection ? Number(selection.surplus_percent) : null;

    lines.push(
      `O ambiente **${env.name}** requer uma capacidade de refrigeração de **${fmt(totalKw, 2)} kW (${fmt(totalTr, 2)} TR)**, ` +
      `calculada conforme metodologia ASHRAE com fator de segurança de ${fmt(result.safety_factor_percent, 0)} %.`,
    );

    if (selection && surplusPct !== null) {
      lines.push(``);
      lines.push(
        `O equipamento selecionado (**${selection.model}** × ${fmt(selection.quantity, 0)}) ` +
        `atende à demanda com ${fmt(surplusPct, 1)} % de sobra técnica, ` +
        `${surplusPct < 5 ? "próximo ao limite mínimo recomendado de 5 %." : surplusPct > 30 ? "acima do ideal — considere revisar a seleção." : "dentro da faixa recomendada (5–30 %)."}`,
      );
    }

    if (simulation) {
      lines.push(``);
      lines.push(
        `A simulação dinâmica confirma que o sistema mantém a temperatura interna ` +
        `com média de **${fmt(simulation.avg_internal_temp_c, 1)} °C** no perfil "${weatherLabel(simulation.weather_profile)}", ` +
        `com o compressor operando **${fmt(simulation.compressor_on_percent, 1)} %** do tempo.`,
      );
    }

    lines.push(``);
    lines.push(`---`);
    lines.push(`*Relatório gerado automaticamente pelo sistema ColdPro · ${now}*`);

    const markdownContent = lines.filter((l) => l !== null).join("\n");

    // Salvar o relatório no banco (tabela coldpro_reports)
    const { data: savedReport, error: reportError } = await supabase
      .from("coldpro_reports")
      .insert({
        project_id: project?.id ?? null,
        environment_id: data.environmentId,
        result_id: result.id,
        title: `Relatório Final — ${env.name}`,
        calculation_memory: {
          environment: env,
          result,
          selection,
          products,
          simulation,
        } as any,
        report_text: markdownContent,
      })
      .select("id")
      .single();

    if (reportError) throw new Error(reportError.message);

    return {
      reportId: savedReport.id,
      markdownContent,
      metadata: {
        environmentName: env.name,
        projectName: project?.name ?? env.name,
        totalKw,
        totalTr,
        equipmentModel: selection?.model ?? null,
        surplusPercent: surplusPct,
        hasSimulation: !!simulation,
        generatedAt: new Date().toISOString(),
      },
    };
  });

// ─── Listar Relatórios Finais ─────────────────────────────────────────────────

export const listFinalReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ environmentId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const { data: reports, error } = await supabase
      .from("coldpro_reports")
      .select("id, title, created_at")
      .eq("environment_id", data.environmentId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return reports ?? [];
  });

// ─── Buscar Relatório Final por ID ───────────────────────────────────────────

export const getFinalReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ reportId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const { data: report, error } = await supabase
      .from("coldpro_reports")
      .select("*")
      .eq("id", data.reportId)
      .single();

    if (error) throw new Error(error.message);
    return report;
  });
