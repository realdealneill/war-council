import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { AdminNav } from "../components/AdminNav";
import { HABIT_TEXT, MODEL } from "../data";

const ROUNDS = Array.from({ length: 10 }, (_, i) => i + 1);

type PctFieldKey =
  | "fireDmgReceivedPct"
  | "tacticalDmgReceivedPct"
  | "physicalDmgReceivedPct"
  | "enemyStrengthReducedPct"
  | "enemyInitiativeReducedPct"
  | "enemyIntelligenceReducedPct"
  | "enemyInstinctReducedPct"
  | "selfTacticalIncreasePct"
  | "selfPhysicalIncreasePct"
  | "selfFireIncreasePct"
  | "selfStrengthIncreasePct"
  | "selfInitiativeIncreasePct"
  | "selfIntelligenceIncreasePct"
  | "selfInstinctIncreasePct"
  | "selfDamageReductionPct"
  | "allyTacticalIncreasePct"
  | "allyPhysicalIncreasePct"
  | "allyFireIncreasePct"
  | "allyStrengthIncreasePct"
  | "allyInitiativeIncreasePct"
  | "allyIntelligenceIncreasePct"
  | "allyInstinctIncreasePct"
  | "allyDamageReductionPct";

const TARGET_COUNTS = [1, 2, 3] as const;

// See convex/schema.ts's `allyTarget` — a headcount (game picks which
// ally/allies) is kept distinct from a specific lane (a guaranteed hit on
// whoever's placed there) since the synergy engine will need to treat them
// differently later.
type AllyTarget = { kind: "count"; count: 1 | 2 | 3 } | { kind: "lane"; lane: "left" | "right" | "vanguard" };
const ALLY_LANES: { key: "left" | "right" | "vanguard"; label: string }[] = [
  { key: "left", label: "Left Flank" },
  { key: "right", label: "Right Flank" },
  { key: "vanguard", label: "Vanguard" },
];

const ENEMY_PCT_ROWS: { key: PctFieldKey; label: string }[] = [
  { key: "fireDmgReceivedPct", label: "Enemy Fire Damage Received" },
  { key: "tacticalDmgReceivedPct", label: "Enemy Tactical Damage Received" },
  { key: "physicalDmgReceivedPct", label: "Enemy Physical Damage Received" },
  { key: "enemyStrengthReducedPct", label: "Enemy Strength Reduced" },
  { key: "enemyInitiativeReducedPct", label: "Enemy Initiative Reduced" },
  { key: "enemyIntelligenceReducedPct", label: "Enemy Intelligence Reduced" },
  { key: "enemyInstinctReducedPct", label: "Enemy Instinct Reduced" },
];

const SELF_PCT_ROWS: { key: PctFieldKey; label: string }[] = [
  { key: "selfTacticalIncreasePct", label: "Self Tactical Increase" },
  { key: "selfPhysicalIncreasePct", label: "Self Physical Increase" },
  { key: "selfFireIncreasePct", label: "Self Fire Increase" },
  { key: "selfStrengthIncreasePct", label: "Self Strength Increase" },
  { key: "selfInitiativeIncreasePct", label: "Self Initiative Increase" },
  { key: "selfIntelligenceIncreasePct", label: "Self Intelligence Increase" },
  { key: "selfInstinctIncreasePct", label: "Self Instinct Increase" },
  { key: "selfDamageReductionPct", label: "Self Damage Reduction" },
];

const ALLY_PCT_ROWS: { key: PctFieldKey; label: string }[] = [
  { key: "allyTacticalIncreasePct", label: "Ally Tactical Increase" },
  { key: "allyPhysicalIncreasePct", label: "Ally Physical Increase" },
  { key: "allyFireIncreasePct", label: "Ally Fire Increase" },
  { key: "allyStrengthIncreasePct", label: "Ally Strength Increase" },
  { key: "allyInitiativeIncreasePct", label: "Ally Initiative Increase" },
  { key: "allyIntelligenceIncreasePct", label: "Ally Intelligence Increase" },
  { key: "allyInstinctIncreasePct", label: "Ally Instinct Increase" },
  { key: "allyDamageReductionPct", label: "Ally Damage Reduction" },
];

const ALL_PCT_ROWS = [...ENEMY_PCT_ROWS, ...SELF_PCT_ROWS, ...ALLY_PCT_ROWS];

const EMPTY_ROW: (number | null)[] = [null, null, null, null, null];

