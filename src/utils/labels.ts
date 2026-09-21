import { MODEL } from "../data";

export function roleName(id: string): string {
  return MODEL.ROLES.find((r) => r.id === id)?.name ?? id;
}

export function breedName(id: string): string {
  return MODEL.BREEDS.find((b) => b.id === id)?.name ?? id;
}

export function damageTypeName(id: string): string {
  return MODEL.DAMAGE_TYPES.find((d) => d.id === id)?.name ?? id;
}
