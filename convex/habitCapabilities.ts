import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { habitCapabilityFields } from "./schema";

const habitCapabilityDoc = v.object({ ...habitCapabilityFields, _id: v.id("habitCapabilities"), _creationTime: v.number() });

export const listForDragon = query({
  args: { dragonId: v.id("dragons") },
  returns: v.array(habitCapabilityDoc),
  handler: async (ctx, { dragonId }) =>
    ctx.db
      .query("habitCapabilities")
      .withIndex("by_dragon_habit", (q) => q.eq("dragonId", dragonId))
      .collect(),
});

const pctByLevel = v.optional(v.array(v.union(v.number(), v.null())));

// Insert-or-patch for one (dragon, habit slot) — the row doesn't have to
// exist yet (a dragon's 5 habit slots aren't pre-seeded, only created the
// first time something is saved for them). Every field but the two key
// fields is optional so a caller can patch just one thing (e.g. one
// percentage row) without having to resend everything else.
export const upsert = mutation({
  args: {
    dragonId: v.id("dragons"),
    habitSlot: v.number(),
    activeRounds: v.optional(v.array(v.number())),
    // Enemy-facing
    enemyTargetCount: v.optional(v.union(v.literal(1), v.literal(2), v.literal(3))),
    fireDmgReceivedPct: pctByLevel,
    tacticalDmgReceivedPct: pctByLevel,
    physicalDmgReceivedPct: pctByLevel,
    enemyStrengthReducedPct: pctByLevel,
    enemyInitiativeReducedPct: pctByLevel,
    enemyIntelligenceReducedPct: pctByLevel,
    enemyInstinctReducedPct: pctByLevel,
    // Self modifiers
    selfTacticalIncreasePct: pctByLevel,
    selfPhysicalIncreasePct: pctByLevel,
    selfFireIncreasePct: pctByLevel,
    selfStrengthIncreasePct: pctByLevel,
    selfInitiativeIncreasePct: pctByLevel,
    selfIntelligenceIncreasePct: pctByLevel,
    selfInstinctIncreasePct: pctByLevel,
  },
  returns: v.null(),
  handler: async (ctx, { dragonId, habitSlot, ...patch }) => {
    const existing = await ctx.db
      .query("habitCapabilities")
      .withIndex("by_dragon_habit", (q) => q.eq("dragonId", dragonId).eq("habitSlot", habitSlot))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("habitCapabilities", { dragonId, habitSlot, activeRounds: [], ...patch });
    }
    return null;
  },
});
