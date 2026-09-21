# Reference: dragonfire-formations.com (as of 2026-09-20)

This folder is a raw snapshot of the client-side source of
https://dragonfire-formations.com/ — a free, fan-made formation optimizer for
*Game of Thrones: Dragonfire*. It's kept here **for reference only**, so
future agents/prompts working on this repo's own optimizer can compare
approaches without re-fetching the site.

The entire site is static HTML/CSS/JS with no build step or minification —
everything below is exactly what the site serves to any visitor's browser.
The only backend involved (`js/cloud.js`) is optional Supabase auth for
cross-device roster sync; it has nothing to do with scoring or optimization.

## Files

- `index.html` — page markup (dragon editor form, roster panel, formation UI)
- `css/styles.css` — all styling
- `js/config.js` — Supabase keys placeholder (unset in the fetched copy)
- `js/data.js` — game model (troop types, roles, breeds, rarities) + the
  36-dragon seed roster (rarity, breed, role, real troop affinities)
- `js/kits.js` — **generated** (per its own header comment, by
  `scripts/build-kits.mjs`, not included here) — each dragon's Command skill,
  Vanguard skill, and per-star-rank effect list (`applies`/`grants`/`self`/`wants`)
- `js/habits.js` — full habit skill text per dragon per star rank (large; mostly
  human-readable flavor/ability text, not logic)
- `js/scoring.js` — the actual synergy/scoring model: `evaluatePlacement()`
  and `bestArmy()`. This is the algorithm behind "why does this formation
  score well."
- `js/optimizer.js` — `optimize()`: partitions a roster into up to 10 armies
  via a greedy seed + iterated local search (swaps/moves), calling into
  `scoring.js` for the exact within-army placement search.
- `js/app.js` — UI wiring (DOM rendering, form handling, roster CRUD)
- `js/cloud.js` — optional Google-sign-in + Supabase roster sync

## Attribution

Per the site's own footer/credits: dragon Command skills, Vanguard skills,
and Habit wording are sourced from **Dragonfire Hub**
(https://dragonfire-hub.com). The site itself is an unofficial fan tool, not
affiliated with the game's publisher. If our own app reuses any of this
text/data verbatim, keep the same attribution.

## Known gaps / ideas for improving on it (see scoring.js + optimizer.js)

- `TROOP_BEATS` (the troop-type advantage cycle) is defined in `data.js` but
  never actually consumed by `scoring.js` — it's decorative only.
- All synergy weights (affinity %, `WANT_VALUE` table, mitigation/recovery
  conversion factors, etc.) are hand-tuned constants with no calibration
  against real battle outcomes.
- The optimizer maximizes *total* score across all armies, not e.g. the
  weakest army, or round-by-round survivability.
- Vanguard flank-buff "wasted" detection only checks damage-type mismatch,
  not other buff types landing on a role that can't use them.
