// The squad draft (combat rating), ported from the design system's
// components/src/ui/SquadDraft.tsx. Fed by src/engine/sheetRating.ts through
// adapt.ts toSquadDraft(); a second rating beside the power score, never
// merged with it. Stat values can be null where a ★1 base isn't entered yet.
import * as React from "react";
import { STATS, STAT_LABEL } from "../engine/sheetRating";
import type { DamageType, DraftStatus, Dragon, Squad, SquadMember, StatKey, StatRow, TroopType } from "./types";
import { Button, Eyebrow, Segmented } from "./Chips";
import { DragonAvatar, DragonName } from "./DragonArt";
import { Icon } from "./Icon";
import { DAMAGE_LABEL, SLOT_LABEL, TROOP_LABEL, cx, nf } from "./format";

/** What each stat does, in player language (the jobs in sheetRating.ts). */
const STAT_EFFECT: Record<StatKey, { offense: DamageType | null; defense: string | null; note?: string }> = {
  strength: { offense: "physical", defense: null },
  instinct: { offense: "tactical", defense: "Physical taken" },
  intelligence: { offense: "fire", defense: "Tactical taken" },
  initiative: { offense: null, defense: "Fire taken", note: "turn order" },
};

const f1 = (n: number) => nf.format(Math.round(n * 10) / 10) + (Number.isInteger(Math.round(n * 10) / 10) ? ".0" : "");
const f1n = (n: number | null) => (n == null ? "—" : f1(n));
const plus = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + f1(Math.abs(n));
const SEAT_SHORT = { left: "Left", vanguard: "Vanguard", right: "Right" } as const;

function ago(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}
/** Durations as a player would say them. */
export function humanDuration(ms: number) {
  if (ms < 1500) return "about a second";
  if (ms < 60000) return `about ${Math.round(ms / 1000)} seconds`;
  return `about ${Math.round(ms / 60000)} min`;
}

// ---------------------------------------------------------------- troop bonus mark
/** Who received the +20%: the one-glance marker on every squad member. */
export function TroopBonusMark({ member, troop, size = "md" }: { member: Pick<SquadMember, "affinity" | "troopBonus">; troop: TroopType; size?: "sm" | "md" }) {
  const t = TROOP_LABEL[troop];
  if (member.troopBonus)
    return (
      <span title={`Likes ${t}: +20% on all four stats`} className={cx("inline-flex items-center gap-1 rounded-sm bg-pos/15 font-semibold text-pos tnum", size === "sm" ? "px-1 text-[10px]" : "px-1.5 py-0.5 text-[11px]")}>
        <Icon name="up" size={size === "sm" ? 9 : 11} /> +20%
      </span>
    );
  if (member.affinity === "-")
    return (
      <span title={`Dislikes ${t}: no bonus`} className={cx("inline-flex items-center gap-1 rounded-sm border border-neg/50 font-medium text-neg", size === "sm" ? "px-1 text-[10px]" : "px-1.5 py-0.5 text-[11px]")}>
        <Icon name="minus" size={size === "sm" ? 9 : 11} /> dislikes
      </span>
    );
  return (
    <span title={`Neutral to ${t}: no bonus`} className={cx("inline-flex items-center gap-1 rounded-sm border border-dashed border-line-strong text-ink-faint", size === "sm" ? "px-1 text-[10px]" : "px-1.5 py-0.5 text-[11px]")}>
      no bonus
    </span>
  );
}

