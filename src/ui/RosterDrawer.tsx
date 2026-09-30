import * as React from "react";
import { MODEL } from "../data";
import type { Breed, Dragon, Rarity, Role } from "./types";
import { Button, RarityBadge, Segmented, Toggle } from "./Chips";
import { DragonAvatar, DragonName } from "./DragonArt";
import { Icon } from "./Icon";
import { BREED_LABEL, ROLE_SHORT, cx, fmtInt } from "./format";

/** Star rank that unlocks Habit 1-5 (★2 / 4 / 6 / 8 / 10). */
export const HABIT_UNLOCK = MODEL.HABIT_UNLOCK_STARS;
const UNLOCK = HABIT_UNLOCK;
const RARITY_ORDER: Record<Rarity, number> = { mythic: 0, legendary: 1, epic: 2, rare: 3 };

export interface RosterPatch {
  inRoster?: boolean;
  active?: boolean;
  starRank?: number;
  /** A dragon's own habit levels (null slot = off / locked); null = back to the default (unlocked by star rank, at the Habit level control). */
  habitLevels?: (number | null)[] | null;
}

/** The levels power and synergy use for a dragon, and whether they're its own or the default. */
export interface DragonHabits {
  levels: (number | null)[];
  custom: boolean;
}

export interface RosterDrawerProps {
  open: boolean;
  onClose: () => void;
  /** All 36 catalog dragons, carrying the player's overrides. */
  dragons: Dragon[];
  habits: Record<string, DragonHabits>;
  inRoster: Set<string>;
  onChange: (id: string, patch: RosterPatch) => void;
  onBulk: (action: "addAll" | "removeAll" | "activateAll" | "benchAll", ids: string[]) => void;
}

function StarInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center" role="radiogroup" aria-label={label}>
      {Array.from({ length: 10 }, (_, i) => {
        const n = i + 1;
        const on = n <= value;
        const unlockMark = UNLOCK.includes(n);
        return (
          <button
            key={n}
            role="radio"
            aria-checked={n === value}
            aria-label={`${n} stars`}
            onClick={() => onChange(n)}
            className={cx("relative -mx-[1px] p-[2px] cursor-pointer", on ? "text-rarity-legendary-ink" : "text-line-strong hover:text-ink-faint")}
            title={`★${n}${unlockMark ? ` — unlocks Habit ${UNLOCK.indexOf(n) + 1}` : ""}`}
          >
            <Icon name="star" size={13} filled={on} />
            {unlockMark && <span className={cx("absolute -bottom-0.5 left-1/2 h-[2px] w-2 -translate-x-1/2 rounded-full", on ? "bg-habit" : "bg-line-strong")} />}
          </button>
        );
      })}
      <span className="tnum ml-1.5 w-6 text-xs text-ink-muted">★{value}</span>
    </div>
  );
}

/**
 * H1–H5 for one dragon: star-locked habits show their unlock star; unlocked
 * ones switch on/off (the H label) and take a level 1–5 (the pips). The
 * first edit turns the shown levels into the dragon's own.
 */
