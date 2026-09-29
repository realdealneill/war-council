// Dragon artwork from gotdragonfire.com, fetched by scripts/fetch-dragon-art.mjs.
// Files are named by slug (lowercased dragon name), e.g. `hero/syrax.webp`,
// `fullbody/syrax-2.webp`. Not every roster dragon has art yet — the
// lookups return undefined / [] when missing.
//
//   portrait  474x560 listing card (opaque)
//   square    729x729 bio portrait (opaque)
//   hero      ~2540x1240 head/neck cutout (transparent)
//   fullbody  full-body cutouts, 1–3 per dragon (transparent)

const glob = (files: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(files).map(([p, url]) => [p.split("/").pop()!.replace(/\.webp$/, ""), url]),
  );

const portraits = glob(import.meta.glob("./portrait/*.webp", { eager: true, import: "default", query: "?url" }));
const squares = glob(import.meta.glob("./square/*.webp", { eager: true, import: "default", query: "?url" }));
const heroes = glob(import.meta.glob("./hero/*.webp", { eager: true, import: "default", query: "?url" }));
const fullbodies = glob(import.meta.glob("./fullbody/*.webp", { eager: true, import: "default", query: "?url" }));

export const dragonSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "");

export interface DragonArt {
  portrait?: string;
  square?: string;
  hero?: string;
  fullbody: string[];
}

export function getDragonArt(name: string): DragonArt {
  const slug = dragonSlug(name);
  return {
    portrait: portraits[slug],
    square: squares[slug],
    hero: heroes[slug],
    fullbody: Object.keys(fullbodies)
      .filter((k) => k.replace(/-\d+$/, "") === slug)
      .sort()
      .map((k) => fullbodies[k]),
  };
}

export const hasDragonArt = (name: string) => dragonSlug(name) in portraits;
