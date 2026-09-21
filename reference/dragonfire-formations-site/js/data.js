/*
 * data.js — Game model + curated dragon database for
 * Game of Thrones: Dragonfire formation optimizer.
 *
 * All numbers are editable in the app. The seed roster below is based on
 * community guides and the official HBO Games dragon guide. Treat `power`
 * values as illustrative placeholders — replace them with YOUR in-game
 * numbers for accurate optimization.
 */

// ---- Troop types -----------------------------------------------------------
// In-game an army marches with ONE troop type. A dragon with positive affinity
// for that troop type gets a stat boost.
const TROOP_TYPES = [
  { id: "cavalry", name: "Cavalry", icon: "\u{1F40E}" },
  { id: "shieldbearers", name: "Shieldbearers", icon: "\u{1F6E1}\uFE0F" },
  { id: "archers", name: "Archers", icon: "\u{1F3F9}" },
  { id: "spearmen", name: "Spearmen", icon: "\u{1F531}" },
  { id: "siege", name: "Siege", icon: "\u{1F525}" },
];

// Troop Type Advantage cycle (used vs an enemy troop type, informational).
//   Cavalry > Shieldbearers > Archers > Spearmen > Cavalry
//   Siege is weak to all but deals bonus damage to structure Durability.
const TROOP_BEATS = {
  cavalry: ["shieldbearers"],
  shieldbearers: ["archers"],
  archers: ["spearmen"],
  spearmen: ["cavalry"],
  siege: [], // weak to all, bonus vs durability only
};

// ---- Positions -------------------------------------------------------------
// A 3-dragon army has a left flank, a center Vanguard, and a right flank.
const POSITIONS = [
  { id: "left", name: "Left Flank", short: "LF" },
  { id: "vanguard", name: "Vanguard", short: "VG" },
  { id: "right", name: "Right Flank", short: "RF" },
];

// ---- Rarities --------------------------------------------------------------
// Rarity drives base stats more than star rank. Used to estimate power when a
// user hasn't entered an exact power number.
const RARITIES = [
  { id: "rare", name: "Rare (Blue)", weight: 1.0, color: "#3b82f6" },
  { id: "epic", name: "Epic (Purple)", weight: 1.7, color: "#a855f7" },
  { id: "legendary", name: "Legendary (Gold)", weight: 2.6, color: "#eab308" },
  { id: "mythic", name: "Mythic", weight: 3.6, color: "#ef4444" },
];

// ---- Damage types ----------------------------------------------------------
const DAMAGE_TYPES = [
  { id: "physical", name: "Physical" },
  { id: "tactical", name: "Tactical" },
  { id: "fire", name: "Fire" },
  { id: "none", name: "None / Support" },
];

// ---- Roles -----------------------------------------------------------------
// A dragon's job in a formation. Drives which position the optimizer prefers.
const ROLES = [
  { id: "tank", name: "Tank / Taunt", prefers: "vanguard" },
  { id: "physical", name: "Physical DPS", prefers: "right" },
  { id: "tactical", name: "Tactical DPS", prefers: "left" },
  { id: "fire", name: "Fire DPS", prefers: "left" },
  { id: "healer", name: "Healer / Support", prefers: "left" },
  { id: "control", name: "Control / Debuffer", prefers: "any" },
];

// ---- Breeds ----------------------------------------------------------------
// Official in-game classification (gotdragonfire.com). Breed does NOT set troop
// affinity, but the game tells you to place dragons by breed, so we use it as a
// soft position hint and to colour the roster.
const BREEDS = [
  { id: "champion", name: "Champion", archetype: "Suppressor", desc: "All-purpose protector; mixed damage, weakens foes / shields allies.", prefers: "vanguard" },
  { id: "hunter", name: "Hunter", archetype: "Debuffer", desc: "Fire-focused pressure dealer; lowers enemy defenses & keeps them vulnerable.", prefers: "left" },
  { id: "sentinel", name: "Sentinel", archetype: "Buffer", desc: "Tactical support core; healing, buffs & battlefield control.", prefers: "left" },
  { id: "warrior", name: "Warrior", archetype: "Enhancer", desc: "Frontline physical offense; amplifies the army's damage.", prefers: "right" },
];

