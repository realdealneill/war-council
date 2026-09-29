// Preview-only sheet-stat rating for a formation. Not used by scoring.ts,
// formation.ts, or habitSynergy.ts — those still score percent-of-power.
//
// Stat jobs, per Neill:
//   Strength     → Physical offense only
//   Instinct     → Tactical offense (only if they deal Tactical) AND Physical defense
//   Intelligence → Fire offense (only if they deal Fire) AND Tactical defense
//   Initiative   → Fire defense AND turn order
//
// Sheet = ★1 base × star-rank growth. Reign level and habit level do not
// change these four. A formation fields one troop type. A dragon with +
// affinity for that troop gets +20% on all four stats before combat buffs.
// Combat text then modifies that sheet: a percent buff is percent × the
// (affinity-adjusted) sheet, a raw +20 is +20. A buff whose stat is not one
// of that dragon's jobs adds nothing to that job.
import { kitFor } from "../data";
import type { Clause } from "./habitClauses";
import { COMMAND_SLOT, LANE_REACH, ROUNDS, triggerRounds, troopConditionRounds, type Lane } from "./habitClauses";
import type { LoadoutFor, SkillsByDragon } from "./habitSynergy";
import type { Affinity, DamageType, Dragon, Placement, Rarity, TroopType } from "../types";

export const STATS = ["strength", "instinct", "intelligence", "initiative"] as const;
export type StatName = (typeof STATS)[number];

export const STAT_LABEL: Record<StatName, string> = {
  strength: "Strength",
  instinct: "Instinct",
  intelligence: "Intelligence",
  initiative: "Initiative",
};

/** Offense stat for a damage type. `none` has no offense stat. */
export const OFFENSE_STAT: Record<Exclude<DamageType, "none">, StatName> = {
  physical: "strength",
  tactical: "instinct",
  fire: "intelligence",
};

/** Defense stat that answers each incoming damage type. */
export const DEFENSE_STAT: Record<Exclude<DamageType, "none">, StatName> = {
  physical: "instinct",
  tactical: "intelligence",
  fire: "initiative",
};

/**
 * Enemy stat → the incoming damage type that gets softer when that stat is cut.
 * Initiative is turn order, not a damage stat, so cutting it does not reduce incoming damage.
 */
const ENEMY_STAT_INCOMING: Record<StatName, Exclude<DamageType, "none"> | null> = {
  strength: "physical",
  instinct: "tactical",
  intelligence: "fire",
  initiative: null,
};

// Same rates as the dragon-stats calculator (src/admin/DragonDetail.tsx).
// ★1 stays at base. Each star from ★2 adds `pct`. ★7–10 add `pct + late`.
const STAT_STAR_PCT: Record<Rarity, number> = { rare: 0.1, epic: 0.15, legendary: 0.2, mythic: 0.25 };
const LATE_EXTRA_PCT: Record<Rarity, number> = { rare: 0.025, epic: 0, legendary: 0.05, mythic: 0 };
const LATE_STAR_THRESHOLD = 7;

/** How a seated dragon's stats become one number. Defense is the average of the three defense stats, so one defense job weighs the same as offense before the lane weights. */
export const SHEET_WEIGHTS = {
  flankOffense: 1.2,
  vanguardOffense: 1,
  flankDefense: 1,
  vanguardDefense: 1.5,
  turnOrder: 0.5,
} as const;

const LANES: Lane[] = ["left", "vanguard", "right"];
const ZERO = (): number[] => ROUNDS.map(() => 0);

export function starGrowth(rarity: Rarity, starRank: number): { bonusPct: number; regularStars: number; lateStars: number; rate: number; lateRate: number } {
  const rate = STAT_STAR_PCT[rarity];
  const lateRate = rate + LATE_EXTRA_PCT[rarity];
  const bonusStars = Math.max(0, starRank - 1);
  const lateStars = Math.max(0, starRank - (LATE_STAR_THRESHOLD - 1));
  const regularStars = bonusStars - lateStars;
  return { bonusPct: regularStars * rate + lateStars * lateRate, regularStars, lateStars, rate, lateRate };
}

function baseOf(d: Dragon, stat: StatName): number | undefined {
  if (stat === "strength") return d.baseStrength;
  if (stat === "instinct") return d.baseInstinct;
  if (stat === "intelligence") return d.baseIntelligence;
  return d.baseInitiative;
}

function sheetOf(base: number | undefined, growth: number): number | null {
  return base == null ? null : Math.round(base * (1 + growth));
}

/** A formation can field only one of these. Siege is not a formation troop. */
export const FORMATION_TROOPS = ["cavalry", "shieldbearers", "archers", "spearmen"] as const;
export type FormationTroop = (typeof FORMATION_TROOPS)[number];

/** + affinity for the formation's one troop. Applied to the grown sheet, before combat buffs. */
export const TROOP_AFFINITY_BONUS = 0.2;

const TROOP_LABEL: Record<FormationTroop, string> = {
  cavalry: "Cavalry",
  shieldbearers: "Shieldbearers",
  archers: "Archers",
  spearmen: "Spearmen",
};

export function troopLabel(troop: FormationTroop): string {
  return TROOP_LABEL[troop];
}

function affinityOf(d: Dragon, troop: TroopType): Affinity {
  return d.affinity?.[troop] ?? 0;
}

function grownSheet(d: Dragon, stat: StatName): number | null {
  return sheetOf(baseOf(d, stat), starGrowth(d.rarity, d.starRank).bonusPct);
}

/** Grown sheet, then ×1.2 when this dragon has + affinity for the formation troop. */
function combatSheet(d: Dragon, stat: StatName, troop: FormationTroop | null): number | null {
  const grown = grownSheet(d, stat);
  if (grown == null || troop == null || affinityOf(d, troop) !== "+") return grown;
  return grown * (1 + TROOP_AFFINITY_BONUS);
}

interface Seat {
  lane: Lane;
  dragon: Dragon | null;
}

function seatsOf(p: Placement): Seat[] {
  return LANES.map((lane) => ({ lane, dragon: p[lane] }));
}

function laneOf(p: Placement, d: Dragon): Lane {
  return LANES.find((l) => p[l] === d) ?? "vanguard";
}

function matchesPrefer(prefer: string, d: Dragon, lane: Lane): boolean | null {
  const [k, v] = prefer.split(":");
  if (k === "lane") return lane === v;
  if (k === "dealsDamage") return d.damageType === v;
  if (k === "breed") return d.breed === v;
  return null;
}

