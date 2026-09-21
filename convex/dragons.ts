import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { dragonFields } from "./schema";
import seedDragons from "../src/data/generated/dragons.json";

const dragonDoc = v.object({ ...dragonFields, _id: v.id("dragons"), _creationTime: v.number() });

// The catalog is a fixed ~36-species list, never user-generated, so a plain
// bounded read is intentional here (not paginated) — take() is just a safety
// cap in case it ever grows well past that.
export const list = query({
  args: {},
  returns: v.array(dragonDoc),
  handler: async (ctx) => ctx.db.query("dragons").take(200),
});

// One-time migration from the reference-site data this app started from
// (see reference/dragonfire-formations-site). Idempotent — does nothing if
// the table already has rows. Run with: npx convex run dragons:seed
export const seed = internalMutation({
  args: {},
  returns: v.object({ inserted: v.number(), skipped: v.boolean() }),
  handler: async (ctx) => {
    const existing = await ctx.db.query("dragons").take(1);
    if (existing.length > 0) return { inserted: 0, skipped: true };

    let inserted = 0;
    for (const d of seedDragons as Array<{
      name: string;
      rarity: "rare" | "epic" | "legendary" | "mythic";
      breed: "champion" | "hunter" | "sentinel" | "warrior";
      role: "tank" | "physical" | "tactical" | "fire" | "healer" | "control";
      damageType: "physical" | "tactical" | "fire" | "none";
      notes?: string;
      isNew?: boolean;
      affinity: Record<"cavalry" | "shieldbearers" | "archers" | "spearmen" | "siege", "+" | "-" | 0>;
    }>) {
      await ctx.db.insert("dragons", {
        name: d.name,
        rarity: d.rarity,
        breed: d.breed,
        role: d.role,
        damageType: d.damageType,
        notes: d.notes,
        isNew: d.isNew,
        affinity: d.affinity,
      });
      inserted++;
    }
    return { inserted, skipped: false };
  },
});

// Used by the dense stat-entry form at /admin/dragon-stats — patches just
// the base-stat fields that were actually edited.
export const updateStats = mutation({
  args: {
    id: v.id("dragons"),
    baseStrength: v.optional(v.number()),
    baseIntelligence: v.optional(v.number()),
    baseInstinct: v.optional(v.number()),
    baseInitiative: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { id, ...patch }) => {
    await ctx.db.patch(id, patch);
    return null;
  },
});
