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

export default defineSchema({
  dragons: defineTable(dragonFields).index("by_name", ["name"]),
});
