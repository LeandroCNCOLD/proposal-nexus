import { strict as assert } from "node:assert";
import { calculateInfiltrationAirflow } from "./infiltrationCalculator";

function nearlyEqual(actual: number, expected: number, tolerance = 0.01) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

// ─── Detecção de método ──────────────────────────────────────────────────────

{
  // Túnel em batelada -> método por ciclo
  const result = calculateInfiltrationAirflow({
    environmentType: "blast_freezer",
    processMode: "batch",
    doorWidthM: 1.2,
    doorHeightM: 2.2,
    doorAirVelocityMS: 0.5,
    openingsPerCycle: 4,
    doorOpenTimeSecondsPerOpening: 60,
    batchTimeH: 4,
  });
  assert.equal(result.method, "per_cycle");
  assert.equal(result.errors.length, 0);
  assert.ok(result.airflowM3H > 0);
  // V_ciclo = 1.2 * 2.2 * 0.5 * (4 * 60) = 316.8 m3 ; / 4h = 79.2 m3/h
  nearlyEqual(result.volumeM3PerCycle ?? 0, 316.8, 0.1);
  nearlyEqual(result.airflowM3H, 79.2, 0.1);
}

{
  // Câmara fria -> método por dia
  const result = calculateInfiltrationAirflow({
    environmentType: "cold_room",
    doorWidthM: 1.0,
    doorHeightM: 2.0,
    doorAirVelocityMS: 0.5,
    openingsPerDay: 20,
    doorOpenTimeSecondsPerOpening: 30,
    operatingHoursPerDay: 16,
  });
  assert.equal(result.method, "per_day");
  assert.equal(result.errors.length, 0);
  // V_dia = 1.0 * 2.0 * 0.5 * (20 * 30) = 600 m3 ; / 16h = 37.5 m3/h
  nearlyEqual(result.volumeM3PerDay ?? 0, 600, 0.1);
  nearlyEqual(result.airflowM3H, 37.5, 0.1);
}

// ─── Fallbacks de horas de rateio (per_day) ─────────────────────────────────

{
  // Sem nenhuma hora informada -> fallback técnico de 16h
  const result = calculateInfiltrationAirflow({
    environmentType: "cold_room",
    doorWidthM: 1.0,
    doorHeightM: 2.0,
    doorAirVelocityMS: 0.5,
    openingsPerDay: 16,
    doorOpenTimeSecondsPerOpening: 30,
  });
  // V_dia = 1.0 * 2.0 * 0.5 * (16 * 30) = 480 m3 ; / 16h (fallback) = 30 m3/h
  nearlyEqual(result.airflowM3H, 30, 0.1);
}

// ─── Validação: campos obrigatórios ausentes não devem quebrar o cálculo ────

{
  // Sem dimensões de porta nem aberturas -> retorna erro, sem lançar exceção
  const result = calculateInfiltrationAirflow({
    environmentType: "cold_room",
  });
  assert.equal(result.method, "per_day");
  assert.ok(result.errors.length > 0);
  assert.equal(result.airflowM3H, 0);
}

{
  // Túnel batch sem tempo de ciclo -> erro controlado, sem exceção
  const result = calculateInfiltrationAirflow({
    environmentType: "blast_freezer",
    processMode: "batch",
    doorWidthM: 1.2,
    doorHeightM: 2.2,
    openingsPerCycle: 4,
  });
  assert.equal(result.method, "per_cycle");
  assert.ok(result.errors.length > 0);
  assert.equal(result.airflowM3H, 0);
}

console.log("infiltrationCalculator tests passed");
