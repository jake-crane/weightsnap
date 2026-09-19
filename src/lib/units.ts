export type Unit = "lbs" | "kg";

const LBS_PER_KG = 2.2046226218;

export function toUnit(weight: number, from: Unit, to: Unit): number {
  if (from === to) return weight;
  return from === "kg" ? weight * LBS_PER_KG : weight / LBS_PER_KG;
}

export function formatWeight(weight: number, unit: Unit): string {
  return `${weight.toFixed(1)} ${unit}`;
}