// ---- Ability effects -------------------------------------------------------
// The vocabulary the game uses for combat effects. For the 36 official dragons
// these are read straight from their Command and Habit wording (see kits.js);
// the list below is what you can tick by hand on a custom dragon.
//
// Effects are grouped by DIRECTION, because that is what decides synergy: a
// dragon that APPLIES Burn enables one that WANTS Burn, while a dragon that
// merely hits harder into Burn provides nothing to the team.
const EFFECTS = {
  // Placed on ENEMIES — these enable the rest of the army.
  applies: {
    taunt: "Taunt — forces enemies to attack this dragon",
    burn: "Burn — burning damage over time",
    panic: "Panic — continuous tactical damage",
    stun: "Stun — target loses its turn",
    overwhelm: "Overwhelm / Stagger — blocks commands & basic attacks",
    confusion: "Confusion — target may attack its own side",
    slow: "Slow — cuts the target's Initiative",
    bleed: "Bleed — physical damage over time",
    weakened: "Weakened — cuts the target's damage dealt",
    vulnerable: "Vulnerable — target takes increased damage",
    debuff: "Debuff — lowers enemy stats or damage",
    dispel: "Dispel — strips positive effects off enemies",
  },
  // Given to ALLIES (or, for a few, only to this dragon).
  grants: {
    buff: "Buff — raises an ally's stats or damage",
    recovery: "Recovery — restores troops over time",
    cleanse: "Cleanse — removes negative effects from allies",
    mitigation: "Mitigation — reduces damage taken",
    resistance: "Resistance — grants damage resistance",
    evasion: "Evade — chance to ignore incoming damage",
    advantage: "Advantage — target deals increased damage",
    protect: "Protect — splits damage taken with this dragon",
    firstStrike: "First Strike — target attacks first",
    doubleStrike: "Double Strike — target gets a 2nd basic attack",
    mirage: "Mirage — stacking damage that grows through the fight",
    risingTide: "Rising Tide — stacking self-buff that grows damage & mitigation through the fight",
  },
  // Needed FROM a teammate for this dragon to hit its ceiling.
  wants: {
    burn: "Stronger against Burned enemies",
    panic: "Stronger against Panicked enemies",
    control: "Stronger against enemies under Control",
    taunt: "Stronger against Taunted enemies",
    vulnerable: "Stronger against Vulnerable enemies",
    slow: "Stronger against Slowed enemies",
    advantage: "Stronger while it has Advantage",
    resistance: "Stronger while it has Resistance",
    firstStrike: "Stronger while it has First Strike",
    sentinel: "Needs a Sentinel ally that deals Tactical Damage or applies Recovery",
  },
};

// The game's own Control group, quoted in Tairax's habits: "Control effects
// include Stun, Stagger, Overwhelm, and Confusion." Panic and Taunt are not
// Control effects, despite reading like them.
const CONTROL_EFFECTS = ["stun", "overwhelm", "confusion"];

