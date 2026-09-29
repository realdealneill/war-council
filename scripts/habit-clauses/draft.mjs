// Every habit's (and, below, every Command's) text broken into structured
// clauses — the source the habitCapabilities table was first seeded from.
// Edits made later in /admin/habit-builder live only in Convex; re-importing
// from here replaces them. Resolve + validate with scripts/habit-clauses/build.mjs.
//
// Clause keys (short on purpose, 180 habits of these):
//   k   kind: stat | dmgDealt | dmgRecv | recovDealt | recovRecv | hit (a damage instance) |
//             heal (a recovery instance) | effect (apply a status) | cleanse | cmd (modifies the Command skill)
//   w   what: stat name(s), damage type(s) ("physical(CH)" = Command & Habits only, excludes basic
//             attacks), or effect id
//   v   value: a number literal copied from the Lv1 text ("+11%", "-9%@2" = 2nd occurrence); the
//             build step pulls that same number out of all 5 levels' text. Sign = the stat's actual
//             direction (negative = lower); `sg` overrides where the game text's sign is wrong
//   ch  chance literal (same lookup as v); omitted = guaranteed
//   t   target: self | ally:N[:other][:adj][:prio=lane][:hi=stat][:deals=type][:breed=x][:most|:least]
//               enemy:N|all[:adj][:lane][:prio=...][:hi=stat|:lo=stat][:deals=type][:most|:least][:prey]
//   at  when: combat | rN | rA-B | r1,3,6,8 | each | odd | even | on:<event>
//   d   duration in rounds, or "combat" / "round" (defaults: combat→combat, each/odd/even/rA-B→round)
//   c   condition(s) gating the clause: target:<effect> self:<effect> anyAlly:<effect> anyEnemy:<effect>
//       troop:<type> selfTroops<N targetTroops>N enemyComp:<...> stacks:<name>>=N defending pve
//   b   boosts: [{ c|at, v|ch|x|d|t }] — a condition that raises the value/chance instead of gating it
//   e   "enhanced by" stat
//   g   shared-roll group (clauses with the same g on one habit come from one chance roll)
//   st  per-stack value: { ch, max, at } (value applies once per stack held)
//   skip reason this clause can't be optimized for (enemyDep | situational | pve | nonCombat | cmdDep)
//   n   note

