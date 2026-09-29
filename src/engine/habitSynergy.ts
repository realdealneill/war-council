// Habit synergy: how much a formation's Commands and Habits (the structured
// clauses in convex/habitCapabilities — see ./habitClauses.ts) do for EACH
// OTHER, as a fraction of the army's base power.
//
// What counts as synergy here is deliberately narrow — only value that
// crosses between dragons:
//   1. Ally-targeted clauses landing on a teammate (a Damage Dealt buff, a
//      stat buff, a heal, a granted effect like Advantage). The share that
//      lands on the caster itself is solo value — the dragon's own strength,
//      which its power already stands for — so it's left out.
//   2. Enemy-targeted clauses that pay off through a teammate: an enemy Fire
//      Damage Received increase is worth something only to our Fire dealers;
//      Taunt protects the other two dragons; Weakened/Stun blunt the enemy
//      for everyone else.
//   3. Payoffs a teammate sets up: a clause gated on (or boosted by) an
//      effect on the target — "doubled against Burned targets" — is credited
//      as synergy for the part a teammate supplies.
//
// The fight is simulated round by round (1-10) from each clause's timing,
// duration, and chance, so a round-1 debuff only lines up with buffs that
// are also live in its window. Values are expected values: a 20% chance,
// 2-round effect rolled every round is up ~36% of the time, not 20% or 100%.
//
// Every conversion factor (how much +1% Strength is worth, what a heal is
// worth next to a damage buff, …) is a GUESS, collected in HABIT_WEIGHTS so
// they can be tuned in one place.
import { MODEL } from "../data";
import type { Dragon, Goal, Placement } from "../types";
import { COMMAND_SLOT, LANE_REACH, ROUNDS, triggerRounds, troopConditionRounds, type Clause, type Lane } from "./habitClauses";
import { DEFENSE_WEIGHT, dragonPower } from "./power";
import { SYNERGY_WEIGHTS } from "./scoring";

export const HABIT_WEIGHTS = {
  // "physical(CH)"-style buffs only apply to Command & Habit damage, not
  // basic attacks — assumed share of a dealer's total output.
  commandOnlyShare: 0.6,
  // Tanks, healers and control dragons still deal damage, just less —
  // how much of a flat damage buff they cash in vs. a real damage dealer.
  nonDealerOffenseShare: 0.5,
  // +1% of a dealer's own damage stat (Strength → Physical, Intelligence →
  // Tactical & Fire) ≈ this many % more damage.
  statToDamage: 0.5,
  // +1% Instinct ≈ this many % less damage taken. Also prices enemy
  // Strength/Intelligence cuts (they hit softer) and Instinct cuts (they
  // take more).
  statToDefense: 0.3,
  // +1% Initiative (turn order) — small, but not nothing.
  initiativeValue: 0.1,
  // Shared with the kit model in scoring.ts so the two don't drift apart.
  mitigationValue: SYNERGY_WEIGHTS.mitigationValue,
  recoveryValue: SYNERGY_WEIGHTS.recoveryValue,
  // A 100%-coefficient heal on a teammate ≈ this much damage mitigation for that round.
  healPer100: 0.3,
  // A 100%-coefficient damage hit ≈ this fraction of a dragon's round of
  // output. Only used to price a hit a teammate sets up (condition/boost).
  hitPer100: 0.3,
  // Solo value per round of a damage-over-time effect — likewise only used
  // when a teammate sets it up.
  dotValue: 0.1,
  cleanseValue: 0.1,
  // Odds assumed for conditions nobody on our side controls (stack
  // thresholds, enemy composition, "is defending", marks).
  unknownConditionOdds: 0.5,
  // Per active round, for effects with no stated magnitude (a stated one,
  // like Advantage's 20, is used instead). `offense` = % more damage for the
  // recipient; `defense` = % less damage taken.
  allyEffect: {
    advantage: { offense: 0.2 },
    firstStrike: { offense: 0.1 },
    doubleStrike: { offense: 0.25 },
    risingTide: { offense: 0.05 },
    reactive: { offense: 0.05 },
    mirage: { offense: 0.05 },
    resistance: { defense: 0.2 },
    protect: { defense: 0.25 },
    evasion: { defense: 0.15 },
  } as Record<string, { offense?: number; defense?: number }>,
  // Enemy-applied effects, valued for the caster's teammates per active
  // round, scaled by how many of the 3 enemies it covers.
  enemyEffect: {
    vulnerable: { offense: 0.15 },
    weakened: { defense: 0.2 },
    taunt: { defense: 0.3 },
    stun: { defense: 0.3 },
    overwhelm: { defense: 0.25 },
    confusion: { defense: 0.25 },
    panic: { defense: 0.15 },
    slow: { defense: 0.1 },
    stagger: { defense: 0.1 },
  } as Record<string, { offense?: number; defense?: number }>,
};

