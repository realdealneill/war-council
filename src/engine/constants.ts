import { MODEL } from "../data";
import type { TroopType } from "../types";

// Siege troops lose the troop-advantage cycle to every other type, so they're
// not a real army composition outside a dedicated siege plan — off the table
// everywhere in this app.
export const NON_SIEGE_TROOP_OPTIONS = (MODEL.TROOP_TYPES.map((t) => t.id) as TroopType[]).filter((t) => t !== "siege");
