import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import type { SkillsByDragon } from "../engine/habitSynergy";

/** Every dragon's Command + Habit clauses, keyed by dragon name. `skills` is undefined while loading. */
export function useHabitSkills() {
  const rows = useQuery(api.habitCapabilities.listAll);
  const skills = useMemo(() => {
    if (!rows) return undefined;
    const out: SkillsByDragon = {};
    for (const { dragonName, ...skill } of rows) (out[dragonName] ??= []).push(skill);
    return out;
  }, [rows]);
  return { skills, loading: rows === undefined };
}
