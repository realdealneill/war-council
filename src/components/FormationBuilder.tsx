import { useMemo, useState } from "react";
import { kitFor } from "../data";
import { ArmyCard } from "./ArmyCard";
import { NON_SIEGE_TROOP_OPTIONS } from "../engine/constants";
import { dragonPower } from "../engine/power";
import { bestArmy } from "../engine/scoring";
import { flankDamageType, isBuffedFlank, rankFlankCandidates } from "../engine/vanguardFit";
import type { Dragon, Slot } from "../types";
import { breedName, damageTypeName, roleName } from "../utils/labels";

interface FormationBuilderProps {
  vanguard: Dragon;
  roster: Dragon[];
  onChangeVanguard: () => void;
}

function FlankSlot({
  label,
  vanguard,
  flank,
  selected,
  pool,
  otherFlankDragon,
  onSelect,
  onClear,
}: {
  label: string;
  vanguard: Dragon;
  flank: Slot;
  selected: Dragon | null;
  pool: Dragon[];
  otherFlankDragon: Dragon | null;
  onSelect: (d: Dragon) => void;
  onClear: () => void;
}) {
  const buffed = isBuffedFlank(vanguard.name, flank);
  const reqType = buffed ? flankDamageType(vanguard.name) : null;
  const ranked = useMemo(
    () => rankFlankCandidates(vanguard, flank, pool, otherFlankDragon),
    [vanguard, flank, pool, otherFlankDragon]
  );

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
      <div className="text-xs uppercase text-neutral-500">{label}</div>
      {buffed && reqType && (
        <div className="text-xs text-emerald-400">Buffed by {vanguard.name} — favors {damageTypeName(reqType)} dealers</div>
      )}

      {selected ? (
        <div className="rounded border border-violet-600 bg-violet-950/30 p-2">
          <div className="font-medium text-neutral-100">{selected.name}</div>
          <div className="text-xs text-neutral-400">{breedName(selected.breed)} · {roleName(selected.role)}</div>
          <div className="text-xs text-neutral-500">{Math.round(dragonPower(selected))}</div>
          <button className="mt-1 text-xs text-neutral-500 underline hover:text-neutral-300" onClick={onClear}>
            Change
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-2 text-[10px] uppercase text-neutral-600">
            <span>Dragon</span>
            <span className="flex gap-3">
              <span className="w-12 text-right">Power</span>
              <span className="w-14 text-right">Synergy</span>
            </span>
          </div>
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {ranked.map(({ dragon: d, fits, synergyPct }) => (
              <li key={d.id}>
                <button
                  className={`flex w-full items-center justify-between gap-2 rounded border px-2 py-1 text-left text-sm hover:bg-neutral-800/60 ${
                    fits ? "border-emerald-800" : "border-neutral-800"
                  }`}
                  onClick={() => onSelect(d)}
                >
                  <span className="flex items-center gap-1.5">
                    {fits && <span className="text-emerald-400">✓</span>}
                    <span className="text-neutral-100">{d.name}</span>
                    <span className="text-xs text-neutral-500">{roleName(d.role)}</span>
                  </span>
                  <span className="flex gap-3 text-xs">
                    <span className="w-12 text-right text-neutral-500">{Math.round(dragonPower(d))}</span>
                    <span className={`w-14 text-right ${synergyPct != null ? "text-violet-300" : "text-neutral-600"}`}>
                      {synergyPct != null ? `+${(synergyPct * 100).toFixed(1)}%` : "—"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {ranked.length === 0 && <li className="px-2 py-1 text-xs text-neutral-500">No other dragons available.</li>}
          </ul>
        </>
      )}
    </div>
  );
}

export function FormationBuilder({ vanguard, roster, onChangeVanguard }: FormationBuilderProps) {
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);

  const available = useMemo(() => roster.filter((d) => d.active !== false && d.id !== vanguard.id), [roster, vanguard]);
  const left = available.find((d) => d.id === leftId) ?? null;
  const right = available.find((d) => d.id === rightId) ?? null;
  const leftPool = available.filter((d) => d.id !== rightId);
  const rightPool = available.filter((d) => d.id !== leftId);

  const kit = kitFor(vanguard.name);

  const preview = useMemo(() => {
    if (!left || !right) return null;
    return bestArmy(
      [vanguard, left, right],
      NON_SIEGE_TROOP_OPTIONS,
      { goal: "balanced" },
      { left, vanguard, right }
    );
  }, [vanguard, left, right]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
        <div>
          <div className="text-xs uppercase text-neutral-500">Vanguard</div>
          <div className="font-medium text-neutral-100">{vanguard.name}</div>
          {kit && <div className="text-xs text-neutral-400">Self: {kit.vanguard.selfText}</div>}
        </div>
        <button className="text-sm text-neutral-400 underline hover:text-neutral-200" onClick={onChangeVanguard}>
          Change Vanguard
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FlankSlot label="Left Flank" vanguard={vanguard} flank="left" selected={left} pool={leftPool} otherFlankDragon={right} onSelect={(d) => setLeftId(d.id)} onClear={() => setLeftId(null)} />
        <FlankSlot label="Right Flank" vanguard={vanguard} flank="right" selected={right} pool={rightPool} otherFlankDragon={left} onSelect={(d) => setRightId(d.id)} onClear={() => setRightId(null)} />
      </div>

      {preview && <ArmyCard army={{ dragons: [left!, vanguard, right!], locks: { left: left!, vanguard, right: right! }, eval: preview }} index={0} />}
    </div>
  );
}