/** Condition values that mean "any of these effects". */
const EFFECT_GROUPS: Record<string, string[]> = { control: ["stun", "overwhelm", "confusion"] };
const DOT_EFFECTS = ["burn", "bleed", "spreadingBlaze"];

// Stat → the damage type it drives. Strength → Physical is well established;
// Fire riding on Intelligence (like Tactical) is an assumption.
const DAMAGE_STAT: Record<string, string> = { physical: "strength", tactical: "intelligence", fire: "intelligence" };

// ---------------------------------------------------------------------------
// Inputs

export interface SkillRecord {
  habitSlot: number;
  isCommandHabit: boolean;
  clauses: Clause[];
}
/** Every dragon's Command + Habits, keyed by dragon NAME (roster ids have changed source before; names haven't). */
export type SkillsByDragon = Record<string, SkillRecord[]>;

/** Habit levels (1-5) for habit slots 1-5; null = not unlocked. */
export type HabitLevels = (number | null)[];
export type LoadoutFor = (d: Dragon) => HabitLevels;

/** Habits unlocked by each dragon's own star rank (★2/4/6/8/10), all at `level`. */
export const loadoutFromStars =
  (level: number): LoadoutFor =>
  (d) =>
    MODEL.HABIT_UNLOCK_STARS.map((stars) => (d.starRank >= stars ? level : null));

/** All 5 habits unlocked at `level` — a dragon's potential, until rosters record which habits you really have. */
export const allHabitsAt =
  (level: number): LoadoutFor =>
  () =>
    [level, level, level, level, level];

export interface HabitSynergyContext {
  skills: SkillsByDragon;
  loadout: LoadoutFor;
  goal?: Goal;
}

export interface HabitSynergyEntry {
  text: string;
  /** Fraction of the army's base power. */
  pct: number;
}

/** One habit-synergy link: a source skill's value reaching teammates, or a payoff teammates set up. */
export interface HabitLink {
  source: Dragon;
  /** 0 = Command, 1-5 = Habit. */
  slot: number;
  /** Teammates the value lands on; empty for a set-up link (the value is the source's own payoff). */
  recipients: string[];
  /** Short clause heads, e.g. "Strength +25%", "enemy Fire Damage Received +36%". */
  effects: string[];
  /** Teammates who supply the condition, for a set-up link. */
  setUpBy?: string[];
  /** Fraction of the army's base power. */
  pct: number;
  /** P(the link's value is live) per round 1-10, 0-1. */
  uptimeByRound: number[];
}

export interface HabitSynergyResult {
  pct: number;
  entries: HabitSynergyEntry[];
  links: HabitLink[];
}

// ---------------------------------------------------------------------------
// Per-clause timing

type Vec = number[]; // index = round - 1
const zeros = (): Vec => ROUNDS.map(() => 0);
const mean = (v: Vec) => v.reduce((a, b) => a + b, 0) / v.length;

function at(levels: (number | null)[] | undefined, level: number): number | null {
  if (!levels) return null;
  return levels[level - 1] ?? levels.find((x) => x != null) ?? null;
}

function durationLength(c: Clause): number {
  const d = c.duration ?? (c.timing.mode === "combat" ? "combat" : "round");
  return d === "combat" ? 10 : d === "round" ? 1 : d;
}

