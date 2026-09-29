import * as React from "react";
import type { Dragon, FlankCandidate, PairRecommendation, Slot } from "./types";
import { Eyebrow, Pct, Segmented } from "./Chips";
import { DragonAvatar, DragonName } from "./DragonArt";
import { Icon } from "./Icon";
import { DAMAGE_LABEL, SLOT_LABEL, TROOP_LABEL, cx, fmtInt, fmtPct } from "./format";

// ---------------------------------------------------------------- shared helpers
/** Competition ranks ("=1") from rankScores already sorted high → low. */
export function tieRanks(scores: number[]) {
  const r = scores.map((s) => Math.round(s));
  return r.map((s) => {
    const rank = r.findIndex((x) => x === s) + 1;
    const tied = r.filter((x) => x === s).length > 1;
    return { rank, tied, tieCount: r.filter((x) => x === s).length };
  });
}

/** Remembers the order before the last emphasis change and returns rank deltas (+ = moved up). */
export function useRankDeltas(ids: string[], emphasis: number, resetKey: string) {
  const last = React.useRef<{ emphasis: number; resetKey: string; ranks: Map<string, number> } | null>(null);
  const [deltas, setDeltas] = React.useState<Map<string, number>>(new Map());
  const sig = ids.join(",");
  React.useEffect(() => {
    const ranks = new Map(ids.map((id, i) => [id, i]));
    const prev = last.current;
    if (prev && prev.resetKey === resetKey && prev.emphasis !== emphasis) {
      const d = new Map<string, number>();
      ids.forEach((id, i) => {
        const was = prev.ranks.get(id);
        d.set(id, was === undefined ? NaN : was - i);
      });
      setDeltas(d);
    } else if (!prev || prev.resetKey !== resetKey) {
      setDeltas(new Map());
    }
    last.current = { emphasis, resetKey, ranks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, emphasis, resetKey]);
  return deltas;
}

function Delta({ d }: { d?: number }) {
  if (d === undefined || d === 0) return <span className="w-7" />;
  if (Number.isNaN(d)) return <span className="w-7 text-[10px] font-semibold text-score">new</span>;
  return (
    <span className={cx("tnum inline-flex w-7 items-center text-[11px] font-semibold", d > 0 ? "text-pos" : "text-neg")} title={`${d > 0 ? "Up" : "Down"} ${Math.abs(d)} since the last emphasis change`}>
      <Icon name={d > 0 ? "up" : "down"} size={10} />
      {Math.abs(d)}
    </span>
  );
}

function RankCell({ rank, tied }: { rank: number; tied: boolean }) {
  return (
    <span className={cx("tnum text-sm font-semibold", rank === 1 ? "text-ink" : "text-ink-muted")} title={tied ? "Tied on rank score" : undefined}>
      {tied && "="}
      {rank}
    </span>
  );
}

// ---------------------------------------------------------------- pairs
export interface PairRecommendationsProps {
  vanguard: Dragon;
  pairs: PairRecommendation[]; // sorted, top N shown
  emphasis: number;
  selectedKey?: string | null;
  onPick: (p: PairRecommendation) => void;
  onHover?: (p: PairRecommendation | null) => void;
  /** How many formations tie at the top (at 0× usually dozens). */
  tiedTotal?: number;
}

export const pairKey = (p: { left: Dragon; right: Dragon }) => `${p.left.id}|${p.right.id}`;

/** Top (left, right) pairs for the Vanguard. Click fills both flanks; hover previews the breakdown. */
export function PairRecommendations({ vanguard, pairs, emphasis, selectedKey, onPick, onHover, tiedTotal }: PairRecommendationsProps) {
  const ranks = tieRanks(pairs.map((p) => p.eval.rankScore));
  const deltas = useRankDeltas(pairs.map(pairKey), emphasis, vanguard.id);
  const keys = new Map(pairs.map((p, i) => [pairKey(p), i]));
  return (
    <div className="@container">
      <div className="grid grid-cols-[18px_22px_minmax(0,1fr)_54px_60px] @[480px]:grid-cols-[22px_28px_minmax(0,1fr)_58px_58px_64px] items-center gap-x-2 border-b border-line pb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
        <span />
        <span>#</span>
        <span>Left · Right flank</span>
        <span className="hidden text-right @[480px]:block">Habits</span>
        <span className="text-right">Synergy</span>
        <span className="text-right">Score</span>
      </div>
      <ol>
        {pairs.map((p, i) => {
          const k = pairKey(p);
          const swapOf = keys.get(`${p.right.id}|${p.left.id}`);
          const swapped = swapOf !== undefined && swapOf < i ? pairs[swapOf] : null;
          return (
            <li key={k}>
              <button
                onClick={() => onPick(p)}
                onMouseEnter={() => onHover?.(p)}
                onMouseLeave={() => onHover?.(null)}
                onFocus={() => onHover?.(p)}
                onBlur={() => onHover?.(null)}
                className={cx(
                  "grid w-full grid-cols-[18px_22px_minmax(0,1fr)_54px_60px] @[480px]:grid-cols-[22px_28px_minmax(0,1fr)_58px_58px_64px] items-center gap-x-2 border-b border-line/60 py-2 text-left transition-colors cursor-pointer",
                  selectedKey === k ? "bg-score/10" : "hover:bg-surface-raised",
                )}
              >
                <Delta d={deltas.get(k)} />
                <RankCell rank={ranks[i].rank} tied={ranks[i].tied} />
                <span className="flex min-w-0 items-center gap-2">
                  <span className="hidden shrink-0 -space-x-1.5 @[420px]:flex">
                    <DragonAvatar dragon={p.left} size={26} />
                    <DragonAvatar dragon={vanguard} size={26} className="opacity-60" />
                    <DragonAvatar dragon={p.right} size={26} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px]">
                      <DragonName dragon={p.left} /> <span className="text-ink-faint">·</span> <DragonName dragon={p.right} />
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-ink-faint">
                      <Pct value={p.eval.habitPct} tone="habit" className="@[480px]:hidden" /><Icon name={p.eval.troopType} size={11} className="shrink-0" /> <span className="hidden @[380px]:inline">{TROOP_LABEL[p.eval.troopType]}</span>
                      {swapped ? (
                        <span className="truncate rounded-sm bg-neg/12 px-1 text-neg" title={`Same dragons as #${swapOf! + 1}, flanks swapped`}>
                          ↔ #{swapOf! + 1} flipped {fmtPct(p.eval.bonusPct - swapped.eval.bonusPct)}
                        </span>
                      ) : (
                        <span className="truncate">· struct. {fmtPct(p.eval.structuralPct)}</span>
                      )}
                    </span>
                  </span>
                </span>
                <Pct value={p.eval.habitPct} tone="habit" className="hidden text-right text-[13px] @[480px]:block" />
                <Pct value={p.eval.bonusPct} tone="muted" className="text-right text-[13px] font-medium !text-ink" />
                <span className="text-right">
                  <span className="tnum block text-[13px] font-semibold text-score">{fmtInt(p.eval.score)}</span>
                  {emphasis !== 1 && <span className="tnum block text-[10px] text-ink-faint" title="Rank score at current emphasis">rank {fmtInt(p.eval.rankScore)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {ranks[0]?.tied && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-ink-faint">
          <Icon name="info" size={12} className="mt-0.5 shrink-0" />
          {tiedTotal ?? ranks[0].tieCount} formations tie at {fmtInt(pairs[0].eval.rankScore)} rank score — at {emphasis.toFixed(2)}× only power counts. Ties are ordered by synergy.
        </p>
      )}
    </div>
  );
}

/** rankScore vs emphasis (0–3×) for the listed pairs — shows where orderings cross. */
export function EmphasisFan({ pairs, emphasis, highlightKey, onPickEmphasis }: { pairs: PairRecommendation[]; emphasis: number; highlightKey?: string | null; onPickEmphasis?: (e: number) => void }) {
  const W = 560, H = 150, PL = 44, PR = 96, PT = 8, PB = 18;
  const ys = pairs.flatMap((p) => [p.eval.basePower, p.eval.basePower * (1 + 3 * p.eval.bonusPct)]);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const x = (e: number) => PL + (e / 3) * (W - PL - PR);
  const y = (v: number) => PT + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - PT - PB);
  const ends = pairs.map((p) => ({ p, y: y(p.eval.basePower * (1 + 3 * p.eval.bonusPct)) }));
  // nudge end labels apart
  const sorted = [...ends].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) if (sorted[i].y - sorted[i - 1].y < 11) sorted[i].y = sorted[i - 1].y + 11;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[600px]" role="img" aria-label="Rank score of each pair as emphasis goes from 0 to 3">
      {[0, 1, 2, 3].map((e) => (
        <g key={e}>
          <line x1={x(e)} x2={x(e)} y1={PT} y2={H - PB} stroke="var(--line)" />
          <text x={x(e)} y={H - 4} textAnchor="middle" fontSize={10} fill="var(--ink-faint)">{e}×</text>
        </g>
      ))}
      <text x={PL - 6} y={y(hi) + 4} textAnchor="end" fontSize={10} fill="var(--ink-faint)" style={{ fontVariantNumeric: "tabular-nums" }}>{(hi / 1000).toFixed(0)}k</text>
      <text x={PL - 6} y={y(lo) + 4} textAnchor="end" fontSize={10} fill="var(--ink-faint)" style={{ fontVariantNumeric: "tabular-nums" }}>{(lo / 1000).toFixed(0)}k</text>
      <line x1={x(emphasis)} x2={x(emphasis)} y1={PT} y2={H - PB} stroke="var(--score)" strokeWidth={1.5} strokeDasharray="3 3" />
      {pairs.map((p, i) => {
        const k = pairKey(p);
        const on = !highlightKey || highlightKey === k;
        const y0 = y(p.eval.basePower), y3 = y(p.eval.basePower * (1 + 3 * p.eval.bonusPct));
        const yc = y(p.eval.basePower * (1 + emphasis * p.eval.bonusPct));
        return (
          <g key={k} opacity={on ? 1 : 0.25}>
            <line x1={x(0)} y1={y0} x2={x(3)} y2={y3} stroke="var(--score)" strokeOpacity={1 - i * 0.13} strokeWidth={i === 0 || highlightKey === k ? 2 : 1.25} />
            <circle cx={x(emphasis)} cy={yc} r={3} fill="var(--score)" />
          </g>
        );
      })}
      {sorted.map(({ p, y: ly }) => (
        <text key={pairKey(p)} x={x(3) + 6} y={ly + 3.5} fontSize={10} fill="var(--ink-muted)" opacity={!highlightKey || highlightKey === pairKey(p) ? 1 : 0.35}>
          {p.left.name.slice(0, 5)}·{p.right.name.slice(0, 5)}
        </text>
      ))}
      {onPickEmphasis && <rect x={PL} y={PT} width={W - PL - PR} height={H - PT - PB} fill="transparent" style={{ cursor: "ew-resize" }}
        onClick={(ev) => {
          const r = (ev.currentTarget as SVGRectElement).getBoundingClientRect();
          const e = Math.round((((ev.clientX - r.left) / r.width) * 3) * 4) / 4;
          onPickEmphasis(Math.max(0, Math.min(3, e)));
        }} />}
    </svg>
  );
}

// ---------------------------------------------------------------- flank candidates
export interface FlankCandidateListProps {
  lane: "left" | "right";
  vanguard: Dragon;
  other: Dragon | null;
  candidates: FlankCandidate[];
  emphasis: number;
  buffed: boolean;
  flankNeed: string | null; // damage type label the buff needs
  placedId?: string | null;
  onPick: (d: Dragon) => void;
  onHover?: (c: FlankCandidate | null) => void;
  maxHeight?: number;
}

const ROW = 46;

/** Every eligible dragon for one lane, ranked. Rows animate when the emphasis slider reorders them. */
export function FlankCandidateList({ lane, vanguard, other, candidates, emphasis, buffed, flankNeed, placedId, onPick, onHover, maxHeight = 460 }: FlankCandidateListProps) {
  const [filter, setFilter] = React.useState<"all" | "fits">("all");
  const list = filter === "fits" ? candidates.filter((c) => c.fits) : candidates;
  const ranks = tieRanks(list.map((c) => c.eval.rankScore));
  const deltas = useRankDeltas(list.map((c) => c.dragon.id), emphasis, `${vanguard.id}|${lane}|${other?.id ?? ""}|${filter}`);
  const isTrio = !!other;
  return (
    <div className="@container">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className={cx("inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-medium", isTrio ? "bg-score/12 text-score" : "bg-surface-hover text-ink-muted")}>
          <Icon name="link" size={12} />
          {isTrio ? <>Trio mode — scored with {vanguard.name} + {other!.name}</> : <>Pair mode — scored with {vanguard.name} only</>}
        </span>
        {buffed && (
          <Segmented
            label="Filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `All ${candidates.length}` },
              { value: "fits", label: <span className="inline-flex items-center gap-1"><Icon name="check" size={11} /> {flankNeed ?? "Fits"} ({candidates.filter((c) => c.fits).length})</span> },
            ]}
          />
        )}
      </div>
      <div className="grid grid-cols-[22px_minmax(0,1fr)_14px_54px_60px] @[500px]:grid-cols-[26px_28px_minmax(0,1fr)_18px_52px_54px_56px_62px] items-center gap-x-2 border-b border-line pb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
        <span className="hidden @[500px]:block" />
        <span>#</span>
        <span>Dragon</span>
        <span title={buffed ? `Deals ${flankNeed} damage — uses ${vanguard.name}'s flank buff` : "No Vanguard buff on this flank"}>{buffed ? "✓" : ""}</span>
        <span className="hidden text-right @[500px]:block">Power</span>
        <span className="hidden text-right @[500px]:block">Habits</span>
        <span className="text-right">Synergy</span>
        <span className="text-right">Score</span>
      </div>
      <div className="relative overflow-y-auto overscroll-contain" style={{ maxHeight }}>
        <div className="relative" style={{ height: list.length * ROW }}>
          {list.map((c, i) => {
            const placed = placedId === c.dragon.id;
            return (
              <button
                key={c.dragon.id}
                onClick={() => onPick(c.dragon)}
                onMouseEnter={() => onHover?.(c)}
                onMouseLeave={() => onHover?.(null)}
                className={cx(
                  "absolute inset-x-0 grid grid-cols-[22px_minmax(0,1fr)_14px_54px_60px] @[500px]:grid-cols-[26px_28px_minmax(0,1fr)_18px_52px_54px_56px_62px] items-center gap-x-2 border-b border-line/60 text-left transition-[transform,background-color] duration-500 ease-out cursor-pointer",
                  placed ? "bg-score/10" : "hover:bg-surface-raised",
                )}
                style={{ height: ROW, transform: `translateY(${i * ROW}px)` }}
              >
                <span className="hidden @[500px]:block"><Delta d={deltas.get(c.dragon.id)} /></span>
                <RankCell rank={ranks[i].rank} tied={ranks[i].tied} />
                <span className={cx("flex min-w-0 items-center gap-2", buffed && !c.fits && "opacity-55")}>
                  <DragonAvatar dragon={c.dragon} size={28} />
                  <span className="min-w-0">
                    <DragonName dragon={c.dragon} className="block truncate text-[13px]" />
                    <span className="flex items-center gap-1 text-[11px] text-ink-faint">
                      <Pct value={c.eval.habitPct} tone="habit" className="mr-1 @[500px]:hidden" />
                      <Icon name={c.dragon.role} size={11} /> {c.dragon.role === "tank" ? "Tank" : c.dragon.role === "healer" ? "Healer" : c.dragon.role === "control" ? "Control" : `${DAMAGE_LABEL[c.dragon.damageType]} DPS`}
                      {placed && <span className="ml-1 rounded-sm bg-score/20 px-1 text-score">placed</span>}
                    </span>
                  </span>
                </span>
                <span className={cx("text-center", c.fits ? "text-pos" : "text-ink-faint")}>
                  {buffed ? (c.fits ? <Icon name="check" size={13} className="inline" /> : <span className="text-[10px]">—</span>) : null}
                </span>
                <span className={cx("tnum hidden text-right text-[12px] text-ink-muted @[500px]:block", buffed && !c.fits && "opacity-60")}>{fmtInt(c.dragon.power)}</span>
                <Pct value={c.eval.habitPct} tone="habit" className={cx("hidden text-right text-[12px] @[500px]:block", buffed && !c.fits && "opacity-60")} />
                <Pct value={c.eval.bonusPct} tone="muted" className={cx("text-right text-[12px] !text-ink", buffed && !c.fits && "opacity-60")} />
                <span className="text-right">
                  <span className={cx("tnum block text-[13px] font-semibold text-score", buffed && !c.fits && "opacity-70")}>{fmtInt(c.eval.score)}</span>
                  {emphasis !== 1 && <span className="tnum block text-[10px] text-ink-faint">rank {fmtInt(c.eval.rankScore)}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">
        {SLOT_LABEL[lane]} · {list.length} eligible · sorted by rank score at {emphasis.toFixed(2)}× · Synergy = structural + habits, % of base power (est.)
      </p>
    </div>
  );
}

export function CandidateTabs({ lane, onLane, left, right, buffLane }: { lane: "left" | "right"; onLane: (l: "left" | "right") => void; left: Dragon | null; right: Dragon | null; buffLane: Slot | null }) {
  const T = ({ l, d }: { l: "left" | "right"; d: Dragon | null }) => (
    <button
      role="tab"
      aria-selected={lane === l}
      onClick={() => onLane(l)}
      className={cx("flex min-w-0 flex-1 flex-col items-start rounded-md px-3 py-1.5 text-left transition-colors cursor-pointer", lane === l ? "bg-surface-hover shadow-[inset_0_0_0_1px_var(--line-strong)]" : "hover:bg-surface-raised")}
    >
      <span className="flex items-center gap-1.5 font-display text-[12px] font-semibold uppercase tracking-[0.1em] text-ink">
        {SLOT_LABEL[l]} {buffLane === l && <span className="rounded-sm bg-surface-sunken px-1 font-sans text-[10px] normal-case tracking-normal text-ink-muted">VG buff</span>}
      </span>
      <span className="truncate text-[11px] text-ink-faint">{d ? <>placed: <DragonName dragon={d} /></> : "empty — pick one"}</span>
    </button>
  );
  return (
    <div role="tablist" className="flex gap-1 rounded-lg border border-line bg-surface-sunken p-1">
      <T l="left" d={left} />
      <T l="right" d={right} />
    </div>
  );
}

export { Eyebrow };
