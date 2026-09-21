// Ranks candidates for a flank slot next to a chosen Vanguard, by how well
// they use that Vanguard's OWN flank buff — e.g. a +16% Tactical Damage
// flank buff should surface Tactical dealers first, not just the biggest
// numbers regardless of fit.
import { kitFor } from "../data";
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
  /** Deals the damage type this Vanguard's flank buff rewards (only meaningful on the buffed flank). */
  fits: boolean;
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

/**
 * Rank `pool` for the given flank next to `vanguard`. On the flank the
 * Vanguard's own skill buffs, dragons whose damage type matches that buff
 * are ranked first (they're the ones who actually cash it in); everyone
 * else follows. Within each group: highest power first, then highest
 * (known) base Instinct, then star rank.
 */
export function rankFlankCandidates(vanguard: Dragon, flank: Slot, pool: Dragon[]): FlankCandidate[] {
  const reqType = isBuffedFlank(vanguard.name, flank) ? flankDamageType(vanguard.name) : null;
  return pool
    .map((dragon) => ({ dragon, fits: reqType ? dragon.damageType === reqType : true }))
    .sort((a, b) => (a.fits !== b.fits ? (a.fits ? -1 : 1) : compareCandidates(a.dragon, b.dragon)));
}
