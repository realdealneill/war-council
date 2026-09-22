import { useState } from "react";
import { MODEL } from "../data";
import { powerFromHabits } from "../engine/powerFromHabits";
import { isPowerFromLevelConfirmed, powerFromLevel } from "../engine/powerFromLevel";
import { isPowerFromStarsConfirmed, powerFromStars } from "../engine/powerFromStars";
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
 * A pure client-side "what if" sandbox — nothing here writes to Convex, and
 * nothing here changes the live app's real army scoring.
 *
 * Power from Star Rank, Habits, AND Level are all now LOCKED IN
 * (src/engine/powerFrom{Stars,Habits,Level}.ts) — confirmed (or, for Level,
 * mostly-extrapolated-but-bounded) against Neill's real game client, not
 * free-tunable guesses anymore. Total Power is just their sum. Stats are
 * their own still-fully-guessed calculation.
 */
export function DragonDetail({ dragon, onBack }: { dragon: Doc<"dragons">; onBack: () => void }) {
  const [starRank, setStarRank] = useState(3);
  const [level, setLevel] = useState(15);
  const [habitLevels, setHabitLevels] = useState<number[]>([1, 1, 1, 1, 1]);

  // --- Stats: base × starMult(rarity, star) only — no Level, no Habits ---
  const [statStarPctByRarity, setStatStarPctByRarity] = useState<Record<Rarity, number>>(DEFAULT_STAT_STAR_PCT);
  const [lateStarBonusPct, setLateStarBonusPct] = useState(DEFAULT_LATE_STAR_BONUS_PCT);

  const unlockedHabits = MODEL.HABIT_UNLOCK_STARS.map((req) => starRank >= req);
  const unlockedHabitLevels = habitLevels.filter((_, i) => unlockedHabits[i]);

  // Power = powerFromStars + powerFromHabits + powerFromLevel
  const starPower = powerFromStars(dragon.rarity, starRank);
  const starPowerConfirmed = isPowerFromStarsConfirmed(dragon.rarity, starRank);
  const habitPower = powerFromHabits(dragon.rarity, unlockedHabitLevels);
  const levelPower = powerFromLevel(dragon.rarity, level);
  const levelPowerConfirmed = isPowerFromLevelConfirmed(dragon.rarity, level);
  const totalPower =
    starPower != null && habitPower != null && levelPower != null ? starPower + habitPower + levelPower : null;

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
            <h2 className="mb-1 text-sm font-semibold text-neutral-200">Power</h2>
            <p className="text-xs text-neutral-500">
              Star Rank, Habits, and Level are all locked in now — nothing left to tune here. See the Total
              Power card for the breakdown. Level's numbers are the least certain of the three (a bounded
              extrapolation from just a handful of real rare data points near the level cap) — treat any
              single dragon's Level contribution as a rough scale, not gospel.
            </p>
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
            {totalPower == null ? (
              <p className="text-sm text-neutral-500">No confirmed Power data yet for {dragon.rarity} dragons.</p>
            ) : (
              <>
                <div className="font-mono text-xs text-neutral-400">
                  {starPower!.toLocaleString()} power from ★{starRank} {dragon.rarity}
                  {" "}
                  <span className={starPowerConfirmed ? "text-emerald-400" : "text-amber-400"}>
                    ({starPowerConfirmed ? "confirmed" : "estimated"})
                  </span>
                </div>
                <div className="font-mono text-xs text-neutral-400">
                  + {habitPower!.toLocaleString()} power from {unlockedHabitLevels.length} unlocked habit(s)
                  {unlockedHabitLevels.length > 0 && (
                    <> ({unlockedHabitLevels.map((lvl) => `Lv${lvl}`).join(" + ")}) </>
                  )}
                  <span className="text-emerald-400">(confirmed)</span>
                </div>
                <div className="font-mono text-xs text-neutral-400">
                  + {levelPower!.toLocaleString()} power from level {level} {dragon.rarity}
                  {" "}
                  <span className={levelPowerConfirmed ? "text-emerald-400" : "text-amber-400"}>
                    ({levelPowerConfirmed ? "confirmed" : "estimated"})
                  </span>
                </div>
                <div className="mt-2 text-2xl font-bold text-neutral-100">{totalPower.toLocaleString()}</div>
              </>
            )}
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
