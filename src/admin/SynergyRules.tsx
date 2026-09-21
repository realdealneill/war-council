import { DRAGON_KITS } from "../data";
import { AdminNav } from "../components/AdminNav";
import { DEFENSE_WEIGHT } from "../engine/power";
import { SYNERGY_WEIGHTS } from "../engine/scoring";
import type { EffectId } from "../types";

function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
}

function effects(list: EffectId[]): string {
  return list.length ? list.join(", ") : "—";
}

const SCALAR_WEIGHTS: { key: keyof typeof SYNERGY_WEIGHTS; label: string; note: string; negative?: boolean }[] = [
  { key: "affinityBonus", label: "Affinity bonus", note: "Per dragon with + affinity for the chosen troop type" },
  { key: "affinityPenalty", label: "Affinity penalty", note: "Per dragon with − affinity", negative: true },
  { key: "affinityStackPerExtra", label: "Affinity stack (per extra dragon)", note: "2 dragons with + affinity = ×1, 3 = ×2" },
  { key: "matchupBonus", label: "Troop matchup bonus", note: "Chosen troop beats the named enemy troop" },
  { key: "matchupPenalty", label: "Troop matchup penalty", note: "Chosen troop loses to the named enemy troop", negative: true },
  { key: "mitigationValue", label: "Mitigation value", note: "How much a Vanguard mitigation buff counts, relative to raw damage" },
  { key: "recoveryValue", label: "Recovery value", note: "How much a Vanguard recovery buff counts" },
  { key: "statPointValue", label: "Stat point value", note: "Value of +1 to a raw stat (e.g. Instinct) from a Vanguard buff" },
  { key: "positionFitRightPhysical", label: "Right Flank fit", note: "Physical DPS correctly on the Right Flank" },
  { key: "positionFitLeftSupport", label: "Left Flank fit", note: "Tactical/Fire/Healer correctly on the Left Flank" },
  { key: "positionFitVanguardTank", label: "Vanguard fit", note: "Tank correctly in the Vanguard" },
  { key: "wantValueDefault", label: "Want value (default)", note: "Fallback for any effect not in the table below" },
  { key: "tauntSustain", label: "Taunt + sustain", note: "A taunting dragon plus any sustain on the team" },
  { key: "advantageGiverPerDealer", label: "Advantage giver (per dealer)", note: "Per DPS dragon, when someone grants Advantage" },
  { key: "softenerPerCount", label: "Softener (per count)", note: "Per softening dragon, per DPS dragon present" },
  { key: "controlStack", label: "Control stack", note: "2+ dragons applying Stun/Overwhelm/Confusion" },
  { key: "risingTideNeedsMet", label: "Scales with sustain", note: "A Mirage/Double Strike/Rising Tide dragon, with team sustain" },
  { key: "risingTideThresholdMet", label: "Rising Tide thresholds met", note: "A Rising Tide dragon whose every \"want\" is met" },
  { key: "balancedCore", label: "Balanced core", note: "At least one tank + one damage dealer" },
  { key: "dpsFocusPerDealer", label: "DPS focus (per dealer)", note: "\"Anti-Army DPS\" goal, per damage dealer" },
  { key: "offensiveKitPerAmplifier", label: "Offensive kit (per amplifier)", note: "\"Anti-Army DPS\" goal, per damage-amplifying dragon" },
  { key: "synergyNoPassenger", label: "No passenger", note: "\"Dragon Synergy\" goal: every dragon linked into the others' kits" },
];

