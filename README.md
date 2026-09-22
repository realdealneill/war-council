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
  - `powerFromStars.ts` / `powerFromHabits.ts` — **confirmed** real power
    values by rarity, from Star Rank and from Habits (see "Confirmed game
    constants" below) — not yet wired into `power.ts`/live scoring, only
    into the admin sandbox
  - `effects.ts` — a dragon's unlocked Command/Habit effects at its star rank
  - `scoring.ts` — `evaluatePlacement()` / `bestArmy()`, the synergy model
  - `optimizer.ts` — partitions a roster into armies (greedy seed + local search)
- [`convex/schema.ts`](convex/schema.ts) / [`convex/dragons.ts`](convex/dragons.ts) —
  the `dragons` catalog table + `list`/`updateStats`/`seed` functions
- [`src/hooks/useCatalog.ts`](src/hooks/useCatalog.ts) — the catalog, loaded from Convex
- [`src/hooks/useRoster.ts`](src/hooks/useRoster.ts) — roster state (in-memory only, no persistence yet)
- [`src/admin/`](src/admin) — hidden-ish admin pages, linked from a small nav
  bar (`src/components/AdminNav.tsx`) rather than the main app UI:
  - `DragonStatsAdmin.tsx` (`/admin/dragon-stats`) — dense base-stat entry form
  - `DragonDetail.tsx` — per-dragon Power/Stats growth calculator, reached by
    clicking a dragon on the stats page; a pure sandbox, doesn't affect live scoring
  - `SynergyRules.tsx` (`/admin/synergy-rules`) — read-only view of every
    scoring weight and per-dragon kit effect the real engine uses
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
- **Stat growth per Star Rank** (`src/admin/DragonDetail.tsx`) — +10%/+15%/+20%
  of base per star for rare/epic/legendary, starting at ★2, with an extra
  +5% for ★7-10. Doesn't move with Level or Habits at all. Mythic's rate is
  extrapolated, not confirmed.

Power's contribution from Level, and Stats' mythic rate, are still guesses
— see the tunable inputs on `DragonDetail.tsx` for those. Once Level is
confirmed too, Total Power will just be the sum of all three.
None of this (confirmed or guessed) is wired into `src/engine/power.ts` or
real army scoring yet; that's still the original guessed formula.

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
