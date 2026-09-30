// The Formation Builder page, laid out per the "Dragonfire War Council"
// design system (src/ui/, ported from its components/src) and fed by the
// real engine: src/engine/formation.ts for scores, pairs and candidates,
// habitSynergy.ts for the habit links, src/ui/adapt.ts to reshape them.
//
// The roster starts with every catalog dragon in it. Edits (removed ids and
// per-dragon overrides, never Dragon copies) are saved in this browser by
// useSavedRoster and re-joined against the live catalog on load.
import * as React from "react";
import { evaluateFormation, recommendFlankPairs, withEmphasis, type FormationContext } from "./engine/formation";
import { disjointFormationCount, formationsWithCount, isRecommendedVanguard, rateSheetFormation } from "./engine/sheetRating";
import { useDraftWorker } from "./hooks/useDraftWorker";
import { loadoutFromStars, type LoadoutFor, type SkillsByDragon } from "./engine/habitSynergy";
import { confirmedPower } from "./engine/power";
import { flankDamageType, rankFlankCandidates } from "./engine/vanguardFit";
import { useCatalog } from "./hooks/useCatalog";
import { useHabitSkills } from "./hooks/useHabitSkills";
import { useSavedRoster, type RosterOverride } from "./hooks/useSavedRoster";
import type { Dragon as EngineDragon } from "./types";
import { skillSummaries, toSquadDraft, toUiCandidate, toUiDragon, toUiEval, toUiPair, vanguardSkillOf } from "./ui/adapt";
import { HabitLinkTable, RoundTimeline, ScoreMath, StructuralBreakdown, WarningList } from "./ui/Breakdown";
import { SheetDevCard } from "./ui/SheetDevCard";
import { Button, Eyebrow, Panel, Skeleton } from "./ui/Chips";
import { ControlsBar, EmphasisSlider } from "./ui/ControlsBar";
import { FormationBoard, LinkLegend } from "./ui/FormationBoard";
import { Icon } from "./ui/Icon";
import { CandidateTabs, EmphasisFan, FlankCandidateList, PairRecommendations, pairKey } from "./ui/Rankings";
import { HABIT_UNLOCK, RosterDrawer, type RosterPatch } from "./ui/RosterDrawer";
import { SkillDetail } from "./ui/SkillDetail";
import { SquadDetail, SquadDraftPanel, TroopLockBanner, type DraftMode } from "./ui/SquadDraft";
import { VanguardHero } from "./ui/VanguardHero";
import { VanguardPicker } from "./ui/VanguardPicker";
import { DAMAGE_LABEL, cx } from "./ui/format";
import type { Controls, DraftStatus, Dragon, FlankCandidate, FormationEvaluation, PairRecommendation, Placement, Slot, Squad, SquadDraft, TroopType } from "./ui/types";

const NO_SKILLS: SkillsByDragon = {};
const ADMIN_LINKS = [
  { href: "/admin/dragon-stats", label: "Dragon Stats" },
  { href: "/admin/synergy-rules", label: "Synergy Rules" },
  { href: "/admin/habit-builder", label: "Habit Builder" },
];

/** Squads a draft keeps, in either mode. */
const DRAFT_TAKE = 5;

/** What the last squad draft ran on, so later edits can be listed as the reasons it's out of date. */
interface DraftBasis {
  pool: Map<string, { name: string; starRank: number; bases: string; habits: string; custom: boolean }>;
  habitLevel: Controls["habitLevel"];
  skills: SkillsByDragon | undefined;
}
const basesOf = (d: EngineDragon) => [d.baseStrength, d.baseInstinct, d.baseIntelligence, d.baseInitiative].join(",");

