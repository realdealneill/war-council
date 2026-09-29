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
- [`convex/habitCapabilities.ts`](convex/habitCapabilities.ts) — every
  dragon's Command skill (`habitSlot` 0) and 5 Habits (1-5), each broken into
  structured **clauses**, one per mechanic; see "Skill clauses" below
- [`src/engine/habitClauses.ts`](src/engine/habitClauses.ts) — clause types,
  round/duration math, the assumed troop curve and lane-reach rules, and the
  plain-English clause summaries the builder shows
- [`scripts/habit-clauses/`](scripts/habit-clauses) — `draft.mjs` (the
  hand-written clause breakdown of all 180 habits + 36 Commands) and
  `build.mjs` (checks every number against the real text and emits the
  Convex import file)
- [`src/hooks/useCatalog.ts`](src/hooks/useCatalog.ts) — the catalog, loaded from Convex
- [`src/hooks/useRoster.ts`](src/hooks/useRoster.ts) — roster state (in-memory only, no persistence yet)
- [`src/admin/`](src/admin) — hidden-ish admin pages, linked from a small nav
  bar (`src/components/AdminNav.tsx`) rather than the main app UI:
  - `DragonStatsAdmin.tsx` (`/admin/dragon-stats`) — dense base-stat entry form
  - `DragonDetail.tsx` — per-dragon Power/Stats growth calculator, reached by
    clicking a dragon on the stats page; a pure sandbox, doesn't affect live scoring
  - `SynergyRules.tsx` (`/admin/synergy-rules`) — read-only view of every
    scoring weight and per-dragon kit effect the real engine uses
  - `HabitBuilder.tsx` (`/admin/habit-builder`) — pick a dragon, pick its
    Command or one of its 5 habits, read the real text, and review/edit its
    clauses (each shown as a one-line summary, click Edit for the full form)
- [`src/components/`](src/components) — UI

## Skill clauses

Each Command/Habit is a list of clauses. A clause is one mechanic: a stat
change, Damage Dealt/Received or Recovery Dealt/Received modifier, a damage
hit, a heal, an applied effect, a cleanse, or a Command modifier — with who
it hits, when and for how long, its value and chance at each of the 5 habit
levels, conditions that gate it, boosts that raise it ("doubled vs Taunted
targets"), "enhanced by" stat, stacking, and shared-roll grouping. Values are
signed by real direction: Damage Received −4 means taking 4% less. Commands
have no levels, so their values repeat 5 times. `isCommandHabit` flags the
Habits that modify or add to the Command (mostly the ★6 one).

Clauses that can't be optimized for are kept but marked `skip`
(`enemyDep`: depends on what the enemy brings, e.g. cleansing enemy buffs;
`pve`, `nonCombat`, or a `situational` trigger like "when an enemy
retreats"). Clauses that only pay off against certain enemies carry
`bestAgainst` tags (e.g. "High-recovery armies", "Fire damage dealers") so a
formation can be summarized as "Best against…".

Rules for scoring these (Neill's calls, encoded in
`src/engine/habitClauses.ts`):
- **Adjacency**: the Vanguard reaches all 3 lanes (itself included); a flank
  reaches only itself and the Vanguard.
- **Ally counts**: "3 Allies" always includes the dragon itself; "N (other)
  Allies" for N < 3 picks N of the 3, possibly including itself.
- **Enemy lane priorities** ("prioritizes the Left Flank") are ignored: an
  enemy Fire Damage Received increase helps every one of our Fire dealers.
- **Troop capacity** is assumed, not known: a 10-round fight at
  95/85/75/65/55/45/35/25/15/5% by round (above 75% rounds 1-2, below 50% the
  final 5 rounds), used for both sides' troop conditions.
- **Enhanced by** a stat: formula unknown (probably small); stored, treated as
  flat for now.

To regenerate from the draft (this **replaces** the whole table, including
any edits made in the builder):

```bash
npx convex run dragons:list '{}' > dragons.json
node scripts/habit-clauses/build.mjs . dragons.json
npx convex import --table habitCapabilities --replace --yes habitCapabilities.jsonl
```

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
