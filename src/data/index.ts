// Data ported from https://dragonfire-formations.com's js/data.js, js/kits.js
// and js/habits.js (see ../../reference/dragonfire-formations-site). Command
// skill, Vanguard skill and Habit wording are sourced from Dragonfire Hub
// (https://dragonfire-hub.com); Moondancer's kit was transcribed from
// in-game screenshots. Keep that attribution if this data is reused.
import dragonsJson from "./generated/dragons.json";
import kitsJson from "./generated/kits.json";
import modelJson from "./generated/model.json";
import type { Dragon, DragonKit } from "../types";

export const SEED_DRAGONS = dragonsJson as Dragon[];
export const DRAGON_KITS = kitsJson as Record<string, DragonKit>;
export const MODEL = modelJson as {
  TROOP_TYPES: { id: string; name: string; icon: string }[];
  TROOP_BEATS: Record<string, string[]>;
  POSITIONS: { id: string; name: string; short: string }[];
  RARITIES: { id: string; name: string; weight: number; color: string }[];
  DAMAGE_TYPES: { id: string; name: string }[];
  ROLES: { id: string; name: string; prefers: string }[];
  BREEDS: { id: string; name: string; archetype: string; desc: string; prefers: string }[];
  EFFECTS: { applies: Record<string, string>; grants: Record<string, string>; wants: Record<string, string> };
  CONTROL_EFFECTS: string[];
  HABIT_UNLOCK_STARS: number[];
  HABIT_MAX_LEVEL: number;
};

export function kitFor(name: string): DragonKit | null {
  return DRAGON_KITS[name] ?? null;
}