function useMedia(q: string) {
  const [m, setM] = React.useState(() => window.matchMedia(q).matches);
  React.useEffect(() => {
    const mq = window.matchMedia(q);
    const f = () => setM(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, [q]);
  return m;
}

/** A breakdown section: a panel on desktop, a collapsible section on phones. */
function Section({ title, aside, children, phone, defaultOpen = true }: { title: string; aside?: React.ReactNode; children: React.ReactNode; phone: boolean; defaultOpen?: boolean }) {
  if (!phone) return <Panel title={title} aside={aside}>{children}</Panel>;
  return (
    <details open={defaultOpen} className="group rounded-lg border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
        <span className="font-display text-[13px] font-semibold uppercase tracking-[0.08em] text-ink">{title}</span>
        <span className="flex items-center gap-2">
          {aside}
          <Icon name="chevron" size={14} className="text-ink-muted transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

function AdminMenu() {
  return (
    <details className="relative">
      <summary className="flex h-7 cursor-pointer list-none items-center gap-1 rounded-md px-2.5 text-xs font-medium text-ink-muted hover:bg-surface-hover hover:text-ink">
        Admin <Icon name="chevron" size={12} />
      </summary>
      <div className="absolute right-0 z-40 mt-1 w-44 rounded-md border border-line-strong bg-surface-raised p-1 shadow-drawer">
        {ADMIN_LINKS.map((l) => (
          <a key={l.href} href={l.href} className="block rounded px-2.5 py-1.5 text-sm text-ink-muted hover:bg-surface-hover hover:text-ink">
            {l.label}
          </a>
        ))}
      </div>
    </details>
  );
}

/** Every dragon is scored at max Level for now; Power from Level reads reignLevel. */
const LEVEL = 50;

function App() {
  const phone = useMedia("(max-width: 767px)");
  const wide = useMedia("(min-width: 1100px)");
  const { catalog, loading: catalogLoading } = useCatalog();
  const { skills, loading: skillsLoading } = useHabitSkills();

  // Every catalog dragon starts in the roster; this tracks the ones taken out,
  // plus per-dragon edits. Saved in this browser (useSavedRoster).
  const { removed, setRemoved, overrides, setOverrides } = useSavedRoster();
  const [controls, setControls] = React.useState<Controls>({ emphasis: 1, habitLevel: 5 });
  const [vgId, setVgId] = React.useState<string | null>(null);
  const [leftId, setLeftId] = React.useState<string | null>(null);
  const [rightId, setRightId] = React.useState<string | null>(null);
  const [picking, setPicking] = React.useState(false);
  const [rosterOpen, setRosterOpen] = React.useState(false);
  const [hoverPair, setHoverPair] = React.useState<PairRecommendation | null>(null);
  const [hoverCand, setHoverCand] = React.useState<FlankCandidate | null>(null);
  const [highlight, setHighlight] = React.useState<number | null>(null);
  const [lane, setLane] = React.useState<"left" | "right">("left");
  const [skillFor, setSkillFor] = React.useState<Dragon | null>(null);
  const [controlsOpen, setControlsOpen] = React.useState(false);
  // Squad draft (combat rating): manual runs only.
  const [draftMode, setDraftMode] = React.useState<DraftMode>("top");
  const [focusId, setFocusId] = React.useState<string | null>(null);
  // Each mode (and each dragon drafted around) keeps its own last run.
  const [drafts, setDrafts] = React.useState<Record<string, { draft: SquadDraft; basis: DraftBasis }>>({});
  const draftWorker = useDraftWorker();
  const draftRunning = draftWorker.progress != null;
  const [draftCollapsed, setDraftCollapsed] = React.useState(false);
  // Measured in this browser by the last run; null until then, so no made-up estimate is shown.
  const [msPerFormation, setMsPerFormation] = React.useState<number | null>(null);
  const [squadDetail, setSquadDetail] = React.useState<Squad | null>(null);
  const [lock, setLock] = React.useState<{ troop: TroopType; rank: number; ids: string[]; locked: boolean; draftKey: string } | null>(null);
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // One habit loadout for power, synergy and the squad draft, so they always
  // agree: a dragon's own habits from the roster, else the habits its star
  // rank unlocks, all at the Habit level control.
  const assumed = React.useMemo(() => loadoutFromStars(controls.habitLevel), [controls.habitLevel]);
  const loadout = React.useMemo<LoadoutFor>(() => (d) => overrides[d.id]?.habitLevels ?? assumed(d), [assumed, overrides]);
  // Engine dragons with the roster's overrides applied and their real power
  // (Stars + Habits + Level, from the confirmed tables) set.
  const dragons = React.useMemo<EngineDragon[]>(
    () =>
      catalog.map((c) => {
        const { starRank, active } = overrides[c.id] ?? {};
        const d = { ...c, reignLevel: LEVEL, ...(starRank !== undefined && { starRank }), ...(active !== undefined && { active }) };
        return { ...d, power: confirmedPower(d, loadout(d)) ?? 0 };
      }),
    [catalog, overrides, loadout]
  );
  const uiDragons = React.useMemo(() => dragons.map(toUiDragon), [dragons]);
  const habitsById = React.useMemo(
    () => Object.fromEntries(dragons.map((d) => [d.id, { levels: loadout(d), custom: !!overrides[d.id]?.habitLevels }])),
    [dragons, loadout, overrides]
  );
  const inRoster = React.useMemo(() => new Set(dragons.filter((d) => !removed.has(d.id)).map((d) => d.id)), [dragons, removed]);
  const pool = React.useMemo(() => dragons.filter((d) => inRoster.has(d.id) && d.active !== false), [dragons, inRoster]);
  // ---- squad draft: the four-stat rating from engine/sheetRating.ts, beside the power score
  // "top": the best DRAFT_TAKE squads with no dragon shared. "with": the best
  // DRAFT_TAKE different trios that include the focus dragon, in any seat.
  const focusDragon = draftMode === "with" && focusId ? (pool.find((d) => d.id === focusId) ?? null) : null;
  const draftKey = draftMode === "top" ? "top" : `with:${focusId ?? ""}`;
  const draft = drafts[draftKey]?.draft ?? null;
  const draftBasis = drafts[draftKey]?.basis ?? null;
  const focusOptions = React.useMemo(() => [...pool].sort((a, b) => a.name.localeCompare(b.name)).map(toUiDragon), [pool]);
  const draftSpace = React.useMemo(() => {
    const v = pool.filter(isRecommendedVanguard).length;
    const n = pool.length;
    if (draftMode === "with") return { vanguards: v, formations: focusDragon && n >= 3 ? formationsWithCount(pool, isRecommendedVanguard, focusDragon) : 0, troops: 4 };
    return { vanguards: v, formations: disjointFormationCount(pool, isRecommendedVanguard), troops: 4 };
  }, [pool, draftMode, focusDragon]);
  const draftEstimate = msPerFormation == null ? null : Math.round(draftSpace.formations * msPerFormation);
  const draftBlocked = catalogLoading
    ? "Dragon catalog is still loading"
    : !skills
      ? "Waiting for habit data to finish loading"
      : pool.length < 3
        ? `Needs 3 active dragons — ${pool.length} active`
        : draftSpace.vanguards === 0
          ? "No active tank or champion for the Vanguard seat"
          : draftMode === "with" && !focusId
            ? "Pick a dragon to draft around"
            : draftMode === "with" && !focusDragon
              ? `${dragons.find((d) => d.id === focusId)?.name ?? "That dragon"} isn't active in the roster`
              : draftMode === "with" && draftSpace.formations === 0
                ? `No other tank or champion to hold the Vanguard seat for ${focusDragon!.name}`
                : null;
  // Level and emphasis don't change the four stats, so they never make a draft stale.
  const draftChanges = React.useMemo(() => {
    if (!draftBasis) return [];
    const out: string[] = [];
    const current = new Map(pool.map((d) => [d.id, d]));
    for (const [id, was] of draftBasis.pool) {
      const d = current.get(id);
      if (!d) out.push(`${was.name} ${removed.has(id) ? "removed" : "benched"}`);
      else {
        if (d.starRank !== was.starRank) out.push(`${was.name} ★${was.starRank} → ★${d.starRank}`);
        if (basesOf(d) !== was.bases) out.push(`${was.name} base stats edited`);
        // Assumed-habit dragons move with the controls, which get their own line below.
        if ((was.custom || overrides[id]?.habitLevels) && loadout(d).join() !== was.habits) out.push(`${was.name} habits changed`);
      }
    }
    for (const d of pool) if (!draftBasis.pool.has(d.id)) out.push(`${d.name} added`);
    if (controls.habitLevel !== draftBasis.habitLevel) out.push(`Habit level ${draftBasis.habitLevel} → ${controls.habitLevel}`);
    if (skills !== draftBasis.skills) out.push("Habit clause data updated");
    return out;
  }, [draftBasis, pool, removed, overrides, loadout, controls.habitLevel, skills]);
  const draftStatus: DraftStatus = draftWorker.progress
    ? { kind: "running", ...draftWorker.progress }
    : draft && draftChanges.length
      ? { kind: "stale", draft, changes: draftChanges }
      : draft
        ? { kind: "ready", draft }
        : draftBlocked
          ? { kind: "blocked", reason: draftBlocked }
          : { kind: "idle", error: draftWorker.error ?? undefined };
  // The search runs in a worker on a snapshot of the roster as it is at the
  // click; edits made meanwhile show up as reasons the result is out of date.
  const runDraft = () => {
    if (draftBlocked || draftRunning || !skills) return;
    const key = draftKey;
    const focus = focusDragon;
    const activeCount = pool.length;
    const basis: DraftBasis = {
      pool: new Map(pool.map((d) => [d.id, { name: d.name, starRank: d.starRank, bases: basesOf(d), habits: loadout(d).join(), custom: !!overrides[d.id]?.habitLevels }])),
      habitLevel: controls.habitLevel,
      skills,
    };
    const habits = Object.fromEntries(pool.map((d) => [d.id, loadout(d)]));
    draftWorker.run({ pool, skills, habits, focusId: focus?.id ?? null, take: DRAFT_TAKE }, draftSpace.formations, (search, ms) => {
      setDrafts((prev) => ({ ...prev, [key]: { draft: toSquadDraft(search, ms, Date.now(), activeCount, focus), basis } }));
      if (search.searched) setMsPerFormation(ms / search.searched);
      setDraftCollapsed(false);
      setNow(Date.now());
    });
  };
  const unavailable = React.useMemo(
    () => new Set((draft?.squads ?? []).flatMap((s) => s.members.map((m) => m.dragon.id)).filter((id) => !pool.some((d) => d.id === id))),
    [draft, pool]
  );
  const byId = (id: string | null) => (id ? (pool.find((d) => d.id === id) ?? null) : null);
  const vanguard = byId(vgId);
  const left = byId(leftId);
  const right = byId(rightId);

  // Simulated once per roster/habit setting at emphasis 1; the emphasis
  // slider only re-ranks (see withEmphasis), so dragging it stays instant.
  const { emphasis } = controls;
  const ctx = React.useMemo<FormationContext>(
    () => ({
      emphasis: 1,
      habits: {
        skills: skills ?? NO_SKILLS,
        loadout,
      },
    }),
    [loadout, skills]
  );

  const flankPool = React.useMemo(() => pool.filter((d) => d !== vanguard), [pool, vanguard]);
  const evaluatedPairs = React.useMemo(
    () => (vanguard ? recommendFlankPairs(vanguard, flankPool, ctx, Infinity) : []),
    [vanguard, flankPool, ctx]
  );
  const allPairs = React.useMemo(
    () =>
      evaluatedPairs
        .map((p) => ({ ...p, eval: withEmphasis(p.eval, emphasis) }))
        .sort((a, b) => b.eval.rankScore - a.eval.rankScore || b.eval.bonusPct - a.eval.bonusPct),
    [evaluatedPairs, emphasis]
  );
  const top = React.useMemo(() => allPairs.slice(0, 5).map(toUiPair), [allPairs]);
  const tiedTotal = allPairs.length ? allPairs.filter((p) => Math.round(p.eval.rankScore) === Math.round(allPairs[0].eval.rankScore)).length : 0;

  const other = lane === "left" ? right : left;
  const evaluatedCandidates = React.useMemo(
    () => (vanguard ? rankFlankCandidates(vanguard, lane, flankPool.filter((d) => d !== other), other, ctx) : []),
    [vanguard, lane, flankPool, other, ctx]
  );
  // Stable sort: ties at the new emphasis keep the emphasis-1 order (more synergy first).
  const candidates = React.useMemo(
    () =>
      evaluatedCandidates
        .map((c) => ({ ...c, eval: withEmphasis(c.eval, emphasis) }))
        .sort((a, b) => b.eval.rankScore - a.eval.rankScore)
        .map(toUiCandidate),
    [evaluatedCandidates, emphasis]
  );
  // After "Open in builder" the squad's troop stays in charge of the placed
  // formation until the player lets go (TroopLockBanner).
  const lockedTroop = lock?.locked ? lock.troop : undefined;
  const placedEvaluation = React.useMemo(
    () => (vanguard && left && right ? evaluateFormation({ left, vanguard, right }, lockedTroop ? { ...ctx, troop: lockedTroop } : ctx) : null),
    [vanguard, left, right, ctx, lockedTroop]
  );
  const lockCompare = React.useMemo(() => {
    if (!lock || !vanguard || !left || !right) return null;
    const auto = evaluateFormation({ left, vanguard, right }, ctx);
    const forced = evaluateFormation({ left, vanguard, right }, { ...ctx, troop: lock.troop });
    return { autoTroop: (auto.troopType ?? lock.troop) as TroopType, autoScore: auto.score, lockedScore: forced.score };
  }, [lock, vanguard, left, right, ctx]);
  const lockSeatsIntact = !!lock && lock.ids.join() === [leftId, vgId, rightId].join();
  const placedEval = React.useMemo(() => (placedEvaluation ? toUiEval(withEmphasis(placedEvaluation, emphasis)) : null), [placedEvaluation, emphasis]);
  // With one flank placed, preview the best dragon for the empty one.
  const emptyFlank: "left" | "right" | null = vanguard && (left ? !right : right) ? (left ? "right" : "left") : null;
  const emptyFlankEvals = React.useMemo(() => {
    if (!vanguard || !emptyFlank) return [];
    const placed = left ?? right;
    return rankFlankCandidates(vanguard, emptyFlank, flankPool.filter((d) => d !== placed), placed, ctx).map((c) => c.eval);
  }, [vanguard, emptyFlank, left, right, flankPool, ctx]);
  const bestForEmpty = React.useMemo(() => {
    const best = emptyFlankEvals.map((e) => withEmphasis(e, emphasis)).sort((a, b) => b.rankScore - a.rankScore)[0];
    return best ? toUiEval(best) : null;
  }, [emptyFlankEvals, emphasis]);

  const uiVanguard = vanguard ? toUiDragon(vanguard) : null;
  const vgSkill = vanguard ? vanguardSkillOf(vanguard.name) : null;
  const flankNeed = vanguard ? (flankDamageType(vanguard.name) as Dragon["damageType"] | null) : null;

  // ---- which formation the breakdown explains
  let focus: FormationEvaluation | null = null;
  let focusLabel = "";
  let previewSlots: Slot[] = [];
  if (vanguard) {
    if (hoverCand) {
      focus = hoverCand.eval;
      focusLabel = "Hover preview";
      previewSlots = [lane];
    } else if (hoverPair) {
      focus = hoverPair.eval;
      focusLabel = "Hover preview";
      previewSlots = ["left", "right"];
    } else if (placedEval) {
      focus = placedEval;
      focusLabel = "Placed";
    } else if (bestForEmpty && emptyFlank) {
      focus = bestForEmpty;
      focusLabel = `Previewing best ${emptyFlank === "left" ? "Left" : "Right"} Flank`;
      previewSlots = [emptyFlank];
    } else if (top[0]) {
      focus = top[0].eval;
      focusLabel = "Previewing #1 recommendation";
      previewSlots = ["left", "right"];
    }
  }
  const boardPlacement: Placement = focus?.placement ?? { left: left && toUiDragon(left), vanguard: uiVanguard, right: right && toUiDragon(right) };
  const sheetRating = React.useMemo(() => {
    if (!focus) return null;
    const find = (id: string | undefined) => (id ? dragons.find((d) => d.id === id) ?? null : null);
    return rateSheetFormation(
      {
        left: find(focus.placement.left?.id),
        vanguard: find(focus.placement.vanguard?.id),
        right: find(focus.placement.right?.id),
      },
      { skills: skills ?? NO_SKILLS, loadout },
      // The active pool, the same population the squad draft's T-score and ceiling use.
      pool,
    );
  }, [focus, dragons, pool, skills, loadout]);
  const focusIsPlaced = focusLabel === "Placed";
  const dragonsByName = React.useMemo(() => Object.fromEntries(uiDragons.map((d) => [d.name, d])), [uiDragons]);

  // ---- actions
  const pickVanguard = (d: Dragon) => {
    setVgId(d.id);
    setLeftId(null);
    setRightId(null);
    setPicking(false);
    setLock(null);
    setLane(vanguardSkillOf(d.name)?.flankPos ?? "left");
  };
  const openSquad = (sq: Squad) => {
    const [l, v, r] = sq.members.map((m) => m.dragon.id);
    setVgId(v);
    setLeftId(l);
    setRightId(r);
    setPicking(false);
    setLock({ troop: sq.troop, rank: sq.rank, ids: [l, v, r], locked: true, draftKey });
    setSquadDetail(null);
    setHoverCand(null);
    setHoverPair(null);
    setDraftCollapsed(true);
    setLane("left");
    window.scrollTo({ top: 0 });
  };
  const place = (slot: "left" | "right", d: Dragon) => {
    if (slot === "left") {
      setLeftId(d.id);
      if (rightId === d.id) setRightId(null);
    } else {
      setRightId(d.id);
      if (leftId === d.id) setLeftId(null);
    }
    setHoverCand(null);
    if (slot === "left" && !right) setLane("right");
    if (slot === "right" && !left) setLane("left");
  };
  const placeFocus = () => {
    if (!focus) return;
    setLeftId(focus.placement.left?.id ?? null);
    setRightId(focus.placement.right?.id ?? null);
    setHoverPair(null);
    setHoverCand(null);
  };
  const swap = () => {
    setLeftId(rightId);
    setRightId(leftId);
  };
  const patch = (id: string, p: RosterPatch) => {
    if (p.inRoster !== undefined)
      setRemoved((s) => {
        const n = new Set(s);
        if (p.inRoster) n.delete(id);
        else n.add(id);
        return n;
      });
    if (p.active === undefined && p.starRank === undefined && p.habitLevels === undefined) return;
    const wasStars = dragons.find((d) => d.id === id)?.starRank ?? 1;
    setOverrides((prev) => {
      const o: RosterOverride = { ...prev[id] };
      if (p.active !== undefined) o.active = p.active;
      if (p.habitLevels === null) delete o.habitLevels;
      else if (p.habitLevels) o.habitLevels = p.habitLevels;
      if (p.starRank !== undefined) {
        o.starRank = p.starRank;
        // Own habits follow the new star rank: newly locked ones drop out, newly unlocked ones start at level 1.
        const stars = p.starRank;
        if (o.habitLevels) o.habitLevels = o.habitLevels.map((l, i) => (stars < HABIT_UNLOCK[i] ? null : wasStars < HABIT_UNLOCK[i] ? 1 : l));
      }
      return { ...prev, [id]: o };
    });
  };
  const bulk = (a: "addAll" | "removeAll" | "activateAll" | "benchAll", ids: string[]) => {
    if (a === "addAll") setRemoved((s) => new Set([...s].filter((x) => !ids.includes(x))));
    if (a === "removeAll") setRemoved((s) => new Set([...s, ...ids]));
    if (a === "activateAll" || a === "benchAll")
      setOverrides((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, { ...prev[id], active: a === "activateAll" }])) }));
  };

  // ---- header
  const header = (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/92 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 md:px-6">
        <div className="mr-auto flex items-center gap-3 md:mr-0">
          <svg viewBox="0 0 24 24" className="size-7 shrink-0" aria-hidden="true">
            <path d="M12 2 21 5.5v6.8c0 5-3.7 8.4-9 9.7-5.3-1.3-9-4.7-9-9.7V5.5z" fill="none" stroke="var(--ink)" strokeWidth="1.4" />
            <path d="M7 10.5h10M12 6.5v11M8.5 14.5h7" stroke="var(--ink-muted)" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <div className="leading-tight">
            <div className="font-display text-[15px] font-semibold tracking-[0.06em] text-ink">Formation Builder</div>
            <div className="text-[11px] text-ink-faint">Dragonfire · war council</div>
          </div>
        </div>
        {!phone && (
          <div className="flex-1">
            <ControlsBar controls={controls} onChange={setControls} />
          </div>
        )}
        {phone && (
          <Button size="sm" variant="ghost" onClick={() => setControlsOpen((o) => !o)} aria-expanded={controlsOpen}>
            <Icon name="sliders" size={14} /> {controls.emphasis.toFixed(2)}×
          </Button>
        )}
        <AdminMenu />
        <Button size="sm" variant={rosterOpen ? "primary" : "quiet"} onClick={() => setRosterOpen((o) => !o)} aria-expanded={rosterOpen}>
          <Icon name="roster" size={14} /> Roster{" "}
          <span className="tnum text-[11px] opacity-80">
            {pool.length}/{dragons.length}
          </span>
        </Button>
      </div>
      {phone && (
        <div className="border-t border-line px-4 py-3">
          {controlsOpen ? (
            <ControlsBar controls={controls} onChange={setControls} layout="stack" />
          ) : (
            <EmphasisSlider value={controls.emphasis} onChange={(emphasis) => setControls({ ...controls, emphasis })} />
          )}
        </div>
      )}
    </header>
  );

  // ---- body states
  let body: React.ReactNode;
  if (catalogLoading) {
    body = (
      <div className="grid gap-5 @[1120px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-4">
          <Skeleton className="h-[220px]" />
          <Skeleton className="h-[300px]" />
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-[260px]" />
            <Skeleton className="h-[260px]" />
            <Skeleton className="h-[260px]" />
          </div>
          <Skeleton className="h-[160px]" />
        </div>
        <p className="col-span-full flex items-center gap-2 text-sm text-ink-muted">
          <span className="size-2 animate-pulse rounded-full bg-ink-muted" /> Loading dragon catalog… habit data loads separately.
        </p>
      </div>
    );
  } else if (inRoster.size === 0 || pool.length === 0) {
    body = (
      <div className="mx-auto max-w-lg rounded-lg border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
        <Icon name="roster" size={28} className="mx-auto text-ink-muted" />
        <h1 className="mt-3 font-display text-2xl font-semibold text-ink">{inRoster.size === 0 ? "Your roster is empty" : "Every dragon is benched"}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Recommendations only use dragons in your roster that are marked active. Add the dragons you own, set their star rank, and the builder ranks formations from them — the squad draft needs at least 3 active dragons too.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="primary" onClick={() => setRosterOpen(true)}>
            <Icon name="roster" size={14} /> Open roster
          </Button>
          <Button onClick={() => bulk(inRoster.size === 0 ? "addAll" : "activateAll", dragons.map((d) => d.id))}>
            {inRoster.size === 0 ? `Add all ${dragons.length}` : "Activate all"}
          </Button>
        </div>
      </div>
    );
  } else if (!vanguard || !uiVanguard || !vgSkill || picking) {
    body = (
      <VanguardPicker
        dragons={pool.map(toUiDragon)}
        skillOf={(d) => vanguardSkillOf(d.name) ?? { selfText: "—", flankPos: "left", flankText: "—" }}
        flankDamageOf={(d) => flankDamageType(d.name) as Dragon["damageType"] | null}
        isRecommended={isRecommendedVanguard}
        onPick={pickVanguard}
        onCancel={vanguard ? () => setPicking(false) : undefined}
        currentId={vanguard?.id}
      />
    );
  } else {
    const uiLeft = left && toUiDragon(left);
    const uiRight = right && toUiDragon(right);
    const uiOther = other && toUiDragon(other);
    const selectedPairKey = uiLeft && uiRight ? pairKey({ left: uiLeft, right: uiRight }) : null;
    body = (
      <div className="grid gap-5 @[1120px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* left column: choose */}
        <div className="flex min-w-0 flex-col gap-5">
          <VanguardHero dragon={uiVanguard} skill={vgSkill} flankDamage={flankNeed} onChange={() => setPicking(true)} onShowSkills={() => setSkillFor(uiVanguard)} compact={phone} />
          <Panel title={`Recommended flanks for ${vanguard.name}`} aside={<span className="text-[11px] text-ink-faint">top 5 of {allPairs.length}</span>}>
            <PairRecommendations
              vanguard={uiVanguard}
              pairs={top}
              emphasis={controls.emphasis}
              selectedKey={selectedPairKey}
              onPick={(p) => {
                setLeftId(p.left.id);
                setRightId(p.right.id);
                setHoverPair(null);
              }}
              onHover={phone ? undefined : setHoverPair}
              tiedTotal={tiedTotal}
            />
            <div className="mt-4 rounded-md border border-line bg-surface-sunken p-3">
              <div className="flex items-center justify-between">
                <Eyebrow>How emphasis reorders these</Eyebrow>
                <span className="text-[11px] text-ink-faint">rank score, 0× → 3× · click to set</span>
              </div>
              <EmphasisFan pairs={top} emphasis={controls.emphasis} highlightKey={hoverPair ? pairKey(hoverPair) : null} onPickEmphasis={(emphasis) => setControls({ ...controls, emphasis })} />
            </div>
          </Panel>
          <Panel title="Flank candidates" bodyClass="space-y-3">
            <CandidateTabs lane={lane} onLane={setLane} left={uiLeft} right={uiRight} buffLane={vgSkill.flankPos} />
            <FlankCandidateList
              lane={lane}
              vanguard={uiVanguard}
              other={uiOther}
              candidates={candidates}
              emphasis={controls.emphasis}
              buffed={vgSkill.flankPos === lane && flankNeed !== null}
              flankNeed={flankNeed ? DAMAGE_LABEL[flankNeed] : null}
              placedId={(lane === "left" ? left : right)?.id}
              onPick={(d) => place(lane, d)}
              onHover={phone ? undefined : setHoverCand}
              maxHeight={phone ? 380 : 460}
            />
          </Panel>
        </div>

        {/* right column: understand */}
        <div className="flex min-w-0 flex-col gap-5">
          <section className="@container rounded-lg border border-line bg-surface px-4 pb-4 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.08em] text-ink">Formation</h2>
                <span className={cx("rounded-sm px-1.5 py-0.5 text-[11px] font-medium", focusIsPlaced ? "bg-pos/12 text-pos" : "bg-surface-hover text-ink-muted")}>{focusLabel}</span>
              </div>
              <div className="flex items-center gap-3">
                <LinkLegend />
                {(left || right) && (
                  <Button size="sm" variant="ghost" onClick={swap} title="Swap Left and Right flanks">
                    <Icon name="swap" size={13} /> Swap
                  </Button>
                )}
                {!focusIsPlaced && focus && !hoverCand && !hoverPair && (
                  <Button size="sm" variant="primary" onClick={placeFocus}>
                    Place this formation
                  </Button>
                )}
              </div>
            </div>
            {lock && lockCompare && (
              <div className="mt-2">
                <TroopLockBanner
                  rank={lockSeatsIntact ? lock.rank : null}
                  troop={lock.troop}
                  locked={lock.locked}
                  lockedScore={lockCompare.lockedScore}
                  autoTroop={lockCompare.autoTroop}
                  autoScore={lockCompare.autoScore}
                  onLock={(locked) => setLock({ ...lock, locked })}
                  onRelease={() => setLock(null)}
                />
              </div>
            )}
            <div className="mt-2">
              <FormationBoard
                placement={boardPlacement}
                vanguardSkill={vgSkill}
                flankDamage={flankNeed}
                evaluation={focus}
                previewSlots={previewSlots}
                highlight={highlight}
                activeLane={lane}
                onLaneClick={(s) => (s === "vanguard" ? setPicking(true) : setLane(s))}
                onClear={(s) => {
                  if (s === "left") setLeftId(null);
                  if (s === "right") setRightId(null);
                  setLane(s === "right" ? "right" : "left");
                }}
                onShowSkills={setSkillFor}
              />
            </div>
          </section>

          {focus && (
            <>
              <Section
                phone={phone}
                title="Score"
                aside={
                  <span className="text-[11px] text-ink-faint">
                    {focus.placement.left?.name ?? "—"} · {focus.placement.vanguard?.name} · {focus.placement.right?.name ?? "—"} · modeled estimates
                  </span>
                }
              >
                <ScoreMath evaluation={focus} emphasis={controls.emphasis} />
              </Section>
              {skillsLoading && (
                <p className="flex items-center gap-2 rounded-md border border-habit/40 bg-habit/8 px-3 py-2 text-xs text-ink-muted">
                  <span className="size-2 animate-pulse rounded-full bg-habit" /> Habit data is still loading — scores show structural bonuses only; habit synergy fills in when it arrives.
                </p>
              )}
              <div className="grid gap-5 xl:grid-cols-2">
                <Section phone={phone} defaultOpen={!phone} title="Structural bonuses" aside={<span className="tnum text-xs font-semibold text-structural">{(focus.structuralPct * 100).toFixed(1)}%</span>}>
                  <StructuralBreakdown evaluation={focus} />
                </Section>
                <Section
                  phone={phone}
                  title="Warnings"
                  aside={focus.warnings.length ? <span className="tnum rounded-sm bg-neg/15 px-1.5 text-[11px] font-semibold text-neg">{focus.warnings.length}</span> : undefined}
                >
                  <WarningList warnings={focus.warnings} onSwap={focusIsPlaced ? swap : undefined} />
                  <div className="mt-4 border-t border-line pt-3 text-[11px] leading-4 text-ink-faint">
                    Lane preferences: Tank → Vanguard · Physical → Right · Tactical / Fire / Healer → Left · Control → any. {vanguard.name} buffs the{" "}
                    {vgSkill.flankPos === "left" ? "Left" : "Right"} Flank
                    {flankNeed ? (
                      <>
                        {" "}
                        — only <span style={{ color: `var(--dmg-${flankNeed})` }}>{DAMAGE_LABEL[flankNeed]}</span> dealers use it
                      </>
                    ) : (
                      ""
                    )}
                    .
                  </div>
                </Section>
              </div>
              <Section phone={phone} defaultOpen={!phone} title="Habit synergy links" aside={<span className="tnum text-xs font-semibold text-habit">{(focus.habitPct * 100).toFixed(1)}%</span>}>
                <HabitLinkTable links={focus.habitLinks} dragons={dragonsByName} highlight={highlight} onHighlight={setHighlight} />
              </Section>
              <Section phone={phone} defaultOpen={false} title="10-round timeline" aside={<span className="text-[11px] text-ink-faint">per-round uptime</span>}>
                <RoundTimeline links={focus.habitLinks} highlight={highlight} onHighlight={setHighlight} />
              </Section>
              {sheetRating && (
                <Section phone={phone} defaultOpen title="Dev · Sheet stat rating" aside={<span className="text-[11px] text-ink-faint">does not affect the score</span>}>
                  <SheetDevCard rating={sheetRating} />
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // The squad draft sits above every state but the empty roster. It's a second
  // way in: opening a squad fills all three seats.
  const showDraft = catalogLoading || (inRoster.size > 0 && pool.length > 0) || Object.keys(drafts).length > 0;
  const draftPanel = (
    <SquadDraftPanel
      status={draftStatus}
      space={draftSpace}
      estimateMs={draftEstimate}
      now={now}
      take={DRAFT_TAKE}
      mode={draftMode}
      onMode={(m) => {
        if (draftRunning) return;
        setDraftMode(m);
        setDraftCollapsed(false);
      }}
      focus={focusDragon && toUiDragon(focusDragon)}
      focusOptions={focusOptions}
      onFocus={(id) => {
        setFocusId(id);
        setDraftCollapsed(false);
      }}
      collapsed={draftCollapsed && !!draft && !draftRunning}
      onToggle={() => setDraftCollapsed((c) => !c)}
      onRun={runDraft}
      onCancel={draftWorker.cancel}
      onOpen={openSquad}
      onDetails={setSquadDetail}
      openedRank={lockSeatsIntact && lock!.draftKey === draftKey ? lock!.rank : null}
      unavailable={unavailable}
    />
  );

  return (
    <div className="min-h-screen bg-bg font-sans text-ink">
      {header}
      <main className="@container mx-auto max-w-[1600px] px-4 py-5 transition-[padding] md:px-6" style={rosterOpen && wide ? { paddingRight: 624 } : undefined}>
        {showDraft ? (
          <div className="flex flex-col gap-5">
            {draftPanel}
            {body}
          </div>
        ) : (
          body
        )}
      </main>
      <RosterDrawer open={rosterOpen} onClose={() => setRosterOpen(false)} dragons={uiDragons} habits={habitsById} inRoster={inRoster} onChange={patch} onBulk={bulk} />
      {squadDetail && (
        <SquadDetail
          squad={squadDetail}
          onClose={() => setSquadDetail(null)}
          onOpen={squadDetail.members.some((m) => unavailable.has(m.dragon.id)) ? undefined : openSquad}
        />
      )}
      {skillFor && <SkillDetail dragon={skillFor} skills={skillSummaries(skillFor.name, skills, controls.habitLevel)} controls={controls} onClose={() => setSkillFor(null)} />}
    </div>
  );
}

export default App;
