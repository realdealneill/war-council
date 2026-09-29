# Design brief: Dragonfire Formation Builder

Design a high-fidelity, interactive front-end for a **formation builder** for the mobile strategy game *Game of Thrones: Dragonfire*. It's a personal tool for one player (desktop-first, but it must still work on a phone), and it will be built in **React 19 + TypeScript + Tailwind CSS v4**. Build it with the mock data in this brief. Structure components and props around the data shapes below so the design maps straight onto the real engine.

The recommendation engine already exists. Your job is how the recommendations, and **the data behind every calculation**, are presented. The goal is a page where the player can see *why* a formation is recommended, not just that it is.

---

## 1. How formations work (domain primer)

- A **formation** is 3 dragons in 3 lanes: **Left Flank · Vanguard · Right Flank**. The Vanguard sits in the middle.
- The player **picks the Vanguard first**. The app then recommends the best dragons for the two flanks.
- Every dragon has:
  - a **rarity**: Rare, Epic, Legendary (Mythic reserved, none exist yet)
  - a **breed**: Champion, Hunter, Sentinel, Warrior
  - a **role**: Tank, Physical DPS, Tactical DPS, Fire DPS, Healer, Control
  - a **damage type**: Physical, Tactical, Fire
  - a **power** number
  - a **troop affinity** (+ / − / neutral) for each of 4 troop types: Cavalry 🐎, Shieldbearers 🛡️, Archers 🏹, Spearmen 🔱. Siege is excluded from this app.
- Every dragon has a **Vanguard skill**: a self buff, plus a buff to ONE specific flank (left or right). Example: Vhagar in the Vanguard gets "Damage Received −8%" and gives the Left Flank "Tactical Damage +16%". That flank buff is wasted unless the dragon on that flank deals Tactical damage.
- Every dragon has a **Command** skill (always active) and **5 Habits**.
  - Habits unlock at star ranks ★2 / ★4 / ★6 / ★8 / ★10.
  - Each habit levels 1–5 independently.
  - Each Command/Habit is broken into **clauses**. A clause is one mechanic: a buff, a debuff, a heal, a damage hit, or an applied effect like Taunt or Burn. Each clause has a target, timing, duration, and chance.
- A fight lasts **10 rounds**. The engine simulates it round by round to see which buffs and debuffs overlap.
- Troop types beat each other in a cycle: Cavalry → Shieldbearers → Archers → Spearmen → Cavalry.

## 2. How the score is calculated (this must be visible, not hidden)

```
bonusPct   = structuralPct + habitPct
score      = basePower × (1 + bonusPct)                 // the modeled effective power
rankScore  = basePower × (1 + emphasis × bonusPct)      // what recommendations sort by
```

- **basePower**: the sum of the 3 dragons' power.
- **structuralPct**: bonuses from where each dragon is placed and which troop type the army uses. The troop type is chosen automatically as the best of the 4. Categories:
  - **Troop affinity**: +7% of a dragon's power per dragon with + affinity, −7% per dragon with − affinity, plus a stacking bonus when 2–3 dragons share an affinity.
  - **Vanguard skill**: the self buff, plus the flank buff *if the flank dragon's damage type matches*.
  - **Position fit**: Tank in the Vanguard, Physical DPS on the Right Flank, Tactical/Fire/Healer on the Left Flank.
  - **Role balance**: at least 1 tank + 1 damage dealer.
- **habitPct**: **habit synergy**. It counts only value that passes *between* dragons:
  1. **Teammate buffs**: Dragon A's habit buffs Dragon B, e.g. "Malachite Habit 4 → Vhagar & Moondancer: Strength +25%".
  2. **Enemy debuffs a teammate uses**: A debuffs the enemy in a way B benefits from, e.g. "Vhagar Habit 4 → Moondancer: enemy Physical Damage Received +36%". This only counts because Moondancer deals Physical damage.
  3. **Set-ups**: B's clause is gated on or boosted by an effect that A applies, e.g. "Vhagar's Taunt chance doubles vs Burned targets — set up by Caraxes".
