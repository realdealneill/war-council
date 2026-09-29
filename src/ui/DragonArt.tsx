import * as React from "react";
import type { Dragon } from "./types";
import { cx, rarityInk, rarityVar } from "./format";

type Kind = "square" | "portrait" | "hero" | "fullbody";

/** Scale pattern + crest used when a dragon has no artwork. Deliberate, rarity-tinted, never a broken image. */
export function DragonFallback({ dragon, kind, className }: { dragon: Pick<Dragon, "name" | "rarity">; kind: Kind; className?: string }) {
  const id = React.useId().replace(/:/g, "");
  const big = kind === "hero" || kind === "fullbody";
  return (
    <div
      className={cx("relative overflow-hidden flex items-center justify-center", className)}
      style={{ background: `radial-gradient(120% 90% at 50% 35%, color-mix(in srgb, ${rarityVar(dragon.rarity)} 26%, var(--surface-sunken)) 0%, var(--surface-sunken) 72%)` }}
      role="img"
      aria-label={`${dragon.name} (no artwork yet)`}
    >
      <svg className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <pattern id={`sc${id}`} width={big ? 28 : 14} height={big ? 14 : 7} patternUnits="userSpaceOnUse">
            <path
              d={big ? "M0 14a14 14 0 0 1 28 0M-14 7a14 14 0 0 1 28 0M14 7a14 14 0 0 1 28 0" : "M0 7a7 7 0 0 1 14 0M-7 3.5a7 7 0 0 1 14 0M7 3.5a7 7 0 0 1 14 0"}
              fill="none"
              stroke={rarityVar(dragon.rarity)}
              strokeOpacity="0.22"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#sc${id})`} />
      </svg>
      <div className="relative flex flex-col items-center">
        <svg viewBox="0 0 40 46" className={cx(big ? "w-20" : kind === "portrait" ? "w-14" : "w-[62%]")} aria-hidden="true">
          <path d="M20 1.5 38 7v15c0 10.5-7.6 17.9-18 22.5C9.6 39.9 2 32.5 2 22V7z" fill="var(--surface)" fillOpacity="0.85" stroke={rarityVar(dragon.rarity)} strokeWidth="1.5" />
          <text x="20" y="29" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" fontSize="20" fill={rarityInk(dragon.rarity)}>
            {dragon.name[0]}
          </text>
        </svg>
        {big && <div className="mt-2 font-display text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: rarityInk(dragon.rarity) }}>Artwork pending</div>}
      </div>
    </div>
  );
}

/** Any of the 4 art kinds, with the designed fallback. */
export function DragonImage({ dragon, kind, className, imgClass }: { dragon: Dragon; kind: Kind; className?: string; imgClass?: string }) {
  const [failed, setFailed] = React.useState(false);
  const src = kind === "fullbody" ? dragon.art.fullbody[0] : dragon.art[kind];
  if (!src || failed) return <DragonFallback dragon={dragon} kind={kind} className={className} />;
  return (
    <div className={cx("relative overflow-hidden", className)}>
      <img
        src={src}
        alt={dragon.name}
        loading="lazy"
        onError={() => setFailed(true)}
        className={cx("size-full", kind === "square" || kind === "portrait" ? "object-cover" : "object-contain", imgClass)}
      />
    </div>
  );
}

/** Square avatar with rarity ring. */
export function DragonAvatar({ dragon, size = 32, className, ring = true }: { dragon: Dragon; size?: number; className?: string; ring?: boolean }) {
  return (
    <span
      className={cx("relative inline-block shrink-0 overflow-hidden rounded-md", className)}
      style={{ width: size, height: size, boxShadow: ring ? `0 0 0 1.5px ${rarityVar(dragon.rarity)}` : undefined }}
    >
      <DragonImage dragon={dragon} kind="square" className="size-full" />
    </span>
  );
}

/** Name tinted by rarity. */
export function DragonName({ dragon, className }: { dragon: Dragon; className?: string }) {
  return (
    <span className={cx("font-semibold", className)} style={{ color: rarityInk(dragon.rarity) }}>
      {dragon.name}
    </span>
  );
}