export const DRAFT = {
  Antares: [
    [
      { k: "dmgRecv", w: "fire", v: "+11%", t: "enemy:1:prio=left", at: "r1", d: 3 },
      { k: "dmgRecv", w: "physical(CH)", v: "+11%", t: "enemy:1:prio=right", at: "r1", d: 3 },
    ],
    [{ k: "dmgDealt", w: "fire", v: "+8%", t: "self", at: "combat" }],
    [{ k: "hit", w: "fire", v: "+20%", t: "enemy:3", at: "each", c: "target:slow", n: "Command damage, only vs Slowed targets" }],
    [
      { k: "dmgRecv", w: "all", v: "-4%", t: "self", at: "combat" },
      { k: "stat", w: "intelligence", v: "+5%", t: "self", at: "combat" },
    ],
    [
      { k: "stat", w: ["intelligence", "initiative"], v: "+6%", t: "self", at: "combat" },
      { k: "effect", w: "immunity", ch: "10%", t: "self", at: "each", d: 2, n: "Immunity to Vulnerable + Weakened" },
    ],
  ],
  Arrax: [
    [
      { k: "stat", w: "strength", v: "+25%", t: "self", at: "r4", d: 4 },
      { k: "stat", w: "initiative", v: "+10%", t: "self", at: "r4", d: 4 },
      { k: "dmgDealt", w: "physical", v: "+25%@2", t: "self", at: "r4", d: 4 },
      { k: "dmgRecv", w: "physical", v: "-10%", sg: "+", t: "self", at: "r4", d: 4, n: "drawback, shrinks to 0 by Lv5" },
      { k: "stat", w: "instinct", v: "-40%", t: "self", at: "r4", d: 4, n: "drawback, shrinks to 0 by Lv5" },
    ],
    [{ k: "dmgRecv", w: ["tactical", "fire"], v: "-2.5%", t: "ally:2:other", at: "combat" }],
    [
      { k: "dmgRecv", w: "tactical", v: "-9%", t: "ally:3", at: "r4", d: 4, c: "troop:archers" },
      { k: "dmgRecv", w: "fire", v: "-9%@2", t: "ally:3", at: "r4", d: 4, c: "troop:shieldbearers" },
    ],
    [
      { k: "dmgRecv", w: "fire", v: "-5%", t: "self", at: "combat", n: "Fire Ward; +1 stack each round after the warded ally retreats" },
      { k: "dmgRecv", w: "fire", v: "-5%", t: "ally:1:other:adj", at: "combat", n: "Fire Ward" },
    ],
    [{ k: "dmgRecv", w: "physical", v: "+9%", t: "enemy:2:adj", at: "r4", d: 4 }],
  ],
  Arulix: [
    [
      { k: "effect", w: "overwhelm", ch: "12.5%", t: "enemy:1:prio=deals=fire", at: "r1,3,6,8", d: 2 },
      { k: "effect", w: "stagger", ch: "12.5%@2", t: "enemy:1:prio=deals=physical", at: "r2,4,7,9", d: 2 },
    ],
    [{ k: "stat", w: ["strength", "intelligence"], v: "-4%", t: "enemy:3", at: "combat", e: "instinct" }],
    [
      {
        k: "hit", w: "physical", v: "+20%", t: "enemy:2", at: "r1,2,3,5,8",
        b: [{ at: "r5", v: "+30%" }, { at: "r8", v: "+40%" }],
      },
    ],
    [{ k: "dmgRecv", w: ["physical(CH)", "fire"], v: "-2.5%", t: "ally:2:other", at: "combat" }],
    [
      { k: "effect", w: "copyDebuff", ch: "25%", t: "enemy:1", at: "each", d: 2, skip: "enemyDep", n: "copies Weakened/Vulnerable the enemy put on us", vs: ["Armies that apply Weakened/Vulnerable"] },
      { k: "effect", w: "copyBuff", ch: "25%@2", t: "ally:1", at: "each", d: 2, skip: "enemyDep", n: "copies Advantage/Resistance an enemy has", vs: ["Armies that use Advantage/Resistance"] },
    ],
  ],
  Bevlorin: [
    [
      { k: "dmgRecv", w: "fire(CH)", v: "-5%", t: "self", at: "combat", n: "Fire Ward; +1 stack each round after the warded ally retreats" },
      { k: "dmgRecv", w: "fire(CH)", v: "-5%", t: "ally:1:other:adj", at: "combat", n: "Fire Ward" },
    ],
    [{ k: "dmgDealt", w: ["physical(CH)", "fire"], v: "+4%", t: "self", at: "combat" }],
    [{ k: "heal", v: "+17.5%", t: "ally:3", at: "odd", e: "strength" }],
    [
      { k: "stat", w: "strength", v: "+10%", t: "self", at: "combat" },
      { k: "recovDealt", v: "+15%", t: "self", at: "combat" },
    ],
    [
      { k: "stat", w: "strength", v: "+16%", ch: "20%", t: "ally:1:hi=strength", at: "each", d: 2 },
      { k: "stat", w: "intelligence", v: "+16%", ch: "20%", t: "ally:1:hi=intelligence", at: "each", d: 2 },
      { k: "stat", w: "instinct", v: "+16%", ch: "20%", t: "ally:1:hi=instinct", at: "each", d: 2 },
      { k: "stat", w: "initiative", v: "+16%", ch: "20%", t: "ally:1:hi=initiative", at: "each", d: 2 },
    ],
  ],
  Caraxes: [
    [{ k: "stat", w: ["strength", "initiative"], v: "-6.5%", t: "enemy:3", at: "combat", e: "intelligence" }],
    [{ k: "dmgDealt", w: "fire", v: "+12.5%", t: "self", at: "combat" }],
    [
      { k: "effect", w: "slow", ch: "10%", t: "enemy:3", at: "each", d: 2, n: "rolled per target" },
      { k: "effect", w: "burn", v: "+20%", ch: "10%", t: "enemy:3", at: "each", d: 2, n: "rolled per target; v = burn damage rate" },
    ],
    [{ k: "dmgDealt", w: "physical(CH)", v: "-5.5%", t: "enemy:3", at: "combat" }],
    [
      { k: "dmgDealt", w: "fire", v: "+8%", t: "self", at: "each", c: "targetTroops<50", n: "per enemy below 50% troops" },
      { k: "heal", v: "+40%", t: "self", at: "on:enemyRetreat", e: "initiative", skip: "situational" },
    ],
  ],
  Crimson: [
    [{ k: "dmgDealt", w: "tactical", v: "-13.5%", t: "enemy:1:deals=tactical", at: "combat", c: "enemyComp:dealsTactical", vs: ["Tactical damage dealers"] }],
    [
      { k: "dmgRecv", w: "all", v: "-6%", t: "self", at: "combat" },
      { k: "stat", w: "intelligence", v: "+12%", t: "self", at: "combat" },
    ],
    [
      {
        k: "effect", w: "weakened", v: "-20%", ch: "17.5%", t: "enemy:1:prio=notStunned", at: "each", d: 2,
        b: [{ c: "target:taunt", ch: "35%" }],
      },
    ],
    [
      { k: "dmgRecv", w: ["physical(CH)", "fire"], v: "+10%", t: "enemy:all", at: "each", c: "targetTroops>75" },
      { k: "recovRecv", v: "-20%", t: "enemy:all", at: "each", c: "targetTroops<25", vs: ["High-recovery armies"] },
    ],
    [
      { k: "stat", w: ["instinct", "initiative"], v: "-12%", ch: "50%", t: "enemy:1:hi=instinct", at: "even", d: 2, e: "intelligence" },
      { k: "cmd", w: "stun", ch: "40%", at: "r1", n: "Command's own Stun chance raised to 40% on Round 1" },
    ],
  ],
  Daemoros: [
    [
      { k: "stat", w: ["intelligence", "instinct"], v: "-25%", ch: "25%", t: "enemy:1:prio=right", at: "each", d: 2, e: "strength", g: 1 },
      { k: "effect", w: "panic", v: "+20%", ch: "25%", t: "enemy:1:prio=right", at: "each", d: 2, g: 1 },
    ],
    [{ k: "stat", w: ["strength", "initiative"], v: "+16%", t: "self", at: "combat" }],
    [{ k: "effect", w: "confusion", ch: "15%", t: "enemy:1:adj", at: "odd", d: 2 }],
    [
      { k: "stat", w: ["intelligence", "instinct"], v: "-25%", ch: "25%", t: "enemy:1:prio=left", at: "each", d: 2, e: "strength", g: 1, n: "scraped text says 'Each Round 1'; confirmed Each Round in-game" },
      { k: "effect", w: "panic", v: "+20%", ch: "25%", t: "enemy:1:prio=left", at: "each", d: 2, g: 1 },
    ],
    [{ k: "dmgRecv", w: "oneOf:physical,tactical,fire", v: "-15%", t: "self", at: "each", n: "one random type each round" }],
  ],
  Dawnseeker: [
    [
      { k: "dmgDealt", w: "tactical", v: "+9%", t: "ally:1:prio=left", at: "r1", d: 3 },
      { k: "dmgDealt", w: "fire", v: "+9%", t: "ally:1:prio=right", at: "r1", d: 3 },
    ],
    [{ k: "recovRecv", v: "+15%", t: "ally:2:other", at: "combat" }],
    [
      { k: "cmd", w: "tactical", v: "+100%", at: "r1-2", n: "Command's Tactical damage rate raised to this on Rounds 1-2" },
      { k: "cmd", w: "recovery", v: "+60%", at: "r1-2", n: "Command's Recovery rate raised to this on Rounds 1-2" },
    ],
    [{ k: "stat", w: "initiative", v: "+8%", t: "ally:3", at: "combat", e: "initiative" }],
    [
      { k: "stat", w: ["intelligence", "instinct"], v: "+5%", t: "ally:3", at: "r1", d: 3, e: "initiative" },
      { k: "effect", w: "firstStrike", ch: "20%", t: "ally:2:other", at: "r1-3", d: "round" },
    ],
  ],
  Feskar: [
    [
      { k: "dmgRecv", w: "physical(CH)", v: "-6.5%", t: "self", at: "combat", n: "Resilient Bond; +1 stack each round after the bonded ally retreats" },
      { k: "dmgRecv", w: "physical(CH)", v: "-6.5%", t: "ally:1:other:adj", at: "combat", n: "Resilient Bond" },
    ],
    [{ k: "stat", w: "instinct", v: "+10%", t: "ally:3", at: "combat", e: "instinct" }],
    [
      {
        k: "hit", w: "fire", v: "+40%", t: "enemy:all:deals=physical", at: "r3,5,8,10", c: "enemyComp:dealsPhysical",
        b: [{ c: "target:burn", v: "+60%" }], vs: ["Physical damage dealers"],
      },
    ],
    [{ k: "stat", w: ["intelligence", "initiative"], v: "+16%", t: "self", at: "combat" }],
    [{ k: "effect", w: "stagger", ch: "10%", t: "enemy:1:prio=breed=warrior", at: "each", d: 3, vs: ["Warriors"] }],
  ],
  Jagadrix: [
    [{ k: "dmgDealt", w: "tactical", v: "-8%", t: "enemy:1:deals=tactical", at: "combat", c: "enemyComp:dealsTactical", vs: ["Tactical damage dealers"] }],
    [
      { k: "dmgDealt", w: "all", v: "+10%", t: "self", at: "r6", d: "combat" },
      { k: "heal", v: "+150%", t: "self", at: "r6" },
      { k: "effect", w: "nullifyRecovery", t: "self", at: "r6", d: "combat", n: "drawback: can't be healed from Round 6 on" },
    ],
    [{ k: "effect", w: "weakened", v: "-10%", ch: "25%", t: "enemy:1:lane", at: "each", d: 2 }],
    [{ k: "stat", w: ["intelligence", "initiative"], v: "+12.5%", t: "self", at: "combat" }],
    [
      { k: "stat", w: ["instinct", "initiative"], v: "-6%", t: "enemy:1:hi=instinct", at: "r1", d: "combat", e: "initiative" },
      { k: "hit", w: "fire", v: "+30%", t: "enemy:all:deals=tactical", at: "r3,6,9", c: "enemyComp:dealsTactical", b: [{ c: "target:panic", x: 2 }], vs: ["Tactical damage dealers"] },
    ],
  ],
  Kalspire: [
    [{ k: "stat", w: ["strength", "instinct"], v: "+20%", t: "self", at: "combat" }],
    [{ k: "stat", w: ["strength", "intelligence"], v: "-6.5%", t: "enemy:3", at: "combat", e: "instinct" }],
    [
      { k: "hit", w: "physical", v: "+25%", t: "enemy:1:adj", at: "on:basicAttack", n: "not the basic attack's own target" },
      { k: "effect", w: "panic", ch: "15%", t: "enemy:2:adj", at: "on:basicAttack", d: 2, n: "rolled per target" },
    ],
    [
      { k: "dmgRecv", w: "all", v: "-6%", t: "self", at: "combat" },
      { k: "stat", w: "instinct", v: "+12%", t: "self", at: "combat" },
    ],
    [
      { k: "dmgRecv", w: "all", v: "-50%", t: "self", at: "r1", d: 1 },
      { k: "effect", w: "stun", t: "self", at: "r1", d: 1, n: "drawback: stuns yourself Round 1" },
      { k: "dmgDealt", w: "physical(CH)", v: "-10%", t: "enemy:1:hi=strength", at: "r2", d: 5 },
      { k: "dmgDealt", w: "fire", v: "-10%", t: "enemy:1:hi=intelligence", at: "r2", d: 5 },
    ],
  ],
  Malachite: [
    [
      { k: "dmgDealt", w: "physical(CH)", v: "+8%", ch: "35%", t: "ally:2:other", at: "each", d: 2, g: 1 },
      { k: "dmgRecv", w: "tactical", v: "-8%", ch: "35%", t: "ally:2:other", at: "each", d: 2, g: 1 },
    ],
    [
      { k: "stat", w: "instinct", v: "+20%", t: "self", at: "combat" },
      { k: "recovDealt", v: "+20%@2", t: "self", at: "combat" },
    ],
    [{ k: "effect", w: "advantage", v: "+20%", ch: "10%", t: "ally:2:other", at: "each", d: 2 }],
    [{ k: "stat", w: "strength", v: "12.5%", t: "ally:3", at: "combat", e: "strength" }],
    [
      { k: "effect", w: "firstStrike", ch: "40%", t: "ally:1:other:adj", at: "r1", d: 3, g: 1 },
      { k: "effect", w: "doubleStrike", ch: "40%", t: "ally:1:other:adj", at: "r1", d: 3, g: 1 },
      { k: "stat", w: "strength", v: "+25%", ch: "40%", t: "ally:1:other:adj", at: "r1", d: 3, e: "instinct", g: 1 },
    ],
  ],
  Moondancer: [
    [
      { k: "effect", w: "risingTide", ch: "25%", t: "self", at: "r1,3,5", d: "combat", b: [{ c: "anyAlly:advantage", ch: "50%" }], n: "+1 Rising Tide stack" },
      { k: "stat", w: "instinct", v: "+9%", t: "ally:1:other:breed=sentinel", at: "odd", d: 2, e: "initiative", b: [{ c: "stacks:risingTide>=4", v: "+13.5%" }] },
      { k: "dmgDealt", w: "tactical", v: "+6%", t: "ally:1:other:breed=sentinel", at: "odd", d: 2, b: [{ c: "stacks:risingTide>=4", v: "+9%@2" }] },
    ],
    [
      { k: "stat", w: "instinct", v: "+22%", t: "ally:1:hi=instinct", at: "combat", e: "strength" },
      { k: "stat", w: "initiative", v: "+11%", t: "ally:1:hi=instinct", at: "combat", e: "strength" },
    ],
    [
      { k: "effect", w: "risingTide", ch: "25%", t: "self", at: "r6,8,10", d: "combat", b: [{ c: "anyAlly:advantage", ch: "50%" }], n: "+1 more stack if you have the fewest troops" },
      { k: "cmd", w: "physical", v: "+85%", b: [{ c: "stacks:risingTide>=4", v: "+170%" }], n: "Crescent Blade physical damage rate" },
    ],
    [
      { k: "dmgDealt", w: "physical", v: "+12.5%", t: "self", at: "each", c: "stacks:risingTide>=4" },
      { k: "effect", w: "bleed", ch: "25%", t: "enemy:2:adj", at: "odd", d: 2, b: [{ c: "stacks:risingTide>=6", ch: "50%" }] },
    ],
    [
      { k: "dmgDealt", w: "all", v: "-18%", ch: "20%", t: "enemy:1:most", at: "each", d: 2, b: [{ c: "stacks:risingTide>=6", ch: "40%" }] },
      { k: "stat", w: "initiative", v: "-25%", ch: "40%", t: "enemy:1:most", at: "each", d: 2, e: "initiative", c: "stacks:risingTide>=6" },
    ],
  ],
  Nyrena: [
    [{ k: "stat", w: ["strength", "initiative"], v: "-4%", t: "enemy:3", at: "combat", e: "intelligence" }],
    [{ k: "stat", w: ["intelligence", "instinct"], v: "+4%", t: "ally:3", at: "combat", e: "initiative" }],
    [
      { k: "dmgDealt", w: "fire", v: "+8%", t: "self", at: "r1", d: 5 },
      { k: "dmgDealt", w: "fire", v: "+12%", t: "ally:1:adj", at: "r6", d: 5 },
      { k: "dmgDealt", w: "tile", t: "self", at: "on:afterCombat", skip: "nonCombat" },
    ],
    [{ k: "dmgDealt", w: ["tactical", "fire"], v: "+4%", t: "self", at: "combat" }],
    [{ k: "dmgRecv", w: "physical", v: "-5%", t: "ally:3", at: "r6-10", b: [{ c: "defending", v: "-10%" }] }],
  ],
  Rhysarion: [
    [
      { k: "dmgDealt", w: "all", v: "-27.5%", t: "enemy:all", at: "r1", d: 3 },
      { k: "dmgDealt", w: "all", v: "-27.5%", t: "ally:3", at: "r1", d: 3, n: "drawback: hits your own side too" },
      { k: "heal", v: "+25%", t: "ally:3", at: "r4", e: "strength" },
    ],
    [{ k: "stat", w: ["strength", "intelligence"], v: "+16%", t: "self", at: "combat" }],
    [{ k: "heal", v: "+60%", t: "ally:2:other", at: "r2,5,8", e: "intelligence" }],
    [{ k: "recovRecv", v: "20%", t: "ally:2", at: "combat" }],
    [
      { k: "stat", w: "initiative", v: "+20%", ch: "20%", t: "ally:1:other:adj", at: "each", d: 3, e: "intelligence", g: 1 },
      { k: "effect", w: "resistance", v: "-15%", ch: "20%", t: "ally:1:other:adj", at: "each", d: 3, g: 1 },
    ],
  ],
  Seasmoke: [
    [
      { k: "stat", w: "intelligence", v: "+22%", t: "ally:1:hi=intelligence", at: "combat" },
      { k: "stat", w: "initiative", v: "+12.5%", t: "ally:1:hi=intelligence", at: "combat" },
    ],
    [{ k: "stat", w: "initiative", v: "12.5%", t: "ally:3", at: "combat", e: "initiative" }],
    [
      { k: "recovRecv", v: "-15%", t: "enemy:1", at: "on:cleanseEnemy", d: 3, st: { max: 3 }, skip: "enemyDep", n: "Infectious Wrath, only when the Command cleanses an enemy buff", vs: ["High-recovery armies","Buff-heavy armies"] },
      { k: "hit", w: "physical", v: "+30%", t: "enemy:2:adj", at: "r3,6,9", b: [{ c: "target:panic", v: "+60%" }] },
    ],
    [
      { k: "stat", w: "intelligence", v: "+7.5%", t: "ally:2:adj", at: "combat", e: "instinct" },
      { k: "dmgDealt", w: "fire", v: "+5%", t: "ally:2:adj", at: "combat" },
    ],
    [
      { k: "effect", w: "advantage", v: "+20%", ch: "10%", t: "ally:2:other", at: "each", d: 2, c: "targetTroops>50" },
      { k: "effect", w: "resistance", v: "-20%", ch: "10%@2", t: "ally:2:other", at: "each", d: 2, c: "targetTroops<50" },
    ],
  ],
  Shadowrend: [
    [{ k: "stat", w: ["strength", "instinct"], v: "+40%", t: "ally:3", at: "r7-10", e: "initiative" }],
    [
      { k: "dmgRecv", w: "all", v: "-4%", t: "self", at: "combat" },
      { k: "stat", w: "initiative", v: "+5%", t: "self", at: "combat" },
    ],
    [{ k: "effect", w: "advantage", v: "+10%", ch: "10%", t: "ally:2", at: "each", d: 2, b: [{ at: "r7-10", ch: "20%" }] }],
    [{ k: "dmgDealt", w: ["physical", "tactical"], v: "+7%", t: "ally:3", at: "r7-10" }],
    [{ k: "hit", w: ["physical", "tactical"], v: "+100%", t: "enemy:3", at: "r9", n: "rate applies per type" }],
  ],
  Shadowsong: [
    [{ k: "stat", w: ["instinct", "initiative"], v: "-18%", t: "enemy:2:adj", at: "r1", d: 3, e: "intelligence" }],
    [
      { k: "dmgRecv", w: "fire", v: "+15%", t: "enemy:1:prio=left", at: "r1", d: 3 },
      { k: "dmgRecv", w: "physical(CH)", v: "+15%", t: "enemy:1:prio=right", at: "r1", d: 3 },
    ],
    [{ k: "effect", w: "vulnerable", v: "+15%", ch: "10%", t: "enemy:2:adj", at: "each", d: 2, b: [{ c: "target:panic", ch: "+20%" }] }],
    [
      { k: "dmgRecv", w: "all", v: "-5%", t: "self", at: "combat" },
      { k: "stat", w: "intelligence", v: "+8.5%", t: "self", at: "combat" },
    ],
    [
      { k: "hit", w: "fire", v: "+60%", t: "enemy:1", at: "r2,5,8" },
      { k: "effect", w: "burn", ch: "40%", t: "enemy:1", at: "r2,5,8", d: 2 },
      { k: "hit", w: "fire", v: "+30%", t: "enemy:1", at: "r2,5,8", n: "a different enemy than the first hit" },
      { k: "effect", w: "burn", ch: "20%", t: "enemy:1", at: "r2,5,8", d: 2, n: "on that second enemy" },
    ],
  ],
  Sheepstealer: [
    [
      { k: "dmgDealt", w: "fire", v: "+10%", t: "self", at: "combat", c: "pve", skip: "pve" },
      { k: "dmgDealt", w: "fire", v: "+3%", t: "self", at: "each", d: "combat", st: { ch: "50%", max: 10 }, n: "Stolen Flock; also +1 stack whenever your Prey is healed" },
    ],
    [
      { k: "stat", w: "intelligence", v: "+16%", t: "self", at: "combat" },
      { k: "stat", w: "instinct", v: "-12%", t: "enemy:2:adj", at: "combat", e: "initiative" },
    ],
    [
      { k: "effect", w: "vulnerable", v: "+20%", ch: "25%", t: "enemy:1:prey", at: "each", b: [{ c: "target:healedLastRound", ch: "50%" }], n: "Prey is chosen by the Command", vs: ["High-recovery armies"] },
      { k: "cleanse", w: "self:1:dmgDealtDebuff", ch: "50%@2", t: "self", at: "each", c: "targetTroops>50", skip: "enemyDep" },
    ],
    [
      { k: "effect", w: "evasion", v: "10%", t: "self", at: "each", d: "round", c: "targetTroops>50", n: "while your Prey is above 50% troops" },
      { k: "recovRecv", v: "-10%", t: "enemy:3", at: "combat", vs: ["High-recovery armies"] },
    ],
    [
      { k: "hit", w: "fire", v: "+24%", t: "enemy:1:prey", at: "each", b: [{ c: "target:healedLastRound", v: "+72%" }], vs: ["High-recovery armies"] },
      { k: "heal", v: "+10%", t: "self", at: "each", e: "intelligence", b: [{ c: "target:healedLastRound", v: "+30%" }] },
    ],
  ],
  Shimmer: [
    [
      { k: "dmgDealt", w: "physical(CH)", v: "+9%", t: "ally:1:prio=left", at: "r1", d: 3 },
      { k: "dmgDealt", w: "tactical", v: "+9%", t: "ally:1:prio=right", at: "r1", d: 3 },
    ],
    [
      { k: "dmgRecv", w: "all", v: "-4%", t: "self", at: "combat" },
      { k: "stat", w: "instinct", v: "+5%", t: "self", at: "combat" },
    ],
    [{ k: "heal", v: "+30%", t: "ally:2:other", at: "r2,4,7,9", e: "instinct", b: [{ c: "target:resistance", v: "+60%" }] }],
    [{ k: "recovRecv", v: "+15%", t: "ally:2:other", at: "combat" }],
    [
      { k: "dmgDealt", w: "physical", v: "+10%", ch: "14%", t: "ally:1:other:hi=strength", at: "each", d: 2, g: 1 },
      { k: "effect", w: "firstStrike", ch: "14%", t: "ally:1:other:hi=strength", at: "each", d: 2, g: 1 },
    ],
  ],
  Solstryker: [
    [{ k: "stat", w: "strength", v: "-2%", t: "enemy:all", at: "each", d: "combat", st: { max: 10 }, n: "Steady Erosion, 1 guaranteed stack per round" }],
    [{ k: "stat", w: ["strength", "initiative"], v: "-15%", t: "enemy:2:adj", at: "r1", d: 3, e: "instinct", n: "Lv2-5 scraped text says Intelligence; confirmed Initiative in-game" }],
    [{ k: "effect", w: "overwhelm", ch: "10%", t: "enemy:1", at: "each", d: 2 }],
    [{ k: "stat", w: ["strength", "instinct"], v: "+12.5%", t: "self", at: "combat" }],
    [{ k: "stat", w: ["strength", "initiative"], v: "-15%", t: "enemy:2:adj", at: "r4", d: 5, e: "instinct" }],
  ],
  Starshower: [
    [
      { k: "cleanse", w: "ally:1:negative", ch: "15%", t: "ally:2", at: "each", g: 1, skip: "enemyDep" },
      { k: "effect", w: "evasion", v: "10%", ch: "15%", t: "ally:2", at: "each", d: 1, g: 1 },
    ],
    [{ k: "stat", w: ["intelligence", "initiative"], v: "+5%", sg: "-", t: "enemy:3", at: "combat", e: "instinct", n: "text says 'Reduce ... by +5%'" }],
    [{ k: "cmd", w: "tactical", v: "+130%", n: "Starfall: damage when consuming Solar Flare; once in R6-10, marks 3 enemies if none are marked" }],
    [{ k: "dmgRecv", w: "tactical", v: "+10%", t: "enemy:1:lane", at: "combat" }],
    [
      {
        k: "dmgRecv", w: "all", v: "-6%", t: "ally:2:adj", at: "on:solarFlare", d: 1,
        b: [{ c: "self:resistance", v: "+9%", sg: "-" }, { c: "self:advantage", t: "ally:3" }], n: "Starfall: when a Solar Flare mark is consumed",
      },
    ],
  ],
  Sunfyre: [
    [{ k: "dmgDealt", w: "all", v: "+5%", t: "ally:1:other:most", at: "each", b: [{ c: "selfTroops<75", t: "ally:2:other" }, { c: "selfTroops<50", t: "ally:3" }] }],
    [{ k: "dmgDealt", w: "fire", v: "-13.5%", t: "enemy:1:deals=fire", at: "combat", c: "enemyComp:dealsFire", vs: ["Fire damage dealers"] }],
    [
      { k: "hit", w: "tactical", v: "+50%", t: "enemy:1:deals=fire", at: "on:allyFireHit", skip: "enemyDep", n: "once per round, first time an ally takes Fire damage", vs: ["Fire damage dealers"] },
      { k: "stat", w: "intelligence", v: "-15%", t: "enemy:1:deals=fire", at: "on:allyFireHit", d: 2, e: "instinct", skip: "enemyDep", vs: ["Fire damage dealers"] },
    ],
    [
      { k: "dmgRecv", w: "fire", v: "-7.5%", t: "self", at: "combat" },
      { k: "dmgRecv", w: "all", v: "-7.5%@2", t: "self", at: "each", c: "selfTroops<50" },
      { k: "cleanse", w: "self:1:dmgRecvDebuff", ch: "25%", t: "self", at: "each", c: "selfTroops<50", skip: "enemyDep" },
    ],
    [{ k: "effect", w: "reactive", t: "self", at: "on:selfHit", skip: "enemyDep", n: "effect depends on the damage type the enemy hits you with first" }],
  ],
  Syrax: [
    [{ k: "stat", w: ["intelligence", "instinct"], v: "+6.5%", t: "ally:3", at: "combat", e: "initiative" }],
    [
      { k: "stat", w: "initiative", v: "+6%", t: "ally:3", at: "combat", e: "instinct" },
      { k: "stat", w: "initiative", v: "-6%", t: "enemy:3", at: "combat", e: "instinct" },
    ],
    [
      { k: "heal", v: "+50%", t: "ally:1:least", at: "r2,5,8", e: "initiative", b: [{ c: "anyEnemy:slow", v: "+75%" }], n: "Blazing Fury" },
      { k: "effect", w: "resistance", v: "-20%", ch: "25%", t: "ally:1:least", at: "r2,5,8", d: 2 },
    ],
    [
      { k: "dmgDealt", w: "tactical", v: "+18%", t: "ally:1:prio=left", at: "r1", d: 3 },
      { k: "dmgDealt", w: "fire", v: "+18%", t: "ally:1:prio=right", at: "r1", d: 3 },
    ],
    [{ k: "cleanse", w: "ally:2:negative+1:control", ch: "14%", t: "ally:1:prio=controlled", at: "each", skip: "enemyDep" }],
  ],
  Tairax: [
    [
      { k: "stat", w: ["strength", "initiative"], v: "-16%", t: "enemy:1:lane", at: "r1", d: 5, e: "intelligence" },
      { k: "stat", w: ["intelligence", "initiative"], v: "+16%", t: "self", at: "r6", d: 5 },
    ],
    [{ k: "dmgRecv", w: "all", v: "+7.5%", t: "enemy:all", at: "each", c: "target:control" }],
    [
      { k: "cmd", w: "stagger", ch: "37.5%", at: "odd", n: "Command's own odd-round Stagger chance raised to this" },
      { k: "hit", w: "fire", v: "+20%", t: "enemy:all", at: "each", c: "target:control" },
    ],
    [{ k: "effect", w: "resistance", v: "+15%", sg: "-", ch: "17.5%", t: "ally:1:prio=noResistance", at: "each", d: 2, c: "anyEnemy:burn", n: "rolled once per Burned enemy" }],
    [
      { k: "effect", w: "evasion", t: "self", at: "r1", d: 5 },
      { k: "dmgDealt", w: "fire", v: "+12%", t: "self", at: "r6", d: 5 },
    ],
  ],
  Tashix: [
    [{ k: "dmgDealt", w: "tactical", v: "-10.5%", t: "enemy:1:deals=tactical", at: "combat", c: "enemyComp:dealsTactical", vs: ["Tactical damage dealers"] }],
    [
      { k: "stat", w: "intelligence", v: "+12%", t: "self", at: "combat" },
      { k: "stat", w: "instinct", v: "-10%", t: "enemy:2:adj", at: "combat" },
    ],
    [
      { k: "dmgDealt", w: "fire", v: "+2.5%", t: "self", at: "each", d: "combat", st: { ch: "25%", max: 10 }, n: "Mirage" },
      { k: "effect", w: "weakened", v: "-15%", ch: "10%", t: "enemy:3", at: "each", d: 2, c: "stacks:mirage>=4", b: [{ c: "target:dealsTactical", ch: "20%" }], n: "rolled per target", vs: ["Tactical damage dealers"] },
    ],
    [{ k: "stat", w: ["instinct", "initiative"], v: "-5%", t: "enemy:3", at: "combat", e: "initiative" }],
    [
      { k: "dmgDealt", w: "fire", v: "+2.5%", t: "self", at: "each", d: "combat", st: { ch: "25%", max: 10 }, n: "Mirage (separate roll from Habit 3's)" },
      { k: "hit", w: "fire", v: "+150%", t: "enemy:1:most", at: "each", c: "stacks:mirage>=7", n: "once per combat" },
    ],
  ],
  Tessarion: [
    [{ k: "dmgDealt", w: ["physical", "fire"], v: "+7%", t: "self", at: "each", b: [{ c: "self:advantage", v: "+14%" }, { c: "selfTroops>75", v: "+14%" }] }],
    [{ k: "dmgDealt", w: "fire", v: "+10%", t: "ally:1:prio=left", at: "combat" }],
    [
      { k: "dmgDealt", w: "fire", v: "+12%", ch: "25%", t: "self", at: "odd", d: 2, g: 1 },
      { k: "dmgRecv", w: "physical", v: "-12%", ch: "25%", t: "ally:2:other", at: "odd", d: 2, g: 1, n: "also applies to yourself if you're Panicked" },
    ],
    [
      { k: "stat", w: "intelligence", v: "+18%", t: "ally:1:hi=intelligence", at: "combat" },
      { k: "stat", w: "initiative", v: "+9%", t: "ally:1:hi=intelligence", at: "combat" },
    ],
    [
      { k: "dmgRecv", w: "all", v: "-10%", ch: "40%", t: "ally:1:other:deals=fire", at: "odd", d: 2, g: 1, b: [{ c: "selfTroops>75", v: "-20%" }] },
      { k: "stat", w: "intelligence", v: "+15%", ch: "40%", t: "ally:1:other:deals=fire", at: "odd", d: 2, e: "intelligence", g: 1, b: [{ c: "selfTroops>75", v: "+30%" }] },
    ],
  ],
  Thunderstrike: [
    [
      { k: "stat", w: "initiative", v: "+25%", t: "self", at: "r1", d: 3 },
      { k: "stat", w: "instinct", v: "-15%", t: "enemy:2:adj", at: "r1", d: 3, e: "strength" },
    ],
    [{ k: "dmgDealt", w: "physical(CH)", v: "+8%", t: "self", at: "combat" }],
    [
      { k: "hit", w: "physical", v: "+50%", t: "enemy:1:lane", at: "even" },
      { k: "effect", w: "bleed", v: "+20%", ch: "25%", t: "enemy:1:lane", at: "even", d: 2 },
    ],
    [{ k: "dmgRecv", w: "physical", v: "+4.8%", t: "enemy:1:lane", at: "combat", n: "'opposing' enemy" }],
    [{ k: "effect", w: "stagger", ch: "10%", t: "enemy:1:lane", at: "each", d: 1, b: [{ c: "self:advantage", d: 2 }] }],
  ],
  Vaeldra: [
    [
      { k: "dmgRecv", w: "all", v: "-5%", t: "self", at: "combat" },
      { k: "stat", w: "strength", v: "+8.5%", t: "self", at: "combat" },
    ],
    [{ k: "stat", w: ["instinct", "initiative"], v: "-18%", t: "enemy:2:adj", at: "r1", d: 3, e: "intelligence" }],
    [{ k: "dmgRecv", w: ["physical(CH)", "fire"], v: "+6%", t: "enemy:1", at: "on:selfTaunt", d: 2, n: "on each enemy you Taunt" }],
    [
      { k: "dmgDealt", w: "fire", v: "+12%", t: "ally:1:prio=left", at: "r1", d: 3 },
      { k: "dmgDealt", w: "physical(CH)", v: "+12%", t: "ally:1:prio=right", at: "r1", d: 3 },
    ],
    [
      { k: "dmgRecv", w: "physical", v: "-10%", t: "self", at: "r1", d: 3 },
      { k: "effect", w: "taunt", ch: "40%", t: "enemy:all", at: "r1-3", d: "round", n: "already-Taunted targets get Stagger instead" },
    ],
  ],
  Velar: [
    [{ k: "dmgDealt", w: "tactical", v: "+10%", t: "ally:1:prio=vanguard", at: "combat" }],
    [{ k: "stat", w: ["instinct", "initiative"], v: "+16%", t: "self", at: "combat" }],
    [
      { k: "effect", w: "firstStrike", ch: "12%", t: "ally:3", at: "r2,4,6,8", d: 2, n: "rolled per target" },
      { k: "effect", w: "slow", ch: "12%", t: "enemy:3", at: "r2,4,6,8", d: 2, n: "rolled per target" },
    ],
    [{ k: "stat", w: ["strength", "instinct"], v: "+5%", t: "ally:3", at: "combat", e: "initiative" }],
    [
      { k: "cleanse", w: "ally:bleed|panic|burn", ch: "12%", t: "ally:3", at: "each", skip: "enemyDep" },
      { k: "heal", v: "+18%", t: "ally:3", at: "r2,4,6,8", e: "initiative" },
    ],
  ],
  Venator: [
    [{ k: "stat", w: "intelligence", v: "-30%", t: "enemy:1:prio=breed=hunter", at: "combat", e: "strength", vs: ["Hunters"] }],
    [{ k: "dmgDealt", w: "physical(CH)", v: "+12.5%", t: "self", at: "combat" }],
    [
      { k: "hit", w: "physical", v: "+20%", t: "enemy:1:least", at: "on:basicAttack", n: "Feral Strike" },
      { k: "effect", w: "doubleStrike", ch: "40%", t: "self", at: "r4,6,8", n: "Feral Strike's Double-Strike chance raised to this" },
    ],
    [{ k: "dmgRecv", w: "physical", v: "+8%", t: "enemy:1:lane", at: "combat", n: "'opposing' enemy" }],
    [
      { k: "hit", w: "physical", v: "+60%", t: "enemy:1:prio=breed=hunter", at: "on:basicAttack", c: "selfTroops<50", vs: ["Hunters"] },
      { k: "effect", w: "overwhelm", ch: "12%", t: "enemy:1:prio=breed=hunter", at: "on:basicAttack", d: 2, c: "selfTroops<50" },
    ],
  ],
  Vermax: [
    [{ k: "dmgRecv", w: "fire", v: "-5%", t: "ally:3", at: "each", c: "targetTroops<75", b: [{ c: "targetTroops<50", v: "-10%" }, { c: "targetTroops<25", v: "-15%" }] }],
    [
      { k: "stat", w: "instinct", v: "+18%", t: "ally:1:hi=instinct", at: "combat", e: "strength" },
      { k: "stat", w: "initiative", v: "+9%", t: "ally:1:hi=instinct", at: "combat", e: "strength" },
    ],
    [
      { k: "dmgDealt", w: "physical", v: "+5%", t: "self", at: "combat", st: { ch: "50%", max: 4 }, n: "Rallying Flame; one extra roll per enemy that deals Fire damage", vs: ["Fire damage dealers"] },
      { k: "dmgDealt", w: "tactical", v: "+2.5%", t: "ally:1:deals=tactical", at: "combat", st: { ch: "50%@2", max: 10 }, n: "Spreading Blaze; one extra roll per enemy that deals Fire damage", vs: ["Fire damage dealers"] },
    ],
    [
      { k: "dmgRecv", w: "all", v: "-5%", t: "self", at: "combat" },
      { k: "stat", w: "strength", v: "+8.5%", t: "self", at: "combat" },
    ],
    [{ k: "effect", w: "advantage", v: "+15%", ch: "20%", t: "self", at: "each", d: 2, b: [{ c: "self:weakened", ch: "30%" }] }],
  ],
  Vermithor: [
    [
      { k: "dmgRecv", w: "tactical", v: "+20%", t: "self", at: "r1", d: 5, n: "drawback, shrinks to 0 by Lv5" },
      { k: "dmgDealt", w: "physical", v: "-13%", t: "enemy:1:prio=breed=warrior", at: "r1", d: 5, vs: ["Warriors"] },
      { k: "dmgDealt", w: "fire", v: "-13%", t: "enemy:1:prio=breed=hunter", at: "r1", d: 5, vs: ["Hunters"] },
    ],
    [
      { k: "dmgRecv", w: "all", v: "-6%", t: "self", at: "combat" },
      { k: "stat", w: "initiative", v: "+12%", t: "self", at: "combat" },
    ],
    [
      { k: "cmd", w: "physical", v: "+37.5%", n: "Bronze Fury physical damage rate" },
      { k: "cmd", w: "tactical", v: "+75%", n: "Bronze Fury tactical damage rate" },
      { k: "cmd", w: "protect", ch: "40%", n: "Bronze Fury's Protect chance" },
      { k: "dmgRecv", w: ["physical", "fire"], v: "-5%", t: "self", at: "on:protect", d: 2 },
    ],
    [
      { k: "dmgRecv", w: "physical", v: "-7.5%", t: "self", at: "combat", c: "enemyComp:warriors", skip: "enemyDep", n: "per enemy Warrior", vs: ["Warriors"] },
      { k: "dmgRecv", w: "fire", v: "-7.5%@2", t: "self", at: "combat", c: "enemyComp:hunters", skip: "enemyDep", n: "per enemy Hunter", vs: ["Hunters"] },
    ],
    [
      { k: "hit", w: "physical", v: "+60%", t: "enemy:1:lo=instinct", at: "each", c: "selfTroops<50", n: "once per combat" },
      { k: "hit", w: "tactical", v: "+100%", t: "enemy:1:lo=intelligence", at: "each", c: "selfTroops<50", n: "once per combat" },
    ],
  ],
  Vesper: [
    [{ k: "dmgDealt", w: "tactical", v: "+8%", t: "ally:1:prio=vanguard", at: "combat" }],
    [
      { k: "dmgRecv", w: "all", v: "-4%", t: "self", at: "combat" },
      { k: "stat", w: "instinct", v: "+5%", t: "self", at: "combat" },
    ],
    [
      { k: "effect", w: "resistance", v: "-10%", ch: "12.5%", t: "self", at: "each", d: 2, g: 1 },
      { k: "effect", w: "resistance", v: "-10%", ch: "12.5%", t: "ally:1:other:adj", at: "each", d: 2, g: 1 },
    ],
    [{ k: "stat", w: "instinct", v: "+8%", t: "ally:3", at: "combat", e: "instinct" }],
    [{ k: "effect", w: "confusion", ch: "24%", t: "enemy:1:adj", at: "r6-10", d: 2 }],
  ],
  Vhagar: [
    [
      { k: "dmgRecv", w: ["physical", "tactical"], v: "-12%", t: "self", at: "r1", d: 3 },
      { k: "recovRecv", v: "+15%", t: "self", at: "r4", d: "combat" },
    ],
    [{ k: "dmgDealt", w: "physical(CH)", v: "+12.5%", t: "ally:1:prio=right", at: "combat" }],
    [
      { k: "effect", w: "advantage", v: "+20%", ch: "17.5%", t: "ally:1:most", at: "r3-7", d: 2, g: 1 },
      { k: "effect", w: "weakened", v: "-20%", ch: "17.5%", t: "enemy:1:most", at: "r3-7", d: 2, g: 1 },
    ],
    [
      { k: "dmgRecv", w: "fire", v: "+18%", t: "enemy:1:prio=left", at: "r1", d: 3 },
      { k: "dmgRecv", w: "physical(CH)", v: "+18%", t: "enemy:1:prio=right", at: "r1", d: 3 },
    ],
    [
      { k: "stat", w: "strength", v: "+5%", t: "self", at: "each", d: "combat", st: { ch: "30%", max: 5 }, n: "Bulwark" },
      { k: "dmgRecv", w: ["physical", "tactical"], v: "-2.5%", t: "self", at: "each", d: "combat", st: { ch: "30%", max: 5 }, n: "Bulwark" },
      { k: "hit", w: "physical", v: "+100%", t: "enemy:1:lane", at: "each", c: "stacks:bulwark>=3", n: "once, on gaining the 3rd stack" },
    ],
  ],
  Zivern: [
    [{ k: "stat", w: ["strength", "instinct"], v: "-5%", t: "enemy:3", at: "combat", e: "intelligence" }],
    [{ k: "stat", w: ["intelligence", "instinct"], v: "+16%", t: "self", at: "combat" }],
    [
      { k: "stat", w: "instinct", v: "-15%", ch: "30%", t: "enemy:3", at: "odd", d: 2, e: "intelligence", g: 1 },
      { k: "effect", w: "panic", v: "+20%", ch: "30%", t: "enemy:3", at: "odd", d: 2, g: 1 },
    ],
    [{ k: "dmgRecv", w: ["physical(CH)", "tactical"], v: "-3.5%", t: "ally:2:other", at: "combat" }],
    [{ k: "effect", w: "overwhelm", ch: "10%", t: "enemy:2:adj", at: "odd", d: 2, b: [{ c: "target:vulnerable", ch: "20%" }] }],
  ],
};