/** Expected share (0–1) of an ally-targeted clause. Empty lanes still count as seats. */
function allyShares(c: Clause, source: Dragon, p: Placement): Map<Dragon, number> {
  const t = c.target!;
  const out = new Map<Dragon, number>();
  if (t.side === "self") {
    out.set(source, 1);
    return out;
  }
  const srcLane = laneOf(p, source);
  const reach = t.scope === "adjacent" ? LANE_REACH[srcLane] : t.scope === "sameLane" ? [srcLane] : LANES;
  let pool = seatsOf(p).filter((s) => reach.includes(s.lane));
  const count = t.count ?? 3;
  const understood = t.prefer != null && pool.some((s) => s.dragon && matchesPrefer(t.prefer!, s.dragon, s.lane) != null);
  const isMatch = (s: Seat) => understood && s.dragon != null && matchesPrefer(t.prefer!, s.dragon, s.lane) === true;
  if (understood && t.filter) pool = pool.filter(isMatch);
  const matching = pool.filter(isMatch);
  const rest = pool.filter((s) => !isMatch(s));
  const give = (s: Seat, share: number) => {
    if (s.dragon) out.set(s.dragon, Math.min(1, (out.get(s.dragon) ?? 0) + share));
  };
  if (count >= pool.length) pool.forEach((s) => give(s, 1));
  else if (matching.length >= count) matching.forEach((s) => give(s, count / matching.length));
  else {
    matching.forEach((s) => give(s, 1));
    if (rest.length) rest.forEach((s) => give(s, (count - matching.length) / rest.length));
  }
  return out;
}

function enemyCoverage(c: Clause): number {
  const t = c.target!;
  return Math.min(1, (t.scope === "sameLane" ? 1 : (t.count ?? 3)) / 3);
}

function at(levels: (number | null)[] | undefined, level: number): number | null {
  if (!levels) return null;
  return levels[level - 1] ?? levels.find((x) => x != null) ?? null;
}

function durationLength(c: Clause): number {
  const d = c.duration ?? (c.timing.mode === "combat" ? "combat" : "round");
  return d === "combat" ? 10 : d === "round" ? 1 : d;
}

/** P(clause is up) each round. Troop-capacity conditions zero rounds out. Any other condition scales the whole vector by 50% and is named. */
function uptime(c: Clause, chance: number): { up: number[] | null; assumption: string | null } {
  const trig = triggerRounds(c.timing);
  if (!trig) return { up: null, assumption: "event-timed — no fixed round, left out" };
  const len = durationLength(c);
  const miss = ROUNDS.map(() => 1);
  for (const t of trig) for (let r = t; r < t + len && r <= 10; r++) miss[r - 1] *= 1 - chance;
  let up = miss.map((m) => 1 - m);
  let assumption: string | null = null;
  for (const cond of c.conditions) {
    if (cond.scope === "selfTroops" || cond.scope === "targetTroops") {
      const ok = new Set(troopConditionRounds(cond.value));
      up = up.map((p, i) => (ok.has(i + 1) ? p : 0));
    } else if (!assumption) {
      assumption = `condition “${cond.scope} ${cond.value}” assumed at 50%`;
    }
  }
  if (assumption) up = up.map((p) => p * 0.5);
  return { up, assumption };
}

const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

function skillName(slot: number): string {
  return slot === COMMAND_SLOT ? "Command" : slot === -1 ? "Vanguard" : `Habit ${slot}`;
}

function damageTypesOf(what: string[]): Array<Exclude<DamageType, "none"> | "all"> {
  const out: Array<Exclude<DamageType, "none"> | "all"> = [];
  for (const w of what) {
    const type = w.replace("(CH)", "");
    if (type === "all" || type === "physical" || type === "tactical" || type === "fire") out.push(type);
  }
  return out;
}

const isStat = (s: string): s is StatName => (STATS as readonly string[]).includes(s);

export interface ModifierRow {
  source: string;
  skill: string;
  effect: string;
  /** Who receives it, and whether that recipient is the caster. */
  landsOn: string;
  self: boolean;
  uptime: number;
  /** What the buff does to that dragon's numbers, in one line. */
  math: string;
  assumption?: string;
}

export interface StatColumn {
  stat: StatName;
  base: number | null;
  /** ★1 base × star growth, before troop affinity. */
  sheet: number | null;
  /** Sheet after +20% when this dragon matches the formation troop. Combat buffs apply to this. */
  afterAffinity: number | null;
  /** Round-average after this dragon's own buffs. */
  self: number | null;
  /** Round-average after every buff that lands, including teammates. */
  full: number | null;
}

export interface AxisLine {
  label: string;
  weight: number;
  sheetPoints: number | null;
  selfPoints: number | null;
  fullPoints: number | null;
  /** How the full-layer points were reached, using round averages. */
  math: string;
}

export interface DragonSheet {
  dragon: Dragon;
  lane: Lane;
  growthLabel: string;
  stats: StatColumn[];
  axes: AxisLine[];
  sheetScore: number;
  selfScore: number;
  fullScore: number;
  /** Unweighted (no lane weights) so it can be compared with the roster. */
  plainSheet: number | null;
  plainFull: number | null;
  gaps: string[];
  offenseNote: string;
  /** This dragon's affinity for the formation's chosen troop. */
  affinity: Affinity;
  /** + affinity, so all four stats are ×1.2 before buffs. */
  boosted: boolean;
}

export interface RoundScores {
  sheet: number;
  self: number;
  full: number;
}

export interface SheetRating {
  dragons: DragonSheet[];
  /** Lane-weighted formation totals. */
  sheetScore: number;
  selfScore: number;
  fullScore: number;
  /** Full minus own-buffs: what teammates add. */
  synergy: number;
  rounds: RoundScores[];
  modifiers: ModifierRow[];
  omitted: { label: string; count: number }[];
  /** fullScore / theoretical sheet ceiling for the occupied seats. Null when a stat has no ★1 base anywhere in the roster. */
  index: number | null;
  sheetIndex: number | null;
  ceiling: number | null;
  ceilingNote: string;
  /** T-score of the seated dragons' unbuffed plain scores vs the roster. */
  sheetT: number | null;
  /** T-score of the seated dragons' buffed plain scores vs the roster's unbuffed sheets. */
  buffedT: number | null;
  rosterMean: number | null;
  rosterSd: number | null;
  rosterN: number;
  seatedPlainSheet: number | null;
  seatedPlainFull: number | null;
  /** The one troop this rating fielded, and how the other three scored. */
  troop: TroopPick;
}

