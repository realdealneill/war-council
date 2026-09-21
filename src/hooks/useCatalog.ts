import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Dragon, Rarity } from "../types";

// Defaults applied when a catalog dragon is copied into a roster — these
// are roster-instance fields (a specific copy's star rank, power, etc.),
// not species attributes, so they don't live in the Convex table.
// Brand-new releases (isNew) start at 1 star regardless of rarity — nobody's
// leveled them yet — otherwise rarity sets the starting star.
const DEFAULT_STAR_BY_RARITY: Record<Rarity, number> = { legendary: 3, epic: 3, rare: 2, mythic: 3 };
function defaultStarRank(rarity: Rarity, isNew: boolean | undefined): number {
  return isNew ? 1 : DEFAULT_STAR_BY_RARITY[rarity] ?? 2;
}

/** The shared 36-dragon catalog, loaded from Convex. `catalog` is [] while loading. */
export function useCatalog() {
  const rows = useQuery(api.dragons.list);

  const catalog: Dragon[] = (rows ?? []).map((r) => ({
    id: r._id,
    name: r.name,
    rarity: r.rarity,
    breed: r.breed,
    role: r.role,
    damageType: r.damageType,
    notes: r.notes,
    isNew: r.isNew,
    affinity: r.affinity,
    baseStrength: r.baseStrength,
    baseIntelligence: r.baseIntelligence,
    baseInstinct: r.baseInstinct,
    baseInitiative: r.baseInitiative,
    starRank: defaultStarRank(r.rarity, r.isNew),
    reignLevel: 15,
    power: 0,
    troopCapacity: 0,
    tags: [],
  }));

  return { catalog, loading: rows === undefined };
}
