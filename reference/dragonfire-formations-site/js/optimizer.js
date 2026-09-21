/*
 * optimizer.js — Partitions a roster into up to 10 armies of 3 dragons each,
 * choosing positions and a troop type per army to maximize total effective
 * power (including all synergies from scoring.js).
 *
 * Approach: a strong greedy seed followed by iterated local search (moves +
 * swaps). The within-army arrangement is solved exactly by bestArmy() (only
 * 3! positions x 5 troop types), so the only heuristic part is the partition.
 *
 * Callers may hand-place dragons into named slots via opts.locks; those are
 * fixed points the search works around, which turns the same code into
 * "here is my Vanguard, now build the rest of the formation".
 */
(function () {
  const { bestArmy } = window.SCORING;

  const MAX_ARMIES = 10;
  const ARMY_SIZE = 3;
  const SLOTS = ["left", "vanguard", "right"];

  function totalScore(armies) {
    return armies.reduce((s, a) => s + (a.eval ? a.eval.score : 0), 0);
  }

  function reEval(army, troopOptions, goal) {
    army.eval = bestArmy(army.dragons, troopOptions, goal, army.locks);
    return army;
  }

  // Is this dragon hand-placed in this army, and therefore off limits?
  const lockedIn = (army, d) => SLOTS.some((s) => army.locks[s] === d);

  /**
   * @param roster array of dragon objects (the pool to draw from)
   * @param opts {
   *   troopOptions?: string[], numArmies?: 1-10, iterations?,
   *   locks?: [{ left?, vanguard?, right? }]  // dragon objects, per army index
   * }
   *
   * `locks` are hand-placed dragons: they are seated before anything else, they
   * keep their exact slot, and no move or swap can dislodge them. Everything
   * else is filled from `roster` as usual, so a formation with only a chosen
   * Vanguard comes back with the best two flanks to go with it.
   *
   * Returns { armies:[{dragons, locks, eval}], bench:[dragons], total }
   */
  function optimize(roster, opts) {
    opts = opts || {};
    const troopOptions = opts.troopOptions; // undefined = all troop types allowed
    const goal = opts.goal || "balanced"; // "balanced" | "siege" | "dps"
    const numArmies = Math.max(1, Math.min(MAX_ARMIES, opts.numArmies || MAX_ARMIES));

    const armies = Array.from({ length: numArmies }, () => ({ dragons: [], locks: {} }));

    // --- Seat the hand-placed dragons first ---
    // A dragon can only stand in one place, so the first lock claiming it wins.
    const lockedIds = new Set();
    let hasLocks = false;
    for (let i = 0; i < numArmies; i++) {
      const src = (opts.locks && opts.locks[i]) || {};
      SLOTS.forEach((s) => {
        const d = src[s];
        if (!d || lockedIds.has(d.id)) return;
        lockedIds.add(d.id);
        armies[i].locks[s] = d;
        armies[i].dragons.push(d);
        hasLocks = true;
      });
    }

    // The free pool must exclude locked dragons or they could be placed twice.
    const pool = roster.filter((d) => !lockedIds.has(d.id));

    // Rank by power AS THIS GOAL COUNTS IT, so a siege plan's anchors are the
    // dragons that will actually damage a structure rather than whoever happens
    // to have the biggest Army Power number.
    pool.sort((a, b) => window.SCORING.goalPower(b, goal) - window.SCORING.goalPower(a, goal));

    // Use the best dragons the open slots can hold; the rest start benched.
    const capacity = armies.reduce((s, a) => s + (ARMY_SIZE - a.dragons.length), 0);
    const active = pool.slice(0, capacity);
    let bench = pool.slice(capacity);

    // --- Seed: spread tank/taunt dragons across armies as vanguards ---
    // A wall never attacks, so handing every siege army a tank first is exactly
    // the wrong opening: leave the seed to the greedy fill instead.
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

    // Greedy fill: place each remaining dragon where its marginal gain is best.
    for (const d of others) {
      let bestArmyIdx = -1;
      let bestGain = -Infinity;
      for (let i = 0; i < armies.length; i++) {
        if (armies[i].dragons.length >= ARMY_SIZE) continue;
        const before = bestArmy(armies[i].dragons, troopOptions, goal, armies[i].locks).score;
        const after = bestArmy(armies[i].dragons.concat([d]), troopOptions, goal, armies[i].locks).score;
        const gain = after - before;
        if (gain > bestGain) {
          bestGain = gain;
          bestArmyIdx = i;
        }
      }
      if (bestArmyIdx === -1) {
        bench.push(d);
      } else {
        armies[bestArmyIdx].dragons.push(d);
      }
    }

    armies.forEach((a) => reEval(a, troopOptions, goal));

    // --- Iterated local search: moves (army<->bench) and swaps (army<->army/bench) ---
    const iterations = opts.iterations || 400;
    let improved = true;
    let iter = 0;
    while (improved && iter < iterations) {
      improved = false;
      iter++;

      // Try swapping every pair of dragons across different armies.
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
              const ei = bestArmy(di, troopOptions, goal, armies[i].locks);
              const ej = bestArmy(dj, troopOptions, goal, armies[j].locks);
              if (ei.score + ej.score > before + 1e-6) {
                armies[i].dragons = di; armies[i].eval = ei;
                armies[j].dragons = dj; armies[j].eval = ej;
                improved = true;
              }
            }
          }
        }
      }

      // Try swapping bench dragons into armies.
      for (let b = 0; b < bench.length; b++) {
        for (let i = 0; i < armies.length; i++) {
          for (let x = 0; x < armies[i].dragons.length; x++) {
            if (lockedIn(armies[i], armies[i].dragons[x])) continue;
            const before = armies[i].eval.score;
            const di = armies[i].dragons.slice();
            const benched = di[x];
            di[x] = bench[b];
            const ei = bestArmy(di, troopOptions, goal, armies[i].locks);
            if (ei.score > before + 1e-6) {
              armies[i].dragons = di;
              armies[i].eval = ei;
              bench[b] = benched;
              improved = true;
            }
          }
        }
      }

      // Try filling empty slots from bench.
      for (let i = 0; i < armies.length; i++) {
        while (armies[i].dragons.length < ARMY_SIZE && bench.length > 0) {
          let bestB = -1, bestGain = -Infinity, bestEval = null;
          const before = armies[i].eval.score;
          for (let b = 0; b < bench.length; b++) {
            const ei = bestArmy(armies[i].dragons.concat([bench[b]]), troopOptions, goal, armies[i].locks);
            const gain = ei.score - before;
            if (gain > bestGain) { bestGain = gain; bestB = b; bestEval = ei; }
          }
          if (bestB >= 0 && bestGain > 0) {
            armies[i].dragons.push(bench[bestB]);
            armies[i].eval = bestEval;
            bench.splice(bestB, 1);
            improved = true;
          } else break;
        }
      }
    }

    // Order armies strongest-first for display — but only when nothing was
    // hand-placed. With locks, army index is the caller's own numbering, so
    // reordering would move a dragon out of the formation it was placed in.
    if (!hasLocks) armies.sort((a, b) => b.eval.score - a.eval.score);

    return {
      armies,
      bench,
      total: totalScore(armies),
      iterations: iter,
    };
  }

  window.OPTIMIZER = { optimize, MAX_ARMIES, ARMY_SIZE, SLOTS };
})();