- **emphasis** is a slider from 0× to 3×, default 1×.
  - 0 = rank purely by power.
  - 1 = take synergy at face value.
  - 3 = synergy-first.
  - The player hasn't decided how to weigh synergy against power yet, so this slider is a **primary control**, not a buried setting. Show visibly how rankings reshuffle when it moves.

All conversion factors in the model are admitted estimates. The UI should present numbers as *modeled estimates*, e.g. "+38.4% est.", not as game truth.

## 3. Page layout requirements

**Most of the viewport is for recommendations and the calculation data.** The dragon roster customizer is secondary and lives in an **overlay** (slide-over drawer, sheet, or modal; your call) opened from a persistent button or header control. It must never permanently take a column away from the main view.

The main view needs to hold, roughly in priority order:

1. **Vanguard selection**: the chosen Vanguard, prominent and using its artwork, with its Vanguard skill (self buff + which flank it buffs, and with what). There's a "Change Vanguard" action. When nothing is chosen yet, the main view is a Vanguard picker. Tanks and Champions are marked ★ "recommended for Vanguard".
2. **Formation board**: the 3 lanes visualized left → right (Left Flank · Vanguard · Right Flank). Empty flanks invite a pick. The flank the Vanguard buffs is marked, e.g. "Buffed by Vhagar: favors Tactical dealers".
3. **Recommended flank pairs**: the top 5 (left, right) pairs for this Vanguard. Each shows both names, habit %, total synergy %, score, and troop type. Clicking one fills both flanks.
4. **Per-flank candidate lists**: every eligible dragon ranked for that lane. Columns: Power, Habits %, Synergy %, Score.
   - A ✓ marks dragons whose damage type matches the Vanguard's flank buff. Non-matching dragons are visibly de-emphasized, but not hidden.
   - While the other flank is empty, candidates are scored **as a pair with the Vanguard**. Once the other flank is filled, they're scored **as the full trio**. Show which mode is active.
5. **Calculation breakdown** for the selected (or hovered) formation. This is the heart of the page:
   - Score math laid out: basePower → +structural% → +habit% → score, and rankScore at the current emphasis. A stacked bar or waterfall works well here.
   - **Structural bonuses**, grouped by category (Troop, Vanguard skill, Position, Balance), each with its %.
   - **Habit synergy links**, each with source dragon, skill (Command / Habit N), recipients, effects, and %. The relationships would read well as a **link diagram** between the 3 lane cards (arrows from source to recipient, thickness = %) with a sortable list alongside.
   - **Warnings**, e.g. "Vhagar's Vanguard skill buffs Tactical damage on the Left Flank, but Venator deals Physical — swap the flanks to use it."
   - Optional, and valuable: a **10-round timeline** showing when each link is active (the engine computes per-round uptime, a 0–1 probability for each of the 10 rounds).
6. **Global controls**, always reachable:
   - Synergy emphasis slider (0–3×, step 0.25).
   - **Assumed habits**: "All 5 unlocked" | "Unlocked by star rank".
   - **Habit level**: 1–5.
   - A note that these assumptions apply until the roster records each dragon's real habits.

### The dragon customizer overlay (roster)

Opened on demand. For each of the 36 dragons:

- in roster / not in roster; active / benched toggle
- **star rank** ★1–10
- **level** 1–50
- **5 habit slots**, each locked until its star threshold (★2/4/6/8/10), then level 1–5

Bulk actions: add all, remove all, search/filter by rarity, role, and breed. Changes feed straight back into the recommendations (design the overlay so it can stay open over the page while those update).

Real per-dragon habits aren't wired into the engine yet. Design the overlay fully anyway; it's the next feature.

## 4. Data available to the front end

Use these shapes for props and mock data.

