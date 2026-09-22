# Dragonfire Formations (custom)

A formation optimizer for *Game of Thrones: Dragonfire*, built from scratch
as a from-first-principles alternative to https://dragonfire-formations.com/.

Stack: React 19 + Vite + TypeScript + Tailwind v4 + Convex. The 36-dragon
*catalog* (species-level attributes — rarity, breed, role, base stats) lives
in Convex. Your personal *roster* (which dragons you've added, star rank,
active toggle) is in-memory only for now (see
[`src/hooks/useRoster.ts`](src/hooks/useRoster.ts)) — it resets on every
reload. There's no roster-saving feature yet; when there is, it should be
Convex-backed and store just ids/overrides re-joined against the live
catalog, not a frozen snapshot (a localStorage version of that snapshot
approach is what this replaced, and it went stale the moment the catalog's
own defaults changed).

## Getting started

```bash
npm install
npx convex dev    # first run creates a dev deployment + .env.local
npm run dev
```

The Convex dev server needs to be running (or at least deployed once) for
the app to load any dragons — `src/hooks/useCatalog.ts` reads the `dragons`
table via `VITE_CONVEX_URL`. If that table is ever empty, re-seed it from
the original reference data with `npx convex run dragons:seed`.

## Layout

- [`src/types.ts`](src/types.ts) — Dragon, Army, Effect, Placement types
- [`src/data/`](src/data) — the 36-dragon roster + kits, generated from the
  reference site's own data files (see below) via `scripts/` — don't hand-edit
  `src/data/generated/*.json`