export interface TroopOptionScore {
  troop: FormationTroop;
  fullScore: number;
  sheetScore: number;
  /** Seated dragons with + affinity for this troop. */
  matches: number;
}

export interface TroopPick {
  troop: FormationTroop;
  bonus: number;
  seats: { name: string; affinity: Affinity; boosted: boolean }[];
  /** All four troops, highest formation score first. */
  options: TroopOptionScore[];
}

interface Acc {
  /** Percent added to each of our stats, split into self-cast and teammate-cast. Index = round-1. */
  selfPct: Record<StatName, number[]>;
  teamPct: Record<StatName, number[]>;
  selfFlat: Record<StatName, number[]>;
  teamFlat: Record<StatName, number[]>;
  /** Fraction added to offense (damage dealt / enemy takes more of our type). */
  selfOffense: number[];
  teamOffense: number[];
  /** Fraction of incoming damage removed, by type, before the defense stat is read. */
  selfIn: Record<Exclude<DamageType, "none">, number[]>;
  teamIn: Record<Exclude<DamageType, "none">, number[]>;
}

function blankAcc(): Acc {
  const z = (): Record<StatName, number[]> => ({ strength: ZERO(), instinct: ZERO(), intelligence: ZERO(), initiative: ZERO() });
  const inn = (): Record<Exclude<DamageType, "none">, number[]> => ({ physical: ZERO(), tactical: ZERO(), fire: ZERO() });
  return { selfPct: z(), teamPct: z(), selfFlat: z(), teamFlat: z(), selfOffense: ZERO(), teamOffense: ZERO(), selfIn: inn(), teamIn: inn() };
}

function addVec(into: number[], delta: number, up: number[]) {
  for (let i = 0; i < 10; i++) into[i] += delta * up[i];
}

function laneOffenseW(lane: Lane): number {
  return lane === "vanguard" ? SHEET_WEIGHTS.vanguardOffense : SHEET_WEIGHTS.flankOffense;
}
function laneDefenseW(lane: Lane): number {
  return lane === "vanguard" ? SHEET_WEIGHTS.vanguardDefense : SHEET_WEIGHTS.flankDefense;
}

interface Live {
  stats: Record<StatName, number | null>;
  offense: number | null;
  defense: Record<Exclude<DamageType, "none">, number | null>;
}

function liveStats(sheet: Record<StatName, number | null>, pct: Record<StatName, number>, flat: Record<StatName, number>): Record<StatName, number | null> {
  const out = {} as Record<StatName, number | null>;
  for (const s of STATS) {
    const base = sheet[s];
    out[s] = base == null ? null : base * (1 + pct[s]) + flat[s];
  }
  return out;
}

function snapshot(sheet: Record<StatName, number | null>, acc: Acc, round: number, layer: "sheet" | "self" | "full", damageType: DamageType): Live {
  const pct = {} as Record<StatName, number>;
  const flat = {} as Record<StatName, number>;
  for (const s of STATS) {
    const selfP = layer === "sheet" ? 0 : acc.selfPct[s][round];
    const teamP = layer === "full" ? acc.teamPct[s][round] : 0;
    const selfF = layer === "sheet" ? 0 : acc.selfFlat[s][round];
    const teamF = layer === "full" ? acc.teamFlat[s][round] : 0;
    pct[s] = selfP + teamP;
    flat[s] = selfF + teamF;
  }
  const stats = liveStats(sheet, pct, flat);
  const offPct = layer === "sheet" ? 0 : acc.selfOffense[round] + (layer === "full" ? acc.teamOffense[round] : 0);
  const offenseStat = damageType === "none" ? null : stats[OFFENSE_STAT[damageType]];
  const offense = offenseStat == null ? null : offenseStat * (1 + offPct);
  const defense = {} as Record<Exclude<DamageType, "none">, number | null>;
  (["physical", "tactical", "fire"] as const).forEach((type) => {
    const stat = stats[DEFENSE_STAT[type]];
    const cut = layer === "sheet" ? 0 : acc.selfIn[type][round] + (layer === "full" ? acc.teamIn[type][round] : 0);
    defense[type] = stat == null ? null : stat * (1 + cut);
  });
  return { stats, offense, defense };
}

function scoreOf(live: Live, lane: Lane, plain: boolean): { total: number; lines: { label: string; weight: number; points: number | null; math: string }[] } {
  const offW = plain ? 1 : laneOffenseW(lane);
  const defW = (plain ? 1 : laneDefenseW(lane)) / 3;
  const lines: { label: string; weight: number; points: number | null; math: string }[] = [];
  const offenseLabel = live.offense == null ? "Offense (no matching stat)" : "Offense";
  lines.push({
    label: offenseLabel,
    weight: offW,
    points: live.offense == null ? null : live.offense * offW,
    math: "",
  });
  (["physical", "tactical", "fire"] as const).forEach((type) => {
    const v = live.defense[type];
    const stat = DEFENSE_STAT[type];
    lines.push({
      label: `${type === "physical" ? "Physical" : type === "tactical" ? "Tactical" : "Fire"} defense (${STAT_LABEL[stat]})`,
      weight: defW,
      points: v == null ? null : v * defW,
      math: "",
    });
  });
  const ini = live.stats.initiative;
  lines.push({
    label: "Turn order (Initiative)",
    weight: SHEET_WEIGHTS.turnOrder,
    points: ini == null ? null : ini * SHEET_WEIGHTS.turnOrder,
    math: "",
  });
  const total = lines.reduce((s, l) => s + (l.points ?? 0), 0);
  return { total, lines };
}

