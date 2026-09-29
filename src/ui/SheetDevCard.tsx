import { SHEET_WEIGHTS, STAT_LABEL, troopLabel, type SheetRating } from "../engine/sheetRating";
import { SLOT_LABEL, fmtInt } from "./format";

function n(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(v)) return "—";
  const p = 10 ** digits;
  const r = Math.round(v * p) / p;
  return Number.isInteger(r) ? fmtInt(r) : r.toFixed(digits);
}

function signed(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  const t = n(v);
  return v > 0 ? `+${t}` : t;
}

function pctOf(part: number | null, whole: number | null): string {
  if (part == null || whole == null || whole === 0) return "—";
  return `${((part / whole) * 100).toFixed(1)}`;
}

const cell = "px-2 py-1 text-right tabular-nums";
const label = "px-2 py-1 text-left text-ink-muted";

/**
 * Dev preview of the sheet-stat formation rating. It does not feed the
 * score, structural bonuses, or habit synergy shown above it.
 */
export function SheetDevCard({ rating }: { rating: SheetRating }) {
  return (
    <div id="sheet-dev-card" className="space-y-4 text-xs leading-5">
      <p className="text-ink-muted">
        Preview only. This does not change the score above. Sheet stats are the ★1 base times star-rank growth.
        Reign level and habit level stay out of the four stats. The formation fields one troop. A dragon with + affinity
        for that troop gets +20% on all four stats before combat buffs, and percent buffs then scale off that larger sheet.
        A − or neutral affinity does not change the stats. A raw bonus is added as written. Strength only raises Physical
        offense, Instinct only raises Tactical offense, and Intelligence only raises Fire offense. The other three jobs —
        Instinct lowers Physical damage taken, Intelligence lowers Tactical damage taken, Initiative lowers Fire damage
        taken and sets turn order — apply to every dragon.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Sheet" value={n(rating.sheetScore)} sub={rating.sheetIndex == null ? "no ceiling" : `${pctOf(rating.sheetScore, rating.ceiling)} of ceiling`} />
        <Figure label="Own buffs" value={n(rating.selfScore)} sub={`${signed(rating.selfScore - rating.sheetScore)} from themselves`} />
        <Figure label="Formation" value={n(rating.fullScore)} sub={rating.index == null ? "no ceiling" : `${pctOf(rating.fullScore, rating.ceiling)} of ceiling`} />
        <Figure label="From teammates" value={signed(rating.synergy)} sub="formation − own buffs" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-line bg-surface-sunken p-3">
          <div className="font-semibold text-ink">Roster T-score</div>
          <p className="mt-1 text-ink-muted">
            50 + 10 × (this formation’s average dragon − roster mean) / roster SD. The roster is every dragon with at least one
            ★1 base, scored with no lane weights, no troop, and no buffs. This formation’s plain number includes the +20%
            for dragons that match the troop. 50 is average. Buffed T can sit well above 50 because buffs are not in the roster.
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
            <dt className="text-ink-muted">Sheet T</dt>
            <dd className="text-right font-semibold tabular-nums">{n(rating.sheetT)}</dd>
            <dt className="text-ink-muted">Buffed T</dt>
            <dd className="text-right font-semibold tabular-nums">{n(rating.buffedT)}</dd>
            <dt className="text-ink-muted">Roster mean / SD / n</dt>
            <dd className="text-right tabular-nums">{n(rating.rosterMean)} / {n(rating.rosterSd)} / {rating.rosterN}</dd>
            <dt className="text-ink-muted">This formation, plain</dt>
            <dd className="text-right tabular-nums">{n(rating.seatedPlainSheet)} → {n(rating.seatedPlainFull)}</dd>
          </dl>
        </div>
        <div className="rounded-md border border-line bg-surface-sunken p-3">
          <div className="font-semibold text-ink">Weights</div>
          <p className="mt-1 text-ink-muted">
            Flank offense ×{SHEET_WEIGHTS.flankOffense}, Vanguard offense ×{SHEET_WEIGHTS.vanguardOffense}. Defense weight is
            {" "}×{SHEET_WEIGHTS.flankDefense} on a flank and ×{SHEET_WEIGHTS.vanguardDefense} in the Vanguard, split across the
            three defense stats. Turn order is Initiative ×{SHEET_WEIGHTS.turnOrder}, on top of Fire defense.
          </p>
          <p className="mt-2 text-ink-muted">{rating.ceilingNote}</p>
          {rating.ceiling != null && <p className="mt-1 tabular-nums text-ink">Ceiling {n(rating.ceiling)}</p>}
        </div>
      </div>

      <TroopBox rating={rating} />

      {rating.dragons.map((d) => (
        <div key={d.dragon.id} className="rounded-md border border-line">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-3 py-2">
            <div>
              <span className="font-semibold text-ink">{d.dragon.name}</span>
              <span className="text-ink-muted"> · {SLOT_LABEL[d.lane]} · {d.dragon.damageType}</span>
              <span className="text-ink-muted"> · {d.boosted ? `+20% ${troopLabel(rating.troop.troop)}` : `no ${troopLabel(rating.troop.troop)} bonus`}</span>
            </div>
            <div className="tabular-nums text-ink">
              sheet {n(d.sheetScore)} · own {n(d.selfScore)} · full {n(d.fullScore)}
            </div>
          </div>
          <div className="px-3 py-2 text-ink-muted">
            {d.growthLabel}. {d.offenseNote}
            {d.gaps.length > 0 && <span className="text-neg"> {d.gaps.join(". ")}.</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="border-y border-line text-ink-faint">
                  <th className={label}>Stat</th>
                  <th className={cell}>Base</th>
                  <th className={cell}>Sheet</th>
                  <th className={cell}>After affinity</th>
                  <th className={cell}>Own buffs</th>
                  <th className={cell}>Formation</th>
                  <th className={cell}>Teammates</th>
                </tr>
              </thead>
              <tbody>
                {d.stats.map((s) => (
                  <tr key={s.stat} className="border-b border-line/70">
                    <td className={label}>{STAT_LABEL[s.stat]}</td>
                    <td className={cell}>{n(s.base, 0)}</td>
                    <td className={cell}>{n(s.sheet, 0)}</td>
                    <td className={cell}>{n(s.afterAffinity)}</td>
                    <td className={cell}>{n(s.self)}</td>
                    <td className={cell}>{n(s.full)}</td>
                    <td className={cell}>{s.full != null && s.self != null ? signed(s.full - s.self) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="border-b border-line text-ink-faint">
                  <th className={label}>Axis</th>
                  <th className={cell}>Weight</th>
                  <th className={cell}>With troop</th>
                  <th className={cell}>Own</th>
                  <th className={cell}>Full</th>
                  <th className={`${label} text-right`}>How full is reached</th>
                </tr>
              </thead>
              <tbody>
                {d.axes.map((a) => (
                  <tr key={a.label} className="border-b border-line/70">
                    <td className={label}>{a.label}</td>
                    <td className={cell}>{n(a.weight, 2)}</td>
                    <td className={cell}>{n(a.sheetPoints)}</td>
                    <td className={cell}>{n(a.selfPoints)}</td>
                    <td className={cell}>{n(a.fullPoints)}</td>
                    <td className="px-2 py-1 text-right text-ink-muted">{a.math}</td>
                  </tr>
                ))}
                <tr>
                  <td className="px-2 py-1 font-semibold">Dragon total</td>
                  <td />
                  <td className={`${cell} font-semibold`}>{n(d.sheetScore)}</td>
                  <td className={`${cell} font-semibold`}>{n(d.selfScore)}</td>
                  <td className={`${cell} font-semibold`}>{n(d.fullScore)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div>
        <div className="mb-1 font-semibold text-ink">10 rounds</div>
        <p className="mb-2 text-ink-muted">Formation total each round. A buff that is up half the time moves that round halfway.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-y border-line text-ink-faint">
                <th className={label}>Layer</th>
                {rating.rounds.map((_, i) => (
                  <th key={i} className={cell}>{i + 1}</th>
                ))}
                <th className={cell}>Avg</th>
              </tr>
            </thead>
            <tbody>
              {(["sheet", "self", "full"] as const).map((layer) => (
                <tr key={layer} className="border-b border-line/70">
                  <td className={label}>{layer === "sheet" ? "Sheet" : layer === "self" ? "Own buffs" : "Formation"}</td>
                  {rating.rounds.map((r, i) => (
                    <td key={i} className={cell}>{n(r[layer], 0)}</td>
                  ))}
                  <td className={`${cell} font-semibold`}>{n(layer === "sheet" ? rating.sheetScore : layer === "self" ? rating.selfScore : rating.fullScore, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="mb-1 font-semibold text-ink">Buffs that touch these stats ({rating.modifiers.length})</div>
        {rating.modifiers.length === 0 ? (
          <p className="text-ink-muted">None. Habit clauses may still be loading, or nothing seated changes these four stats.</p>
        ) : (
          <div className="max-h-80 overflow-auto rounded-md border border-line">
            <table className="w-full min-w-[720px]">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-line text-ink-faint">
                  <th className={label}>Source</th>
                  <th className={label}>Lands on</th>
                  <th className={cell}>Up</th>
                  <th className={label}>Effect</th>
                  <th className={label}>Math</th>
                </tr>
              </thead>
              <tbody>
                {rating.modifiers.map((m, i) => (
                  <tr key={i} className="border-b border-line/70 align-top">
                    <td className={label}>{m.source} · {m.skill}{m.self ? " · own" : ""}</td>
                    <td className={label}>{m.landsOn}</td>
                    <td className={cell}>{(m.uptime * 100).toFixed(0)}%</td>
                    <td className="px-2 py-1">{m.effect}</td>
                    <td className="px-2 py-1 text-ink-muted">
                      {m.math}
                      {m.assumption ? ` (${m.assumption})` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rating.omitted.length > 0 && (
        <p className="text-ink-faint">
          Left out of the stat math: {rating.omitted.map((o) => `${o.count} ${o.label}`).join(", ")}. Heals, effects, and hits do not change these four stats.
        </p>
      )}
    </div>
  );
}

function TroopBox({ rating }: { rating: SheetRating }) {
  const troop = troopLabel(rating.troop.troop);
  return (
    <div className="rounded-md border border-line bg-surface-sunken p-3">
      <div className="font-semibold text-ink">Troop · {troop}</div>
      <p className="mt-1 text-ink-muted">
        One troop for the whole formation. {troop} is the one with the highest formation score.
        Matching dragons get +{Math.round(rating.troop.bonus * 100)}% on Strength, Instinct, Intelligence, and Initiative before buffs.
      </p>
      <ul className="mt-2 space-y-0.5">
        {rating.troop.seats.map((s) => (
          <li key={s.name} className="text-ink">
            {s.name}
            <span className="text-ink-muted">
              {s.boosted ? " · + affinity · +20%" : s.affinity === "-" ? " · − affinity · no bonus" : " · neutral · no bonus"}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 text-ink-muted">Same seating under each troop</div>
      <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-4">
        {rating.troop.options.map((o) => (
          <div key={o.troop}>
            <dt className={o.troop === rating.troop.troop ? "font-semibold text-ink" : "text-ink-muted"}>{troopLabel(o.troop)}</dt>
            <dd className="tabular-nums text-ink">{n(o.fullScore)} · {o.matches} match{o.matches === 1 ? "" : "es"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Figure({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-md border border-line bg-surface-sunken px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-ink">{value}</div>
      <div className="text-ink-muted">{sub}</div>
    </div>
  );
}
