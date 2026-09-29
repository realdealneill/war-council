import * as React from "react";
import type { DamageType, Dragon, FormationEvaluation, HabitLink, Placement, Slot, VanguardSkill } from "./types";
import { DamageChip, RoleChip } from "./Chips";
import { DragonImage } from "./DragonArt";
import { Icon } from "./Icon";
import { DAMAGE_LABEL, SLOT_LABEL, cx, fmtInt, fmtPct, rarityInk, rarityVar } from "./format";

export interface FormationBoardProps {
  placement: Placement;
  vanguardSkill: VanguardSkill | null;
  flankDamage: DamageType | null;
  /** Habit links to draw as arrows between lanes (usually the focused evaluation's). */
  evaluation?: FormationEvaluation | null;
  /** Lanes shown as a preview (not placed yet) — drawn ghosted. */
  previewSlots?: Slot[];
  /** Index into evaluation.habitLinks to emphasise. */
  highlight?: number | null;
  activeLane?: Slot | null;
  onLaneClick?: (slot: Slot) => void;
  onClear?: (slot: Slot) => void;
  onShowSkills?: (d: Dragon) => void;
}

const SLOTS: Slot[] = ["left", "vanguard", "right"];
const TOP = 76;
const BOTTOM = 76;

interface Edge { from: number; to: number; pct: number; links: number[] }

function edgesFor(links: HabitLink[], placement: Placement): { edges: Edge[]; selfPct: Record<number, number> } {
  const idx = (name: string) => SLOTS.findIndex((s) => placement[s]?.name === name);
  const map = new Map<string, Edge>();
  const selfPct: Record<number, number> = {};
  links.forEach((l, li) => {
    const f = idx(l.source);
    if (f < 0) return;
    const rs = l.recipients.filter((r) => r !== "(self)");
    if (!rs.length) {
      selfPct[f] = (selfPct[f] ?? 0) + l.pct;
      return;
    }
    for (const r of rs) {
      const t = idx(r);
      if (t < 0 || t === f) continue;
      const k = `${f}-${t}`;
      const e = map.get(k) ?? { from: f, to: t, pct: 0, links: [] };
      e.pct += l.pct / rs.length;
      e.links.push(li);
      map.set(k, e);
    }
  });
  return { edges: [...map.values()], selfPct };
}

function LinkArrows({ width, height, edges, highlightLinks }: { width: number; height: number; edges: Edge[]; highlightLinks: Set<number> | null }) {
  const gap = 16;
  const colW = (width - 2 * gap) / 3;
  const cxOf = (i: number) => colW * (i + 0.5) + gap * i;
  const off = (i: number, other: number, far: boolean) => (other > i ? 1 : -1) * (far ? 30 : 12);
  return (
    <svg className="pointer-events-none absolute inset-0 hidden md:block" width={width} height={height} aria-hidden="true">
      <defs>
        <marker id="df-arrow" viewBox="0 0 8 8" refX="5" refY="4" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M0 0 8 4 0 8z" fill="var(--habit)" />
        </marker>
      </defs>
      {edges
        .slice()
        .sort((a, b) => a.pct - b.pct)
        .map((e) => {
          const far = Math.abs(e.from - e.to) === 2;
          const above = e.to > e.from;
          const x1 = cxOf(e.from) + off(e.from, e.to, far);
          const x2 = cxOf(e.to) + off(e.to, e.from, far);
          const y = above ? TOP + 2 : height - BOTTOM - 2;
          const lift = (far ? 104 : 40) * (above ? -1 : 1);
          const cyc = y + lift;
          const midY = (y + 2 * cyc + y) / 4;
          const midX = (x1 + x2) / 2;
          const sw = Math.max(1.5, Math.min(9, 1.2 + e.pct * 95));
          const on = !highlightLinks || e.links.some((l) => highlightLinks.has(l));
          return (
            <g key={`${e.from}-${e.to}`} opacity={on ? 1 : 0.15} style={{ transition: "opacity 150ms" }}>
              <path d={`M${x1} ${y} Q${midX} ${cyc} ${x2} ${y}`} fill="none" stroke="var(--habit)" strokeOpacity={0.85} strokeWidth={sw} strokeLinecap="round" markerEnd="url(#df-arrow)" />
              <g transform={`translate(${midX} ${midY})`}>
                <rect x={-26} y={-10} width={52} height={20} rx={10} fill="var(--bg)" stroke="var(--habit)" strokeOpacity={0.5} />
                <text textAnchor="middle" y={4} fontSize={11} fontWeight={600} fill="var(--habit)" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {fmtPct(e.pct)}
                </text>
              </g>
            </g>
          );
        })}
    </svg>
  );
}

