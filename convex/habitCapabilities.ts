import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { clause, habitCapabilityFields } from "./schema";

const habitCapabilityDoc = v.object({ ...habitCapabilityFields, _id: v.id("habitCapabilities"), _creationTime: v.number() });

// A dragon's Command (habitSlot 0) and Habits (1-5).
export const listForDragon = query({
  args: { dragonId: v.id("dragons") },
  returns: v.array(habitCapabilityDoc),
  handler: async (ctx, { dragonId }) =>
    ctx.db
      .query("habitCapabilities")
      .withIndex("by_dragon_habit", (q) => q.eq("dragonId", dragonId))
      .collect(),
});

// Replaces one skill's whole clause list (the builder edits the list client-side).
export const save = mutation({
  args: {
    dragonId: v.id("dragons"),
    habitSlot: v.number(),
    isCommandHabit: v.optional(v.boolean()),
    clauses: v.optional(v.array(clause)),
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
      await ctx.db.insert("habitCapabilities", {
        dragonId,
        habitSlot,
        isCommandHabit: patch.isCommandHabit ?? false,
        clauses: patch.clauses ?? [],
      });
    }
    return null;
  },
});
