import { kitFor } from "../data";
import type { Dragon, DragonEffects, EffectId } from "../types";

const EMPTY: DragonEffects = { applies: [], grants: [], self: [], wants: [] };

/** Merged kit effects a dragon actually has at its current Star Rank. */
export function dragonEffects(d: Dragon | null | undefined): DragonEffects {
  if (!d) return EMPTY;
  const kit = kitFor(d.name);
  if (!kit) return EMPTY;
  const stars = Number(d.starRank) || 0;
  const out: DragonEffects = { applies: [], grants: [], self: [], wants: [] };
  for (const entry of kit.effects) {
    if (stars < entry.star) continue;
    (["applies", "grants", "self", "wants"] as const).forEach((k) => {
      for (const t of entry[k]) if (!out[k].includes(t)) out[k].push(t);
    });
  }
  return out;
}

export const CONTROL_EFFECTS: EffectId[] = ["stun", "overwhelm", "confusion"];

export const applies = (d: Dragon, e: EffectId) => dragonEffects(d).applies.includes(e);
export const grants = (d: Dragon, e: EffectId) => dragonEffects(d).grants.includes(e);
export const holds = (d: Dragon, e: EffectId) => grants(d, e) || dragonEffects(d).self.includes(e);

export function appliesControl(d: Dragon): boolean {
  return dragonEffects(d).applies.some((t) => CONTROL_EFFECTS.includes(t));
}

/** Can `source` supply the effect `want` to a teammate that needs it? */
export function supplies(source: Dragon, want: EffectId): boolean {
  if (want === "control") return appliesControl(source);
  // Moondancer's one named-breed need: only a Sentinel that deals Tactical
  // Damage or applies Recovery feeds his Rising Tide stacks.
  if (want === "sentinel") {
    return source.breed === "sentinel" && (source.damageType === "tactical" || grants(source, "recovery"));
  }
  return applies(source, want) || grants(source, want);
}

export function isDPS(d: Dragon): boolean {
  return d.role === "physical" || d.role === "tactical" || d.role === "fire";
}
