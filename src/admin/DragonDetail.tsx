import { useState } from "react";
import { MODEL } from "../data";
import type { Doc } from "../../convex/_generated/dataModel";
import type { Rarity } from "../types";

// Per Neill: rare/epic/legendary get +10%/+15%/+20% of base per star, and
// that extra starts applying at ★2 and up — a base of 100 becomes
// 110/115/120 at ★2, then keeps climbing by the same rate each star after
// that (★1 stays at base). Stats don't move with Level at all. Mythic
// (25%) is extrapolated from the +5%-per-tier pattern, not yet real.
const DEFAULT_STAT_STAR_PCT: Record<Rarity, number> = { rare: 0.1, epic: 0.15, legendary: 0.2, mythic: 0.25 };

// ★7-10 each give an extra bonus on top of the rarity rate — for stats this
// is confirmed (it's what reconciles the legendary 20% base rate with real
// ★7/★8 data: ★2-6 contribute 20% each, ★7/★8 contribute 25% each). Power
// uses the same shape as a starting hypothesis, not yet confirmed.
const LATE_STAR_THRESHOLD = 7;
const DEFAULT_LATE_STAR_BONUS_PCT = 0.05;

// Power's rarity coefficient and star rate — seeded from the existing (already
// somewhat-verified, ~5%-accurate per its own original comment) engine
// formula and the same per-rarity pattern the stats turned out to have, but
// this whole page is an explicit, separate calculation Neill is refitting —
// see the component doc comment below.
const DEFAULT_POWER_RARITY_BASE: Record<Rarity, number> = { rare: 300, epic: 410, legendary: 540, mythic: 700 };
const DEFAULT_POWER_STAR_PCT: Record<Rarity, number> = { rare: 0.1, epic: 0.15, legendary: 0.2, mythic: 0.25 };

const STAT_KEYS = ["baseStrength", "baseInstinct", "baseIntelligence", "baseInitiative"] as const;
const STAT_LABELS: Record<(typeof STAT_KEYS)[number], string> = {
  baseStrength: "Strength",
  baseInstinct: "Instinct",
  baseIntelligence: "Intelligence",
  baseInitiative: "Initiative",
};

const MAX_STAR = 10;

/** Regular vs. late (★7+) star counts, and the resulting bonus %, for a flat "pct per star from ★2 on, +extra for ★7-10" model. */
function tieredStarBonus(starRank: number, pct: number, lateExtraPct: number) {
  const bonusStars = Math.max(0, starRank - 1);
  const lateStars = Math.max(0, starRank - (LATE_STAR_THRESHOLD - 1));
  const regularStars = bonusStars - lateStars;
  return { regularStars, lateStars, bonusPct: regularStars * pct + lateStars * (pct + lateExtraPct) };
}

function RarityTable({
  values,
  onChange,
  current,
  step = 0.01,
}: {
  values: Record<Rarity, number>;
  onChange: (rarity: Rarity, value: number) => void;
  current: Rarity;
  step?: number;
}) {
  return (
    <>
      {(Object.keys(values) as Rarity[]).map((rarity) => (
        <label
          key={rarity}
          className={`mb-2 flex items-center justify-between gap-2 text-sm ${rarity === current ? "text-violet-300" : ""}`}
        >
          {rarity} {rarity === current && "←"}
          <input
            type="number"
            step={step}
            value={values[rarity]}
            onChange={(e) => onChange(rarity, Number(e.target.value) || 0)}
            className="w-20 rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 text-right"
          />
        </label>
      ))}
    </>
  );
}

/**
 * A pure client-side "what if" sandbox — nothing here writes to Convex.
 * Nothing in engine/ uses either formula below yet: Power and Stats are
 * each their own separate, fully-tunable calculation kept apart from the
 * real scoring engine until confirmed against the live game client, so
 * experimenting here can't silently change army scores elsewhere in the app.
 */