```ts
type Rarity = "rare" | "epic" | "legendary" | "mythic";
type Breed = "champion" | "hunter" | "sentinel" | "warrior";
type Role = "tank" | "physical" | "tactical" | "fire" | "healer" | "control";
type DamageType = "physical" | "tactical" | "fire";
type TroopType = "cavalry" | "shieldbearers" | "archers" | "spearmen";
type Slot = "left" | "vanguard" | "right";
type Affinity = "+" | "-" | 0;

interface Dragon {
  id: string;
  name: string;
  rarity: Rarity;
  breed: Breed;
  role: Role;
  damageType: DamageType;
  power: number;                 // shown everywhere as the dragon's power
  starRank: number;              // 1-10
  level?: number;                // 1-50 (customizer)
  habitLevels?: (number | null)[]; // 5 slots, null = locked (customizer)
  affinity: Record<TroopType, Affinity>;
  active: boolean;
  notes?: string;                // free-text strategy notes
  art: { portrait?: string; square?: string; hero?: string; fullbody: string[] }; // see §6
}

interface VanguardSkill {
  selfText: string;             // "Damage Received -8%"
  flankPos: "left" | "right";
  flankText: string;            // "Tactical Damage +16%"
}

interface SkillSummary {         // one per Command (slot 0) and Habit (1-5)
  habitSlot: number;
  shortText: string;             // game wording at the chosen level
  clauses: string[];             // one-line plain-English clause summaries (examples in §7)
}

interface SynergyEntry { text: string; pct: number }  // pct = fraction of basePower

interface HabitLink {            // one habit-synergy line
  source: string;                // dragon name
  skill: "Command" | `Habit ${1|2|3|4|5}`;
  recipients: string[];          // dragon names
  effects: string[];             // "Strength +25%", "Taunt", "enemy Fire Damage Received +36%"
  setUpBy?: string[];            // present for "set-up" links
  pct: number;
  uptimeByRound?: number[];      // 10 values, 0-1 (for the timeline)
}

interface FormationEvaluation {
  placement: { left: Dragon | null; vanguard: Dragon | null; right: Dragon | null };
  troopType: TroopType;
  basePower: number;
  structuralPct: number;
  habitPct: number;
  bonusPct: number;
  score: number;
  rankScore: number;
  structural: SynergyEntry[];    // troop / vanguard skill / position / balance lines
  habitLinks: HabitLink[];
  warnings: string[];
}

interface FlankCandidate { dragon: Dragon; fits: boolean; isTrio: boolean; eval: FormationEvaluation }
interface PairRecommendation { left: Dragon; right: Dragon; eval: FormationEvaluation }

interface Controls { emphasis: number; habitAssumption: "all" | "stars"; habitLevel: 1|2|3|4|5 }
```

Display labels:

- **Roles**: Tank / Taunt · Physical DPS · Tactical DPS · Fire DPS · Healer / Support · Control / Debuffer
- **Breeds**, with archetype: Champion (Suppressor) · Hunter (Debuffer) · Sentinel (Buffer) · Warrior (Enhancer)
- **Rarity colors**: Rare `#3b82f6` blue · Epic `#a855f7` purple · Legendary `#eab308` gold · Mythic `#ef4444` red
- **Lane preferences**: Tank → Vanguard · Physical → Right · Tactical/Fire/Healer → Left · Control → any

## 5. The 36 dragons (mock roster)

Power values are the current defaults (Legendary ★3 = 11,750 · Epic ★3 = 8,920 · Rare ★2 = 5,850). Affinity order: Cavalry / Shieldbearers / Archers / Spearmen (`·` = neutral). "VG buffs" = which flank that dragon's Vanguard skill buffs.

