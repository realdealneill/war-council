// Ranks candidates for a flank slot next to a chosen Vanguard, by how well
// they use that Vanguard's OWN flank buff — e.g. a +16% Tactical Damage
// flank buff should surface Tactical dealers first, not just the biggest
// numbers regardless of fit.
import { kitFor } from "../data";
import { NON_SIEGE_TROOP_OPTIONS } from "./constants";
import { dragonPower } from "./power";
import { bestArmy } from "./scoring";
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
  /**
   * Synergy bonus (fraction over base power, e.g. 0.18 = +18%) for just
   * vanguard + this candidate. The Vanguard is fixed from the moment it's
   * chosen, so this is always computable — it's what you see while making
   * the very first flank pick, before the other flank exists at all.
   */
  vanguardSynergyPct: number;
  /**
   * Synergy bonus for the full trio — vanguard + this candidate + whatever
   * is in the other flank — at its best troop type. Null until the other
   * flank is actually picked: there's nothing to compute a joint synergy
   * with yet, so it's left blank rather than showing vanguardSynergyPct
   * again under a misleading label.
   */
  totalSynergyPct: number | null;
}

/** Synergy (%) of vanguard + candidate (in `flank`) alone. */
function synergyWithVanguard(vanguard: Dragon, candidate: Dragon, flank: Slot): number {
  const locks: Partial<Record<Slot, Dragon>> = { vanguard, [flank]: candidate };
  return bestArmy([vanguard, candidate], NON_SIEGE_TROOP_OPTIONS, { goal: "balanced" }, locks).bonusPct;
}

/** Synergy (%) of vanguard + candidate (in `flank`) + otherFlankDragon (in the remaining flank), or null if otherFlankDragon isn't chosen yet. */
function synergyWithOtherFlank(vanguard: Dragon, candidate: Dragon, flank: Slot, otherFlankDragon: Dragon | null): number | null {
  if (!otherFlankDragon) return null;
  const otherFlank: Slot = flank === "left" ? "right" : "left";
  const locks: Partial<Record<Slot, Dragon>> = { vanguard, [flank]: candidate, [otherFlank]: otherFlankDragon };
  const ev = bestArmy([vanguard, candidate, otherFlankDragon], NON_SIEGE_TROOP_OPTIONS, { goal: "balanced" }, locks);
  return ev.bonusPct;
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
 * Rank `pool` for the given flank next to `vanguard` (and, once it's
 * chosen, whatever's in the other flank). On the flank the Vanguard's own
 * skill buffs, dragons whose damage type matches that buff are ranked
 * first (they're the ones who actually cash it in); everyone else follows.
 * Within each group, ranked by synergy — totalSynergyPct once the other
 * flank is picked, vanguardSynergyPct before that — then highest power,
 * then highest (known) base Instinct, then star rank.
 */
export function rankFlankCandidates(vanguard: Dragon, flank: Slot, pool: Dragon[], otherFlankDragon: Dragon | null): FlankCandidate[] {
  const reqType = isBuffedFlank(vanguard.name, flank) ? flankDamageType(vanguard.name) : null;
  return pool
    .map((dragon) => ({
      dragon,
      fits: reqType ? dragon.damageType === reqType : true,
      vanguardSynergyPct: synergyWithVanguard(vanguard, dragon, flank),
      totalSynergyPct: synergyWithOtherFlank(vanguard, dragon, flank, otherFlankDragon),
    }))
    .sort((a, b) => {
      if (a.fits !== b.fits) return a.fits ? -1 : 1;
      const sa = a.totalSynergyPct ?? a.vanguardSynergyPct;
      const sb = b.totalSynergyPct ?? b.vanguardSynergyPct;
      if (sb !== sa) return sb - sa;
      return compareCandidates(a.dragon, b.dragon);
    });
}