function fmtNum(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Combat-sheet number, with the ×1.2 called out when troop affinity applies. */
function sheetPhrase(d: Dragon, stat: StatName, troop: FormationTroop | null): { value: number | null; phrase: string } {
  const grown = grownSheet(d, stat);
  const used = combatSheet(d, stat, troop);
  if (used == null || grown == null) return { value: null, phrase: "" };
  if (troop != null && affinityOf(d, troop) === "+") {
    return { value: used, phrase: `${fmtNum(used)} (grown ${fmtNum(grown)} × 1.2 ${troopLabel(troop)} affinity)` };
  }
  return { value: used, phrase: fmtNum(used) };
}

function theoreticalCeiling(population: Dragon[], lanes: Lane[]): { ceiling: number | null; note: string } {
  const maxBase: Partial<Record<StatName, number>> = {};
  for (const d of population) {
    for (const s of STATS) {
      const b = baseOf(d, s);
      if (b != null) maxBase[s] = Math.max(maxBase[s] ?? 0, b);
    }
  }
  const missing = STATS.filter((s) => maxBase[s] == null);
  const growth = starGrowth("legendary", 10);
  const mult = 1 + growth.bonusPct;
  if (missing.length) {
    return {
      ceiling: null,
      note: `No ceiling yet. The roster has no ★1 base for ${missing.map((s) => STAT_LABEL[s]).join(", ")}, so there is no theoretical highest ${missing.length === 1 ? "stat" : "set"}.`,
    };
  }
  const affinity = 1 + TROOP_AFFINITY_BONUS;
  const sheet = Object.fromEntries(STATS.map((s) => [s, Math.round((maxBase[s] ?? 0) * mult) * affinity])) as Record<StatName, number>;
  const maxOffense = Math.max(sheet.strength, sheet.instinct, sheet.intelligence);
  const defense = (sheet.instinct + sheet.intelligence + sheet.initiative) / 3;
  let ceiling = 0;
  for (const lane of lanes) {
    ceiling += laneOffenseW(lane) * maxOffense + laneDefenseW(lane) * defense + SHEET_WEIGHTS.turnOrder * sheet.initiative;
  }
  const which = (["strength", "instinct", "intelligence"] as const).find((s) => sheet[s] === maxOffense) ?? "strength";
  return {
    ceiling,
    note: `Ceiling is ${lanes.length} seat${lanes.length === 1 ? "" : "s"} filled by a theoretical legendary at ★10 (×${mult.toFixed(2)} on the highest ★1 base in the roster, then ×${affinity.toFixed(2)} because that dragon is assumed to have + affinity for the formation's troop). Offense uses ${STAT_LABEL[which]} ${fmtNum(sheet[which])}, the highest of the three offense sheets. Defense averages Instinct ${fmtNum(sheet.instinct)}, Intelligence ${fmtNum(sheet.intelligence)}, Initiative ${fmtNum(sheet.initiative)}. No combat buffs are in the ceiling, so a buffed formation can pass 100.`,
  };
}

function populationStats(values: number[]): { mean: number; sd: number } | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return { mean, sd: Math.sqrt(variance) };
}

/**
 * Sheet-stat rating for the dragons actually seated. Partial formations are
 * scored on the seats that are filled, and indexed against a ceiling of those
 * same seats.
 */
export interface SheetRatingOptions {
  /**
   * Skip the per-buff writeup and the per-axis breakdown. The sheet, own-buff,
   * and formation scores stay the same numbers the dev card shows.
   */
  scoresOnly?: boolean;
  /** Field this troop. When omitted, all four troops are scored and the best is kept. */
  troopType?: FormationTroop;
  /** Troop comparison from the pick pass, so the detail pass does not score them again. */
  comparison?: TroopOptionScore[];
}

