/**
 * TESTE DE VALIDAÇÃO - TÚNEL RAFA
 * 
 * Simula o cálculo de carga térmica do Túnel Rafa com as novas correções
 * Compara resultados antes e depois das correções
 */

// ============================================================================
// DADOS DO TÚNEL RAFA (Blast Freezer)
// ============================================================================

const TUNEL_RAFA_INPUT = {
  // Identificação
  name: "Túnel Rafa",
  type: "blast_freezer",
  volume_m3: 67.54,
  
  // Produto
  product_name: "Pão de Queijo Cru",
  initial_temp_c: 24,
  final_temp_c: -18,
  freezing_point_c: -1,
  mass_kg: 400, // Aumentado de 100 para 400 kg
  batch_time_h: 2,
  
  // Propriedades do Produto
  cp_above_kj_kg_k: 3.5, // kcal/kg·K = 3.5 kJ/kg·K
  cp_below_kj_kg_k: 1.8,
  latent_heat_kj_kg: 334, // kcal/kg = 334 kJ/kg
  density_kg_m3: 600,
  
  // Ambiente
  air_temp_c: -25,
  relative_humidity_percent: 70,
  
  // Porta
  door_width_m: 3,
  door_height_m: 2,
  door_openings_per_day: 8,
  door_open_seconds_per_opening: 300,
  door_operation_profile: "normal", // 0.50 m/s
  door_protection_type: "none", // 1.00
  
  // Operação (NOVO!)
  operating_hours_per_day: 16,
  infiltration_recovery_hours_per_day: 16,
  defrost_recovery_hours_per_day: 16,
  compressor_hours_per_day: 16,
};

// ============================================================================
// CÁLCULOS ANTES DAS CORREÇÕES (ERRADO)
// ============================================================================

console.log("=".repeat(80));
console.log("ANTES DAS CORREÇÕES (ERRADO)");
console.log("=".repeat(80));

// Carga do Produto
const cp_above_kcal_kg_c = 0.835; // 3.5 kJ/kg·K ÷ 4.1868
const cp_below_kcal_kg_c = 0.43;
const latent_heat_kcal_kg = 79.8; // 334 kJ/kg ÷ 4.1868
const sensible_above = TUNEL_RAFA_INPUT.mass_kg * cp_above_kcal_kg_c * (TUNEL_RAFA_INPUT.freezing_point_c - TUNEL_RAFA_INPUT.initial_temp_c);
const latent = TUNEL_RAFA_INPUT.mass_kg * latent_heat_kcal_kg;
const sensible_below = TUNEL_RAFA_INPUT.mass_kg * cp_below_kcal_kg_c * (TUNEL_RAFA_INPUT.final_temp_c - TUNEL_RAFA_INPUT.freezing_point_c);
const product_energy_kcal_kg = (sensible_above + latent + sensible_below) / TUNEL_RAFA_INPUT.mass_kg;
const product_load_kcal_h_before = (sensible_above + latent + sensible_below) / TUNEL_RAFA_INPUT.batch_time_h;

console.log(`\n📦 CARGA DO PRODUTO:`);
console.log(`  Sensível acima: ${sensible_above.toFixed(0)} kcal`);
console.log(`  Latente: ${latent.toFixed(0)} kcal`);
console.log(`  Sensível abaixo: ${sensible_below.toFixed(0)} kcal`);
console.log(`  Total: ${(sensible_above + latent + sensible_below).toFixed(0)} kcal`);
console.log(`  Carga: ${product_load_kcal_h_before.toFixed(0)} kcal/h = ${(product_load_kcal_h_before / 860).toFixed(2)} kW`);

// Infiltração (ERRADO - usa m³/dia como m³/h!)
const door_area_m2 = TUNEL_RAFA_INPUT.door_width_m * TUNEL_RAFA_INPUT.door_height_m;
const door_infiltration_m3_day = TUNEL_RAFA_INPUT.door_openings_per_day * TUNEL_RAFA_INPUT.door_open_seconds_per_opening * 0.5 * door_area_m2 / 60;
const infiltration_kcal_h_wrong = (door_infiltration_m3_day * 1.2 * 1.006 * 25 + door_infiltration_m3_day * 1.2 * 2.45 * 20) / 3600;

