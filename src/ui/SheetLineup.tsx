import { troopLabel, type SheetLineupSearch } from "../engine/sheetRating";
import { Button } from "./Chips";
import { fmtInt } from "./format";

function n(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(v)) return "—";
  const p = 10 ** digits;
  const r = Math.round(v * p) / p;
  return Number.isInteger(r) ? fmtInt(r) : r.toFixed(digits);
}

const PLACE: Record<number, string> = {
  0: "Best",
  1: "Second — no dragon from the formation above",
  2: "Third — no dragon from either formation above",
};

/**
 * Landing-page preview of the best disjoint sheet-stat formations.
 * Does not change how a chosen Vanguard's flanks are ranked.
 */
export function SheetLineup({
  search,
  ms,
  running,
  stale,
  canRun,
  onCalculate,
  onUse,
}: {
  search: SheetLineupSearch | null;
  /** Milliseconds the last search took. Null before the first run. */
  ms: number | null;
  running: boolean;
  /** The roster or habit settings changed after the last run. */
  stale: boolean;
  canRun: boolean;
  onCalculate: () => void;
  onUse: (index: number) => void;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.08em] text-ink">Dev · Best sheet-stat formations</h2>
        <span className="text-[11px] text-ink-faint">{running ? "Calculating…" : ms == null ? "Not run" : `${fmtInt(ms)} ms`}</span>
      </div>
      <p className="mt-1 text-xs leading-5 text-ink-muted">
        Every left and right pairing around each recommended Vanguard (tank or champion). Each seating is scored under
        Cavalry, Shieldbearers, Archers, and Spearmen, and keeps the troop with the highest formation score. A dragon with
        + affinity for that troop gets +20% on all four stats before buffs. The first row is the highest score. Each row
        after that is the highest score that uses none of the dragons already listed. This runs only when you ask, so roster
        edits stay responsive.
        {search && ms != null && (
          <> {fmtInt(search.vanguardCount)} vanguards × {fmtInt(search.flankCount)} × {fmtInt(Math.max(0, search.flankCount - 1))} flank orders = {fmtInt(search.searched)} formations, each under {search.troopsTried} troops.</>
        )}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="sm" onClick={onCalculate} disabled={!canRun || running}>
          {running ? "Calculating…" : search ? "Recalculate" : "Calculate best formations"}
        </Button>
        {!canRun && <span className="text-xs text-ink-muted">Need habit data and at least three active dragons.</span>}
        {stale && !running && <span className="text-xs text-ink-muted">Roster or habits changed since this run.</span>}
      </div>
      {search && !running && search.ratings.length === 0 && (
        <p className="mt-3 text-xs text-ink-muted">Need at least one recommended Vanguard and two other active dragons.</p>
      )}
      {search && search.ratings.length > 0 && (
        <ol className="mt-3 space-y-2">
          {search.ratings.map((rating, i) => {
            const hit = search.hits[i];
            return (
              <li key={i} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface-sunken px-3 py-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">{PLACE[i] ?? `Pick ${i + 1}`}</div>
                  <div className="mt-0.5 text-sm text-ink">
                    {hit.left.name} <span className="text-ink-faint">·</span> {hit.vanguard.name} <span className="text-ink-faint">·</span> {hit.right.name}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-muted">
                    {troopLabel(rating.troop.troop)} · {rating.troop.seats.map((s) => `${s.name} ${s.boosted ? "+20%" : "no bonus"}`).join(", ")}
                  </div>
                  <div className="mt-0.5 text-xs tabular-nums text-ink-muted">
                    Formation {n(rating.fullScore)} · sheet {n(rating.sheetScore)} · teammates {rating.synergy >= 0 ? `+${n(rating.synergy)}` : n(rating.synergy)}
                    {" · "}sheet T {n(rating.sheetT)} · buffed T {n(rating.buffedT)}
                    {rating.index != null && <> · {n(rating.index * 100, 1)}% of ceiling</>}
                  </div>
                </div>
                <Button size="sm" onClick={() => onUse(i)}>Use this formation</Button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