| Name | Rarity | Breed | Role | Damage | Power | Affinity | VG buffs | Art |
|---|---|---|---|---|---|---|---|---|
| Syrax | Legendary | Sentinel | Healer | Tactical | 11750 | · · + + | Left | yes |
| Vhagar | Legendary | Warrior | Tank | Physical | 11750 | · + + · | Left | yes |
| Caraxes | Legendary | Hunter | Fire DPS | Fire | 11750 | + · · + | Right | yes |
| Seasmoke | Legendary | Champion | Control | Fire | 11750 | + · + · | Right | yes |
| Crimson | Legendary | Hunter | Control | Fire | 11750 | · · + + | Right | yes |
| Kalspire | Legendary | Champion | Tank | Tactical | 11750 | + + · · | Right | yes |
| Malachite | Legendary | Sentinel | Healer | Tactical | 11750 | + + · · | Left | yes |
| Venator | Legendary | Warrior | Physical DPS | Physical | 11750 | · + · + | Left | yes |
| Sheepstealer | Legendary | Hunter | Fire DPS | Fire | 11750 | + · + · | Right | no |
| Sunfyre | Legendary | Sentinel | Healer | Tactical | 11750 | + · · + | Left | no |
| Vermithor | Legendary | Champion | Tank | Physical | 11750 | · + · + | Right | no |
| Moondancer | Legendary | Warrior | Physical DPS | Physical | 11750 | · + + · | Left | no |
| Daemoros | Epic | Warrior | Physical DPS | Physical | 8920 | · · + · | Left | yes |
| Feskar | Epic | Champion | Tactical DPS | Tactical | 8920 | + · · · | Right | yes |
| Rhysarion | Epic | Champion | Fire DPS | Fire | 8920 | · + · + | Right | yes |
| Shadowsong | Epic | Hunter | Fire DPS | Fire | 8920 | + · · · | Right | yes |
| Tashix | Epic | Hunter | Fire DPS | Fire | 8920 | · · + · | Right | yes |
| Vaeldra | Epic | Warrior | Tank | Physical | 8920 | · · · + | Left | yes |
| Velar | Epic | Sentinel | Healer | Tactical | 8920 | · + · · | Left | yes |
| Zivern | Epic | Sentinel | Tactical DPS | Tactical | 8920 | · · + · | Left | yes |
| Vermax | Epic | Warrior | Physical DPS | Physical | 8920 | + + · · | Left | no |
| Tessarion | Epic | Champion | Fire DPS | Fire | 8920 | + · · + | Right | no |
| Tairax | Epic | Hunter | Control | Fire | 8920 | + + · · | Left | no |
| Starshower | Epic | Sentinel | Tactical DPS | Tactical | 8920 | · + · · | Left | no |
| Solstryker | Rare | Champion | Control | Physical | 5850 | · · + · | Right | yes |
| Antares | Rare | Hunter | Fire DPS | Fire | 5850 | · · + · | Right | yes |
| Shimmer | Rare | Sentinel | Healer | Tactical | 5850 | + · · · | Left | yes |
| Jagadrix | Rare | Hunter | Fire DPS | Fire | 5850 | · · · + | Right | yes |
| Bevlorin | Rare | Champion | Control | Physical | 5850 | · · · + | Left | yes |
| Shadowrend | Rare | Warrior | Physical DPS | Physical | 5850 | · + · · | Left | yes |
| Thunderstrike | Rare | Warrior | Physical DPS | Physical | 5850 | + · · · | Left | yes |
| Vesper | Rare | Sentinel | Healer | Tactical | 5850 | · + · · | Left | yes |
| Arulix | Rare | Champion | Control | Tactical | 5850 | + · · · | Right | yes |
| Nyrena | Rare | Champion | Control | Fire | 5850 | · + · · | Right | yes |
| Dawnseeker | Rare | Sentinel | Healer | Tactical | 5850 | · · · + | Left | yes |
| Arrax | Rare | Warrior | Physical DPS | Physical | 5850 | · + + · | Left | yes |

Sample Vanguard skills:

| Dragon | Self | Flank buff |
|---|---|---|
| Vhagar | Damage Received −8% | Left: Tactical Damage +16% |
| Syrax | Tactical Damage +16% | Left: Instinct & Initiative +20 |
| Caraxes | Fire Damage +16% | Right: Strength & Initiative +20 |
| Malachite | Recovery +15%, Instinct +25 | Left: Fire Damage +16% |
| Moondancer | Physical Damage +16% | Left: Instinct & Initiative +20 |

## 6. Artwork

Every dragon with "Art: yes" has 4 kinds of image (webp), named by lowercase dragon name:

- `portrait/<name>.webp`: 474×560 card art, opaque. **Use for list rows and cards.**
- `square/<name>.webp`: 729×729 square portrait, opaque. **Use for avatars and chips.**
- `hero/<name>.webp`: ~2540×1240 head-and-neck cutout, **transparent**. **Use for the Vanguard hero area.**
- `fullbody/<name>-1.webp` (sometimes also `-2`, `-3`): full-body cutouts, **transparent**, very wide (up to 3900×1758). **Use in the formation board lanes.**

