export type KfcalcCompatInputs = {
  volumeM3?: number | null;
  internalTempC?: number | null;
  externalTempC?: number | null;
  airChangesPerDay?: number | null;
  exchangeAirChangesPerDay?: number | null;
  productMassKg?: number | null;
  productSpecificHeatKcalKgC?: number | null;
  productInitialTempC?: number | null;
  productFinalTempC?: number | null;
  processTimeH?: number | null;
  lightingPowerW?: number | null;
  motorPowerW?: number | null;
  peopleCount?: number | null;
  safetyFactor?: number | null;
};

export type KfcalcCompatComponents = {
  infiltracao?: number | null;
  produto?: number | null;
  trocas_ar?: number | null;
  iluminacao?: number | null;
  motores?: number | null;
  pessoas?: number | null;
};

export type KfcalcCompatCase = {
  id: string;
  name: string;
  externalSystem?: string;
  inputs: KfcalcCompatInputs;
  components?: KfcalcCompatComponents;
  expectedTotalKcalH?: number | null;
  coldproTotalKcalH?: number | null;
  coldproComponents?: KfcalcCompatComponents;
};

export type KfcalcCompatResult = {
  components: Required<KfcalcCompatComponents>;
  totalSemSeguranca: number;
  fatorSeguranca: number;
  totalComSeguranca: number;
};

const DEFAULT_DENSIDADE_AR = 1.2;
const DEFAULT_CP_AR = 0.24;
const DEFAULT_WATT_TO_KCAL_H = 0.86;
const DEFAULT_CALOR_PESSOA_KCAL_H = 300;
const DEFAULT_FATOR_SEGURANCA = 1.1;

function n(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function positive(value: unknown): number {
  const parsed = n(value);
  return parsed > 0 ? parsed : 0;
}

function first(component: number | null | undefined, calculated: number): number {
  const parsed = Number(component);
  return Number.isFinite(parsed) ? parsed : calculated;
}

export function calculateKfcalcCompat(
  input: KfcalcCompatInputs,
  components: KfcalcCompatComponents = {},
): KfcalcCompatResult {
  const deltaAirT = n(input.externalTempC) - n(input.internalTempC);
  const productDeltaT = n(input.productInitialTempC) - n(input.productFinalTempC);
  const safetyFactor = positive(input.safetyFactor) || DEFAULT_FATOR_SEGURANCA;

  const infiltracao = first(
    components.infiltracao,
    (DEFAULT_DENSIDADE_AR *
      positive(input.volumeM3) *
      DEFAULT_CP_AR *
      deltaAirT *
      positive(input.airChangesPerDay)) /
      24,
  );
  const trocasAr = first(
    components.trocas_ar,
    (DEFAULT_DENSIDADE_AR *
      positive(input.volumeM3) *
      DEFAULT_CP_AR *
      deltaAirT *
      positive(input.exchangeAirChangesPerDay)) /
      24,
  );
  const produto = first(
    components.produto,
    positive(input.processTimeH) > 0
      ? (positive(input.productMassKg) *
          positive(input.productSpecificHeatKcalKgC) *
          productDeltaT) /
          positive(input.processTimeH)
      : 0,
  );
  const iluminacao = first(
    components.iluminacao,
    positive(input.lightingPowerW) * DEFAULT_WATT_TO_KCAL_H,
  );
  const motores = first(components.motores, positive(input.motorPowerW) * DEFAULT_WATT_TO_KCAL_H);
  const pessoas = first(
    components.pessoas,
    positive(input.peopleCount) * DEFAULT_CALOR_PESSOA_KCAL_H,
  );
  const totalSemSeguranca = infiltracao + produto + trocasAr + iluminacao + motores + pessoas;

  return {
    components: {
      infiltracao,
      produto,
      trocas_ar: trocasAr,
      iluminacao,
      motores,
      pessoas,
    },
    totalSemSeguranca,
    fatorSeguranca: safetyFactor,
    totalComSeguranca: totalSemSeguranca * safetyFactor,
  };
}

export const KFCALC_COMPAT_CONSTANTS = {
  densidade_ar: DEFAULT_DENSIDADE_AR,
  cp_ar: DEFAULT_CP_AR,
  conversao_watt_kcal_h: DEFAULT_WATT_TO_KCAL_H,
  calor_pessoa: DEFAULT_CALOR_PESSOA_KCAL_H,
  fator_seguranca: DEFAULT_FATOR_SEGURANCA,
} as const;
