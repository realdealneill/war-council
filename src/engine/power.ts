import type { Dragon, Goal, Rarity } from "../types";

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

// "dps" leans on damage dealers, so survivability converts a bit less than
// it does for "balanced"/"synergy".
export const DEFENSE_WEIGHT: Record<Goal, number> = { balanced: 1, dps: 0.7, synergy: 1 };
