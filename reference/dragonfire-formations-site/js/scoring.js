/*
 * scoring.js — Effective-power & synergy model for an army of up to 3 dragons.
 *
 * Philosophy: a dragon's raw `power` is the foundation. On top of that we add
 * percentage bonuses from:
 *   1. Troop affinity with the army's chosen troop type
 *   2. The Vanguard dragon's skill — a buff on itself plus a buff on ONE flank
 *   3. Position fit (right-flank physical, left-flank tactical/fire, tank centre)
 *   4. Kit synergies: what each dragon needs versus what its teammates supply
 *   5. Role balance (a tank + DPS beats three tanks)
 *
 * Synergy is driven by the dragons' real Command and Habit wording (kits.js)
 * resolved at each dragon's current Star Rank, so an unstarred dragon only
 * brings what it has actually unlocked.
 *
 * Every bonus is transparent: evaluateArmy() returns a list of human-readable
 * synergy entries so the UI can explain WHY a formation scores well.
 */
(function () {
  const G = window.GAME;
  const { ROLES, CONTROL_EFFECTS } = G;

  const SLOTS = ["left", "vanguard", "right"];

  const AFFINITY_BONUS = 0.07; // +7% stat boost per dragon with positive affinity
  const AFFINITY_PENALTY = 0.07; // -7% for negative affinity to the used troop type

  // How much a non-damage Vanguard buff is worth relative to raw damage.
  const MITIGATION_VALUE = 0.5; // survivability converts at about half
  const RECOVERY_VALUE = 0.35;
  const STAT_POINT_VALUE = 0.002; // a flat +20 to a stat ≈ +4%

  // ---- What the score is measuring -------------------------------------------
  // "balanced" asks which army is strongest overall, so every dragon's power
  // counts in full. "siege" asks a narrower question — how much damage lands on
  // a structure's Durability — and only Siege troops do that. A wall never
  // attacks back, so the half of a kit aimed at an enemy ARMY (taunts, heals,
  // mitigation) barely converts, while damage and damage buffs convert fully.
  // Weighting each dragon's power by that share is what stops a siege plan from
  // collapsing back into "pick the highest Army Power".
  const SIEGE_DAMAGE_SHARE = {
    physical: 1, tactical: 1, fire: 1, // damage dealers hit the wall
    control: 0.6,  // debuffs raise the damage the rest of the army lands
    tank: 0.4,     // soaks hits a structure never throws
    healer: 0.35,  // recovery does nothing to Durability
  };

  // Survivability is worth much less when the score is damage to a structure.
  const DEFENSE_WEIGHT = { balanced: 1, dps: 0.7, siege: 0.35 };

  /** The share of a dragon's power that turns into progress toward `goal`. */
  function goalShare(d, goal) {
    if (goal !== "siege") return 1;
    const share = SIEGE_DAMAGE_SHARE[d.role];
    return share == null ? 0.6 : share;
  }

  /** A dragon's power as the chosen goal counts it. */
  function goalPower(d, goal) {
    return dragonPower(d) * goalShare(d, goal);
  }

  // What a satisfied consumer synergy is worth to the dragon that needs it.
  const WANT_VALUE = {
    control: 0.08, panic: 0.07, burn: 0.06, vulnerable: 0.06, taunt: 0.05,
    slow: 0.04, bleed: 0.04, weakened: 0.04,
    advantage: 0.06, resistance: 0.05, firstStrike: 0.06, recovery: 0.04,
    // The one enabler a dragon cannot work around: Moondancer's Rising Tide is
    // fed only by the Sentinel he marks, and the stacks double his Command
    // damage. Without that teammate the whole kit stays at half output.
    sentinel: 0.1,
  };

  const EFFECT_NAME = {
    control: "Control", panic: "Panic", burn: "Burn", vulnerable: "Vulnerable",
    taunt: "Taunt", slow: "Slow", bleed: "Bleed", weakened: "Weakened",
    advantage: "Advantage", resistance: "Resistance", firstStrike: "First Strike",
    recovery: "Recovery", stun: "Stun", overwhelm: "Overwhelm", confusion: "Confusion",
    sentinel: "a Tactical/Recovery Sentinel",
  };

  // Power formula reverse-engineered from real in-game data (16 dragons).
  // Two different dragons with identical rarity/star/reign showed identical
  // power, so power is a function of those three only:
  //     power ≈ C_rarity * (1 + 0.15 * star) * reign
  // C fitted to ~540 (legendary) and ~410 (epic); rare/mythic extrapolated.
  // Fits the sample within ~5%. Used only when a dragon's power is left blank.
  const RARITY_COEF = { rare: 300, epic: 410, legendary: 540, mythic: 700 };

  function estimatePower(d) {
    const c = RARITY_COEF[d.rarity] || RARITY_COEF.rare;
    const star = 1 + 0.15 * (Number(d.starRank) || 1);
    const reign = Number(d.reignLevel) || 10; // reign drives power almost linearly
    return Math.round((c * star * reign) / 10) * 10;
  }

  function dragonPower(d) {
    const p = Number(d.power);
    return p && p > 0 ? p : estimatePower(d);
  }

  function rolePref(d) {
    const r = ROLES.find((x) => x.id === d.role);
    return r ? r.prefers : "any";
  }

  function roleLabel(d) {
    const r = ROLES.find((x) => x.id === d.role);
    return r ? r.name : d.role;
  }

  // Effects a dragon has unlocked at its current Star Rank.
  const fx = (d) => G.dragonEffects(d);
  const applies = (d, e) => fx(d).applies.indexOf(e) !== -1;
  const gives = (d, e) => fx(d).grants.indexOf(e) !== -1;
  const holds = (d, e) => gives(d, e) || fx(d).self.indexOf(e) !== -1;

  function appliesControl(d) {
    return fx(d).applies.some((t) => CONTROL_EFFECTS.indexOf(t) !== -1);
  }

  // Can `source` supply the effect `want` to a teammate?
  function supplies(source, want) {
    if (want === "control") return appliesControl(source);
    // A few needs name a BREED rather than an effect: Moondancer's Command only
    // marks a Sentinel, and only that Sentinel's Tactical Damage or Recovery
    // rolls him a Rising Tide stack.
    if (want === "sentinel") {
      return source.breed === "sentinel" && (source.damageType === "tactical" || gives(source, "recovery"));
    }
    return applies(source, want) || gives(source, want);
  }

  function isDPS(d) {
    return ["physical", "tactical", "fire"].indexOf(d.role) !== -1;
  }

  /**
   * Worth of a Vanguard buff to the dragon receiving it. Damage-type buffs only
   * pay off when the receiver deals that damage type — which is what makes flank
   * placement matter.
   */
  function buffValue(effects, receiver, defense) {
    const def = defense == null ? 1 : defense;
    let pct = 0;
    (effects || []).forEach((e) => {
      if (e.kind === "damage") pct += receiver && receiver.damageType === e.type ? e.pct : 0;
      else if (e.kind === "damageAny") pct += e.pct;
      else if (e.kind === "mitigation") pct += e.pct * MITIGATION_VALUE * def;
      else if (e.kind === "recovery") pct += e.pct * RECOVERY_VALUE * def;
      else if (e.kind === "stat") pct += e.stats.length * e.flat * STAT_POINT_VALUE;
    });
    return pct;
  }

  // Does this buff go to waste because the receiver deals the wrong damage type?
  function mismatchedDamageBuff(effects, receiver) {
    const dmg = (effects || []).filter((e) => e.kind === "damage");
    if (!dmg.length || !receiver) return null;
    return dmg.every((e) => receiver.damageType !== e.type) ? dmg[0].type : null;
  }

  /**
   * Evaluate a fixed placement: dragons mapped to {left, vanguard, right}.
   * Returns { score, basePower, bonusPct, synergies:[{text, pct}], warnings:[] }.
   */
  function evaluatePlacement(placement, troopType, goal) {
    goal = goal || "balanced";
    const dragons = SLOTS.map((s) => placement[s]).filter(Boolean);
    if (dragons.length === 0) {
      return { score: 0, basePower: 0, rawPower: 0, bonusPct: 0, synergies: [], warnings: [] };
    }

    // Every bonus is a percentage of the power it acts on, counted as the goal
    // counts it: for a siege plan a healer's power is mostly not damage, so a
    // buff on that healer moves the siege total far less than the same buff on
    // a damage dealer would.
    const defense = DEFENSE_WEIGHT[goal] == null ? 1 : DEFENSE_WEIGHT[goal];
    const pw = (d) => goalPower(d, goal);
    const rawPower = dragons.reduce((s, d) => s + dragonPower(d), 0);
    const basePower = dragons.reduce((s, d) => s + pw(d), 0);
    const synergies = [];
    const warnings = [];
    let bonus = 0; // absolute power added on top of basePower

    const add = (text, pct, refPower) => {
      const amt = pct * (refPower != null ? refPower : basePower);
      bonus += amt;
      synergies.push({ text, pct: amt / basePower });
    };

    // --- 1. Affinity with the chosen troop type ---
    if (troopType) {
      let positives = 0;
      dragons.forEach((d) => {
        const a = d.affinity ? d.affinity[troopType] : 0;
        if (a === "+") {
          positives++;
          add(`${d.name}: positive ${troopType} affinity (+${Math.round(AFFINITY_BONUS * 100)}% stats)`, AFFINITY_BONUS, pw(d));
        } else if (a === "-") {
          bonus -= AFFINITY_PENALTY * pw(d);
          warnings.push(`${d.name} has NEGATIVE ${troopType} affinity (-${Math.round(AFFINITY_PENALTY * 100)}%)`);
        }
      });
      if (positives >= 2) {
        add(`Stacked ${troopType} affinity across ${positives} dragons`, 0.03 * (positives - 1));
      }
    }

    const left = placement.left;
    const vg = placement.vanguard;
    const right = placement.right;

    // --- 2. The Vanguard skill: a self buff, plus a buff on one named flank ---
    if (vg) {
      const skill = G.vanguardFor(vg);
      if (skill) {
        const selfPct = buffValue(skill.self, vg, defense);
        if (selfPct > 0) add(`${vg.name} in Vanguard: ${skill.selfText}`, selfPct, pw(vg));

        const receiver = skill.flankPos === "left" ? left : right;
        const flankName = skill.flankPos === "left" ? "Left Flank" : "Right Flank";
        if (receiver) {
          const pct = buffValue(skill.flank, receiver, defense);
          if (pct > 0) add(`${vg.name} buffs the ${flankName}: ${skill.flankText} → ${receiver.name}`, pct, pw(receiver));
          const wasted = mismatchedDamageBuff(skill.flank, receiver);
          if (wasted) {
            warnings.push(
              `${vg.name}'s Vanguard skill buffs ${wasted} damage on the ${flankName}, but ${receiver.name} deals ${receiver.damageType} — swap the flanks to use it.`
            );
          }
        } else {
          warnings.push(`${vg.name}'s Vanguard skill buffs the ${flankName}, which is empty.`);
        }
      }
      if (applies(vg, "taunt")) {
        add(`${vg.name} taunts from the Vanguard — soaks damage for your flanks`, 0.10 * defense);
      }
    } else {
      warnings.push("No Vanguard dragon assigned.");
    }

    // --- 3. Role-position fit (right=physical, left=tactical/fire, vanguard=tank) ---
    if (right && right.role === "physical") add(`${right.name} (Physical DPS) correctly on Right Flank`, 0.05, pw(right));
    if (left && (left.role === "tactical" || left.role === "fire" || left.role === "healer"))
      add(`${left.name} (${left.role}) correctly on Left Flank`, 0.04, pw(left));
    if (vg && vg.role === "tank") add(`${vg.name} (Tank) correctly in Vanguard`, 0.05 * defense, pw(vg));

    if (right && right.role === "tank") warnings.push(`${right.name} is a Tank but on the Right Flank — usually better in Vanguard.`);

    // --- 4. Kit synergies: what each dragon needs vs what the others supply ---
    dragons.forEach((d) => {
      fx(d).wants.forEach((want) => {
        const source = dragons.find((o) => o !== d && supplies(o, want));
        if (!source) return;
        const name = EFFECT_NAME[want] || want;
        add(`${d.name} hits harder with ${name} — supplied by ${source.name}`, WANT_VALUE[want] || 0.05, pw(d));
      });
    });

    // Team-wide effects that help everyone rather than one consumer.
    const anyTaunt = dragons.some((d) => applies(d, "taunt"));
    const anySustain = dragons.some((d) => gives(d, "recovery") || gives(d, "cleanse"));
    const anyMitigation = dragons.some(
      (d) => gives(d, "mitigation") || gives(d, "resistance") || gives(d, "protect")
    );
    const advantageGivers = dragons.filter((d) => gives(d, "advantage"));
    const softeners = dragons.filter((d) => applies(d, "vulnerable") || applies(d, "weakened") || applies(d, "debuff"));
    const controllers = dragons.filter((d) => appliesControl(d));
    const scalers = dragons.filter((d) => holds(d, "mirage") || holds(d, "doubleStrike") || holds(d, "risingTide"));

    if (anyTaunt && (anySustain || anyMitigation)) add("Taunt + sustain: the taunting dragon holds the front far longer", 0.06 * defense);
    if (advantageGivers.length) {
      const dealers = dragons.filter(isDPS).length;
      if (dealers) add(`${advantageGivers[0].name} grants Advantage to ${dealers} damage dealer(s)`, 0.04 * dealers);
    }
    if (softeners.length) {
      const dealers = dragons.filter(isDPS).length;
      if (dealers) add(`${softeners.length} dragon(s) soften the enemy for ${dealers} damage dealer(s)`, 0.03 * softeners.length);
    }
    if (controllers.length >= 2) add(`Control stack: ${controllers.length} dragons apply Stun/Overwhelm/Confusion`, 0.05);
    scalers.forEach((d) => {
      if (anySustain || anyMitigation) add(`${d.name} scales through long fights thanks to team sustain`, 0.05, pw(d));
    });

    // A stacking payoff pays nothing until it crosses a threshold — Moondancer's
    // Command damage only doubles at 4+ Rising Tide. Stacks arrive that fast only
    // when EVERY enabler the dragon asks for is on the field, so the full set is
    // worth more than the sum of its parts.
    dragons.forEach((d) => {
      if (!holds(d, "risingTide")) return;
      const needs = fx(d).wants;
      if (!needs.length || !needs.every((w) => dragons.some((o) => o !== d && supplies(o, w)))) return;
      add(`${d.name} stacks Rising Tide fast enough to hit its 4+ and 6+ thresholds`, 0.06, pw(d));
    });

    // --- 5. Role balance ---
    const tanks = dragons.filter((d) => d.role === "tank").length;
    const dps = dragons.filter(isDPS).length;
    const healers = dragons.filter((d) => d.role === "healer").length;
    if (tanks >= 1 && dps >= 1) add("Balanced core: tank + damage dealer(s)", 0.04 * defense);
    if (dps === 0 && dragons.length === 3) warnings.push("No damage dealer in this army — low kill pressure.");
    if (tanks >= 3) warnings.push("Three tanks — very little damage output.");
    if (healers >= 2) warnings.push("Two healers — consider swapping one for damage.");
    if (dragons.length < 3) warnings.push(`Only ${dragons.length} dragon(s) in this army.`);

    // Unmet needs are worth flagging: they point at the missing teammate.
    dragons.forEach((d) => {
      fx(d).wants.forEach((want) => {
        if (dragons.some((o) => o !== d && supplies(o, want))) return;
        warnings.push(`${d.name} wants ${EFFECT_NAME[want] || want} on the field — no teammate supplies it.`);
      });
    });

    // --- 6. Formation goal emphasis ---
    // Biases the optimizer toward the right composition for the chosen purpose.
    if (goal === "siege") {
      // The base above is already this army's damage rather than its all-round
      // strength, and section 1 has paid for Siege affinity, so what is left to
      // reward is the kit that MULTIPLIES the damage those troops land — and to
      // name the dragons whose power mostly is not damage at all.
      const ampl = dragons.filter((d) =>
        applies(d, "vulnerable") || applies(d, "weakened") || applies(d, "burn") ||
        gives(d, "advantage") || holds(d, "doubleStrike") || holds(d, "mirage") || holds(d, "risingTide")
      );
      ampl.forEach((d) => add(`${d.name} multiplies this army's damage output`, 0.05, pw(d)));
      dragons.forEach((d) => {
        const share = goalShare(d, goal);
        if (share < 1) {
          warnings.push(
            `${d.name} (${roleLabel(d)}) only converts about ${Math.round(share * 100)}% of its power into siege damage — a structure never attacks back.`
          );
        }
      });
    } else if (goal === "dps") {
      // Anti-army DPS: reward damage dealers and damage-amplifying kits.
      const dealers = dragons.filter(isDPS).length;
      if (dealers) add(`DPS focus: ${dealers} damage dealer(s)`, 0.05 * dealers);
      const ampl = dragons.filter(
        (d) => applies(d, "vulnerable") || applies(d, "burn") || holds(d, "doubleStrike") || holds(d, "mirage") || gives(d, "advantage")
      ).length;
      if (ampl) add(`Offensive kit: ${ampl} damage-amplifying dragon(s)`, 0.03 * ampl);
    }

    const score = basePower + bonus;
    return { score, basePower, rawPower, bonusPct: bonus / basePower, synergies, warnings };
  }

  /**
   * Given up to 3 dragons (array), find the best position arrangement and best
   * troop type.
   *
   * `locked` optionally nails named slots to a specific dragon, e.g.
   * { vanguard: syrax }. Locked dragons keep their slot and only the remaining
   * dragons and slots are searched — that is what lets a hand-picked Vanguard
   * survive the optimizer instead of being shuffled to a flank. A lock is
   * ignored unless that dragon is actually among `dragons`.
   *
   * Returns the full evaluation plus chosen positions & troopType.
   */
  function bestArmy(dragons, troopOptions, goal, locked) {
    const ds = dragons.filter(Boolean);
    const troops = troopOptions || window.GAME.TROOP_TYPES.map((t) => t.id);

    const held = {};
    if (locked) SLOTS.forEach((s) => { if (locked[s] && ds.indexOf(locked[s]) !== -1) held[s] = locked[s]; });
    const heldDragons = SLOTS.map((s) => held[s]).filter(Boolean);
    const free = ds.filter((d) => heldDragons.indexOf(d) === -1);
    const openSlots = SLOTS.filter((s) => !held[s]);

    let best = null;
    for (const seating of seatings(free, openSlots)) {
      const placement = Object.assign({ left: null, vanguard: null, right: null }, held, seating);
      for (const t of troops) {
        const ev = evaluatePlacement(placement, t, goal);
        if (!best || ev.score > best.score) {
          best = { ...ev, placement, troopType: t };
        }
      }
    }
    return best || { score: 0, basePower: 0, rawPower: 0, bonusPct: 0, synergies: [], warnings: [], placement: { left: null, vanguard: null, right: null }, troopType: null };
  }

  // Every way to seat `items` into `slots`, one dragon per slot. Spare slots are
  // left empty, so a half-built formation is a valid thing to score. At most 3
  // of each, so brute force stays exact and instant.
  function seatings(items, slots) {
    const out = [];
    const taken = [];
    const acc = {};
    const walk = (i) => {
      let room = false;
      if (i < items.length) {
        for (let s = 0; s < slots.length; s++) {
          if (taken[s]) continue;
          room = true;
          taken[s] = true;
          acc[slots[s]] = items[i];
          walk(i + 1);
          delete acc[slots[s]];
          taken[s] = false;
        }
      }
      // Out of items, or more items than open slots — score what fits.
      if (!room) out.push(Object.assign({}, acc));
    };
    walk(0);
    return out;
  }

  // Troop advantage vs an enemy troop type (informational multiplier hint).
  function troopMatchup(myTroop, enemyTroop) {
    if (!myTroop || !enemyTroop) return { label: "—", delta: 0 };
    const beats = window.GAME.TROOP_BEATS[myTroop] || [];
    const beatenBy = Object.keys(window.GAME.TROOP_BEATS).filter((k) =>
      (window.GAME.TROOP_BEATS[k] || []).indexOf(myTroop) !== -1
    );
    if (beats.indexOf(enemyTroop) !== -1) return { label: "Advantage", delta: 1 };
    if (beatenBy.indexOf(enemyTroop) !== -1) return { label: "Disadvantage", delta: -1 };
    return { label: "Neutral", delta: 0 };
  }

  // ---- Habit upgrade advice --------------------------------------------------
  // Levelling a habit never changes WHAT it does, only how strongly it does it.
  // So the next upgrade pays off most on the habit whose effects the dragons
  // beside it actually use, scaled by how far its numbers move at the next
  // level. Material costs are deliberately not modelled — the game's Breedmark
  // and Rarity Core prices are not in this dataset, so this ranks upgrades by
  // value to the army, not by value per material.

  const HABIT_BASE = 0.02; // every habit does something, even a plain stat line
  // Effects the army model already pays for wherever they come from.
  const TEAM_STAPLE = {
    recovery: 0.04, cleanse: 0.03, mitigation: 0.04, resistance: 0.04,
    protect: 0.04, advantage: 0.05, taunt: 0.05,
  };

  const numbersIn = (s) => (String(s).match(/\d+(?:\.\d+)?/g) || []).map(Number);

  function effectLabel(e) {
    return EFFECT_NAME[e] || e.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  }

  /**
   * How much the next level moves this habit's numbers, as a fraction (0.18 =
   * the values grow ~18%). Every level shares the same wording, so comparing
   * the numbers position by position isolates exactly what the upgrade buys.
   */
  function levelGain(h) {
    if (h.level >= h.descLevels.length) return 0;
    const cur = numbersIn(h.descLevels[h.level - 1]);
    const next = numbersIn(h.descLevels[h.level]);
    const deltas = [];
    for (let i = 0; i < Math.min(cur.length, next.length); i++) {
      if (cur[i] > 0 && next[i] > cur[i]) deltas.push(next[i] / cur[i] - 1);
    }
    // Round counts and stack thresholds are identical at every level, so only
    // the values that actually moved are averaged. A habit whose wording holds
    // no numbers still improves — assume a typical step.
    return deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0.15;
  }

  /**
   * Rank a dragon's five habits by what the NEXT upgrade level is worth, judged
   * against `mates` — the dragons it actually fights alongside. Returns one
   * entry per habit, best first, each carrying a plain-English reason so the UI
   * can explain the recommendation rather than just assert it.
   */
  function habitAdvice(dragon, mates) {
    const name = window.GAME.officialName(dragon);
    const habits = window.GAME.habitsFor(name, dragon.starRank, dragon.habitLevels);
    if (!habits.length) return [];

    const kit = window.GAME.kitFor(name);
    const others = (mates || []).filter(Boolean);
    const maxLevel = window.GAME.HABIT_MAX_LEVEL;
    const wantsOf = (d) => fx(d).wants;

    const ranked = habits.map((h, i) => {
      const block = kit && kit.effects.find((b) => b.source === "habit" + (i + 1));
      const claims = [];
      let value = HABIT_BASE;
      const note = (gain, text) => {
        value += gain;
        if (gain > 0) claims.push({ gain, text });
      };

      if (block) {
        // A debuff is worth most when a teammate's damage keys off it.
        block.applies.forEach((e) => {
          const user = others.find((o) => wantsOf(o).indexOf(e) !== -1 ||
            (CONTROL_EFFECTS.indexOf(e) !== -1 && wantsOf(o).indexOf("control") !== -1));
          if (user) note(WANT_VALUE[e] || 0.05, `${user.name} hits harder into ${effectLabel(e)}`);
          else note(0.02, `more ${effectLabel(e)} on the enemy`);
        });
        block.grants.forEach((g) => {
          const user = others.find((o) => wantsOf(o).indexOf(g) !== -1);
          if (user) note(WANT_VALUE[g] || 0.05, `${user.name} needs ${effectLabel(g)}`);
          else note(TEAM_STAPLE[g] || 0.015, `stronger ${effectLabel(g)} for the army`);
        });
        block.self.forEach((s) => note(TEAM_STAPLE[s] ? 0.03 : 0.02, `stronger ${effectLabel(s)} on ${dragon.name}`));
        // A conditional habit is only worth levelling once something on the
        // field meets its condition.
        block.wants.forEach((w) => {
          const src = others.find((o) => supplies(o, w));
          if (src) note(WANT_VALUE[w] || 0.05, `${src.name} supplies ${effectLabel(w)}, so this habit fires at full strength`);
        });
      }

      const gain = levelGain(h);
      const ready = h.unlocked && h.level < maxLevel;
      claims.sort((a, b) => b.gain - a.gain);
      return {
        index: i,
        star: h.star,
        level: h.level,
        ready,
        status: !h.unlocked ? "locked" : h.level >= maxLevel ? "maxed" : "ready",
        gain,
        score: ready ? value * gain : 0,
        reason: claims.length ? claims[0].text : "raises this habit's numbers",
        missing: block
          ? block.wants.filter((w) => !others.some((o) => supplies(o, w))).map(effectLabel)
          : [],
      };
    });

    return ranked.sort((a, b) => b.score - a.score || a.level - b.level || a.index - b.index);
  }

  window.SCORING = {
    dragonPower,
    goalPower,
    goalShare,
    estimatePower,
    rolePref,
    bestArmy,
    evaluatePlacement,
    troopMatchup,
    habitAdvice,
    SLOTS,
    AFFINITY_BONUS,
  };
})();
