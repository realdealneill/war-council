// Engine output → the design system's display shapes (./types). The engine
// works on src/types Dragons; these components want power pre-computed, art
// attached, and habit links keyed by dragon name.
import { getDragonArt } from "../assets/dragons";
import { HABIT_TEXT, kitFor } from "../data";
import type { FormationEvaluation as EngineEval, PairRecommendation as EnginePair } from "../engine/formation";
import { COMMAND_SLOT, describeClause, type Clause } from "../engine/habitClauses";
import type { SkillsByDragon } from "../engine/habitSynergy";
import { dragonPower } from "../engine/power";
import type { SheetLineupSearch } from "../engine/sheetRating";
import type { FlankCandidate as EngineCandidate } from "../engine/vanguardFit";
import type { Dragon as EngineDragon, SynergyCategory } from "../types";
import type * as UI from "./types";

const uiCache = new WeakMap<EngineDragon, UI.Dragon>();

/** Stable per engine Dragon object, so memoized components don't see a new dragon every render. */
export function toUiDragon(d: EngineDragon): UI.Dragon {
  let u = uiCache.get(d);
  if (!u) {
    u = {
      id: d.id,
      name: d.name,
      rarity: d.rarity,
      breed: d.breed,
      role: d.role,
      // No catalog dragon has damageType "none"; the engine type just allows it.
      damageType: d.damageType as UI.DamageType,
      power: dragonPower(d),
      starRank: d.starRank,
      level: d.reignLevel,
      affinity: {
        cavalry: d.affinity.cavalry,
        shieldbearers: d.affinity.shieldbearers,
        archers: d.affinity.archers,
        spearmen: d.affinity.spearmen,
      },
      active: d.active !== false,
      notes: d.notes,
      art: getDragonArt(d.name),
    };
    uiCache.set(d, u);
  }
  return u;
}

const CATEGORY_LABEL: Record<SynergyCategory, string> = {
  troop: "Troop",
  vanguard: "Vanguard skill",
  position: "Position",
  balance: "Balance",
  kit: "Kit",
  goal: "Goal",
};

export const skillName = (slot: number): UI.SkillName => (slot === COMMAND_SLOT ? "Command" : (`Habit ${slot}` as UI.SkillName));

export function toUiEval(e: EngineEval): UI.FormationEvaluation {
  const slot = (d: EngineDragon | null) => (d ? toUiDragon(d) : null);
  return {
    placement: { left: slot(e.placement.left), vanguard: slot(e.placement.vanguard), right: slot(e.placement.right) },
    troopType: (e.troopType ?? "cavalry") as UI.TroopType,
    basePower: e.basePower,
    structuralPct: e.structuralPct,
    habitPct: e.habitPct,
    bonusPct: e.bonusPct,
    score: e.score,
    rankScore: e.rankScore,
    // The breakdown groups structural lines by a "Category: " text prefix.
    structural: e.synergies.filter((s) => s.category).map((s) => ({ text: `${CATEGORY_LABEL[s.category!]}: ${s.text}`, pct: s.pct })),
    habitLinks: e.habitLinks.map((l) => ({
      source: l.source.name,
      skill: skillName(l.slot),
      recipients: l.recipients,
      effects: l.effects,
      ...(l.setUpBy ? { setUpBy: l.setUpBy } : {}),
      pct: l.pct,
      uptimeByRound: l.uptimeByRound,
    })),
    warnings: e.warnings,
  };
}

export const toUiPair = (p: EnginePair): UI.PairRecommendation => ({ left: toUiDragon(p.left), right: toUiDragon(p.right), eval: toUiEval(p.eval) });

export const toUiCandidate = (c: EngineCandidate): UI.FlankCandidate => ({ dragon: toUiDragon(c.dragon), fits: c.fits, isTrio: c.isTrio, eval: toUiEval(c.eval) });

/** A disjoint sheet-rating search → the squad draft's shapes. Ratings are in seat order (left, vanguard, right). */
export function toSquadDraft(search: SheetLineupSearch, ms: number, ranAt: number, activeCount: number, focus: EngineDragon | null = null): UI.SquadDraft {
  const squads = search.ratings.map((r, i): UI.Squad => {
    const members = r.dragons.map((d): UI.SquadMember => ({
      slot: d.lane,
      dragon: toUiDragon(d.dragon),
      affinity: d.affinity,
      troopBonus: d.boosted,
      sheet: d.sheetScore,
      own: d.selfScore,
      formation: d.fullScore,
      stats: d.stats.map((s) => ({ stat: s.stat, base: s.base, afterStars: s.sheet, afterTroop: s.afterAffinity, ownBuffs: s.self, withTeammates: s.full })),
    })) as UI.Squad["members"];
    return {
      rank: i + 1,
      subtitle: squadSubtitle(i + 1, focus?.name),
      members,
      troop: r.troop.troop,
      formation: r.fullScore,
      sheet: r.sheetScore,
      ownBuffs: r.selfScore,
      fromTeammates: r.synergy,
      sheetT: r.sheetT,
      buffedT: r.buffedT,
      pctOfCeiling: r.index,
      troopOptions: r.troop.options.map((o) => ({ troop: o.troop, formation: o.fullScore, boosted: o.matches })),
    };
  });
  return { squads, focus: focus && toUiDragon(focus), formationsChecked: search.searched, troopsPerFormation: search.troopsTried, ms, ranAt, activeCount };
}

function squadSubtitle(rank: number, focus: string | undefined): string {
  if (focus) return rank === 1 ? `Best with ${focus}` : `No. ${rank} with ${focus} · a different trio`;
  if (rank === 1) return "Best formation";
  return rank === 2 ? "Best with no dragon from Squad 1" : `Best with no dragon from Squads 1–${rank - 1}`;
}

export function vanguardSkillOf(name: string): UI.VanguardSkill | null {
  const v = kitFor(name)?.vanguard;
  return v ? { selfText: v.selfText, flankPos: v.flankPos, flankText: v.flankText } : null;
}

/** A clause with its values pinned to one habit level, so its summary reads "+25%" rather than "+12.5 → +25%". */
function atLevel(c: Clause, level: number): Clause {
  const pin = (v: Clause["valueByLevel"]) => (v ? Array(5).fill(v[level - 1] ?? v.find((x) => x != null) ?? null) : v);
  return { ...c, valueByLevel: pin(c.valueByLevel), chanceByLevel: pin(c.chanceByLevel) };
}

/** Command + 5 Habits as plain-English clause summaries at `level`. */
export function skillSummaries(name: string, skills: SkillsByDragon | undefined, level: number): UI.SkillSummary[] {
  const list = skills?.[name] ?? [];
  return [COMMAND_SLOT, 1, 2, 3, 4, 5].map((slot) => {
    const s = list.find((x) => x.habitSlot === slot);
    const shortText = slot === COMMAND_SLOT ? (kitFor(name)?.command ?? "") : (HABIT_TEXT[name]?.[slot - 1]?.short[level - 1] ?? "");
    const clauses = (s?.clauses ?? []).map((c) => {
      const text = describeClause(slot === COMMAND_SLOT ? c : atLevel(c, level));
      return c.skip ? `${text} · not scored (${c.skip})` : text;
    });
    return { habitSlot: slot, shortText, clauses: clauses.length ? clauses : ["No clause data for this skill yet."] };
  });
}