// ---- Official dragon database ----------------------------------------------
// The 28 official dragons from gotdragonfire.com/dragons plus 8 brand-new ones
// (Sheepstealer, Vermax, Tessarion, Sunfyre, Tairax, Vermithor, Starshower &
// Moondancer) not yet listed there = 36 total.
// Names, rarity & breed are official. Roles, damage types, abilities and vanguard
// skills are inferred from community guides and the official breed descriptions.
//
// Troop affinity below is REAL per-dragon data (+ positive, - negative,
// otherwise neutral), sourced from Dragonfire Hub (https://dragonfire-hub.com)
// and credited in the app. Edit any dragon to adjust.
// Power is auto-estimated from rarity/star until you enter your real numbers.
function seedDragons() {
  // All-neutral affinity helper.
  const A0 = () => ({ cavalry: 0, shieldbearers: 0, archers: 0, spearmen: 0, siege: 0 });
  // Default troop affinity per breed (fallback for custom dragons only).
  const BREED_TROOP = { warrior: "cavalry", hunter: "archers", sentinel: "spearmen", champion: "shieldbearers" };
  const star = { legendary: 3, epic: 3, rare: 2, new: 1 };

  // Real in-game troop affinities by dragon name (+ / - per troop type).
  const AFFINITY = {
    Caraxes:      { spearmen: "+", cavalry: "+" },
    Malachite:    { cavalry: "+", shieldbearers: "+", siege: "-" },
    Feskar:       { cavalry: "+", siege: "-" },
    Venator:      { spearmen: "+", shieldbearers: "+" },
    Kalspire:     { cavalry: "+", shieldbearers: "+", siege: "+" },
    Vaeldra:      { spearmen: "+" },
    Vhagar:       { shieldbearers: "+", archers: "+", siege: "+" },
    Crimson:      { spearmen: "+", archers: "+", siege: "+" },
    Syrax:        { spearmen: "+", archers: "+", siege: "-" },
    Daemoros:     { archers: "+" },
    Seasmoke:     { cavalry: "+", archers: "+", siege: "-" },
    Velar:        { shieldbearers: "+" },
    Zivern:       { archers: "+", siege: "+" },
    Rhysarion:    { spearmen: "+", shieldbearers: "+", siege: "+" },
    Shadowsong:   { cavalry: "+" },
    Thunderstrike:{ cavalry: "+" },
    Tashix:       { archers: "+", siege: "-" },
    Shadowrend:   { shieldbearers: "+", siege: "+" },
    Nyrena:       { shieldbearers: "+", siege: "+" },
    Shimmer:      { cavalry: "+", siege: "+" },
    Jagadrix:     { spearmen: "+" },
    Antares:      { archers: "+", siege: "-" },
    Arrax:        { shieldbearers: "+", archers: "+" },
    Solstryker:   { archers: "+" },
    Dawnseeker:   { spearmen: "+", siege: "-" },
    Bevlorin:     { spearmen: "+" },
    Arulix:       { cavalry: "+" },
    Vesper:       { shieldbearers: "+", siege: "-" },
    Sheepstealer: { cavalry: "+", archers: "+" },
    Vermax:       { cavalry: "+", shieldbearers: "+" },
    Tessarion:    { spearmen: "+", cavalry: "+", siege: "+" },
    Sunfyre:      { spearmen: "+", cavalry: "+" },
    Tairax:       { cavalry: "+", shieldbearers: "+", siege: "+" },
    Vermithor:    { spearmen: "+", shieldbearers: "+" },
    Starshower:   { shieldbearers: "+" },
    Moondancer:   { shieldbearers: "+", archers: "+", siege: "-" },
  };
  const list = [
    // ---- Legendary ----
    {
      name: "Syrax", rarity: "legendary", breed: "sentinel", role: "healer", damageType: "tactical",
      notes: "Sentinel (Buffer): tactical support — healing & ally buffs. Best on the Left Flank.",
    },
    {
      name: "Vhagar", rarity: "legendary", breed: "warrior", role: "tank", damageType: "physical",
      notes: "Warrior tank. Command: chance to taunt all enemies (doubled vs Burn). Habits: damage Mitigation — physical & tactical ONLY, so WEAK to fire; 'Battle Leader' boosts physical damage dealt to the right flank; a later habit raises enemy physical damage taken on their right flank. Vanguard skill (lvl 16+): -8% self damage, +16% left-flank tactical. [Confirmed from guides. = the 'Vega/Veigar' mis-transcription.]",
    },
    {
      name: "Caraxes", rarity: "legendary", breed: "hunter", role: "fire", damageType: "fire",
      notes: "Hunter fire DPS. Habit 'Flare': at combat start, +12.5% fire damage dealt for the whole fight. Strong with First Strike (raises its damage rate, e.g. 80%→120%). [Confirmed from guides — note: Flare is a global fire buff, not a flank-specific one.]",
    },
    {
      name: "Seasmoke", rarity: "legendary", breed: "champion", role: "control", damageType: "fire",
      notes: "Champion (Suppressor): all-purpose protector. Command 'Tidecaller': each round strips up to 3 positive effects off enemies, and on rounds 3/6/9 deals heavy Fire Damage (+190%) to one enemy in its lane — its only damage until the 6★ habit adds a physical hit. Habits are pure ally support: Intelligence/Initiative buffs, then Advantage and Resistance at 10★. Flexible Vanguard core.",
    },
    {
      name: "Crimson", rarity: "legendary", breed: "hunter", role: "control", damageType: "fire",
      notes: "Hunter control/fire. Command 'Bloodscale Terror': ~20% chance to Stun one enemy (2 rounds) + fire to any lane. Habits: debuffs that lower enemy damage / raise damage they take. Vanguard skill (lvl 16+): +10% right-flank physical, +20% recovery received, +25% intelligence. [Confirmed from guides.]",
    },
    {
      name: "Kalspire", rarity: "legendary", breed: "champion", role: "tank", damageType: "tactical",
      notes: "Champion: durable suppressor often run in the Vanguard for tankiness.",
    },
    {
      name: "Malachite", rarity: "legendary", breed: "sentinel", role: "healer", damageType: "tactical",
      notes: "Sentinel support. Command 'Warden's Rally': tactical to one same-lane enemy + a heal. Habit 'Forest's Instinct': 35% chance to give the OTHER two dragons +8% physical damage and reduced tactical damage taken; also First Strike & Advantage. Ideal Left Flank. [Confirmed from guides — Forest's Instinct is a team buff, not a flank skill.]",
    },
    {
      name: "Venator", rarity: "legendary", breed: "warrior", role: "physical", damageType: "physical",
      notes: "Warrior, top physical DPS. Command 'Feral Strike': chance for bonus physical after each basic attack + chance to gain Double Strike (2 rounds). Habits: +physical damage dealt; raises enemy physical damage taken; targets the weakest enemy. Wants Right Flank. [Confirmed from guides.]",
    },
    // ---- Epic ----
    {
      name: "Daemoros", rarity: "epic", breed: "warrior", role: "physical", damageType: "physical",
      notes: "Warrior. Command: high-rate physical with a chance to Burn. Habits: chance to inflict Panic (continuous tactical) and Confusion (madness), plus stat buffs / enemy debuffs. A key enabler for taunt (Burn) and Panic-scaling fire dealers. [Confirmed from guides.]",
    },
    {
      name: "Feskar", rarity: "epic", breed: "champion", role: "tactical", damageType: "tactical",
      notes: "Champion. Command: each round 50% chance for 100%-rate tactical damage to the enemy with the MOST troops; 50% chance to cut that target's physical & tactical damage dealt by 10%. [Confirmed from guides.]",
    },
    {
      name: "Rhysarion", rarity: "epic", breed: "champion", role: "fire", damageType: "fire",
      notes: "Champion. Command 'Dawn Song': chance physical; rounds 2/5/8 deal fire to all three enemies (more vs enemies with a control effect); heals the lowest-troop ally at 6★. Mixes damage with sustain. [Confirmed from guides.]",
    },
    {
      name: "Shadowsong", rarity: "epic", breed: "hunter", role: "fire", damageType: "fire",
      notes: "Hunter fire DPS. Command 'Breath of Fire' (rounds 2/5/8): fire to two adjacent enemies, ×1.5 vs Panic; gains Burn at 10★. Habits: 'Blazing Onslaught' (+fire dealt to left flank, + enemy physical taken on their right) and a chance to apply Vulnerable (×2 vs Panic). [Confirmed from guides.]",
    },
    {
      name: "Tashix", rarity: "epic", breed: "hunter", role: "fire", damageType: "fire",
      notes: "Hunter fire DPS. Command: 50% chance to gain Mirage and deal fire damage; each Mirage stack adds +2% fire damage until end of combat — scales hard in long (8-10 round) fights, so pair with sustain. [Confirmed from guides.]",
    },
    {
      name: "Vaeldra", rarity: "epic", breed: "warrior", role: "tank", damageType: "physical",
      notes: "Warrior: budget taunt tank (50% taunt chance). Solid free-to-play Vanguard.",
    },
    {
      name: "Velar", rarity: "epic", breed: "sentinel", role: "healer", damageType: "tactical",
      notes: "Sentinel support. Command: tactical to three enemies + Cleanse; grants Recovery, a First-Strike chance and Advantage; extra Recovery at 10★. Ideal Left-Flank support. [Confirmed from guides.]",
    },
    {
      name: "Zivern", rarity: "epic", breed: "sentinel", role: "tactical", damageType: "tactical",
      notes: "Sentinel: tactical damage dealer with panic. Benefits from left-flank tactical buffs.",
    },
    // ---- Rare ----
    {
      name: "Solstryker", rarity: "rare", breed: "champion", role: "control", damageType: "physical",
      notes: "Champion: budget suppressor that weakens enemies and shields allies.",
    },
    {
      name: "Antares", rarity: "rare", breed: "hunter", role: "fire", damageType: "fire",
      notes: "Hunter fire dealer. Command: chance to apply Vulnerable, plus Fire Damage to two adjacent enemies on rounds 3/6/9. Habits raise the Fire & Physical Damage Received of two enemies and its own Fire Damage Dealt. Its 6\u2605 habit does NOT apply Slow \u2014 it adds a Command fire hit against enemies that are ALREADY Slowed, so it only pays off next to a Slow applier (Vesper, Velar or a 6\u2605 Caraxes).",
    },
    {
      name: "Shimmer", rarity: "rare", breed: "sentinel", role: "healer", damageType: "tactical",
      notes: "Sentinel: budget support — recovery & resistance for the front line.",
    },
    {
      name: "Jagadrix", rarity: "rare", breed: "hunter", role: "fire", damageType: "fire",
      notes: "Hunter: fire damage with panic to soften enemies.",
    },
    {
      name: "Bevlorin", rarity: "rare", breed: "champion", role: "control", damageType: "physical",
      notes: "Champion (blue). Command 'Emberguard': each round a chance to cut the Fire Damage of three fire-dealing enemies, and deals Physical Damage on rounds 1/5/9 and 3/7 — Bevlorin's damage is physical, not tactical. Habits: Fire Ward stacks that cut fire damage taken for itself and an adjacent ally, Recovery to three allies, and an all-stat buff at 10★. A solid anti-fire support.",
    },
    {
      name: "Shadowrend", rarity: "rare", breed: "warrior", role: "physical", damageType: "physical",
      notes: "Warrior (blue). Command: ~45% chance physical; applies Panic. At 6★+: 40% chance to grant two allies Advantage (+10% damage, 2 rounds). [Confirmed from guides.]",
    },
    {
      name: "Thunderstrike", rarity: "rare", breed: "warrior", role: "physical", damageType: "physical",
      notes: "Warrior: physical damage with a stun chance.",
    },
    {
      name: "Vesper", rarity: "rare", breed: "sentinel", role: "healer", damageType: "tactical",
      notes: "Sentinel (blue). At 6★+: 20% chance to grant Resistance to itself and an adjacent ally (2 rounds), plus minor damage & intelligence buffs. Best blue dragon; pairs with other blue dragons. [Confirmed from guides.]",
    },
    // ---- Rare (New) ----
    {
      name: "Arulix", rarity: "rare", breed: "champion", role: "control", damageType: "tactical",
      notes: "Champion (New): suppressor that weakens enemy output.",
    },
    {
      name: "Nyrena", rarity: "rare", breed: "champion", role: "control", damageType: "fire",
      notes: "Champion (New): mixed-damage suppressor with burn.",
    },
    {
      name: "Dawnseeker", rarity: "rare", breed: "sentinel", role: "healer", damageType: "tactical",
      notes: "Sentinel (New): support healer with cleanse.",
    },
    {
      name: "Arrax", rarity: "rare", breed: "warrior", role: "physical", damageType: "physical",
      notes: "Warrior (New): straightforward physical damage dealer.",
    },
    // ---- Latest additions (this week) — not yet on the official dragon page.
    // Breed / abilities are PROVISIONAL from lore & YouTube; verify in-game and edit.
    {
      name: "Sheepstealer", rarity: "legendary", breed: "hunter", role: "fire", damageType: "fire",
      notes: "NEW this week — not yet on the official page (data PROVISIONAL). Feral fire dragon: self-buffs that ramp fire damage, plus an evasion passive for survivability. Verify breed/abilities in your Dragon Pit.",
    },
    {
      name: "Vermax", rarity: "epic", breed: "warrior", role: "physical", damageType: "physical",
      notes: "NEW this week — not yet on the official page (data PROVISIONAL: rarity confirmed Epic, breed/abilities estimated). Young, fast dragon. Verify breed/Command in your Dragon Pit and edit.",
    },
    {
      name: "Tessarion", rarity: "epic", breed: "champion", role: "fire", damageType: "fire",
      notes: "NEW (added July 6, 2026) — 'The Blue Queen', Daeron Targaryen's cobalt dragon. Epic Champion fire-support (rarity & breed confirmed; Command/Habits PROVISIONAL). Fire-focused offense that empowers fire-dealing allies (courage / Advantage) and debuffs foes ('dread'), with epic agility (Evasion) for survivability. Verify breed/abilities in your Dragon Pit and edit.",
    },
    {
      name: "Sunfyre", rarity: "legendary", breed: "sentinel", role: "healer", damageType: "tactical", isNew: true,
      notes: "NEW (added July 20, 2026) — 'The Golden', Aegon II Targaryen's dragon. Legendary Tactical Sentinel that turns incoming pressure into team value: deals steady Tactical Damage and grows more dangerous as his troops fall. Command 'Golden Wrath' (rounds 1/4/7/10): tactical to 1 enemy in-lane; below 75% troops hits a 2nd adjacent enemy; below 50% adds Fire Damage + chance to Burn (2 rounds). Habits: 'Radiant Majesty' (start of round, +Damage Dealt to your highest-troop ally — both allies below 75%, also himself below 50%); 'Extinguish' (start of combat, reduce a fire enemy's Fire Damage Dealt); 'The King's Ire' (each round, when an ally first takes Fire Damage, tactical to a fire enemy + chance to reduce Intelligence); 'Unbroken Splendor' (reduce his Fire Damage Received; below 50% reduce Damage Received + chance to Cleanse a Vulnerable-type debuff); 'Adaptive Glory' (first hit each round reacts by damage type — Recovery vs fire, buff top ally vs tactical, debuff enemy vs physical, +Instincts/Initiative vs basic attack). Best on a flank behind strong carriers; scales in long fights. Troop affinity: +Spearmen, +Cavalry.",
    },
    {
      name: "Tairax", rarity: "epic", breed: "hunter", role: "control", damageType: "fire", isNew: true,
      notes: "NEW (added July 20, 2026) — 'The Moonlit Stalker', Lady Lyra's stealthy dragon. Epic Fire Hunter built around control: repeated Stagger to shut down enemy actions while punishing controlled foes with Fire Damage and Burn. Command 'Burning Ward' (odd rounds): chance to Stagger 1 enemy in any lane 2 rounds (blocks Attack Modifier Commands + Basic Attacks); rounds 2/5/8 deal Fire Damage (prioritizes non-Burned) + chance to Burn. Habits: 'Whisper of Ash' (round 1, reduce an enemy's Strength & Initiative 5 rounds; round 6 self +Intelligence/Initiative); 'Sunder' (each round, +Damage Received to all enemies under a Control effect); 'Gleamstrike' (higher Stagger chance + fire to all controlled enemies); 'Gift of Fire' (per Burned enemy, chance to grant an ally Resistance); 'Moonlit Hunt' (round 1 self-Evade 5 rounds; round 6 +Fire Damage Dealt). Fragile but disruptive — pair with control-heavy allies and play for long fights. Troop affinity: +Cavalry, +Shieldbearers, +Siege.",
    },
    {
      name: "Vermithor", rarity: "legendary", breed: "champion", role: "tank", damageType: "physical", isNew: true,
      notes: "NEW (added July 30, 2026) — 'The Bronze Fury', King Jaehaerys I's dragon. Claimable on entering the 'Shadow of the Greens' campaign. Legendary Champion frontline anchor: protects struggling allies and punishes enemy aggression with mixed Physical + Tactical damage, getting harder to break the longer the fight runs. Command 'Bronze Fury' (rounds 2/4/6/8): physical + tactical to 2 enemies within adjacency; odd rounds: chance to apply Protect for 2 rounds to the adjacent ally with the fewest troops (Protect splits Command/Habit damage between that ally and Vermithor). Habits: 'Noble Sacrifice' (round 1, self +Tactical Damage Received, but reduce Physical Damage Dealt of 1 enemy — prioritizing Warriors — and Fire Damage Dealt of 1 enemy — prioritizing Hunters — for 5 rounds); 'Nimble Resilience' (start of combat, -Damage Received and +Initiative for the fight); 'Bronze Bulwark' (Bronze Fury deals more physical/tactical, higher Protect chance, and applying Protect reduces his Physical & Fire Damage Received 2 rounds); \"Fury's Poise\" (start of combat, -Physical Damage Received per enemy Warrior and -Fire Damage Received per enemy Hunter, until end of combat); 'Vengeful Fury' (once per combat, below 50% troops: physical to the lowest-Instincts enemy and tactical to the lowest-Intelligence enemy). Anchor him in the Vanguard, especially against Warrior/Hunter-heavy and physical/fire teams. Troop affinity: +Spearmen, +Shieldbearers.",
    },
    {
      name: "Starshower", rarity: "epic", breed: "sentinel", role: "tactical", damageType: "tactical", isNew: true,
      notes: "NEW (added July 30, 2026) — 'The Wishkeeper', the meteor-scattering guardian. Claimable on entering the 'Shadow of the Greens' campaign. Epic Sentinel that breaks the usual support mould and leans into Tactical offense: she marks the enemy team with Solar Flare and converts those marks into repeated tactical damage plus mitigation for allies. Command 'Starfall': start of combat marks EVERY enemy with Solar Flare; each round 50% chance to deal Tactical Damage to 1 marked enemy and consume the mark; rounds 1/3/7/9 also hit 1 enemy in her lane. Habits: 'Night Guardian' (each round, chance to Cleanse 1 negative effect from 2 other allies and give them Evade 1 round); 'Battle Subversion' (start of combat, reduce Intelligence & Initiative of 3 enemies — scales with her Instincts — for the fight); 'Ill Portents' (Starfall's consume damage grows each round; rounds 6-10, if no enemy is marked, re-mark the whole enemy team once per combat); 'Tactical Breach' (start of combat, +Tactical Damage Received on 1 enemy in her lane for the fight); \"Wishkeeper's Grace\" (consuming a Solar Flare reduces Damage Received of 2 adjacent allies 1 round — 1.5x if she has Resistance, or 3 allies in any lane if she has Advantage). Play her on a flank and keep marks flowing; she scales through long fights. Troop affinity: +Shieldbearers.",
    },
    {
      name: "Moondancer", rarity: "legendary", breed: "warrior", role: "physical", damageType: "physical", isNew: true,
      notes: "NEW (added August 9, 2026) — Baela Targaryen's pale-green dragon. Legendary Warrior physical carry built entirely around Rising Tide stacks (max 8), which he does NOT generate on his own: Command 'Crescent Blade' (round 1) hands the Crescent Blade mark to 1 other Ally SENTINEL, and every round that Sentinel deals Tactical Damage or applies Recovery there is a 50% chance Moondancer gains a stack (once per round). Each stack cuts his Damage Received by -2%, and the thresholds are what matter: at 4+ stacks his even-round Command hit to 2 adjacent enemies doubles (+109.5% → +219% at 6★), at 6+ stacks his 10★ debuff doubles. Habits: 'New Moon' (rounds 1,3,5 chance at a stack — DOUBLED if any ally has Advantage — plus Instinct & Tactical Damage to that Sentinel ally, 1.5x at 4+ stacks); 'Reactive Instincts' (start of combat, Instinct & Initiative to the ally with the highest Instinct); 'Full Moon' (rounds 6,8,10 more stacks, +1 if he has the fewest troops, and the 6★ Command damage upgrade); 'Blood Moon' (+Physical Damage Dealt at 4+ stacks, Bleed on 2 adjacent enemies, doubled at 6+); 'Eclipsing Strike' (weakens the enemy with the most troops, doubled chance plus Initiative shred at 6+ stacks). Run him with a Tactical/Recovery Sentinel and an Advantage giver or his ceiling never arrives; Vanguard skill gives him +16% Physical (Command & Habits). Troop affinity: +Shieldbearers, +Archers, -Siege.",
    },
  ];
  return list.map((d, i) => {
    // Use the real per-dragon affinity table; fall back to breed default.
    const affinity = AFFINITY[d.name]
      ? Object.assign(A0(), AFFINITY[d.name])
      : (d.affinity || (BREED_TROOP[d.breed] ? Object.assign(A0(), { [BREED_TROOP[d.breed]]: "+" }) : A0()));
    return {
      id: "seed-" + i + "-" + d.name.toLowerCase(),
      starRank: star[d.isNew ? "new" : d.rarity] || 1,
      reignLevel: 15,
      power: 0, // auto-estimated from rarity/star until you enter real numbers
      troopCapacity: 0,
      // Abilities and the Vanguard skill are not stored per dragon: they come
      // from kits.js, keyed by name, so corrections reach saved rosters too.
      tags: [],
      ...d,
      affinity,
    };
  });
}

