import type { Dragon, Goal, Rarity } from "../types";
import { powerFromHabits } from "./powerFromHabits";
import { powerFromLevel } from "./powerFromLevel";
import { powerFromStars } from "./powerFromStars";

// The reference site's guessed power formula. Only a fallback now, for a
// dragon whose power is left blank (confirmedPower() below is the real one,
// and the builder sets it on every roster dragon).
export const RARITY_COEF: Record<Rarity, number> = { rare: 300, epic: 410, legendary: 540, mythic: 700 };

export function estimatePower(d: Dragon): number {
  const c = RARITY_COEF[d.rarity] ?? RARITY_COEF.rare;
  const star = 1 + 0.15 * (Number(d.starRank) || 1);
  const reign = Number(d.reignLevel) || 10;
  return Math.round((c * star * reign) / 10) * 10;
}

/**
 * A dragon's real total power from the confirmed tables: Power from Star
 * Rank + Power from Habits (each unlocked habit at its own level; null =
 * locked) + Power from Level (d.reignLevel, 1-50). Null when a rarity has
 * no data (mythic). Set it as `power` on a roster dragon so dragonPower()
 * uses it.
 */
export function confirmedPower(d: Dragon, habitLevels: (number | null)[]): number | null {
  const stars = powerFromStars(d.rarity, d.starRank);
  const habits = powerFromHabits(d.rarity, habitLevels.filter((l): l is number => l != null));
  const level = powerFromLevel(d.rarity, Number(d.reignLevel) || 1);
  return stars == null || habits == null || level == null ? null : stars + habits + level;
}

export function dragonPower(d: Dragon): number {
  const p = Number(d.power);
  return p && p > 0 ? p : estimatePower(d);
}

// "dps" leans on damage dealers, so survivability converts a bit less than
// it does for "balanced"/"synergy".
export const DEFENSE_WEIGHT: Record<Goal, number> = { balanced: 1, dps: 0.7, synergy: 1 };
