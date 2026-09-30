// Runs a squad-draft search off the main thread (see useDraftWorker), so the
// page stays live and can draw a real progress bar. Everything it needs comes
// in the message as plain data: the habit loadout is a function on the page,
// so each dragon's resolved habit levels are sent instead.
import type { SkillsByDragon } from "./habitSynergy";
import { isRecommendedVanguard, searchDisjointSheetFormations, searchSheetFormationsWith, type SheetLineupSearch } from "./sheetRating";
import type { Dragon } from "../types";

export interface DraftRequest {
  pool: Dragon[];
  skills: SkillsByDragon;
  /** Each pool dragon's habit levels (5 slots, null = locked / off), by id. */
  habits: Record<string, (number | null)[]>;
  /** Draft around this dragon; null = the top disjoint squads. */
  focusId: string | null;
  take: number;
}

export type DraftMessage =
  | { type: "progress"; done: number; total: number }
  | { type: "done"; search: SheetLineupSearch; ms: number }
  | { type: "error"; message: string };

const NO_HABITS: (number | null)[] = [null, null, null, null, null];
const post = (m: DraftMessage) => (self as unknown as { postMessage(m: DraftMessage): void }).postMessage(m);

self.onmessage = (e: MessageEvent<DraftRequest>) => {
  const { pool, skills, habits, focusId, take } = e.data;
  try {
    const t0 = performance.now();
    const ctx = { skills, loadout: (d: Dragon) => habits[d.id] ?? NO_HABITS };
    const onProgress = (done: number, total: number) => post({ type: "progress", done, total });
    const focus = focusId ? pool.find((d) => d.id === focusId) : null;
    const search = focus
      ? searchSheetFormationsWith(pool, isRecommendedVanguard, ctx, focus, take, onProgress)
      : searchDisjointSheetFormations(pool, isRecommendedVanguard, ctx, take, onProgress);
    post({ type: "done", search, ms: Math.round(performance.now() - t0) });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
