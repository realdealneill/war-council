// Turns scripts/habit-clauses/draft.mjs into habitCapabilities documents.
// Every value/chance literal is looked up in the real Lv1 text and read back
// out of all 5 levels (Commands: the one Command text, repeated), so a typo'd
// or misplaced number fails here instead of silently landing in Convex.
//
//   node scripts/habit-clauses/build.mjs <outDir> <dragons.json>
//     <dragons.json> = output of `npx convex run dragons:list '{}'` (for ids)
//   → <outDir>/habitCapabilities.jsonl  (for `npx convex import --table habitCapabilities --replace`)
//   → <outDir>/habit-clauses.tsv        (review sheet)
import { readFileSync, writeFileSync } from "node:fs";
import { COMMANDS, DRAFT } from "./draft.mjs";

const data = (f) => JSON.parse(readFileSync(new URL(`../../src/data/generated/${f}`, import.meta.url), "utf8"));
const HABITS = data("habits.json");
const KITS = data("kits.json");
const [outDir = ".", dragonsFile] = process.argv.slice(2);
const dragonIds = dragonsFile
  ? Object.fromEntries(JSON.parse(readFileSync(dragonsFile, "utf8")).map((d) => [d.name, d._id]))
  : {};

const NUM = /[+-]?\d+(?:\.\d+)?%?/g;
const KINDS = new Set(["stat", "dmgDealt", "dmgRecv", "recovDealt", "recovRecv", "hit", "heal", "effect", "cleanse", "cmd"]);
// A habit that modifies or adds to its dragon's Command. "(Command & Habits)"
// is just a damage-type qualifier, so it doesn't count.
const COMMAND_HABIT = /Command (deal|gains|apply|increase|reduce)|(Crescent Blade|Starfall|Blazing Fury|Feral Strike|Bronze Fury) gains/;

function makeLevels(where, texts) {
  const toks = texts.map((d) => d.match(NUM) ?? []);
  return (ref, sg) => {
    const [lit, occ = "1"] = ref.split("@");
    let seen = 0;
    const k = toks[0].findIndex((t) => t === lit && ++seen === Number(occ));
    if (k < 0) throw new Error(`${where}: "${ref}" not found in text`);
    const sign = sg ?? (lit.startsWith("-") ? "-" : "+");
    return toks.map((t) => {
      if (t[k] == null) throw new Error(`${where}: "${ref}" missing at some level`);
      const x = Math.abs(parseFloat(t[k]));
      return sign === "-" ? -x : x;
    });
  };
}

function parseTarget(t, where) {
  if (!t) return undefined;
  if (t === "self") return { side: "self" };
  const [side, countStr, ...flags] = t.split(":");
  if (!["ally", "enemy"].includes(side)) throw new Error(`${where}: bad target side in "${t}"`);
  const count = countStr === "all" ? 3 : Number(countStr);
  if (![1, 2, 3].includes(count)) throw new Error(`${where}: bad target count in "${t}"`);
  const out = { side, count };
  const pick = (prefer, filter) => Object.assign(out, { prefer, filter });
  for (const f of flags) {
    const [key, ...rest] = f.split("=");
    const val = rest.join("=");
    if (f === "other") out.other = true;
    else if (f === "adj") out.scope = "adjacent";
    else if (f === "lane") out.scope = "sameLane";
    else if (f === "most") pick("mostTroops", true);
    else if (f === "least") pick("leastTroops", true);
    else if (f === "prey") pick("prey", true);
    else if (f === "solarFlare") pick("marked:solarFlare", true);
    else if (key === "hi") pick(`highest:${val}`, true);
    else if (key === "lo") pick(`lowest:${val}`, true);
    else if (key === "deals") pick(`dealsDamage:${val}`, true);
    else if (key === "breed") pick(`breed:${val}`, true);
    else if (key === "prio")
      pick(
        ["left", "right", "vanguard"].includes(val)
          ? `lane:${val}`
          : val.replace(/^deals=/, "dealsDamage:").replace(/^breed=/, "breed:"),
        false
      );
    else throw new Error(`${where}: unknown target flag "${f}" in "${t}"`);
  }
  return out;
}

function parseTiming(at, where) {
  if (!at) return { mode: "each" };
  if (["combat", "each", "odd", "even"].includes(at)) return { mode: at };
  if (at.startsWith("on:")) return { mode: "event", event: at.slice(3) };
  if (!at.startsWith("r")) throw new Error(`${where}: bad timing "${at}"`);
  const body = at.slice(1);
  if (body.includes("-")) {
    const [a, b] = body.split("-").map(Number);
    return { mode: "rounds", rounds: Array.from({ length: b - a + 1 }, (_, i) => a + i) };
  }
  return { mode: "rounds", rounds: body.split(",").map(Number) };
}

function parseCondition(s, where) {
  const m = s.match(/^([a-zA-Z]+)(?::(.*)|([<>].*))?$/);
  if (!m) throw new Error(`${where}: bad condition "${s}"`);
  return { scope: m[1], value: m[2] ?? m[3] ?? "" };
}