export function SynergyRules() {
  const kitRows = Object.entries(DRAGON_KITS)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([name, kit]) => kit.effects.map((e) => ({ name, ...e })));

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <AdminNav current="/admin/synergy-rules" />
      <h1 className="mb-1 text-xl font-bold">Synergy scoring rules</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Read-only: these are the live weights the app actually
        scores with (src/engine/scoring.ts's SYNERGY_WEIGHTS) and the kit data that feeds them
        (src/data/generated/kits.json) — not a separate copy. To change one, say which and to what.
      </p>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-neutral-200">Defense weight (by goal)</h2>
        <p className="mb-2 text-xs text-neutral-500">
          Multiplies every mitigation/recovery/taunt/balanced-core bonus above — how much survivability is
          worth for that goal.
        </p>
        <table className="mb-2 text-sm">
          <tbody>
            {Object.entries(DEFENSE_WEIGHT).map(([goal, w]) => (
              <tr key={goal} className="border-b border-neutral-900">
                <td className="py-1 pr-6 text-neutral-400">{goal}</td>
                <td className="py-1 font-mono">{w.toFixed(2)}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-neutral-200">Scoring weights</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-neutral-500">
              <th className="py-1 pr-4">Rule</th>
              <th className="py-1 pr-4 text-right">Weight</th>
              <th className="py-1">What it means</th>
            </tr>
          </thead>
          <tbody>
            {SCALAR_WEIGHTS.map(({ key, label, note, negative }) => (
              <tr key={key} className="border-b border-neutral-900">
                <td className="py-1 pr-4">{label}</td>
                <td className={`py-1 pr-4 text-right font-mono ${negative ? "text-red-400" : "text-violet-300"}`}>
                  {pct((negative ? -1 : 1) * (SYNERGY_WEIGHTS[key] as number))}
                </td>
                <td className="py-1 text-neutral-500">{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-neutral-200">Want value (per effect)</h2>
        <p className="mb-2 text-xs text-neutral-500">
          Value of a dragon's "want" being satisfied by a teammate, by effect. Anything not listed falls
          back to Want value (default) above.
        </p>
        <table className="text-sm">
          <tbody>
            {Object.entries(SYNERGY_WEIGHTS.wantValue).map(([effect, w]) => (
              <tr key={effect} className="border-b border-neutral-900">
                <td className="py-1 pr-6 text-neutral-400">{effect}</td>
                <td className="py-1 font-mono text-violet-300">{pct(w)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-neutral-200">Synergy emphasis (ranking, by goal)</h2>
        <p className="mb-2 text-xs text-neutral-500">
          How much more heavily each goal weighs the synergy bonus vs. raw power when ranking armies. The
          effective power shown to you (score) always uses the true, unweighted bonus.
        </p>
        <table className="text-sm">
          <tbody>
            {Object.entries(SYNERGY_WEIGHTS.synergyEmphasis).map(([goal, w]) => (
              <tr key={goal} className="border-b border-neutral-900">
                <td className="py-1 pr-6 text-neutral-400">{goal}</td>
                <td className="py-1 font-mono">{w.toFixed(1)}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-200">Per-dragon kit effects (by star rank)</h2>
        <p className="mb-2 text-xs text-neutral-500">
          Each row is one unlock tier from a dragon's kit — applies (to enemies), grants (to allies), self,
          and wants (what it needs from a teammate). A dragon only has what's unlocked at its current star
          rank (rows with star ≤ its rank).
        </p>
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-neutral-950">
              <tr className="border-b border-neutral-800 text-left text-neutral-500">
                <th className="py-1 pr-4">Dragon</th>
                <th className="py-1 pr-4">★</th>
                <th className="py-1 pr-4">Source</th>
                <th className="py-1 pr-4">Applies</th>
                <th className="py-1 pr-4">Grants</th>
                <th className="py-1 pr-4">Self</th>
                <th className="py-1">Wants</th>
              </tr>
            </thead>
            <tbody>
              {kitRows.map((r, i) => (
                <tr key={i} className="border-b border-neutral-900">
                  <td className="py-1 pr-4 font-medium">{r.name}</td>
                  <td className="py-1 pr-4 text-neutral-400">{r.star}</td>
                  <td className="py-1 pr-4 text-neutral-500">{r.source}</td>
                  <td className="py-1 pr-4 text-amber-300">{effects(r.applies)}</td>
                  <td className="py-1 pr-4 text-emerald-300">{effects(r.grants)}</td>
                  <td className="py-1 pr-4 text-sky-300">{effects(r.self)}</td>
                  <td className="py-1 text-violet-300">{effects(r.wants)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
