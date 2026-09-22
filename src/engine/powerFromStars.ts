// Power contributed by Star Rank alone — CONFIRMED against Neill's real game
// client (2026-09-21), not a guess. Index 0 = ★1 ... index 9 = ★10.
//
// This is independent of Level and Habits (same as how the 4 base stats
// turned out to work) — it's its own additive bucket, not a multiplier on a
// rarity coefficient the way the old estimatePower() in power.ts treats it.
// That old formula is UNCHANGED and still what the live app uses for real
// army scoring; this table only feeds src/admin/DragonDetail.tsx's sandbox
// until Level and Habits are confirmed too and this is ready to replace it.
//
// Real values were fit with a cubic in star-rank per rarity (independently,
// not scaled from one another) and checked for a possible ★9/★10 "late star"
// jump the way the stats had — found none: a plain cubic already lands
// within rounding distance of every known ★9/★10 point. Gaps were filled
// from that same per-rarity cubic fit. No mythic data exists yet (there are
// no mythic dragons in the game currently).
import type { Rarity } from "../types";

export const POWER_FROM_STARS: Partial<Record<Rarity, number[]>> = {
  legendary: [1400, 3200, 5600, 8700, 13000, 18000, 25000, 33000, 43000, 55000],
  epic: [950, 2200, 3800, 5900, 8600, 12000, 17000, 23000, 30000, 40000],
  rare: [100, 1100, 2000, 3100, 4500, 6400, 8800, 12000, 16000, 21000],
};

// Which of the values above are the real numbers Neill read off his game
// client vs. filled in from the per-rarity cubic fit — for display only.
export const POWER_FROM_STARS_CONFIRMED: Partial<Record<Rarity, boolean[]>> = {
  legendary: [true, true, true, true, true, true, true, true, false, false], // ★9-10 estimated
  epic: [true, true, true, false, true, true, true, true, true, true], // ★4 estimated
  rare: [false, false, true, false, false, true, true, true, false, true], // ★1,2,4,5,9 estimated
};

/** Power from Star Rank alone, or null if there's no data for that rarity (mythic, currently). */
export function powerFromStars(rarity: Rarity, starRank: number): number | null {
  const table = POWER_FROM_STARS[rarity];
  if (!table) return null;
  const v = table[starRank - 1];
  return v ?? null;
}

export function isPowerFromStarsConfirmed(rarity: Rarity, starRank: number): boolean {
  return POWER_FROM_STARS_CONFIRMED[rarity]?.[starRank - 1] ?? false;
}
