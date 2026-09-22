// Power contributed by Level (1-50) — CONFIRMED at a handful of anchor
// points against Neill's real game client (2026-09-21), extrapolated for
// everything else. Independent of Star Rank and Habits, same as those.
//
// What's actually real: the level-50 cap for each rarity (rare 19,000 /
// epic 26,000 / legendary 33,000 — dragons stop gaining Level power there),
// and rare's own numbers at levels 41, 42, 46, 47, 48, 49 (all heavily
// rounded — the game rounds to the nearest 100 under 10,000 and nearest
// 1,000 above it, so e.g. 47 and 48 both display 18,000).
//
// A raw cubic (the shape that fit Power-from-Stars so well) is USELESS here
// — fit to just those 7 rare points it explodes past 1,000,000 by level 1.
// Instead this uses a bounded power-law anchored at the known cap:
//   power(level) = maxPower(rarity) * (level / 50) ^ LEVEL_EXPONENT
// LEVEL_EXPONENT (1.25) was fit to rare's 6 known tail points + the level-50
// cap (residuals land within ~500, i.e. within a rounding bucket, for all of
// them). Epic and Legendary reuse the same exponent, scaled to their own
// known cap — the same "same shape, scaled by a known endpoint" approach
// used for Power-from-Stars' epic/rare rows, since there's no other
// mid-range data for them at all. This is explicitly the least-confirmed of
// the three Power pieces — Neill called it "the least important thing" and
// fine to be a rough scale rather than exact.
import type { Rarity } from "../types";

export const LEVEL_EXPONENT = 1.25;
export const MAX_LEVEL = 50;

export const MAX_POWER_FROM_LEVEL: Partial<Record<Rarity, number>> = {
  rare: 19000,
  epic: 26000,
  legendary: 33000,
};

function roundGamePower(v: number): number {
  return v < 10000 ? Math.round(v / 100) * 100 : Math.round(v / 1000) * 1000;
}

/** Power from Level alone, or null if there's no known cap for that rarity (mythic, currently). */
export function powerFromLevel(rarity: Rarity, level: number): number | null {
  const max = MAX_POWER_FROM_LEVEL[rarity];
  if (!max) return null;
  const clamped = Math.min(Math.max(level, 1), MAX_LEVEL);
  return roundGamePower(max * (clamped / MAX_LEVEL) ** LEVEL_EXPONENT);
}

const CONFIRMED_RARE_LEVELS = new Set([41, 42, 46, 47, 48, 49]);

/** Real data point (confirmed) vs. this file's power-law extrapolation (estimated). */
export function isPowerFromLevelConfirmed(rarity: Rarity, level: number): boolean {
  if (level === MAX_LEVEL) return MAX_POWER_FROM_LEVEL[rarity] != null; // the cap itself is known for all 3 rarities
  return rarity === "rare" && CONFIRMED_RARE_LEVELS.has(level);
}
