import * as React from "react";
import type { Dragon, FormationEvaluation, HabitLink, SynergyEntry } from "./types";
import { Button, Eyebrow, Pct, TroopChip } from "./Chips";
import { DragonAvatar } from "./DragonArt";
import { Icon } from "./Icon";
import { cx, fmtInt, fmtPct, fmtSigned } from "./format";

// ---------------------------------------------------------------- score math
export interface ScoreMathProps { evaluation: FormationEvaluation; emphasis: number }

/** basePower → +structural → +habit → score, and the rankScore recommendations sort by. */
export function ScoreMath({ evaluation: e, emphasis }: ScoreMathProps) {
  const sAbs = e.basePower * e.structuralPct;
  const hAbs = e.basePower * e.habitPct;
  const max = Math.max(e.score, e.rankScore) * 1.02;
  const w = (v: number) => `${Math.max(0, (v / max) * 100)}%`;
  const terms = [
    { label: "Base power", value: fmtInt(e.basePower), sub: "sum of 3 dragons", cls: "text-ink" },
    { op: "+", label: "Structural", value: fmtPct(e.structuralPct), sub: fmtSigned(sAbs), cls: "text-structural" },
    { op: "+", label: "Habit synergy", value: fmtPct(e.habitPct), sub: fmtSigned(hAbs), cls: "text-habit" },
    { op: "=", label: "Score", value: fmtInt(e.score), sub: "modeled effective power", cls: "text-score" },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:flex sm:items-end sm:gap-0">
        {terms.map((t, i) => (
          <React.Fragment key={t.label}>
            {t.op && <div className="hidden px-3 pb-5 text-xl font-light text-ink-faint sm:block">{t.op}</div>}
            <div className={cx("min-w-0", i === 3 && "sm:ml-auto sm:text-right")}>
              <Eyebrow>{t.label}</Eyebrow>
              <div className={cx("tnum text-[26px] font-semibold leading-8", t.cls)}>
                {t.value}
                {i === 3 && <span className="ml-1 text-xs font-normal text-ink-faint">est.</span>}
              </div>
              <div className="tnum text-xs text-ink-faint">{t.sub}</div>
            </div>
          </React.Fragment>
        ))}
      </div>
      <div className="mt-4 space-y-2.5" aria-hidden="true">
        <div>
          <div className="mb-1 flex justify-between text-[11px] text-ink-faint"><span>Score</span><span className="tnum">{fmtInt(e.score)}</span></div>
          <div className="flex h-4 overflow-hidden rounded-sm bg-surface-sunken">
            <div className="bg-base-bar" style={{ width: w(e.basePower) }} />
            <div className="bg-structural" style={{ width: w(sAbs) }} />
            <div className="bg-habit" style={{ width: w(hAbs) }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[11px] text-ink-faint">
            <span>Rank score at <span className="text-score">{emphasis.toFixed(2)}×</span></span>
            <span className="tnum">{fmtInt(e.rankScore)}</span>
          </div>
          <div className="flex h-4 overflow-hidden rounded-sm bg-surface-sunken">
            <div className="bg-base-bar" style={{ width: w(e.basePower) }} />
            <div className="df-hatch bg-structural" style={{ width: w(sAbs * emphasis) }} />
            <div className="df-hatch bg-habit" style={{ width: w(hAbs * emphasis) }} />
          </div>
        </div>
      </div>
      <p className="mt-3 rounded-md bg-surface-sunken px-3 py-2 font-mono text-[12px] leading-5 text-ink-muted tnum">
        score = {fmtInt(e.basePower)} × (1 + <span className="text-structural">{fmtPct(e.structuralPct, false)}</span> + <span className="text-habit">{fmtPct(e.habitPct, false)}</span>) = <span className="text-score">{fmtInt(e.score)}</span>
        <br />
        rankScore = {fmtInt(e.basePower)} × (1 + <span className="text-score">{emphasis.toFixed(2)}</span> × {fmtPct(e.bonusPct, false)}) = <span className="text-score">{fmtInt(e.rankScore)}</span>
        {emphasis === 0 && <span className="text-ink-faint"> · power only</span>}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- structural
const CATS = [
  { key: "Troop", icon: "shieldbearers" },
  { key: "Vanguard skill", icon: "crown" },
  { key: "Position", icon: "arrow" },
  { key: "Balance", icon: "tank" },
] as const;

export function groupStructural(entries: SynergyEntry[]) {
  return CATS.map((c) => {
    const items = entries
      .filter((e) => e.text.startsWith(c.key + ":"))
      .map((e) => ({ ...e, text: e.text.slice(c.key.length + 1).trim() }));
    return { ...c, items, total: items.reduce((a, e) => a + e.pct, 0) };
  });
}

/** Structural bonuses grouped by category (Troop · Vanguard skill · Position · Balance). */
export function StructuralBreakdown({ evaluation: e }: { evaluation: FormationEvaluation }) {
  const groups = groupStructural(e.structural);
  const max = Math.max(0.01, ...e.structural.map((x) => Math.abs(x.pct)));
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.key}>
          <div className="flex items-center justify-between gap-2 border-b border-line pb-1">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <Icon name={g.icon} size={13} className="text-ink-muted" /> {g.key}
              {g.key === "Troop" && <TroopChip troop={e.troopType} />}
            </span>
            <Pct value={g.total} tone={g.items.length ? "structural" : "muted"} className="text-xs font-semibold" />
          </div>
          {g.items.length ? (
            <ul className="mt-1 space-y-0.5">
              {g.items.map((it, i) => (
                <li key={i} className="grid grid-cols-[1fr_52px_48px] items-center gap-2 py-0.5 text-xs">
                  <span className="text-ink-muted">{it.text}</span>
                  <span className="h-1.5 rounded-full bg-surface-sunken">
                    <span className={cx("block h-full rounded-full", it.pct < 0 ? "bg-neg" : "bg-structural")} style={{ width: `${(Math.abs(it.pct) / max) * 100}%` }} />
                  </span>
                  <Pct value={it.pct} tone={it.pct < 0 ? "auto" : "structural"} className="text-right" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-ink-faint">None — {g.key === "Balance" ? "needs a tank and a damage dealer" : g.key === "Position" ? "no dragon is in its preferred lane" : g.key === "Vanguard skill" ? "no Vanguard placed" : "no shared affinity"}.</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- habit links
type SortKey = "pct" | "source" | "skill";
export interface HabitLinkTableProps {
  links: HabitLink[];
  dragons: Record<string, Dragon>;
  highlight?: number | null;
  onHighlight?: (i: number | null) => void;
}

/** Sortable list of habit synergy links; hover a row to light up its arrows on the board. */
export function HabitLinkTable({ links, dragons, highlight, onHighlight }: HabitLinkTableProps) {
  const [sort, setSort] = React.useState<SortKey>("pct");
  const rows = links
    .map((l, i) => ({ l, i }))
    .sort((a, b) =>
      sort === "pct" ? b.l.pct - a.l.pct : sort === "source" ? a.l.source.localeCompare(b.l.source) || b.l.pct - a.l.pct : a.l.skill.localeCompare(b.l.skill) || b.l.pct - a.l.pct,
    );
  const max = Math.max(0.001, ...links.map((l) => l.pct));
  const H = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th scope="col" className={cx("py-1.5 font-semibold", className)}>
      <button onClick={() => setSort(k)} className={cx("inline-flex items-center gap-1 cursor-pointer hover:text-ink", sort === k && "text-ink")}>
        {children} {sort === k && <Icon name="down" size={10} />}
      </button>
    </th>
  );
  if (!links.length) return <p className="py-6 text-center text-sm text-ink-muted">No habit value passes between these dragons at the current assumptions.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-xs">
        <thead className="text-[11px] uppercase tracking-[0.06em] text-ink-faint">
          <tr className="border-b border-line">
            <H k="pct" className="w-[88px]">Habit %</H>
            <H k="source">Source · skill</H>
            <th scope="col" className="py-1.5 font-semibold">→ Recipients</th>
            <th scope="col" className="py-1.5 font-semibold">Effects</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ l, i }) => {
            const src = dragons[l.source];
            return (
              <tr
                key={i}
                onMouseEnter={() => onHighlight?.(i)}
                onMouseLeave={() => onHighlight?.(null)}
                onFocus={() => onHighlight?.(i)}
                tabIndex={0}
                className={cx("border-b border-line/60 align-top transition-colors", highlight === i ? "bg-habit/10" : "hover:bg-surface-raised")}
              >
                <td className="py-1.5 pr-2">
                  <Pct value={l.pct} tone="habit" className="font-semibold" />
                  <span className="mt-1 block h-1 rounded-full bg-surface-sunken"><span className="block h-full rounded-full bg-habit" style={{ width: `${(l.pct / max) * 100}%` }} /></span>
                </td>
                <td className="py-1.5 pr-2">
                  <span className="flex items-center gap-1.5">
                    {src && <DragonAvatar dragon={src} size={20} />}
                    <span className="font-medium text-ink">{l.source}</span>
                    <span className="whitespace-nowrap rounded-sm border border-line px-1 text-[10px] text-ink-muted">{l.skill}</span>
                  </span>
                </td>
                <td className="py-1.5 pr-2 text-ink-muted">
                  {l.recipients.join(", ")}
                  {l.setUpBy && (
                    <span className="mt-0.5 block text-[11px] text-habit">
                      <Icon name="loop" size={10} className="mr-0.5 inline" /> set up by {l.setUpBy.join(" & ")}
                    </span>
                  )}
                </td>
                <td className="py-1.5">
                  <span className="flex flex-wrap gap-1">
                    {l.effects.map((ef) => (
                      <span key={ef} className={cx("rounded-sm px-1.5 py-0.5 text-[11px]", ef.startsWith("enemy") ? "bg-neg/10 text-ink-muted" : "bg-surface-hover text-ink")}>{ef}</span>
                    ))}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-2"><Pct value={links.reduce((a, l) => a + l.pct, 0)} tone="habit" est className="font-semibold" /></td>
            <td colSpan={3} className="pt-2 text-ink-faint">habit synergy total · {links.length} links</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- timeline
const TROOP_CURVE = [95, 85, 75, 65, 55, 45, 35, 25, 15, 5];

/** When each link is active across the 10 rounds (per-round uptime 0–1 from the engine). */
export function RoundTimeline({ links, highlight, onHighlight }: { links: HabitLink[]; highlight?: number | null; onHighlight?: (i: number | null) => void }) {
  const rows = links.map((l, i) => ({ l, i })).filter((r) => r.l.uptimeByRound).sort((a, b) => b.l.pct - a.l.pct);
  const perRound = Array.from({ length: 10 }, (_, r) => rows.reduce((a, { l }) => a + l.pct * (l.uptimeByRound![r] ?? 0), 0));
  const peak = Math.max(0.0001, ...perRound);
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[560px] grid-cols-[150px_repeat(10,minmax(0,1fr))] gap-x-1 gap-y-1 text-[11px]">
        <div className="text-ink-faint">Round</div>
        {TROOP_CURVE.map((_, r) => <div key={r} className="tnum text-center font-semibold text-ink-muted">R{r + 1}</div>)}
        <div className="text-ink-faint" title="Assumed troop capacity by round (engine assumption)">Troops (assumed)</div>
        {TROOP_CURVE.map((t, r) => <div key={r} className="tnum text-center text-ink-faint">{t}%</div>)}
        {rows.map(({ l, i }) => (
          <React.Fragment key={i}>
            <div
              className={cx("truncate py-0.5 pr-1", highlight === i ? "text-habit" : "text-ink-muted")}
              onMouseEnter={() => onHighlight?.(i)}
              onMouseLeave={() => onHighlight?.(null)}
              title={`${l.source} · ${l.skill} → ${l.recipients.join(", ")}`}
            >
              {l.source} · {l.skill.replace("Habit ", "H")} <span className="tnum text-ink-faint">{fmtPct(l.pct)}</span>
            </div>
            {l.uptimeByRound!.map((u, r) => (
              <div
                key={r}
                className={cx("h-4 rounded-[3px] ring-1 ring-inset", highlight === i ? "ring-habit" : "ring-line/60")}
                style={{ background: u > 0 ? `color-mix(in srgb, var(--habit) ${Math.round(u * 85)}%, var(--surface-sunken))` : "var(--surface-sunken)" }}
                title={`R${r + 1}: ${(u * 100).toFixed(0)}% uptime`}
                onMouseEnter={() => onHighlight?.(i)}
                onMouseLeave={() => onHighlight?.(null)}
              />
            ))}
          </React.Fragment>
        ))}
        <div className="pt-2 text-ink-faint">Active synergy</div>
        {perRound.map((v, r) => (
          <div key={r} className="flex h-12 flex-col justify-end pt-2" title={`R${r + 1}: ${fmtPct(v)} active`}>
            <div className="rounded-t-[3px] bg-habit/80" style={{ height: `${(v / peak) * 100}%` }} />
            <div className="tnum mt-0.5 text-center text-[10px] text-ink-faint">{(v * 100).toFixed(0)}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 flex items-center gap-3 text-[11px] text-ink-faint">
        <span className="inline-flex items-center gap-1"><span className="size-3 rounded-[3px] bg-surface-sunken ring-1 ring-line" /> 0%</span>
        <span className="inline-flex items-center gap-1"><span className="size-3 rounded-[3px]" style={{ background: "color-mix(in srgb, var(--habit) 42%, var(--surface-sunken))" }} /> 50%</span>
        <span className="inline-flex items-center gap-1"><span className="size-3 rounded-[3px]" style={{ background: "color-mix(in srgb, var(--habit) 85%, var(--surface-sunken))" }} /> 100% uptime</span>
        <span>· bottom row = Σ link % × uptime, in % pts</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- warnings
export function WarningList({ warnings, onSwap }: { warnings: string[]; onSwap?: () => void }) {
  if (!warnings.length)
    return (
      <p className="flex items-center gap-2 rounded-md bg-pos/8 px-3 py-2 text-xs text-ink-muted">
        <Icon name="check" size={14} className="text-pos" /> No warnings — the Vanguard buff, positions and balance are all used.
      </p>
    );
  return (
    <ul className="space-y-2">
      {warnings.map((w, i) => (
        <li key={i} className="flex items-start gap-2.5 rounded-md border border-neg/40 bg-neg/8 px-3 py-2.5">
          <Icon name="alert" size={15} className="mt-0.5 shrink-0 text-neg" />
          <p className="min-w-0 flex-1 text-[13px] leading-5 text-ink">{w}</p>
          {onSwap && /swap the flanks/.test(w) && (
            <Button size="sm" onClick={onSwap} className="shrink-0">
              <Icon name="swap" size={13} /> Swap flanks
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
