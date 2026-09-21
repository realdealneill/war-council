import { useMemo } from "react";
import { kitFor } from "../data";
import { dragonPower } from "../engine/power";
import type { Dragon } from "../types";
import { breedName, roleName } from "../utils/labels";

/** Tank and Champion are the two archetypes the game itself steers into the Vanguard slot. */
function isRecommendedVanguard(d: Dragon): boolean {
  return d.role === "tank" || d.breed === "champion";
}

interface VanguardPickerProps {
  roster: Dragon[];
  selectedId: string | null;
  onSelect: (dragon: Dragon) => void;
}

export function VanguardPicker({ roster, selectedId, onSelect }: VanguardPickerProps) {
  const candidates = useMemo(() => {
    const active = roster.filter((d) => d.active !== false);
    return [...active].sort((a, b) => {
      const rec = Number(isRecommendedVanguard(b)) - Number(isRecommendedVanguard(a));
      return rec !== 0 ? rec : dragonPower(b) - dragonPower(a);
    });
  }, [roster]);

  if (candidates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-neutral-500">
        Add some dragons first, then pick one as your Vanguard.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
      <h3 className="mb-1 text-sm font-semibold text-neutral-200">Choose a Vanguard</h3>
      <p className="mb-3 text-xs text-neutral-500">
        <span className="text-amber-400">★</span> marks dragons the game itself steers into the Vanguard slot (Tanks and Champions).
      </p>
      <ul className="flex max-h-[32rem] flex-col gap-1.5 overflow-y-auto">
        {candidates.map((d) => {
          const kit = kitFor(d.name);
          const selected = d.id === selectedId;
          return (
            <li key={d.id}>
              <button
                className={`flex w-full flex-col gap-1 rounded border px-3 py-2 text-left ${
                  selected ? "border-violet-500 bg-violet-950/40" : "border-neutral-800 hover:bg-neutral-800/60"
                }`}
                onClick={() => onSelect(d)}
              >
                <div className="flex items-center gap-2">
                  {isRecommendedVanguard(d) && <span className="text-amber-400">★</span>}
                  <span className="font-medium text-neutral-100">{d.name}</span>
                  <span className="text-xs text-neutral-500">{breedName(d.breed)} · {roleName(d.role)}</span>
                  <span className="text-xs text-neutral-500">★{d.starRank}</span>
                  <span className="ml-auto text-xs text-neutral-500">{Math.round(dragonPower(d))}</span>
                </div>
                {kit ? (
                  <div className="text-xs text-neutral-400">
                    <div>
                      <span className="text-neutral-500">Self:</span> {kit.vanguard.selfText}
                    </div>
                    <div>
                      <span className="text-neutral-500">{kit.vanguard.flankPos === "left" ? "Left Flank" : "Right Flank"}:</span>{" "}
                      {kit.vanguard.flankText}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-600">No known Vanguard skill.</div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
