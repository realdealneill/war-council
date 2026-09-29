// Power contributed by Habits — CONFIRMED against Neill's real game client
// (2026-09-21), not a guess. Index 0 = habit level 1 ... index 4 = level 5.
//
// Each dragon has up to 5 habits, each independently leveled 1-5 once
// unlocked (see MODEL.HABIT_UNLOCK_STARS). Total power from habits is the
// sum of this table's value for EACH unlocked habit's own level — e.g. a
// legendary with 3 habits unlocked, all at level 3, gets 1500 x 3 = 4500,
// not a single lookup for "3 habits."
//
// Additive with powerFromStars.ts's Power-from-Star-Rank, same as that file.
// No mythic data exists yet (no mythic dragons exist in the game currently).
// Summed with Stars and Level by confirmedPower() in engine/power.ts.
import type { Rarity } from "../types";

export const POWER_FROM_HABIT_LEVEL: Partial<Record<Rarity, number[]>> = {
  legendary: [420, 920, 1500, 2200, 3100],
  epic: [340, 740, 1200, 1800, 2500],
  rare: [250, 550, 900, 1300, 1800],
};

/** Power from a single habit at `habitLevel` (1-5), or null if there's no data for that rarity. */
export function powerFromHabitLevel(rarity: Rarity, habitLevel: number): number | null {
  const table = POWER_FROM_HABIT_LEVEL[rarity];
  if (!table) return null;
  return table[habitLevel - 1] ?? null;
}

/** Total power from every currently-unlocked habit, each at its own level. Null if there's no data for that rarity. */
export function powerFromHabits(rarity: Rarity, unlockedHabitLevels: number[]): number | null {
  let total = 0;
  for (const lvl of unlockedHabitLevels) {
    const v = powerFromHabitLevel(rarity, lvl);
    if (v == null) return null;
    total += v;
  }
  return total;
}