// ---- Habits -----------------------------------------------------------------
// Passive skills unlocked by Star Rank, kept in js/habits.js because the text is
// bulky. Looked up by dragon name so roster entries stay small.
const HABITS = window.DRAGON_HABITS_DB || {
  HABIT_UNLOCK_STARS: [2, 4, 6, 8, 10],
  HABIT_MAX_LEVEL: 5,
  DRAGON_HABITS: {},
  habitsFor: () => [],
  habitsUnlockedCount: () => 0,
  clampHabitLevel: () => 1,
};

// ---- Kits -------------------------------------------------------------------
// Command skills, Vanguard skills and the combat effects read out of them.
const KITS = window.DRAGON_KITS_DB || {
  DRAGON_KITS: {},
  effectsAt: () => ({ applies: [], grants: [], self: [], wants: [] }),
  kitFor: () => null,
};

// ---- Name resolution --------------------------------------------------------
// One place decides whether a roster entry is an official dragon, so the editor
// and the optimizer can never disagree about it. Names are typed by hand and
// come back from the cloud in whatever the player saved, so compare on letters
// and digits alone: "Sea smoke", "tessarion" and "Syrax." all resolve.
const OFFICIAL_BY_KEY = {};
const KEY_CACHE = new Map();

function nameKey(name) {
  const raw = String(name || "");
  let key = KEY_CACHE.get(raw);
  if (key === undefined) {
    key = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "");
    KEY_CACHE.set(raw, key);
  }
  return key;
}