The 8 dragons without art (Sheepstealer, Vermax, Tessarion, Sunfyre, Tairax, Vermithor, Starshower, Moondancer) need a **designed fallback**, e.g. a rarity-colored silhouette or monogram. It must look intentional, because Moondancer shows up in top recommendations.

## 7. Worked example: real engine output (use this as mock data)

**Vanguard = Vhagar.** Assumptions: all 5 habits at level 5, emphasis 1×.

**Top 5 recommended flank pairs** (Left · Vanguard · Right):

| Pair | Habits | Structural | Total | Base | Score | Troop |
|---|---|---|---|---|---|---|
| Malachite · Vhagar · Moondancer | +38.4% | +28.3% | +66.7% | 35,250 | 58,775 | 🛡️ Shieldbearers |
| Malachite · Vhagar · Venator | +32.1% | +28.3% | +60.5% | 35,250 | 56,569 | 🛡️ Shieldbearers |
| Syrax · Vhagar · Moondancer | +28.0% | +28.3% | +56.3% | 35,250 | 55,097 | 🏹 Archers |
| Syrax · Vhagar · Sheepstealer | +27.0% | +26.7% | +53.7% | 35,250 | 54,169 | 🏹 Archers |
| Moondancer · Vhagar · Malachite | +33.4% | +20.0% | +53.4% | 35,250 | 54,075 | 🛡️ Shieldbearers |

The last row is the first pair with its flanks swapped. The habit total changes, and the structural total drops because the position fit and the Vanguard flank buff are lost. The UI should make that kind of difference easy to see.

**Effect of the emphasis slider on the top 3:**

- **At 0×:** Syrax·Caraxes, Syrax·Seasmoke and Syrax·Crimson all tie at 35,250, because only power counts. The UI needs a sensible way to show ties.
- **At 3×:** Malachite·Moondancer 105,824 · Malachite·Venator 99,208 · Syrax·Moondancer 94,790.

**Left Flank candidates** (pair mode: only Vhagar is placed). Top 6 and bottom 2 of 35:

| ✓ | Dragon | Role | Power | Habits | Synergy | Score |
|---|---|---|---|---|---|---|
| ✓ | Malachite | Healer | 11750 | +15.7% | +40.2% | 32,950 |
| ✓ | Syrax | Healer | 11750 | +9.6% | +34.1% | 31,509 |
|  | Sheepstealer | Fire DPS | 11750 | +10.2% | +30.7% | 30,716 |
| ✓ | Kalspire | Tank | 11750 | +8.2% | +30.7% | 30,709 |
|  | Moondancer | Physical DPS | 11750 | +12.1% | +30.6% | 30,701 |
|  | Venator | Physical DPS | 11750 | +11.1% | +29.6% | 30,446 |
| … | | | | | | |
|  | Bevlorin | Control | 5850 | +11.7% | +22.4% | 21,536 |
|  | Thunderstrike | Physical DPS | 5850 | +7.4% | +22.1% | 21,489 |

**Full breakdown: Malachite · Vhagar · Moondancer.** Base 35,250 → +28.3% structural → +38.4% habits → score 58,775. Troop: Shieldbearers. No warnings.

Structural:

- Troop: Malachite, Vhagar and Moondancer each have positive Shieldbearers affinity: +2.3% each
- Troop: stacked Shieldbearers affinity across 3 dragons: +6.0%
- Vanguard skill: Vhagar in Vanguard, Damage Received −8%: +1.3%
- Vanguard skill: Vhagar buffs the Left Flank, Tactical Damage +16% → Malachite: +5.3%
- Position: Moondancer (Physical DPS) on the Right Flank +1.7% · Malachite (Healer) on the Left Flank +1.3% · Vhagar (Tank) in the Vanguard +1.7%
- Balance: tank + damage dealer(s): +4.0%

Habit links:

