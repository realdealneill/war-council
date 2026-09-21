export type TroopType = "cavalry" | "shieldbearers" | "archers" | "spearmen" | "siege";
export type Slot = "left" | "vanguard" | "right";
export type Rarity = "rare" | "epic" | "legendary" | "mythic";
export type DamageType = "physical" | "tactical" | "fire" | "none";
export type Role = "tank" | "physical" | "tactical" | "fire" | "healer" | "control";
export type Breed = "champion" | "hunter" | "sentinel" | "warrior";
export type Goal = "balanced" | "siege" | "dps";
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

export interface SynergyEntry {
  text: string;
  pct: number;
}

export interface ArmyEvaluation {
  score: number;
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
