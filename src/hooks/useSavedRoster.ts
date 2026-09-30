import * as React from "react";

// The player's roster edits, kept in this browser's localStorage so they
// survive a refresh. Only ids and overrides are stored, never Dragon copies,
// so catalog edits (base stats, art, new dragons) still flow through.
// Storage can be missing or blocked (private windows, cleared site data): the
// roster then just starts fresh.

/** One dragon's edits. habitLevels: 5 slots, null = locked / switched off; absent = the habits its star rank unlocks, at the Habit level control. */
export interface RosterOverride {
  starRank?: number;
  active?: boolean;
  habitLevels?: (number | null)[];
}

export interface SavedRoster {
  /** Catalog dragons taken out of the roster. Everything else is in it. */
  removed: Set<string>;
  overrides: Record<string, RosterOverride>;
}

const KEY = "dragonfire.roster.v1";

function clean(o: unknown): RosterOverride {
  const r = (o ?? {}) as Record<string, unknown>;
  const out: RosterOverride = {};
  if (typeof r.starRank === "number" && r.starRank >= 1 && r.starRank <= 10) out.starRank = Math.round(r.starRank);
  if (typeof r.active === "boolean") out.active = r.active;
  if (Array.isArray(r.habitLevels) && r.habitLevels.length === 5)
    out.habitLevels = r.habitLevels.map((l) => (typeof l === "number" && l >= 1 && l <= 5 ? Math.round(l) : null));
  return out;
}

function load(): SavedRoster {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { removed: new Set(), overrides: {} };
    const data = JSON.parse(raw) as { removed?: unknown; overrides?: unknown };
    const removed = new Set(Array.isArray(data.removed) ? data.removed.filter((x): x is string => typeof x === "string") : []);
    const overrides: Record<string, RosterOverride> = {};
    if (data.overrides && typeof data.overrides === "object")
      for (const [id, o] of Object.entries(data.overrides)) {
        const c = clean(o);
        if (Object.keys(c).length) overrides[id] = c;
      }
    return { removed, overrides };
  } catch {
    return { removed: new Set(), overrides: {} };
  }
}

export function useSavedRoster() {
  const [initial] = React.useState(load);
  const [removed, setRemoved] = React.useState<Set<string>>(initial.removed);
  const [overrides, setOverrides] = React.useState<Record<string, RosterOverride>>(initial.overrides);
  React.useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ removed: [...removed], overrides }));
    } catch {
      // Storage full or blocked: the roster still works for this visit.
    }
  }, [removed, overrides]);
  return { removed, setRemoved, overrides, setOverrides };
}