function LaneCard({
  slot, dragon, preview, vanguard, skill, flankDamage, selfPct, active, onClick, onClear, onShowSkills,
}: {
  slot: Slot; dragon: Dragon | null; preview: boolean; vanguard: Dragon | null; skill: VanguardSkill | null; flankDamage: DamageType | null;
  selfPct?: number; active?: boolean; onClick?: () => void; onClear?: () => void; onShowSkills?: () => void;
}) {
  const buffed = !!skill && slot === skill.flankPos;
  const fits = buffed && dragon ? flankDamage === null || flankDamage === dragon.damageType : null;
  const buffTag = buffed && vanguard && (
    <div
      className={cx(
        "flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium",
        fits === false ? "bg-neg/12 text-neg" : fits ? "bg-pos/12 text-pos" : "bg-surface-hover text-ink-muted",
      )}
    >
      <Icon name={fits === false ? "alert" : fits ? "check" : "arrow"} size={11} className={cx(fits === null && slot === "left" && "rotate-180")} />
      {fits === null && (
        <span>
          Buffed by {vanguard.name}
          {flankDamage && <>: favors <span style={{ color: `var(--dmg-${flankDamage})` }}>{DAMAGE_LABEL[flankDamage]}</span> dealers</>}
        </span>
      )}
      {fits === true && <span>Uses {skill!.flankText}</span>}
      {fits === false && <span>{skill!.flankText} wasted — deals {DAMAGE_LABEL[dragon!.damageType]}</span>}
    </div>
  );
  return (
    <div className="relative min-w-0">
      <div className="pointer-events-none absolute left-2 top-2 z-10 flex items-center gap-1">
        <span className={cx("rounded-sm bg-bg/85 px-1.5 py-0.5 font-display text-[11px] font-semibold uppercase tracking-[0.12em] backdrop-blur", slot === "vanguard" ? "text-ink" : "text-ink-muted")}>{SLOT_LABEL[slot]}</span>
        {preview && dragon && <span className="rounded-sm border border-dashed border-line-strong bg-bg/85 px-1 text-[10px] uppercase tracking-wide text-ink-faint">Preview</span>}
      </div>
      {dragon ? (
        <div
          className={cx(
            "group relative flex min-h-[236px] h-full flex-col overflow-hidden rounded-lg border bg-surface-raised max-md:h-auto max-md:min-h-0 max-md:flex-row",
            preview && "border-dashed opacity-80",
            active && "ring-2 ring-focus",
          )}
          style={{ borderColor: preview ? "var(--line-strong)" : `color-mix(in srgb, ${rarityVar(dragon.rarity)} 55%, var(--line))` }}
        >
          <button onClick={onClick} className="relative h-[124px] shrink-0 cursor-pointer max-md:h-auto max-md:w-[120px]" aria-label={`Change ${SLOT_LABEL[slot]}`}>
            <div className="absolute inset-x-4 bottom-2 h-6 rounded-[50%] blur-md" style={{ background: `color-mix(in srgb, ${rarityVar(dragon.rarity)} 45%, transparent)` }} />
            <DragonImage dragon={dragon} kind="fullbody" className="relative size-full max-md:min-h-[96px]" imgClass="scale-[1.35] object-center" />
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-3 pb-3 pt-1.5 max-md:py-2.5 max-md:pr-8">
            <div className="flex items-baseline justify-between gap-2">
              <button onClick={onShowSkills} className="truncate font-display text-lg font-semibold leading-6 hover:underline cursor-pointer" style={{ color: rarityInk(dragon.rarity) }}>
                {dragon.name}
              </button>
              <span className="tnum text-xs text-ink-muted">{fmtInt(dragon.power)}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              <RoleChip role={dragon.role} short />
              <DamageChip type={dragon.damageType} />
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-1">
              {buffTag}
              {!!selfPct && (
                <span className="inline-flex items-center gap-1 rounded-sm bg-habit/12 px-1.5 py-0.5 text-[11px] text-habit" title="Self clauses set up by teammates">
                  <Icon name="loop" size={11} /> {fmtPct(selfPct)} set-up
                </span>
              )}
            </div>
          </div>
          {onClear && !preview && slot !== "vanguard" && (
            <button onClick={onClear} className="absolute right-1.5 top-1.5 rounded-sm bg-bg/80 p-1 text-ink-muted opacity-0 transition group-hover:opacity-100 hover:text-ink focus:opacity-100 cursor-pointer max-md:opacity-100" aria-label={`Clear ${SLOT_LABEL[slot]}`}>
              <Icon name="x" size={12} />
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={onClick}
          className={cx(
            "flex h-[236px] w-full flex-col items-center justify-center gap-2 rounded-lg pt-6 border border-dashed border-line-strong bg-surface-sunken px-3 text-center transition hover:bg-surface-hover cursor-pointer max-md:h-24",
            active && "ring-2 ring-focus",
          )}
        >
          <span className="flex size-9 items-center justify-center rounded-full border border-line-strong text-ink-muted"><Icon name="plus" /></span>
          <span className="text-sm font-medium text-ink">Pick {SLOT_LABEL[slot]}</span>
          {buffTag}
        </button>
      )}
    </div>
  );
}

/** The 3 lanes left → right, with habit-synergy arrows between them (thickness = %). */
export function FormationBoard({ placement, vanguardSkill, flankDamage, evaluation, previewSlots = [], highlight = null, activeLane, onLaneClick, onClear, onShowSkills }: FormationBoardProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const links = evaluation?.habitLinks ?? [];
  const { edges, selfPct } = React.useMemo(() => edgesFor(links, placement), [links, placement]);
  const hl = highlight === null || highlight === undefined ? null : new Set([highlight]);
  return (
    <div ref={ref} className="relative md:pt-[76px] md:pb-[76px]">
      {size.w > 0 && <LinkArrows width={size.w} height={size.h} edges={edges} highlightLinks={hl} />}
      <div className="relative grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        {SLOTS.map((s, i) => (
          <LaneCard
            key={s}
            slot={s}
            dragon={placement[s]}
            preview={previewSlots.includes(s)}
            vanguard={placement.vanguard}
            skill={vanguardSkill}
            flankDamage={flankDamage}
            selfPct={selfPct[i]}
            active={activeLane === s}
            onClick={() => onLaneClick?.(s)}
            onClear={onClear ? () => onClear(s) : undefined}
            onShowSkills={placement[s] ? () => onShowSkills?.(placement[s]!) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/** Legend for the board's arrows — place it in the panel header. */
export function LinkLegend() {
  return (
    <div className="hidden items-center gap-3 text-[11px] text-ink-faint @[720px]:flex">
      <span className="inline-flex items-center gap-1.5"><span className="h-[3px] w-5 rounded-full bg-habit" /> habit synergy, source → recipient</span>
      <span>arcs above point right, below point left · width = % est.</span>
    </div>
  );
}
