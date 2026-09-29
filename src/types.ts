export type TroopType = "cavalry" | "shieldbearers" | "archers" | "spearmen" | "siege";
export type Slot = "left" | "vanguard" | "right";
export type Rarity = "rare" | "epic" | "legendary" | "mythic";
export type DamageType = "physical" | "tactical" | "fire" | "none";
export type Role = "tank" | "physical" | "tactical" | "fire" | "healer" | "control";
export type Breed = "champion" | "hunter" | "sentinel" | "warrior";
export type Goal = "balanced" | "synergy" | "dps";
export type Affinity = "+" | "-" | 0;

export type EffectId =
  | "taunt" | "burn" | "panic" | "stun" | "overwhelm" | "confusion" | "slow"
  | "bleed" | "weakened" | "vulnerable" | "debuff" | "dispel"
  | "buff" | "recovery" | "cleanse" | "mitigation" | "resistance" | "evasion"
  | "advantage" | "protect" | "firstStrike" | "doubleStrike" | "mirage" | "risingTide"
  | "control" | "sentinel";

export interface DragonEffects {
  applies: EffectId[];
  grants: EffectId[];
  self: EffectId[];
  wants: EffectId[];
}

export interface Dragon {
  id: string;
  name: string;
  rarity: Rarity;
  breed: Breed;
  role: Role;
  damageType: DamageType;
  notes?: string;
  starRank: number;
  reignLevel: number;
  power: number;
  troopCapacity: number;
  tags: string[];
  affinity: Record<TroopType, Affinity>;
  isNew?: boolean;
  /** Included in optimization when true (default). Toggled off to bench a dragon without removing it. */
  active?: boolean;
  /**
   * Base stats — not in the reference data this app started from, which
   * only ever tracked flat kit bonuses to these, never the underlying
   * number. Sourced from Convex (see src/hooks/useCatalog.ts) once entered
   * via the /admin/dragon-stats form; undefined until then. baseInstinct is
   * currently the only one consumed (see engine/vanguardFit.ts's tiebreak).
   */
  baseStrength?: number;
  baseIntelligence?: number;
  baseInstinct?: number;
  baseInitiative?: number;
}

export interface VanguardBuffEffect {
  kind: "damage" | "damageAny" | "mitigation" | "recovery" | "stat";
  type?: DamageType;
  pct?: number;
  stats?: string[];
  flat?: number;
}

export interface VanguardSkill {
  text: string;
  self: VanguardBuffEffect[];
  selfText: string;
  flank: VanguardBuffEffect[];
  flankPos: "left" | "right";
  flankText: string;
}

export interface DragonKitEffectEntry {
  star: number;
  source: string;
  applies: EffectId[];
  grants: EffectId[];
  self: EffectId[];
  wants: EffectId[];
}

export interface DragonKit {
  command: string;
  upgrades: unknown[];
  vanguard: VanguardSkill;
  effects: DragonKitEffectEntry[];
}

export interface Placement {
  left: Dragon | null;
  vanguard: Dragon | null;
  right: Dragon | null;
}

/** Which part of scoring.ts a structural line comes from; unset for habit-synergy lines. */
export type SynergyCategory = "troop" | "vanguard" | "position" | "balance" | "kit" | "goal";

export interface SynergyEntry {
  text: string;
  pct: number;
  category?: SynergyCategory;
}

export interface ArmyEvaluation {
  /** True effective power (basePower + synergy bonus) — what's shown to the user. */
  score: number;
  /** What the optimizer actually ranks armies by; equals `score` except under the "synergy" goal, which weights the bonus more heavily so kit synergy can outrank raw power. */
  rankScore: number;
  basePower: number;
  rawPower: number;
  bonusPct: number;
  synergies: SynergyEntry[];
  warnings: string[];
  placement: Placement;
  troopType: TroopType | null;
}

export interface Army {
  dragons: Dragon[];
  locks: Partial<Record<Slot, Dragon>>;
  eval: ArmyEvaluation;
}

export interface OptimizeResult {
  armies: Army[];
  bench: Dragon[];
  total: number;
  iterations: number;
}