| % | Source · Skill | → Recipients | Effects |
|---|---|---|---|
| +6.3% | Malachite · Habit 4 | Vhagar, Moondancer | Strength +25% |
| +5.0% | Vhagar · Habit 2 | Moondancer | Physical (Cmd/Habit) Damage Dealt +25% |
| +4.2% | Malachite · Command | Vhagar, Moondancer | Recovery |
| +4.2% | Vhagar · Command | Malachite, Moondancer | Taunt |
| +3.8% | Moondancer · Habit 1 | Malachite | Instinct +18%, Tactical Damage Dealt +12% |
| +3.7% | Malachite · Habit 1 | Vhagar, Moondancer | Physical (Cmd/Habit) Damage Dealt +16%, Tactical Damage Received −16% |
| +3.4% | Moondancer · Habit 2 | Malachite, Vhagar | Instinct +44%, Initiative +22% |
| +2.3% | Malachite · Habit 3 | Vhagar, Moondancer | Advantage |
| +1.7% | Moondancer · Habit 5 | Malachite, Vhagar | enemy All Damage Dealt −18%, enemy Initiative −25% |
| +1.7% | Vhagar · Habit 3 | Malachite, Moondancer | Advantage, Weakened |
| +1.2% | Malachite · Habit 5 | Vhagar | First Strike, Double Strike, Strength +25% |
| +0.7% | Vhagar · Habit 4 | Moondancer | enemy Physical (Cmd/Habit) Damage Received +36% |
| +0.1% | Moondancer · Habit 1 | (self) | Rising Tide, **set up by** Malachite & Vhagar |
| +0.1% | Moondancer · Habit 3 | (self) | Rising Tide, **set up by** Malachite & Vhagar |

**Example warning** (for a mismatched pick): "Vhagar's Vanguard skill buffs tactical damage on the Left Flank, but Venator deals physical — swap the flanks to use it."

**Example skill detail** (for a dragon detail popover or panel). Vhagar at habit level 5:

- **Command**
  - Apply Taunt (25% chance) · 3 enemies · each round, for 2 rounds (doubled to 50% vs Burned targets)
  - Physical damage hit +120% · 1 enemy within adjacency · even rounds
- **Habit 1** (★2): Physical & Tactical Damage Received −24% (self, rounds 1–3) | Recovery Received +30% (self, round 4 onward)
- **Habit 2** (★4): Physical Damage (Command & Habits) +25% to 1 ally (prefers the Right Flank) · whole fight
- **Habit 3** (★6): Advantage +20% to 1 ally and Weakened −20% to 1 enemy (35% chance) · rounds 3–7, for 2 rounds
- **Habit 4** (★8): enemy Fire Damage Received +36% (prefers the Left Flank enemy) & enemy Physical (Cmd/Habit) Damage Received +36% (prefers the Right Flank enemy) · round 1, for 3 rounds
- **Habit 5** (★10): per stack (max 5, 30% chance each round): Strength +12.5% and Damage Received −6.25% | at 3+ stacks, Physical damage hit +250% to the enemy in the same lane

## 8. States to design

- Loading: the dragon catalog and habit data load from the backend separately.
- Empty roster: prompt to open the customizer and add dragons.
- No Vanguard chosen: the Vanguard picker fills the main view.
- One flank chosen: the other flank's list switches to trio scoring.
- Both flanks chosen: the full breakdown.
- Ties (emphasis 0×), missing art, and long warning text.
- Phone width: lanes stack vertically and the breakdown collapses into sections. The overlay becomes a full-screen sheet.

## 9. Visual direction

- Dark, rich, "war council" feel befitting *Game of Thrones*. Keep it restrained: a data tool first, fantasy flavor second. Legibility of numbers beats ornament.
- Rarity color is the dominant identity cue, used on borders, glows and name tints.
- Role, breed, damage type and troop type each get a small, consistent icon or chip system.
- Positive % in green, negative/penalties in amber or red. Habit synergy gets its own accent (currently sky blue) so it's distinguishable from structural bonuses (currently neutral) and score (currently violet).
- Numbers use tabular figures. Percentages show one decimal.

## 10. Deliverable

An interactive prototype with:

- the main builder view, mocked with the Vhagar example above
- the Vanguard picker state
- the roster customizer overlay
- the phone layout

Also include a short component inventory mapped to the data shapes in §4, so it can be implemented in React + Tailwind v4.
