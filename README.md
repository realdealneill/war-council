# Dragonfire Formations (custom)

A formation optimizer for *Game of Thrones: Dragonfire*, built from scratch
as a from-first-principles alternative to https://dragonfire-formations.com/.

Stack: React 19 + Vite + TypeScript + Tailwind v4 + Convex. The 36-dragon
*catalog* (species-level attributes — rarity, breed, role, base stats) lives
in Convex; your personal *roster* (which dragons you've added, star rank,
active toggle) stays in `localStorage` (see
[`src/hooks/useRoster.ts`](src/hooks/useRoster.ts)) — no cross-device sync
for that yet.

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
  - `power.ts` — power estimation, goal-adjusted power
  - `effects.ts` — a dragon's unlocked Command/Habit effects at its star rank
  - `scoring.ts` — `evaluatePlacement()` / `bestArmy()`, the synergy model
  - `optimizer.ts` — partitions a roster into armies (greedy seed + local search)
- [`convex/schema.ts`](convex/schema.ts) / [`convex/dragons.ts`](convex/dragons.ts) —
  the `dragons` catalog table + `list`/`updateStats`/`seed` functions
- [`src/hooks/useCatalog.ts`](src/hooks/useCatalog.ts) — the catalog, loaded from Convex
- [`src/hooks/useRoster.ts`](src/hooks/useRoster.ts) — roster persistence (local)
- [`src/admin/DragonStatsAdmin.tsx`](src/admin/DragonStatsAdmin.tsx) — dense
  base-stat entry form at the hidden `/admin/dragon-stats` route (not linked
  from the app; see `src/main.tsx`)
- [`src/components/`](src/components) — UI

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
