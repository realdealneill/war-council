/*
 * app.js — UI, state, persistence and wiring for the Formation Forge.
 */
(function () {
  const G = window.GAME;
  const S = window.SCORING;
  const O = window.OPTIMIZER;

  const STORAGE_KEY = "dragonfire.roster.v1";   // legacy single-roster (migrated from)
  const ROSTERS_KEY = "dragonfire.rosters.v1";  // multi-roster store
  // Ability checkboxes offered when hand-building a custom dragon. Official
  // dragons never use these — their abilities are read from js/kits.js.
  const capitalise = (s) => s[0].toUpperCase() + s.slice(1);
  const TAG_KEYS = [
    ...Object.keys(G.EFFECTS.applies),
    ...Object.keys(G.EFFECTS.grants),
    ...Object.keys(G.EFFECTS.wants).map((k) => "wants" + capitalise(k)),
  ];
  const TAG_HELP = Object.assign({}, G.EFFECTS.applies, G.EFFECTS.grants);
  Object.entries(G.EFFECTS.wants).forEach(([k, v]) => {
    TAG_HELP["wants" + capitalise(k)] = v;
  });

  // ---- State ----
  // `roster` is the working dragon list = the active roster's dragons.
  // `rosters` is the full named collection: [{ id, name, dragons, updatedAt }].
  let roster = [];
  let rosters = [];
  let activeId = null;
  let editingId = null;
  let lastResult = null;
  let lastGoal = "balanced";
  // Pinned formations the user has chosen to keep (survive re-optimizing).
  let savedFormations = [];
  // Persisted app-level preferences (kept in the same store as the rosters).
  let settings = { excludeUsed: false };
  // When signed in, roster data lives in the cloud — we deliberately do NOT
  // mirror it to localStorage, so signing out can't leak it to the next viewer.
  let cloudMode = false;

  // ---- Manual formations ----
  // "auto": the optimizer builds every formation from scratch.
  // "manual": you place dragons into named slots and the optimizer only fills
  // the slots you left open, which is how "here is my Vanguard, build the rest"
  // works. Both modes keep their own results, so switching loses nothing.
  let mode = "auto";
  // Dragons you placed by hand: one { left|vanguard|right: dragonId } map per
  // army index. These are fixed points — no swap or move can dislodge them.
  let manualLocks = [];
  // What the last fill put in the slots you did NOT place. Kept apart from your
  // picks so re-filling replaces suggestions without touching your choices.
  let manualFill = [];
  // Dragons the last fill left over, for the Benched strip.
  let manualBenchIds = [];

  // ---- Elements ----
  const $ = (sel) => document.querySelector(sel);
  const rosterList = $("#roster-list");
  const rosterEmpty = $("#roster-empty");
  const rosterCount = $("#roster-count");
  const rosterSearch = $("#roster-search");
  const results = $("#results");
  const resultsEmpty = $("#results-empty");
  const resultsSummary = $("#results-summary");
  const modal = $("#modal");
  const form = $("#dragon-form");
  const enemySelect = $("#enemy-troop");

  // ---- Persistence ----
  // Names from the old (pre-official) seed set that were renamed/removed.
  const STALE_NAMES = ["vega", "veigar", "roserion", "rycerion", "damaros", "caraxis", "veldra", "veila", "fesca", "cyrax", "bevllurin", "shadowwind"];
  const MIGRATION_KEY = "dragonfire.migrated.v2";

  function migrate() {
    if (localStorage.getItem(MIGRATION_KEY)) return;
    const before = roster.length;
    roster = roster.filter((d) => STALE_NAMES.indexOf((d.name || "").toLowerCase()) === -1);
    localStorage.setItem(MIGRATION_KEY, "1");
    if (roster.length !== before) {
      save();
      toast("Roster updated to the latest dragons — use 'Load sample roster' to refresh.");
    }
  }

  // ---- Multi-roster helpers ----
  function activeRoster() { return rosters.find((r) => r.id === activeId) || null; }
  function defaultRosterName() {
    let n = 1, name;
    do { name = "Roster " + n++; } while (rosters.some((r) => r.name === name));
    return name;
  }
  // Fold the working list back into the active roster entry.
  function syncActive() {
    const r = activeRoster();
    if (r) { r.dragons = roster; r.updatedAt = Date.now(); }
  }
  // Full state object (the unit synced to the cloud / localStorage).
  function snapshot() {
    syncActive();
    return {
      version: 2,
      activeId,
      rosters,
      savedFormations,
      settings,
      manual: { mode, locks: manualLocks, fill: manualFill },
    };
  }

  // Normalize any incoming state (new object form, or legacy dragon array).
  function applyState(state) {
    if (Array.isArray(state)) {
      rosters = [{ id: uid(), name: "My Roster", dragons: sanitizeDragons(state), updatedAt: Date.now() }];
      activeId = rosters[0].id;
    } else if (state && Array.isArray(state.rosters)) {
      rosters = state.rosters.map((r) => ({
        id: safeId(r && r.id),
        name: String((r && r.name) || "Roster").slice(0, 80),
        dragons: sanitizeDragons(r && r.dragons),
        updatedAt: Number(r && r.updatedAt) || Date.now(),
      }));
      activeId = safeId(state.activeId);
    } else {
      rosters = [];
    }
    if (!rosters.length) rosters = [{ id: uid(), name: "My Roster", dragons: [], updatedAt: Date.now() }];
    if (!activeRoster()) activeId = rosters[0].id;
    roster = (activeRoster().dragons || []).slice();

    const s = state && typeof state === "object" ? state : {};
    savedFormations = sanitizeSavedFormations(s.savedFormations);
    settings = { excludeUsed: !!(s.settings && s.settings.excludeUsed) };

    const manual = sanitizeManual(s.manual);
    mode = manual.mode;
    manualLocks = manual.locks;
    manualFill = manual.fill;
    manualBenchIds = [];
  }

  function load() {
    let loaded = null;
    try { const raw = localStorage.getItem(ROSTERS_KEY); if (raw) loaded = JSON.parse(raw); } catch (e) {}

    if (loaded && Array.isArray(loaded.rosters) && loaded.rosters.length) {
      applyState(loaded);
    } else {
      // First run on the new format — migrate the legacy single roster (if any).
      let legacy = [];
      try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) legacy = JSON.parse(raw) || []; } catch (e) {}
      applyState(legacy);
    }
    migrate();
    persistLocal();

    // URL share param → import as a NEW named roster.
    const params = new URLSearchParams(location.search);
    if (params.has("r")) {
      const shared = decodeRoster(params.get("r"));
      if (shared && shared.length) {
        createRoster("Shared roster", shared);
        history.replaceState(null, "", location.pathname);
        toast("Loaded shared roster");
      }
    }
  }

  function persistLocal() {
    // Signed in → the cloud is the source of truth; never cache it in the browser.
    if (cloudMode) return;
    const state = snapshot();
    try { localStorage.setItem(ROSTERS_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function save() { persistLocal(); scheduleCloudSync(); }

  // Push the full roster collection to the cloud (debounced) when signed in.
  // No-op in offline mode, so the app behaves identically without Supabase.
  let cloudTimer = null;
  function scheduleCloudSync() {
    if (!window.CLOUD || !window.CLOUD.isSignedIn || !window.CLOUD.isSignedIn()) return;
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(() => window.CLOUD.saveState(snapshot()), 800);
  }

  // ---- Roster operations ----
  function renderAll() { renderRoster(); renderRosterControls(); renderSaved(); applySettingsUI(); applyModeUI(); }

  function applySettingsUI() {
    const cb = $("#exclude-used");
    if (cb) cb.checked = !!settings.excludeUsed;
  }

  function clearResults() {
    lastResult = null;
    manualBenchIds = [];
    renderFormations();
  }

  function createRoster(name, dragons) {
    syncActive();
    const id = uid();
    const clean = sanitizeDragons(dragons);
    rosters.push({ id, name: String(name || defaultRosterName()).slice(0, 80), dragons: clean.slice(), updatedAt: Date.now() });
    activeId = id;
    roster = clean.slice();
    save();
    renderAll();
    clearResults();
  }

  function switchRoster(id) {
    if (id === activeId) return;
    syncActive();
    const r = rosters.find((x) => x.id === id);
    if (!r) return;
    activeId = id;
    roster = (r.dragons || []).slice();
    save();
    renderAll();
    clearResults();
    toast(`Loaded "${r.name}"`);
  }

  function renameRoster(id) {
    const r = rosters.find((x) => x.id === id);
    if (!r) return;
    const name = prompt("Rename roster:", r.name);
    if (name === null) return;
    r.name = name.trim() || r.name;
    save();
    renderRosterControls();
    toast("Roster renamed");
  }

  function deleteRoster(id) {
    const r = rosters.find((x) => x.id === id);
    if (!r) return;
    if (!confirm(`Delete roster "${r.name}"? This cannot be undone.`)) return;
    rosters = rosters.filter((x) => x.id !== id);
    if (!rosters.length) rosters = [{ id: uid(), name: "My Roster", dragons: [], updatedAt: Date.now() }];
    activeId = rosters[0].id;
    roster = (rosters[0].dragons || []).slice();
    save();
    renderAll();
    clearResults();
    toast("Roster deleted");
  }

  function newRoster() {
    const name = prompt("Name for the new roster:", defaultRosterName());
    if (name === null) return;
    createRoster(name.trim() || defaultRosterName(), []);
    toast("New roster created");
  }

  function duplicateRoster() {
    const cur = activeRoster();
    const name = prompt("Name for the copy:", (cur ? cur.name : "Roster") + " copy");
    if (name === null) return;
    createRoster(name.trim() || defaultRosterName(), roster.slice());
    toast("Roster duplicated");
  }

  function renderRosterControls() {
    const sel = $("#roster-select");
    if (!sel) return;
    syncActive();
    sel.innerHTML = rosters
      .map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)} (${r.dragons.length})</option>`)
      .join("");
    sel.value = activeId;
  }

  // Lightweight: refresh just the active option's count (no full rebuild),
  // called on every roster re-render so the dropdown stays accurate.
  function updateRosterCount() {
    const sel = $("#roster-select");
    if (!sel) return;
    const opt = sel.querySelector('option[value="' + activeId + '"]');
    const r = activeRoster();
    if (opt && r) opt.textContent = r.name + " (" + roster.length + ")";
  }

  function encodeRoster(r) {
    try { return btoa(unescape(encodeURIComponent(JSON.stringify(r)))); }
    catch (e) { return ""; }
  }
  function decodeRoster(s) {
    try { return JSON.parse(decodeURIComponent(escape(atob(s)))); }
    catch (e) { return null; }
  }

  // ---- Helpers ----
  function uid() { return "d-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function fmt(n) { return Math.round(n).toLocaleString(); }
  function rarityName(id) { const r = G.RARITIES.find((x) => x.id === id); return r ? r.name : id; }
  function roleName(id) { const r = G.ROLES.find((x) => x.id === id); return r ? r.name : id; }
  function breedName(id) { const b = G.BREEDS.find((x) => x.id === id); return b ? b.name : ""; }

  // ---- Input sanitization (defense-in-depth) ----
  // Roster data can arrive from untrusted sources: a crafted ?r=share link, an
  // imported JSON file, or stale cloud/localStorage. We coerce every field to a
  // known-safe type/value here so the rest of the app never handles attacker
  // strings (numbers stay numbers, ids/enums are whitelisted).
  const RARITY_IDS = new Set(G.RARITIES.map((x) => x.id));
  const ROLE_IDS = new Set(G.ROLES.map((x) => x.id));
  const BREED_IDS = new Set(G.BREEDS.map((x) => x.id));
  const DAMAGE_IDS = new Set(G.DAMAGE_TYPES.map((x) => x.id));
  const TROOP_IDS = G.TROOP_TYPES.map((t) => t.id);
  const TAG_SET = new Set(TAG_KEYS);
  // Rosters saved before abilities were named after the game's own effects.
  // Official dragons read from js/kits.js regardless, but a custom dragon would
  // otherwise silently lose these on load.
  const TAG_ALIASES = { heal: "recovery", scaling: "mirage" };

  // Damage types that earlier releases seeded incorrectly. Damage type decides
  // which Vanguard flank buff a dragon can use, so a stale value quietly costs
  // accuracy. Only applied to records written before the fix — see isLegacy().
  const DAMAGE_FIXES = {
    Seasmoke: { from: "tactical", to: "fire" },
    Bevlorin: { from: "tactical", to: "physical" },
  };

  // Pre-fix records carry a per-dragon `vanguard` object; the Vanguard skill now
  // comes from js/kits.js, so anything saved since never has one.
  const isLegacy = (d) => d && typeof d.vanguard === "object" && d.vanguard !== null;

  function correctDamageType(d) {
    const fix = DAMAGE_FIXES[G.officialName(d)];
    return fix && isLegacy(d) && d.damageType === fix.from ? fix.to : d.damageType;
  }

  function num(v, def, min, max) {
    let n = Number(v);
    if (!isFinite(n)) n = def;
    if (min != null && n < min) n = min;
    if (max != null && n > max) n = max;
    return n;
  }
  function pick(v, allowed, def) { return allowed.has(v) ? v : def; }
  const ID_RE = /^[A-Za-z0-9_-]{1,48}$/;
  function safeId(v) { return typeof v === "string" && ID_RE.test(v) ? v : uid(); }

  function sanitizeDragon(d) {
    d = d && typeof d === "object" ? d : {};
    const affinity = {};
    TROOP_IDS.forEach((id) => {
      const v = d.affinity && d.affinity[id];
      affinity[id] = v === "+" || v === "-" ? v : 0;
    });
    const src = Array.isArray(d.tags) ? d.tags.map((t) => TAG_ALIASES[t] || t) : [];
    const tags = src.filter((t, i) => TAG_SET.has(t) && src.indexOf(t) === i);
    return {
      id: safeId(d.id),
      name: String(d.name == null ? "" : d.name).slice(0, 80),
      rarity: pick(d.rarity, RARITY_IDS, "epic"),
      breed: pick(d.breed, BREED_IDS, ""),
      role: pick(d.role, ROLE_IDS, "physical"),
      damageType: pick(correctDamageType(d), DAMAGE_IDS, "physical"),
      power: num(d.power, 0, 0),
      starRank: num(d.starRank, 1, 0, 100),
      reignLevel: num(d.reignLevel, 0, 0, 1000),
      troopCapacity: num(d.troopCapacity, 0, 0),
      isNew: !!d.isNew,
      // Whether this dragon is included in formation calculations. Defaults to
      // true so existing rosters (and freshly added dragons) stay active.
      active: d.active === false ? false : true,
      affinity,
      tags,
      habitLevels: sanitizeHabitLevels(d.habitLevels),
      notes: String(d.notes == null ? "" : d.notes).slice(0, 2000),
    };
  }
  function sanitizeDragons(list) { return Array.isArray(list) ? list.map(sanitizeDragon) : []; }

  // Upgrade level (1-5) of each of the dragon's five habits. The habit text
  // itself lives in js/habits.js — a roster only records how far each is levelled.
  function sanitizeHabitLevels(levels) {
    const src = Array.isArray(levels) ? levels : [];
    return G.HABIT_UNLOCK_STARS.map((_, i) => G.clampHabitLevel(src[i]));
  }

  const SLOT_ORDER = ["left", "vanguard", "right"];
  const SLOT_LABEL = { left: "Left Flank", vanguard: "Vanguard", right: "Right Flank" };
  const SLOT_IDS = new Set(SLOT_ORDER);

  // Manual placements can arrive from cloud/localStorage too, so reduce them to
  // slot maps of known-safe ids before anything renders or scores them.
  function sanitizeManual(m) {
    m = m && typeof m === "object" ? m : {};
    const slotMap = (src) => {
      const out = {};
      if (src && typeof src === "object") {
        SLOT_ORDER.forEach((s) => { if (typeof src[s] === "string" && ID_RE.test(src[s])) out[s] = src[s]; });
      }
      return out;
    };
    const perArmy = (arr) => {
      const list = Array.isArray(arr) ? arr.slice(0, O.MAX_ARMIES) : [];
      return Array.from({ length: list.length }, (_, i) => slotMap(list[i]));
    };
    return {
      mode: m.mode === "manual" ? "manual" : "auto",
      locks: perArmy(m.locks),
      fill: perArmy(m.fill),
    };
  }

  // Saved formations can arrive from cloud/localStorage/import, so coerce them
  // to a known-safe shape before the UI ever touches them.
  function sanitizeSavedFormations(list) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, 200).map((f) => {
      f = f && typeof f === "object" ? f : {};
      const dragons = (Array.isArray(f.dragons) ? f.dragons : []).slice(0, 3).map((d) => {
        d = d && typeof d === "object" ? d : {};
        return {
          id: typeof d.id === "string" ? d.id.slice(0, 48) : "",
          name: String(d.name == null ? "" : d.name).slice(0, 80),
          role: pick(d.role, ROLE_IDS, "physical"),
          power: num(d.power, 0, 0),
          slot: SLOT_IDS.has(d.slot) ? d.slot : "vanguard",
        };
      });
      return {
        id: safeId(f.id),
        name: String(f.name == null ? "Formation" : f.name).slice(0, 80),
        goal: pick(f.goal, new Set(["balanced", "siege", "dps"]), "balanced"),
        troopType: pick(f.troopType, new Set(TROOP_IDS), ""),
        score: num(f.score, 0, 0),
        bonusPct: num(f.bonusPct, 0, 0),
        savedAt: Number(f.savedAt) || Date.now(),
        dragons,
      };
    });
  }

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add("hidden"), 2200);
  }

  // ---- Populate static selects / grids ----
  function initOptions() {
    const fill = (sel, items, valKey, labelKey) => {
      sel.innerHTML = items.map((i) => `<option value="${i[valKey]}">${i[labelKey]}</option>`).join("");
    };
    fill($("#f-rarity"), G.RARITIES, "id", "name");
    fill($("#f-breed"), G.BREEDS.map((b) => ({ id: b.id, label: `${b.name} (${b.archetype})` })), "id", "label");
    fill($("#f-role"), G.ROLES, "id", "name");
    fill($("#f-damage"), G.DAMAGE_TYPES, "id", "name");

    enemySelect.innerHTML = '<option value="">(none)</option>' +
      G.TROOP_TYPES.map((t) => `<option value="${t.id}">${t.icon} ${t.name}</option>`).join("");

    // affinity grid
    $("#affinity-grid").innerHTML = G.TROOP_TYPES.map((t) => `
      <div class="aff">
        <span>${t.icon}<br>${t.name}</span>
        <select name="aff_${t.id}">
          <option value="0">&middot;</option>
          <option value="+">+</option>
          <option value="-">&minus;</option>
        </select>
      </div>`).join("");

    // tags grid
    $("#tags-grid").innerHTML = TAG_KEYS.map((k) => `
      <label title="${TAG_HELP[k]}">
        <input type="checkbox" name="tag_${k}" /> ${k}
      </label>`).join("");

    // Roster view filters: the two things a formation is actually built around.
    const breedSel = $("#roster-breed");
    if (breedSel) {
      breedSel.innerHTML = '<option value="">Any breed</option>' +
        G.BREEDS.map((b) => `<option value="${b.id}">${b.name}</option>`).join("");
    }
    const troopSel = $("#roster-troop");
    if (troopSel) {
      troopSel.innerHTML = '<option value="">Any troop</option>' +
        G.TROOP_TYPES.map((t) => `<option value="${t.id}">${t.icon} ${t.name}</option>`).join("");
    }
  }

  // ---- Roster rendering ----
  function isActive(d) { return d.active !== false; }

  // Bounds mirror the Reign level field in the dragon editor.
  const REIGN_MIN = 0;
  const REIGN_MAX = 50;

  /**
   * Ability chips for a dragon, resolved at its current Star Rank so a card only
   * advertises what the dragon has actually unlocked. Effects it applies to
   * enemies come first — those are what enable the rest of the army.
   */
  function effectChips(d, limit) {
    const fx = G.dragonEffects(d);
    const chips = [
      ...fx.applies.map((t) => ({ t, cls: "tag" })),
      ...fx.grants.map((t) => ({ t, cls: "tag give" })),
      ...fx.wants.map((t) => ({ t, cls: "tag want", label: "wants " + t })),
    ];
    return chips
      .slice(0, limit)
      .map((c) => `<span class="${c.cls}">${escapeHtml(c.label || c.t)}</span>`)
      .join("");
  }

  // ---- Roster view: ordering and filtering ----
  // Breed (Warrior / Champion / …) and troop specialisation (Cavalry / Archers
  // / …) are what a formation is actually built around, so both can order the
  // list and narrow it. Sorts that group print a header per group, which is
  // what makes "by breed" readable rather than just differently shuffled.
  const rankOf = (list, key) => {
    const rank = {};
    list.forEach((x, i) => { rank[x.id] = i; });
    return (d) => (rank[d[key]] == null ? list.length : rank[d[key]]);
  };
  const breedRank = rankOf(G.BREEDS, "breed");
  const roleRank = rankOf(G.ROLES, "role");
  // RARITIES run rare → mythic, and the list should read strongest first.
  const rarityRank = rankOf(G.RARITIES.slice().reverse(), "rarity");

  const byPower = (a, b) => S.dragonPower(b) - S.dragonPower(a) || a.name.localeCompare(b.name);
  const ROSTER_SORTS = {
    power: { cmp: byPower },
    name: { cmp: (a, b) => a.name.localeCompare(b.name) },
    rarity: { cmp: (a, b) => rarityRank(a) - rarityRank(b) || byPower(a, b), group: (d) => rarityName(d.rarity) },
    breed: { cmp: (a, b) => breedRank(a) - breedRank(b) || byPower(a, b), group: (d) => breedName(d.breed) || "No breed" },
    role: { cmp: (a, b) => roleRank(a) - roleRank(b) || byPower(a, b), group: (d) => roleName(d.role) },
  };

  // How many dragons the filters currently let through, for the count line.
  let shownCount = null;

  function rosterView() {
    const q = (rosterSearch.value || "").toLowerCase().trim();
    const breed = ($("#roster-breed") || {}).value || "";
    const troop = ($("#roster-troop") || {}).value || "";
    const sort = ROSTER_SORTS[($("#roster-sort") || {}).value] || ROSTER_SORTS.power;

    const list = roster.filter((d) => {
      if (breed && d.breed !== breed) return false;
      if (troop && !(d.affinity && d.affinity[troop] === "+")) return false;
      if (!q) return true;
      return d.name.toLowerCase().includes(q) ||
        (d.role || "").includes(q) ||
        (d.breed || "").includes(q) ||
        breedName(d.breed).toLowerCase().includes(q) ||
        roleName(d.role).toLowerCase().includes(q);
    });
    list.sort(sort.cmp);
    return { list, sort };
  }

  // The troop types a dragon is specialised in, as the icons used everywhere else.
  function affinityIcons(d) {
    const plus = G.TROOP_TYPES.filter((t) => d.affinity && d.affinity[t.id] === "+");
    if (!plus.length) return "";
    const names = plus.map((t) => t.name).join(", ");
    return ` &middot; <span class="dc-aff" title="Positive affinity: ${escapeHtml(names)}">${plus.map((t) => t.icon).join("")}</span>`;
  }

  function renderRoster() {
    const { list: filtered, sort } = rosterView();
    rosterCount.textContent = roster.length;
    shownCount = filtered.length;
    updateRosterCount();
    updateActiveCount();

    if (roster.length === 0) {
      rosterList.innerHTML = "";
      rosterEmpty.classList.remove("hidden");
      return;
    }
    rosterEmpty.classList.add("hidden");

    if (!filtered.length) {
      rosterList.innerHTML = '<div class="roster-none">No dragons match the current search and filters.</div>';
      return;
    }

    const groupSizes = {};
    if (sort.group) filtered.forEach((d) => { const g = sort.group(d); groupSizes[g] = (groupSizes[g] || 0) + 1; });
    let lastGroup = null;

    rosterList.innerHTML = filtered.map((d) => {
      const power = S.dragonPower(d);
      const isEst = !(Number(d.power) > 0);
      const on = isActive(d);
      const tags = effectChips(d, 6);
      const reign = num(d.reignLevel, 0, REIGN_MIN);
      const habitCount = G.habitsFor(matchHabitName(d)).length;
      const habits = habitCount
        ? ` &middot; ${G.habitsUnlockedCount(d.starRank)}/${habitCount} habits`
        : "";
      let header = "";
      if (sort.group) {
        const g = sort.group(d);
        if (g !== lastGroup) {
          lastGroup = g;
          header = `<div class="roster-group">${escapeHtml(g)} <span class="pill">${groupSizes[g]}</span></div>`;
        }
      }
      return header + `
        <div class="drag-card rarity-${escapeHtml(d.rarity)}${on ? "" : " inactive"}" data-id="${escapeHtml(d.id)}">
          <div class="dc-name"><input type="checkbox" class="dc-active" data-id="${escapeHtml(d.id)}" ${on ? "checked" : ""} title="Include this dragon in formation calculations" aria-label="Include ${escapeHtml(d.name)} in formations" />${escapeHtml(d.name)} <span class="tag role">${escapeHtml(roleName(d.role))}</span>${d.isNew ? '<span class="tag new">NEW</span>' : ""}</div>
          <div class="dc-power">${fmt(power)}${isEst ? "*" : ""}</div>
          <div class="dc-level" title="Reign level — change it here, no need to open the dragon">
            <button type="button" class="dc-lv-step" data-id="${escapeHtml(d.id)}" data-delta="-1"
              aria-label="Lower ${escapeHtml(d.name)}'s reign level" ${reign <= REIGN_MIN ? "disabled" : ""}>&minus;</button>
            <span class="dc-lv-label">Lv</span>
            <input type="number" class="dc-lv-input" data-id="${escapeHtml(d.id)}" value="${reign}"
              min="${REIGN_MIN}" max="${REIGN_MAX}" step="1" inputmode="numeric"
              aria-label="Reign level for ${escapeHtml(d.name)}" />
            <button type="button" class="dc-lv-step" data-id="${escapeHtml(d.id)}" data-delta="1"
              aria-label="Raise ${escapeHtml(d.name)}'s reign level" ${reign >= REIGN_MAX ? "disabled" : ""}>+</button>
          </div>
          <div class="dc-meta">${escapeHtml(rarityName(d.rarity))}${d.breed ? " &middot; " + escapeHtml(breedName(d.breed)) : ""} &middot; ${escapeHtml(d.starRank || 1)}&#9733;${habits} &middot; ${escapeHtml(G.DAMAGE_TYPES.find((x)=>x.id===d.damageType)?.name || "")}${affinityIcons(d)}</div>
          <div class="dc-tags">${tags}</div>
        </div>`;
    }).join("");

    rosterList.querySelectorAll(".drag-card").forEach((el) => {
      el.addEventListener("click", () => openEdit(el.dataset.id));
    });
    // Checkbox toggles "active" without opening the editor.
    rosterList.querySelectorAll(".dc-active").forEach((cb) => {
      cb.addEventListener("click", (e) => e.stopPropagation());
      cb.addEventListener("change", (e) => { e.stopPropagation(); toggleActive(cb.dataset.id, cb.checked); });
    });
    // Same for the level stepper — clicks inside it must not open the editor.
    rosterList.querySelectorAll(".dc-level").forEach((box) => {
      box.addEventListener("click", (e) => e.stopPropagation());
    });
    rosterList.querySelectorAll(".dc-lv-step").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = roster.find((x) => x.id === btn.dataset.id);
        if (d) setReignLevel(btn.dataset.id, num(d.reignLevel, 0, REIGN_MIN) + Number(btn.dataset.delta));
      });
    });
    rosterList.querySelectorAll(".dc-lv-input").forEach((inp) => {
      inp.addEventListener("change", () => setReignLevel(inp.dataset.id, inp.value));
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } });
    });
  }

  function updateActiveCount() {
    const el = $("#active-count");
    if (!el) return;
    const total = roster.length;
    const on = roster.filter(isActive).length;
    const parts = [];
    if (total) parts.push(on === total ? "All active" : `${on}/${total} active`);
    if (total && shownCount != null && shownCount !== total) parts.push(`showing ${shownCount}`);
    el.textContent = parts.join(" \u00b7 ");
  }

  function toggleActive(id, on) {
    const d = roster.find((x) => x.id === id);
    if (!d) return;
    d.active = !!on;
    save();
    // Update the card's dimmed state + the count without a full rebuild.
    const card = rosterList.querySelector('.drag-card[data-id="' + id + '"]');
    if (card) card.classList.toggle("inactive", !on);
    updateActiveCount();
  }

  // Reign level is the number that keeps moving as you play, so the card edits it
  // in place. Like toggleActive, this patches the one card instead of rebuilding
  // the list — a re-render would resort under the cursor mid-adjustment.
  function setReignLevel(id, value) {
    const d = roster.find((x) => x.id === id);
    if (!d) return;
    const was = num(d.reignLevel, 0, REIGN_MIN);
    const lvl = Math.round(num(value, was, REIGN_MIN, REIGN_MAX));
    d.reignLevel = lvl;
    if (lvl !== was) save();

    const card = rosterList.querySelector('.drag-card[data-id="' + id + '"]');
    if (!card) return;
    const input = card.querySelector(".dc-lv-input");
    if (input) input.value = lvl; // snaps a typed-in out-of-range value back
    card.querySelectorAll(".dc-lv-step").forEach((b) => {
      b.disabled = Number(b.dataset.delta) < 0 ? lvl <= REIGN_MIN : lvl >= REIGN_MAX;
    });
    // Power is derived from the reign level unless it was entered by hand.
    const powerEl = card.querySelector(".dc-power");
    if (powerEl && !(Number(d.power) > 0)) powerEl.textContent = fmt(S.dragonPower(d)) + "*";
  }

  // Applies to what the list is actually showing, so "Select all" while filtered
  // to Warriors means the Warriors — not a silent change to dragons off screen.
  function setAllActive(on) {
    const shown = rosterView().list;
    shown.forEach((d) => { d.active = !!on; });
    save();
    renderRoster();
    const scope = shown.length === roster.length ? "All dragons" : `${shown.length} shown dragon${shown.length === 1 ? "" : "s"}`;
    toast(`${scope} ${on ? "activated" : "deactivated"}`);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  // ---- Modal / form ----
  function openAdd() {
    editingId = null;
    $("#modal-title").textContent = "Add Dragon";
    $("#modal-delete").classList.add("hidden");
    form.reset();
    editingHabitLevels = sanitizeHabitLevels(null);
    habitsExpanded = [];
    renderDragonKit();
    modal.classList.remove("hidden");
    form.name.focus();
  }

  function openEdit(id) {
    const d = roster.find((x) => x.id === id);
    if (!d) return;
    editingId = id;
    $("#modal-title").textContent = "Edit Dragon";
    $("#modal-delete").classList.remove("hidden");
    form.reset();

    form.name.value = d.name || "";
    form.rarity.value = d.rarity || "epic";
    if (form.breed) form.breed.value = d.breed || "warrior";
    form.role.value = d.role || "physical";
    form.damageType.value = d.damageType || "physical";
    form.power.value = d.power || "";
    form.starRank.value = d.starRank ?? 1;
    form.reignLevel.value = d.reignLevel ?? 10;
    form.troopCapacity.value = d.troopCapacity || "";
    form.notes.value = d.notes || "";

    G.TROOP_TYPES.forEach((t) => {
      const sel = form.querySelector(`[name="aff_${t.id}"]`);
      if (sel) sel.value = (d.affinity && d.affinity[t.id]) || "0";
    });
    TAG_KEYS.forEach((k) => {
      const cb = form.querySelector(`[name="tag_${k}"]`);
      if (cb) cb.checked = (d.tags || []).includes(k);
    });
    editingHabitLevels = sanitizeHabitLevels(d.habitLevels);
    habitsExpanded = [];
    renderDragonKit();

    modal.classList.remove("hidden");
  }

  function closeModal() { modal.classList.add("hidden"); }

  // Shown on every panel that renders Command / Vanguard / Habit wording. Most
  // of that wording is Dragonfire Hub's data, but a dragon transcribed from
  // in-game screenshots owes them no credit — so the line follows the dragon.
  const HUB_CREDIT = '<p class="data-credit">Source: Dragonfire Hub &ndash; ' +
    '<a href="https://dragonfire-hub.com" target="_blank" rel="noopener noreferrer">https://dragonfire-hub.com</a></p>';
  const SCREENSHOT_CREDIT = '<p class="data-credit">Source: transcribed from in-game screenshots.</p>';
  const dataCredit = (name) => (G.dataSource(name) === "hub" ? HUB_CREDIT : SCREENSHOT_CREDIT);

  // ---- Habits panel ----
  // Habits live in js/habits.js and are keyed by dragon name, so a custom dragon
  // named after an official one gets the official habit list too. The dragon
  // being edited only carries the upgrade level of each of its five habits.
  let editingHabitLevels = null;
  // Which habits have their full description expanded, kept across re-renders.
  let habitsExpanded = [];

  /**
   * Who to judge an upgrade against. A habit is only worth Breedmarks if
   * something on the field uses what it does, so the dragon's saved formation
   * is the honest yardstick; with all 36 dragons owned, the whole roster
   * supplies everything and the advice would say nothing.
   */
  function habitContext() {
    const pinned = editingId && savedFormations.find((f) =>
      (f.dragons || []).some((d) => d.id === editingId));
    if (pinned) {
      const mates = pinned.dragons
        .filter((d) => d.id !== editingId)
        .map((d) => roster.find((r) => r.id === d.id))
        .filter(Boolean);
      if (mates.length) {
        return { mates, scope: `the rest of your saved formation &ldquo;${escapeHtml(pinned.name)}&rdquo;` };
      }
    }
    return { mates: roster.filter((d) => d.id !== editingId), scope: "the rest of your roster" };
  }

  function renderHabits() {
    const box = $("#habits-box");
    const list = $("#habits-list");
    if (!box || !list) return;

    const stars = parseInt(form.starRank.value, 10) || 0;
    const official = matchHabitName(formSubject());
    const habits = G.habitsFor(official, stars, editingHabitLevels);
    if (!habits.length) {
      box.classList.add("hidden");
      list.innerHTML = "";
      return;
    }

    box.classList.remove("hidden");
    const unlocked = habits.filter((h) => h.unlocked).length;
    const nextUp = unlocked === habits.length ? "" : ` &mdash; the next needs ${habits[unlocked].star}&#9733;`;

    const ctx = habitContext();
    const advice = window.SCORING.habitAdvice(
      Object.assign({}, formSubject(), { starRank: stars, habitLevels: editingHabitLevels }),
      ctx.mates
    );
    const pick = advice.find((a) => a.ready) || null;
    const tip = pick
      ? `Upgrade <b>${pick.star}&#9733;</b> next: ${escapeHtml(pick.reason)}. Level ${pick.level}&rarr;${pick.level + 1}
         adds about ${Math.round(pick.gain * 100)}% to its numbers.${pick.missing.length
           ? ` It would be worth more with ${escapeHtml(pick.missing.join(" and "))} on the team.`
           : ""}
         <span class="habit-tip-scope">Weighed against ${ctx.scope}.</span>`
      : unlocked
        ? "Every unlocked habit is already at level 5 — star this dragon up to open the next one."
        : "No habits unlocked yet, so there is nothing to upgrade.";

    list.innerHTML = `
      <p class="habits-summary">${unlocked} of ${habits.length} unlocked at ${stars}&#9733;${nextUp}. Set each
        habit's upgrade level to match your game.</p>
      <p class="habit-tip">${tip}</p>
      ${habits.map((h, i) => {
        const open = !!habitsExpanded[i];
        const best = pick && pick.index === i;
        return `
        <div class="habit${h.unlocked ? "" : " locked"}${open ? " open" : ""}${best ? " pick" : ""}">
          <button type="button" class="habit-head" data-toggle="${i}" aria-expanded="${open}">
            <span class="habit-star">${h.star}&#9733;</span>
            <span class="habit-short">${escapeHtml(h.short)}</span>
            ${best ? '<span class="habit-pick">Upgrade next</span>' : ""}
            ${h.unlocked ? "" : '<span class="habit-lock">Locked</span>'}
            <span class="habit-chevron" aria-hidden="true">&#9662;</span>
          </button>
          <div class="habit-levels" role="group" aria-label="Upgrade level for the ${h.star}-star habit">
            <span class="habit-lv-label">Level</span>
            ${h.descLevels.map((_, l) => `
              <button type="button" class="habit-lv${l + 1 === h.level ? " on" : ""}"
                data-habit="${i}" data-level="${l + 1}" aria-pressed="${l + 1 === h.level}"
                ${h.unlocked ? "" : "disabled"}>${l + 1}</button>`).join("")}
          </div>
          <div class="habit-body${open ? "" : " hidden"}">
            <p class="habit-desc">${escapeHtml(h.desc)}</p>
            ${h.level === G.HABIT_MAX_LEVEL
              ? ""
              : `<p class="habit-max"><b>At Lv${G.HABIT_MAX_LEVEL}:</b> ${escapeHtml(h.maxDesc)}</p>`}
          </div>
        </div>`;
      }).join("")}
      ${dataCredit(official)}`;

    list.querySelectorAll(".habit-lv").forEach((btn) => {
      btn.addEventListener("click", () => {
        editingHabitLevels[Number(btn.dataset.habit)] = Number(btn.dataset.level);
        renderHabits();
      });
    });
    list.querySelectorAll(".habit-head").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.toggle);
        habitsExpanded[i] = !habitsExpanded[i];
        renderHabits();
      });
    });
  }

  // Same resolver the optimizer scores with, so the editor can never show a kit
  // the formations ignore.
  const matchHabitName = G.officialName;

  // What the editor is currently describing. Carrying the id lets a renamed
  // official dragon still resolve to its kit, exactly as the optimizer does.
  function formSubject() {
    return { name: (form.name.value || "").trim(), id: editingId || "" };
  }

  // Everything in the editor that is derived from the dragon's name and stars.
  function renderDragonKit() {
    renderKit();
    renderHabits();
  }

  // ---- Command & Vanguard skill panel ----
  // Official kit data is read-only: it is what the optimizer scores synergy
  // from, so showing it here explains the recommendations. Custom dragons have
  // no kit, and fall back to the hand-ticked ability checkboxes instead.
  function renderKit() {
    const box = $("#kit-box");
    const body = $("#kit-body");
    const tagsBox = $("#tags-box");
    if (!box || !body) return;

    const official = matchHabitName(formSubject());
    const kit = G.kitFor(official);
    if (tagsBox) tagsBox.classList.toggle("hidden", !!kit);
    if (!kit) {
      box.classList.add("hidden");
      body.innerHTML = "";
      return;
    }

    box.classList.remove("hidden");
    const stars = parseInt(form.starRank.value, 10) || 0;
    const vg = kit.vanguard;
    const flank = vg && (vg.flankPos === "left" ? "Left Flank" : "Right Flank");
    const upgrades = kit.upgrades
      .map((u) => `<p class="kit-upgrade${stars >= u.star ? "" : " locked"}"><b>${u.star}&#9733;:</b> ${escapeHtml(u.text)}</p>`)
      .join("");

    body.innerHTML = `
      <div class="kit-skill">
        <h4>Command</h4>
        <p>${escapeHtml(kit.command)}</p>
        ${upgrades}
      </div>
      ${vg ? `
      <div class="kit-skill">
        <h4>Vanguard <small>(only while in the centre)</small></h4>
        <p>${escapeHtml(vg.text)}</p>
        <p class="kit-parsed"><span>Itself:</span> ${escapeHtml(vg.selfText)}
          &nbsp;&middot;&nbsp; <span>${flank}:</span> ${escapeHtml(vg.flankText)}</p>
      </div>` : ""}
      <div class="kit-skill">
        <h4>Effects at ${stars}&#9733;</h4>
        <div class="dc-tags">${effectChips({ name: official, starRank: stars })}</div>
      </div>
      ${dataCredit(official)}`;
  }

  function readForm() {
    const fd = new FormData(form);
    const affinity = {};
    G.TROOP_TYPES.forEach((t) => {
      const v = fd.get(`aff_${t.id}`);
      affinity[t.id] = v === "+" || v === "-" ? v : 0;
    });
    const tags = TAG_KEYS.filter((k) => fd.get(`tag_${k}`));
    // Preserve the active flag across edits; new dragons default to active.
    const prev = editingId ? roster.find((x) => x.id === editingId) : null;
    return {
      id: editingId || uid(),
      active: prev ? prev.active !== false : true,
      name: (fd.get("name") || "").trim(),
      rarity: fd.get("rarity"),
      breed: fd.get("breed") || "",
      role: fd.get("role"),
      damageType: fd.get("damageType"),
      power: parseFloat(fd.get("power")) || 0,
      starRank: parseInt(fd.get("starRank")) || 1,
      reignLevel: parseInt(fd.get("reignLevel")) || 0,
      troopCapacity: parseFloat(fd.get("troopCapacity")) || 0,
      affinity,
      tags,
      habitLevels: sanitizeHabitLevels(editingHabitLevels),
      notes: (fd.get("notes") || "").trim(),
    };
  }

  function onSubmit(e) {
    e.preventDefault();
    const d = readForm();
    if (!d.name) return;
    if (editingId) {
      const i = roster.findIndex((x) => x.id === editingId);
      roster[i] = d;
    } else {
      roster.push(d);
    }
    save();
    renderRoster();
    closeModal();
    toast(editingId ? "Dragon updated" : "Dragon added");
  }

  function onDelete() {
    if (!editingId) return;
    roster = roster.filter((x) => x.id !== editingId);
    save();
    renderRoster();
    closeModal();
    toast("Dragon removed");
  }

  // ---- Optimize + render results ----
  function currentGoal() { return ($("#formation-goal") || {}).value || "balanced"; }
  function currentArmyCount() { return parseInt(($("#army-count") || {}).value, 10) || 3; }

  // Siege formations must use Siege troops to actually deal siege damage. Every
  // other goal fights armies, where Siege loses the troop-advantage cycle to all
  // four other types — a siege-affinity stack can still edge out the
  // alternatives on raw stats, so Siege is taken off the table entirely.
  function troopOptionsFor(goal) {
    return goal === "siege" ? ["siege"] : TROOP_IDS.filter((t) => t !== "siege");
  }

  function optimize() {
    if (roster.length === 0) {
      toast("Add some dragons first");
      return;
    }
    // Only active dragons take part in the calculation.
    let pool = roster.filter(isActive);
    if (pool.length === 0) {
      toast("No active dragons — tick some on the left to include them");
      return;
    }

    const numArmies = currentArmyCount();
    const goal = currentGoal();

    // Optionally drop dragons already pinned in a saved formation FOR THIS GOAL,
    // so each Optimize builds the next team from whoever's left. Saves under a
    // different goal don't block this one — goals are independent.
    if (settings.excludeUsed) {
      const used = usedDragonIds(goal);
      pool = pool.filter((d) => !used.has(d.id));
      if (pool.length === 0) {
        toast(`Every active dragon is already in a saved ${goalLabel(goal)} formation`);
        return;
      }
    }

    lastResult = O.optimize(pool, {
      iterations: 300,
      numArmies,
      goal,
      troopOptions: troopOptionsFor(goal),
    });
    lastGoal = goal;
    renderResults();
    const gLabel = goal === "siege" ? "siege" : goal === "dps" ? "DPS" : "max-power";
    toast(`Built ${lastResult.armies.filter(a=>a.dragons.length).length} of ${numArmies} ${gLabel} armies`);
  }

  // Set of dragon ids pinned in saved formations. When a goal is given, only
  // formations saved under that goal count (goals exclude independently).
  function usedDragonIds(goal) {
    const set = new Set();
    savedFormations.forEach((f) => {
      if (goal && f.goal !== goal) return;
      (f.dragons || []).forEach((d) => { if (d.id) set.add(d.id); });
    });
    return set;
  }

  function renderResults() {
    if (!lastResult) return;
    resultsEmpty.classList.add("hidden");
    const enemy = enemySelect.value;

    const usedDragons = lastResult.armies.reduce((s, a) => s + a.dragons.length, 0);
    const totalBase = lastResult.armies.reduce((s, a) => s + (a.eval.basePower || 0), 0);
    const totalEff = lastResult.total;
    const synGain = totalBase > 0 ? ((totalEff - totalBase) / totalBase) * 100 : 0;

    resultsSummary.classList.remove("hidden");
    resultsSummary.innerHTML = `
      <div class="stat"><b>${escapeHtml(goalLabel(lastGoal))}</b><span>Formation goal</span></div>
      <div class="stat"><b>${fmt(totalEff)}</b><span>${scoreLabel(lastGoal)}</span></div>
      <div class="stat"><b>+${synGain.toFixed(1)}%</b><span>Synergy uplift over base</span></div>
      <div class="stat"><b>${usedDragons}</b><span>Dragons deployed (${lastResult.bench.length} benched)</span></div>
      ${goalNote(lastGoal)}`;

    results.innerHTML = lastResult.armies.map((army, idx) => renderArmy(army, idx, enemy)).join("");

    results.querySelectorAll(".pin-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        saveFormation(parseInt(btn.dataset.army, 10));
      });
    });

    results.insertAdjacentHTML("beforeend", benchStrip(lastResult.bench));
  }

  function renderArmy(army, idx, enemy) {
    if (!army.dragons.length) return "";
    const ev = army.eval;
    const troop = G.TROOP_TYPES.find((t) => t.id === ev.troopType);
    const place = ev.placement;

    const slots = SLOT_ORDER.map((key) => {
      const d = place[key];
      if (!d) return `<div class="slot empty-slot ${key}"><div class="s-pos">${SLOT_LABEL[key]}</div>&mdash;</div>`;
      return `
        <div class="slot ${key}">
          <div class="s-pos">${SLOT_LABEL[key]}</div>
          <div class="s-name">${escapeHtml(d.name)}</div>
          <div class="s-role">${escapeHtml(roleName(d.role))}</div>
          <div class="s-power">${fmt(S.dragonPower(d))}</div>
        </div>`;
    }).join("");

    return `
      <div class="army">
        <div class="army-head">
          <div>
            <div class="a-title">Army ${idx + 1}</div>
            <div class="a-troop">${troop ? troop.icon + " " + troop.name : "—"} ${matchupTag(ev.troopType, enemy)}</div>
          </div>
          <div class="a-right">
            <div class="a-power">
              <b>${fmt(ev.score)}</b>
              <small>+${(ev.bonusPct * 100).toFixed(1)}% synergy</small>
            </div>
            <button class="btn pin-btn" data-army="${idx}" title="Save this formation so it won't be lost">&#128204; Save</button>
          </div>
        </div>
        <div class="slots">${slots}</div>
        ${explainBlock(ev)}
      </div>`;
  }

  // Why a formation scores what it scores — the same explanation in both modes.
  function explainBlock(ev) {
    const synergies = (ev.synergies || [])
      .filter((s) => s.pct >= 0.001)
      .sort((a, b) => b.pct - a.pct)
      .map((s) => `<li><span class="syn-pct">+${(s.pct * 100).toFixed(1)}%</span><span>${escapeHtml(s.text)}</span></li>`)
      .join("");
    const warnings = (ev.warnings || []).map((w) => `<li>${escapeHtml(w)}</li>`).join("");
    if (!synergies && !warnings) return "";
    return `
      <div class="synergies">
        ${synergies ? `<h4>Bonuses</h4><ul class="syn-list">${synergies}</ul>` : ""}
        ${warnings ? `<h4>Watch out</h4><ul class="syn-list warn-list">${warnings}</ul>` : ""}
      </div>`;
  }

  function matchupTag(troopType, enemy) {
    if (!enemy || !troopType) return "";
    const m = S.troopMatchup(troopType, enemy);
    const cls = m.delta > 0 ? "adv" : m.delta < 0 ? "dis" : "";
    return `<span class="matchup ${cls}">vs enemy: ${m.label}</span>`;
  }

  function benchStrip(dragons) {
    if (!dragons.length) return "";
    return `
      <div class="bench" style="grid-column:1/-1">
        <h3>Benched (${dragons.length})</h3>
        <div class="bench-list">
          ${dragons.map((d) => `<span class="bench-chip">${escapeHtml(d.name)} &middot; ${fmt(S.dragonPower(d))}</span>`).join("")}
        </div>
      </div>`;
  }

  // ---- Manual formations ----
  // You place dragons into named slots; the optimizer fills only what is left.
  // Everything you place is a lock, so a chosen Vanguard stays in the centre
  // instead of being shuffled to a flank for a marginally better score.

  function setMode(next) {
    const want = next === "manual" ? "manual" : "auto";
    if (mode === want) return;
    mode = want;
    save();
    applyModeUI();
    renderFormations();
  }

  function applyModeUI() {
    const manual = mode === "manual";
    document.querySelectorAll(".mode-btn").forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const title = $("#results-title");
    if (title) title.textContent = manual ? "Manual Formations" : "Optimized Formations";
    const btn = $("#btn-optimize");
    if (btn) {
      btn.innerHTML = manual ? "&#9889; Fill Remaining Slots" : "&#9889; Optimize Formations";
      btn.title = manual
        ? "Keep every dragon you placed and let the optimizer pick the best dragons for the empty slots"
        : "Build every formation from scratch";
    }
  }

  function renderFormations() {
    if (mode === "manual") { renderManual(); return; }
    if (lastResult) { renderResults(); return; }
    results.innerHTML = "";
    resultsSummary.classList.add("hidden");
    resultsEmpty.classList.remove("hidden");
  }

  function slotMapAt(list, i) {
    while (list.length <= i) list.push({});
    if (!list[i] || typeof list[i] !== "object") list[i] = {};
    return list[i];
  }
  const lockedAt = (i, slot) => (manualLocks[i] || {})[slot] || "";
  const filledAt = (i, slot) => (manualFill[i] || {})[slot] || "";
  const manualLength = () => Math.max(manualLocks.length, manualFill.length);

  // Who stands in each slot of a formation right now: your own picks win over
  // the optimizer's suggestions. Ids that no longer exist read as empty.
  function placedIn(i) {
    const out = { left: null, vanguard: null, right: null };
    SLOT_ORDER.forEach((s) => {
      const id = lockedAt(i, s) || filledAt(i, s);
      out[s] = id ? roster.find((d) => d.id === id) || null : null;
    });
    return out;
  }

  // Where a dragon already stands, so the picker can say so before you move it.
  function placementOf(id) {
    for (let i = 0; i < manualLength(); i++) {
      const slot = SLOT_ORDER.find((s) => lockedAt(i, s) === id || filledAt(i, s) === id);
      if (slot) return { army: i, slot, locked: lockedAt(i, slot) === id };
    }
    return null;
  }

  // A dragon can only stand in one place, so drop every other reference to it.
  function unplace(id) {
    [manualLocks, manualFill].forEach((list) => list.forEach((m) => {
      if (m) SLOT_ORDER.forEach((s) => { if (m[s] === id) delete m[s]; });
    }));
  }

  // Catches a duplicate that survived in a formation currently out of view
  // because the army count was lowered. Your picks claim their dragon first.
  function dedupeManual() {
    const seen = new Set();
    [manualLocks, manualFill].forEach((list) => list.forEach((m) => {
      if (!m) return;
      SLOT_ORDER.forEach((s) => {
        const id = m[s];
        if (!id) return;
        if (seen.has(id)) delete m[s];
        else seen.add(id);
      });
    }));
  }

  function setManualSlot(i, slot, id) {
    unplace(id);
    slotMapAt(manualLocks, i)[slot] = id;
    delete slotMapAt(manualFill, i)[slot];
    save();
    renderManual();
  }

  function clearManualSlot(i, slot) {
    delete slotMapAt(manualLocks, i)[slot];
    delete slotMapAt(manualFill, i)[slot];
    save();
    renderManual();
  }

  function clearManual() {
    if (!confirm("Clear every dragon from your manual formations?")) return;
    manualLocks = [];
    manualFill = [];
    manualBenchIds = [];
    save();
    renderManual();
    toast("Manual formations cleared");
  }

  /**
   * Score one manual formation exactly as it stands. Every filled slot is passed
   * as a lock, so bestArmy() is left with nothing to decide but the troop type —
   * which is the whole point: the summary describes YOUR formation, not the
   * optimizer's rearrangement of it.
   */
  function manualEval(i, goal, troops) {
    return evalPlacement(placedIn(i), goal, troops);
  }

  function evalPlacement(placed, goal, troops) {
    const locks = {};
    const dragons = [];
    SLOT_ORDER.forEach((s) => {
      if (!placed[s]) return;
      locks[s] = placed[s];
      dragons.push(placed[s]);
    });
    if (!dragons.length) {
      return { score: 0, basePower: 0, rawPower: 0, bonusPct: 0, synergies: [], warnings: [], placement: { left: null, vanguard: null, right: null }, troopType: null };
    }
    return S.bestArmy(dragons, troops, goal, locks);
  }

  function renderManual() {
    dedupeManual();
    const goal = currentGoal();
    const troops = troopOptionsFor(goal);
    const numArmies = currentArmyCount();
    const enemy = enemySelect.value;

    resultsEmpty.classList.add("hidden");

    const evals = [];
    for (let i = 0; i < numArmies; i++) evals.push(manualEval(i, goal, troops));

    const placed = evals.reduce((s, ev) => s + SLOT_ORDER.filter((k) => ev.placement[k]).length, 0);
    const open = numArmies * O.ARMY_SIZE - placed;
    let mine = 0;
    for (let i = 0; i < numArmies; i++) mine += SLOT_ORDER.filter((s) => lockedAt(i, s)).length;

    const totalEff = evals.reduce((s, ev) => s + ev.score, 0);
    const totalBase = evals.reduce((s, ev) => s + (ev.basePower || 0), 0);
    const uplift = totalBase > 0 ? ((totalEff - totalBase) / totalBase) * 100 : 0;

    resultsSummary.classList.remove("hidden");
    resultsSummary.innerHTML = `
      <div class="stat"><b>${escapeHtml(goalLabel(goal))}</b><span>Formation goal</span></div>
      <div class="stat"><b>${fmt(totalEff)}</b><span>${scoreLabel(goal)}</span></div>
      <div class="stat"><b>${totalBase > 0 ? "+" + uplift.toFixed(1) + "%" : "&mdash;"}</b><span>Synergy uplift over base</span></div>
      <div class="stat"><b>${placed}</b><span>Dragons placed (${open} slot${open === 1 ? "" : "s"} open)</span></div>
      <div class="stat"><b>${mine}</b><span>Locked by you</span></div>
      ${goalNote(goal)}`;

    const hint = `
      <div class="manual-hint">
        <p>Click a slot to choose who stands there &mdash; the list is ranked by what each dragon
          would do to <em>this</em> formation. Anything you place is <b>locked</b>: press
          <b>Fill Remaining Slots</b> and the optimizer keeps your picks and chooses the best
          dragons for whatever is still empty.</p>
        ${placed ? '<button type="button" class="linkbtn danger" id="manual-clear">Clear all placements</button>' : ""}
      </div>`;

    const bench = manualBenchIds.map((id) => roster.find((d) => d.id === id)).filter(Boolean);
    results.innerHTML = hint +
      evals.map((ev, i) => renderManualArmy(ev, i, enemy)).join("") +
      benchStrip(bench);

    results.querySelectorAll(".pick-slot").forEach((el) => {
      el.addEventListener("click", () => openSlotPicker(Number(el.dataset.army), el.dataset.slot));
    });
    results.querySelectorAll(".clear-slot").forEach((el) => {
      el.addEventListener("click", () => clearManualSlot(Number(el.dataset.army), el.dataset.slot));
    });
    results.querySelectorAll(".manual-save").forEach((el) => {
      el.addEventListener("click", () => saveEval(manualEval(Number(el.dataset.army), goal, troops), goal));
    });
    const clearBtn = $("#manual-clear");
    if (clearBtn) clearBtn.addEventListener("click", clearManual);
  }

  function renderManualArmy(ev, idx, enemy) {
    const place = ev.placement;
    const count = SLOT_ORDER.filter((s) => place[s]).length;
    const troop = count ? G.TROOP_TYPES.find((t) => t.id === ev.troopType) : null;

    const slots = SLOT_ORDER.map((s) => {
      const label = SLOT_LABEL[s];
      const d = place[s];
      if (!d) {
        return `
          <button type="button" class="slot empty-slot pick-slot ${s}" data-army="${idx}" data-slot="${s}"
            title="Choose a dragon for the ${label}">
            <div class="s-pos">${label}</div>
            <span class="slot-add">+ Choose</span>
          </button>`;
      }
      const mine = lockedAt(idx, s) === d.id;
      return `
        <div class="slot ${s} ${mine ? "mine" : "suggested"}">
          <div class="s-pos">${label}${mine
            ? '<span class="s-flag" title="You placed this dragon — the optimizer will not move it">&#128274;</span>'
            : '<span class="s-flag auto" title="Chosen by the optimizer — pick it again to lock it in place">auto</span>'}</div>
          <div class="s-name">${escapeHtml(d.name)}</div>
          <div class="s-role">${escapeHtml(roleName(d.role))}</div>
          <div class="s-power">${fmt(S.dragonPower(d))}</div>
          <div class="s-tools">
            <button type="button" class="linkbtn pick-slot" data-army="${idx}" data-slot="${s}">change</button>
            <button type="button" class="linkbtn danger clear-slot" data-army="${idx}" data-slot="${s}">clear</button>
          </div>
        </div>`;
    }).join("");

    const head = count
      ? `<div class="a-power">
           <b>${fmt(ev.score)}</b>
           <small>+${(ev.bonusPct * 100).toFixed(1)}% synergy</small>
         </div>
         <button class="btn manual-save" data-army="${idx}" title="Save this formation so it won't be lost">&#128204; Save</button>`
      : `<div class="a-power"><small class="a-idle">empty</small></div>`;

    return `
      <div class="army${count ? "" : " army-empty"}">
        <div class="army-head">
          <div>
            <div class="a-title">Formation ${idx + 1}</div>
            <div class="a-troop">${troop ? troop.icon + " " + troop.name : "—"} ${matchupTag(ev.troopType, enemy)}</div>
          </div>
          <div class="a-right">${head}</div>
        </div>
        <div class="slots">${slots}</div>
        ${count ? explainBlock(ev) : ""}
      </div>`;
  }

  /**
   * Fill only the slots you left open. Your locks go in first and the optimizer
   * partitions the rest of the roster around them, so the result is the best
   * formation set that still honours every hand placement.
   */
  function fillRemaining() {
    if (roster.length === 0) { toast("Add some dragons first"); return; }
    dedupeManual();

    const goal = currentGoal();
    const numArmies = currentArmyCount();

    // Placing a dragon by hand is a stronger statement than the roster's active
    // checkbox, so a lock counts whether or not the dragon is ticked.
    const locks = [];
    const lockedIds = new Set();
    for (let i = 0; i < numArmies; i++) {
      const m = {};
      SLOT_ORDER.forEach((s) => {
        const d = roster.find((x) => x.id === lockedAt(i, s));
        if (!d) return;
        m[s] = d;
        lockedIds.add(d.id);
      });
      locks.push(m);
    }

    if (numArmies * O.ARMY_SIZE - lockedIds.size <= 0) {
      toast("You have locked every slot — nothing left for the optimizer to fill");
      return;
    }

    let pool = roster.filter((d) => isActive(d) && !lockedIds.has(d.id));
    if (settings.excludeUsed) {
      const used = usedDragonIds(goal);
      pool = pool.filter((d) => !used.has(d.id));
    }
    if (pool.length === 0) {
      toast("No dragons left to fill with — tick some more on the left");
      return;
    }

    const result = O.optimize(pool, {
      iterations: 300,
      numArmies,
      goal,
      troopOptions: troopOptionsFor(goal),
      locks,
    });

    // Anything that landed in a slot you did not lock becomes a suggestion.
    const fills = [];
    let added = 0;
    result.armies.forEach((army, i) => {
      const place = (army.eval && army.eval.placement) || {};
      const m = {};
      SLOT_ORDER.forEach((s) => {
        const d = place[s];
        if (!d || lockedAt(i, s) === d.id) return;
        m[s] = d.id;
        added++;
      });
      fills[i] = m;
    });
    manualFill = fills;
    manualBenchIds = result.bench.map((d) => d.id);
    save();
    renderManual();
    toast(added
      ? `Filled ${added} slot${added === 1 ? "" : "s"} around your ${lockedIds.size} locked dragon${lockedIds.size === 1 ? "" : "s"}`
      : "No dragon improved the open slots");
  }

  // ---- Manual slot picker ----
  // Why each slot is worth thinking about, shown above the candidate list.
  const SLOT_HINT = {
    left: "The Left Flank is where Tactical, Fire and Healer dragons pay off, and it collects the Vanguard buff of any centre dragon whose skill names the left.",
    vanguard: "Only the centre dragon's Vanguard skill fires. It buffs itself plus <b>one named flank</b>, which makes this the highest-leverage pick in the formation.",
    right: "The Right Flank is where Physical damage dealers pay off, and it collects the Vanguard buff of any centre dragon whose skill names the right.",
  };

  const slotPicker = $("#slot-picker");
  const slotList = $("#slot-list");
  const slotSearch = $("#slot-search");
  let slotTarget = null;

  function openSlotPicker(army, slot) {
    if (!SLOT_IDS.has(slot)) return;
    slotTarget = { army, slot };
    slotSearch.value = "";
    $("#slot-picker-title").innerHTML = `${SLOT_LABEL[slot]} &middot; Formation ${army + 1}`;
    $("#slot-picker-hint").innerHTML = SLOT_HINT[slot];
    $("#slot-clear").classList.toggle("hidden", !placedIn(army)[slot]);
    renderSlotPicker();
    slotPicker.classList.remove("hidden");
    slotSearch.focus();
  }

  function closeSlotPicker() {
    slotPicker.classList.add("hidden");
    slotTarget = null;
  }

  /**
   * Every dragon in the roster, ranked by what this formation would score with
   * it in the chosen slot. That answers the question you actually have — "who
   * should stand here?" — using the same model the optimizer scores with.
   */
  function slotCandidates(army, slot) {
    const goal = currentGoal();
    const troops = troopOptionsFor(goal);
    const placed = placedIn(army);
    const base = evalPlacement(placed, goal, troops).score;

    return roster.map((d) => {
      const trial = {};
      // The candidate cannot also occupy another slot of the same formation.
      SLOT_ORDER.forEach((s) => { trial[s] = placed[s] && placed[s].id !== d.id ? placed[s] : null; });
      trial[slot] = d;
      const ev = evalPlacement(trial, goal, troops);
      return { dragon: d, score: ev.score, gain: ev.score - base };
    }).sort((a, b) => b.score - a.score);
  }

  function renderSlotPicker() {
    if (!slotTarget) return;
    const { army, slot } = slotTarget;

    if (!roster.length) {
      slotList.innerHTML = '<div class="picker-empty">Your roster is empty &mdash; add some dragons first.</div>';
      return;
    }

    const q = (slotSearch.value || "").toLowerCase().trim();
    const rows = slotCandidates(army, slot).filter((c) =>
      !q || c.dragon.name.toLowerCase().includes(q) || (c.dragon.role || "").includes(q)
    );
    if (!rows.length) {
      slotList.innerHTML = '<div class="picker-empty">No dragons match your search.</div>';
      return;
    }

    const current = placedIn(army)[slot];
    slotList.innerHTML = rows.map((c) => {
      const d = c.dragon;
      const here = !!current && current.id === d.id;
      const locked = here && lockedAt(army, slot) === d.id;

      const notes = [];
      if (!here) {
        const at = placementOf(d.id);
        if (at) notes.push(`Currently the ${escapeHtml(SLOT_LABEL[at.slot])} of Formation ${at.army + 1} &mdash; moving it here empties that slot.`);
      }
      if (!isActive(d)) notes.push("Not ticked active, but placing it by hand still puts it in the formation.");
      if (slot === "vanguard") {
        const vg = G.vanguardFor(d);
        notes.push(vg
          ? `Vanguard skill: ${escapeHtml(vg.selfText)} on itself &middot; ${escapeHtml(vg.flankText)} on the ${vg.flankPos === "left" ? "Left" : "Right"} Flank.`
          : "No Vanguard skill on record, so it adds nothing extra from the centre.");
      }

      const delta = locked
        ? "locked here"
        : here
          ? "lock this pick"
          : `${c.gain >= 0 ? "+" : "&minus;"}${fmt(Math.abs(c.gain))}`;
      const cls = here ? "" : c.gain > 0.5 ? "up" : c.gain < -0.5 ? "down" : "";

      return `
        <div class="picker-row slot-row rarity-${escapeHtml(d.rarity)}${here ? " current" : ""}" data-id="${escapeHtml(d.id)}">
          <div class="sr-main">
            <div class="pr-name">${escapeHtml(d.name)} <span class="tag role">${escapeHtml(roleName(d.role))}</span></div>
            <div class="pr-meta">${fmt(S.dragonPower(d))} power &middot; ${escapeHtml(rarityName(d.rarity))}${d.breed ? " &middot; " + escapeHtml(breedName(d.breed)) : ""}</div>
            ${notes.map((n) => `<div class="sr-note">${n}</div>`).join("")}
          </div>
          <div class="sr-score">
            <b>${fmt(c.score)}</b>
            <small class="${cls}">${delta}</small>
          </div>
        </div>`;
    }).join("");

    slotList.querySelectorAll(".slot-row").forEach((el) => {
      el.addEventListener("click", () => {
        setManualSlot(army, slot, el.dataset.id);
        closeSlotPicker();
      });
    });
  }

  // ---- Saved formations ----
  // Goals each get their own saved-formation group. Order controls display.
  const GOAL_ORDER = ["balanced", "siege", "dps"];
  function goalLabel(g) { return g === "siege" ? "Siege" : g === "dps" ? "DPS" : "Max Power"; }

  // A siege score is not an Army Power number, so it is not labelled like one.
  function scoreLabel(g) {
    return g === "siege" ? "Total siege damage rating" : "Total effective power";
  }

  function goalNote(g) {
    if (g !== "siege") return "";
    return `<p class="summary-note">Scored on damage to a structure, not Army Power: a wall never
      attacks back, so each dragon counts only as far as its kit turns into damage &mdash; tanks and
      healers weigh far less than damage dealers, and only Siege troops are considered.</p>`;
  }

  function saveFormation(idx) {
    const army = lastResult && lastResult.armies[idx];
    if (army) saveEval(army.eval, lastGoal);
  }

  // Pin one evaluated formation — automatic or hand-built, they save the same.
  function saveEval(ev, goal) {
    ev = ev || {};
    const place = ev.placement || {};
    const dragons = SLOT_ORDER.map((slot) => {
      const d = place[slot];
      return d ? { id: d.id, name: d.name, role: d.role, power: S.dragonPower(d), slot } : null;
    }).filter(Boolean);
    if (!dragons.length) { toast("Nothing to save in this formation"); return; }

    // Number within this goal, e.g. "Siege 1", "Siege 2", "Max Power 1".
    const sameGoal = savedFormations.filter((f) => f.goal === goal).length;
    savedFormations.unshift({
      id: uid(),
      name: goalLabel(goal) + " " + (sameGoal + 1),
      goal,
      troopType: ev.troopType || "",
      score: ev.score || 0,
      bonusPct: ev.bonusPct || 0,
      savedAt: Date.now(),
      dragons,
    });
    save();
    renderSaved();
    toast("Formation saved");
  }

  function deleteSaved(id) {
    const f = savedFormations.find((x) => x.id === id);
    if (!f) return;
    if (!confirm(`Delete saved formation "${f.name}"?`)) return;
    savedFormations = savedFormations.filter((x) => x.id !== id);
    save();
    renderSaved();
    toast("Saved formation removed");
  }

  function renameSaved(id) {
    const f = savedFormations.find((x) => x.id === id);
    if (!f) return;
    const name = prompt("Rename formation:", f.name);
    if (name === null) return;
    f.name = name.trim() || f.name;
    save();
    renderSaved();
  }

  function renderSaved() {
    const section = $("#saved-section");
    const list = $("#saved-list");
    const count = $("#saved-count");
    if (!section || !list) return;
    if (count) count.textContent = savedFormations.length;

    if (!savedFormations.length) {
      section.classList.add("hidden");
      list.innerHTML = "";
      return;
    }
    section.classList.remove("hidden");

    const cardHtml = (f) => {
      const troop = G.TROOP_TYPES.find((t) => t.id === f.troopType);
      const date = new Date(f.savedAt).toLocaleDateString();
      const slots = (f.dragons || []).map((d) => `
        <div class="sf-slot${d.slot === "vanguard" ? " vanguard" : ""}">
          <div class="sf-pos">${SLOT_LABEL[d.slot] || ""}</div>
          <div class="sf-name">${escapeHtml(d.name)}</div>
          <div class="sf-role">${escapeHtml(roleName(d.role))}</div>
          <div class="sf-power">${fmt(d.power)}</div>
        </div>`).join("");
      return `
        <div class="saved-card" data-id="${escapeHtml(f.id)}">
          <div class="sf-head">
            <div>
              <div class="sf-title">${escapeHtml(f.name)}</div>
              <div class="sf-meta">${troop ? troop.icon + " " + escapeHtml(troop.name) : "—"} &middot; saved ${escapeHtml(date)}</div>
            </div>
            <div class="sf-right">
              <div class="sf-score"><b>${fmt(f.score)}</b><small>+${(f.bonusPct * 100).toFixed(1)}% synergy</small></div>
              <div class="sf-actions">
                <button class="icon-btn sf-rename" data-id="${escapeHtml(f.id)}" title="Rename">&#9998;</button>
                <button class="icon-btn sf-del" data-id="${escapeHtml(f.id)}" title="Delete">&times;</button>
              </div>
            </div>
          </div>
          <div class="sf-slots">${slots}</div>
        </div>`;
    };

    // Group saved formations by goal, each goal in its own labeled sub-section.
    const groups = {};
    savedFormations.forEach((f) => { (groups[f.goal] = groups[f.goal] || []).push(f); });
    const goals = GOAL_ORDER.filter((g) => groups[g] && groups[g].length);
    Object.keys(groups).forEach((g) => { if (goals.indexOf(g) === -1) goals.push(g); });

    list.innerHTML = goals.map((g) => `
      <div class="saved-group">
        <h4 class="saved-group-title">${escapeHtml(goalLabel(g))} <span class="pill">${groups[g].length}</span></h4>
        <div class="saved-group-list">${groups[g].map(cardHtml).join("")}</div>
      </div>`).join("");

    list.querySelectorAll(".sf-del").forEach((b) => b.addEventListener("click", () => deleteSaved(b.dataset.id)));
    list.querySelectorAll(".sf-rename").forEach((b) => b.addEventListener("click", () => renameSaved(b.dataset.id)));
  }

  // ---- Menu actions ----
  function loadSeed() {
    const seeds = G.seedDragons(); // stable ids prefixed "seed-"
    // Refresh: drop previously-loaded official seeds, keep your custom dragons.
    roster = roster.filter((d) => !String(d.id).startsWith("seed-"));
    const existing = new Set(roster.map((d) => d.name.toLowerCase()));
    const added = seeds.filter((s) => !existing.has(s.name.toLowerCase()));
    roster = roster.concat(added);
    save();
    renderRoster();
    toast(`Loaded ${added.length} official dragons`);
  }

  // ---- Add-from-list picker ----
  const picker = $("#picker");
  const pickerList = $("#picker-list");
  const pickerSearch = $("#picker-search");

  function openPicker() {
    pickerSearch.value = "";
    renderPicker();
    picker.classList.remove("hidden");
    pickerSearch.focus();
  }
  function closePicker() { picker.classList.add("hidden"); }

  function renderPicker() {
    const q = (pickerSearch.value || "").toLowerCase().trim();
    const inRoster = new Set(roster.map((d) => d.name.toLowerCase()));
    const items = G.seedDragons().filter((s) =>
      !q || s.name.toLowerCase().includes(q) || (s.breed || "").includes(q) || (s.role || "").includes(q)
    );
    if (!items.length) {
      pickerList.innerHTML = '<div class="picker-empty">No dragons match your search.</div>';
      return;
    }
    pickerList.innerHTML = items.map((s) => {
      const added = inRoster.has(s.name.toLowerCase());
      return `
        <div class="picker-row rarity-${s.rarity} ${added ? "added" : ""}" data-name="${escapeHtml(s.name)}">
          <div>
            <div class="pr-name">${escapeHtml(s.name)}${s.isNew ? ' <span class="tag new">NEW</span>' : ""}</div>
            <div class="pr-meta">${rarityName(s.rarity)} &middot; ${breedName(s.breed)} &middot; ${roleName(s.role)}</div>
          </div>
          <button class="btn pr-add" ${added ? "disabled" : ""}>${added ? "Added" : "+ Add"}</button>
        </div>`;
    }).join("");
    pickerList.querySelectorAll(".picker-row").forEach((el) => {
      if (el.classList.contains("added")) return;
      el.addEventListener("click", () => addSingle(el.dataset.name));
    });
  }

  function addSingle(name) {
    if (roster.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
      toast(`${name} is already in your roster`);
      return;
    }
    const seed = G.seedDragons().find((s) => s.name === name);
    if (!seed) return;
    roster.push(seed);
    save();
    renderRoster();
    renderPicker();
    toast(`Added ${name}`);
  }

  function addByRarity(rarity, label) {
    const existing = new Set(roster.map((d) => d.name.toLowerCase()));
    const added = G.seedDragons().filter(
      (s) => s.rarity === rarity && !existing.has(s.name.toLowerCase())
    );
    roster = roster.concat(added);
    save();
    renderRoster();
    toast(added.length ? `Added ${added.length} ${label}` : `All ${label} already in your roster`);
  }

  function exportRoster() {
    const blob = new Blob([JSON.stringify(roster, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dragonfire-roster.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importRoster() { $("#import-file").click(); }

  function onImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (Array.isArray(data)) {
          roster = sanitizeDragons(data);
          save();
          renderRoster();
          toast(`Imported ${roster.length} dragons`);
        } else { toast("Invalid file"); }
      } catch (err) { toast("Could not parse file"); }
      e.target.value = "";
    };
    reader.readAsText(file);
  }

  function shareLink() {
    if (roster.length === 0) { toast("Nothing to share"); return; }
    const code = encodeRoster(roster);
    const url = `${location.origin}${location.pathname}?r=${code}`;
    if (url.length > 7000) {
      toast("Roster too large for a link — use Export instead");
      return;
    }
    navigator.clipboard?.writeText(url).then(
      () => toast("Share link copied to clipboard"),
      () => prompt("Copy this link:", url)
    );
  }

  function clearAll() {
    if (!confirm("Remove ALL dragons? This cannot be undone.")) return;
    roster = [];
    save();
    renderRoster();
    clearResults();
    toast("Roster cleared");
  }

  // ---- Wiring ----
  function bind() {
    $("#btn-add").addEventListener("click", openAdd);
    $("#btn-add-list").addEventListener("click", openPicker);
    $("#picker-close").addEventListener("click", closePicker);
    pickerSearch.addEventListener("input", renderPicker);
    picker.addEventListener("click", (e) => { if (e.target === picker) closePicker(); });
    // One button, two jobs: build everything, or fill only what you left open.
    $("#btn-optimize").addEventListener("click", () => (mode === "manual" ? fillRemaining() : optimize()));

    document.querySelectorAll(".mode-btn").forEach((b) => {
      b.addEventListener("click", () => setMode(b.dataset.mode));
    });
    $("#slot-picker-close").addEventListener("click", closeSlotPicker);
    slotSearch.addEventListener("input", renderSlotPicker);
    slotPicker.addEventListener("click", (e) => { if (e.target === slotPicker) closeSlotPicker(); });
    $("#slot-clear").addEventListener("click", () => {
      if (!slotTarget) return;
      const { army, slot } = slotTarget;
      closeSlotPicker();
      clearManualSlot(army, slot);
    });
    $("#modal-close").addEventListener("click", closeModal);
    $("#modal-cancel").addEventListener("click", closeModal);
    $("#modal-delete").addEventListener("click", onDelete);
    form.addEventListener("submit", onSubmit);
    form.name.addEventListener("input", renderDragonKit);
    form.starRank.addEventListener("input", renderDragonKit);
    rosterSearch.addEventListener("input", renderRoster);
    ["#roster-sort", "#roster-breed", "#roster-troop"].forEach((sel) => {
      const el = $(sel);
      if (el) el.addEventListener("change", renderRoster);
    });
    enemySelect.addEventListener("change", renderFormations);

    // In manual mode these only change how the same placements are shown and
    // scored, so re-render rather than throwing your picks at the optimizer.
    const rerun = () => {
      if (mode === "manual") renderManual();
      else if (lastResult) optimize();
    };
    const armyCount = $("#army-count");
    if (armyCount) armyCount.addEventListener("change", rerun);
    const goalSel = $("#formation-goal");
    if (goalSel) goalSel.addEventListener("change", rerun);
    $("#import-file").addEventListener("change", onImportFile);

    // Active-selection helpers (select all / deselect all).
    document.querySelectorAll("[data-sel]").forEach((el) => {
      el.addEventListener("click", () => setAllActive(el.dataset.sel === "all"));
    });

    // Exclude-used toggle: persist the preference and re-run if results exist.
    const excludeCb = $("#exclude-used");
    if (excludeCb) excludeCb.addEventListener("change", () => {
      settings.excludeUsed = excludeCb.checked;
      save();
      // Manual mode applies it on the next fill — it never discards placements.
      if (mode === "auto" && lastResult) optimize();
    });

    // Note: clicking the backdrop intentionally does NOT close the editor,
    // so you don't lose edits by mis-clicking. Use ✕ / Cancel / Save instead.

    const moreBtn = $("#btn-more");
    const moreMenu = $("#more-menu");
    moreBtn.addEventListener("click", (e) => { e.stopPropagation(); moreMenu.classList.toggle("hidden"); });

    // Roster selector + manage menu
    const rosterSelect = $("#roster-select");
    if (rosterSelect) rosterSelect.addEventListener("change", () => switchRoster(rosterSelect.value));
    const rmBtn = $("#btn-roster-menu");
    const rmMenu = $("#roster-menu");
    if (rmBtn) rmBtn.addEventListener("click", (e) => { e.stopPropagation(); rmMenu.classList.toggle("hidden"); });

    const rosterActions = {
      "new-roster": newRoster,
      "duplicate-roster": duplicateRoster,
      "rename-roster": () => renameRoster(activeId),
      "delete-roster": () => deleteRoster(activeId),
    };
    document.querySelectorAll("[data-raction]").forEach((el) => {
      el.addEventListener("click", () => { const a = el.dataset.raction; if (rosterActions[a]) rosterActions[a](); });
    });

    document.addEventListener("click", () => {
      moreMenu.classList.add("hidden");
      if (rmMenu) rmMenu.classList.add("hidden");
    });

    const actions = {
      seed: loadSeed,
      "add-legendary": () => addByRarity("legendary", "Legendaries"),
      "add-epic": () => addByRarity("epic", "Epics"),
      "add-rare": () => addByRarity("rare", "Rares"),
      export: exportRoster,
      import: importRoster,
      share: shareLink,
      clear: clearAll,
    };
    document.querySelectorAll("[data-action]").forEach((el) => {
      el.addEventListener("click", () => { const a = el.dataset.action; if (actions[a]) actions[a](); });
    });
  }

  // ---- Cloud bridge ----
  // API used by js/cloud.js to switch between the local (guest) workspace and
  // the signed-in cloud workspace. These never push back to the cloud directly,
  // so loading on sign-in can't echo into a save loop.
  window.APP = {
    getState: () => snapshot(),
    // Enter signed-in mode and show the cloud roster collection. While in cloud
    // mode persistLocal() is a no-op, so this data is never written to the browser.
    enterCloud: (state) => {
      cloudMode = true;
      applyState(state);
      renderAll();
      clearResults();
    },
    // Sign-out: drop the cloud data from view and restore the local guest
    // workspace from localStorage (a fresh empty roster if there is none).
    exitCloud: () => {
      cloudMode = false;
      let guest = null;
      try { const raw = localStorage.getItem(ROSTERS_KEY); if (raw) guest = JSON.parse(raw); } catch (e) {}
      applyState(guest);
      renderAll();
      clearResults();
    },
  };

  // ---- Init ----
  initOptions();
  load();
  bind();
  renderAll();
  renderFormations();
})();