export function DragonDetail({ dragon, onBack }: { dragon: Doc<"dragons">; onBack: () => void }) {
  const [starRank, setStarRank] = useState(3);
  const [level, setLevel] = useState(15);
  const [habitLevels, setHabitLevels] = useState<number[]>([1, 1, 1, 1, 1]);

  // --- Power: rarityBase(rarity) × starMult(rarity, star) × level × habitMult ---
  const [powerRarityBase, setPowerRarityBase] = useState<Record<Rarity, number>>(DEFAULT_POWER_RARITY_BASE);
  const [powerStarPctByRarity, setPowerStarPctByRarity] = useState<Record<Rarity, number>>(DEFAULT_POWER_STAR_PCT);
  const [powerLateStarBonusPct, setPowerLateStarBonusPct] = useState(DEFAULT_LATE_STAR_BONUS_PCT);
  const [powerHabitPct, setPowerHabitPct] = useState(0.01);

  // --- Stats: base × starMult(rarity, star) only — no Level, no Habits ---
  const [statStarPctByRarity, setStatStarPctByRarity] = useState<Record<Rarity, number>>(DEFAULT_STAT_STAR_PCT);
  const [lateStarBonusPct, setLateStarBonusPct] = useState(DEFAULT_LATE_STAR_BONUS_PCT);

  const unlockedHabits = MODEL.HABIT_UNLOCK_STARS.map((req) => starRank >= req);
  const totalHabitLevels = habitLevels.reduce((sum, lvl, i) => sum + (unlockedHabits[i] ? lvl : 0), 0);

  // Power
  const rarityBase = powerRarityBase[dragon.rarity];
  const powerStar = tieredStarBonus(starRank, powerStarPctByRarity[dragon.rarity], powerLateStarBonusPct);
  const powerStarMult = 1 + powerStar.bonusPct;
  const powerHabitMult = 1 + powerHabitPct * totalHabitLevels;
  const rawPower = rarityBase * powerStarMult * level * powerHabitMult;
  const totalPower = Math.round(rawPower / 10) * 10;

  // Stats
  const statStar = tieredStarBonus(starRank, statStarPctByRarity[dragon.rarity], lateStarBonusPct);
  const statMult = 1 + statStar.bonusPct;

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <button className="mb-4 text-sm text-neutral-400 underline hover:text-neutral-200" onClick={onBack}>
        ← Back to list
      </button>

      <h1 className="mb-1 text-xl font-bold">{dragon.name}</h1>
      <p className="mb-6 text-sm text-neutral-500">
        {dragon.rarity} · {dragon.breed} · {dragon.role} — this is a scratch calculator, nothing here saves.
      </p>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Controls */}
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
            <h2 className="mb-3 text-sm font-semibold text-neutral-200">Dragon state</h2>

            <label className="mb-3 flex items-center justify-between gap-2 text-sm">
              Star Rank
              <input
                type="range"
                min={1}
                max={MAX_STAR}
                value={starRank}
                onChange={(e) => setStarRank(Number(e.target.value))}
                className="mx-2 flex-1"
              />
              <span className="w-6 text-right">{starRank}</span>
            </label>

            <label className="mb-3 flex items-center justify-between gap-2 text-sm">
              Level
              <input
                type="number"
                min={1}
                value={level}
                onChange={(e) => setLevel(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 text-right"
              />
            </label>

            <h3 className="mb-2 mt-4 text-xs font-semibold uppercase text-neutral-500">Habits</h3>
            {MODEL.HABIT_UNLOCK_STARS.map((req, i) => (
              <label key={i} className="mb-2 flex items-center justify-between gap-2 text-sm">
                <span className={unlockedHabits[i] ? "" : "text-neutral-600"}>
                  Habit {i + 1} {!unlockedHabits[i] && `(★${req} to unlock)`}
                </span>
                <select
                  className="rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 disabled:opacity-40"
                  disabled={!unlockedHabits[i]}
                  value={habitLevels[i]}
                  onChange={(e) =>
                    setHabitLevels((prev) => prev.map((v, idx) => (idx === i ? Number(e.target.value) : v)))
                  }
                >
                  {Array.from({ length: MODEL.HABIT_MAX_LEVEL }, (_, lvl) => lvl + 1).map((lvl) => (
                    <option key={lvl} value={lvl}>Lv {lvl}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
            <h2 className="mb-1 text-sm font-semibold text-neutral-200">Power growth-rate guesses</h2>
            <p className="mb-2 text-xs text-neutral-500">
              Totally separate from Stats below — its own rarity base, star rate, and habit rate.
            </p>
            <h3 className="mb-1 text-xs font-semibold uppercase text-neutral-500">Rarity base power</h3>
            <RarityTable values={powerRarityBase} current={dragon.rarity} step={10} onChange={(r, v) => setPowerRarityBase((p) => ({ ...p, [r]: v }))} />
            <h3 className="mb-1 mt-3 text-xs font-semibold uppercase text-neutral-500">Power % per star (from ★2 on)</h3>
            <RarityTable values={powerStarPctByRarity} current={dragon.rarity} onChange={(r, v) => setPowerStarPctByRarity((p) => ({ ...p, [r]: v }))} />
            <label className="mb-2 mt-3 flex items-center justify-between gap-2 text-sm">
              Extra power % for ★{LATE_STAR_THRESHOLD}–{MAX_STAR}
              <input type="number" step={0.01} value={powerLateStarBonusPct} onChange={(e) => setPowerLateStarBonusPct(Number(e.target.value) || 0)} className="w-20 rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 text-right" />
            </label>
            <label className="flex items-center justify-between gap-2 text-sm">
              Power % per habit level
              <input type="number" step={0.005} value={powerHabitPct} onChange={(e) => setPowerHabitPct(Number(e.target.value) || 0)} className="w-20 rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 text-right" />
            </label>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
            <h2 className="mb-3 text-sm font-semibold text-neutral-200">Stat growth-rate guesses</h2>
            <h3 className="mb-1 text-xs font-semibold uppercase text-neutral-500">Stat % per star (from ★2 on)</h3>
            <RarityTable values={statStarPctByRarity} current={dragon.rarity} onChange={(r, v) => setStatStarPctByRarity((p) => ({ ...p, [r]: v }))} />
            <label className="mb-2 mt-3 flex items-center justify-between gap-2 text-sm">
              Extra stat % for ★{LATE_STAR_THRESHOLD}–{MAX_STAR}
              <input type="number" step={0.01} value={lateStarBonusPct} onChange={(e) => setLateStarBonusPct(Number(e.target.value) || 0)} className="w-20 rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 text-right" />
            </label>
            <p className="mt-2 text-xs text-neutral-500">
              Stats don't move with Level or Habits. Mythic (25%) is extrapolated from the +5%-per-tier pattern — not yet real.
            </p>
          </div>
        </div>

        {/* Results */}
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-violet-800 bg-violet-950/20 p-4">
            <h2 className="mb-2 text-sm font-semibold text-violet-200">Total Power</h2>
            <div className="font-mono text-xs text-neutral-400">
              {rarityBase.toLocaleString()} (★{dragon.rarity} base)
              {" × "}
              {powerStarMult.toFixed(3)} (1 + {powerStarPctByRarity[dragon.rarity]}×{powerStar.regularStars} stars ★2–{LATE_STAR_THRESHOLD - 1}
              {powerStar.lateStars > 0 && <> + {(powerStarPctByRarity[dragon.rarity] + powerLateStarBonusPct).toFixed(2)}×{powerStar.lateStars} stars ★{LATE_STAR_THRESHOLD}+</>})
            </div>
            <div className="font-mono text-xs text-neutral-400">
              × {level} (level) × {powerHabitMult.toFixed(3)} (1 + {powerHabitPct}×{totalHabitLevels} habit levels)
            </div>
            <div className="mt-2 text-2xl font-bold text-neutral-100">{totalPower.toLocaleString()}</div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
            <h2 className="mb-2 text-sm font-semibold text-neutral-200">Stats</h2>
            <div className="mb-2 font-mono text-xs text-neutral-500">
              projected = base × (1 + {statStarPctByRarity[dragon.rarity]}×{statStar.regularStars} stars ★2–{LATE_STAR_THRESHOLD - 1}
              {statStar.lateStars > 0 && <> + {(statStarPctByRarity[dragon.rarity] + lateStarBonusPct).toFixed(2)}×{statStar.lateStars} stars ★{LATE_STAR_THRESHOLD}+</>}
              ) = base × {statMult.toFixed(3)}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th className="py-1">Stat</th>
                  <th className="py-1 text-right">Base</th>
                  <th className="py-1 text-right">Projected</th>
                </tr>
              </thead>
              <tbody>
                {STAT_KEYS.map((key) => {
                  const base = dragon[key];
                  const projected = base != null ? Math.round(base * statMult) : null;
                  const delta = projected != null ? projected - base! : null;
                  return (
                    <tr key={key} className="border-t border-neutral-900">
                      <td className="py-1">{STAT_LABELS[key]}</td>
                      <td className="py-1 text-right text-neutral-400">{base ?? "—"}</td>
                      <td className="py-1 text-right font-semibold">
                        {projected != null ? (
                          <>
                            {projected.toLocaleString()}
                            {delta! > 0 && <span className="ml-1 font-normal text-emerald-400">(+{delta!.toLocaleString()})</span>}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-neutral-500">
              "Base" is whatever you entered on the list page for this dragon at ★1 — every star from ★2 on
              adds one more rarity-rate step. Blank stats show as "—".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
