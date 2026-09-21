import { MODEL } from "../data";
import { dragonPower } from "../engine/power";
import type { Army, Placement } from "../types";

const SLOT_LABEL: Record<keyof Placement, string> = { left: "Left Flank", vanguard: "Vanguard", right: "Right Flank" };
const SLOT_ORDER: (keyof Placement)[] = ["left", "vanguard", "right"];

export function ArmyCard({ army, index }: { army: Army; index: number }) {
  const ev = army.eval;
  const troop = MODEL.TROOP_TYPES.find((t) => t.id === ev.troopType);
  const synergies = ev.synergies.filter((s) => s.pct >= 0.001).sort((a, b) => b.pct - a.pct);

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-neutral-100">Army {index + 1}</div>
          <div className="text-sm text-neutral-400">{troop ? `${troop.icon} ${troop.name}` : "—"}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-neutral-100">{Math.round(ev.score)}</div>
          <div className="text-xs text-emerald-400">+{(ev.bonusPct * 100).toFixed(1)}% synergy</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {SLOT_ORDER.map((slot) => {
          const d = ev.placement[slot];
          return (
            <div key={slot} className="rounded border border-neutral-800 p-2 text-center">
              <div className="text-xs uppercase text-neutral-500">{SLOT_LABEL[slot]}</div>
              {d ? (
                <>
                  <div className="font-medium text-neutral-100">{d.name}</div>
                  <div className="text-xs text-neutral-400">{d.role}</div>
                  <div className="text-xs text-neutral-500">{Math.round(dragonPower(d))}</div>
                </>
              ) : (
                <div className="text-neutral-600">—</div>
              )}
            </div>
          );
        })}
      </div>

      {(synergies.length > 0 || ev.warnings.length > 0) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {synergies.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-neutral-500">Bonuses</h4>
              <ul className="mt-1 flex flex-col gap-0.5 text-sm">
                {synergies.map((s, i) => (
                  <li key={i} className="text-neutral-300">
                    <span className="text-emerald-400">+{(s.pct * 100).toFixed(1)}%</span> {s.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ev.warnings.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-neutral-500">Watch out</h4>
              <ul className="mt-1 flex flex-col gap-0.5 text-sm text-amber-400">
                {ev.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