Object.keys(KITS.DRAGON_KITS).forEach((n) => { OFFICIAL_BY_KEY[nameKey(n)] = n; });
Object.keys(HABITS.DRAGON_HABITS).forEach((n) => { OFFICIAL_BY_KEY[nameKey(n)] = n; });

/**
 * The canonical official name behind a roster entry, or "" for a custom dragon.
 * Accepts a name or a whole dragon; passing the dragon also matches players who
 * renamed a seeded dragon (usually translating it), because the id we assigned
 * still says which one it is.
 */
function officialName(dragonOrName) {
  const d = dragonOrName && typeof dragonOrName === "object" ? dragonOrName : null;
  const hit = OFFICIAL_BY_KEY[nameKey(d ? d.name : dragonOrName)];
  if (hit) return hit;
  const seeded = d && /^seed-\d+-(.+)$/.exec(String(d.id || ""));
  return (seeded && OFFICIAL_BY_KEY[nameKey(seeded[1])]) || "";
}

// ---- Where each dragon's wording came from ---------------------------------
// Everything is Dragonfire Hub's data except the dragons below, which were
// transcribed from in-game screenshots before the Hub listed them. The credit
// the app shows follows this, so attribution always matches the real source.
const SCREENSHOT_SOURCED = ["Moondancer"].map(nameKey);