export function rateSheetFormation(
  p: Placement,
  ctx: { skills: SkillsByDragon; loadout: LoadoutFor },
  population: Dragon[],
  options?: SheetRatingOptions,
): SheetRating {
  // Pick the troop before writing the buff math, so those lines use the ×1.2 sheet.
  // The search calls with scoresOnly and does this pick inside one buff walk.
  if (!options?.troopType && !options?.scoresOnly) {
    const preview = rateSheetFormation(p, ctx, population, { scoresOnly: true });
    return rateSheetFormation(p, ctx, population, {
      troopType: preview.troop.troop,
      comparison: preview.troop.options,
    });
  }
  const lockedTroop = options?.troopType ?? null;
  const detail = !options?.scoresOnly;
  const seated = seatsOf(p).filter((s): s is { lane: Lane; dragon: Dragon } => s.dragon != null);
  const modifiers: ModifierRow[] = [];
  const omitted = new Map<string, number>();
  const bumpOmit = (label: string) => { if (detail) omitted.set(label, (omitted.get(label) ?? 0) + 1); };
  const acc = new Map<Dragon, Acc>();
  for (const s of seated) acc.set(s.dragon, blankAcc());

  const applyStat = (recipient: Dragon, source: Dragon, stat: StatName, pct: number, flat: number, up: number[]) => {
    const bag = acc.get(recipient);
    if (!bag) return;
    const self = recipient === source;
    if (pct) addVec(self ? bag.selfPct[stat] : bag.teamPct[stat], pct, up);
    if (flat) addVec(self ? bag.selfFlat[stat] : bag.teamFlat[stat], flat, up);
  };
  const applyOffense = (recipient: Dragon, source: Dragon, pct: number, up: number[]) => {
    const bag = acc.get(recipient);
    if (!bag || !pct) return;
    addVec(recipient === source ? bag.selfOffense : bag.teamOffense, pct, up);
  };
  const applyIncoming = (recipient: Dragon, source: Dragon, type: Exclude<DamageType, "none"> | "all", pct: number, up: number[]) => {
    const bag = acc.get(recipient);
    if (!bag || !pct) return;
    const types = type === "all" ? (["physical", "tactical", "fire"] as const) : [type];
    for (const t of types) addVec(recipient === source ? bag.selfIn[t] : bag.teamIn[t], pct, up);
  };

  const ALWAYS = ROUNDS.map(() => 1);

  for (const { dragon: source, lane } of seated) {
    const levels = ctx.loadout(source);
    for (const skill of ctx.skills[source.name] ?? []) {
      const level = skill.habitSlot === COMMAND_SLOT ? 5 : levels[skill.habitSlot - 1];
      if (level == null) continue;
      for (const clause of skill.clauses) {
        if (clause.skip) {
          bumpOmit(`${clause.skip} (skipped)`);
          continue;
        }
        if (!clause.target) {
          bumpOmit("no target");
          continue;
        }
        const raw = (at(clause.valueByLevel, level) ?? 0) * (clause.stack ? clause.stack.max * 0.5 : 1);
        const { up, assumption } = uptime(clause, (at(clause.chanceByLevel, level) ?? 100) / 100);
        if (!up) {
          bumpOmit(assumption ?? "no timing");
          continue;
        }
        const stackNote = clause.stack ? ` (already includes half of ${clause.stack.max} stacks)` : "";
        const commandNote = clause.what.some((w) => w.endsWith("(CH)")) ? " Text limits this to Command/Habit damage; counted in full here." : "";
        const push = (landsOn: string, self: boolean, effect: string, math: string) => {
          if (!detail) return;
          modifiers.push({
            source: source.name,
            skill: skillName(skill.habitSlot),
            effect,
            landsOn,
            self,
            uptime: mean(up),
            math: math + stackNote,
            assumption: assumption ?? undefined,
          });
        };

        if (clause.kind === "stat") {
          const stats = clause.what.filter(isStat);
          if (!stats.length || !raw) {
            bumpOmit("stat clause with no value");
            continue;
          }
          const pct = raw / 100;
          if (clause.target.side === "enemy") {
            const cover = enemyCoverage(clause);
            for (const stat of stats) {
              const incoming = ENEMY_STAT_INCOMING[stat];
              if (!incoming) {
                push(source.name, true, `enemy ${STAT_LABEL[stat]} ${raw > 0 ? "+" : ""}${fmtNum(raw)}%`, "Initiative is turn order, not a damage stat, so this does not change incoming damage");
                continue;
              }
              for (const seat of seated) {
                applyIncoming(seat.dragon, source, incoming, -pct * cover, up);
                push(
                  seat.dragon.name,
                  seat.dragon === source,
                  `enemy ${STAT_LABEL[stat]} ${raw > 0 ? "+" : ""}${fmtNum(raw)}%`,
                  `${fmtNum(-pct * 100)}% × ${fmtNum(cover * 100)}% of enemies → ${fmtNum(-pct * cover * 100)}% ${incoming} incoming on ${seat.dragon.name}`,
                );
              }
            }
          } else {
            for (const [recipient, share] of allyShares(clause, source, p)) {
              for (const stat of stats) {
                applyStat(recipient, source, stat, pct * share, 0, up);
                if (detail) {
                  const { value, phrase } = sheetPhrase(recipient, stat, lockedTroop);
                  const delta = value == null ? null : value * pct * share;
                  push(
                    recipient.name,
                    recipient === source,
                    `${STAT_LABEL[stat]} ${raw > 0 ? "+" : ""}${fmtNum(raw)}%`,
                    value == null
                      ? `${fmtNum(pct * share * 100)}% of ${recipient.name}'s ${STAT_LABEL[stat]}, but that base is not entered`
                      : `${fmtNum(pct * 100)}% × ${fmtNum(share * 100)}% share × sheet ${phrase} = ${delta! >= 0 ? "+" : ""}${fmtNum(delta!)} ${STAT_LABEL[stat]}`,
                  );
                }
              }
            }
          }
          continue;
        }

        if (clause.kind === "dmgDealt" || clause.kind === "dmgRecv") {
          const types = damageTypesOf(clause.what);
          if (!types.length || !raw) {
            bumpOmit(`${clause.kind} with no type`);
            continue;
          }
          const pct = raw / 100;
          const typeLabel = types.join("/");
          if (clause.kind === "dmgDealt" && clause.target.side !== "enemy") {
            for (const [recipient, share] of allyShares(clause, source, p)) {
              const matches = recipient.damageType !== "none" && types.some((t) => t === "all" || t === recipient.damageType);
              if (!matches) {
                push(recipient.name, recipient === source, `${typeLabel} Damage Dealt ${raw > 0 ? "+" : ""}${fmtNum(raw)}%`, `${recipient.name} deals ${recipient.damageType} — this does not raise an offense stat`);
                continue;
              }
              applyOffense(recipient, source, pct * share, up);
              if (detail) {
                const stat = OFFENSE_STAT[recipient.damageType as Exclude<DamageType, "none">];
                const { value, phrase } = sheetPhrase(recipient, stat, lockedTroop);
                push(
                  recipient.name,
                  recipient === source,
                  `${typeLabel} Damage Dealt ${raw > 0 ? "+" : ""}${fmtNum(raw)}%`,
                  value == null
                    ? `multiplies ${recipient.name}'s ${STAT_LABEL[stat]} offense, but that base is not entered`
                    : `× ${fmtNum(share)} share on ${STAT_LABEL[stat]} sheet ${phrase} → ${deltaLabel(value * pct * share)} offense${commandNote}`,
                );
              }
            }
          } else if (clause.kind === "dmgDealt" && clause.target.side === "enemy") {
            const cover = enemyCoverage(clause);
            for (const seat of seated) {
              for (const t of types) {
                if (t === "all") applyIncoming(seat.dragon, source, "all", -pct * cover, up);
                else applyIncoming(seat.dragon, source, t, -pct * cover, up);
              }
              push(
                seat.dragon.name,
                seat.dragon === source,
                `enemy ${typeLabel} Damage Dealt ${raw > 0 ? "+" : ""}${fmtNum(raw)}%`,
                `${fmtNum(-pct * cover * 100)}% incoming (${fmtNum(cover * 100)}% of enemies) on the matching defense stat`,
              );
            }
          } else if (clause.kind === "dmgRecv" && clause.target.side === "enemy") {
            const cover = enemyCoverage(clause);
            for (const seat of seated) {
              const matches = seat.dragon.damageType !== "none" && types.some((t) => t === "all" || t === seat.dragon.damageType);
              if (!matches) {
                push(seat.dragon.name, seat.dragon === source, `enemy ${typeLabel} Damage Received ${raw > 0 ? "+" : ""}${fmtNum(raw)}%`, `${seat.dragon.name} deals ${seat.dragon.damageType} — does not multiply their offense`);
                continue;
              }
              applyOffense(seat.dragon, source, pct * cover, up);
              push(
                seat.dragon.name,
                seat.dragon === source,
                `enemy ${typeLabel} Damage Received ${raw > 0 ? "+" : ""}${fmtNum(raw)}%`,
                `${fmtNum(pct * cover * 100)}% more ${seat.dragon.damageType} offense (${fmtNum(cover * 100)}% of enemies)`,
              );
            }
          } else if (clause.kind === "dmgRecv") {
            for (const [recipient, share] of allyShares(clause, source, p)) {
              // Negative Damage Received means they take less. That scales the defense stat for each named type.
              for (const t of types) applyIncoming(recipient, source, t, -pct * share, up);
              const which = types.includes("all") ? "all three defense stats" : types.map((t) => `${t} defense`).join(", ");
              push(
                recipient.name,
                recipient === source,
                `${typeLabel} Damage Received ${raw > 0 ? "+" : ""}${fmtNum(raw)}%`,
                `${fmtNum(-pct * share * 100)}% incoming on ${which}`,
              );
            }
          }
          continue;
        }

        bumpOmit(clause.kind);
      }
    }

    if (lane === "vanguard") {
      const skill = kitFor(source.name)?.vanguard;
      if (skill) {
        const recipients = (effects: typeof skill.self, who: Dragon | null) => {
          if (!who) return;
          for (const e of effects) {
            if (e.kind === "stat" && e.flat && e.stats) {
              for (const stat of e.stats) {
                if (!isStat(stat)) continue;
                applyStat(who, source, stat, 0, e.flat, ALWAYS);
                if (detail) {
                  const { value, phrase } = sheetPhrase(who, stat, lockedTroop);
                  modifiers.push({
                    source: source.name,
                    skill: "Vanguard",
                    effect: `${STAT_LABEL[stat]} +${e.flat} raw`,
                    landsOn: who.name,
                    self: who === source,
                    uptime: 1,
                    math: value == null
                      ? `+${e.flat} ${STAT_LABEL[stat]}, but ${who.name}'s base is not entered`
                      : `+${e.flat} on sheet ${phrase} = ${fmtNum((e.flat / value) * 100)}% of ${who.name}'s ${STAT_LABEL[stat]}`,
                  });
                }
              }
            } else if ((e.kind === "damage" || e.kind === "damageAny") && e.pct) {
              const matches = e.kind === "damageAny" || (who.damageType !== "none" && who.damageType === e.type);
              if (!matches) {
                if (detail) modifiers.push({
                  source: source.name,
                  skill: "Vanguard",
                  effect: `${e.type ?? "damage"} +${fmtNum(e.pct * 100)}%`,
                  landsOn: who.name,
                  self: who === source,
                  uptime: 1,
                  math: `${who.name} deals ${who.damageType} — this does not raise an offense stat`,
                });
              } else {
                applyOffense(who, source, e.pct, ALWAYS);
                if (detail) modifiers.push({
                  source: source.name,
                  skill: "Vanguard",
                  effect: `${e.kind === "damageAny" ? "all damage" : e.type} +${fmtNum(e.pct * 100)}%`,
                  landsOn: who.name,
                  self: who === source,
                  uptime: 1,
                  math: `multiplies ${who.name}'s offense stat by ${fmtNum(e.pct * 100)}%`,
                });
              }
            } else if (e.kind === "mitigation" && e.pct) {
              applyIncoming(who, source, "all", e.pct, ALWAYS);
              if (detail) modifiers.push({
                source: source.name,
                skill: "Vanguard",
                effect: `Damage Received −${fmtNum(e.pct * 100)}%`,
                landsOn: who.name,
                self: who === source,
                uptime: 1,
                math: `${fmtNum(e.pct * 100)}% less incoming on all three defense stats`,
              });
            } else {
              bumpOmit(`vanguard ${e.kind}`);
            }
          }
        };
        recipients(skill.self, source);
        const flank = skill.flankPos === "left" ? p.left : p.right;
        recipients(skill.flank, flank);
      }
    }
  }

  const emptyScore = {
    modifiers: [] as ModifierRow[],
    omitted: [] as { label: string; count: number }[],
    index: null,
    sheetIndex: null,
    ceiling: null,
    ceilingNote: "",
    sheetT: null,
    buffedT: null,
    rosterMean: null,
    rosterSd: null,
    rosterN: 0,
    seatedPlainSheet: null,
    seatedPlainFull: null,
  };

  const seatsFor = (troop: FormationTroop) => seated.map((s) => {
    const affinity = affinityOf(s.dragon, troop);
    return { name: s.dragon.name, affinity, boosted: affinity === "+" };
  });

  const evaluate = (troop: FormationTroop, emit: boolean) => {
  const dragons: DragonSheet[] = [];
  const rounds: RoundScores[] = ROUNDS.map(() => ({ sheet: 0, self: 0, full: 0 }));

  for (const { dragon, lane } of seated) {
    const growth = starGrowth(dragon.rarity, dragon.starRank);
    const grown = {} as Record<StatName, number | null>;
    const sheet = {} as Record<StatName, number | null>;
    for (const s of STATS) {
      grown[s] = grownSheet(dragon, s);
      sheet[s] = combatSheet(dragon, s, troop);
    }
    const bag = acc.get(dragon)!;
    const sums = {
      sheet: ZERO(),
      self: ZERO(),
      full: ZERO(),
      plainSheet: ZERO(),
      plainFull: ZERO(),
    };
    const statSum = Object.fromEntries(STATS.map((s) => [s, { self: 0, full: 0, n: 0 }])) as Record<StatName, { self: number; full: number; n: number }>;
    for (let r = 0; r < 10; r++) {
      const layers = {
        sheet: snapshot(sheet, bag, r, "sheet", dragon.damageType),
        self: snapshot(sheet, bag, r, "self", dragon.damageType),
        full: snapshot(sheet, bag, r, "full", dragon.damageType),
      };
      sums.sheet[r] = scoreOf(layers.sheet, lane, false).total;
      sums.self[r] = scoreOf(layers.self, lane, false).total;
      sums.full[r] = scoreOf(layers.full, lane, false).total;
      if (emit) {
        sums.plainSheet[r] = scoreOf(layers.sheet, lane, true).total;
        sums.plainFull[r] = scoreOf(layers.full, lane, true).total;
      }
      rounds[r].sheet += sums.sheet[r];
      rounds[r].self += sums.self[r];
      rounds[r].full += sums.full[r];
      if (emit) {
        for (const s of STATS) {
          if (layers.self.stats[s] != null) {
            statSum[s].self += layers.self.stats[s]!;
            statSum[s].full += layers.full.stats[s]!;
            statSum[s].n++;
          }
        }
      }
    }
    const affinity = affinityOf(dragon, troop);
    if (!emit) {
      dragons.push({
        dragon,
        lane,
        growthLabel: "",
        stats: [],
        axes: [],
        sheetScore: mean(sums.sheet),
        selfScore: mean(sums.self),
        fullScore: mean(sums.full),
        plainSheet: null,
        plainFull: null,
        gaps: [],
        offenseNote: "",
        affinity,
        boosted: affinity === "+",
      });
      continue;
    }
    // Axis lines use the 10-round average. `raw` is the formation stat before
    // damage-dealt / incoming multipliers, so the math line can show both steps.
    const axisFrom = (label: string, weight: number, pick: (live: Live) => number | null, raw: number | null, missing: string): AxisLine => {
      let sheetP = 0;
      let selfP = 0;
      let fullP = 0;
      let seen = 0;
      for (let r = 0; r < 10; r++) {
        const a = pick(snapshot(sheet, bag, r, "sheet", dragon.damageType));
        const b = pick(snapshot(sheet, bag, r, "self", dragon.damageType));
        const c = pick(snapshot(sheet, bag, r, "full", dragon.damageType));
        if (a == null && b == null && c == null) continue;
        seen++;
        sheetP += (a ?? 0) * weight;
        selfP += (b ?? 0) * weight;
        fullP += (c ?? 0) * weight;
      }
      const fullPoints = seen ? fullP / 10 : null;
      const effective = fullPoints == null || weight === 0 ? null : fullPoints / weight;
      let math = missing;
      if (effective != null && fullPoints != null) {
        const stepped = raw != null && Math.abs(effective - raw) > 0.05
          ? `${fmtNum(raw)} on the stat, ${fmtNum(effective)} after damage dealt / incoming → `
          : `${fmtNum(effective)} `;
        const wLabel = Number.isInteger(weight) ? String(weight) : weight.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
        math = `${stepped}× ${wLabel} = ${fmtNum(fullPoints)}`;
      }
      return {
        label,
        weight,
        sheetPoints: seen ? sheetP / 10 : null,
        selfPoints: seen ? selfP / 10 : null,
        fullPoints,
        math,
      };
    };

    const offW = laneOffenseW(lane);
    const defW = laneDefenseW(lane) / 3;
    const offenseName = dragon.damageType === "none" ? null : OFFENSE_STAT[dragon.damageType];
    const rawFull = (s: StatName) => (statSum[s].n ? statSum[s].full / 10 : null);
    const axes: AxisLine[] = [
      axisFrom(
        offenseName ? `Offense · ${STAT_LABEL[offenseName]} (${dragon.damageType})` : "Offense · no damage type",
        offW,
        (live) => live.offense,
        offenseName ? rawFull(offenseName) : null,
        offenseName == null ? "This dragon has no damage type, so no offense stat counts." : `${STAT_LABEL[offenseName]} base is not entered.`,
      ),
    ];
    (["physical", "tactical", "fire"] as const).forEach((type) => {
      const stat = DEFENSE_STAT[type];
      const title = type === "physical" ? "Physical" : type === "tactical" ? "Tactical" : "Fire";
      axes.push(axisFrom(
        `${title} defense · ${STAT_LABEL[stat]}`,
        defW,
        (live) => live.defense[type],
        rawFull(stat),
        `${STAT_LABEL[stat]} base is not entered.`,
      ));
    });
    axes.push(axisFrom(
      "Turn order · Initiative",
      SHEET_WEIGHTS.turnOrder,
      (live) => live.stats.initiative,
      rawFull("initiative"),
      "Initiative base is not entered.",
    ));

    const gaps: string[] = [];
    for (const s of STATS) if (sheet[s] == null) gaps.push(`${STAT_LABEL[s]} base is not entered — that axis is left out`);
    const offenseNote = dragon.damageType === "none"
      ? "No damage type, so Strength, Instinct, and Intelligence do not raise offense."
      : `${STAT_LABEL[OFFENSE_STAT[dragon.damageType]]} is the only offense stat, because ${dragon.name} deals ${dragon.damageType}.`;

    const growthLabel = `★${dragon.starRank} ${dragon.rarity}: ${growth.regularStars} × ${(growth.rate * 100).toFixed(0)}%${growth.lateStars ? ` + ${growth.lateStars} × ${(growth.lateRate * 100).toFixed(1)}%` : ""} = ×${(1 + growth.bonusPct).toFixed(3)}`;

    dragons.push({
      dragon,
      lane,
      growthLabel,
      stats: STATS.map((s) => ({
        stat: s,
        base: baseOf(dragon, s) ?? null,
        sheet: grown[s],
        afterAffinity: sheet[s],
        self: statSum[s].n ? statSum[s].self / 10 : null,
        full: statSum[s].n ? statSum[s].full / 10 : null,
      })),
      axes,
      sheetScore: mean(sums.sheet),
      selfScore: mean(sums.self),
      fullScore: mean(sums.full),
      plainSheet: sheetHasAny(sheet) ? mean(sums.plainSheet) : null,
      plainFull: sheetHasAny(sheet) ? mean(sums.plainFull) : null,
      gaps,
      offenseNote,
      affinity,
      boosted: affinity === "+",
    });
  }

  const sheetScore = dragons.reduce((s, d) => s + d.sheetScore, 0);
  const selfScore = dragons.reduce((s, d) => s + d.selfScore, 0);
  const fullScore = dragons.reduce((s, d) => s + d.fullScore, 0);
  return { dragons, rounds, sheetScore, selfScore, fullScore };
  };

  if (!lockedTroop) {
    const scored = FORMATION_TROOPS.map((troop) => {
      const ev = evaluate(troop, false);
      const matches = seated.filter((s) => affinityOf(s.dragon, troop) === "+").length;
      return { troop, matches, ...ev };
    });
    scored.sort((a, b) => b.fullScore - a.fullScore || b.sheetScore - a.sheetScore || b.matches - a.matches || a.troop.localeCompare(b.troop));
    const best = scored[0];
    return {
      dragons: best.dragons,
      sheetScore: best.sheetScore,
      selfScore: best.selfScore,
      fullScore: best.fullScore,
      synergy: best.fullScore - best.selfScore,
      rounds: best.rounds,
      ...emptyScore,
      troop: {
        troop: best.troop,
        bonus: TROOP_AFFINITY_BONUS,
        seats: seatsFor(best.troop),
        options: scored.map(({ troop, fullScore, sheetScore, matches }) => ({ troop, fullScore, sheetScore, matches })),
      },
    };
  }

  const ev = evaluate(lockedTroop, detail);
  const matches = seated.filter((s) => affinityOf(s.dragon, lockedTroop) === "+").length;
  const troop: TroopPick = {
    troop: lockedTroop,
    bonus: TROOP_AFFINITY_BONUS,
    seats: seatsFor(lockedTroop),
    options: options?.comparison ?? [{ troop: lockedTroop, fullScore: ev.fullScore, sheetScore: ev.sheetScore, matches }],
  };
  if (!detail) {
    return {
      dragons: ev.dragons,
      sheetScore: ev.sheetScore,
      selfScore: ev.selfScore,
      fullScore: ev.fullScore,
      synergy: ev.fullScore - ev.selfScore,
      rounds: ev.rounds,
      ...emptyScore,
      troop,
    };
  }
  const { ceiling, note } = theoreticalCeiling(population, seated.map((s) => s.lane));

  const rosterPlain = population.map(plainSheetScore).filter((n): n is number => n != null);
  const pop = populationStats(rosterPlain);
  const seatedSheet = ev.dragons.map((d) => d.plainSheet).filter((n): n is number => n != null);
  const seatedFull = ev.dragons.map((d) => d.plainFull).filter((n): n is number => n != null);
  const seatedPlainSheet = seatedSheet.length ? seatedSheet.reduce((a, b) => a + b, 0) / seatedSheet.length : null;
  const seatedPlainFull = seatedFull.length ? seatedFull.reduce((a, b) => a + b, 0) / seatedFull.length : null;
  const t = (x: number | null) => (pop && x != null && pop.sd > 0 ? 50 + (10 * (x - pop.mean)) / pop.sd : null);

  return {
    dragons: ev.dragons,
    sheetScore: ev.sheetScore,
    selfScore: ev.selfScore,
    fullScore: ev.fullScore,
    synergy: ev.fullScore - ev.selfScore,
    rounds: ev.rounds,
    modifiers,
    omitted: [...omitted.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    index: ceiling ? ev.fullScore / ceiling : null,
    sheetIndex: ceiling ? ev.sheetScore / ceiling : null,
    ceiling,
    ceilingNote: note,
    sheetT: t(seatedPlainSheet),
    buffedT: t(seatedPlainFull),
    rosterMean: pop?.mean ?? null,
    rosterSd: pop?.sd ?? null,
    rosterN: rosterPlain.length,
    seatedPlainSheet,
    seatedPlainFull,
    troop,
  };
}

function sheetHasAny(sheet: Record<StatName, number | null>): boolean {
  return STATS.some((s) => sheet[s] != null);
}

function deltaLabel(n: number): string {
  return `${n >= 0 ? "+" : ""}${fmtNum(n)}`;
}

export interface SheetLineupHit {
  left: Dragon;
  vanguard: Dragon;
  right: Dragon;
  /** Lane-weighted formation score, buffs included. What the lineup ranks on. */
  full: number;
  sheet: number;
}

export interface SheetLineupSearch {
  /** Recommended vanguards that were actually seated in the middle. */
  vanguardCount: number;
  /** Other active dragons available for the two flanks. */
  flankCount: number;
  /** Formations scored: vanguards × flank pairs, both left/right orders. */
  searched: number;
  /** Troops tried for each formation. The kept score is the best of these. */
  troopsTried: number;
  /**
   * Best formation, then the best that shares no dragon with it, then the best
   * that shares no dragon with either. Fewer than 3 when the roster runs out
   * of recommended vanguards or of dragons.
   */
  hits: SheetLineupHit[];
  /** Full writeup for each hit, same function the formation dev card uses. */
  ratings: SheetRating[];
}

/**
 * Every left/right pairing around each recommended vanguard, ranked by the
 * sheet-stat formation score. Each seating is tried under all four troops and
 * keeps the troop with the highest score. The hits are disjoint: each later
 * formation leaves out every dragon used by the ones above it.
 */
export function searchDisjointSheetFormations(
  pool: Dragon[],
  isRecommendedVanguard: (d: Dragon) => boolean,
  ctx: { skills: SkillsByDragon; loadout: LoadoutFor },
  take = 3,
): SheetLineupSearch {
  const vanguards = pool.filter(isRecommendedVanguard);
  const hits: SheetLineupHit[] = [];
  let searched = 0;
  const scoreOpts: SheetRatingOptions = { scoresOnly: true };
  for (const vanguard of vanguards) {
    const flanks = pool.filter((d) => d.id !== vanguard.id);
    for (let i = 0; i < flanks.length; i++) {
      for (let j = 0; j < flanks.length; j++) {
        if (i === j) continue;
        const left = flanks[i];
        const right = flanks[j];
        const rating = rateSheetFormation({ left, vanguard, right }, ctx, pool, scoreOpts);
        hits.push({ left, vanguard, right, full: rating.fullScore, sheet: rating.sheetScore });
        searched++;
      }
    }
  }
  hits.sort((a, b) => b.full - a.full || b.sheet - a.sheet || a.vanguard.name.localeCompare(b.vanguard.name) || a.left.name.localeCompare(b.left.name) || a.right.name.localeCompare(b.right.name));
  const used = new Set<string>();
  const picked: SheetLineupHit[] = [];
  for (const hit of hits) {
    const ids = [hit.left.id, hit.vanguard.id, hit.right.id];
    if (ids.some((id) => used.has(id))) continue;
    picked.push(hit);
    for (const id of ids) used.add(id);
    if (picked.length === take) break;
  }
  const flankCount = Math.max(0, pool.length - 1);
  const ratings = picked.map((h) => rateSheetFormation({ left: h.left, vanguard: h.vanguard, right: h.right }, ctx, pool));
  return { vanguardCount: vanguards.length, flankCount, searched, troopsTried: FORMATION_TROOPS.length, hits: picked, ratings };
}

/** One dragon's unbuffed score with no lane weights, for the roster T-score. */
function plainSheetScore(d: Dragon): number | null {
  const growth = starGrowth(d.rarity, d.starRank).bonusPct;
  const sheet = {} as Record<StatName, number | null>;
  for (const s of STATS) sheet[s] = sheetOf(baseOf(d, s), growth);
  if (!sheetHasAny(sheet)) return null;
  const empty = blankAcc();
  return scoreOf(snapshot(sheet, empty, 0, "sheet", d.damageType), "left", true).total;
}