// The dropdown options for "Requires Effect" / "Buffed by Effect", pulled
// from the same effect catalog the rest of the app uses (MODEL.EFFECTS —
// see src/engine/effects.ts and the EffectId union in src/types.ts), so this
// never needs its own separate list to maintain.
const EFFECT_LABELS: Record<string, string> = {};
for (const group of [MODEL.EFFECTS.applies, MODEL.EFFECTS.grants]) {
  for (const [id, full] of Object.entries(group)) {
    if (!(id in EFFECT_LABELS)) EFFECT_LABELS[id] = full.split(" — ")[0];
  }
}
const EFFECT_OPTIONS = Object.keys(EFFECT_LABELS).sort((a, b) => EFFECT_LABELS[a].localeCompare(EFFECT_LABELS[b]));

type EffectLink = { requiresEffect?: string; buffedByEffect?: string };

const TABS = [
  { key: "enemy", label: "Enemy effects" },
  { key: "self", label: "Self modifiers" },
  { key: "ally", label: "Ally modifiers" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

type Dragon = Doc<"dragons">;
type Capability = Doc<"habitCapabilities">;

function DragonList({ dragons, onSelect }: { dragons: Dragon[] | undefined; onSelect: (id: Id<"dragons">) => void }) {
  const [query, setQuery] = useState("");
  const sorted = [...(dragons ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const filtered = sorted.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <AdminNav current="/admin/habit-builder" />
      <h1 className="mb-1 text-xl font-bold">Habit Capabilities Builder</h1>
      <p className="mb-4 text-sm text-neutral-500">Pick a dragon, then one of its 5 habits, to enter structured data for it.</p>
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

function HabitSlotPicker({
  dragon,
  capabilities,
  onSelect,
  onBack,
}: {
  dragon: Dragon;
  capabilities: Capability[] | undefined;
  onSelect: (slot: number) => void;
  onBack: () => void;
}) {
  const habitList = HABIT_TEXT[dragon.name] ?? [];

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <AdminNav current="/admin/habit-builder" />
      <button className="mb-4 text-sm text-neutral-400 underline hover:text-neutral-200" onClick={onBack}>
        ← Back to dragons
      </button>
      <h1 className="mb-1 text-xl font-bold">{dragon.name}</h1>
      <p className="mb-4 text-sm text-neutral-500">{dragon.rarity} · {dragon.breed} · {dragon.role} — pick a habit.</p>

      <ul className="flex max-w-xl flex-col gap-2">
        {MODEL.HABIT_UNLOCK_STARS.map((star, i) => {
          const slot = i + 1;
          const habit = habitList[i];
          const cap = capabilities?.find((c) => c.habitSlot === slot);
          const hasData =
            !!cap &&
            ((cap.activeRounds?.length ?? 0) > 0 ||
              cap.enemyTargetCount != null ||
              cap.allyTarget != null ||
              (cap.effectLinks != null && Object.keys(cap.effectLinks).length > 0) ||
              ALL_PCT_ROWS.some(({ key }) => cap[key]?.some((v) => v != null)));
          return (
            <li key={slot}>
              <button
                className="flex w-full items-center justify-between gap-3 rounded border border-neutral-800 px-3 py-2 text-left text-sm hover:bg-neutral-900"
                onClick={() => onSelect(slot)}
              >
                <span>
                  <span className="font-medium">Habit {slot}</span>{" "}
                  <span className="text-xs text-neutral-500">★{star} to unlock</span>
                  {habit && <div className="text-xs text-neutral-500">{habit.short[0]}</div>}
                </span>
                {hasData && <span className="shrink-0 text-xs text-emerald-400">configured</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RoundsPicker({ value, onChange }: { value: number[]; onChange: (rounds: number[]) => void }) {
  const set = new Set(value);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-neutral-500">Active rounds</h3>
        <div className="flex gap-2">
          <button className="text-xs text-violet-300 underline hover:text-violet-200" onClick={() => onChange(ROUNDS)}>
            Select all
          </button>
          <button className="text-xs text-neutral-500 underline hover:text-neutral-300" onClick={() => onChange([])}>
            Clear all
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {ROUNDS.map((r) => (
          <label key={r} className="flex items-center gap-1 rounded border border-neutral-800 px-2 py-1 text-sm">
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
    </div>
  );
}

function TargetCountPicker({ value, onChange }: { value: 1 | 2 | 3 | undefined; onChange: (count: 1 | 2 | 3) => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase text-neutral-500">Targets</h3>
      <div className="flex gap-1">
        {TARGET_COUNTS.map((n) => (
          <button
            key={n}
            className={`rounded border px-2 py-0.5 text-sm ${
              value === n ? "border-violet-500 bg-violet-950/40 text-violet-200" : "border-neutral-700 text-neutral-400 hover:bg-neutral-900"
            }`}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function targetButtonClass(active: boolean) {
  return `rounded border px-2 py-0.5 text-sm ${
    active ? "border-violet-500 bg-violet-950/40 text-violet-200" : "border-neutral-700 text-neutral-400 hover:bg-neutral-900"
  }`;
}

function AllyTargetPicker({ value, onChange }: { value: AllyTarget | undefined; onChange: (target: AllyTarget) => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-xs font-semibold uppercase text-neutral-500">Targets</h3>
      <div className="flex flex-wrap items-center gap-1">
        {TARGET_COUNTS.map((n) => (
          <button
            key={`count-${n}`}
            className={targetButtonClass(value?.kind === "count" && value.count === n)}
            onClick={() => onChange({ kind: "count", count: n })}
          >
            {n} {n === 1 ? "Ally" : "Allies"}
          </button>
        ))}
        <span className="mx-1 text-neutral-700">|</span>
        {ALLY_LANES.map((lane) => (
          <button
            key={lane.key}
            className={targetButtonClass(value?.kind === "lane" && value.lane === lane.key)}
            onClick={() => onChange({ kind: "lane", lane: lane.key })}
          >
            {lane.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EffectSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-neutral-500">
      {label}
      <select
        className="rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5 text-xs text-neutral-300"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
      >
        <option value="">—</option>
        {EFFECT_OPTIONS.map((id) => (
          <option key={id} value={id}>
            {EFFECT_LABELS[id]}
          </option>
        ))}
      </select>
    </label>
  );
}

function PctRow({
  label,
  values,
  effectLink,
  onCommit,
  onClear,
  onEffectLinkChange,
}: {
  label: string;
  values: (number | null)[];
  effectLink: EffectLink | undefined;
  onCommit: (values: (number | null)[]) => void;
  onClear: () => void;
  onEffectLinkChange: (patch: EffectLink) => void;
}) {
  const [local, setLocal] = useState(values);
  useEffect(() => setLocal(values), [values]);

  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm text-neutral-300">{label}</span>
        <button className="text-xs text-neutral-500 underline hover:text-red-400" onClick={onClear}>
          Clear row
        </button>
      </div>
      <div className="mb-1.5 flex flex-wrap gap-3">
        <EffectSelect
          label="Requires"
          value={effectLink?.requiresEffect}
          onChange={(v) => onEffectLinkChange({ requiresEffect: v })}
        />
        <EffectSelect
          label="Buffed by"
          value={effectLink?.buffedByEffect}
          onChange={(v) => onEffectLinkChange({ buffedByEffect: v })}
        />
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
              placeholder="%"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function HabitSlotEditor({
  dragon,
  habitSlot,
  capability,
  onBack,
  onChangeDragon,
}: {
  dragon: Dragon;
  habitSlot: number;
  capability: Capability | undefined;
  onBack: () => void;
  onChangeDragon: () => void;
}) {
  const upsert = useMutation(api.habitCapabilities.upsert);
  const idx = habitSlot - 1;
  const habit = (HABIT_TEXT[dragon.name] ?? [])[idx];
  const unlockStar = MODEL.HABIT_UNLOCK_STARS[idx];

  const [activeRounds, setActiveRounds] = useState<number[]>(capability?.activeRounds ?? []);
  useEffect(() => {
    setActiveRounds(capability?.activeRounds ?? []);
  }, [dragon._id, habitSlot, capability]);

  const [activeTab, setActiveTab] = useState<TabKey>("enemy");
  useEffect(() => {
    setActiveTab("enemy");
  }, [dragon._id, habitSlot]);

  function save(patch: Partial<Pick<Capability, "activeRounds" | "enemyTargetCount" | "allyTarget" | "effectLinks" | PctFieldKey>>) {
    void upsert({ dragonId: dragon._id, habitSlot, ...patch });
  }

  function saveEffectLink(rowKey: PctFieldKey, patch: EffectLink) {
    const links = capability?.effectLinks ?? {};
    save({ effectLinks: { ...links, [rowKey]: { ...links[rowKey], ...patch } } });
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <AdminNav current="/admin/habit-builder" />
      <div className="mb-4 flex items-center gap-4 text-sm">
        <button className="text-neutral-400 underline hover:text-neutral-200" onClick={onChangeDragon}>
          ← Dragons
        </button>
        <button className="text-neutral-400 underline hover:text-neutral-200" onClick={onBack}>
          ← Habits
        </button>
      </div>

      <h1 className="mb-1 text-xl font-bold">{dragon.name} — Habit {habitSlot}</h1>
      <p className="mb-4 text-sm text-neutral-500">★{unlockStar} to unlock · {dragon.rarity} · {dragon.breed}</p>

      <div className="sticky top-0 z-10 mb-6 rounded-lg border border-neutral-800 bg-neutral-950/95 p-4 shadow-lg shadow-black/40 backdrop-blur">
        <h2 className="mb-2 text-sm font-semibold text-neutral-200">Description (by level)</h2>
        {habit ? (
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-300">
            {habit.desc.map((d, i) => (
              <li key={i} className="min-w-[180px] flex-1">
                <span className="text-xs font-semibold text-neutral-500">Lv{i + 1}:</span> {d}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">No habit text found for this dragon/slot.</p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
          <RoundsPicker
            value={activeRounds}
            onChange={(rounds) => {
              setActiveRounds(rounds);
              save({ activeRounds: rounds });
            }}
          />
        </div>

        <div className="flex gap-1 border-b border-neutral-800 text-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`-mb-px rounded-t px-3 py-1.5 border-b-2 ${
                activeTab === t.key
                  ? "border-violet-500 text-violet-200"
                  : "border-transparent text-neutral-400 hover:text-neutral-200"
              }`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
          {activeTab === "enemy" && (
            <>
              <TargetCountPicker value={capability?.enemyTargetCount} onChange={(count) => save({ enemyTargetCount: count })} />
              {ENEMY_PCT_ROWS.map(({ key, label }) => (
                <PctRow
                  key={key}
                  label={label}
                  values={capability?.[key] ?? EMPTY_ROW}
                  effectLink={capability?.effectLinks?.[key]}
                  onCommit={(values) => save({ [key]: values } as never)}
                  onClear={() => save({ [key]: EMPTY_ROW } as never)}
                  onEffectLinkChange={(patch) => saveEffectLink(key, patch)}
                />
              ))}
            </>
          )}
          {activeTab === "self" && (
            <>
              {SELF_PCT_ROWS.map(({ key, label }) => (
                <PctRow
                  key={key}
                  label={label}
                  values={capability?.[key] ?? EMPTY_ROW}
                  effectLink={capability?.effectLinks?.[key]}
                  onCommit={(values) => save({ [key]: values } as never)}
                  onClear={() => save({ [key]: EMPTY_ROW } as never)}
                  onEffectLinkChange={(patch) => saveEffectLink(key, patch)}
                />
              ))}
            </>
          )}
          {activeTab === "ally" && (
            <>
              <AllyTargetPicker value={capability?.allyTarget} onChange={(target) => save({ allyTarget: target })} />
              {ALLY_PCT_ROWS.map(({ key, label }) => (
                <PctRow
                  key={key}
                  label={label}
                  values={capability?.[key] ?? EMPTY_ROW}
                  effectLink={capability?.effectLinks?.[key]}
                  onCommit={(values) => save({ [key]: values } as never)}
                  onClear={() => save({ [key]: EMPTY_ROW } as never)}
                  onEffectLinkChange={(patch) => saveEffectLink(key, patch)}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function HabitBuilder() {
  const dragons = useQuery(api.dragons.list);
  const [dragonId, setDragonId] = useState<Id<"dragons"> | null>(null);
  const [habitSlot, setHabitSlot] = useState<number | null>(null);

  const dragon = dragons?.find((d) => d._id === dragonId) ?? null;
  const capabilities = useQuery(api.habitCapabilities.listForDragon, dragon ? { dragonId: dragon._id } : "skip");

  if (!dragon) {
    return <DragonList dragons={dragons} onSelect={setDragonId} />;
  }

  if (habitSlot == null) {
    return (
      <HabitSlotPicker
        dragon={dragon}
        capabilities={capabilities}
        onSelect={setHabitSlot}
        onBack={() => setDragonId(null)}
      />
    );
  }

  return (
    <HabitSlotEditor
      dragon={dragon}
      habitSlot={habitSlot}
      capability={capabilities?.find((c) => c.habitSlot === habitSlot)}
      onBack={() => setHabitSlot(null)}
      onChangeDragon={() => {
        setDragonId(null);
        setHabitSlot(null);
      }}
    />
  );
}
