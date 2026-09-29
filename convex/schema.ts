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

// A value per upgrade level (1-5), null where not yet filled in. A Command
// has no levels, so its clauses repeat the same value 5 times.
const levels = v.array(v.union(v.number(), v.null()));

const condition = v.object({
  // target | self | anyAlly | anyEnemy (value = an effect id), troop (archers…),
  // selfTroops | targetTroops (value like "<50"), stacks (value like "risingTide>=4"),
  // enemyComp, defending, pve
  scope: v.string(),
  value: v.string(),
});

const clauseTarget = v.object({
  side: v.union(v.literal("self"), v.literal("ally"), v.literal("enemy")),
  count: v.optional(v.union(v.literal(1), v.literal(2), v.literal(3))),
  // "N other allies" in the text — kept for fidelity; see src/engine/habitClauses.ts for how counts are scored
  other: v.optional(v.boolean()),
  scope: v.optional(v.union(v.literal("any"), v.literal("adjacent"), v.literal("sameLane"))),
  // lane:left | highest:intelligence | lowest:instinct | mostTroops | leastTroops |
  // dealsDamage:fire | breed:sentinel | prey | … — a priority unless `filter` is set
  prefer: v.optional(v.string()),
  filter: v.optional(v.boolean()),
});

const timing = v.object({
  mode: v.union(
    v.literal("combat"),
    v.literal("each"),
    v.literal("odd"),
    v.literal("even"),
    v.literal("rounds"),
    v.literal("event")
  ),
  rounds: v.optional(v.array(v.number())),
  event: v.optional(v.string()),
});

const duration = v.union(v.number(), v.literal("combat"), v.literal("round"));

// A condition that raises a clause's value/chance/duration/reach instead of gating it,
// e.g. "This chance is doubled (35%) against targets afflicted with Taunt".
const boost = v.object({
  condition: v.optional(condition),
  rounds: v.optional(v.array(v.number())),
  valueByLevel: v.optional(levels),
  chanceByLevel: v.optional(levels),
  multiplier: v.optional(v.number()),
  target: v.optional(clauseTarget),
  duration: v.optional(duration),
});

// One mechanic of a Command or Habit. Values are signed by real direction:
// negative lowers the thing (Damage Received -4 = takes 4% less).
export const clause = v.object({
  kind: v.union(
    v.literal("stat"),
    v.literal("dmgDealt"),
    v.literal("dmgRecv"),
    v.literal("recovDealt"),
    v.literal("recovRecv"),
    v.literal("hit"),
    v.literal("heal"),
    v.literal("effect"),
    v.literal("cleanse"),
    v.literal("cmd")
  ),
  // stat names, damage types ("physical(CH)" = Command & Habits only), or an effect id
  what: v.array(v.string()),
  target: v.optional(clauseTarget),
  timing,
  duration: v.optional(duration),
  valueByLevel: v.optional(levels),
  // omitted = guaranteed
  chanceByLevel: v.optional(levels),
  conditions: v.array(condition),
  boosts: v.array(boost),
  enhancedBy: v.optional(v.string()),
  // clauses on one skill sharing a rollGroup come from a single chance roll
  rollGroup: v.optional(v.number()),
  // the value applies once per stack held
  stack: v.optional(v.object({ max: v.number(), chanceByLevel: v.optional(levels) })),
  // why this clause can't be optimized for: enemyDep | situational | pve | nonCombat
  skip: v.optional(v.string()),
  // enemy types this clause pays off against, rolled up into a formation's "Best Against"
  bestAgainst: v.array(v.string()),
  note: v.optional(v.string()),
});

// A dragon's Command skill (habitSlot 0) or one of its 5 Habits (1-5),
// broken into structured clauses. Initially generated from the scraped
// Command/Habit text by scripts/habit-clauses/ and reviewed/edited via
// /admin/habit-builder. isCommandHabit flags a Habit that modifies or adds to
// the Command (typically the first habit and the ★6 one).
export const habitCapabilityFields = {
  dragonId: v.id("dragons"),
  habitSlot: v.number(),
  isCommandHabit: v.boolean(),
  clauses: v.array(clause),
};

export default defineSchema({
  dragons: defineTable(dragonFields).index("by_name", ["name"]),
  habitCapabilities: defineTable(habitCapabilityFields).index("by_dragon_habit", ["dragonId", "habitSlot"]),
});
