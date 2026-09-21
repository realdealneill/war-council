import type { Dragon, Goal, Rarity, Role } from "../types";

// Power formula reverse-engineered (by dragonfire-formations.com) from real
// in-game data. Used only when a dragon's power is left blank.
const RARITY_COEF: Record<Rarity, number> = { rare: 300, epic: 410, legendary: 540, mythic: 700 };

export function estimatePower(d: Dragon): number {
  const c = RARITY_COEF[d.rarity] ?? RARITY_COEF.rare;
  const star = 1 + 0.15 * (Number(d.starRank) || 1);
  const reign = Number(d.reignLevel) || 10;
  return Math.round((c * star * reign) / 10) * 10;
}

export function dragonPower(d: Dragon): number {
  const p = Number(d.power);
  return p && p > 0 ? p : estimatePower(d);
}

// "balanced"/"dps" ask which army is strongest overall; "siege" asks how much
// damage lands on a structure's Durability, which only Siege troops do. A
// wall never attacks back, so survivability barely converts to siege score.
const SIEGE_DAMAGE_SHARE: Partial<Record<Role, number>> = {
  physical: 1, tactical: 1, fire: 1,
  control: 0.6,
  tank: 0.4,
  healer: 0.35,
};

export const DEFENSE_WEIGHT: Record<Goal, number> = { balanced: 1, dps: 0.7, siege: 0.35 };

export function goalShare(d: Dragon, goal: Goal): number {
  if (goal !== "siege") return 1;
  const share = SIEGE_DAMAGE_SHARE[d.role];
  return share ?? 0.6;
}

export function goalPower(d: Dragon, goal: Goal): number {
  return dragonPower(d) * goalShare(d, goal);
}
