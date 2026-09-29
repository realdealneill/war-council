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
  habitAssumption: "all" | "stars";
  habitLevel: 1 | 2 | 3 | 4 | 5;
}

/** Loading states for the two backend queries (catalog + habit data load separately). */
export interface LoadState {
  catalog: "loading" | "ready";
  habits: "loading" | "ready";
}
