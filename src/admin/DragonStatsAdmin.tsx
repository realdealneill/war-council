import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { AdminNav } from "../components/AdminNav";
import { DragonDetail } from "./DragonDetail";

type StatField = "baseStrength" | "baseIntelligence" | "baseInstinct" | "baseInitiative";
const STAT_FIELDS: { key: StatField; label: string }[] = [
  { key: "baseStrength", label: "Strength" },
  { key: "baseInstinct", label: "Instinct" },
  { key: "baseIntelligence", label: "Intelligence" },
  { key: "baseInitiative", label: "Initiative" },
];

function StatInput({ dragon, field }: { dragon: Doc<"dragons">; field: StatField }) {
  const updateStats = useMutation(api.dragons.updateStats);
  const [value, setValue] = useState(dragon[field] != null ? String(dragon[field]) : "");

  // Keep in sync if this row changes from elsewhere (another tab, another edit).
  useEffect(() => {
    setValue(dragon[field] != null ? String(dragon[field]) : "");
  }, [dragon[field]]);

  return (
    <input
      type="number"
      inputMode="numeric"
      className="w-20 rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 text-right text-sm text-neutral-100 focus:border-violet-500 focus:outline-none"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value === "") return;
        const num = Number(value);
        if (!Number.isFinite(num)) return;
        void updateStats({ id: dragon._id, [field]: num });
      }}
    />
  );
}

export function DragonStatsAdmin() {
  const rows = useQuery(api.dragons.list);
  const sorted = [...(rows ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const [selectedId, setSelectedId] = useState<Doc<"dragons">["_id"] | null>(null);

  const selected = sorted.find((d) => d._id === selectedId) ?? null;
  if (selected) return <DragonDetail dragon={selected} onBack={() => setSelectedId(null)} />;

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <AdminNav current="/admin/dragon-stats" />
      <h1 className="mb-1 text-xl font-bold">Dragon base stats</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Values save on blur. Blank = leave unset. Click a name to open the star/level/habit calculator.
      </p>

      {rows === undefined ? (
        <p className="text-neutral-500">Loading…</p>
      ) : (
        <table className="border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-neutral-500">
              <th className="px-2 py-1">Name</th>
              <th className="px-2 py-1">Rarity</th>
              <th className="px-2 py-1">Breed</th>
              {STAT_FIELDS.map((f) => (
                <th key={f.key} className="px-2 py-1 text-right">{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => (
              <tr key={d._id} className="border-b border-neutral-900 hover:bg-neutral-900/60">
                <td className="px-2 py-1 font-medium">
                  <button className="underline-offset-2 hover:underline" onClick={() => setSelectedId(d._id)}>
                    {d.name}
                  </button>
                </td>
                <td className="px-2 py-1 text-neutral-400">{d.rarity}</td>
                <td className="px-2 py-1 text-neutral-400">{d.breed}</td>
                {STAT_FIELDS.map((f) => (
                  <td key={f.key} className="px-2 py-1">
                    <StatInput dragon={d} field={f.key} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
