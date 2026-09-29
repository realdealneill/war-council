// Ranks candidates for a flank slot next to a chosen Vanguard (and, once
// it's picked, whatever's in the other flank) by the same blended score the
// pair recommendations use — base power × (1 + emphasis × synergy), where
// synergy is the Vanguard skill / troop / position bonuses plus habit
// synergy from the real Command/Habit clauses. See ./formation.ts.
import { kitFor } from "../data";
import { evaluateFormation, type FormationContext, type FormationEvaluation } from "./formation";
import { dragonPower } from "./power";
import type { DamageType, Dragon, Slot } from "../types";

/** The damage type a Vanguard's flank buff rewards, or null if it's not damage-type-specific. */
export function flankDamageType(vanguardName: string): DamageType | null {
  const kit = kitFor(vanguardName);
  if (!kit) return null;
  const dmg = kit.vanguard.flank.find((e) => e.kind === "damage");
  return (dmg?.type as DamageType | undefined) ?? null;
}

/** Is `flank` the one this Vanguard's kit actually buffs? */
export function isBuffedFlank(vanguardName: string, flank: Slot): boolean {
  return kitFor(vanguardName)?.vanguard.flankPos === flank;
}

export interface FlankCandidate {
  dragon: Dragon;
  /** Deals the damage type this Vanguard's flank buff rewards (only meaningful on the buffed flank). Display only — already priced into the score. */
  fits: boolean;
  /**
   * The formation this candidate would make: vanguard + candidate while the
   * other flank is empty, or the full trio once it's picked. Always
   * computable, so the very first flank pick is ranked too.
   */
  eval: FormationEvaluation;
  /** True when `eval` is the full trio (the other flank is picked). */
  isTrio: boolean;
}

function compareCandidates(a: Dragon, b: Dragon): number {
  const pa = dragonPower(a), pb = dragonPower(b);
  if (pb !== pa) return pb - pa;
  // Real base Instinct isn't filled in for every dragon yet (see
  // Dragon.baseInstinct) — star rank is the best stand-in until it is.
  const ia = a.baseInstinct, ib = b.baseInstinct;
  if (ia != null && ib != null && ib !== ia) return ib - ia;
  if (b.starRank !== a.starRank) return b.starRank - a.starRank;
  return a.name.localeCompare(b.name);
}

/** Rank `pool` for `flank` next to `vanguard` (+ `otherFlankDragon` once chosen), best first. */
export function rankFlankCandidates(
  vanguard: Dragon,
  flank: Slot,
  pool: Dragon[],
  otherFlankDragon: Dragon | null,
  ctx: FormationContext
): FlankCandidate[] {
  const reqType = isBuffedFlank(vanguard.name, flank) ? flankDamageType(vanguard.name) : null;
  const otherFlank: Slot = flank === "left" ? "right" : "left";
  return pool
    .map((dragon) => ({
      dragon,
      fits: reqType ? dragon.damageType === reqType : true,
      eval: evaluateFormation({ vanguard, [flank]: dragon, ...(otherFlankDragon ? { [otherFlank]: otherFlankDragon } : {}) }, ctx),
      isTrio: otherFlankDragon != null,
    }))
    .sort((a, b) => b.eval.rankScore - a.eval.rankScore || compareCandidates(a.dragon, b.dragon));
}