// Command skills (kits.json `command`), same clause format. A Command has no
// upgrade levels, so every value/chance is the same at all 5 "levels". Where a
// Command's text has "At 6+ Stars"/"At 10 Stars" parts, those are the dragon's
// Command habits and are already captured in DRAFT above, not repeated here.
export const COMMANDS = {
  Antares: [
    { k: "effect", w: "vulnerable", v: "+10%", ch: "20%", t: "enemy:1:adj", at: "each", d: 2 },
    { k: "hit", w: "fire", v: "+65%", t: "enemy:2:adj", at: "r3,6,9" },
  ],
  Arrax: [
    { k: "effect", w: "weakened", ch: "25%", t: "enemy:1:adj", at: "r2,4,6,8", b: [{ c: "target:bleed", ch: "50%" }], n: "Weakened size/duration not stated" },
    { k: "hit", w: "physical", v: "+40%", t: "enemy:2:adj", at: "r2,4,5,6,8" },
  ],
  Arulix: [
    { k: "dmgDealt", w: "fire", v: "-15%", ch: "25%", t: "enemy:all:deals=fire", at: "each", d: 1, c: "enemyComp:dealsFire", vs: ["Fire damage dealers"] },
    { k: "hit", w: "tactical", v: "+45%", t: "enemy:all:deals=physical", at: "r1,2,3,5,8", c: "enemyComp:dealsPhysical", vs: ["Physical damage dealers"] },
  ],
  Bevlorin: [
    { k: "dmgDealt", w: "fire", v: "-10%", ch: "20%", t: "enemy:3:deals=fire", at: "each", d: 2, c: "enemyComp:dealsFire", vs: ["Fire damage dealers"] },
    { k: "hit", w: "physical", v: "+30%", t: "enemy:3", at: "r1,5,9" },
    { k: "hit", w: "physical", v: "+90%", t: "enemy:1:lane", at: "r3,7" },
  ],
  Caraxes: [{ k: "hit", w: "fire", v: "+100%", t: "enemy:3", at: "r3,6,9", b: [{ c: "self:firstStrike", v: "+150%" }] }],
  Crimson: [
    { k: "effect", w: "stun", ch: "20%", t: "enemy:1", at: "odd", d: 2 },
    { k: "hit", w: "fire", v: "+140%", t: "enemy:1", at: "r2,5,8" },
  ],
  Daemoros: [
    { k: "hit", w: "physical", v: "+125%", t: "enemy:1:adj", at: "odd" },
    { k: "effect", w: "burn", v: "+20%", ch: "20%", t: "enemy:1:adj", at: "odd", d: 2, n: "on the same target" },
  ],
  Dawnseeker: [
    { k: "stat", w: ["instinct", "initiative"], v: "+20%", ch: "30%", t: "self", at: "each", d: 1 },
    { k: "hit", w: "tactical", v: "+50%", t: "enemy:1:lane", at: "r1,2,4,7" },
    { k: "heal", v: "+30%", t: "ally:2:adj", at: "r2,5,8", e: "initiative" },
  ],
  Feskar: [
    { k: "dmgDealt", w: "physical(CH)", v: "-12%", ch: "20%", t: "enemy:1:hi=strength", at: "each", d: 2 },
    { k: "hit", w: "tactical", v: "+100%", t: "enemy:1:least", at: "r2,4,7,9" },
  ],
  Jagadrix: [
    { k: "stat", w: ["instinct", "initiative"], v: "-15%", ch: "30%", t: "enemy:1:lane", at: "each", d: 2, e: "initiative" },
    { k: "hit", w: "fire", v: "+120%", t: "enemy:1:lane", at: "r2,5,8" },
  ],
  Kalspire: [
    { k: "hit", w: "tactical", v: "+50%", t: "enemy:1", at: "on:basicAttack", n: "the basic attack's target" },
    { k: "effect", w: "bleed", ch: "30%", t: "enemy:2:adj", at: "on:basicAttack", d: 2, n: "the target + 1 other adjacent enemy, rolled per target" },
  ],
  Malachite: [
    { k: "hit", w: "tactical", v: "+100%", t: "enemy:1:lane", at: "r2,4,7,9" },
    { k: "heal", v: "+70%", t: "ally:3", at: "r3,6,9", e: "instinct" },
  ],
  Moondancer: [
    { k: "effect", w: "crescentBlade", t: "ally:1:other:breed=sentinel", at: "r1", d: "combat", n: "that Sentinel's Tactical damage/Recovery then feeds Rising Tide" },
    { k: "effect", w: "risingTide", ch: "50%", t: "self", at: "each", d: "combat", c: "anyAlly:crescentBlade", n: "+1 stack when the Crescent Blade holder deals Tactical damage or heals (max 8)" },
    { k: "dmgRecv", w: "all", v: "-2%", t: "self", at: "each", d: "combat", st: { max: 8 }, n: "per Rising Tide stack" },
    { k: "hit", w: "physical", v: "+75%", t: "enemy:2:adj", at: "even" },
  ],
  Nyrena: [
    { k: "dmgDealt", w: "physical", v: "-10%", ch: "10%", t: "enemy:3", at: "each", d: 1, b: [{ c: "target:burn", d: 2 }] },
    { k: "hit", w: "fire", v: "+20%", t: "enemy:3", at: "r1,3" },
    { k: "hit", w: "tactical", v: "+80%", t: "enemy:1:lane", at: "r5,7,9" },
  ],
  Rhysarion: [
    { k: "hit", w: "physical", v: "+70%", t: "enemy:2:adj", at: "r1,4,7" },
    { k: "hit", w: "fire", v: "+20%", t: "enemy:3", at: "r2,5,8", b: [{ c: "target:control", v: "+30%" }] },
  ],
  Seasmoke: [
    { k: "cleanse", w: "enemy:positive", ch: "20%", t: "enemy:1", at: "each", skip: "enemyDep", n: "up to 3 instances, each its own 20% roll", vs: ["Buff-heavy armies"] },
    { k: "hit", w: "fire", v: "+190%", t: "enemy:1:lane", at: "r3,6,9" },
  ],
  Shadowrend: [
    { k: "effect", w: "panic", v: "+20%", ch: "25%", t: "enemy:1:adj", at: "each", d: 2 },
    { k: "hit", w: "physical", v: "+80%", t: "enemy:2:adj", at: "r4,7,9,10" },
  ],
  Shadowsong: [{ k: "hit", w: "fire", v: "+100%", t: "enemy:2:adj", at: "r2,5,8", b: [{ c: "target:panic", v: "+150%" }] }],
  Sheepstealer: [
    { k: "effect", w: "prey", ch: "40%", t: "enemy:1:prio=healedLastRound", at: "each", d: 3, n: "only while no enemy is Prey" },
    { k: "recovRecv", v: "-30", sg: "-", t: "enemy:1:prey", at: "each", d: 3, n: "Prey's own effect", vs: ["High-recovery armies"] },
    { k: "hit", w: "fire", v: "+100%", t: "enemy:1:prio=prey", at: "r1,4,7,10", b: [{ c: "target:prey", v: "+200%" }] },
  ],
  Shimmer: [
    { k: "stat", w: "strength", v: "+18%", ch: "30%", t: "ally:1:other:hi=strength", at: "each", d: 2, e: "instinct", g: 1 },
    { k: "stat", w: "initiative", v: "+9%", ch: "30%", t: "ally:1:other:hi=strength", at: "each", d: 2, e: "instinct", g: 1 },
    { k: "hit", w: "tactical", v: "+50%", t: "enemy:2:adj", at: "r2,4,7,9" },
  ],
  Solstryker: [
    { k: "hit", w: "physical", v: "+30%", t: "enemy:1", at: "odd", n: "after each basic attack, on its target" },
    { k: "dmgDealt", w: "physical", v: "-12%", ch: "20%", t: "enemy:1", at: "odd", d: 2, n: "on that same target" },
  ],
  Starshower: [
    { k: "effect", w: "solarFlare", t: "enemy:3", at: "combat", d: "combat", n: "mark" },
    { k: "hit", w: "tactical", v: "+100%", ch: "50%", t: "enemy:1:solarFlare", at: "each", n: "consumes the mark" },
    { k: "hit", w: "tactical", v: "+80%", t: "enemy:1:lane", at: "r1,3,7,9" },
  ],
  Sunfyre: [
    { k: "hit", w: "tactical", v: "+110%", t: "enemy:1:lane", at: "r1,4,7,10", b: [{ c: "selfTroops<75", t: "enemy:2:adj" }] },
    { k: "hit", w: "fire", v: "+55%", t: "enemy:1:lane", at: "r1,4,7,10", c: "selfTroops<50" },
    { k: "effect", w: "burn", ch: "50%", t: "enemy:1:lane", at: "r1,4,7,10", d: 2, c: "selfTroops<50" },
  ],
  Syrax: [
    { k: "dmgDealt", w: "fire", v: "+10%", ch: "20%", t: "ally:1:prio=deals=fire", at: "each", d: 2, g: 1 },
    { k: "effect", w: "firstStrike", ch: "20%", t: "ally:1:prio=deals=fire", at: "each", d: 2, g: 1 },
    { k: "hit", w: "tactical", v: "+110%", t: "enemy:1:adj", at: "r1,4,6,9" },
  ],
  Tairax: [
    { k: "effect", w: "stagger", ch: "25%", t: "enemy:1", at: "odd", d: 2 },
    { k: "hit", w: "fire", v: "+115%", t: "enemy:1:prio=noBurn", at: "r2,5,8" },
    { k: "effect", w: "burn", ch: "50%", t: "enemy:1:prio=noBurn", at: "r2,5,8", d: 2 },
  ],
  Tashix: [
    { k: "dmgDealt", w: "fire", v: "+2.5%", t: "self", at: "each", d: "combat", st: { ch: "50%", max: 10 }, n: "Mirage" },
    { k: "hit", w: "fire", v: "+200%", t: "enemy:1:adj", at: "r3,6,9" },
  ],
  Tessarion: [
    { k: "hit", w: "fire", v: "+95%", t: "enemy:1:prio=deals=physical", at: "r1,4,7" },
    { k: "dmgDealt", w: "all", v: "-10%", ch: "50%", t: "enemy:1:prio=deals=physical", at: "r1,4,7", d: 2, b: [{ c: "target:dealsPhysical", v: "-20%" }], vs: ["Physical damage dealers"] },
    { k: "hit", w: "physical", v: "+60%", t: "enemy:1:lane", at: "r3,6,9" },
  ],
  Thunderstrike: [{ k: "hit", w: "physical", v: "+100%", t: "enemy:1:lane", at: "odd" }],
  Vaeldra: [
    { k: "effect", w: "taunt", ch: "25%", t: "enemy:3", at: "each", d: 2 },
    { k: "hit", w: "physical", v: "+45%", t: "enemy:2:adj", at: "odd" },
  ],
  Velar: [
    { k: "effect", w: "advantage", v: "+15%", ch: "20%", t: "ally:2:other", at: "r2,4,6,8", d: 2 },
    { k: "hit", w: "tactical", v: "+45%", t: "enemy:3", at: "r3,5,7,9" },
  ],
  Venator: [
    { k: "hit", w: "physical", v: "+20%", t: "enemy:1", at: "on:basicAttack", n: "2 instances, each picks its own target" },
    { k: "effect", w: "doubleStrike", ch: "30%", t: "self", at: "r4,6,8,10", d: 2 },
  ],
  Vermax: [
    { k: "hit", w: "physical", v: "+50%", t: "enemy:1:lane", at: "on:basicAttack" },
    { k: "effect", w: "spreadingBlaze", ch: "20%", t: "ally:1:deals=tactical", at: "on:basicAttack", d: "combat", n: "+1 stack (value is Habit 3's +2.5%/stack); extra roll if any enemy deals Fire", vs: ["Fire damage dealers"] },
  ],
  Vermithor: [
    { k: "hit", w: "physical", v: "+30%", t: "enemy:2:adj", at: "r2,4,6,8" },
    { k: "hit", w: "tactical", v: "+60%", t: "enemy:2:adj", at: "r2,4,6,8" },
    { k: "effect", w: "protect", ch: "30%", t: "ally:1:adj:least", at: "odd", d: 2 },
  ],
  Vesper: [
    { k: "effect", w: "slow", ch: "20%", t: "enemy:1:lane", at: "each", d: 2 },
    { k: "hit", w: "tactical", v: "+70%", t: "enemy:1:lane", at: "r1,3,6,8" },
  ],
  Vhagar: [
    { k: "effect", w: "taunt", ch: "25%", t: "enemy:3", at: "each", d: 2, b: [{ c: "target:burn", ch: "50%" }] },
    { k: "hit", w: "physical", v: "+120%", t: "enemy:1:adj", at: "even" },
  ],
  Zivern: [
    { k: "dmgRecv", w: "tactical", v: "+15%", ch: "40%", t: "enemy:1:lane", at: "r1,4,6,9", d: 2 },
    { k: "hit", w: "tactical", v: "+75%", t: "enemy:2:adj", at: "r1,4,6,9" },
  ],
};
