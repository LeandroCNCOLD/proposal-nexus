export const W_TO_KCAL_H = 0.859845;
export const KW_PER_TR = 3.517;

export function wattsToKw(watts: number) {
  return watts / 1000;
}

export function kwToWatts(kw: number) {
  return kw * 1000;
}

export function wattsToKcalH(watts: number) {
  return watts * W_TO_KCAL_H;
}

export function kwToKcalH(kw: number) {
  return wattsToKcalH(kwToWatts(kw));
}

export function kwToTr(kw: number) {
  return kw / KW_PER_TR;
}
