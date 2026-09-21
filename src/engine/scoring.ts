// Effective-power & synergy model for a 3-dragon army.
//
// Ported from dragonfire-formations.com's js/scoring.js (see
// ../../reference/dragonfire-formations-site), with one deliberate change:
// the troop-type advantage cycle (TROOP_BEATS) actually affects the score
// here when an enemy troop type is given. In the reference site it's wired
// into the UI (a "vs enemy troop" selector) but never reaches evaluatePlacement
// — it only decorates a label. See section 1b below.
import { MODEL } from "../data";
import { dragonEffects, appliesControl, holds, isDPS, supplies } from "./effects";
import { DEFENSE_WEIGHT, dragonPower, goalPower, goalShare } from "./power";
import type {
  ArmyEvaluation, Dragon, EffectId, Goal, Placement, SynergyEntry, TroopType, VanguardSkill,
} from "../types";
import { DRAGON_KITS } from "../data";

const SLOTS: (keyof Placement)[] = ["left", "vanguard", "right"];

const AFFINITY_BONUS = 0.07;
const AFFINITY_PENALTY = 0.07;

// A team-wide edge/disadvantage from the troop-type matchup cycle, on top of
// each dragon's own troop affinity (section 1). Kept smaller than affinity
// since it applies once per army rather than per dragon.
const MATCHUP_BONUS = 0.05;
const MATCHUP_PENALTY = 0.05;

const MITIGATION_VALUE = 0.5;
const RECOVERY_VALUE = 0.35;
const STAT_POINT_VALUE = 0.002;

const WANT_VALUE: Partial<Record<EffectId, number>> = {
  control: 0.08, panic: 0.07, burn: 0.06, vulnerable: 0.06, taunt: 0.05,
  slow: 0.04, bleed: 0.04, weakened: 0.04,
  advantage: 0.06, resistance: 0.05, firstStrike: 0.06, recovery: 0.04,
  sentinel: 0.1,
};

const EFFECT_NAME: Partial<Record<EffectId, string>> = {
  control: "Control", panic: "Panic", burn: "Burn", vulnerable: "Vulnerable",
  taunt: "Taunt", slow: "Slow", bleed: "Bleed", weakened: "Weakened",
  advantage: "Advantage", resistance: "Resistance", firstStrike: "First Strike",
  recovery: "Recovery", sentinel: "a Tactical/Recovery Sentinel",
};

function roleLabel(d: Dragon): string {
  return MODEL.ROLES.find((r) => r.id === d.role)?.name ?? d.role;
}

function vanguardFor(d: Dragon): VanguardSkill | null {
  return DRAGON_KITS[d.name]?.vanguard ?? null;
}

interface BuffEffect {
  kind: "damage" | "damageAny" | "mitigation" | "recovery" | "stat";
  type?: string;
  pct?: number;
  stats?: string[];
  flat?: number;
}

function buffValue(effects: BuffEffect[] | undefined, receiver: Dragon | null, defense: number): number {
  let pct = 0;
  (effects ?? []).forEach((e) => {
    if (e.kind === "damage") pct += receiver && receiver.damageType === e.type ? (e.pct ?? 0) : 0;
    else if (e.kind === "damageAny") pct += e.pct ?? 0;
    else if (e.kind === "mitigation") pct += (e.pct ?? 0) * MITIGATION_VALUE * defense;
    else if (e.kind === "recovery") pct += (e.pct ?? 0) * RECOVERY_VALUE * defense;
    else if (e.kind === "stat") pct += (e.stats?.length ?? 0) * (e.flat ?? 0) * STAT_POINT_VALUE;
  });
  return pct;
}

function mismatchedDamageBuff(effects: BuffEffect[] | undefined, receiver: Dragon | null): string | null {
  const dmg = (effects ?? []).filter((e) => e.kind === "damage");
  if (!dmg.length || !receiver) return null;
  return dmg.every((e) => receiver.damageType !== e.type) ? (dmg[0].type ?? null) : null;
}

/** Advantage / Disadvantage / Neutral between two troop types on the cycle. */
export function troopMatchup(myTroop: TroopType | null, enemyTroop: TroopType | null | undefined) {
  if (!myTroop || !enemyTroop) return { label: "—", delta: 0 as -1 | 0 | 1 };
  const beats = MODEL.TROOP_BEATS[myTroop] ?? [];
  const beatenBy = Object.keys(MODEL.TROOP_BEATS).filter((k) => (MODEL.TROOP_BEATS[k] ?? []).includes(myTroop));
  if (beats.includes(enemyTroop)) return { label: "Advantage", delta: 1 as const };
  if (beatenBy.includes(enemyTroop)) return { label: "Disadvantage", delta: -1 as const };
  return { label: "Neutral", delta: 0 as const };
}