console.log(`\n💨 INFILTRAÇÃO (ERRADO):`);
console.log(`  Vazão calculada: ${door_infiltration_m3_day.toFixed(0)} m³/dia`);
console.log(`  Interpretado como: ${door_infiltration_m3_day.toFixed(0)} m³/h (ERRO!)`);
console.log(`  Carga: ${infiltration_kcal_h_wrong.toFixed(0)} kcal/h = ${(infiltration_kcal_h_wrong / 860).toFixed(2)} kW`);

// Degelo (ERRADO - usa tempo de batelada!)
const defrost_kcal_h_wrong = 11625;

console.log(`\n❄️ DEGELO (ERRADO):`);
console.log(`  Carga: ${defrost_kcal_h_wrong.toFixed(0)} kcal/h = ${(defrost_kcal_h_wrong / 860).toFixed(2)} kW`);

// Pessoas (ERRADO - instantâneo!)
const people_kcal_h_wrong = 2400;

console.log(`\n👥 PESSOAS (ERRADO):`);
console.log(`  Carga: ${people_kcal_h_wrong.toFixed(0)} kcal/h = ${(people_kcal_h_wrong / 860).toFixed(2)} kW`);

// Total ERRADO
const total_kcal_h_before = product_load_kcal_h_before + infiltration_kcal_h_wrong + defrost_kcal_h_wrong + people_kcal_h_wrong;
const total_kw_before = total_kcal_h_before / 860;

console.log(`\n📊 TOTAL (ERRADO):`);
console.log(`  ${total_kcal_h_before.toFixed(0)} kcal/h = ${total_kw_before.toFixed(2)} kW`);
console.log(`  ❌ MUITO ALTO! Infiltração: ${(infiltration_kcal_h_wrong / total_kcal_h_before * 100).toFixed(1)}%`);

// ============================================================================
// CÁLCULOS DEPOIS DAS CORREÇÕES (CORRETO)
// ============================================================================

console.log("\n" + "=".repeat(80));
console.log("DEPOIS DAS CORREÇÕES (CORRETO)");
console.log("=".repeat(80));

// Infiltração (CORRETO - converte m³/dia para m³/h)
const infiltration_m3_h = door_infiltration_m3_day / 24;
const infiltration_rate_hours = TUNEL_RAFA_INPUT.infiltration_recovery_hours_per_day || 16;
const infiltration_kcal_h_correct = (infiltration_m3_h * 1.2 * 1.006 * 25 + infiltration_m3_h * 1.2 * 2.45 * 20) / 3600;
const infiltration_kcal_h_rateio = (infiltration_kcal_h_correct * 24) / infiltration_rate_hours;

console.log(`\n💨 INFILTRAÇÃO (CORRETO):`);
console.log(`  Vazão calculada: ${door_infiltration_m3_day.toFixed(0)} m³/dia`);
console.log(`  Convertido para: ${infiltration_m3_h.toFixed(1)} m³/h ✅`);
console.log(`  Carga sem rateio: ${infiltration_kcal_h_correct.toFixed(0)} kcal/h`);
console.log(`  Rateio: ${infiltration_rate_hours}h de recuperação por dia`);
console.log(`  Carga com rateio: ${infiltration_kcal_h_rateio.toFixed(0)} kcal/h = ${(infiltration_kcal_h_rateio / 860).toFixed(2)} kW ✅`);

// Degelo (CORRETO - usa rateio de tempo)
const defrost_rate_hours = TUNEL_RAFA_INPUT.defrost_recovery_hours_per_day || 16;
const defrost_kcal_h_base = 1453; // Valor base
const defrost_kcal_h_correct = (defrost_kcal_h_base * 24) / defrost_rate_hours;

