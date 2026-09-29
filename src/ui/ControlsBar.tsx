import type { Controls } from "./types";
import { Icon } from "./Icon";
import { Segmented } from "./Chips";
import { cx } from "./format";

const STOPS = [
  { v: 0, label: "Power only" },
  { v: 1, label: "Face value" },
  { v: 3, label: "Synergy-first" },
];

function modeLabel(v: number) {
  if (v === 0) return "power only";
  if (v < 1) return "leaning power";
  if (v === 1) return "synergy at face value";
  if (v < 3) return "leaning synergy";
  return "synergy-first";
}

/** The primary control: how much synergy counts against raw power when ranking. 0–3×, step 0.25. */
export function EmphasisSlider({ value, onChange, className }: { value: number; onChange: (v: number) => void; className?: string }) {
  const pct = (value / 3) * 100;
  return (
    <div className={cx("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor="emphasis" className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
          Synergy emphasis
        </label>
        <span className="flex items-baseline gap-1.5">
          <span className="whitespace-nowrap text-[11px] text-ink-muted">{modeLabel(value)}</span>
          <span className="tnum text-sm font-semibold text-score">{value.toFixed(2)}×</span>
        </span>
      </div>
      <div className="relative mt-1.5 h-5">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-sunken ring-1 ring-line" />
        <div className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-score/70" style={{ width: `${pct}%` }} />
        {Array.from({ length: 13 }, (_, i) => (
          <span key={i} className={cx("absolute top-1/2 w-px -translate-y-1/2 bg-line-strong", i % 4 === 0 ? "h-3" : "h-1.5 opacity-60")} style={{ left: `${(i / 12) * 100}%` }} />
        ))}
        <input
          id="emphasis"
          type="range"
          min={0}
          max={3}
          step={0.25}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="df-range absolute inset-0 w-full cursor-pointer"
          aria-valuetext={`${value.toFixed(2)} times`}
        />
      </div>
      <div className="relative mt-1 h-4 text-[11px] text-ink-faint">
        {STOPS.map((s) => (
          <button
            key={s.v}
            onClick={() => onChange(s.v)}
            title={s.label}
            className={cx("absolute whitespace-nowrap tnum hover:text-ink cursor-pointer", s.v === value && "text-ink", s.v === 0 ? "left-0" : s.v === 3 ? "right-0" : "-translate-x-1/2")}
            style={s.v === 1 ? { left: `${100 / 3}%` } : undefined}
          >
            {s.v}×
          </button>
        ))}
      </div>
    </div>
  );
}

/** Global controls: emphasis (primary) + habit assumptions. Always reachable from the header. */
export function ControlsBar({ controls, onChange, layout = "row" }: { controls: Controls; onChange: (c: Controls) => void; layout?: "row" | "stack" }) {
  const set = (p: Partial<Controls>) => onChange({ ...controls, ...p });
  return (
    <div className={cx("flex gap-x-6 gap-y-3", layout === "row" ? "flex-wrap items-end" : "flex-col")}>
      <EmphasisSlider value={controls.emphasis} onChange={(emphasis) => set({ emphasis })} className={layout === "row" ? "w-[340px]" : "w-full"} />
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Assumed habits</div>
          <Segmented
            label="Assumed habits"
            value={controls.habitAssumption}
            onChange={(habitAssumption) => set({ habitAssumption })}
            options={[
              { value: "all", label: "All 5 unlocked" },
              { value: "stars", label: "By star rank", title: "Habits unlock at ★2 / ★4 / ★6 / ★8 / ★10" },
            ]}
          />
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Habit level</div>
          <Segmented
            label="Habit level"
            size="sm"
            value={controls.habitLevel}
            onChange={(habitLevel) => set({ habitLevel })}
            options={[1, 2, 3, 4, 5].map((n) => ({ value: n as Controls["habitLevel"], label: n }))}
          />
        </div>
        <p className="flex max-w-[260px] items-start gap-1.5 pb-0.5 text-[11px] leading-4 text-ink-faint">
          <Icon name="info" size={12} className="mt-0.5 shrink-0" />
          Habit assumptions apply to every dragon until the roster records each one's real habits.
        </p>
      </div>
    </div>
  );
}