export interface EvaluateOptions {
  goal?: Goal;
  enemyTroop?: TroopType | null;
}

export function evaluatePlacement(placement: Placement, troopType: TroopType | null, opts: EvaluateOptions = {}): ArmyEvaluation {
  const goal = opts.goal ?? "balanced";
  const dragons = SLOTS.map((s) => placement[s]).filter((d): d is Dragon => Boolean(d));
  if (dragons.length === 0) {
    return { score: 0, basePower: 0, rawPower: 0, bonusPct: 0, synergies: [], warnings: [], placement, troopType };
  }

  const defense = DEFENSE_WEIGHT[goal] ?? 1;
  const pw = (d: Dragon) => goalPower(d, goal);
  const rawPower = dragons.reduce((s, d) => s + dragonPower(d), 0);
  const basePower = dragons.reduce((s, d) => s + pw(d), 0);
  const synergies: SynergyEntry[] = [];
  const warnings: string[] = [];
  let bonus = 0;

  const add = (text: string, pct: number, refPower?: number) => {
    const amt = pct * (refPower ?? basePower);
    bonus += amt;
    synergies.push({ text, pct: amt / basePower });
  };

  // --- 1. Affinity with the chosen troop type ---
  if (troopType) {
    let positives = 0;
    dragons.forEach((d) => {
      const a = d.affinity?.[troopType] ?? 0;
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

  // --- 1b. Troop-type advantage cycle vs a named enemy troop (our addition —
  // the reference site shows this matchup but never scores it). ---
  if (troopType && opts.enemyTroop) {
    const m = troopMatchup(troopType, opts.enemyTroop);
    if (m.delta === 1) add(`${troopType} has the advantage vs ${opts.enemyTroop}`, MATCHUP_BONUS);
    else if (m.delta === -1) {
      bonus -= MATCHUP_PENALTY * basePower;
      warnings.push(`${troopType} is at a disadvantage vs ${opts.enemyTroop} (-${Math.round(MATCHUP_PENALTY * 100)}%)`);
    }
  }

  const left = placement.left;
  const vg = placement.vanguard;
  const right = placement.right;

  // --- 2. The Vanguard skill: a self buff, plus a buff on one named flank ---
  if (vg) {
    const skill = vanguardFor(vg);
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
    if (applies(vg, "taunt")) add(`${vg.name} taunts from the Vanguard — soaks damage for your flanks`, 0.1 * defense);
  } else {
    warnings.push("No Vanguard dragon assigned.");
  }

  // --- 3. Role-position fit ---
  if (right && right.role === "physical") add(`${right.name} (Physical DPS) correctly on Right Flank`, 0.05, pw(right));
  if (left && (left.role === "tactical" || left.role === "fire" || left.role === "healer"))
    add(`${left.name} (${left.role}) correctly on Left Flank`, 0.04, pw(left));
  if (vg && vg.role === "tank") add(`${vg.name} (Tank) correctly in Vanguard`, 0.05 * defense, pw(vg));
  if (right && right.role === "tank") warnings.push(`${right.name} is a Tank but on the Right Flank — usually better in Vanguard.`);

  // --- 4. Kit synergies: what each dragon needs vs what the others supply ---
  dragons.forEach((d) => {
    dragonEffects(d).wants.forEach((want) => {
      const source = dragons.find((o) => o !== d && supplies(o, want));
      if (!source) return;
      const name = EFFECT_NAME[want] ?? want;
      add(`${d.name} hits harder with ${name} — supplied by ${source.name}`, WANT_VALUE[want] ?? 0.05, pw(d));
    });
  });

  const anyTaunt = dragons.some((d) => applies(d, "taunt"));
  const anySustain = dragons.some((d) => grantsEffect(d, "recovery") || grantsEffect(d, "cleanse"));
  const anyMitigation = dragons.some((d) => grantsEffect(d, "mitigation") || grantsEffect(d, "resistance") || grantsEffect(d, "protect"));
  const advantageGivers = dragons.filter((d) => grantsEffect(d, "advantage"));
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

  dragons.forEach((d) => {
    if (!holds(d, "risingTide")) return;
    const needs = dragonEffects(d).wants;
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

  dragons.forEach((d) => {
    dragonEffects(d).wants.forEach((want) => {
      if (dragons.some((o) => o !== d && supplies(o, want))) return;
      warnings.push(`${d.name} wants ${EFFECT_NAME[want] ?? want} on the field — no teammate supplies it.`);
    });
  });

  // --- 6. Formation goal emphasis ---
  if (goal === "siege") {
    const ampl = dragons.filter((d) =>
      applies(d, "vulnerable") || applies(d, "weakened") || applies(d, "burn") ||
      grantsEffect(d, "advantage") || holds(d, "doubleStrike") || holds(d, "mirage") || holds(d, "risingTide")
    );
    ampl.forEach((d) => add(`${d.name} multiplies this army's damage output`, 0.05, pw(d)));
    dragons.forEach((d) => {
      const share = goalShare(d, goal);
      if (share < 1) {
        warnings.push(`${d.name} (${roleLabel(d)}) only converts about ${Math.round(share * 100)}% of its power into siege damage — a structure never attacks back.`);
      }
    });
  } else if (goal === "dps") {
    const dealers = dragons.filter(isDPS).length;
    if (dealers) add(`DPS focus: ${dealers} damage dealer(s)`, 0.05 * dealers);
    const ampl = dragons.filter((d) => applies(d, "vulnerable") || applies(d, "burn") || holds(d, "doubleStrike") || holds(d, "mirage") || grantsEffect(d, "advantage")).length;
    if (ampl) add(`Offensive kit: ${ampl} damage-amplifying dragon(s)`, 0.03 * ampl);
  }

  const score = basePower + bonus;
  return { score, basePower, rawPower, bonusPct: bonus / basePower, synergies, warnings, placement, troopType };
}

function applies(d: Dragon, e: EffectId) { return dragonEffects(d).applies.includes(e); }
function grantsEffect(d: Dragon, e: EffectId) { return dragonEffects(d).grants.includes(e); }

/** Every way to seat `items` into `slots`, one dragon per slot (≤3 each, so brute force is exact and instant). */
function seatings(items: Dragon[], slots: (keyof Placement)[]): Partial<Placement>[] {
  const out: Partial<Placement>[] = [];
  function build(remainingItems: Dragon[], remainingSlots: (keyof Placement)[], acc: Partial<Placement>) {
    if (remainingSlots.length === 0 || remainingItems.length === 0) {
      out.push({ ...acc });
      return;
    }
    const [slot, ...restSlots] = remainingSlots;
    // Leave this slot empty.
    build(remainingItems, restSlots, acc);
    // Or fill it with each remaining item.
    remainingItems.forEach((item, i) => {
      const rest = remainingItems.slice(0, i).concat(remainingItems.slice(i + 1));
      build(rest, restSlots, { ...acc, [slot]: item });
    });
  }
  build(items, slots, {});
  return out;
}

/**
 * Given up to 3 dragons, find the best position arrangement and troop type.
 * `locked` nails named slots to a specific dragon (a hand-picked Vanguard
 * survives instead of being shuffled to a flank).
 */
export function bestArmy(
  dragons: Dragon[],
  troopOptions: TroopType[] | undefined,
  opts: EvaluateOptions = {},
  locked?: Partial<Record<keyof Placement, Dragon>>
): ArmyEvaluation {
  const ds = dragons.filter(Boolean);
  const troops = troopOptions ?? (MODEL.TROOP_TYPES.map((t) => t.id) as TroopType[]);

  const held: Partial<Placement> = {};
  if (locked) SLOTS.forEach((s) => { if (locked[s] && ds.includes(locked[s]!)) held[s] = locked[s]; });
  const heldDragons = SLOTS.map((s) => held[s]).filter((d): d is Dragon => Boolean(d));
  const free = ds.filter((d) => !heldDragons.includes(d));
  const openSlots = SLOTS.filter((s) => !held[s]);

  let best: ArmyEvaluation | null = null;
  for (const seating of seatings(free, openSlots)) {
    const placement: Placement = { left: null, vanguard: null, right: null, ...held, ...seating };
    for (const t of troops) {
      const ev = evaluatePlacement(placement, t, opts);
      if (!best || ev.score > best.score) best = ev;
    }
  }
  return best ?? { score: 0, basePower: 0, rawPower: 0, bonusPct: 0, synergies: [], warnings: [], placement: { left: null, vanguard: null, right: null }, troopType: null };
}
