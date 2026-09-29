import { useMutation, useQuery } from "convex/react";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { AdminNav } from "../components/AdminNav";
import { HABIT_TEXT, MODEL, kitFor } from "../data";
import {
  COMMAND_SLOT,
  EMPTY_LEVELS,
  ROUNDS,
  activeRounds,
  describeClause,
  formatRounds,
  triggerRounds,
  type Clause,
  type ClauseBoost,
  type ClauseCondition,
  type ClauseTarget,
  type Levels,
  type SkillDoc,
} from "../engine/habitClauses";

type Dragon = Doc<"dragons">;

const KIND_OPTIONS: { value: Clause["kind"]; label: string }[] = [
  { value: "stat", label: "Stat change" },
  { value: "dmgDealt", label: "Damage Dealt" },
  { value: "dmgRecv", label: "Damage Received" },
  { value: "recovDealt", label: "Recovery Dealt" },
  { value: "recovRecv", label: "Recovery Received" },
  { value: "hit", label: "Damage hit" },
  { value: "heal", label: "Recovery (heal)" },
  { value: "effect", label: "Apply effect" },
  { value: "cleanse", label: "Cleanse" },
  { value: "cmd", label: "Command modifier" },
];

const STATS = ["strength", "intelligence", "instinct", "initiative"];
const DAMAGE_TYPES = ["physical", "physical(CH)", "tactical", "fire", "fire(CH)", "all"];

// The shared effect catalog (MODEL.EFFECTS) plus the effects the real habit
// text uses that the reference site never tracked. Overwhelm and Stagger are
// separate Control effects in-game, even though the reference site merged them.
const EFFECT_LABELS: Record<string, string> = {};
for (const group of [MODEL.EFFECTS.applies, MODEL.EFFECTS.grants]) {
  for (const [id, full] of Object.entries(group)) EFFECT_LABELS[id] ??= full.split(" — ")[0];
}
Object.assign(EFFECT_LABELS, {
  overwhelm: "Overwhelm",
  stagger: "Stagger",
  immunity: "Immunity",
  nullifyRecovery: "Nullify Recovery",
  prey: "Prey (mark)",
  solarFlare: "Solar Flare (mark)",
  crescentBlade: "Crescent Blade",
  spreadingBlaze: "Spreading Blaze",
  copyDebuff: "Copy enemy's debuff",
  copyBuff: "Copy enemy's buff",
  reactive: "Reactive (varies)",
});
const EFFECT_OPTIONS = Object.keys(EFFECT_LABELS).sort((a, b) => EFFECT_LABELS[a].localeCompare(EFFECT_LABELS[b]));

const PREFER_OPTIONS = [
  "lane:left", "lane:right", "lane:vanguard",
  ...STATS.map((s) => `highest:${s}`), "lowest:instinct", "lowest:intelligence",
  "mostTroops", "leastTroops",
  "dealsDamage:physical", "dealsDamage:tactical", "dealsDamage:fire",
  "breed:champion", "breed:hunter", "breed:sentinel", "breed:warrior",
  "prey", "notStunned", "noResistance", "noBurn", "controlled", "healedLastRound", "marked:solarFlare",
];

const CONDITION_SCOPES = [
  { value: "target", hint: "target has effect" },
  { value: "self", hint: "you have effect" },
  { value: "anyAlly", hint: "any ally has effect" },
  { value: "anyEnemy", hint: "any enemy has effect" },
  { value: "troop", hint: "leading troop type" },
  { value: "selfTroops", hint: "your troops, e.g. <50" },
  { value: "targetTroops", hint: "target's troops, e.g. >75" },
  { value: "stacks", hint: "e.g. risingTide>=4" },
  { value: "enemyComp", hint: "enemy army has…" },
  { value: "defending", hint: "" },
  { value: "pve", hint: "" },
];

const SKIP_OPTIONS = ["enemyDep", "situational", "pve", "nonCombat"];

const inputCls = "rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 text-sm text-neutral-100";
const smallBtn = (active: boolean) =>
  `rounded border px-2 py-0.5 text-xs ${
    active ? "border-violet-500 bg-violet-950/40 text-violet-200" : "border-neutral-700 text-neutral-400 hover:bg-neutral-900"
  }`;
