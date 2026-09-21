import { useState } from "react";
import { ArmyCard } from "./components/ArmyCard";
import { RosterPanel } from "./components/RosterPanel";
import { MODEL } from "./data";
import { optimize } from "./engine/optimizer";
import { useRoster } from "./hooks/useRoster";
import type { Goal, OptimizeResult, TroopType } from "./types";

function troopOptionsFor(goal: Goal): TroopType[] {
  const ids = MODEL.TROOP_TYPES.map((t) => t.id) as TroopType[];
  return goal === "siege" ? ["siege"] : ids.filter((t) => t !== "siege");
}

function App() {
  const { roster, addDragon, addDragons, removeDragon, toggleActive, clearRoster } = useRoster();
  const [goal, setGoal] = useState<Goal>("balanced");
  const [numArmies, setNumArmies] = useState(3);
  const [enemyTroop, setEnemyTroop] = useState<TroopType | "">("");
  const [result, setResult] = useState<OptimizeResult | null>(null);

  const activeCount = roster.filter((d) => d.active !== false).length;

  function handleOptimize() {
    const pool = roster.filter((d) => d.active !== false);
    if (pool.length === 0) return;
    setResult(
      optimize(pool, {
        numArmies,
        goal,
        troopOptions: troopOptionsFor(goal),
        enemyTroop: enemyTroop || null,
        iterations: 300,
      })
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-100">Dragonfire Formations — custom build</h1>
        <p className="text-sm text-neutral-500">
          Game of Thrones: Dragonfire formation optimizer. Local-only roster for now — see{" "}
          <code className="text-neutral-400">reference/</code> for the site this started from.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <RosterPanel
          roster={roster}
          onAdd={addDragon}
          onAddAll={addDragons}
          onRemove={removeDragon}
          onToggleActive={toggleActive}
          onClear={clearRoster}
        />

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
            <label className="flex flex-col text-sm text-neutral-300">
              Goal
              <select
                className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
                value={goal}
                onChange={(e) => setGoal(e.target.value as Goal)}
              >
                <option value="balanced">Max Power</option>
                <option value="dps">Anti-Army DPS</option>
                <option value="siege">Siege</option>
              </select>
            </label>

            <label className="flex flex-col text-sm text-neutral-300">
              # armies
              <select
                className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
                value={numArmies}
                onChange={(e) => setNumArmies(Number(e.target.value))}
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col text-sm text-neutral-300">
              vs enemy troop
              <select
                className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
                value={enemyTroop}
                onChange={(e) => setEnemyTroop(e.target.value as TroopType | "")}
              >
                <option value="">(none)</option>
                {MODEL.TROOP_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                ))}
              </select>
            </label>

            <button
              className="ml-auto rounded bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
              disabled={activeCount === 0}
              onClick={handleOptimize}
            >
              Optimize Formations
            </button>
          </div>

          {!result ? (
            <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-neutral-500">
              Add your dragons, then hit Optimize Formations to build the strongest armies.
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {result.armies.map((army, i) => (
                  <ArmyCard key={i} army={army} index={i} />
                ))}
              </div>
              {result.bench.length > 0 && (
                <div className="rounded-lg border border-neutral-800 p-3 text-sm text-neutral-400">
                  Benched ({result.bench.length}): {result.bench.map((d) => d.name).join(", ")}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;
