import { useMemo, useState } from "react";
import { MODEL } from "../data";
import { RARITY_COEF } from "../engine/power";
import type { Doc } from "../../convex/_generated/dataModel";

const STAT_KEYS = ["baseStrength", "baseInstinct", "baseIntelligence", "baseInitiative"] as const;
const STAT_LABELS: Record<(typeof STAT_KEYS)[number], string> = {
  baseStrength: "Strength",
  baseInstinct: "Instinct",
  baseIntelligence: "Intelligence",
  baseInitiative: "Initiative",
};

const MAX_STAR = 10;

/**
 * A pure client-side "what if" sandbox — nothing here writes to Convex.
 * Nothing in engine/ uses this formula yet either: it's deliberately kept
 * separate from the real scoring engine until these growth-rate constants
 * are actually confirmed against the live game client, so experimenting
 * here can't silently change army scores elsewhere in the app.
 */
export function DragonDetail({ dragon, onBack }: { dragon: Doc<"dragons">; onBack: () => void }) {
  const [starRank, setStarRank] = useState(3);
  const [level, setLevel] = useState(15);
  const [habitLevels, setHabitLevels] = useState<number[]>([1, 1, 1, 1, 1]);

  // Tunable growth-rate guesses — adjust these while comparing against your
  // game client, rather than editing formulas in code.
  const [starPct, setStarPct] = useState(0.15); // matches the existing Power formula's own star term
  const [levelPct, setLevelPct] = useState(0.02);
  const [habitPowerPct, setHabitPowerPct] = useState(0.01);

  const unlockedHabits = MODEL.HABIT_UNLOCK_STARS.map((req) => starRank >= req);
  const totalHabitLevels = habitLevels.reduce((sum, lvl, i) => sum + (unlockedHabits[i] ? lvl : 0), 0);

  const rarityCoef = RARITY_COEF[dragon.rarity];
  const starMult = 1 + starPct * starRank;
  const levelMult = 1 + levelPct * (level - 1);
  const habitMult = 1 + habitPowerPct * totalHabitLevels;
  const basePower = Math.round((rarityCoef * starMult * level) / 10) * 10;
  const finalPower = Math.round(basePower * habitMult);

  const statMult = useMemo(() => (1 + starPct * (starRank - 1)) * levelMult, [starPct, starRank, levelMult]);

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
            <h2 className="mb-3 text-sm font-semibold text-neutral-200">Growth-rate guesses (editable)</h2>
            <label className="mb-2 flex items-center justify-between gap-2 text-sm">
              Stat % per star
              <input type="number" step={0.01} value={starPct} onChange={(e) => setStarPct(Number(e.target.value) || 0)} className="w-20 rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 text-right" />
            </label>
            <label className="mb-2 flex items-center justify-between gap-2 text-sm">
              Stat % per level
              <input type="number" step={0.005} value={levelPct} onChange={(e) => setLevelPct(Number(e.target.value) || 0)} className="w-20 rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 text-right" />
            </label>
            <label className="flex items-center justify-between gap-2 text-sm">
              Power % per habit level
              <input type="number" step={0.005} value={habitPowerPct} onChange={(e) => setHabitPowerPct(Number(e.target.value) || 0)} className="w-20 rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 text-right" />
            </label>
          </div>
        </div>

        {/* Results */}
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-violet-800 bg-violet-950/20 p-4">
            <h2 className="mb-2 text-sm font-semibold text-violet-200">Power</h2>
            <div className="font-mono text-xs text-neutral-400">
              {rarityCoef} (rarity) × {starMult.toFixed(3)} (1 + {starPct}×{starRank} star) × {level} (level) / 10 × 10
              {" "}= {basePower.toLocaleString()}
            </div>
            <div className="font-mono text-xs text-neutral-400">
              × {habitMult.toFixed(3)} (1 + {habitPowerPct}×{totalHabitLevels} habit levels)
            </div>
            <div className="mt-2 text-2xl font-bold text-neutral-100">{finalPower.toLocaleString()}</div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
            <h2 className="mb-2 text-sm font-semibold text-neutral-200">Stats</h2>
            <div className="mb-2 font-mono text-xs text-neutral-500">
              projected = base × (1 + {starPct}×{starRank - 1} star) × (1 + {levelPct}×{level - 1} level) = base × {statMult.toFixed(3)}
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
                  return (
                    <tr key={key} className="border-t border-neutral-900">
                      <td className="py-1">{STAT_LABELS[key]}</td>
                      <td className="py-1 text-right text-neutral-400">{base ?? "—"}</td>
                      <td className="py-1 text-right font-semibold">
                        {base != null ? Math.round(base * statMult).toLocaleString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-neutral-500">
              "Base" is whatever you entered on the list page — treat it as this dragon's ★1, level 1, no-habits
              stat until proven otherwise. Blank stats show as "—"; fill them in on the list page first.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