- [`src/engine/`](src/engine) — the scoring/optimization algorithm:
  - `power.ts` — power estimation (rarity/star/level, still the old guessed
    formula — see below), goal-adjusted power
  - `powerFromStars.ts` / `powerFromHabits.ts` / `powerFromLevel.ts` —
    **confirmed** (Level: mostly bounded extrapolation) real power values
    by rarity, from Star Rank, Habits, and Level (see "Confirmed game
    constants" below) — not yet wired into `power.ts`/live scoring, only
    into the admin sandbox
  - `effects.ts` — a dragon's unlocked Command/Habit effects at its star rank
  - `scoring.ts` — `evaluatePlacement()` / `bestArmy()`, the synergy model
  - `optimizer.ts` — partitions a roster into armies (greedy seed + local search)
- [`convex/schema.ts`](convex/schema.ts) / [`convex/dragons.ts`](convex/dragons.ts) —
  the `dragons` catalog table + `list`/`updateStats`/`seed` functions
- [`convex/habitCapabilities.ts`](convex/habitCapabilities.ts) — structured,
  hand-entered per-(dragon, habit slot) data: active rounds, how many enemy
  dragons it targets (1-3), enemy-facing % by level (Fire/Tactical/Physical
  Damage Received, Strength/Initiative/Intelligence/Instinct Reduced), and
  self modifier % by level (Tactical/Physical/Fire Increase, Strength/
  Initiative/Intelligence/Instinct Increase, Damage Reduction — entered as a
  positive %, meant to feed a later survivability figure); any percentage row can also
  carry a Requires Effect (row only applies while the target/self holds that
  effect) and a Buffed by Effect (doubles the row's values while active — the
  game mostly just doubles rather than using a distinct number), stored in
  one `effectLinks` map keyed by row name so new rows never need their own
  pair of schema fields for this; grows over time as new fields get added,
  see below
- [`src/hooks/useCatalog.ts`](src/hooks/useCatalog.ts) — the catalog, loaded from Convex
- [`src/hooks/useRoster.ts`](src/hooks/useRoster.ts) — roster state (in-memory only, no persistence yet)
- [`src/admin/`](src/admin) — hidden-ish admin pages, linked from a small nav
  bar (`src/components/AdminNav.tsx`) rather than the main app UI:
  - `DragonStatsAdmin.tsx` (`/admin/dragon-stats`) — dense base-stat entry form
  - `DragonDetail.tsx` — per-dragon Power/Stats growth calculator, reached by
    clicking a dragon on the stats page; a pure sandbox, doesn't affect live scoring
  - `SynergyRules.tsx` (`/admin/synergy-rules`) — read-only view of every
    scoring weight and per-dragon kit effect the real engine uses
  - `HabitBuilder.tsx` (`/admin/habit-builder`) — pick a dragon, pick one of
    its 5 habits, read the real per-level description, and fill in
    `convex/habitCapabilities.ts`'s structured fields for it
- [`src/components/`](src/components) — UI

## Confirmed game constants

Some formulas here are **confirmed against Neill's real game client**, not
guesses — these should be trusted over anything else in this codebase that
looks similar but is marked as a guess:

- **Power from Star Rank** ([`src/engine/powerFromStars.ts`](src/engine/powerFromStars.ts)) —
  real, independent of Level and Habits, fit per-rarity with a cubic in star
  rank (checked for a ★9/★10 "late star" jump the way Stats had one; found
  none). Rare/Epic have almost all 10 stars confirmed directly; Legendary's
  ★9-10 are the cubic's own extrapolation, not yet confirmed; Mythic has no
  data (no mythic dragons exist in the game yet). See the file for exactly
  which cells are real vs. estimated.
- **Power from Habits** ([`src/engine/powerFromHabits.ts`](src/engine/powerFromHabits.ts)) —
  real, flat power per habit level (1-5) by rarity; sum the table's value
  for each currently-unlocked habit at its own level (a legendary with 3
  habits unlocked, all level 3, gets 1500 × 3 = 4500). No mythic data.
- **Power from Level** ([`src/engine/powerFromLevel.ts`](src/engine/powerFromLevel.ts)) —
  the shakiest of the three: real at the level-50 cap for every rarity
  (rare 19,000 / epic 26,000 / legendary 33,000) and at rare's own levels
  41/42/46-49, everything else is a bounded power-law extrapolation
  (`maxPower × (level/50)^1.25`) — a raw cubic, unlike Power-from-Stars,
  blows up past 1,000,000 by level 1 when fit to just the known tail
  points, so this uses a shape anchored at the known cap instead. Epic and
  Legendary reuse the same exponent scaled to their own cap, same
  "shape shared, scaled by a known endpoint" approach as Power-from-Stars'
  epic/rare rows. Treat any single number here as a rough scale, not gospel.
- **Stat growth per Star Rank** (`src/admin/DragonDetail.tsx`) — +10%/+15%/+20%
  of base per star for rare/epic/legendary, starting at ★2. The ★7-10
  late-star bonus is per-rarity, not a flat +5% for everyone (that was an
  unverified extrapolation from legendary and it overshot rare): legendary
  is +5% (confirmed via real ★7/★8 data), rare is +2.5% (confirmed —
  Neill's own ★10 rare data lands on exactly base × 2.000), epic's is being
  checked separately, mythic has no data. Doesn't move with Level or
  Habits at all.

Total Power (Stars + Habits + Level) is now fully sourced from confirmed
data in `src/admin/DragonDetail.tsx` — no more free-tunable guesses for
Power, though Level's numbers carry the caveat above. Stats' mythic rate
is still a guess. None of this is wired into `src/engine/power.ts` or real
army scoring yet; that's still the original guessed formula.

## `reference/`

[`reference/dragonfire-formations-site/`](reference/dragonfire-formations-site)
is a raw snapshot of https://dragonfire-formations.com/'s client-side source
(fetched 2026-09-20), kept for comparison while building this app — see its
own README for what's in there and known gaps in its scoring model. Dragon
Command/Vanguard/Habit text is originally sourced from
[Dragonfire Hub](https://dragonfire-hub.com); keep that attribution if reused.

## Where this differs from the reference site already

- The troop-type advantage cycle (`TROOP_BEATS`) actually affects the score
  when you pick an enemy troop type — on the reference site it's shown in
  the UI but never reaches its scoring function. See the "1b" comment in
  [`src/engine/scoring.ts`](src/engine/scoring.ts).