function HabitSwitches({ dragon, habits, onChange }: { dragon: Dragon; habits: DragonHabits; onChange: (levels: (number | null)[] | null) => void }) {
  const levels = habits.levels;
  const set = (i: number, lv: number | null) => onChange(levels.map((x, j) => (j === i ? lv : x)));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {UNLOCK.map((s, i) => {
        if (dragon.starRank < s)
          return (
            <span key={i} className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-line-strong px-1.5 text-[11px] text-ink-faint" title={`Habit ${i + 1} unlocks at ★${s}`}>
              <Icon name="lock" size={11} /> H{i + 1} <span className="text-[10px]">★{s}</span>
            </span>
          );
        const lv = levels[i];
        const on = lv != null;
        return (
          <span
            key={i}
            className={cx(
              "inline-flex h-7 items-center rounded-md border text-[11px]",
              on ? "border-line-strong bg-surface-sunken text-ink-muted" : "border-dashed border-line-strong text-ink-faint",
              !habits.custom && "opacity-80",
            )}
          >
            <button
              role="switch"
              aria-checked={on}
              aria-label={`${dragon.name} Habit ${i + 1}`}
              title={on ? `Habit ${i + 1} on — click to switch off` : `Habit ${i + 1} off — click to switch on`}
              onClick={() => set(i, on ? null : 1)}
              className={cx("h-full cursor-pointer rounded-l-md px-1.5 font-semibold hover:bg-surface-hover", on ? "text-ink" : "text-ink-faint")}
            >
              H{i + 1}
            </button>
            {on ? (
              <>
                <span className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} aria-label={`${dragon.name} Habit ${i + 1} level ${n}`} onClick={() => set(i, n)} className="cursor-pointer p-[2px]">
                      <span className={cx("block h-3 w-1.5 rounded-[2px]", lv >= n ? "bg-habit" : "bg-line-strong")} />
                    </button>
                  ))}
                </span>
                <span className="tnum w-4 pr-1 text-center text-ink">{lv}</span>
              </>
            ) : (
              <span className="pr-1.5 text-[10px]">off</span>
            )}
          </span>
        );
      })}
      {habits.custom ? (
        <button onClick={() => onChange(null)} className="cursor-pointer text-[11px] text-ink-faint underline decoration-dotted underline-offset-2 hover:text-ink" title="Forget these habits and go back to the default: unlocked by star rank, at the Habit level control">
          Reset
        </button>
      ) : (
        <span className="text-[11px] text-ink-faint" title="Unlocked by star rank, at the Habit level control. Edit any habit to record this dragon's own.">default</span>
      )}
    </div>
  );
}

