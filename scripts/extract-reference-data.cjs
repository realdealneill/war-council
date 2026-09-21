// Regenerates src/data/generated/*.json from the reference site's own
// js/data.js, js/kits.js and js/habits.js (see ../reference/README.md).
// Those files are plain browser scripts that build up `window.GAME` — this
// runs them in a sandboxed VM with a fake `window` and dumps the result, so
// the 36-dragon roster/kit/habit data never has to be hand-transcribed.
//
// Run after refreshing reference/dragonfire-formations-site/js/*.js:
//   node scripts/extract-reference-data.cjs
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const REF = path.join(__dirname, "..", "reference", "dragonfire-formations-site", "js");
const OUT = path.join(__dirname, "..", "src", "data", "generated");

const sandbox = { window: {}, console };
vm.createContext(sandbox);

for (const f of ["habits.js", "kits.js", "data.js"]) {
  const code = fs.readFileSync(path.join(REF, f), "utf8");
  vm.runInContext(code, sandbox, { filename: f });
}

const GAME = sandbox.window.GAME;
const dragons = GAME.seedDragons();

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "dragons.json"), JSON.stringify(dragons, null, 2));
fs.writeFileSync(path.join(OUT, "kits.json"), JSON.stringify(GAME.DRAGON_KITS, null, 2));
fs.writeFileSync(path.join(OUT, "habits.json"), JSON.stringify(GAME.DRAGON_HABITS, null, 2));
fs.writeFileSync(
  path.join(OUT, "model.json"),
  JSON.stringify(
    {
      TROOP_TYPES: GAME.TROOP_TYPES,
      TROOP_BEATS: GAME.TROOP_BEATS,
      POSITIONS: GAME.POSITIONS,
      RARITIES: GAME.RARITIES,
      DAMAGE_TYPES: GAME.DAMAGE_TYPES,
      ROLES: GAME.ROLES,
      BREEDS: GAME.BREEDS,
      EFFECTS: GAME.EFFECTS,
      CONTROL_EFFECTS: GAME.CONTROL_EFFECTS,
      HABIT_UNLOCK_STARS: GAME.HABIT_UNLOCK_STARS,
      HABIT_MAX_LEVEL: GAME.HABIT_MAX_LEVEL,
    },
    null,
    2
  )
);

console.log("dragons:", dragons.length);
console.log("kits:", Object.keys(GAME.DRAGON_KITS).length);
console.log("habits:", Object.keys(GAME.DRAGON_HABITS).length);
