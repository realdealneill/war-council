// Partitions a roster into up to 10 armies of 3 dragons each, maximizing
// total effective power. A strong greedy seed followed by iterated local
// search (moves + swaps); the within-army arrangement is solved exactly by
// bestArmy(). Ported from dragonfire-formations.com's js/optimizer.js.
import { bestArmy, type EvaluateOptions } from "./scoring";
import { goalPower } from "./power";
import type { Army, Dragon, OptimizeResult, Placement, TroopType } from "../types";

const MAX_ARMIES = 10;
const ARMY_SIZE = 3;
const SLOTS: (keyof Placement)[] = ["left", "vanguard", "right"];

function totalScore(armies: Army[]): number {
  return armies.reduce((s, a) => s + (a.eval?.score ?? 0), 0);
}

function reEval(army: Army, troopOptions: TroopType[] | undefined, opts: EvaluateOptions): Army {
  army.eval = bestArmy(army.dragons, troopOptions, opts, army.locks);
  return army;
}

const lockedIn = (army: Army, d: Dragon) => SLOTS.some((s) => army.locks[s] === d);

export interface OptimizeOptions extends EvaluateOptions {
  troopOptions?: TroopType[];
  numArmies?: number;
  iterations?: number;
  /** Hand-placed dragons, per army index; fixed points the search works around. */
  locks?: Partial<Record<keyof Placement, Dragon>>[];
}

export function optimize(roster: Dragon[], opts: OptimizeOptions = {}): OptimizeResult {
  const troopOptions = opts.troopOptions;
  const goal = opts.goal ?? "balanced";
  const numArmies = Math.max(1, Math.min(MAX_ARMIES, opts.numArmies ?? MAX_ARMIES));
  const evalOpts: EvaluateOptions = { goal, enemyTroop: opts.enemyTroop };

  const armies: Army[] = Array.from({ length: numArmies }, () => ({
    dragons: [], locks: {}, eval: { score: 0, basePower: 0, rawPower: 0, bonusPct: 0, synergies: [], warnings: [], placement: { left: null, vanguard: null, right: null }, troopType: null },
  }));

  const lockedIds = new Set<string>();
  let hasLocks = false;
  for (let i = 0; i < numArmies; i++) {
    const src = opts.locks?.[i] ?? {};
    SLOTS.forEach((s) => {
      const d = src[s];
      if (!d || lockedIds.has(d.id)) return;
      lockedIds.add(d.id);
      armies[i].locks[s] = d;
      armies[i].dragons.push(d);
      hasLocks = true;
    });
  }

  const pool = roster.filter((d) => !lockedIds.has(d.id));
  pool.sort((a, b) => goalPower(b, goal) - goalPower(a, goal));

  const capacity = armies.reduce((s, a) => s + (ARMY_SIZE - a.dragons.length), 0);
  const active = pool.slice(0, capacity);
  const bench = pool.slice(capacity);

  // A wall never attacks, so seeding every siege army with a tank first is
  // exactly wrong — leave the seed to the greedy fill for that goal.
  const seedTanks = goal !== "siege";
  const tanks = seedTanks ? active.filter((d) => d.role === "tank") : [];
  const others = seedTanks ? active.filter((d) => d.role !== "tank") : active.slice();

  let ai = 0;
  for (const t of tanks) {
    while (ai < numArmies && armies[ai].dragons.length >= ARMY_SIZE) ai++;
    if (ai >= numArmies) { others.push(t); continue; }
    armies[ai].dragons.push(t);
    ai++;
  }

  for (const d of others) {
    let bestArmyIdx = -1;
    let bestGain = -Infinity;
    for (let i = 0; i < armies.length; i++) {
      if (armies[i].dragons.length >= ARMY_SIZE) continue;
      const before = bestArmy(armies[i].dragons, troopOptions, evalOpts, armies[i].locks).score;
      const after = bestArmy(armies[i].dragons.concat([d]), troopOptions, evalOpts, armies[i].locks).score;
      const gain = after - before;
      if (gain > bestGain) { bestGain = gain; bestArmyIdx = i; }
    }
    if (bestArmyIdx === -1) bench.push(d);
    else armies[bestArmyIdx].dragons.push(d);
  }

  armies.forEach((a) => reEval(a, troopOptions, evalOpts));

  const iterations = opts.iterations ?? 400;
  let improved = true;
  let iter = 0;
  while (improved && iter < iterations) {
    improved = false;
    iter++;

    for (let i = 0; i < armies.length; i++) {
      for (let j = i + 1; j < armies.length; j++) {
        for (let x = 0; x < armies[i].dragons.length; x++) {
          if (lockedIn(armies[i], armies[i].dragons[x])) continue;
          for (let y = 0; y < armies[j].dragons.length; y++) {
            if (lockedIn(armies[j], armies[j].dragons[y])) continue;
            const before = armies[i].eval.score + armies[j].eval.score;
            const di = armies[i].dragons.slice();
            const dj = armies[j].dragons.slice();
            const tmp = di[x]; di[x] = dj[y]; dj[y] = tmp;
            const ei = bestArmy(di, troopOptions, evalOpts, armies[i].locks);
            const ej = bestArmy(dj, troopOptions, evalOpts, armies[j].locks);
            if (ei.score + ej.score > before + 1e-6) {
              armies[i].dragons = di; armies[i].eval = ei;
              armies[j].dragons = dj; armies[j].eval = ej;
              improved = true;
            }
          }
        }
      }
    }

    for (let b = 0; b < bench.length; b++) {
      for (let i = 0; i < armies.length; i++) {
        for (let x = 0; x < armies[i].dragons.length; x++) {
          if (lockedIn(armies[i], armies[i].dragons[x])) continue;
          const before = armies[i].eval.score;
          const di = armies[i].dragons.slice();
          const benched = di[x];
          di[x] = bench[b];
          const ei = bestArmy(di, troopOptions, evalOpts, armies[i].locks);
          if (ei.score > before + 1e-6) {
            armies[i].dragons = di;
            armies[i].eval = ei;
            bench[b] = benched;
            improved = true;
          }
        }
      }
    }

    for (let i = 0; i < armies.length; i++) {
      while (armies[i].dragons.length < ARMY_SIZE && bench.length > 0) {
        let bestB = -1, bestGain = -Infinity, bestEval = null as Army["eval"] | null;
        const before = armies[i].eval.score;
        for (let b = 0; b < bench.length; b++) {
          const ei = bestArmy(armies[i].dragons.concat([bench[b]]), troopOptions, evalOpts, armies[i].locks);
          const gain = ei.score - before;
          if (gain > bestGain) { bestGain = gain; bestB = b; bestEval = ei; }
        }
        if (bestB >= 0 && bestGain > 0 && bestEval) {
          armies[i].dragons.push(bench[bestB]);
          armies[i].eval = bestEval;
          bench.splice(bestB, 1);
          improved = true;
        } else break;
      }
    }
  }

  if (!hasLocks) armies.sort((a, b) => b.eval.score - a.eval.score);

  return { armies, bench, total: totalScore(armies), iterations: iter };
}

export { MAX_ARMIES, ARMY_SIZE };
