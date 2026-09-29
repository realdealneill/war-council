import * as React from "react";
import type { DamageType, Dragon, Rarity, Role, VanguardSkill } from "./types";
import { Button, DamageChip, RoleChip, Segmented } from "./Chips";
import { DragonImage } from "./DragonArt";
import { Icon } from "./Icon";
import { DAMAGE_LABEL, SLOT_LABEL, cx, fmtInt, rarityInk, rarityVar } from "./format";

export interface VanguardPickerProps {
  dragons: Dragon[]; // active roster dragons
  skillOf: (d: Dragon) => VanguardSkill;
  flankDamageOf: (d: Dragon) => DamageType | null;
  isRecommended: (d: Dragon) => boolean;
  onPick: (d: Dragon) => void;
  onCancel?: () => void;
  currentId?: string | null;
}

const RARITY_ORDER: Record<Rarity, number> = { mythic: 0, legendary: 1, epic: 2, rare: 3 };

/** Fills the main view when no Vanguard is chosen. Tanks and Champions carry ★ Recommended for Vanguard. */
export function VanguardPicker({ dragons, skillOf, flankDamageOf, isRecommended, onPick, onCancel, currentId }: VanguardPickerProps) {
  const [q, setQ] = React.useState("");
  const [only, setOnly] = React.useState<"rec" | "all">("rec");
  const [role, setRole] = React.useState<Role | "any">("any");
  const list = dragons
    .filter((d) => (only === "all" || isRecommended(d)) && (role === "any" || d.role === role) && d.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(isRecommended(b)) - Number(isRecommended(a)) || RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || b.power - a.power);
  const recCount = dragons.filter(isRecommended).length;
  return (
    <section className="rounded-lg border border-line bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Step 1 of 2</div>
          <h1 className="mt-1 font-display text-[28px] font-semibold leading-8 text-ink">Choose your Vanguard</h1>
          <p className="mt-2 text-sm leading-5 text-ink-muted">
            The Vanguard holds the middle lane. Its Vanguard skill buffs itself and one flank — pick it first and the builder recommends the best two flanks around it.
          </p>
        </div>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <Icon name="x" size={14} /> Keep current Vanguard
          </Button>
        )}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Segmented
          label="Which dragons"
          value={only}
          onChange={setOnly}
          options={[
            { value: "rec", label: <span className="inline-flex items-center gap-1"><Icon name="star" size={12} filled className="text-rarity-legendary-ink" /> Recommended ({recCount})</span> },
            { value: "all", label: `All active (${dragons.length})` },
          ]}
        />
        <Segmented
          label="Role"
          value={role}
          onChange={setRole}
          options={[{ value: "any" as const, label: "Any role" }, ...(["tank", "physical", "tactical", "fire", "healer", "control"] as Role[]).map((r) => ({ value: r, label: <Icon name={r} size={14} />, title: r }))]}
        />
        <label className="relative ml-auto w-full sm:w-56">
          <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search dragons"
            className="h-9 w-full rounded-md border border-line-strong bg-surface-sunken pl-8 pr-3 text-sm text-ink placeholder:text-ink-faint"
          />
        </label>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(188px,1fr))]">
        {list.map((d) => {
          const s = skillOf(d);
          const need = flankDamageOf(d);
          const rec = isRecommended(d);
          return (
            <button
              key={d.id}
              onClick={() => onPick(d)}
              className={cx(
                "group relative flex flex-col overflow-hidden rounded-lg border bg-surface-raised text-left transition hover:-translate-y-0.5 hover:bg-surface-hover cursor-pointer",
                currentId === d.id && "ring-2 ring-focus",
              )}
              style={{ borderColor: `color-mix(in srgb, ${rarityVar(d.rarity)} 55%, var(--line))` }}
            >
              <DragonImage dragon={d} kind="portrait" className="aspect-[474/400] w-full" />
              {rec && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-sm bg-bg/85 px-1.5 py-0.5 text-[11px] font-semibold text-rarity-legendary-ink backdrop-blur">
                  <Icon name="star" size={11} filled /> Recommended
                </span>
              )}
              <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-display text-base font-semibold" style={{ color: rarityInk(d.rarity) }}>{d.name}</span>
                  <span className="tnum text-xs text-ink-muted">{fmtInt(d.power)}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <RoleChip role={d.role} short />
                  <DamageChip type={d.damageType} />
                </div>
                <div className="mt-1 border-t border-line pt-1.5 text-[11px] leading-4 text-ink-muted">
                  <div><span className="text-ink-faint">Self</span> {s.selfText}</div>
                  <div>
                    <span className="text-ink-faint">{SLOT_LABEL[s.flankPos]}</span> {s.flankText}
                    {need && <span style={{ color: `var(--dmg-${need})` }}> · {DAMAGE_LABEL[need]} only</span>}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
        {!list.length && <p className="col-span-full py-10 text-center text-sm text-ink-muted">No dragons match. Try “All active” or clear the search.</p>}
      </div>
    </section>
  );
}
