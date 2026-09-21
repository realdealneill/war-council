import { useCallback, useEffect, useState } from "react";
import type { Dragon } from "../types";

const STORAGE_KEY = "dragonfire:roster";

function load(): Dragon[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Dragon[]) : [];
  } catch {
    return [];
  }
}

function save(roster: Dragon[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(roster));
  } catch {
    // localStorage unavailable (private browsing, quota) — roster just won't persist.
  }
}

/**
 * Local-only roster persistence, same storage model as the reference site's
 * offline mode. Swap this hook's internals for a Convex-backed one later
 * without touching callers — the return shape is the seam.
 */
export function useRoster() {
  const [roster, setRoster] = useState<Dragon[]>(() => load());

  useEffect(() => save(roster), [roster]);

  // One roster slot per species, keyed by name rather than id — the catalog's
  // id source has already changed once (local JSON -> Convex), and name is
  // the identity that actually survives that.
  const addDragon = useCallback((dragon: Dragon) => {
    setRoster((prev) => (prev.some((d) => d.name === dragon.name) ? prev : [...prev, dragon]));
  }, []);

  const addDragons = useCallback((dragons: Dragon[]) => {
    setRoster((prev) => {
      const existingNames = new Set(prev.map((d) => d.name));
      return [...prev, ...dragons.filter((d) => !existingNames.has(d.name))];
    });
  }, []);

  const updateDragon = useCallback((id: string, patch: Partial<Dragon>) => {
    setRoster((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  const removeDragon = useCallback((id: string) => {
    setRoster((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const clearRoster = useCallback(() => setRoster([]), []);

  const toggleActive = useCallback((id: string) => {
    setRoster((prev) => prev.map((d) => (d.id === id ? { ...d, active: d.active === false } : d)));
  }, []);

  return { roster, addDragon, addDragons, updateDragon, removeDragon, clearRoster, toggleActive };
}
