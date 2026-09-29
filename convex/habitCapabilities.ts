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

// Every dragon's Commands + Habits at once, keyed by dragon name, for the
// formation engine (src/engine/habitSynergy.ts). Bounded like dragons.list:
// ~36 dragons × 6 skills, never user-generated.
export const listAll = query({
  args: {},
  returns: v.array(
    v.object({ dragonName: v.string(), habitSlot: v.number(), isCommandHabit: v.boolean(), clauses: v.array(clause) })
  ),
  handler: async (ctx) => {
    const dragons = await ctx.db.query("dragons").take(200);
    const names = new Map(dragons.map((d) => [d._id, d.name]));
    const skills = await ctx.db.query("habitCapabilities").take(2000);
    return skills.flatMap((s) => {
      const dragonName = names.get(s.dragonId);
      return dragonName ? [{ dragonName, habitSlot: s.habitSlot, isCommandHabit: s.isCommandHabit, clauses: s.clauses }] : [];
    });
  },
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
