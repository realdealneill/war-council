import * as React from "react";
import type { Controls, Dragon, SkillSummary } from "./types";
import { BreedChip, DamageChip, RarityBadge, RoleChip } from "./Chips";
import { DragonAvatar } from "./DragonArt";
import { Icon } from "./Icon";
import { cx, fmtInt, rarityInk } from "./format";

const UNLOCK = [2, 4, 6, 8, 10];

export interface SkillDetailProps {
  dragon: Dragon;
  skills: SkillSummary[];
  controls: Pick<Controls, "habitAssumption" | "habitLevel">;
  onClose: () => void;
}

/** Command + 5 Habits, each as plain-English clauses; lock state follows the habit assumption. */
export function SkillDetail({ dragon, skills, controls, onClose }: SkillDetailProps) {
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${dragon.name} skills`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-t-xl border border-line-strong bg-surface shadow-drawer sm:rounded-xl"
      >
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
          <DragonAvatar dragon={dragon} size={40} />
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-semibold leading-6" style={{ color: rarityInk(dragon.rarity) }}>{dragon.name}</div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              <RarityBadge rarity={dragon.rarity} />
              <RoleChip role={dragon.role} short />
              <BreedChip breed={dragon.breed} withArchetype={false} />
              <DamageChip type={dragon.damageType} />
              <span className="tnum text-[11px] leading-5 text-ink-muted">★{dragon.starRank} · {fmtInt(dragon.power)}</span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-muted hover:bg-surface-hover hover:text-ink cursor-pointer" aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
        <p className="px-4 pt-3 text-[11px] text-ink-faint">
          Shown at habit level {controls.habitLevel} · {controls.habitAssumption === "all" ? "all 5 habits assumed unlocked" : `habits unlocked by star rank (★${dragon.starRank})`}
        </p>
        <ol className="space-y-2 p-4">
          {skills.map((s) => {
            const locked = s.habitSlot > 0 && controls.habitAssumption === "stars" && dragon.starRank < UNLOCK[s.habitSlot - 1];
            return (
              <li key={s.habitSlot} className={cx("rounded-md border border-line bg-surface-raised p-3", locked && "opacity-55")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">
                    {s.habitSlot === 0 ? "Command" : `Habit ${s.habitSlot}`}
                    {s.habitSlot > 0 && <span className="ml-1.5 text-xs font-normal text-ink-faint">★{UNLOCK[s.habitSlot - 1]}</span>}
                  </span>
                  {s.habitSlot === 0 ? (
                    <span className="text-[11px] text-ink-faint">always active</span>
                  ) : locked ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint"><Icon name="lock" size={11} /> locked at ★{dragon.starRank}</span>
                  ) : (
                    <span className="tnum text-[11px] text-ink-muted">Lv {controls.habitLevel}</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-ink-muted">{s.shortText}</p>
                <ul className="mt-2 space-y-1">
                  {s.clauses.map((c, i) => (
                    <li key={i} className="flex gap-2 text-[12.5px] leading-5 text-ink">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-ink-faint" />
                      {c}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
