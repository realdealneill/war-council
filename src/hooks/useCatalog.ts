import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import type { Dragon, Rarity } from "../types";

// Defaults applied when a catalog dragon is copied into a roster — these
// are roster-instance fields (a specific copy's star rank, power, etc.),
// not species attributes, so they don't live in the Convex table. Every
// dragon defaults to the same star rank for its rarity — including the
// isNew ones (Sunfyre, Tairax, Vermithor, Starshower, Moondancer), which
// the reference site had defaulting to 1 star regardless of rarity. That
// gave them a lower starting power than their same-rarity peers for no
// real reason, so isNew no longer affects this.
const DEFAULT_STAR_BY_RARITY: Record<Rarity, number> = { legendary: 3, epic: 3, rare: 2, mythic: 3 };
function defaultStarRank(rarity: Rarity): number {
  return DEFAULT_STAR_BY_RARITY[rarity] ?? 2;
}

/** The shared 36-dragon catalog, loaded from Convex. `catalog` is [] while loading. */
export function useCatalog() {
  const rows = useQuery(api.dragons.list);

  // Memoized so every render doesn't hand out new Dragon objects — the
  // builder's recommendations and art lookups are memoized on identity.
  const catalog: Dragon[] = useMemo(() => (rows ?? []).map((r) => ({
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
    starRank: defaultStarRank(r.rarity),
    reignLevel: 15,
    power: 0,
    troopCapacity: 0,
    tags: [],
  })), [rows]);

  return { catalog, loading: rows === undefined };
}