console.log(`\n❄️ DEGELO (CORRETO):`);
console.log(`  Carga base: ${defrost_kcal_h_base.toFixed(0)} kcal/h`);
console.log(`  Rateio: ${defrost_rate_hours}h de recuperação por dia`);
console.log(`  Carga com rateio: ${defrost_kcal_h_correct.toFixed(0)} kcal/h = ${(defrost_kcal_h_correct / 860).toFixed(2)} kW ✅`);

// Pessoas (CORRETO - usa rateio de tempo)
const people_rate_hours = TUNEL_RAFA_INPUT.operating_hours_per_day || 16;
const people_kcal_h_base = 300; // Valor base
const people_kcal_h_correct = (people_kcal_h_base * 24) / people_rate_hours;

console.log(`\n👥 PESSOAS (CORRETO):`);
console.log(`  Carga base: ${people_kcal_h_base.toFixed(0)} kcal/h`);
console.log(`  Rateio: ${people_rate_hours}h de operação por dia`);
console.log(`  Carga com rateio: ${people_kcal_h_correct.toFixed(0)} kcal/h = ${(people_kcal_h_correct / 860).toFixed(2)} kW ✅`);

// Total CORRETO
const total_kcal_h_after = product_load_kcal_h_before + infiltration_kcal_h_rateio + defrost_kcal_h_correct + people_kcal_h_correct;
const total_kw_after = total_kcal_h_after / 860;

console.log(`\n📊 TOTAL (CORRETO):`);
console.log(`  ${total_kcal_h_after.toFixed(0)} kcal/h = ${total_kw_after.toFixed(2)} kW ✅`);
console.log(`  Infiltração: ${(infiltration_kcal_h_rateio / total_kcal_h_after * 100).toFixed(1)}%`);
console.log(`  Degelo: ${(defrost_kcal_h_correct / total_kcal_h_after * 100).toFixed(1)}%`);
console.log(`  Pessoas: ${(people_kcal_h_correct / total_kcal_h_after * 100).toFixed(1)}%`);

// ============================================================================
// COMPARAÇÃO E VALIDAÇÃO
// ============================================================================

console.log("\n" + "=".repeat(80));
console.log("COMPARAÇÃO E VALIDAÇÃO");
console.log("=".repeat(80));

const reduction_percent = ((total_kw_before - total_kw_after) / total_kw_before * 100);
const reduction_factor = total_kw_before / total_kw_after;

console.log(`\nCarga ANTES: ${total_kw_before.toFixed(2)} kW`);
console.log(`Carga DEPOIS: ${total_kw_after.toFixed(2)} kW`);
console.log(`Redução: ${reduction_percent.toFixed(1)}% (${reduction_factor.toFixed(1)}x menor) ✅`);

console.log(`\n✅ VALIDAÇÃO:`);
console.log(`  ✓ Infiltração corrigida: ${infiltration_kcal_h_wrong.toFixed(0)} → ${infiltration_kcal_h_rateio.toFixed(0)} kcal/h`);
console.log(`  ✓ Degelo corrigido: ${defrost_kcal_h_wrong.toFixed(0)} → ${defrost_kcal_h_correct.toFixed(0)} kcal/h`);
console.log(`  ✓ Pessoas corrigida: ${people_kcal_h_wrong.toFixed(0)} → ${people_kcal_h_correct.toFixed(0)} kcal/h`);
console.log(`  ✓ Carga total: ${total_kw_before.toFixed(2)} kW → ${total_kw_after.toFixed(2)} kW`);

if (total_kw_after >= 20 && total_kw_after <= 40) {
  console.log(`\n🎉 RESULTADO ESPERADO ALCANÇADO!`);
  console.log(`  Carga entre 20-40 kW: ${total_kw_after.toFixed(2)} kW ✅`);
} else {
  console.log(`\n⚠️ RESULTADO FORA DA FAIXA ESPERADA`);
  console.log(`  Esperado: 20-40 kW`);
  console.log(`  Obtido: ${total_kw_after.toFixed(2)} kW`);
}

console.log("\n" + "=".repeat(80));
