import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const affinityValue = v.union(v.literal("+"), v.literal("-"), v.literal(0));

// The 36-dragon catalog: species-level attributes shared by everyone, not a
// per-user roster entry (that stays in browser localStorage — see
// src/hooks/useRoster.ts). Seeded once from src/data/generated/dragons.json
// via the `seed` internal mutation in dragons.ts. Exported so dragons.ts can
// build matching return validators without repeating the field list.
export const dragonFields = {
  name: v.string(),
  rarity: v.union(v.literal("rare"), v.literal("epic"), v.literal("legendary"), v.literal("mythic")),
  breed: v.union(v.literal("champion"), v.literal("hunter"), v.literal("sentinel"), v.literal("warrior")),
  role: v.union(
    v.literal("tank"),
    v.literal("physical"),
    v.literal("tactical"),
    v.literal("fire"),
    v.literal("healer"),
    v.literal("control")
  ),
  damageType: v.union(v.literal("physical"), v.literal("tactical"), v.literal("fire"), v.literal("none")),
  notes: v.optional(v.string()),
  isNew: v.optional(v.boolean()),
  affinity: v.object({
    cavalry: affinityValue,
    shieldbearers: affinityValue,
    archers: affinityValue,
    spearmen: affinityValue,
    siege: affinityValue,
  }),
  // Base stats — not in the original reference data (it only ever tracked
  // flat kit bonuses to these, never the underlying number), filled in by
  // hand via the /admin/dragon-stats form as real in-game values are known.
  baseStrength: v.optional(v.number()),
  baseIntelligence: v.optional(v.number()),
  baseInstinct: v.optional(v.number()),
  baseInitiative: v.optional(v.number()),
};

// A percentage value per upgrade level (1-5), null where not yet filled in.
const pctByLevel = v.array(v.union(v.number(), v.null()));

// An optional condition on one percentage row: an effect that must be present
// on the target for the row to apply at all, and/or an effect that doubles
// it when active (the game mostly just doubles rather than using a distinct
// value — see src/admin/HabitBuilder.tsx). Keyed by row field name (e.g.
// "fireDmgReceivedPct") in `effectLinks` below, so adding a new percentage
// row never requires its own pair of schema fields for this.
export const effectLink = v.object({
  requiresEffect: v.optional(v.string()),
  buffedByEffect: v.optional(v.string()),
});

// Who an Ally modifiers habit targets — either a headcount (1-3 allies, the
// game seems to pick which ones by its own priority rules) or one specific
// lane. Neill wants these treated differently in the synergy engine later
// (a headcount is "some ally, unspecified", a lane is a guaranteed hit on
// whoever's placed there), so this is a discriminated union rather than one
// flat enum.
export const allyTarget = v.union(
  v.object({ kind: v.literal("count"), count: v.union(v.literal(1), v.literal(2), v.literal(3)) }),
  v.object({ kind: v.literal("lane"), lane: v.union(v.literal("left"), v.literal("right"), v.literal("vanguard")) })
);

// One chance-based "Effect RNG" entry — e.g. Antares Habit 1's real wording:
// "Rounds 1,3,6,8: 12.5% chance to Overwhelm 1 Enemy in any lane for 2
// rounds (prioritizes the Fire Damage dealers)". A single habit can hold
// several of these (that same habit also has a Stagger entry on rounds
// 2,4,7,9), so they live in the `rngEffects` array below rather than as
// fixed fields — unlike the flat percentage rows, there's no bounded set of
// them to name ahead of time. `target` reuses the same count-or-lane shape
// as `allyTarget` above (it applies to enemy debuffs the same way it does
// to ally buffs). Chance scales by habit level like the percentage rows do;
// rounds and duration don't (matches every real example seen so far).
export const rngEffectEntry = v.object({
  effect: v.optional(v.string()),
  direction: v.optional(v.union(v.literal("buff"), v.literal("debuff"))),
  target: v.optional(allyTarget),
  durationRounds: v.optional(v.number()),
  rounds: v.array(v.number()),
  chancePctByLevel: pctByLevel,
  notes: v.optional(v.string()),
});

// Structured, hand-entered capability data for one dragon's one habit slot
// (1-5) — filled in via /admin/habit-builder while reading the habit's real
// wording (src/data/generated/habits.json). Meant to grow: new percentage
// rows (or other fields) get added here over time as Neill decides what's
// worth capturing, the same way dragons' base stats grew incrementally.
export const habitCapabilityFields = {
  dragonId: v.id("dragons"),
  habitSlot: v.number(), // 1-5
  // Which of combat's rounds (1-10) this habit is actually active during.
  activeRounds: v.array(v.number()),
  // How many enemy dragons this habit's enemy-facing rows below apply to
  // (1-3) — one setting for the whole habit, not per level or per row.
  enemyTargetCount: v.optional(v.union(v.literal(1), v.literal(2), v.literal(3))),
  // Enemy-facing: how much this habit raises what the target enemy(s) receive,
  // or reduces their stats.
  fireDmgReceivedPct: v.optional(pctByLevel),
  tacticalDmgReceivedPct: v.optional(pctByLevel),
  physicalDmgReceivedPct: v.optional(pctByLevel),
  enemyStrengthReducedPct: v.optional(pctByLevel),
  enemyInitiativeReducedPct: v.optional(pctByLevel),
  enemyIntelligenceReducedPct: v.optional(pctByLevel),
  enemyInstinctReducedPct: v.optional(pctByLevel),
  // Self modifiers: this dragon's own damage-dealt/stat increases.
  selfTacticalIncreasePct: v.optional(pctByLevel),
  selfPhysicalIncreasePct: v.optional(pctByLevel),
  selfFireIncreasePct: v.optional(pctByLevel),
  selfStrengthIncreasePct: v.optional(pctByLevel),
  selfInitiativeIncreasePct: v.optional(pctByLevel),
  selfIntelligenceIncreasePct: v.optional(pctByLevel),
  selfInstinctIncreasePct: v.optional(pctByLevel),
  selfDamageReductionPct: v.optional(pctByLevel),
  // Ally modifiers: same shape as Self modifiers, but applied to teammate(s)
  // instead of this dragon. See `allyTarget` above for who it hits.
  allyTarget: v.optional(allyTarget),
  allyTacticalIncreasePct: v.optional(pctByLevel),
  allyPhysicalIncreasePct: v.optional(pctByLevel),
  allyFireIncreasePct: v.optional(pctByLevel),
  allyStrengthIncreasePct: v.optional(pctByLevel),
  allyInitiativeIncreasePct: v.optional(pctByLevel),
  allyIntelligenceIncreasePct: v.optional(pctByLevel),
  allyInstinctIncreasePct: v.optional(pctByLevel),
  allyDamageReductionPct: v.optional(pctByLevel),
  // Chance-based effect procs (Overwhelm/Stun/Burn/etc.) — see `rngEffectEntry` above.
  rngEffects: v.optional(v.array(rngEffectEntry)),
  // Per-row Requires Effect / Buffed by Effect, see `effectLink` above.
  effectLinks: v.optional(v.record(v.string(), effectLink)),
};

export default defineSchema({
  dragons: defineTable(dragonFields).index("by_name", ["name"]),
  habitCapabilities: defineTable(habitCapabilityFields).index("by_dragon_habit", ["dragonId", "habitSlot"]),
});
