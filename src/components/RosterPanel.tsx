import { useMemo, useState } from "react";
import { SEED_DRAGONS } from "../data";
import { dragonPower } from "../engine/power";
import type { Dragon } from "../types";

const RARITY_COLOR: Record<string, string> = {
  rare: "border-blue-400 text-blue-300",
  epic: "border-purple-400 text-purple-300",
  legendary: "border-yellow-400 text-yellow-300",
  mythic: "border-red-400 text-red-300",
};

interface RosterPanelProps {
  roster: Dragon[];
  onAdd: (dragon: Dragon) => void;
  onAddAll: (dragons: Dragon[]) => void;
  onRemove: (id: string) => void;
  onToggleActive: (id: string) => void;
  onClear: () => void;
}

export function RosterPanel({ roster, onAdd, onAddAll, onRemove, onToggleActive, onClear }: RosterPanelProps) {
  const [query, setQuery] = useState("");
  const rosterIds = useMemo(() => new Set(roster.map((d) => d.id)), [roster]);

  const catalog = useMemo(
    () =>
      SEED_DRAGONS.filter(
        (d) => !rosterIds.has(d.id) && d.name.toLowerCase().includes(query.toLowerCase())
      ),
    [rosterIds, query]
  );

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-100">Your Dragons ({roster.length})</h2>
        <div className="flex gap-2">
          <button
            className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
            onClick={() => onAddAll(SEED_DRAGONS)}
          >
            Add all ({SEED_DRAGONS.length})
          </button>
          {roster.length > 0 && (
            <button
              className="rounded border border-red-900 px-2 py-1 text-xs text-red-300 hover:bg-red-950"
              onClick={onClear}
            >
              Remove all
            </button>
          )}
        </div>
      </div>

      {roster.length === 0 ? (
        <p className="text-sm text-neutral-500">No dragons yet — add some from the list below.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {roster.map((d) => (
            <li
              key={d.id}
              className={`flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-sm ${RARITY_COLOR[d.rarity] ?? "border-neutral-700"} ${d.active === false ? "opacity-40" : ""}`}
            >
              <label className="flex flex-1 items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={d.active !== false} onChange={() => onToggleActive(d.id)} />
                <span className="font-medium text-neutral-100">{d.name}</span>
                <span className="text-neutral-400">{d.role}</span>
                <span className="ml-auto text-neutral-400">{Math.round(dragonPower(d))}</span>
              </label>
              <button className="text-neutral-500 hover:text-red-400" onClick={() => onRemove(d.id)} aria-label={`Remove ${d.name}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-neutral-800 pt-3">
        <input
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 placeholder:text-neutral-500"
          type="search"
          placeholder="Search dragons to add…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
          {catalog.map((d) => (
            <li key={d.id}>
              <button
                className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm text-neutral-300 hover:bg-neutral-800"
                onClick={() => onAdd(d)}
              >
                <span>{d.name}</span>
                <span className="text-xs text-neutral-500">{d.rarity} · {d.role}</span>
              </button>
            </li>
          ))}
          {catalog.length === 0 && <li className="px-2 py-1 text-xs text-neutral-500">No matches.</li>}
        </ul>
      </div>
    </section>
  );
}
