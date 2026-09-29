import * as React from "react";

// One 16×16 stroke icon set for every trait (troop, role, breed, damage) plus UI glyphs.
// Stroke = currentColor, 1.5px, round caps — recolour with `text-*`.
const P: Record<string, React.ReactNode> = {
  // troops
  cavalry: <><path d="M4 2.5v5.5a4 4 0 0 0 8 0V2.5" /><path d="M2.8 2.5h2.4M10.8 2.5h2.4" /><path d="M5.5 5.5h0M10.5 5.5h0M6.2 9h0M9.8 9h0" strokeWidth="1.8" /></>,
  shieldbearers: <path d="M8 1.6 13.4 3.4V8c0 3.1-2.3 5.3-5.4 6.4C4.9 13.3 2.6 11.1 2.6 8V3.4z" />,
  archers: <><path d="M4.5 1.8c4.6 2.2 4.6 10.2 0 12.4" /><path d="M4.5 1.8v12.4" /><path d="M2 8h11.2M10.8 5.6 13.2 8l-2.4 2.4" /></>,
  spearmen: <><path d="M8 14.5V5.5" /><path d="M4.8 2v2.6a3.2 3.2 0 0 0 6.4 0V2" /><path d="M8 1.2v4.3" /></>,
  // roles
  tank: <><path d="M8 1.6 13.4 3.4V8c0 3.1-2.3 5.3-5.4 6.4C4.9 13.3 2.6 11.1 2.6 8V3.4z" /><path d="M8 4.6v6.6M5.4 7.2h5.2" /></>,
  physical: <><path d="M13.5 2.5 6 10" /><path d="M10.5 2.5h3v3" /><path d="M3.8 8.4l3.8 3.8M4.2 11.8l-1.7 1.7" /></>,
  tactical: <><path d="M8 1.8 14.2 8 8 14.2 1.8 8z" /><circle cx="8" cy="8" r="1.6" /></>,
  fire: <path d="M8 14.4c-2.7 0-4.6-1.9-4.6-4.5 0-2.9 2.6-4.3 2.9-7.9 2.3 1.2 3.9 3.2 4 5.4.8-.4 1.3-1.2 1.4-2.1 1.2 1.1 1.9 2.7 1.9 4.4 0 2.8-2.3 4.7-5.6 4.7z" />,
  healer: <><circle cx="8" cy="8" r="6.2" /><path d="M8 4.8v6.4M4.8 8h6.4" /></>,
  control: <><path d="M6.6 9.4l2.8-2.8" /><path d="M7.2 11.6l-1.4 1.4a2.3 2.3 0 0 1-3.2-3.2L4 8.4" /><path d="M8.8 4.4 10.2 3a2.3 2.3 0 0 1 3.2 3.2L12 7.6" /></>,
  // breeds
  champion: <><path d="M2.6 12.6h10.8" /><path d="M3.2 12.6 2.2 5.2l3.4 2.9L8 3.2l2.4 4.9 3.4-2.9-1 7.4" /></>,
  hunter: <><circle cx="8" cy="8" r="5" /><circle cx="8" cy="8" r="1.2" /><path d="M8 1.2v2.6M8 12.2v2.6M1.2 8h2.6M12.2 8h2.6" /></>,
  sentinel: <><path d="M1.5 8S4 3.6 8 3.6 14.5 8 14.5 8 12 12.4 8 12.4 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /></>,
  warrior: <><path d="M3 3l10 10M13 3 3 13" /><path d="M2.2 5.6 5.6 2.2M10.4 2.2l3.4 3.4" /></>,
  // damage types
  "dmg-physical": <path d="M4 12.8 8.2 3.6M7.2 13.6l4.2-9.2M10.6 14l3-6.6" />,
  "dmg-tactical": <><path d="M8 1.8 14.2 8 8 14.2 1.8 8z" /><circle cx="8" cy="8" r="1.6" /></>,
  "dmg-fire": <path d="M8 14.4c-2.7 0-4.6-1.9-4.6-4.5 0-2.9 2.6-4.3 2.9-7.9 2.3 1.2 3.9 3.2 4 5.4.8-.4 1.3-1.2 1.4-2.1 1.2 1.1 1.9 2.7 1.9 4.4 0 2.8-2.3 4.7-5.6 4.7z" />,
  // ui
  star: <path d="m8 1.8 1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" />,
  check: <path d="m3 8.4 3.2 3.1L13 4.6" />,
  x: <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />,
  plus: <path d="M8 3v10M3 8h10" />,
  minus: <path d="M3 8h10" />,
  search: <><circle cx="7" cy="7" r="4.6" /><path d="m10.4 10.4 3.8 3.8" /></>,
  roster: <><rect x="2" y="2.5" width="12" height="11" rx="1.5" /><path d="M5 6h6M5 8.5h6M5 11h3.5" /></>,
  swap: <><path d="M2.5 5.5h10l-2.5-2.5" /><path d="M13.5 10.5h-10l2.5 2.5" /></>,
  alert: <><path d="M8 1.8 14.8 13.6H1.2z" /><path d="M8 6.2v3.4M8 11.6h0" /></>,
  info: <><circle cx="8" cy="8" r="6.2" /><path d="M8 7.2v4M8 4.8h0" /></>,
  lock: <><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" /></>,
  arrow: <path d="M2.5 8h11M9.5 4l4 4-4 4" />,
  up: <path d="M8 13V3M4 7l4-4 4 4" />,
  down: <path d="M8 3v10M4 9l4 4 4-4" />,
  chevron: <path d="m4 6 4 4 4-4" />,
  sort: <path d="M5 3v10M2.5 10.5 5 13l2.5-2.5M11 13V3M8.5 5.5 11 3l2.5 2.5" />,
  sliders: <path d="M2 4.5h7M12 4.5h2M2 11.5h2M7 11.5h7M10.5 3v3M5.5 10v3" />,
  loop: <><path d="M12.8 6.2A5 5 0 1 0 13 9.5" /><path d="M13.4 3v3.4H10" /></>,
  link: <><path d="M6.6 9.4l2.8-2.8" /><path d="M7.2 11.6l-1.4 1.4a2.3 2.3 0 0 1-3.2-3.2L4 8.4" /><path d="M8.8 4.4 10.2 3a2.3 2.3 0 0 1 3.2 3.2L12 7.6" /></>,
  bench: <><circle cx="8" cy="8" r="6.2" /><path d="M5.4 8h5.2" /></>,
  crown: <><path d="M2.6 12.6h10.8" /><path d="M3.2 12.6 2.2 5.2l3.4 2.9L8 3.2l2.4 4.9 3.4-2.9-1 7.4" /></>,
};

export type IconName = keyof typeof P | string;

export function Icon({ name, size = 16, className, title, filled }: { name: IconName; size?: number; className?: string; title?: string; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {P[name] ?? P.info}
    </svg>
  );
}
