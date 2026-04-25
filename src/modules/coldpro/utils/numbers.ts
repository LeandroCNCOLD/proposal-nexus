export function numberOr(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function positive(value: unknown): number {
  return Math.max(0, numberOr(value));
}

export function round(value: unknown, digits = 2): number {
  const n = numberOr(value);
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

export function clamp(value: unknown, min: number, max: number): number {
  return Math.max(min, Math.min(max, numberOr(value)));
}