/** Slide-over roster customizer. Non-modal on desktop (the page stays live beside it); full-screen sheet on phones. */
export function RosterDrawer({ open, onClose, dragons, habits, inRoster, onChange, onBulk }: RosterDrawerProps) {
  const [q, setQ] = React.useState("");
  const [rarity, setRarity] = React.useState<Rarity | "any">("any");
  const [role, setRole] = React.useState<Role | "any">("any");
  const [breed, setBreed] = React.useState<Breed | "any">("any");
  const [show, setShow] = React.useState<"all" | "in" | "out">("all");
  // Grouped by rarity (highest first), A–Z within each, so newly added catalog dragons land with their peers.
  const list = dragons
    .filter(
      (d) =>
        (rarity === "any" || d.rarity === rarity) &&
        (role === "any" || d.role === role) &&
        (breed === "any" || d.breed === breed) &&
        (show === "all" || (show === "in") === inRoster.has(d.id)) &&
        d.name.toLowerCase().includes(q.toLowerCase()),
    )
    .sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.name.localeCompare(b.name));
  const ids = list.map((d) => d.id);
  const active = dragons.filter((d) => inRoster.has(d.id) && d.active).length;
  return (
    <aside
      aria-label="Roster"
      aria-hidden={!open}
      className={cx(
        "fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line-strong bg-surface shadow-drawer transition-transform duration-300 sm:w-[600px]",
        open ? "translate-x-0" : "pointer-events-none translate-x-full",
      )}
    >
      <header className="border-b border-line px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">Roster</h2>
            <p className="tnum mt-0.5 text-xs text-ink-muted">
              {inRoster.size} of {dragons.length} dragons in roster · {active} active · recommendations update live
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close roster">
            <Icon name="x" size={14} /> Close
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="relative min-w-[160px] flex-1">
            <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-8 w-full rounded-md border border-line-strong bg-surface-sunken pl-8 pr-2 text-sm text-ink placeholder:text-ink-faint" />
          </label>
          <Segmented label="Show" value={show} onChange={setShow} options={[{ value: "all", label: "All" }, { value: "in", label: "In roster" }, { value: "out", label: "Not in roster" }]} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Segmented label="Rarity" size="sm" value={rarity} onChange={setRarity} options={[{ value: "any", label: "Any" }, { value: "legendary", label: "Legendary" }, { value: "epic", label: "Epic" }, { value: "rare", label: "Rare" }]} />
          <Segmented label="Role" size="sm" value={role} onChange={setRole} options={[{ value: "any" as const, label: "Any" }, ...(["tank", "physical", "tactical", "fire", "healer", "control"] as Role[]).map((r) => ({ value: r, label: <Icon name={r} size={13} />, title: ROLE_SHORT[r] }))]} />
          <Segmented label="Breed" size="sm" value={breed} onChange={setBreed} options={[{ value: "any" as const, label: "Any" }, ...(["champion", "hunter", "sentinel", "warrior"] as Breed[]).map((b) => ({ value: b, label: <Icon name={b} size={13} />, title: BREED_LABEL[b] }))]} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] text-ink-faint">{list.length === dragons.length ? "All dragons:" : `These ${list.length}:`}</span>
          <Button size="sm" onClick={() => onBulk("addAll", ids)}><Icon name="plus" size={12} /> Add all</Button>
          <Button size="sm" onClick={() => onBulk("removeAll", ids)}><Icon name="minus" size={12} /> Remove all</Button>
          <Button size="sm" variant="ghost" onClick={() => onBulk("activateAll", ids)}>Activate all</Button>
          <Button size="sm" variant="ghost" onClick={() => onBulk("benchAll", ids)}>Bench all</Button>
        </div>
      </header>
      <div className="flex items-start gap-2 border-b border-line bg-surface-sunken px-4 py-2 text-[11px] leading-4 text-ink-muted">
        <Icon name="info" size={12} className="mt-0.5 shrink-0 text-habit" />
        Power = Stars + Habits + Level (every dragon at Level 50 for now), from the confirmed tables. Habits unlock by star rank at the header's Habit level; set H1–H5 to record a dragon's own. Saved in this browser.
      </div>
      <ul className="flex-1 divide-y divide-line overflow-y-auto overscroll-contain">
        {list.map((d) => {
          const inR = inRoster.has(d.id);
          return (
            <li key={d.id} className={cx("px-4 py-3", !inR && "bg-surface-sunken/60")}>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={inR}
                  onChange={(e) => onChange(d.id, { inRoster: e.target.checked })}
                  aria-label={`${d.name} in roster`}
                  className="df-check size-4 shrink-0"
                />
                <DragonAvatar dragon={d} size={36} className={cx(!inR && "opacity-50 grayscale")} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <DragonName dragon={d} className={cx("truncate text-sm", !inR && "opacity-70")} />
                    <span className="tnum text-xs text-ink-muted">{fmtInt(d.power)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-faint">
                    <RarityBadge rarity={d.rarity} compact />
                    <Icon name={d.role} size={11} /> {ROLE_SHORT[d.role]}
                    <Icon name={d.breed} size={11} /> {BREED_LABEL[d.breed]}
                  </div>
                </div>
                {inR && <Toggle checked={d.active} onChange={(v) => onChange(d.id, { active: v })} label={`${d.name} active`} />}
              </div>
              {inR && (
                <div className="mt-2.5 grid gap-2 pl-7 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-x-4">
                  <StarInput value={d.starRank} label={`${d.name} star rank`} onChange={(n) => onChange(d.id, { starRank: n })} />
                  {habits[d.id] && <HabitSwitches dragon={d} habits={habits[d.id]} onChange={(habitLevels) => onChange(d.id, { habitLevels })} />}
                </div>
              )}
            </li>
          );
        })}
        {!list.length && <li className="px-4 py-10 text-center text-sm text-ink-muted">No dragons match these filters.</li>}
      </ul>
    </aside>
  );
}