/** P(clause is in effect) each round, from its trigger rounds, duration, chance, and troop-capacity conditions. Null for event-driven clauses (no fixed place on the timeline). */
function uptime(c: Clause, chance: number): Vec | null {
  const trig = triggerRounds(c.timing);
  if (!trig) return null;
  const len = durationLength(c);
  const miss = ROUNDS.map(() => 1);
  for (const t of trig) for (let r = t; r < t + len && r <= 10; r++) miss[r - 1] *= 1 - chance;
  let allowed = ROUNDS;
  for (const cond of c.conditions) {
    if (cond.scope === "selfTroops" || cond.scope === "targetTroops") {
      const ok = troopConditionRounds(cond.value);
      allowed = allowed.filter((r) => ok.includes(r));
    }
  }
  return ROUNDS.map((r) => (allowed.includes(r) ? 1 - miss[r - 1] : 0));
}

/** A clause as it plays at the dragon's habit level. */
interface LiveClause {
  clause: Clause;
  source: Dragon;
  slot: number;
  level: number;
  /** Signed value at `level` (× expected stacks for stacking clauses). */
  value: number;
  up: Vec;
}

const stackFactor = (c: Clause) => (c.stack ? c.stack.max * 0.5 : 1);

function liveClausesFor(d: Dragon, ctx: HabitSynergyContext): LiveClause[] {
  const levels = ctx.loadout(d);
  const out: LiveClause[] = [];
  for (const s of ctx.skills[d.name] ?? []) {
    // Commands have no levels (their values repeat 5×).
    const level = s.habitSlot === COMMAND_SLOT ? 5 : levels[s.habitSlot - 1];
    if (level == null) continue;
    for (const clause of s.clauses) {
      if (clause.skip || !clause.target) continue;
      const up = uptime(clause, (at(clause.chanceByLevel, level) ?? 100) / 100);
      if (!up) continue;
      out.push({ clause, source: d, slot: s.habitSlot, level, value: (at(clause.valueByLevel, level) ?? 0) * stackFactor(clause), up });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Who a clause lands on

interface Seat {
  lane: Lane;
  dragon: Dragon | null;
}
const LANES: Lane[] = ["left", "vanguard", "right"];
const seatsOf = (p: Placement): Seat[] => LANES.map((lane) => ({ lane, dragon: p[lane] }));
const laneOf = (p: Placement, d: Dragon): Lane => LANES.find((l) => p[l] === d)!;

function matchesPrefer(prefer: string, d: Dragon, lane: Lane): boolean | null {
  const [k, v] = prefer.split(":");
  if (k === "lane") return lane === v;
  if (k === "dealsDamage") return d.damageType === v;
  if (k === "breed") return d.breed === v;
  return null; // highest:stat, mostTroops, leastTroops, … — not knowable here, so uniform
}

/**
 * Expected share (0-1) of an ally-targeted clause each seated dragon gets.
 * Empty lanes still count as seats, so a 2-dragon preview doesn't pile
 * "1 ally" buffs onto the only 2 dragons present. Per the README's rules,
 * "N (other) allies" still picks from all 3 (self included), and adjacency
 * limits the pool to LANE_REACH.
 */
function allyShares(c: Clause, source: Dragon, p: Placement): Map<Dragon, number> {
  const t = c.target!;
  const out = new Map<Dragon, number>();
  if (t.side === "self") return out.set(source, 1);
  const srcLane = laneOf(p, source);
  const reach = t.scope === "adjacent" ? LANE_REACH[srcLane] : t.scope === "sameLane" ? [srcLane] : LANES;
  let pool = seatsOf(p).filter((s) => reach.includes(s.lane));
  const count = t.count ?? 3;

  const understood = t.prefer != null && pool.some((s) => s.dragon && matchesPrefer(t.prefer!, s.dragon, s.lane) != null);
  const isMatch = (s: Seat) => understood && s.dragon != null && matchesPrefer(t.prefer!, s.dragon, s.lane) === true;
  if (understood && t.filter) pool = pool.filter(isMatch);

  const matching = pool.filter(isMatch);
  const rest = pool.filter((s) => !isMatch(s));
  const give = (s: Seat, share: number) => s.dragon && out.set(s.dragon, Math.min(1, share));
  if (count >= pool.length) pool.forEach((s) => give(s, 1));
  else if (matching.length >= count) matching.forEach((s) => give(s, count / matching.length));
  else {
    matching.forEach((s) => give(s, 1));
    rest.forEach((s) => give(s, (count - matching.length) / rest.length));
  }
  return out;
}

/** Fraction of the 3 enemies an enemy-targeted clause covers. */
function enemyCoverage(c: Clause): number {
  const t = c.target!;
  return Math.min(1, (t.scope === "sameLane" ? 1 : (t.count ?? 3)) / 3);
}

// ---------------------------------------------------------------------------
// What a clause is worth to one recipient, per active round (fraction of that recipient's power)

const offenseShare = (d: Dragon) =>
  d.role === "tank" || d.role === "healer" || d.role === "control" ? HABIT_WEIGHTS.nonDealerOffenseShare : 1;

/** Share of `d`'s damage a damage-type list touches ("all", "fire", "physical(CH)" …). */
function damageMatch(what: string[], d: Dragon): number {
  let best = 0;
  for (const w of what) {
    const type = w.replace("(CH)", "");
    if (type === "all" || type === d.damageType) best = Math.max(best, w.endsWith("(CH)") ? HABIT_WEIGHTS.commandOnlyShare : 1);
  }
  return best;
}

function effectValue(table: Record<string, { offense?: number; defense?: number }>, lc: LiveClause, r: Dragon, defense: number): number {
  const e = table[lc.clause.what[0]];
  if (!e) return 0;
  const mag = lc.value ? Math.abs(lc.value) / 100 : null;
  return (
    (e.offense != null ? (mag ?? e.offense) * offenseShare(r) : 0) +
    (e.defense != null ? (mag ?? e.defense) * HABIT_WEIGHTS.mitigationValue * defense : 0)
  );
}

/** Value of an ally- or self-side clause to `r`. */
function allyValue(lc: LiveClause, r: Dragon, defense: number): number {
  const W = HABIT_WEIGHTS;
  const { clause: c, value } = lc;
  switch (c.kind) {
    case "dmgDealt":
      return (value / 100) * damageMatch(c.what, r) * offenseShare(r);
    case "dmgRecv":
      return (-value / 100) * W.mitigationValue * defense;
    case "stat": {
      let v = 0;
      for (const s of c.what) {
        if (s === DAMAGE_STAT[r.damageType]) v += (value / 100) * W.statToDamage * offenseShare(r);
        else if (s === "instinct") v += (value / 100) * W.statToDefense * defense;
        else if (s === "initiative") v += (value / 100) * W.initiativeValue;
      }
      return v;
    }
    case "recovRecv":
    case "recovDealt":
      return (value / 100) * W.recoveryValue * defense * 0.5;
    case "heal":
      return (value / 100) * W.healPer100 * defense;
    case "cleanse":
      return W.cleanseValue * defense;
    case "hit":
      return (value / 100) * W.hitPer100;
    case "effect":
      return effectValue(W.allyEffect, lc, r, defense);
    default:
      return 0;
  }
}

/** Value of an enemy-side clause to our dragon `r`, if it covered every enemy (callers scale by coverage). */
function enemyValue(lc: LiveClause, r: Dragon, defense: number): number {
  const W = HABIT_WEIGHTS;
  const { clause: c, value } = lc;
  switch (c.kind) {
    case "dmgRecv": // enemy takes more of a type — pays off for our dealers of that type
      return (value / 100) * damageMatch(c.what, r) * offenseShare(r);
    case "dmgDealt": // enemy deals less
      return (-value / 100) * W.mitigationValue * defense;
    case "stat": {
      const cut = -value / 100;
      let v = 0;
      for (const s of c.what) {
        // Only one of Strength/Intelligence drives any given enemy's damage, so each is worth half.
        if (s === "strength" || s === "intelligence") v += (cut * W.statToDefense * defense) / 2;
        else if (s === "instinct") v += cut * W.statToDefense * offenseShare(r);
        else if (s === "initiative") v += cut * W.initiativeValue;
      }
      return v;
    }
    case "recovRecv": // anti-heal
      return (-value / 100) * W.recoveryValue * 0.5 * offenseShare(r);
    case "effect":
      return effectValue(W.enemyEffect, lc, r, defense);
    default:
      return 0;
  }
}

/**
 * A clause's value per round it's up, split into what lands on the caster
 * and what lands on its teammates — in absolute power (share × value ×
 * recipient's power), plus which teammates it actually reaches.
 */
function valueSplit(lc: LiveClause, p: Placement, defense: number): { caster: number; team: number; to: string[] } {
  const c = lc.clause;
  const src = lc.source;
  let caster = 0;
  let team = 0;
  const to: string[] = [];
  const add = (r: Dragon, v: number) => {
    if (r === src) caster += v;
    else {
      team += v;
      if (v > 0) to.push(r.name);
    }
  };
  if (c.target!.side === "enemy") {
    const cov = enemyCoverage(c);
    if (c.kind === "hit") caster = (lc.value / 100) * HABIT_WEIGHTS.hitPer100 * cov * dragonPower(src);
    else if (c.kind === "effect" && DOT_EFFECTS.includes(c.what[0])) caster = HABIT_WEIGHTS.dotValue * cov * dragonPower(src);
    else for (const seat of seatsOf(p)) if (seat.dragon) add(seat.dragon, enemyValue(lc, seat.dragon, defense) * cov * dragonPower(seat.dragon));
  } else {
    for (const [r, share] of allyShares(c, src, p)) add(r, share * allyValue(lc, r, defense) * dragonPower(r));
  }
  return { caster, team, to };
}

// ---------------------------------------------------------------------------
// Effect supply: how likely an effect is up each round, and who supplies it

type SupplyMap = Map<string, Map<Dragon, Vec>>;
interface Supply {
  /** P(effect is on a given enemy), per round, by supplier. */
  enemy: SupplyMap;
  /** P(effect is on a given ally), per round, by supplier. */
  ally: SupplyMap;
}

function buildSupply(live: LiveClause[]): Supply {
  const s: Supply = { enemy: new Map(), ally: new Map() };
  for (const lc of live) {
    const c = lc.clause;
    // Suppliers that are themselves gated would need a fixed-point pass; left out.
    if (c.kind !== "effect" || c.conditions.length) continue;
    const t = c.target!;
    const reach = t.side === "enemy" ? enemyCoverage(c) : t.side === "self" ? 1 : Math.min(1, (t.count ?? 3) / 3);
    const m = t.side === "enemy" ? s.enemy : s.ally;
    const bySrc = m.get(c.what[0]) ?? new Map<Dragon, Vec>();
    const prev = bySrc.get(lc.source) ?? zeros();
    bySrc.set(lc.source, prev.map((x, i) => 1 - (1 - x) * (1 - lc.up[i] * reach)));
    m.set(c.what[0], bySrc);
  }
  return s;
}

const EFFECT_SCOPES = new Set(["target", "anyEnemy", "anyAlly", "self"]);
const isTroopScope = (scope: string) => scope === "selfTroops" || scope === "targetTroops";

interface Odds {
  /** P(condition holds) per round, from every supplier. */
  total: Vec;
  /** …from the caster alone. */
  solo: Vec;
  /** Teammates who contribute. */
  suppliers: Set<Dragon>;
}

/**
 * Odds an effect-based condition ("target is Burned", "an ally has
 * Advantage") holds each round. A condition on something no dragon's
 * clauses can apply (a mark, "healed last round", "deals Physical") isn't
 * teammate-driven: it's priced at unknownConditionOdds and credited to nobody.
 */
function conditionOdds(cond: { scope: string; value: string }, self: Dragon, supply: Supply, knownEffects: Set<string>): Odds {
  const effects = EFFECT_GROUPS[cond.value] ?? [cond.value];
  if (!effects.some((e) => knownEffects.has(e))) {
    const k = ROUNDS.map(() => HABIT_WEIGHTS.unknownConditionOdds);
    return { total: k, solo: k, suppliers: new Set() };
  }
  const side = cond.scope === "target" || cond.scope === "anyEnemy" ? supply.enemy : supply.ally;
  const allMiss = ROUNDS.map(() => 1);
  const selfMiss = ROUNDS.map(() => 1);
  const suppliers = new Set<Dragon>();
  for (const e of effects) {
    for (const [src, v] of side.get(e) ?? []) {
      v.forEach((x, i) => {
        allMiss[i] *= 1 - x;
        if (src === self) selfMiss[i] *= 1 - x;
      });
      if (src !== self && v.some((x) => x > 0)) suppliers.add(src);
    }
  }
  return { total: allMiss.map((x) => 1 - x), solo: selfMiss.map((x) => 1 - x), suppliers };
}

const product = (odds: Odds[], pick: (o: Odds) => Vec): Vec => ROUNDS.map((_, i) => odds.reduce((acc, o) => acc * pick(o)[i], 1));

const knownEffectsCache = new WeakMap<SkillsByDragon, Set<string>>();
function knownEffects(skills: SkillsByDragon): Set<string> {
  let s = knownEffectsCache.get(skills);
  if (!s) {
    s = new Set(Object.values(skills).flatMap((list) => list.flatMap((sk) => sk.clauses.filter((c) => c.kind === "effect").map((c) => c.what[0]))));
    knownEffectsCache.set(skills, s);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Main entry point

const slotLabel = (slot: number) => (slot === COMMAND_SLOT ? "Command" : `Habit ${slot}`);
// "physical(CH)" → "Physical (Cmd/Habit)", "firstStrike" → "First Strike"
const pretty = (s: string) =>
  s.replace("(CH)", " (Cmd/Habit)").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (x) => x.toUpperCase());

function clauseHead(c: Clause, value: number): string {
  if (c.target?.side === "enemy" && c.kind !== "effect") return `enemy ${clauseHead({ ...c, target: undefined }, value)}`;
  // "all" damage types reads as plain "Damage Dealt".
  const what = c.what.filter((w) => w !== "all").map(pretty).join("/");
  const v = value ? ` ${value > 0 ? "+" : ""}${Math.round(value * 10) / 10}%` : "";
  switch (c.kind) {
    case "dmgDealt": return `${what ? what + " " : ""}Damage Dealt${v}`;
    case "dmgRecv": return `${what ? what + " " : ""}Damage Received${v}`;
    case "stat": return `${what}${v}`;
    case "recovRecv": return `Recovery Received${v}`;
    case "recovDealt": return `Recovery Dealt${v}`;
    case "heal": return "Recovery";
    case "cleanse": return "Cleanse";
    case "hit": return `${what} hit`;
    default: return what;
  }
}

/**
 * Habit synergy for a (possibly partial) placement, as a fraction of its
 * base power. Fewer than 2 dragons → 0; a dragon with no clause data just
 * contributes nothing.
 */
export function habitSynergy(p: Placement, ctx: HabitSynergyContext): HabitSynergyResult {
  const defense = DEFENSE_WEIGHT[ctx.goal ?? "balanced"] ?? 1;
  const dragons = seatsOf(p).map((s) => s.dragon).filter((d): d is Dragon => d != null);
  const basePower = dragons.reduce((s, d) => s + dragonPower(d), 0);
  if (dragons.length < 2 || basePower <= 0) return { pct: 0, entries: [], links: [] };

  const live = dragons.flatMap((d) => liveClausesFor(d, ctx));
  const supply = buildSupply(live);
  const known = knownEffects(ctx.skills);

  // One link per (source skill, link type), not per clause. `perRound` is
  // the value actually live each round; `full` is what it would be if it
  // were live every round, so perRound / full is the link's uptime.
  interface Acc { perRound: Vec; full: number; source: Dragon; slot: number; heads: Set<string>; to: Set<string>; via: string[] }
  const acc = new Map<string, Acc>();
  const credit = (lc: LiveClause, perRound: Vec, full: number, to: string[], via: Dragon[] = []) => {
    if (!(mean(perRound) > 0)) return;
    const viaNames = [...new Set(via.map((d) => d.name))];
    const key = `${lc.source.name}|${lc.slot}|${viaNames.join("&")}`;
    const e = acc.get(key) ?? { perRound: zeros(), full: 0, source: lc.source, slot: lc.slot, heads: new Set<string>(), to: new Set<string>(), via: viaNames };
    perRound.forEach((x, i) => (e.perRound[i] += x));
    e.full += full;
    e.heads.add(clauseHead(lc.clause, lc.value));
    to.forEach((n) => e.to.add(n));
    acc.set(key, e);
  };

  for (const lc of live) {
    const c = lc.clause;
    const unknownFactor = c.conditions.some((k) => !EFFECT_SCOPES.has(k.scope) && !isTroopScope(k.scope)) ? HABIT_WEIGHTS.unknownConditionOdds : 1;
    const gates = c.conditions.filter((k) => EFFECT_SCOPES.has(k.scope)).map((k) => conditionOdds(k, lc.source, supply, known));
    const gate = product(gates, (o) => o.total); // all 1s when ungated
    const soloGate = product(gates, (o) => o.solo);
    const split = valueSplit(lc, p, defense);

    // 1 & 2. Value landing on teammates — synergy whoever satisfies the gate.
    credit(lc, lc.up.map((x, i) => split.team * x * gate[i] * unknownFactor), split.team * unknownFactor, split.to);

    // 3a. The caster's own payoff, for the part of its gate a teammate satisfies.
    const gateSuppliers = gates.flatMap((o) => [...o.suppliers]);
    if (gateSuppliers.length) {
      credit(lc, lc.up.map((x, i) => split.caster * x * (gate[i] - soloGate[i]) * unknownFactor), split.caster * unknownFactor, [], gateSuppliers);
    }

    // 3b. Boosts ("chance doubled vs Burned targets"): the extra over the base clause.
    for (const b of c.boosts) {
      if (!b.condition || !EFFECT_SCOPES.has(b.condition.scope)) continue;
      const odds = conditionOdds(b.condition, lc.source, supply, known);
      const boosted: LiveClause = { ...lc };
      if (b.valueByLevel) boosted.value = (at(b.valueByLevel, lc.level) ?? 0) * stackFactor(c);
      if (b.multiplier) boosted.value = lc.value * b.multiplier;
      if (b.chanceByLevel) boosted.up = uptime(c, (at(b.chanceByLevel, lc.level) ?? 100) / 100) ?? lc.up;
      const bSplit = valueSplit(boosted, p, defense);
      const extra = (who: "caster" | "team", w: Vec) =>
        ROUNDS.map((_, i) => Math.max(0, bSplit[who] * boosted.up[i] - split[who] * lc.up[i]) * w[i] * gate[i] * unknownFactor);
      // Extra on teammates counts whoever enables it; extra on the caster only for the teammate-supplied part.
      credit(lc, extra("team", odds.total), bSplit.team * unknownFactor, bSplit.to);
      if (odds.suppliers.size)
        credit(lc, extra("caster", ROUNDS.map((_, i) => odds.total[i] - odds.solo[i])), bSplit.caster * unknownFactor, [], [...odds.suppliers]);
    }
  }

  const links: HabitLink[] = [...acc.values()]
    .map((e) => ({
      source: e.source,
      slot: e.slot,
      recipients: e.via.length ? [] : [...e.to],
      effects: [...e.heads],
      ...(e.via.length ? { setUpBy: e.via } : {}),
      pct: mean(e.perRound) / basePower,
      uptimeByRound: e.perRound.map((x) => (e.full > 0 ? Math.min(1, Math.max(0, x / e.full)) : 0)),
    }))
    .filter((l) => l.pct >= 0.0005)
    .sort((a, b) => b.pct - a.pct);

  const entries: HabitSynergyEntry[] = links.map((l) => ({
    text: l.setUpBy
      ? `${l.source.name} ${slotLabel(l.slot)} (${l.effects.join(", ")}) — set up by ${l.setUpBy.join(" & ")}`
      : `${l.source.name} ${slotLabel(l.slot)} → ${l.recipients.join(" & ")}: ${l.effects.join(", ")}`,
    pct: l.pct,
  }));

  return { pct: links.reduce((s, l) => s + l.pct, 0), entries, links };
}
