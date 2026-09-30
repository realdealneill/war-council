// Formation-level evaluation for the "Build a Formation" flow: structural
// bonuses from scoring.ts (troop affinity, the Vanguard skill, role-position
// fit, role balance) + habit synergy from the real Command/Habit clauses
// (habitSynergy.ts), on top of the dragons' base power.
//
//   score     = basePower × (1 + bonusPct)              — the modeled effective power
//   rankScore = basePower × (1 + emphasis × bonusPct)   — what recommendations sort by
//
// `emphasis` is the one knob for "how much should synergy count against raw
// power": 0 ranks purely by power, 1 takes the model at face value, higher
// lets a well-linked trio outrank bigger numbers.
import { NON_SIEGE_TROOP_OPTIONS } from "./constants";
import { habitSynergy, type HabitLink, type HabitSynergyContext } from "./habitSynergy";
import { bestArmy } from "./scoring";
import type { ArmyEvaluation, Dragon, Goal, Placement, Slot, TroopType } from "../types";

export interface FormationContext {
  habits: HabitSynergyContext;
  emphasis: number;
  goal?: Goal;
  /** Field only this troop instead of picking the best (the squad draft's troop lock). */
  troop?: TroopType;
}

export interface FormationEvaluation extends ArmyEvaluation {
  /** Habit synergy share of bonusPct. */
  habitPct: number;
  /** Structural (troop / Vanguard skill / position) share of bonusPct. */
  structuralPct: number;
  /** The habit-synergy links behind habitPct. */
  habitLinks: HabitLink[];
}

export function evaluateFormation(p: Partial<Placement>, ctx: FormationContext): FormationEvaluation {
  const locks: Partial<Record<Slot, Dragon>> = {};
  (["left", "vanguard", "right"] as Slot[]).forEach((s) => p[s] && (locks[s] = p[s]!));
  const dragons = Object.values(locks);
  const structural = bestArmy(dragons, ctx.troop ? [ctx.troop] : NON_SIEGE_TROOP_OPTIONS,{ goal: ctx.goal ?? "balanced", kitTags: false }, locks);
  const habit = habitSynergy(structural.placement, { ...ctx.habits, goal: ctx.goal });
  const bonusPct = structural.bonusPct + habit.pct;
  return {
    ...structural,
    score: structural.basePower * (1 + bonusPct),
    rankScore: structural.basePower * (1 + ctx.emphasis * bonusPct),
    bonusPct,
    habitPct: habit.pct,
    structuralPct: structural.bonusPct,
    habitLinks: habit.links,
    synergies: [...structural.synergies, ...habit.entries.map((e) => ({ text: `Habits — ${e.text}`, pct: e.pct }))],
  };
}

/** The same evaluation ranked at another emphasis — rankScore is its only emphasis-dependent field, so moving the slider never needs a re-simulation. */
export function withEmphasis<T extends FormationEvaluation>(e: T, emphasis: number): T {
  return { ...e, rankScore: e.basePower * (1 + emphasis * e.bonusPct) };
}

export interface PairRecommendation {
  left: Dragon;
  right: Dragon;
  eval: FormationEvaluation;
}

/** Best `limit` (left, right) flank pairs for `vanguard` from `pool`, by rankScore (ties: more synergy first). */
export function recommendFlankPairs(vanguard: Dragon, pool: Dragon[], ctx: FormationContext, limit = 5): PairRecommendation[] {
  const out: PairRecommendation[] = [];
  for (const left of pool) {
    for (const right of pool) {
      if (left === right) continue;
      out.push({ left, right, eval: evaluateFormation({ left, vanguard, right }, ctx) });
    }
  }
  return out.sort((a, b) => b.eval.rankScore - a.eval.rankScore || b.eval.bonusPct - a.eval.bonusPct).slice(0, limit);
}
