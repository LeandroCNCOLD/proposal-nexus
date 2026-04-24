export type CurvePoint = {
  temperature_room_c: number | null;
  evaporation_temp_c: number | null;
  condensation_temp_c: number | null;
  evaporator_capacity_kcal_h: number | null;
  total_power_kw: number | null;
  cop: number | null;
};

export type PolynomialTarget = "capacity" | "power" | "cop";

export type PolynomialModel = {
  target: PolynomialTarget;
  degree: 1 | 2;
  coefficients: number[];
  terms: string[];
  r2: number | null;
  pointsUsed: number;
  predict: (input: CurveInput) => number | null;
};

export type CurveInput = {
  temperature_room_c: number;
  evaporation_temp_c: number;
  condensation_temp_c: number;
};

export type PerformancePolynomialCurve = {
  degree: 1 | 2;
  capacity: PolynomialModel | null;
  power: PolynomialModel | null;
  cop: PolynomialModel | null;
  pointsUsed: number;
};

const LINEAR_TERMS = ["1", "Tcam", "Tevap", "Tcond"];
const QUADRATIC_TERMS = ["1", "Tcam", "Tevap", "Tcond", "Tcam²", "Tevap²", "Tcond²", "Tcam·Tevap", "Tcam·Tcond", "Tevap·Tcond"];

export function fitPerformancePolynomial(points: CurvePoint[]): PerformancePolynomialCurve | null {
  const valid = points.filter(hasCoordinates);
  if (valid.length < 4) return null;

  const degree: 1 | 2 = valid.length >= QUADRATIC_TERMS.length ? 2 : 1;
  const capacity = fitTarget(valid, "capacity", degree);
  const power = fitTarget(valid, "power", degree);
  const cop = fitTarget(valid, "cop", degree);

  if (!capacity && !power && !cop) return null;

  return {
    degree,
    capacity,
    power,
    cop,
    pointsUsed: valid.length,
  };
}

export function evaluatePolynomial(model: PolynomialModel | null, input: CurveInput): number | null {
  return model?.predict(input) ?? null;
}

function hasCoordinates(point: CurvePoint): boolean {
  return point.temperature_room_c !== null && point.evaporation_temp_c !== null && point.condensation_temp_c !== null;
}

function targetValue(point: CurvePoint, target: PolynomialTarget): number | null {
  if (target === "capacity") return point.evaporator_capacity_kcal_h;
  if (target === "power") return point.total_power_kw;
  if (point.cop !== null) return point.cop;
  if (point.evaporator_capacity_kcal_h !== null && point.total_power_kw !== null && point.total_power_kw > 0) {
    return point.evaporator_capacity_kcal_h / 860 / point.total_power_kw;
  }
  return null;
}

function fitTarget(points: CurvePoint[], target: PolynomialTarget, degree: 1 | 2): PolynomialModel | null {
  const rows = points
    .map((point) => ({ point, value: targetValue(point, target) }))
    .filter((row): row is { point: CurvePoint; value: number } => row.value !== null && Number.isFinite(row.value));

  const termCount = degree === 2 ? QUADRATIC_TERMS.length : LINEAR_TERMS.length;
  if (rows.length < termCount) return null;

  const x = rows.map(({ point }) =>
    featureVector(
      {
        temperature_room_c: point.temperature_room_c ?? 0,
        evaporation_temp_c: point.evaporation_temp_c ?? 0,
        condensation_temp_c: point.condensation_temp_c ?? 0,
      },
      degree,
    ),
  );
  const y = rows.map(({ value }) => value);
  const coefficients = solveLeastSquares(x, y);
  if (!coefficients) return null;

  const predictions = x.map((row) => dot(row, coefficients));
  const r2 = coefficientOfDetermination(y, predictions);
  const terms = degree === 2 ? QUADRATIC_TERMS : LINEAR_TERMS;

  return {
    target,
    degree,
    coefficients,
    terms,
    r2,
    pointsUsed: rows.length,
    predict: (input) => {
      const value = dot(featureVector(input, degree), coefficients);
      return Number.isFinite(value) && value > 0 ? value : null;
    },
  };
}

function featureVector(input: CurveInput, degree: 1 | 2): number[] {
  const tr = input.temperature_room_c;
  const te = input.evaporation_temp_c;
  const tc = input.condensation_temp_c;
  const linear = [1, tr, te, tc];
  if (degree === 1) return linear;
  return [...linear, tr * tr, te * te, tc * tc, tr * te, tr * tc, te * tc];
}

function solveLeastSquares(x: number[][], y: number[]): number[] | null {
  const cols = x[0]?.length ?? 0;
  if (cols === 0) return null;

  const xtx = Array.from({ length: cols }, () => Array.from({ length: cols }, () => 0));
  const xty = Array.from({ length: cols }, () => 0);

  for (let row = 0; row < x.length; row++) {
    for (let i = 0; i < cols; i++) {
      xty[i] += x[row][i] * y[row];
      for (let j = 0; j < cols; j++) xtx[i][j] += x[row][i] * x[row][j];
    }
  }

  for (let i = 1; i < cols; i++) xtx[i][i] += 1e-8;
  return gaussianSolve(xtx, xty);
}

function gaussianSolve(matrix: number[][], vector: number[]): number[] | null {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];

    const divisor = a[col][col];
    for (let j = col; j <= n; j++) a[col][j] /= divisor;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= n; j++) a[row][j] -= factor * a[col][j];
    }
  }

  return a.map((row) => row[n]);
}

function dot(a: number[], b: number[]): number {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function coefficientOfDetermination(actual: number[], predicted: number[]): number | null {
  if (actual.length < 2) return null;
  const mean = actual.reduce((sum, value) => sum + value, 0) / actual.length;
  const total = actual.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  if (total === 0) return null;
  const residual = actual.reduce((sum, value, index) => sum + (value - predicted[index]) ** 2, 0);
  return 1 - residual / total;
}