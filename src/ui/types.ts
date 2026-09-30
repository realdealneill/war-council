// Data shapes — mirror the engine's output exactly (design brief §4).
// Components take these as props; nothing below is UI-specific.

export type Rarity = "rare" | "epic" | "legendary" | "mythic";
export type Breed = "champion" | "hunter" | "sentinel" | "warrior";
export type Role = "tank" | "physical" | "tactical" | "fire" | "healer" | "control";
export type DamageType = "physical" | "tactical" | "fire";
export type TroopType = "cavalry" | "shieldbearers" | "archers" | "spearmen";
export type Slot = "left" | "vanguard" | "right";
export type Affinity = "+" | "-" | 0;

export interface DragonArt {
  portrait?: string;
  square?: string;
  hero?: string;
  fullbody: string[];
}

export interface Dragon {
  id: string;
  name: string;
  rarity: Rarity;
  breed: Breed;
  role: Role;
  damageType: DamageType;
  power: number;
  starRank: number; // 1-10
  level?: number; // 1-50 (customizer)
  habitLevels?: (number | null)[]; // 5 slots, null = locked (customizer)
  affinity: Record<TroopType, Affinity>;
  active: boolean;
  notes?: string;
  art: DragonArt;
}

export interface VanguardSkill {
  selfText: string;
  flankPos: "left" | "right";
  flankText: string;
}

export interface SkillSummary {
  habitSlot: number; // 0 = Command, 1-5 = Habit
  shortText: string;
  clauses: string[];
}

export interface SynergyEntry {
  text: string;
  pct: number; // fraction of basePower
}

export type SkillName = "Command" | `Habit ${1 | 2 | 3 | 4 | 5}`;

export interface HabitLink {
  source: string;
  skill: SkillName;
  recipients: string[];
  effects: string[];
  setUpBy?: string[];
  pct: number;
  uptimeByRound?: number[];
}

export interface Placement {
  left: Dragon | null;
  vanguard: Dragon | null;
  right: Dragon | null;
}

export interface FormationEvaluation {
  placement: Placement;
  troopType: TroopType;
  basePower: number;
  structuralPct: number;
  habitPct: number;
  bonusPct: number;
  score: number;
  rankScore: number;
  structural: SynergyEntry[];
  habitLinks: HabitLink[];
  warnings: string[];
}

export interface FlankCandidate {
  dragon: Dragon;
  fits: boolean;
  isTrio: boolean;
  eval: FormationEvaluation;
}

export interface PairRecommendation {
  left: Dragon;
  right: Dragon;
  eval: FormationEvaluation;
}

export interface Controls {
  emphasis: number;
  habitLevel: 1 | 2 | 3 | 4 | 5;
}

/** Loading states for the two backend queries (catalog + habit data load separately). */
export interface LoadState {
  catalog: "loading" | "ready";
  habits: "loading" | "ready";
}

// ---------------------------------------------------------------- combat rating (squad draft)
// Filled from src/engine/sheetRating.ts by adapt.ts toSquadDraft(). Values are
// null where a dragon's ★1 base stat hasn't been entered yet.
export type StatKey = "strength" | "instinct" | "intelligence" | "initiative";

/** One stat through the pipeline. afterTroop = afterStars × 1.2 only when the dragon likes the squad's troop. */
export interface StatRow {
  stat: StatKey;
  base: number | null; // ★1 base
  afterStars: number | null;
  afterTroop: number | null; // the "sheet" value
  ownBuffs: number | null; // 10-round average
  withTeammates: number | null;
}

export interface SquadMember {
  slot: Slot;
  dragon: Dragon;
  affinity: Affinity; // for the squad's troop
  troopBonus: boolean; // got +20%
  sheet: number; // contribution before skills
  own: number; // with own buffs
  formation: number; // with every buff
  stats: StatRow[];
}

export interface TroopOption {
  troop: TroopType;
  formation: number;
  boosted: number; // dragons that get +20%
}

export interface Squad {
  rank: number; // 1-based, best first
  /** One line on how this squad was picked, e.g. "Best with no dragon from Squad 1". */
  subtitle: string;
  members: [SquadMember, SquadMember, SquadMember]; // left, vanguard, right
  troop: TroopType;
  formation: number; // ranked on this
  sheet: number;
  ownBuffs: number; // sheet + own buffs
  fromTeammates: number; // formation − ownBuffs
  sheetT: number | null; // 50 = roster average, 10 = 1 SD
  buffedT: number | null;
  pctOfCeiling: number | null; // fraction; can pass 1
  troopOptions: TroopOption[]; // all 4, best first
}

export interface SquadDraft {
  /** Top 5 with no dragon shared, or (focus set) the best different trios that include the focus dragon. */
  squads: Squad[];
  focus: Dragon | null;
  formationsChecked: number;
  troopsPerFormation: number;
  ms: number;
  ranAt: number; // epoch ms
  activeCount: number;
}

export type DraftStatus =
  | { kind: "idle"; error?: string } // not yet run (or the last run failed)
  | { kind: "blocked"; reason: string } // cannot run
  | { kind: "running"; done: number; total: number; startedAt: number } // in a worker; startedAt is performance.now()
  | { kind: "ready"; draft: SquadDraft }
  | { kind: "stale"; draft: SquadDraft; changes: string[] };
