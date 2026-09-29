import type { Doc } from "../../convex/_generated/dataModel";

// A dragon's Command skill and 5 Habits, each broken into structured
// "clauses" (one per mechanic) — see convex/schema.ts for the stored shape
// and scripts/habit-clauses/ for how the initial data was derived from the
// scraped habit/command text.
export type SkillDoc = Doc<"habitCapabilities">;
export type Clause = SkillDoc["clauses"][number];
export type ClauseTarget = NonNullable<Clause["target"]>;
export type ClauseCondition = Clause["conditions"][number];
export type ClauseBoost = Clause["boosts"][number];
export type Levels = (number | null)[];

/** habitSlot 0 is the Command skill itself; 1-5 are Habits. */
export const COMMAND_SLOT = 0;
export const ROUNDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const EMPTY_LEVELS: Levels = [null, null, null, null, null];

// Assumed troop capacity by round for a 10-round fight (index = round - 1):
// above 75% for rounds 1-2, above 50% through round 5, below 50% for the
// final 5 rounds (Neill's rough call), below 25% for rounds 9-10. Used for
// both our side and the enemy's, since neither is knowable ahead of time.
export const ASSUMED_TROOPS_PCT = [95, 85, 75, 65, 55, 45, 35, 25, 15, 5];

/** Rounds where a troop-capacity condition like "<50" or ">75" holds under the assumed curve. */
export function troopConditionRounds(test: string): number[] {
  const m = test.match(/^([<>])(\d+)$/);
  if (!m) return ROUNDS;
  const pct = Number(m[2]);
  return ROUNDS.filter((r) => (m[1] === "<" ? ASSUMED_TROOPS_PCT[r - 1] < pct : ASSUMED_TROOPS_PCT[r - 1] > pct));
}

export type Lane = "left" | "vanguard" | "right";
// "Within adjacency": the Vanguard reaches all 3 lanes (itself included), a
// flank reaches only itself and the Vanguard. That makes adjacency-targeted
// buffs a little better from the Vanguard slot.
export const LANE_REACH: Record<Lane, Lane[]> = {
  left: ["left", "vanguard"],
  vanguard: ["left", "vanguard", "right"],
  right: ["right", "vanguard"],
};

// Target counts: "3 Allies" always includes the dragon itself; "N (other)
// Allies" for N < 3 picks N of the 3 (possibly including itself) — so an
// unpicked N-ally effect covers each teammate N/3 of the time. Enemy-side
// lane priorities ("prioritizes the Left Flank") are ignored for scoring: an
// enemy Fire Damage Received increase helps every one of our Fire dealers.

export function triggerRounds(timing: Clause["timing"]): number[] | null {
  switch (timing.mode) {
    case "combat":
      return [1];
    case "each":
      return ROUNDS;
    case "odd":
      return ROUNDS.filter((r) => r % 2 === 1);
    case "even":
      return ROUNDS.filter((r) => r % 2 === 0);
    case "rounds":
      return timing.rounds ?? [];
    case "event":
      return null;
  }
}

function durationLength(c: Pick<Clause, "timing" | "duration">): number {
  const d = c.duration ?? (c.timing.mode === "combat" ? "combat" : "round");
  return d === "combat" ? 10 : d === "round" ? 1 : d;
}

/** Rounds a clause is in effect: trigger rounds stretched by duration, narrowed by any troop-capacity conditions. */
export function activeRounds(c: Clause): number[] | null {
  const trig = triggerRounds(c.timing);
  if (!trig) return null;
  const len = durationLength(c);
  const set = new Set<number>();
  for (const r of trig) for (let i = r; i < r + len && i <= 10; i++) set.add(i);
  let rounds = [...set].sort((a, b) => a - b);
  for (const cond of c.conditions) {
    if (cond.scope === "selfTroops" || cond.scope === "targetTroops") {
      const ok = troopConditionRounds(cond.value);
      rounds = rounds.filter((r) => ok.includes(r));
    }
  }
  return rounds;
}