/** "hub" or "screenshots" — who the Command/Vanguard/Habit wording came from. */
function dataSource(dragonOrName) {
  return SCREENSHOT_SOURCED.indexOf(nameKey(officialName(dragonOrName))) === -1 ? "hub" : "screenshots";
}

const EMPTY_FX = { applies: [], grants: [], self: [], wants: [] };

/**
 * What a dragon can actually do right now. Official dragons resolve against
 * their kit at their current Star Rank, so a 2-star dragon contributes only its
 * Command skill and first habit. Custom dragons fall back to their ticked tags.
 */
function dragonEffects(d) {
  if (!d) return EMPTY_FX;
  const official = officialName(d);
  if (official) return KITS.effectsAt(official, d.starRank);

  const tags = Array.isArray(d.tags) ? d.tags : [];
  const fx = { applies: [], grants: [], self: [], wants: [] };
  tags.forEach((t) => {
    const want = /^wants([A-Z])(.*)$/.exec(t);
    if (want) fx.wants.push(want[1].toLowerCase() + want[2]);
    else if (EFFECTS.applies[t]) fx.applies.push(t);
    else if (EFFECTS.grants[t]) fx.grants.push(t);
  });
  return fx;
}

/** The Command/Vanguard kit for a dragon, or null if it is not an official one. */
function kitFor(name) {
  return KITS.kitFor(officialName(name));
}

