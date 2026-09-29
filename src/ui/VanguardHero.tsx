import type { DamageType, Dragon, VanguardSkill } from "./types";
import { BreedChip, Button, DamageChip, Eyebrow, RarityBadge, RoleChip } from "./Chips";
import { DragonImage } from "./DragonArt";
import { Icon } from "./Icon";
import { DAMAGE_LABEL, SLOT_LABEL, cx, fmtInt, rarityInk, rarityVar } from "./format";

export interface VanguardHeroProps {
  dragon: Dragon;
  skill: VanguardSkill;
  /** Damage type the flank buff needs; null = any dealer benefits. */
  flankDamage: DamageType | null;
  onChange?: () => void;
  onShowSkills?: () => void;
  compact?: boolean;
}

/** The chosen Vanguard: hero art, identity, and its Vanguard skill (self buff + which flank it buffs). */
export function VanguardHero({ dragon, skill, flankDamage, onChange, onShowSkills, compact }: VanguardHeroProps) {
  return (
    <section
      className="@container relative overflow-hidden rounded-lg border bg-surface"
      style={{ borderColor: `color-mix(in srgb, ${rarityVar(dragon.rarity)} 45%, var(--line))` }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(70% 90% at 22% 40%, color-mix(in srgb, ${rarityVar(dragon.rarity)} 20%, transparent), transparent 70%)` }}
      />
      <div className={cx("relative grid", compact ? "grid-cols-[120px_1fr]" : "grid-cols-1 @[520px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]")}>
        <DragonImage dragon={dragon} kind="hero" className={cx(compact ? "h-full min-h-[120px]" : "h-[170px] @[520px]:h-full @[520px]:min-h-[210px]")} imgClass="object-cover object-left" />
        <div className="flex min-w-0 flex-col gap-3 p-4">
          <div>
            <Eyebrow>Vanguard · middle lane</Eyebrow>
            <div className="mt-1 flex items-baseline gap-2">
              <h2 className="font-display text-[28px] font-semibold leading-8" style={{ color: rarityInk(dragon.rarity) }}>
                {dragon.name}
              </h2>
              <span className="tnum text-sm text-ink-muted">{fmtInt(dragon.power)}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <RarityBadge rarity={dragon.rarity} />
              <RoleChip role={dragon.role} />
              <BreedChip breed={dragon.breed} />
              <DamageChip type={dragon.damageType} />
            </div>
          </div>
          <dl className="grid gap-2 text-sm">
            <div className="rounded-md border border-line bg-surface-sunken px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Self buff</dt>
              <dd className="mt-0.5 text-ink">{skill.selfText}</dd>
            </div>
            <div className="rounded-md border border-line-strong bg-surface-sunken px-3 py-2">
              <dt className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                {skill.flankPos === "left" && <Icon name="arrow" size={12} className="rotate-180" />}
                Buffs the {SLOT_LABEL[skill.flankPos]}
                {skill.flankPos === "right" && <Icon name="arrow" size={12} />}
              </dt>
              <dd className="mt-0.5 text-ink">{skill.flankText}</dd>
              <dd className="mt-1 text-xs text-ink-muted">
                {flankDamage ? (
                  <>Wasted unless that flank deals <span style={{ color: `var(--dmg-${flankDamage})` }}>{DAMAGE_LABEL[flankDamage]}</span> damage.</>
                ) : (
                  <>Any dragon on that flank benefits.</>
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-auto flex flex-wrap gap-2">
            {onChange && (
              <Button size="sm" onClick={onChange}>
                <Icon name="swap" size={14} /> Change Vanguard
              </Button>
            )}
            {onShowSkills && (
              <Button size="sm" variant="ghost" onClick={onShowSkills}>
                Command &amp; habits
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
