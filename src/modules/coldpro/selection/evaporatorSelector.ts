const KW_TO_KCAL_H = 860;
const DEFAULT_CAPACITY_MARGIN = 1.15;

export type EvaporatorEquipment = {
  id?: string | number | null;
  model?: string | null;
  name?: string | null;
  type?: string | null;
  applicationType?: string | null;
  capacityKW?: number | null;
  capacity_kw?: number | null;
  capacityKcalH?: number | null;
  capacity_kcal_h?: number | null;
  evaporatingTempC?: number | null;
  evaporating_temp_c?: number | null;
  airDeltaTC?: number | null;
  deltaT?: number | null;
  air_delta_t_c?: number | null;
  deltaTEvaporatorAirC?: number | null;
  delta_t_evaporator_air_c?: number | null;
  [key: string]: unknown;
};

export type EvaporatorSelectionConditions = {
  evaporatingTempC?: number | null;
  airDeltaTC?: number | null;
  deltaT?: number | null;
  type?: string | null;
  candidates?: EvaporatorEquipment[] | null;
  evaporators?: EvaporatorEquipment[] | null;
  equipmentList?: EvaporatorEquipment[] | null;
  capacityMarginFactor?: number | null;
  temperatureToleranceC?: number | null;
  deltaTToleranceC?: number | null;
};

export type EvaporatorSelectionResult = {
  evaporator: EvaporatorEquipment | null;
  requiredCapacityKcalH: number;
  requiredCapacityKW: number;
  loadKcalH: number;
  oversizingPercent: number | null;
  candidates: Array<{
    equipment: EvaporatorEquipment;
    capacityKcalH: number;
    oversizingPercent: number;
  }>;
  warnings: string[];
};

function positiveNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function capacityKcalH(equipment: EvaporatorEquipment): number {
  return (
    positiveNumber(equipment.capacityKcalH ?? equipment.capacity_kcal_h) ||
    positiveNumber(equipment.capacityKW ?? equipment.capacity_kw) * KW_TO_KCAL_H
  );
}

function matchesTemperature(
  equipmentValue: unknown,
  targetValue: number,
  tolerance: number,
): boolean {
  if (targetValue === 0) return true;
  const value = Number(equipmentValue);
  if (!Number.isFinite(value)) return true;
  return Math.abs(value - targetValue) <= tolerance;
}

export function selectEvaporator(
  loadKW: number | null | undefined,
  conditions: EvaporatorSelectionConditions = {},
): EvaporatorSelectionResult {
  const coolingLoadKW = positiveNumber(loadKW);
  const loadKcalH = coolingLoadKW * KW_TO_KCAL_H;
  const marginFactor = positiveNumber(conditions.capacityMarginFactor) || DEFAULT_CAPACITY_MARGIN;
  const requiredCapacityKcalH = loadKcalH * marginFactor;
  const requiredCapacityKW = requiredCapacityKcalH / KW_TO_KCAL_H;
  const evaporatingTempC = Number(conditions.evaporatingTempC ?? 0) || 0;
  const airDeltaTC = Number(conditions.airDeltaTC ?? conditions.deltaT ?? 0) || 0;
  const type = normalizeText(conditions.type);
  const temperatureToleranceC = positiveNumber(conditions.temperatureToleranceC) || 3;
  const deltaTToleranceC = positiveNumber(conditions.deltaTToleranceC) || 2;
  const warnings: string[] = [];

  if (coolingLoadKW <= 0) warnings.push("Carga térmica inválida para seleção de evaporador.");

  const filtered = (
    conditions.equipmentList ??
    conditions.evaporators ??
    conditions.candidates ??
    []
  ).filter((equipment) => {
    const equipmentType = normalizeText(equipment.type ?? equipment.applicationType);
    if (type && equipmentType && equipmentType !== type) return false;
    if (
      !matchesTemperature(
        equipment.evaporatingTempC ?? equipment.evaporating_temp_c,
        evaporatingTempC,
        temperatureToleranceC,
      )
    )
      return false;
    if (
      !matchesTemperature(
        equipment.airDeltaTC ??
          equipment.deltaT ??
          equipment.air_delta_t_c ??
          equipment.deltaTEvaporatorAirC ??
          equipment.delta_t_evaporator_air_c,
        airDeltaTC,
        deltaTToleranceC,
      )
    )
      return false;
    return capacityKcalH(equipment) > 0;
  });

  const candidates = filtered
    .map((equipment) => {
      const capacity = capacityKcalH(equipment);
      return {
        equipment,
        capacityKcalH: capacity,
        oversizingPercent:
          requiredCapacityKcalH > 0
            ? ((capacity - requiredCapacityKcalH) / requiredCapacityKcalH) * 100
            : 0,
      };
    })
    .filter((candidate) => candidate.capacityKcalH >= requiredCapacityKcalH)
    .sort((a, b) => a.oversizingPercent - b.oversizingPercent);

  if (filtered.length === 0)
    warnings.push("Nenhum evaporador compatível com as condições informadas.");
  if (filtered.length > 0 && candidates.length === 0)
    warnings.push("Nenhum evaporador atende à capacidade requerida com margem.");

  const selected = candidates[0] ?? null;

  return {
    evaporator: selected?.equipment ?? null,
    requiredCapacityKcalH,
    requiredCapacityKW,
    loadKcalH,
    oversizingPercent: selected?.oversizingPercent ?? null,
    candidates,
    warnings,
  };
}