// ---------------------------------------------------------------- T scale
/** 50 = an average dragon on this roster; 10 points = 1 SD. Buffed T runs high (the roster side has no buffs). */
export function TScale({ sheetT, buffedT }: { sheetT: number; buffedT: number }) {
  const lo = 30, hi = 110;
  const x = (v: number) => `${((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="relative h-7" aria-label={`Sheet T ${sheetT}, Buffed T ${buffedT}; 50 is roster average`}>
      <div className="absolute inset-x-0 top-2.5 h-1 rounded-full bg-surface-sunken ring-1 ring-line" />
      <div className="absolute top-2.5 h-1 rounded-full bg-habit/60" style={{ left: x(sheetT), width: `calc(${x(buffedT)} - ${x(sheetT)})` }} />
      {[50, 70, 90, 100].map((t) => (
        <span key={t} className="absolute top-1 h-3 w-px bg-line-strong" style={{ left: x(t) }}>
          <span className="absolute left-1/2 top-3.5 -translate-x-1/2 whitespace-nowrap text-[9px] text-ink-faint tnum">{t === 50 ? "50 avg" : t}</span>
        </span>
      ))}
      <span className="absolute top-1 size-3 -translate-x-1/2 rounded-full border-2 border-ink bg-surface" style={{ left: x(sheetT) }} title={`Sheet T ${sheetT}`} />
      <span className="absolute top-1 size-3 -translate-x-1/2 rounded-full bg-habit ring-2 ring-surface" style={{ left: x(buffedT) }} title={`Buffed T ${buffedT}`} />
    </div>
  );
}

/** sheet → own buffs → teammates, one bar. */
function BuildUp({ sq, max }: { sq: Pick<Squad, "sheet" | "ownBuffs" | "formation">; max: number }) {
  const w = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className="flex h-2.5 overflow-hidden rounded-sm bg-surface-sunken" aria-hidden="true">
      <div className="bg-base-bar" style={{ width: w(sq.sheet) }} />
      <div className="bg-structural" style={{ width: w(sq.ownBuffs - sq.sheet) }} />
      <div className="bg-habit" style={{ width: w(sq.formation - sq.ownBuffs) }} />
    </div>
  );
}

// ---------------------------------------------------------------- squad card
export interface SquadCardProps {
  squad: Squad;
  /** Scale for the build-up bar — the best squad's formation. */
  max: number;
  stale?: boolean;
  /** Ids no longer active in the roster (squad can't be fielded as is). */
  unavailable?: Set<string>;
  opened?: boolean;
  onOpen?: (s: Squad) => void;
  onDetails?: (s: Squad) => void;
}

export function SquadCard({ squad, max, stale, unavailable, opened, onOpen, onDetails }: SquadCardProps) {
  const boosted = squad.members.filter((m) => m.troopBonus).length;
  const missing = squad.members.filter((m) => unavailable?.has(m.dragon.id));
  return (
    <article className={cx("relative flex min-w-0 snap-start flex-col rounded-lg border bg-surface-raised", opened ? "border-pos/60" : "border-line", stale && "opacity-80")}>
      {stale && (
        <div className="absolute -top-2 right-3 rounded-sm border border-neg/60 bg-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neg">Out of date</div>
      )}
      <header className="flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md border border-line-strong font-display text-[13px] font-semibold text-ink">{squad.rank}</span>
            <span className="font-display text-[13px] font-semibold uppercase tracking-[0.1em] text-ink">Squad {squad.rank}</span>
            {opened && <span className="rounded-sm bg-pos/15 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-pos">In builder</span>}
          </div>
          <div className="mt-0.5 text-[11px] text-ink-faint">{squad.subtitle}</div>
        </div>
        <div className="text-right">
          <div className="tnum text-[22px] font-semibold leading-6 text-ink">{f1(squad.formation)}</div>
          <div className="whitespace-nowrap text-[10px] uppercase tracking-[0.08em] text-ink-faint">formation rating</div>
        </div>
      </header>

      {/* one troop, and who got the +20% */}
      <div className="mx-4 mt-3 flex items-center gap-2 rounded-md border border-line-strong bg-surface-sunken px-2.5 py-1.5">
        <Icon name={squad.troop} size={18} className="text-ink" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">{TROOP_LABEL[squad.troop]}</div>
          <div className="text-[11px] text-ink-muted"><span className={cx("tnum font-semibold", boosted ? "text-pos" : "text-ink-faint")}>{boosted} of 3</span> get +20% on all stats</div>
        </div>
        <span className="flex gap-0.5" aria-hidden="true">
          {squad.members.map((m) => (
            <span key={m.dragon.id} className={cx("h-4 w-1.5 rounded-full", m.troopBonus ? "bg-pos" : m.affinity === "-" ? "bg-neg/70" : "bg-line-strong")} />
          ))}
        </span>
      </div>

      {/* the three seats */}
      <ol className="mt-3 grid grid-cols-3 gap-1.5 px-4">
        {squad.members.map((m) => (
          <li key={m.dragon.id} className={cx("flex min-w-0 flex-col items-center gap-1 rounded-md px-1 py-2 text-center", m.slot === "vanguard" ? "bg-surface-hover" : "bg-surface", missing.includes(m) && "ring-1 ring-neg/70")}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">{SEAT_SHORT[m.slot]}</span>
            <DragonAvatar dragon={m.dragon} size={40} className={cx(missing.includes(m) && "opacity-40 grayscale")} />
            <DragonName dragon={m.dragon} className="max-w-full truncate text-[12.5px]" />
            {missing.includes(m) ? <span className="text-[10px] font-semibold text-neg">now benched</span> : <TroopBonusMark member={m} troop={squad.troop} size="sm" />}
          </li>
        ))}
      </ol>

      {/* where the rating comes from */}
      <div className="mt-3 px-4">
        <BuildUp sq={squad} max={max} />
        <div className="tnum mt-1 flex flex-wrap justify-between gap-x-2 text-[11px] text-ink-muted">
          <span><span className="text-ink-faint">sheet</span> {f1(squad.sheet)}</span>
          <span><span className="text-structural">own</span> {plus(squad.ownBuffs - squad.sheet)}</span>
          <span><span className="text-habit">teammates</span> {plus(squad.fromTeammates)}</span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-3 px-4">
        <div>
          <div className="tnum flex gap-3 whitespace-nowrap text-[11px] text-ink-muted" title="50 = an average dragon on this roster; 10 points = 1 SD">
            <span><span className="text-ink-faint">Sheet T</span> <span className="font-semibold text-ink">{squad.sheetT?.toFixed(1) ?? "—"}</span></span>
            <span><span className="text-ink-faint">Buffed T</span> <span className="font-semibold text-habit">{squad.buffedT?.toFixed(1) ?? "—"}</span></span>
          </div>
          {squad.sheetT != null && squad.buffedT != null ? (
            <TScale sheetT={squad.sheetT} buffedT={squad.buffedT} />
          ) : (
            <div className="h-7 pt-1.5 text-[10px] text-ink-faint">Needs ★1 base stats on 2+ roster dragons</div>
          )}
        </div>
        <div className="pb-2 text-right">
          <div className="tnum text-sm font-semibold text-ink">{squad.pctOfCeiling == null ? "—" : `${(squad.pctOfCeiling * 100).toFixed(1)}%`}</div>
          <div className="text-[10px] text-ink-faint">of ceiling</div>
        </div>
      </div>

      <footer className="mt-auto flex flex-wrap items-center gap-2 whitespace-nowrap border-t border-line px-4 py-2.5">
        <Button size="sm" variant="primary" disabled={!!missing.length || !onOpen} onClick={() => onOpen?.(squad)} title={missing.length ? `${missing.map((m) => m.dragon.name).join(", ")} is no longer active` : undefined}>
          {opened ? "Open again" : "Open in builder"} <Icon name="arrow" size={12} />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDetails?.(squad)}>Stat details</Button>
        {!!missing.length && <span className="ml-auto text-[11px] text-neg">{missing.map((m) => m.dragon.name).join(", ")} benched</span>}
      </footer>
    </article>
  );
}

// ---------------------------------------------------------------- panel (all states)
/** "top": the best squads with no dragon shared. "with": the best different trios that include one chosen dragon. */
export type DraftMode = "top" | "with";

export interface SquadDraftPanelProps {
  status: DraftStatus;
  /** The legal search space for the current roster and mode. */
  space: { vanguards: number; formations: number; troops: number };
  /** Expected run time from this browser's last run; null before the first one. */
  estimateMs: number | null;
  now: number;
  /** How many squads a run keeps. */
  take: number;
  mode: DraftMode;
  onMode: (m: DraftMode) => void;
  /** The dragon "with" mode drafts around, and the active dragons it can be. */
  focus: Dragon | null;
  focusOptions: Dragon[];
  onFocus: (id: string) => void;
  collapsed?: boolean;
  onToggle?: () => void;
  onRun: () => void;
  onCancel: () => void;
  onOpen: (s: Squad) => void;
  onDetails: (s: Squad) => void;
  openedRank?: number | null;
  unavailable?: Set<string>;
}

const COUNT_WORD = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const countWord = (n: number) => COUNT_WORD[n] ?? String(n);

function RunButton({ onRun, disabled, reason, label, variant = "primary" }: { onRun: () => void; disabled?: boolean; reason?: string; label: string; variant?: "primary" | "quiet" }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant={variant} onClick={onRun} disabled={disabled} aria-describedby={reason ? "draft-reason" : undefined}>
        <Icon name="roster" size={14} /> {label}
      </Button>
      {reason && <span id="draft-reason" className="flex items-center gap-1 text-[11px] text-ink-muted"><Icon name="lock" size={11} /> {reason}</span>}
    </div>
  );
}

/** Top-N or around-one-dragon, plus the dragon picker. */
function ModeBar({ mode, onMode, focus, focusOptions, onFocus, take, disabled }: Pick<SquadDraftPanelProps, "mode" | "onMode" | "focus" | "focusOptions" | "onFocus" | "take"> & { disabled?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
      <div className={cx(disabled && "pointer-events-none opacity-50")} aria-disabled={disabled || undefined}>
        <Segmented
          label="Draft mode"
          size="sm"
          value={mode}
          onChange={onMode}
          options={[
            { value: "top", label: `Top ${take} squads`, title: `${take} squads with no dragon shared` },
            { value: "with", label: "Around one dragon", title: `The ${take} best formations that include one dragon` },
          ]}
        />
      </div>
      {mode === "with" && (
        <label className="flex items-center gap-2 text-[12px] text-ink-muted">
          <span className="sr-only">Dragon to draft around</span>
          <select
            value={focus?.id ?? ""}
            onChange={(e) => onFocus(e.target.value)}
            disabled={disabled}
            className="h-7 min-w-[180px] cursor-pointer rounded-md border border-line-strong bg-surface-sunken px-2 text-[13px] text-ink"
          >
            <option value="" disabled>
              Pick a dragon…
            </option>
            {focusOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {RARITY_SHORT[d.rarity]} · ★{d.starRank}
              </option>
            ))}
          </select>
          {focus && <DragonAvatar dragon={focus} size={24} />}
        </label>
      )}
    </div>
  );
}
const RARITY_SHORT: Record<Dragon["rarity"], string> = { legendary: "Legendary", epic: "Epic", rare: "Rare", mythic: "Mythic" };

/** The squad draft, rated on combat stats beside the power score. Manual run only. */
export function SquadDraftPanel({ status, space, estimateMs, now, take, mode, onMode, focus, focusOptions, onFocus, collapsed, onToggle, onRun, onCancel, onOpen, onDetails, openedRank, unavailable }: SquadDraftPanelProps) {
  const draft = status.kind === "ready" || status.kind === "stale" ? status.draft : null;
  const stale = status.kind === "stale";
  const work = `${nf.format(space.formations)} formations × ${space.troops} troops`;
  const runLabel = mode === "top" ? `Draft ${take} squads` : focus ? `Draft around ${focus.name}` : "Draft around a dragon";
  const head = (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-3 pb-2">
      <div className="flex min-w-0 items-center gap-3">
        <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.08em] text-ink">Squad draft</h2>
        <span className="rounded-sm border border-line px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted" title="A separate rating built from the four combat stats. It does not replace the power score.">Combat rating<span className="hidden @[520px]:inline"> · separate from power score</span></span>
      </div>
      <div className="flex items-center gap-3">
        {draft && (
          <span className="tnum text-[11px] text-ink-faint">
            {draft.focus ? `Around ${draft.focus.name} · ` : ""}Drafted {ago(draft.ranAt, now)} · {nf.format(draft.formationsChecked)} formations checked · took {humanDuration(draft.ms)}
          </span>
        )}
        {draft && !collapsed && status.kind !== "running" && (
          <Button size="sm" variant={stale ? "primary" : "quiet"} onClick={onRun}>
            <Icon name="loop" size={13} /> {stale ? "Run again" : "Re-run"}
          </Button>
        )}
        {onToggle && draft && (
          <Button size="sm" variant="ghost" onClick={onToggle} aria-expanded={!collapsed}>
            {collapsed ? "Show squads" : "Hide"} <Icon name="chevron" size={12} className={cx(!collapsed && "rotate-180")} />
          </Button>
        )}
      </div>
    </header>
  );

  // collapsed summary row
  if (collapsed && draft) {
    return (
      <section className="rounded-lg border border-line bg-surface">
        {head}
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          {stale && <span className="rounded-sm border border-neg/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neg">Out of date</span>}
          {draft.squads.map((s) => (
            <button key={s.rank} onClick={() => onOpen(s)} className={cx("flex items-center gap-2 rounded-md border px-2 py-1 text-left hover:bg-surface-hover cursor-pointer", openedRank === s.rank ? "border-pos/60" : "border-line")}>
              <span className="font-display text-xs font-semibold text-ink">{s.rank}</span>
              <span className="flex -space-x-1">{s.members.map((m) => <DragonAvatar key={m.dragon.id} dragon={m.dragon} size={20} />)}</span>
              <Icon name={s.troop} size={12} className="text-ink-muted" />
              <span className="tnum text-xs font-semibold text-ink">{f1(s.formation)}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  const modeBar = <ModeBar mode={mode} onMode={onMode} focus={focus} focusOptions={focusOptions} onFocus={onFocus} take={take} disabled={status.kind === "running"} />;
  let body: React.ReactNode;
  if (status.kind === "idle" || status.kind === "blocked") {
    const blocked = status.kind === "blocked";
    body = (
      <div className="grid gap-4 px-4 pb-4 @[760px]:grid-cols-[minmax(0,1fr)_auto] @[760px]:items-center">
        <div>
          <p className="max-w-[680px] text-sm leading-5 text-ink">
            {mode === "top" ? (
              <>
                Let the council draft <span className="font-semibold">{countWord(take).toLowerCase()} squads you can field at the same time</span> — the best formation, then the best with none of its dragons, and so on, each using none of the dragons above it.
              </>
            ) : focus ? (
              <>
                The <span className="font-semibold">{take} best formations that include {focus.name}</span>, in any seat it can take. Each is a different trio of dragons: the same three reseated don't count twice.
              </>
            ) : (
              <>Pick a dragon to see the {take} best formations built around it, in any seat it can take.</>
            )}
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink-muted">
            <li className="flex items-center gap-1.5"><Icon name="check" size={12} className="text-ink-faint" /> Rated on Strength, Instinct, Intelligence, Initiative</li>
            <li className="flex items-center gap-1.5"><Icon name="check" size={12} className="text-ink-faint" /> One troop per squad; only dragons who like it get +20%</li>
            <li className="flex items-center gap-1.5"><Icon name="check" size={12} className="text-ink-faint" /> Vanguard seat: tanks &amp; champions ({space.vanguards} active)</li>
          </ul>
        </div>
        <div className="flex flex-col items-start gap-1 @[760px]:items-end">
          <RunButton onRun={onRun} disabled={blocked} reason={blocked ? status.reason : undefined} label={runLabel} />
          {!blocked && (
            <span className="tnum text-[11px] text-ink-faint">
              Checks {work}
              {estimateMs != null ? `, about ${humanDuration(estimateMs).replace(/^about /, "")} in this browser` : ""}. The page stays usable while it runs.
            </span>
          )}
          {status.kind === "idle" && status.error && <span className="text-[11px] text-neg">{status.error}</span>}
        </div>
      </div>
    );
  } else if (status.kind === "running") {
    body = <DraftProgressBar status={status} focusName={mode === "with" ? focus?.name : undefined} onCancel={onCancel} />;
  } else {
    const d = status.draft;
    const max = Math.max(...d.squads.map((s) => s.formation), 1);
    const dragons = d.squads.flatMap((s) => s.members.map((m) => m.dragon));
    const n = d.squads.length;
    body = (
      <div className="px-4 pb-4">
        {stale && (
          <div className="mb-3 flex flex-wrap items-start gap-3 rounded-md border border-neg/50 bg-neg/8 px-3 py-2.5">
            <Icon name="alert" size={15} className="mt-0.5 shrink-0 text-neg" />
            <div className="min-w-0 flex-1 text-[13px] leading-5 text-ink">
              <span className="font-semibold">These squads are out of date.</span> You changed {status.changes.length === 1 ? "one thing" : `${status.changes.length} things`} since they were drafted — finish editing, then run again.
              <div className="mt-1 flex flex-wrap gap-1">
                {status.changes.slice(0, 6).map((c) => <span key={c} className="rounded-sm bg-surface-hover px-1.5 py-0.5 text-[11px] text-ink-muted">{c}</span>)}
                {status.changes.length > 6 && <span className="px-1 text-[11px] text-ink-faint">+{status.changes.length - 6} more</span>}
              </div>
            </div>
            <Button size="sm" variant="primary" onClick={onRun}><Icon name="loop" size={13} /> Run again</Button>
          </div>
        )}
        {d.focus ? (
          <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-muted">
            <span className="font-semibold text-ink">{countWord(n)} formation{n === 1 ? "" : "s"} with {d.focus.name}</span>
            <span>· each a different trio, {d.focus.name} in whichever seat scores best</span>
            <span>· <span className="text-pos">+20%</span> marks who likes the troop</span>
            {n < take && <span className="text-neg">· the roster has no more legal formations with {d.focus.name}</span>}
          </p>
        ) : (
          <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-muted">
            <span className="font-semibold text-ink">{countWord(n)} squad{n === 1 ? "" : "s"} you can field together</span>
            <span>· {new Set(dragons.map((x) => x.id)).size} different dragons, none used twice</span>
            <span>· each brings one troop; <span className="text-pos">+20%</span> marks who likes it</span>
            {n < take && <span className="text-neg">· the roster ran out of unused dragons or Vanguards after {n} ({d.activeCount} active)</span>}
          </p>
        )}
        <div className="-mx-4 grid snap-x snap-mandatory auto-cols-[86%] grid-flow-col gap-3 overflow-x-auto px-4 pb-1 @[640px]:mx-0 @[640px]:auto-cols-auto @[640px]:grid-flow-row @[640px]:grid-cols-2 @[640px]:overflow-visible @[640px]:px-0 @[1000px]:grid-cols-3">
          {d.squads.map((s) => (
            <SquadCard key={s.rank} squad={s} max={max} stale={stale} unavailable={unavailable} opened={openedRank === s.rank} onOpen={onOpen} onDetails={onDetails} />
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-4 text-ink-faint">
          Formation rating = sheet stats + every skill buff, teammates included. Sheet T / Buffed T: 50 is an average dragon on this roster, 10 points = 1 SD (Buffed T runs high — the roster side has no buffs). Ceiling = a legendary ★10 with this roster's highest base and the +20%; buffed squads can pass 100%.
        </p>
      </div>
    );
  }
  return (
    <section className="@container rounded-lg border border-line bg-surface" aria-busy={status.kind === "running"}>
      {head}
      {modeBar}
      {body}
    </section>
  );
}

// ---------------------------------------------------------------- progress
/** A live run in the draft worker: formations scored of the exact total, and the time left at the pace so far. */
function DraftProgressBar({ status, focusName, onCancel }: { status: Extract<DraftStatus, { kind: "running" }>; focusName?: string; onCancel: () => void }) {
  const { done, total, startedAt } = status;
  const share = total ? Math.min(1, done / total) : 0;
  const elapsed = performance.now() - startedAt;
  // The first few percent set the pace; before that there's nothing honest to say.
  const left = done > 0 && share >= 0.03 && share < 1 ? (elapsed * (total - done)) / done : null;
  return (
    <div className="mx-4 mb-4 rounded-md border border-line-strong bg-surface-sunken px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="text-sm font-semibold text-ink">{focusName ? `Drafting around ${focusName}` : "Drafting squads"}</div>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <Icon name="x" size={12} /> Cancel
        </Button>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface ring-1 ring-line"
        role="progressbar"
        aria-label="Formations checked"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div className="h-full rounded-full bg-ink transition-[width] duration-150 ease-linear" style={{ width: `${share * 100}%` }} />
      </div>
      <div className="tnum mt-1.5 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[12px] text-ink-muted">
        <span>
          {nf.format(done)} / {nf.format(total)} formations × 4 troops · {(share * 100).toFixed(0)}%
        </span>
        <span>{share >= 1 ? "Writing up the squads…" : left != null ? `${humanDuration(left)} left` : "Measuring pace…"}</span>
      </div>
      <p className="mt-1.5 text-[11px] text-ink-faint">The page stays usable. Roster or habit edits made now will mark these squads out of date when they arrive.</p>
    </div>
  );
}

// ---------------------------------------------------------------- detail
function offenseStat(dmg: Dragon["damageType"]) {
  return dmg === "physical" ? "strength" : dmg === "tactical" ? "instinct" : "intelligence";
}

/** What a stat does for THIS dragon, in words. */
function statRole(stat: StatRow["stat"], d: Dragon) {
  const e = STAT_EFFECT[stat];
  const off = offenseStat(d.damageType) === stat;
  const parts: { text: string; tone: "off" | "def" | "none" }[] = [];
  if (off) parts.push({ text: `more ${DAMAGE_LABEL[d.damageType]} damage dealt`, tone: "off" });
  else if (e.offense) parts.push({ text: `${DAMAGE_LABEL[e.offense]} damage — unused, deals ${DAMAGE_LABEL[d.damageType]}`, tone: "none" });
  if (e.defense) parts.push({ text: `less ${e.defense}`, tone: "def" });
  if (e.note) parts.push({ text: e.note, tone: "def" });
  return parts;
}

export function DragonStatTable({ member, troop }: { member: SquadMember; troop: TroopType }) {
  const d = member.dragon;
  const off = offenseStat(d.damageType);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[12.5px]">
        <thead className="text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
          <tr className="border-b border-line">
            <th className="py-1.5 font-semibold">Stat</th>
            <th className="py-1.5 pl-3 text-right font-semibold">Base ★1</th>
            <th className="py-1.5 pl-3 text-right font-semibold">After ★{d.starRank}</th>
            <th className="py-1.5 pl-3 text-right font-semibold">{member.troopBonus ? <span className="text-pos">After +20%</span> : "No troop bonus"}</th>
            <th className="py-1.5 pl-3 text-right font-semibold text-structural">Own buffs</th>
            <th className="py-1.5 pl-3 text-right font-semibold">With team</th>
            <th className="py-1.5 pl-3 text-right font-semibold text-habit">From team</th>
          </tr>
        </thead>
        <tbody>
          {STATS.map((k) => {
            const r = member.stats.find((x) => x.stat === k)!;
            const team = r.withTeammates != null && r.ownBuffs != null ? r.withTeammates - r.ownBuffs : 0;
            const roles = statRole(k, d);
            const dim = k === "strength" && off !== "strength";
            return (
              <tr key={k} className={cx("border-b border-line/60 align-top", k === off && "bg-pos/6")}>
                <td className="py-2 pr-3">
                  <div className={cx("font-semibold", dim ? "text-ink-muted" : "text-ink")}>{STAT_LABEL[k]} {k === off && <span className="ml-1 rounded-sm bg-pos/15 px-1 text-[10px] font-semibold uppercase text-pos">offense</span>}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px]">
                    {roles.map((p) => <span key={p.text} className={p.tone === "off" ? "text-pos" : p.tone === "none" ? "italic text-ink-faint" : "text-ink-muted"}>{p.text}</span>)}
                  </div>
                </td>
                <td className="tnum py-2 text-right text-ink-muted">{f1n(r.base)}</td>
                <td className="tnum py-2 text-right text-ink-muted">{f1n(r.afterStars)}</td>
                <td className={cx("tnum py-2 text-right", member.troopBonus ? "text-ink" : "text-ink-faint")}>{f1n(r.afterTroop)}</td>
                <td className="tnum py-2 text-right text-ink">{f1n(r.ownBuffs)}</td>
                <td className="tnum py-2 text-right font-semibold text-ink">{f1n(r.withTeammates)}</td>
                <td className={cx("tnum py-2 text-right", team > 0.05 ? "font-semibold text-habit" : "text-ink-faint")}>{team > 0.05 ? plus(team) : "0"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-ink-faint">
        {member.troopBonus ? `Likes ${TROOP_LABEL[troop]}: +20% applied to all four stats before skills.` : `No +20%: ${member.affinity === "-" ? "dislikes" : "neutral to"} ${TROOP_LABEL[troop]}.`} Level and habits don't change these four numbers; skills add percents of this dragon's own stat, or flat points. Own buffs and With team are 10-round averages.
        {member.stats.some((r) => r.base == null) && " — means that ★1 base isn't entered yet (Admin → Dragon Stats)."}
      </p>
    </div>
  );
}

export interface SquadDetailProps { squad: Squad; onClose: () => void; onOpen?: (s: Squad) => void; initialMember?: string }

/** Behind "Stat details": why this troop, where each dragon's points come from, and the full stat rows. */
export function SquadDetail({ squad, onClose, onOpen, initialMember }: SquadDetailProps) {
  const [sel, setSel] = React.useState(initialMember ?? squad.members[0].dragon.id);
  const m = squad.members.find((x) => x.dragon.id === sel) ?? squad.members[0];
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const maxT = Math.max(...squad.troopOptions.map((o) => o.formation));
  const minT = Math.min(...squad.troopOptions.map((o) => o.formation));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/70 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Squad ${squad.rank} details`} onClick={(e) => e.stopPropagation()} className="max-h-[94vh] w-full max-w-[820px] overflow-y-auto rounded-t-xl border border-line-strong bg-surface shadow-drawer sm:rounded-xl">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
          <span className="flex size-8 items-center justify-center rounded-md border border-line-strong font-display text-base font-semibold text-ink">{squad.rank}</span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-semibold leading-6 text-ink">Squad {squad.rank} · {squad.members.map((x) => x.dragon.name).join(" · ")}</div>
            <div className="tnum text-[12px] text-ink-muted">{TROOP_LABEL[squad.troop]} · formation {f1(squad.formation)} · {squad.subtitle}</div>
          </div>
          {onOpen && <Button size="sm" variant="primary" onClick={() => onOpen(squad)}>Open in builder</Button>}
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-muted hover:bg-surface-hover hover:text-ink cursor-pointer" aria-label="Close"><Icon name="x" /></button>
        </header>

        <div className="grid gap-5 p-4">
          <section>
            <Eyebrow>Why {TROOP_LABEL[squad.troop]}</Eyebrow>
            <p className="mt-1 text-[12.5px] text-ink-muted">Each troop was tried; the squad keeps the one with the higher formation rating. +20% goes only to dragons who like that troop.</p>
            <ul className="mt-2 space-y-1.5">
              {squad.troopOptions.map((o) => {
                const used = o.troop === squad.troop;
                const who = squad.members.filter((x) => x.dragon.affinity[o.troop] === "+");
                return (
                  <li key={o.troop} className={cx("grid grid-cols-[120px_minmax(0,1fr)_72px] items-center gap-3 rounded-md px-2 py-1.5 @container", used ? "bg-surface-hover ring-1 ring-line-strong" : "")}>
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink"><Icon name={o.troop} size={14} /> {TROOP_LABEL[o.troop]}{used && <span className="rounded-sm bg-pos/15 px-1 text-[10px] font-semibold uppercase text-pos">used</span>}</span>
                    <span className="min-w-0">
                      <span className="block h-2 rounded-full bg-surface-sunken"><span className={cx("block h-full rounded-full", used ? "bg-ink" : "bg-line-strong")} style={{ width: `${30 + ((o.formation - minT) / Math.max(1, maxT - minT)) * 70}%` }} /></span>
                      <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-ink-muted">
                        <span className={cx("tnum", o.boosted ? "text-pos" : "text-ink-faint")}>{o.boosted} of 3 get +20%</span>
                        <span className="text-ink-faint">{who.length ? who.map((x) => x.dragon.name).join(", ") : "nobody"}</span>
                      </span>
                    </span>
                    <span className="tnum text-right text-[13px] font-semibold text-ink">{f1(o.formation)}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <Eyebrow>Where the points come from</Eyebrow>
            <p className="mt-1 text-[12.5px] text-ink-muted">Flanks weigh offense more; the Vanguard weighs defense more. Pick a dragon for its stat rows.</p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[12.5px]">
                <thead className="text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                  <tr className="border-b border-line"><th className="py-1.5">Seat · dragon</th><th>Troop</th><th className="text-right">Sheet</th><th className="text-right">+ own buffs</th><th className="text-right">+ teammates</th><th className="text-right text-habit">From team</th></tr>
                </thead>
                <tbody>
                  {squad.members.map((x) => (
                    <tr key={x.dragon.id} onClick={() => setSel(x.dragon.id)} className={cx("cursor-pointer border-b border-line/60", sel === x.dragon.id ? "bg-score/10" : "hover:bg-surface-raised")}>
                      <td className="py-1.5">
                        <span className="flex items-center gap-2">
                          <DragonAvatar dragon={x.dragon} size={24} />
                          <span><DragonName dragon={x.dragon} /> <span className="text-[11px] text-ink-faint">{SLOT_LABEL[x.slot]} · deals {DAMAGE_LABEL[x.dragon.damageType]}</span></span>
                        </span>
                      </td>
                      <td><TroopBonusMark member={x} troop={squad.troop} size="sm" /></td>
                      <td className="tnum text-right text-ink-muted">{f1(x.sheet)}</td>
                      <td className="tnum text-right text-ink-muted">{f1(x.own)}</td>
                      <td className="tnum text-right font-semibold text-ink">{f1(x.formation)}</td>
                      <td className="tnum text-right text-habit">{plus(x.formation - x.own)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="text-[12px]"><td className="pt-1.5 text-ink-faint">Squad</td><td /><td className="tnum pt-1.5 text-right text-ink-muted">{f1(squad.sheet)}</td><td className="tnum pt-1.5 text-right text-ink-muted">{f1(squad.ownBuffs)}</td><td className="tnum pt-1.5 text-right font-semibold text-ink">{f1(squad.formation)}</td><td className="tnum pt-1.5 text-right text-habit">{plus(squad.fromTeammates)}</td></tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow>{m.dragon.name}'s stats · {SLOT_LABEL[m.slot]}</Eyebrow>
              <Segmented label="Dragon" size="sm" value={sel} onChange={setSel} options={squad.members.map((x) => ({ value: x.dragon.id, label: x.dragon.name }))} />
            </div>
            <div className="mt-2"><DragonStatTable member={m} troop={squad.troop} /></div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- builder handoff
export interface TroopLockBannerProps {
  rank: number | null; // null = seats changed since the squad
  troop: TroopType;
  locked: boolean;
  /** Power score at the locked troop, and at the power score's own pick. */
  lockedScore: number;
  autoTroop: TroopType;
  autoScore: number;
  onLock: (locked: boolean) => void;
  onRelease: () => void;
}

/** Shown on the formation after "Open in builder": the combat rating's troop stays in charge until the player lets go. */
export function TroopLockBanner({ rank, troop, locked, lockedScore, autoTroop, autoScore, onLock, onRelease }: TroopLockBannerProps) {
  const same = autoTroop === troop;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-line-strong bg-surface-sunken px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Icon name={locked ? troop : autoTroop} size={18} className="shrink-0 text-ink" />
        <div className="min-w-0 text-[12.5px] leading-5">
          <div className="text-ink">
            {rank ? <>From <span className="font-semibold">Squad {rank}</span> · </> : <>Seats changed since the squad · </>}
            troop <span className="font-semibold">{TROOP_LABEL[locked ? troop : autoTroop]}</span>
            {locked ? <span className="text-ink-muted"> (chosen by the combat rating)</span> : <span className="text-ink-muted"> (the power score's own pick)</span>}
          </div>
          <div className="tnum text-[11px] text-ink-muted">
            {same ? <>The power score picks {TROOP_LABEL[autoTroop]} too — no conflict.</> : <>Power score at {TROOP_LABEL[troop]}: {nf.format(Math.round(lockedScore))} · its own pick {TROOP_LABEL[autoTroop]}: {nf.format(Math.round(autoScore))}</>}
          </div>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {!same && (
          <Segmented label="Troop" size="sm" value={locked ? "lock" : "auto"} onChange={(v) => onLock(v === "lock")} options={[{ value: "lock", label: `Keep ${TROOP_LABEL[troop]}` }, { value: "auto", label: `Power's pick` }]} />
        )}
        <Button size="sm" variant="ghost" onClick={onRelease} title="Forget the squad's troop">
          <Icon name="x" size={12} /> Release
        </Button>
      </div>
    </div>
  );
}
