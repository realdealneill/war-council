import type { Breed, DamageType, Rarity, Role, Slot, TroopType } from "./types";

export const nf = new Intl.NumberFormat("en-US");
export const fmtInt = (n: number) => nf.format(Math.round(n));
/** "+38.4%" — one decimal, explicit sign. */
export const fmtPct = (x: number, sign = true) => {
  const v = (x * 100).toFixed(1);
  const neg = x < 0 || v.startsWith("-");
  const abs = v.replace("-", "");
  return `${neg ? "−" : sign ? "+" : ""}${abs}%`;
};
export const fmtSigned = (n: number) => `${n < 0 ? "−" : "+"}${fmtInt(Math.abs(n))}`;

export const ROLE_LABEL: Record<Role, string> = {
  tank: "Tank / Taunt",
  physical: "Physical DPS",
  tactical: "Tactical DPS",
  fire: "Fire DPS",
  healer: "Healer / Support",
  control: "Control / Debuffer",
};
export const ROLE_SHORT: Record<Role, string> = {
  tank: "Tank", physical: "Physical", tactical: "Tactical", fire: "Fire", healer: "Healer", control: "Control",
};
export const BREED_LABEL: Record<Breed, string> = {
  champion: "Champion", hunter: "Hunter", sentinel: "Sentinel", warrior: "Warrior",
};
export const BREED_ARCHETYPE: Record<Breed, string> = {
  champion: "Suppressor", hunter: "Debuffer", sentinel: "Buffer", warrior: "Enhancer",
};
export const RARITY_LABEL: Record<Rarity, string> = {
  rare: "Rare", epic: "Epic", legendary: "Legendary", mythic: "Mythic",
};
export const DAMAGE_LABEL: Record<DamageType, string> = { physical: "Physical", tactical: "Tactical", fire: "Fire" };
export const TROOP_LABEL: Record<TroopType, string> = {
  cavalry: "Cavalry", shieldbearers: "Shieldbearers", archers: "Archers", spearmen: "Spearmen",
};
export const SLOT_LABEL: Record<Slot, string> = { left: "Left Flank", vanguard: "Vanguard", right: "Right Flank" };
/** Lane preference per role (brief §4). */
export const LANE_PREF: Record<Role, string> = {
  tank: "Vanguard", physical: "Right Flank", tactical: "Left Flank", fire: "Left Flank", healer: "Left Flank", control: "any lane",
};

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

/** CSS var names per rarity / damage type. */
export const rarityVar = (r: Rarity) => `var(--rarity-${r})`;
export const rarityInk = (r: Rarity) => `var(--rarity-${r}-ink)`;
export const damageVar = (d: DamageType) => `var(--dmg-${d})`;