/** The Vanguard skill for a dragon, or null if it has no known one. */
function vanguardFor(name) {
  const kit = kitFor(name);
  return kit ? kit.vanguard : null;
}

/** Habits at a dragon's Star Rank and upgrade levels; [] for custom dragons. */
function habitsFor(name, starRank, levels) {
  return HABITS.habitsFor(officialName(name), starRank, levels);
}

// Exposed globally for the no-build static site.
window.GAME = {
  TROOP_TYPES,
  TROOP_BEATS,
  POSITIONS,
  RARITIES,
  DAMAGE_TYPES,
  ROLES,
  BREEDS,
  EFFECTS,
  CONTROL_EFFECTS,
  HABIT_UNLOCK_STARS: HABITS.HABIT_UNLOCK_STARS,
  HABIT_MAX_LEVEL: HABITS.HABIT_MAX_LEVEL,
  DRAGON_HABITS: HABITS.DRAGON_HABITS,
  habitsFor,
  habitsUnlockedCount: HABITS.habitsUnlockedCount,
  clampHabitLevel: HABITS.clampHabitLevel,
  DRAGON_KITS: KITS.DRAGON_KITS,
  kitFor,
  officialName,
  dataSource,
  dragonEffects,
  vanguardFor,
  seedDragons,
};
