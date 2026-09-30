import * as React from "react";
import type { Affinity, Breed, DamageType, Rarity, Role, TroopType } from "./types";
import { Icon } from "./Icon";
import {
  BREED_ARCHETYPE, BREED_LABEL, DAMAGE_LABEL, RARITY_LABEL, ROLE_LABEL, ROLE_SHORT, TROOP_LABEL, cx, damageVar, fmtPct, rarityInk, rarityVar,
} from "./format";

const chip = "inline-flex items-center gap-1 h-5 px-1.5 rounded-sm border border-line bg-surface-sunken text-[11px] leading-none font-medium text-ink-muted whitespace-nowrap";

export function RarityBadge({ rarity, compact }: { rarity: Rarity; compact?: boolean }) {
  return (
    <span className={cx(chip, "border-transparent")} style={{ color: rarityInk(rarity), background: `color-mix(in srgb, ${rarityVar(rarity)} 14%, transparent)` }}>
      <span className="size-1.5 rounded-full" style={{ background: rarityVar(rarity) }} />
      {compact ? RARITY_LABEL[rarity][0] : RARITY_LABEL[rarity]}
    </span>
  );
}

export function RoleChip({ role, short }: { role: Role; short?: boolean }) {
  return (
    <span className={chip} title={ROLE_LABEL[role]}>
      <Icon name={role} size={12} className="text-ink" />
      {short ? ROLE_SHORT[role] : ROLE_LABEL[role]}
    </span>
  );
}

export function BreedChip({ breed, withArchetype = true }: { breed: Breed; withArchetype?: boolean }) {
  return (
    <span className={chip} title={`${BREED_LABEL[breed]} (${BREED_ARCHETYPE[breed]})`}>
      <Icon name={breed} size={12} className="text-ink" />
      {BREED_LABEL[breed]}
      {withArchetype && <span className="text-ink-faint">· {BREED_ARCHETYPE[breed]}</span>}
    </span>
  );
}

export function DamageChip({ type, dim }: { type: DamageType; dim?: boolean }) {
  return (
    <span className={cx(chip, dim && "opacity-60")} style={{ color: damageVar(type) }} title={`${DAMAGE_LABEL[type]} damage`}>
      <Icon name={`dmg-${type}`} size={12} />
      {DAMAGE_LABEL[type]}
    </span>
  );
}

export function TroopChip({ troop, label = true }: { troop: TroopType; label?: boolean }) {
  return (
    <span className={chip} title={TROOP_LABEL[troop]}>
      <Icon name={troop} size={12} className="text-ink" />
      {label && TROOP_LABEL[troop]}
    </span>
  );
}

const TROOPS: TroopType[] = ["cavalry", "shieldbearers", "archers", "spearmen"];
/** The 4 troop affinities in fixed order; + in green, − in amber, neutral faint. Optional highlight = the army's troop type. */
export function AffinityStrip({ affinity, highlight }: { affinity: Record<TroopType, Affinity>; highlight?: TroopType }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label="Troop affinity">
      {TROOPS.map((t) => {
        const a = affinity[t];
        return (
          <span
            key={t}
            title={`${TROOP_LABEL[t]}: ${a === "+" ? "positive" : a === "-" ? "negative" : "neutral"}`}
            className={cx(
              "relative inline-flex items-center justify-center size-5 rounded-sm",
              a === "+" ? "text-pos" : a === "-" ? "text-neg" : "text-ink-faint opacity-60",
              highlight === t && "bg-surface-hover ring-1 ring-line-strong",
            )}
          >
            <Icon name={t} size={12} />
            {a !== 0 && <span className="absolute -top-0.5 -right-0.5 text-[9px] font-semibold leading-none">{a === "+" ? "+" : "−"}</span>}
          </span>
        );
      })}
    </span>
  );
}

/** A modeled-estimate percentage. tone: habit (sky), structural (neutral), score (violet), auto (green/amber by sign). */
export function Pct({ value, tone = "auto", est, className }: { value: number; tone?: "auto" | "habit" | "structural" | "score" | "muted"; est?: boolean; className?: string }) {
  const color =
    tone === "habit" ? "text-habit" : tone === "structural" ? "text-structural" : tone === "score" ? "text-score" : tone === "muted" ? "text-ink-muted" : value < 0 ? "text-neg" : "text-pos";
  return (
    <span className={cx("tnum whitespace-nowrap", color, className)}>
      {fmtPct(value)}
      {est && <span className="ml-0.5 text-[0.8em] font-normal text-ink-faint">est.</span>}
    </span>
  );
}

/** Small uppercase label used above numbers and panel headings. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint", className)}>{children}</div>;
}

export function Panel({ title, aside, children, className, bodyClass }: { title?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cx("rounded-lg border border-line bg-surface", className)}>
      {(title || aside) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
          <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.08em] text-ink">{title}</h2>
          {aside}
        </header>
      )}
      <div className={cx("px-4 pb-4", bodyClass)}>{children}</div>
    </section>
  );
}

export function Button({ variant = "quiet", size = "md", className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" | "ghost"; size?: "sm" | "md" }) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
        variant === "primary" && "bg-ink text-on-ink hover:bg-parchment-hover",
        variant === "quiet" && "border border-line-strong bg-surface-raised text-ink hover:bg-surface-hover",
        variant === "ghost" && "text-ink-muted hover:text-ink hover:bg-surface-hover",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Segmented control (radio group). */
export function Segmented<T extends string | number>({ value, options, onChange, label, size = "md" }: { value: T; options: { value: T; label: React.ReactNode; title?: string }[]; onChange: (v: T) => void; label: string; size?: "sm" | "md" }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line-strong bg-surface-sunken p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-[5px] font-medium transition-colors cursor-pointer tnum",
            size === "sm" ? "h-6 min-w-6 px-1.5 text-xs" : "h-7 px-2.5 text-xs",
            o.value === value ? "bg-surface-hover text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]" : "text-ink-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, onText = "Active", offText = "Benched" }: { checked: boolean; onChange: (v: boolean) => void; label: string; onText?: string; offText?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-1.5 text-xs text-ink-muted cursor-pointer"
    >
      <span className={cx("relative h-4 w-7 rounded-full border transition-colors", checked ? "bg-pos/25 border-pos" : "bg-surface-sunken border-line-strong")}>
        <span className={cx("absolute top-[1px] size-3 rounded-full transition-all", checked ? "left-[13px] bg-pos" : "left-[1px] bg-ink-faint")} />
      </span>
      <span className="w-12 text-left">{checked ? onText : offText}</span>
    </button>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-surface-raised", className)} />;
}