function buildClause(c, lv, where) {
  if (!KINDS.has(c.k)) throw new Error(`${where}: unknown kind ${c.k}`);
  const out = {
    kind: c.k,
    what: [c.w].flat().filter(Boolean),
    timing: parseTiming(c.at ?? (c.k === "cmd" ? "combat" : undefined), where),
    conditions: [c.c].flat().filter(Boolean).map((s) => parseCondition(s, where)),
    boosts: (c.b ?? []).map((b) => {
      const boost = {};
      if (b.c) boost.condition = parseCondition(b.c, where);
      if (b.at) boost.rounds = parseTiming(b.at, where).rounds;
      if (b.v) boost.valueByLevel = lv(b.v, b.sg);
      if (b.ch) boost.chanceByLevel = lv(b.ch, "+");
      if (b.x) boost.multiplier = b.x;
      if (b.t) boost.target = parseTarget(b.t, where);
      if (b.d) boost.duration = b.d;
      return boost;
    }),
    bestAgainst: c.vs ?? [],
  };
  if (c.t) out.target = parseTarget(c.t, where);
  if (c.d != null) out.duration = c.d;
  if (c.v) out.valueByLevel = lv(c.v, c.sg);
  if (c.ch) out.chanceByLevel = lv(c.ch, "+");
  if (c.e) out.enhancedBy = c.e;
  if (c.g) out.rollGroup = c.g;
  if (c.st) out.stack = { max: c.st.max, ...(c.st.ch ? { chanceByLevel: lv(c.st.ch, "+") } : {}) };
  if (c.skip) out.skip = c.skip;
  if (c.n) out.note = c.n;
  return out;
}

const docs = [];
const tsv = [];
const commandHabits = [];
for (const [dragon, habits] of Object.entries(DRAFT)) {
  if (!HABITS[dragon] || !KITS[dragon]) throw new Error(`unknown dragon ${dragon}`);
  if (habits.length !== 5) throw new Error(`${dragon}: expected 5 habits, got ${habits.length}`);
  if (!COMMANDS[dragon]) throw new Error(`${dragon}: no Command clauses`);
  const cmdText = KITS[dragon].command;
  const skills = [
    { slot: 0, label: "Command", texts: Array(5).fill(cmdText), clauses: COMMANDS[dragon], isCommandHabit: false },
    ...habits.map((clauses, i) => {
      const texts = HABITS[dragon][i].desc;
      const isCommandHabit = COMMAND_HABIT.test(texts[0]);
      if (isCommandHabit) commandHabits.push(`${dragon} H${i + 1}`);
      return { slot: i + 1, label: `H${i + 1}`, texts, clauses, isCommandHabit };
    }),
  ];
  for (const s of skills) {
    const where = `${dragon} ${s.label}`;
    const lv = makeLevels(where, s.texts);
    const clauses = s.clauses.map((c) => buildClause(c, lv, where));
    docs.push({ dragonId: dragonIds[dragon] ?? dragon, habitSlot: s.slot, isCommandHabit: s.isCommandHabit, clauses });
    for (const c of clauses) {
      tsv.push([
        dragon, s.label + (s.isCommandHabit ? " (cmd habit)" : ""), c.kind, c.what.join("+"), JSON.stringify(c.target ?? ""),
        JSON.stringify(c.timing), c.duration ?? "", c.valueByLevel?.join(" / ") ?? "", c.chanceByLevel?.join(" / ") ?? "",
        c.conditions.map((x) => `${x.scope}:${x.value}`).join("; "), c.boosts.length ? JSON.stringify(c.boosts) : "",
        c.enhancedBy ?? "", c.stack ? JSON.stringify(c.stack) : "", c.skip ?? "", c.bestAgainst.join("; "), c.note ?? "", s.texts[0],
      ]);
    }
  }
}

if (dragonsFile) {
  const missing = docs.filter((d) => !d.dragonId.startsWith("j")).map((d) => d.dragonId);
  if (missing.length) throw new Error(`no Convex id for: ${[...new Set(missing)].join(", ")}`);
}
const clean = (s) => String(s).replace(/[\t\n]/g, " ");
const header = ["Dragon", "Skill", "Kind", "What", "Target", "Timing", "Duration", "Value Lv1-5", "Chance Lv1-5", "Conditions", "Boosts", "Enhanced by", "Stack", "Skip", "Best against", "Note", "Text"];
writeFileSync(`${outDir}/habit-clauses.tsv`, [header, ...tsv].map((r) => r.map(clean).join("\t")).join("\n"));
writeFileSync(`${outDir}/habitCapabilities.jsonl`, docs.map((d) => JSON.stringify(d)).join("\n") + "\n");
console.log(`${docs.length} skill docs, ${tsv.length} clauses`);
console.log(`Command habits (${commandHabits.length}): ${commandHabits.join(", ")}`);
