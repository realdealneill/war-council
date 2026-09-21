import { useCallback, useState } from "react";
import type { Dragon } from "../types";

/**
 * In-memory only — resets on every reload. There's no roster-saving feature
 * yet, and localStorage snapshotted whole Dragon objects at add-time, so a
 * catalog fix (e.g. a corrected default star rank) couldn't reach anyone's
 * already-added dragons without them removing and re-adding. Once a real
 * save feature exists (almost certainly Convex-backed, per-user), it should
 * store just a roster's dragon ids/overrides and re-join against the live
 * catalog on load — not a frozen copy like this used to be.
 */
export function useRoster() {
  const [roster, setRoster] = useState<Dragon[]>([]);

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