// --- Plain-English rendering, for the builder's clause summaries ---

const KIND_LABEL: Record<Clause["kind"], string> = {
  stat: "",
  dmgDealt: "Damage Dealt",
  dmgRecv: "Damage Received",
  recovDealt: "Recovery Dealt",
  recovRecv: "Recovery Received",
  hit: "damage hit",
  heal: "Recovery",
  effect: "Apply",
  cleanse: "Cleanse",
  cmd: "Command:",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function formatLevels(v: Levels | undefined, signed = true): string {
  if (!v || v.every((x) => x == null)) return "";
  const nums = v.map((x) => (x == null ? "?" : `${signed && x > 0 ? "+" : ""}${x}`));
  return new Set(nums).size === 1 ? `${nums[0]}%` : `${nums[0]} → ${nums[4]}%`;
}

/** [1,2,3,5,7,8,9] → "1-3,5,7-9" */
export function formatRounds(rounds: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < rounds.length; i++) {
    let j = i;
    while (j + 1 < rounds.length && rounds[j + 1] === rounds[j] + 1) j++;
    out.push(j > i + 1 ? `${rounds[i]}-${rounds[j]}` : j === i + 1 ? `${rounds[i]},${rounds[j]}` : `${rounds[i]}`);
    i = j;
  }
  return out.join(",");
}

export function describeTarget(t: ClauseTarget | undefined): string {
  if (!t) return "";
  if (t.side === "self") return "self";
  const noun = t.side === "ally" ? (t.count === 1 ? "ally" : "allies") : t.count === 1 ? "enemy" : "enemies";
  const parts = [`${t.count ?? 3}${t.other ? " other" : ""} ${noun}`];
  if (t.scope === "adjacent") parts.push("within adjacency");
  if (t.scope === "sameLane") parts.push("in the same lane");
  if (t.prefer) parts.push(`${t.filter ? "only" : "prefers"} ${t.prefer}`);
  return parts.join(", ");
}

export function describeTiming(c: Pick<Clause, "timing" | "duration">): string {
  const { timing } = c;
  const when =
    timing.mode === "combat"
      ? "Start of combat"
      : timing.mode === "each"
        ? "Each round"
        : timing.mode === "odd"
          ? "Odd rounds"
          : timing.mode === "even"
            ? "Even rounds"
            : timing.mode === "event"
              ? `On ${timing.event ?? "event"}`
              : `Round${(timing.rounds?.length ?? 0) > 1 ? "s" : ""} ${formatRounds(timing.rounds ?? [])}`;
  const d = c.duration;
  const dur = d == null ? "" : d === "combat" ? ", until end of combat" : d === "round" ? ", this round" : `, for ${d} round${d > 1 ? "s" : ""}`;
  return when + dur;
}

export function describeCondition(cond: ClauseCondition): string {
  if (cond.scope === "selfTroops" || cond.scope === "targetTroops") return `${cond.scope === "selfTroops" ? "you're" : "target is"} ${cond.value}% troops`;
  return cond.value ? `${cond.scope} ${cond.value}` : cond.scope;
}

export function describeClause(c: Clause): string {
  const what = c.what.map(cap).join(" + ");
  const head =
    c.kind === "stat"
      ? what
      : c.kind === "effect" || c.kind === "cleanse" || c.kind === "cmd"
        ? `${KIND_LABEL[c.kind]} ${what}`
        : c.kind === "hit"
          ? `${what} ${KIND_LABEL.hit}`
          : c.kind === "heal"
            ? KIND_LABEL.heal
            : `${what ? what + " " : ""}${KIND_LABEL[c.kind]}`;
  const bits = [head, formatLevels(c.valueByLevel)];
  if (c.chanceByLevel) bits.push(`(${formatLevels(c.chanceByLevel, false)} chance)`);
  const target = describeTarget(c.target);
  return [
    bits.filter(Boolean).join(" "),
    target,
    describeTiming(c),
    c.conditions.length ? `if ${c.conditions.map(describeCondition).join(" & ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