const linkBtn = "text-xs text-neutral-500 underline hover:text-neutral-200";

function skillLabel(slot: number) {
  return slot === COMMAND_SLOT ? "Command" : `Habit ${slot}`;
}

function skillText(dragonName: string, slot: number): string[] {
  if (slot === COMMAND_SLOT) return [kitFor(dragonName)?.command ?? ""];
  return HABIT_TEXT[dragonName]?.[slot - 1]?.desc ?? [];
}

function DragonList({ dragons, onSelect }: { dragons: Dragon[] | undefined; onSelect: (id: Id<"dragons">) => void }) {
  const [query, setQuery] = useState("");
  const sorted = [...(dragons ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const filtered = sorted.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <AdminNav current="/admin/habit-builder" />
      <h1 className="mb-1 text-xl font-bold">Habit Capabilities Builder</h1>
      <p className="mb-4 text-sm text-neutral-500">Pick a dragon, then its Command or one of its 5 habits, to review its structured clauses.</p>
      <input
        className="mb-3 w-full max-w-xs rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
        type="search"
        placeholder="Search dragons…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {dragons === undefined ? (
        <p className="text-neutral-500">Loading…</p>
      ) : (
        <ul className="grid max-w-2xl grid-cols-2 gap-1 sm:grid-cols-3">
          {filtered.map((d) => (
            <li key={d._id}>
              <button
                className="w-full rounded border border-neutral-800 px-3 py-2 text-left text-sm hover:bg-neutral-900"
                onClick={() => onSelect(d._id)}
              >
                <div className="font-medium">{d.name}</div>
                <div className="text-xs text-neutral-500">{d.rarity} · {d.breed}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SkillPicker({
  dragon,
  skills,
  onSelect,
  onBack,
}: {
  dragon: Dragon;
  skills: SkillDoc[] | undefined;
  onSelect: (slot: number) => void;
  onBack: () => void;
}) {
  const slots = [COMMAND_SLOT, 1, 2, 3, 4, 5];
  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <AdminNav current="/admin/habit-builder" />
      <button className="mb-4 text-sm text-neutral-400 underline hover:text-neutral-200" onClick={onBack}>
        ← Back to dragons
      </button>
      <h1 className="mb-1 text-xl font-bold">{dragon.name}</h1>
      <p className="mb-4 text-sm text-neutral-500">{dragon.rarity} · {dragon.breed} · {dragon.role} — pick a skill.</p>

      <ul className="flex max-w-2xl flex-col gap-2">
        {slots.map((slot) => {
          const skill = skills?.find((s) => s.habitSlot === slot);
          const star = slot === COMMAND_SLOT ? 1 : MODEL.HABIT_UNLOCK_STARS[slot - 1];
          const short = slot === COMMAND_SLOT ? skillText(dragon.name, slot)[0] : HABIT_TEXT[dragon.name]?.[slot - 1]?.short[0];
          const skipped = skill?.clauses.filter((c) => c.skip).length ?? 0;
          return (
            <li key={slot}>
              <button
                className="flex w-full items-start justify-between gap-3 rounded border border-neutral-800 px-3 py-2 text-left text-sm hover:bg-neutral-900"
                onClick={() => onSelect(slot)}
              >
                <span className="min-w-0">
                  <span className="font-medium">{skillLabel(slot)}</span>{" "}
                  <span className="text-xs text-neutral-500">★{star}</span>
                  {skill?.isCommandHabit && <span className="ml-2 rounded bg-amber-950/60 px-1.5 text-xs text-amber-300">Command habit</span>}
                  {short && <div className="truncate text-xs text-neutral-500">{short}</div>}
                </span>
                <span className="shrink-0 text-xs text-neutral-500">
                  {skill ? `${skill.clauses.length} clause${skill.clauses.length === 1 ? "" : "s"}` : "—"}
                  {skipped > 0 && <span className="ml-1 text-neutral-600">({skipped} skipped)</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Commits on blur, not per keystroke, so one habit edit isn't dozens of mutations. */
function TextField({
  value,
  onCommit,
  placeholder,
  className = "",
  list,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  className?: string;
  list?: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <input
      className={`${inputCls} ${className}`}
      value={local}
      placeholder={placeholder}
      list={list}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local !== value && onCommit(local)}
    />
  );
}

function LevelGrid({
  label,
  values,
  onCommit,
  onClear,
}: {
  label: string;
  values: Levels | undefined;
  onCommit: (v: Levels) => void;
  onClear?: () => void;
}) {
  const [local, setLocal] = useState<Levels>(values ?? EMPTY_LEVELS);
  useEffect(() => setLocal(values ?? EMPTY_LEVELS), [values]);
  return (
    <div>
      <div className="mb-1 flex items-center gap-3">
        <span className="text-xs text-neutral-400">{label}</span>
        {onClear && values && (
          <button className="text-xs text-neutral-500 underline hover:text-red-400" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      <div className="flex gap-2">
        {local.map((v, i) => (
          <label key={i} className="flex flex-col items-center text-xs text-neutral-500">
            Lv{i + 1}
            <input
              type="number"
              step={0.1}
              value={v ?? ""}
              onChange={(e) => {
                const next = [...local];
                next[i] = e.target.value === "" ? null : Number(e.target.value);
                setLocal(next);
              }}
              onBlur={() => onCommit(local)}
              className="w-16 rounded border border-neutral-700 bg-neutral-950 px-1.5 py-1 text-right text-sm text-neutral-100"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function Chips({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o}
          className={smallBtn(value.includes(o))}
          onClick={() => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function WhatEditor({ clause, onChange }: { clause: Clause; onChange: (what: string[]) => void }) {
  if (clause.kind === "stat") return <Chips options={STATS} value={clause.what} onChange={onChange} />;
  if (clause.kind === "dmgDealt" || clause.kind === "dmgRecv" || clause.kind === "hit")
    return <Chips options={DAMAGE_TYPES} value={clause.what} onChange={onChange} />;
  if (clause.kind === "effect")
    return (
      <select className={inputCls} value={clause.what[0] ?? ""} onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}>
        <option value="">Pick effect…</option>
        {EFFECT_OPTIONS.map((id) => (
          <option key={id} value={id}>
            {EFFECT_LABELS[id]}
          </option>
        ))}
      </select>
    );
  if (clause.kind === "heal" || clause.kind === "recovDealt" || clause.kind === "recovRecv") return null;
  return (
    <TextField
      value={clause.what.join(", ")}
      placeholder="comma-separated"
      onCommit={(v) => onChange(v.split(",").map((s) => s.trim()).filter(Boolean))}
    />
  );
}

function TargetEditor({ value, onChange }: { value: ClauseTarget | undefined; onChange: (t: ClauseTarget | undefined) => void }) {
  const side = value?.side;
  const prefer = value?.prefer ?? "";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(["self", "ally", "enemy"] as const).map((s) => (
        <button
          key={s}
          className={smallBtn(side === s)}
          onClick={() => onChange(s === "self" ? { side: "self" } : { ...value, side: s, count: value?.count ?? 1 })}
        >
          {s}
        </button>
      ))}
      <button className={smallBtn(!value)} onClick={() => onChange(undefined)}>
        none
      </button>
      {value && value.side !== "self" && (
        <>
          <span className="text-neutral-700">|</span>
          {([1, 2, 3] as const).map((n) => (
            <button key={n} className={smallBtn(value.count === n)} onClick={() => onChange({ ...value, count: n })}>
              {n}
            </button>
          ))}
          <label className="flex items-center gap-1 text-xs text-neutral-400">
            <input type="checkbox" checked={!!value.other} onChange={(e) => onChange({ ...value, other: e.target.checked || undefined })} />
            other
          </label>
          <select
            className={inputCls}
            value={value.scope ?? "any"}
            onChange={(e) => onChange({ ...value, scope: e.target.value === "any" ? undefined : (e.target.value as ClauseTarget["scope"]) })}
          >
            <option value="any">any lane</option>
            <option value="adjacent">within adjacency</option>
            <option value="sameLane">same lane</option>
          </select>
          <select
            className={inputCls}
            value={prefer}
            onChange={(e) => onChange({ ...value, prefer: e.target.value || undefined, filter: e.target.value ? value.filter : undefined })}
          >
            <option value="">no preference</option>
            {prefer && !PREFER_OPTIONS.includes(prefer) && <option value={prefer}>{prefer}</option>}
            {PREFER_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {prefer && (
            <label className="flex items-center gap-1 text-xs text-neutral-400" title="Only these targets, not just a priority">
              <input type="checkbox" checked={!!value.filter} onChange={(e) => onChange({ ...value, filter: e.target.checked || undefined })} />
              only
            </label>
          )}
        </>
      )}
    </div>
  );
}

function RoundBoxes({ value, onChange }: { value: number[]; onChange: (r: number[]) => void }) {
  const set = new Set(value);
  return (
    <div className="flex flex-wrap gap-1">
      {ROUNDS.map((r) => (
        <label key={r} className="flex items-center gap-0.5 rounded border border-neutral-800 px-1.5 text-xs">
          <input
            type="checkbox"
            checked={set.has(r)}
            onChange={(e) => {
              const next = new Set(set);
              if (e.target.checked) next.add(r);
              else next.delete(r);
              onChange([...next].sort((a, b) => a - b));
            }}
          />
          {r}
        </label>
      ))}
    </div>
  );
}

function TimingEditor({ clause, onChange }: { clause: Clause; onChange: (patch: Partial<Clause>) => void }) {
  const { timing } = clause;
  const d = clause.duration;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={inputCls}
        value={timing.mode}
        onChange={(e) => onChange({ timing: { mode: e.target.value as Clause["timing"]["mode"], rounds: timing.rounds, event: timing.event } })}
      >
        <option value="combat">Start of combat</option>
        <option value="each">Each round</option>
        <option value="odd">Odd rounds</option>
        <option value="even">Even rounds</option>
        <option value="rounds">Specific rounds</option>
        <option value="event">On an event</option>
      </select>
      {timing.mode === "rounds" && <RoundBoxes value={timing.rounds ?? []} onChange={(rounds) => onChange({ timing: { ...timing, rounds } })} />}
      {timing.mode === "event" && (
        <TextField value={timing.event ?? ""} placeholder="basicAttack, selfTaunt…" onCommit={(event) => onChange({ timing: { ...timing, event } })} />
      )}
      <label className="flex items-center gap-1 text-xs text-neutral-400">
        lasts
        <select
          className={inputCls}
          value={d == null ? "" : String(d)}
          onChange={(e) => {
            const v = e.target.value;
            onChange({ duration: v === "" ? undefined : v === "combat" || v === "round" ? v : Number(v) });
          }}
        >
          <option value="">default</option>
          <option value="round">this round</option>
          <option value="combat">until end of combat</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} round{n > 1 ? "s" : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ConditionRow({ value, onChange, onRemove }: { value: ClauseCondition; onChange: (c: ClauseCondition) => void; onRemove: () => void }) {
  const hint = CONDITION_SCOPES.find((s) => s.value === value.scope)?.hint;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={inputCls} value={value.scope} onChange={(e) => onChange({ ...value, scope: e.target.value })}>
        {!CONDITION_SCOPES.some((s) => s.value === value.scope) && <option value={value.scope}>{value.scope}</option>}
        {CONDITION_SCOPES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.value}
          </option>
        ))}
      </select>
      <TextField value={value.value} placeholder={hint} list="effect-ids" onCommit={(v) => onChange({ ...value, value: v })} />
      <button className="text-xs text-neutral-500 underline hover:text-red-400" onClick={onRemove}>
        remove
      </button>
    </div>
  );
}

function BoostRow({ value, onChange, onRemove }: { value: ClauseBoost; onChange: (b: ClauseBoost) => void; onRemove: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded border border-neutral-800 p-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
        when
        {value.condition ? (
          <ConditionRow
            value={value.condition}
            onChange={(condition) => onChange({ ...value, condition })}
            onRemove={() => onChange({ ...value, condition: undefined })}
          />
        ) : (
          <button className={linkBtn} onClick={() => onChange({ ...value, condition: { scope: "target", value: "" } })}>
            + condition
          </button>
        )}
        {value.rounds ? (
          <>
            on rounds <RoundBoxes value={value.rounds} onChange={(rounds) => onChange({ ...value, rounds: rounds.length ? rounds : undefined })} />
          </>
        ) : (
          <button className={linkBtn} onClick={() => onChange({ ...value, rounds: [] })}>
            + rounds
          </button>
        )}
        <label className="flex items-center gap-1">
          ×
          <input
            type="number"
            step={0.5}
            className={`${inputCls} w-14`}
            value={value.multiplier ?? ""}
            onChange={(e) => onChange({ ...value, multiplier: e.target.value === "" ? undefined : Number(e.target.value) })}
          />
        </label>
        <button className="ml-auto text-xs text-neutral-500 underline hover:text-red-400" onClick={onRemove}>
          remove boost
        </button>
      </div>
      <div className="flex flex-wrap gap-4">
        <LevelGrid
          label="Boosted value %"
          values={value.valueByLevel}
          onCommit={(v) => onChange({ ...value, valueByLevel: v.some((x) => x != null) ? v : undefined })}
        />
        <LevelGrid
          label="Boosted chance %"
          values={value.chanceByLevel}
          onCommit={(v) => onChange({ ...value, chanceByLevel: v.some((x) => x != null) ? v : undefined })}
        />
      </div>
      {(value.target || value.duration != null) && (
        <div className="text-xs text-neutral-500">
          {value.target && <>Reach becomes: {JSON.stringify(value.target)} </>}
          {value.duration != null && <>Duration becomes: {String(value.duration)}</>}
        </div>
      )}
    </div>
  );
}

function ClauseCard({ clause, onChange, onRemove }: { clause: Clause; onChange: (c: Clause) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const patch = (p: Partial<Clause>) => onChange({ ...clause, ...p });
  // A chance clause rolls on its trigger rounds; a guaranteed one is simply in effect.
  const rounds = clause.chanceByLevel ? triggerRounds(clause.timing) : activeRounds(clause);

  return (
    <div className={`rounded-lg border p-3 ${clause.skip ? "border-neutral-800 opacity-60" : "border-neutral-800 bg-neutral-950/60"}`}>
      <div className="flex items-start justify-between gap-3">
        <button className="min-w-0 flex-1 text-left" onClick={() => setOpen((o) => !o)}>
          <div className="text-sm text-neutral-100">{describeClause(clause)}</div>
          <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-neutral-500">
            {rounds && rounds.length > 0 && (
              <span>
                {clause.chanceByLevel ? "rolls" : "active"} R{formatRounds(rounds)}
              </span>
            )}
            {clause.enhancedBy && <span>enhanced by {clause.enhancedBy}</span>}
            {clause.stack && <span>per stack (max {clause.stack.max})</span>}
            {clause.rollGroup != null && <span>shared roll #{clause.rollGroup}</span>}
            {clause.boosts.length > 0 && <span className="text-violet-300">{clause.boosts.length} boost{clause.boosts.length > 1 ? "s" : ""}</span>}
            {clause.bestAgainst.length > 0 && <span className="text-sky-300">best vs {clause.bestAgainst.join(", ")}</span>}
            {clause.skip && <span className="text-amber-400">skipped: {clause.skip}</span>}
            {clause.note && <span className="italic">{clause.note}</span>}
          </div>
        </button>
        <div className="flex shrink-0 gap-3">
          <button className={linkBtn} onClick={() => setOpen((o) => !o)}>
            {open ? "Done" : "Edit"}
          </button>
          <button className="text-xs text-neutral-500 underline hover:text-red-400" onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-3 border-t border-neutral-800 pt-3 text-sm">
          <Field label="Kind">
            <select className={inputCls} value={clause.kind} onChange={(e) => patch({ kind: e.target.value as Clause["kind"], what: [] })}>
              {KIND_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="What">
            <WhatEditor clause={clause} onChange={(what) => patch({ what })} />
          </Field>
          <Field label="Target">
            <TargetEditor value={clause.target} onChange={(target) => patch({ target })} />
          </Field>
          <Field label="When">
            <TimingEditor clause={clause} onChange={patch} />
          </Field>
          <div className="flex flex-wrap gap-6">
            <LevelGrid
              label="Value % (signed: − lowers it, e.g. Damage Received −4)"
              values={clause.valueByLevel}
              onCommit={(v) => patch({ valueByLevel: v.some((x) => x != null) ? v : undefined })}
              onClear={() => patch({ valueByLevel: undefined })}
            />
            <LevelGrid
              label="Chance % (blank = guaranteed)"
              values={clause.chanceByLevel}
              onCommit={(v) => patch({ chanceByLevel: v.some((x) => x != null) ? v : undefined })}
              onClear={() => patch({ chanceByLevel: undefined })}
            />
          </div>
          <Field label="Conditions">
            <div className="flex flex-col gap-1">
              {clause.conditions.map((c, i) => (
                <ConditionRow
                  key={i}
                  value={c}
                  onChange={(next) => patch({ conditions: clause.conditions.map((x, j) => (j === i ? next : x)) })}
                  onRemove={() => patch({ conditions: clause.conditions.filter((_, j) => j !== i) })}
                />
              ))}
              <button className={`${linkBtn} self-start`} onClick={() => patch({ conditions: [...clause.conditions, { scope: "target", value: "" }] })}>
                + condition
              </button>
            </div>
          </Field>
          <Field label="Boosts">
            <div className="flex flex-col gap-2">
              {clause.boosts.map((b, i) => (
                <BoostRow
                  key={i}
                  value={b}
                  onChange={(next) => patch({ boosts: clause.boosts.map((x, j) => (j === i ? next : x)) })}
                  onRemove={() => patch({ boosts: clause.boosts.filter((_, j) => j !== i) })}
                />
              ))}
              <button className={`${linkBtn} self-start`} onClick={() => patch({ boosts: [...clause.boosts, {}] })}>
                + boost
              </button>
            </div>
          </Field>
          <div className="flex flex-wrap items-center gap-4">
            <Field label="Enhanced by">
              <select className={inputCls} value={clause.enhancedBy ?? ""} onChange={(e) => patch({ enhancedBy: e.target.value || undefined })}>
                <option value="">—</option>
                {STATS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Shared roll #">
              <input
                type="number"
                className={`${inputCls} w-14`}
                value={clause.rollGroup ?? ""}
                onChange={(e) => patch({ rollGroup: e.target.value === "" ? undefined : Number(e.target.value) })}
              />
            </Field>
            <Field label="Stacks (max)">
              <input
                type="number"
                className={`${inputCls} w-14`}
                value={clause.stack?.max ?? ""}
                onChange={(e) => patch({ stack: e.target.value === "" ? undefined : { ...clause.stack, max: Number(e.target.value) } })}
              />
            </Field>
            <Field label="Skip">
              <select className={inputCls} value={clause.skip ?? ""} onChange={(e) => patch({ skip: e.target.value || undefined })}>
                <option value="">— (counts)</option>
                {SKIP_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {clause.stack && (
            <LevelGrid
              label="Chance % to gain a stack each roll (blank = guaranteed)"
              values={clause.stack.chanceByLevel}
              onCommit={(v) => patch({ stack: { max: clause.stack!.max, chanceByLevel: v.some((x) => x != null) ? v : undefined } })}
            />
          )}
          <Field label="Best against">
            <TextField
              className="w-full"
              value={clause.bestAgainst.join(", ")}
              placeholder="e.g. High-recovery armies, Fire damage dealers"
              onCommit={(v) => patch({ bestAgainst: v.split(",").map((s) => s.trim()).filter(Boolean) })}
            />
          </Field>
          <Field label="Note">
            <TextField className="w-full" value={clause.note ?? ""} onCommit={(v) => patch({ note: v || undefined })} />
          </Field>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 shrink-0 text-xs font-semibold uppercase text-neutral-500">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const NEW_CLAUSE: Clause = { kind: "stat", what: [], target: { side: "self" }, timing: { mode: "combat" }, conditions: [], boosts: [], bestAgainst: [] };

function SkillEditor({
  dragon,
  slot,
  skill,
  onBack,
  onChangeDragon,
}: {
  dragon: Dragon;
  slot: number;
  skill: SkillDoc | undefined;
  onBack: () => void;
  onChangeDragon: () => void;
}) {
  const save = useMutation(api.habitCapabilities.save);
  const clauses = skill?.clauses ?? [];
  const texts = skillText(dragon.name, slot);
  const star = slot === COMMAND_SLOT ? 1 : MODEL.HABIT_UNLOCK_STARS[slot - 1];

  function saveClauses(next: Clause[]) {
    void save({ dragonId: dragon._id, habitSlot: slot, clauses: next });
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <AdminNav current="/admin/habit-builder" />
      <datalist id="effect-ids">
        {EFFECT_OPTIONS.map((id) => (
          <option key={id} value={id} />
        ))}
      </datalist>
      <div className="mb-4 flex items-center gap-4 text-sm">
        <button className="text-neutral-400 underline hover:text-neutral-200" onClick={onChangeDragon}>
          ← Dragons
        </button>
        <button className="text-neutral-400 underline hover:text-neutral-200" onClick={onBack}>
          ← Skills
        </button>
      </div>

      <h1 className="mb-1 text-xl font-bold">
        {dragon.name} — {skillLabel(slot)}
      </h1>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
        <span>★{star} to unlock · {dragon.rarity} · {dragon.breed}</span>
        {slot !== COMMAND_SLOT && (
          <label className="flex items-center gap-1 text-amber-300">
            <input
              type="checkbox"
              checked={skill?.isCommandHabit ?? false}
              onChange={(e) => void save({ dragonId: dragon._id, habitSlot: slot, isCommandHabit: e.target.checked })}
            />
            Command habit (modifies or adds to the Command)
          </label>
        )}
      </div>

      <div className="sticky top-0 z-10 mb-6 rounded-lg border border-neutral-800 bg-neutral-950/95 p-4 shadow-lg shadow-black/40 backdrop-blur">
        <h2 className="mb-2 text-sm font-semibold text-neutral-200">{slot === COMMAND_SLOT ? "Command text" : "Description (by level)"}</h2>
        {texts.length ? (
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-300">
            {texts.map((d, i) => (
              <li key={i} className="min-w-[180px] flex-1">
                {texts.length > 1 && <span className="text-xs font-semibold text-neutral-500">Lv{i + 1}:</span>} {d}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">No text found for this skill.</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {clauses.map((c, i) => (
          <ClauseCard
            key={i}
            clause={c}
            onChange={(next) => saveClauses(clauses.map((x, j) => (j === i ? next : x)))}
            onRemove={() => saveClauses(clauses.filter((_, j) => j !== i))}
          />
        ))}
        <button
          className="self-start rounded border border-dashed border-neutral-700 px-3 py-1.5 text-sm text-neutral-400 hover:border-violet-500 hover:text-violet-200"
          onClick={() => saveClauses([...clauses, NEW_CLAUSE])}
        >
          + Add clause
        </button>
      </div>
    </div>
  );
}

export function HabitBuilder() {
  const dragons = useQuery(api.dragons.list);
  const [dragonId, setDragonId] = useState<Id<"dragons"> | null>(null);
  const [slot, setSlot] = useState<number | null>(null);

  const dragon = dragons?.find((d) => d._id === dragonId) ?? null;
  const skills = useQuery(api.habitCapabilities.listForDragon, dragon ? { dragonId: dragon._id } : "skip");

  if (!dragon) return <DragonList dragons={dragons} onSelect={setDragonId} />;

  if (slot == null) return <SkillPicker dragon={dragon} skills={skills} onSelect={setSlot} onBack={() => setDragonId(null)} />;

  return (
    <SkillEditor
      dragon={dragon}
      slot={slot}
      skill={skills?.find((s) => s.habitSlot === slot)}
      onBack={() => setSlot(null)}
      onChangeDragon={() => {
        setDragonId(null);
        setSlot(null);
      }}
    />
  );
}
