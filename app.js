/* Jamaican Menus — healthy Jamaican menu planner.
   All data stays in this browser's localStorage unless the owner turns on Sync (private Gist, his own token).
   No pork, pork products, tripe or cow foot appear in any recipe. Informational only — not medical advice. */
(function () {
  "use strict";
  var D = window.JM_DATA, RECIPES = D.RECIPES;
  var KEY = "jmenus-state-v1", TZ = "America/Chicago";
  var SEED_TIME = "2026-11-18T00:00:00.000Z";
  var LINKS = {
    aha: "https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/sodium/how-much-sodium-should-i-eat-per-day",
    fdaAckee: "https://www.fda.gov/food/natural-toxins-food/hypoglycin-and-ackee-fruit",
    fdaAlert: "https://www.accessdata.fda.gov/cms_ia/importalert_64.html",
    fdc: "https://fdc.nal.usda.gov/",
    lev: "https://www.biblegateway.com/passage/?search=Leviticus%2011%3A9-12&version=KJV",
    deut: "https://www.biblegateway.com/passage/?search=Deuteronomy%2014%3A9-10&version=KJV",
    afribbean: "https://parkwaycenter.ebgcm.com/contact/afribbean-market/"
  };
  var SLOTS = [
    { k: "b", label: "Breakfast", ico: "🌅" },
    { k: "l", label: "Lunch", ico: "☀️" },
    { k: "d", label: "Dinner", ico: "🌙" },
    { k: "side", label: "Dinner side", ico: "🥗" },
    { k: "s", label: "Snack", ico: "🍎" }
  ];
  var DEFAULT_LIKES = ["Callaloo", "Collard greens", "Cabbage", "Fish", "Jamaican sprat", "Parrot fish", "Okra", "Saltfish (salted dried cod)", "Snapper", "Ackee", "Breadfruit"];
  var DEFAULT_NEVER = ["Pork", "Ham", "Bacon", "Lard", "Pig tail", "Tripe", "Cow foot"];
  var SYN = {
    "saltfish": ["saltfish", "salt fish", "salted cod", "salted dried cod"],
    "salt fish": ["saltfish", "salt fish", "salted cod"],
    "jamaican sprat": ["sprat"], "sprat": ["sprat"],
    "collard greens": ["collard"], "collards": ["collard"],
    "ackee": ["ackee", "akee"], "akee": ["ackee", "akee"],
    "breadfruit": ["breadfruit", "bread fruit"], "bread fruit": ["breadfruit", "bread fruit"],
    "parrot fish": ["parrot fish", "parrotfish"],
    "pork": ["pork", "pig"], "cow foot": ["cow foot", "cowfoot", "cow feet"], "pig tail": ["pig tail", "pigtail", "pig's tail"]
  };
  var NAV = [
    { id: "menu", label: "Menu maker", ico: "🍽️", group: "Plan" },
    { id: "week", label: "Weekly menu", ico: "📅", group: "Plan" },
    { id: "saved", label: "Saved menus", ico: "🗂️", group: "Plan" },
    { id: "shopping", label: "Shopping list", ico: "🛒", group: "Plan" },
    { id: "recipes", label: "Recipes", ico: "📖", group: "Cook" },
    { id: "foods", label: "My foods", ico: "💚", group: "Cook" },
    { id: "health", label: "Heart health", ico: "❤️", group: "Learn" },
    { id: "sync", label: "Sync", ico: "⟳", group: "More" },
    { id: "about", label: "About", ico: "ℹ️", group: "More" }
  ];
  var TABS = ["menu", "week", "saved", "recipes", "shopping"];

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function nowISO() { return new Date().toISOString(); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseYmd(s) { var p = String(s || "").split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function todayDate() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function sundayOf(d) { var x = new Date(d); x.setDate(x.getDate() - x.getDay()); return x; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function dayName(d, short) { return d.toLocaleDateString("en-US", { weekday: short ? "short" : "long" }); }
  function dateLabel(d) { return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  function src(label, url) { return '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + "</a>"; }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function toast(msg) { var t = document.getElementById("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 2200); }

  function fracParse(s) {
    s = String(s || "").trim(); if (!s) return null;
    var total = 0, ok = false;
    s.split(/\s+/).forEach(function (part) {
      var m = part.match(/^(\d+)\/(\d+)$/);
      if (m) { total += +m[1] / +m[2]; ok = true; } else if (!isNaN(parseFloat(part))) { total += parseFloat(part); ok = true; }
    });
    return ok ? total : null;
  }
  function fmtQty(n) {
    if (n == null) return "";
    var whole = Math.floor(n + 1e-9), rest = n - whole, frac = "";
    var F = [[0, ""], [0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"], [1, ""]];
    var best = F[0], bd = 9;
    F.forEach(function (f) { var dd = Math.abs(rest - f[0]); if (dd < bd) { bd = dd; best = f; } });
    if (best[0] === 1) { whole += 1; frac = ""; } else frac = best[1];
    if (!whole && !frac) return "a little";
    return (whole ? String(whole) : "") + (whole && frac ? " " : "") + frac;
  }
  var UNIT_SING = { cups: "cup", bunches: "bunch", cans: "can", sprigs: "sprig", lbs: "lb", inches: "inch", pints: "pint" };
  var UNIT_PLUR = { cup: "cups", bunch: "bunches", can: "cans", sprig: "sprigs", pint: "pints" };
  function unitSing(u) { var p = String(u || "").split(" "); if (UNIT_SING[p[0]]) p[0] = UNIT_SING[p[0]]; return p.join(" "); }
  function unitFor(u, q) { var s = unitSing(u), p = s.split(" "); if (q != null && q > 1.01 && UNIT_PLUR[p[0]]) p[0] = UNIT_PLUR[p[0]]; return p.join(" "); }
  function parseIng(s) { var p = s.split("|"); return { q: fracParse(p[0]), raw: p[0], u: p[1], item: p[2], sec: p[3] }; }
  function recipeById(id) { return RECIPES.filter(function (r) { return r.id === id; })[0] || null; }

  /* ---------- state ---------- */
  function emptyState() {
    var s = { version: 1, settings: {}, settingsTimes: {}, tombstones: MenuSync.emptyTombs() };
    MenuSync.LIST_KEYS.forEach(function (k) { s[k] = []; });
    MenuSync.FLAG_KEYS.forEach(function (k) { s[k] = {}; });
    return s;
  }
  function load() {
    var s; try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { s = null; }
    var base = emptyState();
    if (!s || typeof s !== "object") s = base;
    MenuSync.LIST_KEYS.forEach(function (k) { if (!Array.isArray(s[k])) s[k] = []; });
    MenuSync.FLAG_KEYS.forEach(function (k) { if (!s[k] || typeof s[k] !== "object") s[k] = {}; });
    s.settings = s.settings || {}; s.settingsTimes = s.settingsTimes || {};
    var t = s.tombstones || {}; Object.keys(base.tombstones).forEach(function (k) { if (!t[k]) t[k] = {}; }); s.tombstones = t;
    return s;
  }
  var state = load();
  var DEFAULTS = { ratio: 75, cuisines: ["car", "med", "afr", "asi", "lat"], useLikes: true, clean: true, servings: 2, sabbath: true, exclude: "", theme: "" };
  function S(k) { var v = state.settings[k]; return v === undefined ? DEFAULTS[k] : v; }
  function setS(k, v) { state.settings[k] = v; state.settingsTimes[k] = nowISO(); save(); }
  function seed() {
    if (state.settings.seeded) return;
    DEFAULT_LIKES.forEach(function (n) { var id = "like-" + slug(n); if (!find("myFoods", id) && !state.tombstones.myFoods[id]) state.myFoods.push({ id: id, name: n, createdAt: SEED_TIME, updatedAt: SEED_TIME }); });
    DEFAULT_NEVER.forEach(function (n) { var id = "never-" + slug(n); if (!find("neverEat", id) && !state.tombstones.neverEat[id]) state.neverEat.push({ id: id, name: n, createdAt: SEED_TIME, updatedAt: SEED_TIME }); });
    state.settings.seeded = true; state.settingsTimes.seeded = SEED_TIME;
    persist();
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast("Could not save on this device."); } }
  function save() { persist(); schedulePush(); }
  function find(key, id) { return state[key].filter(function (x) { return x.id === id; })[0] || null; }
  function upsert(key, obj) {
    var t = nowISO(); obj.updatedAt = t; if (!obj.createdAt) obj.createdAt = t;
    var i = state[key].findIndex(function (x) { return x.id === obj.id; });
    if (i >= 0) state[key][i] = obj; else state[key].push(obj);
    if (state.tombstones[key][obj.id]) delete state.tombstones[key][obj.id];
  }
  function removeItem(key, id) { state[key] = state[key].filter(function (x) { return x.id !== id; }); state.tombstones[key][id] = nowISO(); }
  function setFlag(key, a, b, value) { if (!state[key][a]) state[key][a] = {}; state[key][a][b] = { value: value, updatedAt: nowISO() }; }
  function getFlag(key, a, b) { var r = state[key][a]; var e = r && r[b]; return !!(e && (e.value === true || e === true)); }

  /* ---------- food matching ---------- */
  function keywords(name) {
    var n = String(name || "").toLowerCase().trim(); if (!n) return [];
    var base = n.replace(/\(.*?\)/g, "").trim();
    var out = [base];
    if (SYN[base]) out = out.concat(SYN[base]);
    var inParen = (n.match(/\((.*?)\)/) || [])[1]; if (inParen) out.push(inParen.trim());
    return out.filter(Boolean);
  }
  function matchRe(word) { return new RegExp("(^|[^a-z])" + reEsc(word) + "(e?s)?([^a-z]|$)", "i"); }
  function recipeText(r) { return (r.n.replace(/\(.*?\)/g, "") + " | " + r.ing.map(function (i) { return i.split("|")[2]; }).join(" | ")).toLowerCase(); }
  function matchesFood(r, name) {
    var kw = keywords(name); if (!kw.length) return false;
    if (kw[0] === "fish") return r.tags.indexOf("fish") >= 0;
    var txt = recipeText(r);
    return kw.some(function (w) { return matchRe(w).test(txt); });
  }
  function likeHits(r) { return state.myFoods.filter(function (f) { return matchesFood(r, f.name); }); }
  function excludeWords() { return String(S("exclude") || "").split(/[,;\n]/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function blockReason(r) {
    if (S("clean") && r.tags.indexOf("shell") >= 0) return "Shellfish (Biblically clean filter is on)";
    var ne = state.neverEat.filter(function (f) { return matchesFood(r, f.name); })[0];
    if (ne) return "Has " + ne.name + " (on your never-eat list)";
    var ex = excludeWords().filter(function (w) { return matchesFood(r, w); })[0];
    if (ex) return "Has " + ex + " (excluded in menu options)";
    return "";
  }
  function isFav(id) { return !!find("favorites", "fav-" + id); }

  /* ---------- menu generator ---------- */
  function weekStart() { return S("weekStart") || ""; }
  function weekDays() { var ws = weekStart(); if (!ws) return []; var s = parseYmd(ws); return [0, 1, 2, 3, 4, 5, 6].map(function (i) { return addDays(s, i); }); }
  function todayIdx() { var ws = weekStart(); if (!ws) return -1; var diff = Math.round((todayDate() - parseYmd(ws)) / 86400000); return diff >= 0 && diff < 7 ? diff : -1; }
  function slotId(d, k) { return d + "-" + k; }
  function planItem(d, k) { return find("plan", slotId(d, k)); }
  function isSabbathSlot(date, k) { var wd = date.getDay(); return wd === 6 || (wd === 5 && (k === "d" || k === "side")); }
  function candidates(k, date, exceptId) {
    var cu = S("cuisines") || [];
    var pool = RECIPES.filter(function (r) { return r.m.indexOf(k) >= 0 && !blockReason(r) && (r.c === "jm" || cu.indexOf(r.c) >= 0); });
    if (S("sabbath") && date && isSabbathSlot(date, k)) { var pp = pool.filter(function (r) { return r.tags.indexOf("prep") >= 0; }); if (pp.length) pool = pp; }
    if (exceptId && pool.length > 1) pool = pool.filter(function (r) { return r.id !== exceptId; });
    return pool;
  }
  var RICE_PAIR = ["brown-stew-chicken", "jerk-chicken", "baked-chicken-jm", "roast-chicken", "curry-chicken", "escovitch-snapper", "brown-stew-parrot", "jerk-fish", "curry-chickpea-pumpkin", "oven-sprat"];
  function pickRecipe(k, date, used, exceptId, dayIds, dinnerId) {
    var pool = candidates(k, date, exceptId); if (!pool.length) return null;
    if (dayIds) { var nd = pool.filter(function (r) { return dayIds.indexOf(r.id) < 0; }); if (nd.length) pool = nd; }
    var wantJm = Math.random() * 100 < S("ratio");
    var g = pool.filter(function (r) { return (r.c === "jm") === wantJm; }); if (g.length) pool = g;
    var useLikes = S("useLikes");
    var weights = pool.map(function (r) {
      var w = 1;
      if (useLikes) w += 2.2 * Math.min(3, likeHits(r).length);
      if (isFav(r.id)) w += 1.5;
      if (r.tags.indexOf("bp") >= 0) w += 0.6;
      w = w / (1 + 3 * (used[r.id] || 0));
      if (k === "side" && r.id === "rice-and-peas" && dinnerId && RICE_PAIR.indexOf(dinnerId) >= 0) w *= 6;
      return w;
    });
    var total = weights.reduce(function (a, b) { return a + b; }, 0), x = Math.random() * total;
    for (var i = 0; i < pool.length; i++) { x -= weights[i]; if (x <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }
  function usedCounts(skipDay) {
    var u = {}; state.plan.forEach(function (p) { if (p.recipeId && (skipDay == null || p.id.split("-")[0] !== String(skipDay))) u[p.recipeId] = (u[p.recipeId] || 0) + 1; }); return u;
  }
  function fillDays(dayList) {
    var days = weekDays();
    var used = usedCounts();
    dayList.forEach(function (d) { SLOTS.forEach(function (s) { var p = planItem(d, s.k); if (p && !p.locked && p.recipeId) used[p.recipeId] = Math.max(0, (used[p.recipeId] || 1) - 1); }); });
    dayList.forEach(function (d) {
      var dayIds = SLOTS.map(function (s) { var p = planItem(d, s.k); return p && p.locked ? p.recipeId : null; }).filter(Boolean);
      SLOTS.forEach(function (s) {
        var p = planItem(d, s.k);
        if (p && p.locked && p.recipeId && recipeById(p.recipeId) && !blockReason(recipeById(p.recipeId))) return;
        var dn = s.k === "side" ? (planItem(d, "d") || {}).recipeId : null;
        var r = pickRecipe(s.k, days[d], used, p && p.recipeId, dayIds, dn);
        if (!r) return;
        used[r.id] = (used[r.id] || 0) + 1; dayIds.push(r.id);
        upsert("plan", { id: slotId(d, s.k), recipeId: r.id, locked: false, createdAt: p && p.createdAt });
      });
    });
    save();
  }
  function ensureWeek() { if (!weekStart() || todayIdx() < 0) startNewWeek(true); }
  function startNewWeek(quiet) {
    var ws = ymd(sundayOf(todayDate()));
    state.settings.weekStart = ws; state.settingsTimes.weekStart = nowISO();
    state.plan.forEach(function (p) { p.locked = false; });
    fillDays([0, 1, 2, 3, 4, 5, 6]);
    if (!quiet) toast("New week menu made");
  }
  function swapSlot(d, k) {
    var days = weekDays(), p = planItem(d, k), used = usedCounts();
    var dayIds = SLOTS.map(function (s) { var q = planItem(d, s.k); return q && s.k !== k ? q.recipeId : null; }).filter(Boolean);
    var r = pickRecipe(k, days[d], used, p && p.recipeId, dayIds, k === "side" ? (planItem(d, "d") || {}).recipeId : null);
    if (!r) { toast("No other recipe fits your filters for this meal."); return; }
    upsert("plan", { id: slotId(d, k), recipeId: r.id, locked: false, createdAt: p && p.createdAt });
    save(); toast("Swapped: " + r.n);
  }
  function toggleLock(d, k) { var p = planItem(d, k); if (!p) return; p.locked = !p.locked; upsert("plan", p); save(); toast(p.locked ? "Locked — Shuffle will keep it" : "Unlocked"); }

  /* ---------- UI bits ---------- */
  function tagPills(r, limit) {
    var order = ["bp", "fish", "plant", "fiber", "prep", "desalt", "ackee", "shell"];
    var t = order.filter(function (x) { return r.tags.indexOf(x) >= 0; });
    if (limit) t = t.slice(0, limit);
    return t.map(function (x) { return '<span class="pill ' + x + '">' + esc(D.TAGS[x]) + "</span>"; }).join("");
  }
  function sodiumLabel(r) { return { low: "Lower sodium", mod: "Moderate sodium — watch the sauces", watch: "Higher sodium — desalt the saltfish well" }[r.na]; }
  function slotCard(d, s, date) {
    var p = planItem(d, s.k), r = p && recipeById(p.recipeId);
    if (!r) return '<div class="slot"><div class="emo">' + s.ico + '</div><div class="body"><div class="lbl">' + esc(s.label) + '</div><div class="muted">Nothing fits your filters for this meal.</div></div></div>';
    var br = blockReason(r), likes = likeHits(r).map(function (f) { return f.name.replace(/\s*\(.*\)/, ""); });
    var sab = S("sabbath") && date && isSabbathSlot(date, s.k) && r.tags.indexOf("prep") >= 0;
    return '<div class="slot' + (p.locked ? " locked" : "") + (br ? " bad" : "") + '">' +
      '<div class="emo">' + r.e + '</div><div class="body"><div class="lbl">' + s.ico + " " + esc(s.label) + (sab ? ' · <span style="color:var(--gold-ink)">Cook Friday before sunset</span>' : "") + '</div>' +
      '<a class="name" href="#/recipe/' + r.id + '">' + esc(r.n) + '</a>' +
      '<div class="tags"><span class="pill cuisine">' + esc(D.CUISINES[r.c]) + "</span>" + tagPills(r, 3) + (likes.length ? '<span class="pill" title="Foods you like">💚 ' + esc(likes.slice(0, 2).join(", ")) + "</span>" : "") + "</div>" +
      (br ? '<div class="small" style="color:var(--bad);font-weight:650">⚠ ' + esc(br) + " — tap swap</div>" : "") +
      '</div><div class="acts no-print">' +
      '<button class="sq' + (p.locked ? " on" : "") + '" data-act="lock" data-d="' + d + '" data-k="' + s.k + '" title="' + (p.locked ? "Unlock" : "Lock this meal") + '" aria-label="' + (p.locked ? "Unlock" : "Lock") + " " + esc(s.label) + '">' + (p.locked ? "🔒" : "🔓") + "</button>" +
      '<button class="sq" data-act="swap" data-d="' + d + '" data-k="' + s.k + '" title="Swap this meal" aria-label="Swap ' + esc(s.label) + '">⇄</button>' +
      "</div></div>";
  }
  function optionsCard() {
    var cu = S("cuisines") || [];
    var other = ["car", "med", "afr", "asi", "lat"];
    return '<div class="card"><h2>Menu options</h2><div class="form-grid">' +
      '<div class="field"><span>Mix: <b id="ratioLbl">' + S("ratio") + "% Jamaican · " + (100 - S("ratio")) + '% other healthy cuisines</b></span><input type="range" min="0" max="100" step="5" value="' + S("ratio") + '" data-set="ratio"></div>' +
      '<div class="field"><span>Servings per meal</span><div class="stepper"><button class="btn small" data-act="serv" data-v="-1" aria-label="Fewer servings">−</button><b>' + S("servings") + '</b><button class="btn small" data-act="serv" data-v="1" aria-label="More servings">+</button><span class="help">for the shopping list and recipes</span></div></div>' +
      "</div>" +
      '<div class="field"><span>Other cuisines to include</span><div class="chips">' + other.map(function (c) { return '<button class="chip' + (cu.indexOf(c) >= 0 ? " on" : "") + '" data-act="cuisine" data-c="' + c + '">' + esc(D.CUISINES[c]) + "</button>"; }).join("") + "</div></div>" +
      '<label class="switch"><input type="checkbox" data-set="useLikes"' + (S("useLikes") ? " checked" : "") + '><span><b>Use foods I like first</b><small>Callaloo, saltfish, snapper, breadfruit and the rest of ' + '<a href="#/foods">My foods</a> show up more often.</small></span></label>' +
      '<label class="switch"><input type="checkbox" data-set="clean"' + (S("clean") ? " checked" : "") + '><span><b>Biblically clean</b><small>Fish with fins and scales only — no shellfish, no catfish (Leviticus 11:9–12). Pork is never included either way.</small></span></label>' +
      '<label class="switch"><input type="checkbox" data-set="sabbath"' + (S("sabbath") ? " checked" : "") + '><span><b>Sabbath-friendly</b><small>Friday dinner and all of Saturday use dishes you can cook Friday before sunset.</small></span></label>' +
      '<div class="field mt"><span>Leave out these ingredients this week (comma separated)</span><input type="text" data-set="exclude" value="' + esc(S("exclude")) + '" placeholder="e.g. coconut milk, chicken"></div>' +
      '<p class="help">Never-eat foods (pork, tripe, cow foot…) are always left out. Edit them in <a href="#/foods">My foods</a>.</p></div>';
  }

  /* ---------- views ---------- */
  function viewMenu() {
    ensureWeek();
    var ti = todayIdx(), days = weekDays(), date = days[ti];
    var sab = date.getDay() === 6;
    return '<div class="hero"><p class="kicker">' + esc(dayName(date)) + " · " + esc(dateLabel(date)) + (sab ? " · Sabbath" : "") + '</p><h1>Today\'s healthy Jamaican menu</h1><p>Heart-healthy, lower in salt, and never any pork, tripe or cow foot. Tap a dish for the recipe, 🔓 to lock it, or ⇄ to swap it.</p>' +
      '<div class="row mt"><button class="btn gold" data-act="shuffleDay" data-d="' + ti + '">🔀 Shuffle today</button><button class="btn" data-act="shuffleWeek" style="background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.25)">🔀 Shuffle whole week</button><a class="btn" href="#/week" style="background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.25)">📅 See the week</a></div>' +
      '<div class="row" style="margin-top:8px"><button class="btn save-later" data-act="saveLaterDay">+ Save for later</button><button class="btn save-later" data-act="addMenu">+ Add a menu</button></div></div>' +
      (sab ? '<div class="note gold mt">Happy Sabbath. Today\'s dishes are ones you could cook on Friday before sunset.</div>' : (date.getDay() === 5 && S("sabbath") ? '<div class="note gold mt">Friday: cook tonight\'s dinner and tomorrow\'s Sabbath meals before sunset. <a href="#/week">See Saturday\'s menu</a>.</div>' : "")) +
      '<div class="slots mt">' + SLOTS.map(function (s) { return slotCard(ti, s, date); }).join("") + "</div>" +
      '<div class="note mt">Daily sodium goal: the American Heart Association recommends no more than 2,300 mg a day, with an ideal of no more than 1,500 mg for most adults. ' + src("AHA", LINKS.aha) + " · <a href=\"#/health\">More heart-health tips</a></div>" +
      comingUpCard() +
      '<div class="mt">' + optionsCard() + "</div>" + disclaimer();
  }
  function viewWeek() {
    ensureWeek();
    var days = weekDays(), ti = todayIdx();
    return '<div class="page-head row between"><div><p class="kicker">Week of ' + esc(dateLabel(days[0])) + " – " + esc(dateLabel(days[6])) + '</p><h1>Weekly menu</h1><p class="lead">Seven days of breakfast, lunch, dinner, a side and a snack. Locked meals (🔒) stay put when you shuffle.</p></div>' +
      '<div class="row no-print"><button class="btn primary" data-act="shuffleWeek">🔀 Shuffle week</button><a class="btn" href="#/shopping">🛒 Shopping list</a><button class="btn" data-act="print">🖨 Print</button><button class="btn" data-act="newWeek">New week</button></div></div>' +
      '<div class="row no-print" style="margin:-4px 0 14px"><button class="btn gold" data-act="saveLaterWeek">+ Save for later</button><button class="btn" data-act="addMenu">+ Add a menu</button><a class="btn ghost" href="#/saved">🗂️ Saved menus (' + state.savedMenus.length + ')</a></div>' +
      '<div class="week">' + days.map(function (date, d) {
        var sab = date.getDay() === 6;
        return '<div class="day' + (d === ti ? " today" : "") + (sab && d !== ti ? " sabbath" : "") + '"><div class="dh"><b>' + esc(dayName(date)) + " · " + esc(dateLabel(date)) + (sab ? " · Sabbath" : "") + (d === ti ? " · Today" : "") + '</b><button class="btn small ghost no-print" data-act="shuffleDay" data-d="' + d + '" title="Shuffle this day" style="color:inherit;border-color:currentColor">🔀</button></div>' +
          SLOTS.map(function (s) {
            var p = planItem(d, s.k), r = p && recipeById(p.recipeId), br = r ? blockReason(r) : "";
            var prep = r && S("sabbath") && isSabbathSlot(date, s.k) && r.tags.indexOf("prep") >= 0;
            return '<div class="mi"><span class="e">' + (r ? r.e : s.ico) + '</span><div class="t"><small>' + esc(s.label) + (prep ? " · cook Friday" : "") + "</small>" + (r ? '<a href="#/recipe/' + r.id + '">' + esc(r.n) + "</a>" + (br ? '<div class="small" style="color:var(--bad)">⚠ ' + esc(br) + "</div>" : "") : '<span class="muted">—</span>') + "</div>" +
              (r ? '<button class="sq' + (p.locked ? " on" : "") + ' no-print" data-act="lock" data-d="' + d + '" data-k="' + s.k + '" aria-label="Lock">' + (p.locked ? "🔒" : "🔓") + '</button><button class="sq no-print" data-act="swap" data-d="' + d + '" data-k="' + s.k + '" aria-label="Swap">⇄</button>' : "") + "</div>";
          }).join("") + "</div>";
      }).join("") + "</div>" +
      '<div class="mt no-print">' + optionsCard() + "</div>" + disclaimer();
  }
  function viewPrint() {
    ensureWeek();
    var days = weekDays();
    return '<div class="row between no-print" style="margin-bottom:12px"><a class="btn" href="#/week">← Back</a><button class="btn primary" data-act="doPrint">🖨 Print this page</button></div>' +
      '<h1>Weekly Jamaican Menu</h1><p class="muted">Week of ' + esc(dateLabel(days[0])) + " – " + esc(dateLabel(days[6])) + " · " + S("servings") + " servings per meal · No pork, tripe or cow foot" + (S("clean") ? " · Biblically clean" : "") + "</p>" +
      '<table class="printweek"><thead><tr><th>Day</th>' + SLOTS.map(function (s) { return "<th>" + esc(s.label) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      days.map(function (date, d) { return "<tr><th>" + esc(dayName(date)) + "<br><small>" + esc(dateLabel(date)) + "</small></th>" + SLOTS.map(function (s) { var p = planItem(d, s.k), r = p && recipeById(p.recipeId); return "<td>" + (r ? r.e + " " + esc(r.n) + (S("sabbath") && isSabbathSlot(date, s.k) && r.tags.indexOf("prep") >= 0 ? "<br><small>cook Friday</small>" : "") : "—") + "</td>"; }).join("") + "</tr>"; }).join("") +
      "</tbody></table><p class=\"small muted mt\">Daily sodium: AHA recommends no more than 2,300 mg a day, ideally no more than 1,500 mg for most adults. Desalt saltfish well before cooking.</p>";
  }
  var ui = { q: "", cuisine: "", meal: "", tag: "", hideChecked: false };
  function viewRecipes() {
    var list = RECIPES.filter(function (r) {
      if (ui.cuisine && r.c !== ui.cuisine) return false;
      if (ui.meal && r.m.indexOf(ui.meal) < 0) return false;
      if (ui.tag === "fav" && !isFav(r.id)) return false;
      if (ui.tag === "likes" && !likeHits(r).length) return false;
      if (ui.tag && ui.tag !== "fav" && ui.tag !== "likes" && r.tags.indexOf(ui.tag) < 0) return false;
      if (ui.q && recipeText(r).indexOf(ui.q.toLowerCase()) < 0) return false;
      return true;
    });
    var shown = list.filter(function (r) { return !blockReason(r); }), hidden = list.length - shown.length;
    var tagChips = [["", "All"], ["likes", "💚 My foods"], ["fav", "★ Favorites"], ["bp", "BP-friendly"], ["fish", "Fish"], ["plant", "Plant-based"], ["fiber", "High fiber"], ["prep", "Sabbath prep-ahead"]];
    return '<div class="page-head"><p class="kicker">' + RECIPES.length + ' recipes · mostly Jamaican</p><h1>Recipe library</h1><p class="lead">Every recipe is pork-free, with a tip for cutting the salt. Tap one to see ingredients you can check off as you cook.</p></div>' +
      '<div class="card no-print"><div class="form-grid"><div class="field"><span>Search</span><input type="search" id="recipeSearch" value="' + esc(ui.q) + '" placeholder="Try callaloo, snapper, breadfruit…"></div>' +
      '<div class="field"><span>Cuisine</span><select data-ui="cuisine"><option value="">All cuisines</option>' + Object.keys(D.CUISINES).map(function (c) { return '<option value="' + c + '"' + (ui.cuisine === c ? " selected" : "") + ">" + esc(D.CUISINES[c]) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><span>Meal</span><select data-ui="meal"><option value="">Any meal</option>' + SLOTS.map(function (s) { return '<option value="' + s.k + '"' + (ui.meal === s.k ? " selected" : "") + ">" + esc(s.label) + "</option>"; }).join("") + "</select></div></div>" +
      '<div class="chips">' + tagChips.map(function (t) { return '<button class="chip' + (ui.tag === t[0] ? " on" : "") + '" data-act="rtag" data-t="' + t[0] + '">' + esc(t[1]) + "</button>"; }).join("") + "</div></div>" +
      '<div id="recipeList">' + recipeGrid(shown, hidden) + "</div>" + disclaimer();
  }
  function recipeGrid(shown, hidden) {
    return '<p class="help mt">' + shown.length + " showing" + (hidden ? " · " + hidden + " hidden by your Biblically clean filter, never-eat list or menu exclusions" : "") + "</p>" +
      '<div class="recipes">' + shown.map(function (r) {
        return '<a class="rc" href="#/recipe/' + r.id + '"><div class="top"><span class="e">' + r.e + "</span><b>" + esc(r.n) + (isFav(r.id) ? " ★" : "") + '</b></div><div class="meta">' + esc(D.CUISINES[r.c]) + " · " + r.t + " min · serves " + r.sv + '</div><div class="tags">' + tagPills(r, 4) + "</div></a>";
      }).join("") + "</div>";
  }
  function viewRecipe(id) {
    var r = recipeById(id);
    if (!r) return '<div class="card"><h2>Recipe not found</h2><a href="#/recipes">Back to recipes</a></div>';
    var serv = ui.serv && ui.servFor === id ? ui.serv : S("servings");
    var scale = serv / r.sv, br = blockReason(r), likes = likeHits(r);
    var ings = r.ing.map(parseIng);
    var anyChecked = ings.some(function (x, i) { return getFlag("cookChecks", r.id, String(i)); });
    return '<div class="row between no-print" style="margin-bottom:10px"><a class="btn small" href="#/recipes">← Recipes</a><div class="row"><button class="btn small' + (isFav(r.id) ? " on" : "") + '" data-act="fav" data-id="' + r.id + '">' + (isFav(r.id) ? "★ Favorite" : "☆ Add to favorites") + '</button><button class="btn small" data-act="doPrint">🖨 Print</button></div></div>' +
      '<div class="card"><div class="rhead"><div class="big">' + r.e + '</div><div><p class="kicker">' + esc(D.CUISINES[r.c]) + " · " + r.m.map(function (m) { return SLOTS.filter(function (s) { return s.k === m; })[0].label; }).join(", ") + "</p><h1>" + esc(r.n) + '</h1><div class="tags">' + tagPills(r) + "</div></div></div>" +
      '<div class="facts"><span>⏱ <b>' + r.t + ' min</b></span><span>🍽 Recipe makes <b>' + r.sv + '</b></span><span class="no-print stepper">Cook for <button class="btn small" data-act="rserv" data-id="' + r.id + '" data-v="-1" aria-label="Fewer">−</button><b>' + serv + '</b><button class="btn small" data-act="rserv" data-id="' + r.id + '" data-v="1" aria-label="More">+</button> servings</span>' + (likes.length ? "<span>💚 Has " + esc(likes.map(function (f) { return f.name.replace(/\s*\(.*\)/, ""); }).join(", ")) + "</span>" : "") + "</div>" +
      (br ? '<div class="note warn">⚠ ' + esc(br) + ". The menu maker will not pick this recipe.</div>" : "") +
      "</div>" +
      '<div class="card"><div class="sodium"><div style="font-size:1.6rem">🧂</div><div><b>' + esc(sodiumLabel(r)) + '</b><div class="meter ' + r.na + '"><i></i><i></i><i></i></div><p style="margin-top:8px">' + esc(r.tip) + '</p><p class="help">The sodium level is this app\'s guide based on the ingredients, not a lab measurement. Check package labels for exact numbers.</p></div></div>' +
      (r.tags.indexOf("desalt") >= 0 ? '<div class="note gold"><b>Desalting saltfish:</b> ' + esc(D.DESALT) + "</div>" : "") +
      (r.note ? '<div class="note warn">' + esc(r.note) + " " + src("FDA", LINKS.fdaAckee) + "</div>" : "") + "</div>" +
      '<div class="grid g2 mt"><div class="card"><div class="row between"><h2>Ingredients</h2>' + (anyChecked ? '<button class="btn small no-print" data-act="clearCook" data-id="' + r.id + '">Clear checks</button>' : "") + '</div><p class="help no-print">Tap each one as you get it ready.</p><ul class="checklist">' +
      ings.map(function (x, i) {
        var c = getFlag("cookChecks", r.id, String(i));
        var q = x.q != null ? fmtQty(x.q * scale) : "";
        return '<li><label><input type="checkbox" data-cook="' + r.id + '" data-i="' + i + '"' + (c ? " checked" : "") + '><span class="q">' + esc(q + (x.u ? " " + unitFor(x.u, x.q != null ? x.q * scale : null) : "")) + '</span><span class="' + (c ? "done" : "") + '">' + esc(x.item) + "</span></label></li>";
      }).join("") + "</ul>" + (scale !== 1 ? '<p class="help">Amounts are scaled from the original ' + r.sv + " servings. Spices may not need to scale exactly — taste as you go.</p>" : "") + "</div>" +
      '<div class="card"><h2>Steps</h2><ol class="steps">' + r.st.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol></div></div>" + disclaimer();
  }
  /* shopping source: the current week, or a saved menu (#/saved/<id>/shop) */
  function shopSource() {
    var rp = routeParts();
    if (rp[0] === "saved" && rp[1] && rp[2] === "shop") {
      var m = find("savedMenus", rp[1]);
      if (m) return { key: "menu-" + m.id, ids: menuRecipeIds(m), kicker: esc(m.name) + (m.date ? " · " + esc(menuDateLabel(m)) : ""), lead: "Everything for your saved menu \u201c" + esc(m.name) + "\u201d", title: m.name, back: "#/saved/" + m.id, span: m.kind === "week" ? "the week" : "the day" };
    }
    ensureWeek();
    var ws = weekStart();
    return { key: ws, ids: state.plan.filter(function (p) { var d = +p.id.split("-")[0]; return d >= 0 && d < 7; }).map(function (p) { return p.recipeId; }), kicker: "Week of " + esc(dateLabel(parseYmd(ws))), lead: "Everything for this week's menu", title: "week of " + dateLabel(parseYmd(ws)), back: "", span: "the week" };
  }
  function shoppingItems(src0) {
    var srcx = src0 || shopSource(), serv = S("servings"), map = {};
    srcx.ids.forEach(function (rid) {
      var r = recipeById(rid); if (!r || blockReason(r)) return;
      var scale = serv / r.sv;
      r.ing.map(parseIng).forEach(function (x) {
        var base = x.item.replace(/,.*$/, "").trim();
        var k = slug(base + " " + unitSing(x.u));
        if (!map[k]) map[k] = { key: k, item: base, u: unitSing(x.u), sec: x.sec, q: 0, hasQ: false, noQ: 0, uses: {} };
        if (x.q != null) { map[k].q += x.q * scale; map[k].hasQ = true; } else map[k].noQ++;
        map[k].uses[r.n] = true;
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }
  function itemLine(it) { return (it.hasQ ? fmtQty(it.q) + (it.u ? " " + unitFor(it.u, it.q) : "") + " " : "") + it.item; }
  function shoppingText() {
    var sx = shopSource(), items = shoppingItems(sx), ws = sx.key, out = ["Jamaican Menus — shopping list (" + sx.title + ", " + S("servings") + " servings)"];
    Object.keys(D.SECTIONS).forEach(function (sec) {
      var g = items.filter(function (x) { return x.sec === sec && !getFlag("shopChecks", ws, x.key); });
      if (!g.length) return;
      out.push("", D.SECTIONS[sec].toUpperCase());
      g.sort(function (a, b) { return a.item.localeCompare(b.item); }).forEach(function (x) { out.push("☐ " + itemLine(x)); });
    });
    return out.join("\n");
  }
  function viewShopping() {
    var sx = shopSource(), items = shoppingItems(sx), ws = sx.key;
    var done = items.filter(function (x) { return getFlag("shopChecks", ws, x.key); }).length;
    var h = (sx.back ? '<div class="no-print" style="margin-bottom:10px"><a class="btn small" href="' + sx.back + '">← Back to menu</a></div>' : "") +
      '<div class="page-head row between"><div><p class="kicker">' + sx.kicker + " · " + S("servings") + ' servings per meal</p><h1>Shopping list</h1><p class="lead">' + sx.lead + ', grouped by store section. Check items off as you shop.</p></div>' +
      '<div class="row no-print"><button class="btn primary" data-act="shareList">📤 Share</button><button class="btn" data-act="copyList">📋 Copy</button><button class="btn" data-act="doPrint">🖨 Print</button></div></div>' +
      (items.length ? "" : '<div class="note">This menu has no recipes yet. Add some, then come back.</div>') +
      '<div class="card no-print"><div class="row between"><b id="shopCount">' + done + " of " + items.length + ' items checked</b><div class="row"><label class="row small"><input type="checkbox" data-act2="hideChecked"' + (ui.hideChecked ? " checked" : "") + '> Hide checked</label>' + (done ? '<button class="btn small" data-act="clearShop">Uncheck all</button>' : "") + "</div></div>" +
      '<p class="help">Amounts are added up across ' + sx.span + ' and scaled to ' + S("servings") + ' servings. Spices and oil: check your cupboard first. Pick "no-salt-added" cans where you can.</p></div>';
    Object.keys(D.SECTIONS).forEach(function (sec) {
      var g = items.filter(function (x) { return x.sec === sec; }).sort(function (a, b) { return a.item.localeCompare(b.item); });
      if (ui.hideChecked) g = g.filter(function (x) { return !getFlag("shopChecks", ws, x.key); });
      if (!g.length) return;
      h += '<div class="card"><h2>' + esc(D.SECTIONS[sec]) + ' <span class="pill">' + g.length + '</span></h2><ul class="checklist">' + g.map(function (x) {
        var c = getFlag("shopChecks", ws, x.key);
        return '<li><label><input type="checkbox" data-shop="' + x.key + '"' + (c ? " checked" : "") + '><span><span class="' + (c ? "done" : "") + '"><b>' + esc(x.hasQ ? fmtQty(x.q) + (x.u ? " " + unitFor(x.u, x.q) : "") : "") + "</b> " + esc(x.item) + '</span><span class="sub">For ' + esc(Object.keys(x.uses).join(", ")) + "</span></span></label></li>";
      }).join("") + "</ul></div>";
    });
    h += '<div class="card"><h2>Where to find Jamaican ingredients near Frisco</h2><p><b>Afribbean Market</b> — African and Caribbean grocery<br>901 E Plano Pkwy, Suite 101, Plano, TX 75074 · <a href="tel:+19725091825">972-509-1825</a> · ' + src("store listing", LINKS.afribbean) + '</p><p class="help">Address and phone matched on two public listings (Nov 2026). Stock wasn\'t checked — call ahead for ackee, saltfish, callaloo, breadfruit or sprat. If you buy canned ackee, FDA keeps a "Green List" of approved ackee processors: ' + src("FDA Import Alert 21-11", LINKS.fdaAlert) + ".</p></div>";
    return h + disclaimer();
  }

  /* ---------- saved / planned menus ---------- */
  function dayCount(m) { return m.kind === "week" ? 7 : 1; }
  function menuRecipeIds(m) { var out = []; for (var d = 0; d < dayCount(m); d++) SLOTS.forEach(function (s) { var id = (m.slots || {})[d + "-" + s.k]; if (id) out.push(id); }); return out; }
  function menuDayDate(m, d) { return m.date ? addDays(parseYmd(m.date), d) : null; }
  function menuDateLabel(m) {
    if (!m.date) return "No date";
    var a = parseYmd(m.date);
    if (m.kind === "week") return "Week of " + dateLabel(a) + " – " + dateLabel(addDays(a, 6));
    return dayName(a, true) + ", " + a.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function menuGroups() {
    var t = ymd(todayDate()), up = [], none = [], past = [];
    state.savedMenus.forEach(function (m) {
      if (!m.date) none.push(m);
      else { var end = ymd(addDays(parseYmd(m.date), dayCount(m) - 1)); if (end >= t) up.push(m); else past.push(m); }
    });
    up.sort(function (a, b) { return a.date.localeCompare(b.date); });
    past.sort(function (a, b) { return b.date.localeCompare(a.date); });
    none.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
    return { up: up, none: none, past: past };
  }
  function comingUp() {
    var t = todayDate(), t0 = ymd(t), t7 = ymd(addDays(t, 7));
    return state.savedMenus.filter(function (m) {
      if (!m.date) return false;
      var end = ymd(addDays(parseYmd(m.date), dayCount(m) - 1));
      return m.date <= t7 && end >= t0;
    }).sort(function (a, b) { return a.date.localeCompare(b.date); });
  }
  function snapshotSlots(kind) {
    var slots = {}, ti = todayIdx();
    if (kind === "day") SLOTS.forEach(function (s) { var p = planItem(ti, s.k); if (p && p.recipeId) slots["0-" + s.k] = p.recipeId; });
    else state.plan.forEach(function (p) { var d = +p.id.split("-")[0]; if (d >= 0 && d < 7 && p.recipeId) slots[p.id] = p.recipeId; });
    return slots;
  }
  function openModal(html) { var m = document.getElementById("modal"); m.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true">' + html + "</div>"; m.hidden = false; var f = m.querySelector("input,textarea"); if (f) setTimeout(function () { f.focus(); }, 30); }
  function closeModal() { var m = document.getElementById("modal"); m.hidden = true; m.innerHTML = ""; }
  function saveLaterDialog(kind) {
    ensureWeek();
    var days = weekDays(), ti = todayIdx();
    var defName = kind === "day" ? "Menu from " + dayName(days[ti]) + ", " + dateLabel(days[ti]) : "Week of " + dateLabel(days[0]);
    openModal('<h2>+ Save for later</h2><p class="help">Saves a copy of ' + (kind === "day" ? "today's" : "this week's") + ' menu. Shuffling later won\'t change the saved copy.</p>' +
      '<form data-modal="saveLater" data-kind="' + kind + '"><div class="field"><span>Name</span><input name="name" required maxlength="80" value="' + esc(defName) + '"></div>' +
      '<div class="field"><span>' + (kind === "day" ? "Planned date (optional)" : "Week start date (optional)") + '</span><input type="date" name="date"></div>' +
      '<div class="field"><span>Notes (optional)</span><textarea name="notes" maxlength="1000" placeholder="e.g. for the family visit, buy snapper on Friday"></textarea></div>' +
      '<div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-act="closeModal">Cancel</button><button class="btn primary">Save menu</button></div></form>');
  }
  function addMenuDialog() {
    var tm = ymd(addDays(todayDate(), 1));
    openModal('<h2>+ Add a menu</h2><p class="help">Make your own menu and plan it for a future date. You pick the recipes on the next screen.</p>' +
      '<form data-modal="addMenu"><div class="field"><span>Name</span><input name="name" required maxlength="80" placeholder="e.g. Sunday family dinner"></div>' +
      '<div class="field"><span>Type</span><select name="kind"><option value="day">One day</option><option value="week">A whole week (7 days)</option></select></div>' +
      '<div class="field"><span>Planned date or week start (optional)</span><input type="date" name="date" value="' + tm + '"></div>' +
      '<div class="field"><span>Start with</span><select name="start"><option value="blank">A blank menu — I\'ll pick every recipe</option><option value="suggest">Suggestions I can change</option></select></div>' +
      '<div class="field"><span>Notes (optional)</span><textarea name="notes" maxlength="1000"></textarea></div>' +
      '<div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-act="closeModal">Cancel</button><button class="btn primary">Create menu</button></div></form>');
  }
  function suggestFill(m, onlyEmpty) {
    var used = {}, slots = m.slots || {};
    Object.keys(slots).forEach(function (k) { used[slots[k]] = (used[slots[k]] || 0) + 1; });
    for (var d = 0; d < dayCount(m); d++) {
      var dayIds = SLOTS.map(function (s) { return slots[d + "-" + s.k]; }).filter(Boolean);
      SLOTS.forEach(function (s) {
        var k = d + "-" + s.k; if (onlyEmpty && slots[k] && recipeById(slots[k]) && !blockReason(recipeById(slots[k]))) return;
        var r = pickRecipe(s.k, menuDayDate(m, d), used, null, dayIds, s.k === "side" ? slots[d + "-d"] : null); if (!r) return;
        slots[k] = r.id; used[r.id] = (used[r.id] || 0) + 1; dayIds.push(r.id);
      });
    }
    m.slots = slots;
  }
  function useMenu(m) {
    ensureWeek();
    var days = weekDays(), ti = todayIdx(), target = ti;
    if (m.kind === "day") {
      if (m.date) { var idx = Math.round((parseYmd(m.date) - parseYmd(weekStart())) / 86400000); if (idx >= 0 && idx < 7) target = idx; }
      if (!confirm("Use \u201c" + m.name + "\u201d as the menu for " + dayName(days[target]) + ", " + dateLabel(days[target]) + "? It replaces that day's meals (your saved copy stays).")) return false;
      SLOTS.forEach(function (s) { var id = m.slots["0-" + s.k]; var p = planItem(target, s.k); if (id) upsert("plan", { id: slotId(target, s.k), recipeId: id, locked: true, createdAt: p && p.createdAt }); });
    } else {
      if (!confirm("Use \u201c" + m.name + "\u201d as this week's menu? It replaces this week's meals (your saved copy stays).")) return false;
      for (var d = 0; d < 7; d++) SLOTS.forEach(function (s) { var id = m.slots[d + "-" + s.k]; var p = planItem(d, s.k); if (id) upsert("plan", { id: slotId(d, s.k), recipeId: id, locked: true, createdAt: p && p.createdAt }); });
    }
    save(); toast("Now using \u201c" + m.name + "\u201d — meals are locked so Shuffle keeps them");
    return true;
  }
  function menuCard(m) {
    var ids = menuRecipeIds(m), bad = ids.filter(function (id) { var r = recipeById(id); return !r || blockReason(r); }).length;
    var first = ids.slice(0, 3).map(function (id) { var r = recipeById(id); return r ? r.e + " " + esc(r.n) : ""; }).filter(Boolean).join(" · ");
    return '<div class="card menu-card"><div class="row between"><div style="min-width:0;flex:1"><p class="kicker">' + esc(menuDateLabel(m)) + " · " + (m.kind === "week" ? "Week" : "Day") + '</p><h2 style="margin:2px 0 4px"><a href="#/saved/' + m.id + '" style="color:inherit;text-decoration:none">' + esc(m.name) + "</a></h2>" +
      '<p class="small muted" style="margin:0">' + ids.length + " of " + dayCount(m) * SLOTS.length + " meals picked" + (bad ? ' · <span style="color:var(--bad)">⚠ ' + bad + " need a swap</span>" : "") + "</p>" +
      (first ? '<p class="small" style="margin:4px 0 0">' + first + (ids.length > 3 ? " …" : "") + "</p>" : "") + (m.notes ? '<p class="help" style="margin:4px 0 0">📝 ' + esc(m.notes.length > 120 ? m.notes.slice(0, 120) + "…" : m.notes) + "</p>" : "") + "</div></div>" +
      '<div class="row mt no-print"><a class="btn small primary" href="#/saved/' + m.id + '">Open / edit</a><button class="btn small gold" data-act="useMenu" data-id="' + m.id + '">✔ Use this menu</button><a class="btn small" href="#/saved/' + m.id + '/shop">🛒 Shopping list</a><a class="btn small" href="#/saved/' + m.id + '/print">🖨 Print</a><button class="btn small" data-act="dupMenu" data-id="' + m.id + '">📑 Duplicate</button><button class="btn small danger" data-act="delMenu" data-id="' + m.id + '">Delete</button></div></div>';
  }
  function viewSaved() {
    var rp = routeParts();
    if (rp[1]) { var m = find("savedMenus", rp[1]); if (!m) return '<div class="card"><h2>Menu not found</h2><p>It may have been deleted on another device.</p><a class="btn" href="#/saved">← Saved menus</a></div>'; if (rp[2] === "shop") return viewShopping(); if (rp[2] === "print") return viewPrintMenu(m); return viewMenuEditor(m); }
    var g = menuGroups();
    var sec = function (title, list, empty) { return '<h2 class="mt" style="margin-top:22px">' + title + ' <span class="pill">' + list.length + "</span></h2>" + (list.length ? '<div class="grid">' + list.map(menuCard).join("") + "</div>" : '<p class="muted">' + empty + "</p>"); };
    return '<div class="page-head row between"><div><p class="kicker">Planned</p><h1>Saved menus</h1><p class="lead">Menus you saved for later or made yourself. Upcoming first, then ones with no date, then past.</p></div>' +
      '<div class="row no-print"><button class="btn primary" data-act="addMenu">+ Add a menu</button><button class="btn" data-act="saveLaterWeek">+ Save this week</button></div></div>' +
      (state.savedMenus.length ? "" : '<div class="note">No saved menus yet. Tap <b>+ Save for later</b> on Today or Week, or <b>+ Add a menu</b> to build one for a future date.</div>') +
      sec("📅 Upcoming", g.up, "Nothing planned ahead yet.") + sec("🗂️ No date", g.none, "None.") + sec("🕘 Past", g.past, "None.") + disclaimer();
  }
  function recipeOptions(k, cur) {
    var list = RECIPES.filter(function (r) { return r.m.indexOf(k) >= 0 && !blockReason(r); });
    var h = '<option value="">— Pick a recipe —</option>';
    var curR = cur && recipeById(cur);
    if (curR && blockReason(curR)) h += '<option value="' + curR.id + '" selected>⚠ ' + esc(curR.n) + "</option>";
    Object.keys(D.CUISINES).forEach(function (c) {
      var g = list.filter(function (r) { return r.c === c; }); if (!g.length) return;
      h += '<optgroup label="' + esc(D.CUISINES[c]) + '">' + g.map(function (r) { return '<option value="' + r.id + '"' + (r.id === cur ? " selected" : "") + ">" + r.e + " " + esc(r.n) + "</option>"; }).join("") + "</optgroup>";
    });
    return h;
  }
  function viewMenuEditor(m) {
    var days = [];
    for (var d = 0; d < dayCount(m); d++) days.push(d);
    return '<div class="row between no-print" style="margin-bottom:10px"><a class="btn small" href="#/saved">← Saved menus</a><div class="row"><button class="btn small gold" data-act="useMenu" data-id="' + m.id + '">✔ Use this menu</button><a class="btn small" href="#/saved/' + m.id + '/shop">🛒 Shopping list</a><a class="btn small" href="#/saved/' + m.id + '/print">🖨 Print</a><button class="btn small" data-act="dupMenu" data-id="' + m.id + '">📑 Duplicate</button><button class="btn small danger" data-act="delMenu" data-id="' + m.id + '">Delete</button></div></div>' +
      '<div class="card"><p class="kicker">' + esc(menuDateLabel(m)) + " · " + (m.kind === "week" ? "Week menu" : "Day menu") + '</p><div class="form-grid">' +
      '<div class="field"><span>Name</span><input data-mf="name" data-id="' + m.id + '" value="' + esc(m.name) + '" maxlength="80"></div>' +
      '<div class="field"><span>' + (m.kind === "week" ? "Week start date" : "Planned date") + ' (optional)</span><div class="row"><input type="date" data-mf="date" data-id="' + m.id + '" value="' + esc(m.date || "") + '" style="flex:1">' + (m.date ? '<button class="btn small" data-act="clearDate" data-id="' + m.id + '">Clear</button>' : "") + "</div></div></div>" +
      '<div class="field"><span>Notes</span><textarea data-mf="notes" data-id="' + m.id + '" maxlength="1000" placeholder="Anything to remember for this menu">' + esc(m.notes || "") + "</textarea></div>" +
      '<div class="row"><button class="btn small" data-act="fillMenu" data-id="' + m.id + '">✨ Fill empty meals with suggestions</button><button class="btn small" data-act="clearMenu" data-id="' + m.id + '">Clear all meals</button></div>' +
      '<p class="help">Recipe choices follow your never-eat list' + (S("clean") ? " and the Biblically clean filter" : "") + '. Changes save as you go.</p></div>' +
      '<div class="week mt">' + days.map(function (d) {
        var date = menuDayDate(m, d);
        var label = date ? dayName(date) + " · " + dateLabel(date) : (m.kind === "week" ? "Day " + (d + 1) : "Meals");
        var sab = date && date.getDay() === 6;
        return '<div class="day' + (sab ? " sabbath" : "") + '"><div class="dh"><b>' + esc(label) + (sab ? " · Sabbath" : "") + "</b></div>" + SLOTS.map(function (s) {
          var cur = (m.slots || {})[d + "-" + s.k], r = cur && recipeById(cur), br = r ? blockReason(r) : "";
          return '<div class="mi" style="flex-wrap:wrap"><span class="e">' + (r ? r.e : s.ico) + '</span><div class="t"><small>' + esc(s.label) + (r && date && S("sabbath") && isSabbathSlot(date, s.k) ? (r.tags.indexOf("prep") >= 0 ? " · cook Friday" : " · not a prep-ahead dish") : "") + '</small><select data-mslot="' + d + "-" + s.k + '" data-id="' + m.id + '" aria-label="' + esc(label + " " + s.label) + '">' + recipeOptions(s.k, cur) + "</select>" +
            (br ? '<div class="small" style="color:var(--bad)">⚠ ' + esc(br) + "</div>" : "") + (r ? '<a class="small" href="#/recipe/' + r.id + '">See recipe</a>' : "") + "</div></div>";
        }).join("") + "</div>";
      }).join("") + "</div>" + disclaimer();
  }
  function viewPrintMenu(m) {
    var rows = [];
    for (var d = 0; d < dayCount(m); d++) rows.push(d);
    return '<div class="row between no-print" style="margin-bottom:12px"><a class="btn" href="#/saved/' + m.id + '">← Back</a><button class="btn primary" data-act="doPrint">🖨 Print this page</button></div>' +
      "<h1>" + esc(m.name) + '</h1><p class="muted">' + esc(menuDateLabel(m)) + " · " + S("servings") + " servings per meal · No pork, tripe or cow foot" + (S("clean") ? " · Biblically clean" : "") + "</p>" + (m.notes ? "<p>📝 " + esc(m.notes) + "</p>" : "") +
      '<table class="printweek"><thead><tr><th>Day</th>' + SLOTS.map(function (s) { return "<th>" + esc(s.label) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (d) { var date = menuDayDate(m, d); return "<tr><th>" + (date ? esc(dayName(date)) + "<br><small>" + esc(dateLabel(date)) + "</small>" : (m.kind === "week" ? "Day " + (d + 1) : "Menu")) + "</th>" + SLOTS.map(function (s) { var r = recipeById((m.slots || {})[d + "-" + s.k]); return "<td>" + (r ? r.e + " " + esc(r.n) + (date && S("sabbath") && isSabbathSlot(date, s.k) && r.tags.indexOf("prep") >= 0 ? "<br><small>cook Friday</small>" : "") : "—") + "</td>"; }).join("") + "</tr>"; }).join("") +
      "</tbody></table><p class=\"small muted mt\">Daily sodium: AHA recommends no more than 2,300 mg a day, ideally no more than 1,500 mg for most adults. Desalt saltfish well before cooking.</p>";
  }
  function comingUpCard() {
    var list = comingUp();
    return '<div class="card mt"><div class="row between"><h2 style="margin:0">📅 Coming up <span class="pill">next 7 days</span></h2><div class="row no-print"><button class="btn small primary" data-act="addMenu">+ Add a menu</button><a class="btn small" href="#/saved">All saved menus</a></div></div>' +
      (list.length ? '<div class="mt">' + list.map(function (m) { return '<div class="listrow"><div><b><a href="#/saved/' + m.id + '" style="color:inherit">' + esc(m.name) + '</a></b><div class="small muted">' + esc(menuDateLabel(m)) + " · " + menuRecipeIds(m).length + ' meals</div></div><div class="row no-print"><button class="btn small gold" data-act="useMenu" data-id="' + m.id + '">Use</button><a class="btn small" href="#/saved/' + m.id + '/shop">🛒</a></div></div>'; }).join("") + "</div>"
        : '<p class="muted" style="margin-bottom:0">No menus planned for the next 7 days. Tap <b>+ Add a menu</b> to plan one.</p>') + "</div>";
  }
  function foodList(key, cls, ph) {
    var list = state[key].slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    return '<div>' + (list.length ? list.map(function (f) { return '<span class="tagbtn ' + cls + '">' + esc(f.name) + '<button data-act="rmFood" data-key="' + key + '" data-id="' + f.id + '" aria-label="Remove ' + esc(f.name) + '">×</button></span>'; }).join("") : '<p class="muted">Nothing here yet.</p>') + "</div>" +
      '<form class="row mt" data-form="' + key + '"><input name="name" placeholder="' + esc(ph) + '" style="flex:1;min-width:180px" maxlength="60"><button class="btn primary">Add</button></form>';
  }
  function viewFoods() {
    var favs = state.favorites.map(function (f) { return recipeById(f.recipeId); }).filter(Boolean);
    return '<div class="page-head"><p class="kicker">Your preferences</p><h1>My foods</h1><p class="lead">The menu maker puts foods you like first and always leaves out anything on your never-eat list. These lists sync across your devices.</p></div>' +
      '<div class="grid g2"><div class="card"><h2>💚 Foods I like</h2><p class="help">Recipes with these show up more often when "Use foods I like first" is on.</p>' + foodList("myFoods", "", "Add a food you like, e.g. mackerel") + "</div>" +
      '<div class="card"><h2>🚫 Never eat</h2><p class="help">Any recipe with one of these in its name or ingredients is left out of menus and hidden in the library.</p>' + foodList("neverEat", "never", "Add a food to avoid, e.g. goat") + "</div></div>" +
      '<div class="card mt"><h2>✡︎ Biblically clean filter</h2><label class="switch"><input type="checkbox" data-set="clean"' + (S("clean") ? " checked" : "") + '><span><b>' + (S("clean") ? "On" : "Off") + "</b><small>When on, only fish with fins and scales are used — no shrimp, lobster, crab or other shellfish, and no catfish (" + src("Leviticus 11:9–12", LINKS.lev) + ", " + src("Deuteronomy 14:9–10", LINKS.deut) + "). Snapper, parrot fish, sprat, cod (saltfish), salmon, tilapia and flying fish all have fins and scales. This app never includes pork, on or off.</small></span></label></div>" +
      '<div class="card mt"><h2>★ Favorite recipes</h2>' + (favs.length ? '<div class="recipes">' + favs.map(function (r) { return '<a class="rc" href="#/recipe/' + r.id + '"><div class="top"><span class="e">' + r.e + "</span><b>" + esc(r.n) + '</b></div><div class="tags">' + tagPills(r, 3) + "</div></a>"; }).join("") + "</div>" : '<p class="muted">Tap ☆ on any recipe to save it here. Favorites show up a little more often in your menus.</p>') + "</div>" + disclaimer();
  }
  var REF = [
    ["Saltfish (cod, dried and salted)", 7030, 174190],
    ["Cod, Atlantic, raw (fresh)", 54, 171955],
    ["Snapper, raw", 64, 173698],
    ["Amaranth leaves (callaloo), raw", 20, 168385],
    ["Collard greens, raw", 17, 170406],
    ["Cabbage, raw", 18, 169975],
    ["Okra, raw", 7, 169260],
    ["Green plantain, raw", 2, 168215]
  ];
  function viewHealth() {
    return '<div class="page-head"><p class="kicker">Facts, with sources</p><h1>Heart health and food safety</h1><p class="lead">The menus are built to be lower in salt for blood pressure. Here is the guidance behind them.</p></div>' +
      '<div class="card"><h2>🧂 How much sodium a day?</h2><ul><li>The American Heart Association recommends <b>no more than 2,300 mg</b> of sodium a day, with an <b>ideal limit of no more than 1,500 mg</b> for most adults.</li><li>For most people, cutting back by 1,000 mg a day can improve blood pressure.</li><li>More than 70% of the sodium Americans eat comes from packaged, prepared and restaurant foods, not the saltshaker.</li><li>On labels, "low sodium" means 140 mg or less per serving.</li></ul><p class="help">Source: ' + src("American Heart Association — How much sodium should I eat per day?", LINKS.aha) + "</p></div>" +
      '<div class="card"><h2>🐟 Desalting saltfish</h2><p>' + esc(D.DESALT) + '</p><p class="help">Saltfish is the saltiest food in these recipes (see the table below). Desalting removes much of it, but USDA does not publish a number for desalted saltfish, so this app doesn\'t guess one. Using less fish and more callaloo, cabbage or okra also helps.</p></div>' +
      '<div class="card"><h2>📊 Sodium in the foods you like</h2><p class="help">Per 100 grams (about 3½ oz), from USDA FoodData Central (SR Legacy).</p><table class="ref"><thead><tr><th>Food</th><th>Sodium</th><th>USDA ID</th></tr></thead><tbody>' +
      REF.map(function (x) { return "<tr><td>" + esc(x[0]) + "</td><td><b>" + x[1].toLocaleString() + " mg</b></td><td>" + src(String(x[2]), "https://fdc.nal.usda.gov/food-details/" + x[2] + "/nutrients") + "</td></tr>"; }).join("") + "</tbody></table></div>" +
      '<div class="card"><h2>⚠️ Ackee safety</h2><ul><li>The edible part of a <b>fully ripe, properly processed</b> ackee is safe to eat.</li><li><b>Never eat unripe ackee</b>, or the seeds or rind of any ackee — they can contain dangerous amounts of a toxin called hypoglycin A. Cooking unripe ackee does not make it safe.</li><li>Only eat fresh ackee that ripened and opened naturally, and don\'t prepare raw ackee yourself unless you\'ve been trained.</li><li>For canned or frozen ackee, you can check that the maker is on FDA\'s "Green List."</li></ul><p class="help">Sources: ' + src("FDA — Hypoglycin A and Ackee Fruit", LINKS.fdaAckee) + " · " + src("FDA Import Alert 21-11", LINKS.fdaAlert) + "</p></div>" +
      '<div class="card"><h2>🥗 How the recipes cut salt</h2><ul><li>No bouillon cubes, soup-mix packets or bottled jerk sauce — fresh thyme, scallion, garlic, ginger, pimento and Scotch bonnet carry the flavor.</li><li>No-salt-added canned beans and tomatoes.</li><li>Steaming, baking and air-frying instead of deep-frying.</li><li>No pig tail or salt beef in red pea soup or stew peas.</li><li>Every recipe has its own sodium tip and a BP-friendly tag when it fits.</li></ul></div>' + disclaimer();
  }
  function viewAbout() {
    return '<div class="page-head"><h1>About Jamaican Menus</h1></div><div class="card"><p>Healthy Jamaican menus built around the foods you love — callaloo, saltfish, snapper, parrot fish, sprat, okra, cabbage, collard greens, ackee and breadfruit — plus healthy dishes from other cuisines.</p><ul><li>No recipe uses pork, pork products, tripe or cow foot.</li><li>' + RECIPES.length + " recipes, " + RECIPES.filter(function (r) { return r.c === "jm"; }).length + ' of them Jamaican.</li><li>Saved and planned menus are included in Sync and in the backup file.</li><li>Your lists and menus are saved only on this device unless you turn on <a href="#/sync">Sync</a>, which keeps a private copy in your own GitHub account.</li><li>Works offline once it has loaded.</li></ul></div>' +
      '<div class="card"><h2>Backup</h2><div class="row"><button class="btn" data-act="export">⬇ Export backup</button><label class="btn">⬆ Import backup<input type="file" id="importFile" accept="application/json" hidden></label></div></div>' + disclaimer();
  }
  function viewSync() {
    var connected = !!MenuSync.getToken();
    return '<div class="page-head"><p class="kicker">PC · tablet · phone</p><h1>Sync</h1><p class="lead">Keep your menus, favorites, food lists and checked items the same on every device. Your data is saved in a private Gist ("Jamaican Menus Sync") in your own GitHub account.</p></div>' +
      '<div class="card"><h2>Status</h2><p id="syncStatusLine" class="muted"></p><p id="syncLastLine" class="help"></p><p id="syncTokenMask" class="help"></p><div id="syncConnectedActions" class="row"' + (connected ? "" : " hidden") + '><button class="btn primary" data-act="syncNow">⟳ Sync now</button><button class="btn danger" data-act="disconnect">Disconnect this device</button></div></div>' +
      '<div class="card" id="syncSetupCard"><h2>' + (connected ? "Use a different token" : "Connect this device") + '</h2><ol><li>Use the same GitHub sync key you use in Business SuccessHQ or Credit Care, or ' + src("create a new one", "https://github.com/settings/tokens/new?scopes=gist&description=Jamaican%20Menus%20Sync") + ' with only the <b>gist</b> box checked.</li><li>Paste it below and tap <b>Connect</b>.</li><li>Do the same on your PC, tablet and phone.</li></ol>' +
      '<div class="field"><span>GitHub access token</span><input id="syncTokenInput" type="password" autocomplete="off" spellcheck="false" placeholder="Paste your token here"></div><p id="syncConnectError" class="small" style="color:var(--bad)"></p><button class="btn primary" data-act="connect">Connect</button>' +
      '<p class="help mt">The token is saved only on this device and is sent only to GitHub. Never paste it into a chat or email.</p></div>';
  }
  function disclaimer() { return '<p class="disclaimer">For information and meal ideas only, not medical advice. Ask your doctor or a dietitian about the right sodium goal for you, especially if you take blood pressure medicine. Facts are linked to their sources (AHA, FDA, USDA).</p>'; }

  /* ---------- render ---------- */
  var VIEWS = { saved: viewSaved, menu: viewMenu, week: viewWeek, print: viewPrint, recipes: viewRecipes, recipe: null, shopping: viewShopping, foods: viewFoods, health: viewHealth, about: viewAbout, sync: viewSync };
  var lastRoute = "";
  function routeParts() { return (location.hash || "").replace(/^#\/?/, "").split("/"); }
  function route() { var r = routeParts()[0]; return VIEWS.hasOwnProperty(r) ? r : "menu"; }
  function renderNav() {
    var r = route(); if (r === "recipe") r = "recipes"; if (r === "print") r = "week";
    var grp = "", h = "";
    NAV.forEach(function (n) { if (n.group !== grp) { grp = n.group; h += '<div class="grp">' + esc(grp) + "</div>"; } h += '<a href="#/' + n.id + '" class="' + (n.id === r ? "active" : "") + '"><span class="ico">' + n.ico + "</span>" + esc(n.label) + "</a>"; });
    document.getElementById("rail").innerHTML = h;
    document.getElementById("tabbar").innerHTML = TABS.map(function (id) { var n = NAV.filter(function (x) { return x.id === id; })[0]; return '<a href="#/' + id + '" class="' + (id === r ? "active" : "") + '"><span class="ico">' + n.ico + "</span>" + esc(n.label.replace("Menu maker", "Today").replace("Weekly menu", "Week").replace("Shopping list", "Shopping").replace("Saved menus", "Saved")) + "</a>"; }).join("") + '<a href="#" data-more="1"><span class="ico">☰</span>More</a>';
    document.getElementById("themeBtn").innerHTML = document.documentElement.dataset.theme === "dark" ? "☀" : "☾";
  }
  function render() {
    var r = route(), view = document.getElementById("view");
    view.innerHTML = r === "recipe" ? viewRecipe(routeParts()[1]) : VIEWS[r]();
    renderNav();
    var key = location.hash; if (key !== lastRoute) { window.scrollTo(0, 0); lastRoute = key; }
    if (r === "sync") renderSyncStatus();
    renderSyncBadge();
    var title = r === "recipe" ? ((recipeById(routeParts()[1]) || {}).n || "Recipe") : r === "saved" && routeParts()[1] ? ((find("savedMenus", routeParts()[1]) || {}).name || "Saved menu") : ((NAV.filter(function (n) { return n.id === r; })[0] || {}).label || "Print");
    document.title = title + " · Jamaican Menus";
  }
  function rerender() { var y = window.scrollY; render(); window.scrollTo(0, y); }
  function openMenu() { document.getElementById("rail").classList.add("open"); document.getElementById("railBackdrop").classList.add("open"); }
  function closeMenu() { document.getElementById("rail").classList.remove("open"); document.getElementById("railBackdrop").classList.remove("open"); }
  function setTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem("jmenus-theme", t); } catch (e) {} setS("theme", t); renderNav(); }
  function applyTheme() { var t = state.settings.theme; if (t) document.documentElement.dataset.theme = t; }

  /* ---------- events ---------- */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { toast("Copied"); }, function () { fallbackCopy(text); });
    fallbackCopy(text);
  }
  function fallbackCopy(text) { var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); toast("Copied"); } catch (e) { toast("Could not copy"); } ta.remove(); }
  function onClick(e) {
    var more = e.target.closest("[data-more]"); if (more) { e.preventDefault(); openMenu(); return; }
    var b = e.target.closest("[data-act]"); if (!b) return;
    var a = b.dataset.act, d = b.dataset.d != null ? +b.dataset.d : null, k = b.dataset.k;
    if (a === "lock") { toggleLock(d, k); rerender(); }
    else if (a === "swap") { swapSlot(d, k); rerender(); }
    else if (a === "shuffleDay") { fillDays([d]); toast("Shuffled " + dayName(weekDays()[d])); rerender(); }
    else if (a === "shuffleWeek") { fillDays([0, 1, 2, 3, 4, 5, 6]); toast("Shuffled the week"); rerender(); }
    else if (a === "newWeek") { if (confirm("Make a brand-new menu for this week? Locked meals will be replaced too.")) { startNewWeek(); rerender(); } }
    else if (a === "print") { location.hash = "#/print"; }
    else if (a === "doPrint") { window.print(); }
    else if (a === "serv") { setS("servings", Math.max(1, Math.min(12, S("servings") + +b.dataset.v))); rerender(); }
    else if (a === "rserv") { var cur = ui.servFor === b.dataset.id && ui.serv ? ui.serv : S("servings"); ui.servFor = b.dataset.id; ui.serv = Math.max(1, Math.min(12, cur + +b.dataset.v)); rerender(); }
    else if (a === "cuisine") { var cu = (S("cuisines") || []).slice(), i = cu.indexOf(b.dataset.c); if (i >= 0) cu.splice(i, 1); else cu.push(b.dataset.c); setS("cuisines", cu); rerender(); }
    else if (a === "rtag") { ui.tag = b.dataset.t; rerender(); }
    else if (a === "fav") { var id = "fav-" + b.dataset.id; if (find("favorites", id)) { removeItem("favorites", id); toast("Removed from favorites"); } else { upsert("favorites", { id: id, recipeId: b.dataset.id }); toast("Added to favorites"); } save(); rerender(); }
    else if (a === "clearCook") { var r = recipeById(b.dataset.id); r.ing.forEach(function (x, i) { if (getFlag("cookChecks", r.id, String(i))) setFlag("cookChecks", r.id, String(i), false); }); save(); rerender(); }
    else if (a === "saveLaterDay") saveLaterDialog("day");
    else if (a === "saveLaterWeek") saveLaterDialog("week");
    else if (a === "addMenu") addMenuDialog();
    else if (a === "closeModal") closeModal();
    else if (a === "useMenu") { var um = find("savedMenus", b.dataset.id); if (um && useMenu(um)) location.hash = um.kind === "week" ? "#/week" : "#/menu"; }
    else if (a === "dupMenu") { var dm = find("savedMenus", b.dataset.id); if (dm) { var cp = JSON.parse(JSON.stringify(dm)); cp.id = "menu-" + uid(); cp.name = dm.name + " (copy)"; delete cp.createdAt; upsert("savedMenus", cp); save(); toast("Duplicated"); location.hash = "#/saved/" + cp.id; } }
    else if (a === "delMenu") { var xm = find("savedMenus", b.dataset.id); if (xm && confirm("Delete the saved menu “" + xm.name + "”? This can't be undone.")) { removeItem("savedMenus", xm.id); save(); toast("Deleted"); if (routeParts()[1]) location.hash = "#/saved"; else rerender(); } }
    else if (a === "fillMenu") { var fm = find("savedMenus", b.dataset.id); if (fm) { suggestFill(fm, true); upsert("savedMenus", fm); save(); toast("Filled empty meals"); rerender(); } }
    else if (a === "clearMenu") { var cm = find("savedMenus", b.dataset.id); if (cm && confirm("Clear every meal in this menu?")) { cm.slots = {}; upsert("savedMenus", cm); save(); rerender(); } }
    else if (a === "clearDate") { var cd = find("savedMenus", b.dataset.id); if (cd) { cd.date = ""; upsert("savedMenus", cd); save(); rerender(); } }
    else if (a === "clearShop") { var ws = shopSource().key; shoppingItems().forEach(function (x) { if (getFlag("shopChecks", ws, x.key)) setFlag("shopChecks", ws, x.key, false); }); save(); rerender(); }
    else if (a === "copyList") { copyText(shoppingText()); }
    else if (a === "shareList") { var t = shoppingText(); if (navigator.share) navigator.share({ title: "Shopping list", text: t }).catch(function () {}); else copyText(t); }
    else if (a === "rmFood") { var f = find(b.dataset.key, b.dataset.id); removeItem(b.dataset.key, b.dataset.id); save(); toast("Removed " + (f ? f.name : "")); rerender(); }
    else if (a === "export") { var blob = new Blob([JSON.stringify(MenuSync.syncPayload(state), null, 2)], { type: "application/json" }); var u = URL.createObjectURL(blob); var l = document.createElement("a"); l.href = u; l.download = "jamaican-menus-backup.json"; l.click(); setTimeout(function () { URL.revokeObjectURL(u); }, 1000); }
    else if (a === "connect") connectSync();
    else if (a === "disconnect") disconnectSync();
    else if (a === "syncNow") runSync("manual");
  }
  function onChange(e) {
    var t = e.target;
    if (t.dataset.set) {
      var k = t.dataset.set, v = t.type === "checkbox" ? t.checked : t.type === "range" ? +t.value : t.value;
      setS(k, v);
      if (k === "clean" || k === "exclude") toast(k === "clean" ? (v ? "Biblically clean: on" : "Biblically clean: off — shellfish can appear") : "Exclusions saved — tap Shuffle to apply");
      rerender(); return;
    }
    if (t.dataset.ui) { ui[t.dataset.ui] = t.value; rerender(); return; }
    if (t.dataset.cook) { setFlag("cookChecks", t.dataset.cook, t.dataset.i, t.checked); save(); var sp = t.parentNode.querySelector("span:last-child"); if (sp) sp.className = t.checked ? "done" : ""; return; }
    if (t.dataset.shop) { var sk = shopSource().key; setFlag("shopChecks", sk, t.dataset.shop, t.checked); save(); if (ui.hideChecked && t.checked) rerender(); else { var s2 = t.parentNode.querySelector("span span"); if (s2) s2.className = t.checked ? "done" : ""; var hd = document.getElementById("shopCount"); if (hd) { var items = shoppingItems(); hd.textContent = items.filter(function (x) { return getFlag("shopChecks", sk, x.key); }).length + " of " + items.length + " items checked"; } } return; }
    if (t.dataset.mslot) { var mm = find("savedMenus", t.dataset.id); if (!mm) return; mm.slots = mm.slots || {}; if (t.value) mm.slots[t.dataset.mslot] = t.value; else delete mm.slots[t.dataset.mslot]; upsert("savedMenus", mm); save(); rerender(); return; }
    if (t.dataset.mf) { var me = find("savedMenus", t.dataset.id); if (!me) return; var v2 = String(t.value || "").slice(0, t.dataset.mf === "notes" ? 1000 : 80); if (t.dataset.mf === "name" && !v2.trim()) { toast("A menu needs a name"); t.value = me.name; return; } me[t.dataset.mf] = t.dataset.mf === "name" ? v2.trim() : v2; upsert("savedMenus", me); save(); toast(t.dataset.mf === "date" ? "Rescheduled" : "Saved"); if (t.dataset.mf !== "notes") rerender(); return; }
    if (t.dataset.act2 === "hideChecked") { ui.hideChecked = t.checked; rerender(); return; }
    if (t.id === "importFile" && t.files && t.files[0]) {
      var reader = new FileReader();
      reader.onload = function () { try { var d = MenuSync.parsePayload(reader.result); if (!d) throw new Error(); var m = MenuSync.mergeStates(state, d); applyMerged(m); save(); toast("Backup merged"); rerender(); } catch (err) { toast("That file isn't a Jamaican Menus backup."); } };
      reader.readAsText(t.files[0]);
    }
  }
  function onInput(e) {
    var t = e.target;
    if (t.id === "recipeSearch") { ui.q = t.value; var tmp = document.createElement("div"); var html = viewRecipes(); tmp.innerHTML = html; document.getElementById("recipeList").innerHTML = tmp.querySelector("#recipeList").innerHTML; }
    if (t.type === "range" && t.dataset.set === "ratio") { var l = document.getElementById("ratioLbl"); if (l) l.textContent = t.value + "% Jamaican · " + (100 - t.value) + "% other healthy cuisines"; }
  }
  function onModalSubmit(e) {
    var f = e.target.closest("[data-modal]"); if (!f) return; e.preventDefault();
    var name = f.name.value.trim().slice(0, 80); if (!name) return;
    var date = f.date.value || "", notes = (f.notes.value || "").slice(0, 1000), m;
    if (f.dataset.modal === "saveLater") {
      m = { id: "menu-" + uid(), name: name, kind: f.dataset.kind, date: date, notes: notes, slots: snapshotSlots(f.dataset.kind) };
      upsert("savedMenus", m); save(); closeModal(); toast("Saved “" + name + "”"); rerender();
    } else {
      m = { id: "menu-" + uid(), name: name, kind: f.kind.value === "week" ? "week" : "day", date: date, notes: notes, slots: {} };
      if (f.start.value === "suggest") suggestFill(m, true);
      upsert("savedMenus", m); save(); closeModal(); toast("Menu created — pick your recipes"); location.hash = "#/saved/" + m.id;
    }
  }
  function onSubmit(e) {
    var f = e.target.closest("[data-form]"); if (!f) return; e.preventDefault();
    var key = f.dataset.form, name = f.name.value.trim().slice(0, 60); if (!name) return;
    if (state[key].some(function (x) { return x.name.toLowerCase() === name.toLowerCase(); })) { toast("Already on the list"); return; }
    upsert(key, { id: (key === "myFoods" ? "like-" : "never-") + slug(name) || uid(), name: name }); save();
    toast("Added " + name); rerender();
  }

  /* ---------- sync ---------- */
  var syncing = false, syncStatus = "idle", syncError = "", dirty = false, pushTimer = null, pullTimer = null;
  function formatStamp(iso) { var d = new Date(iso); if (isNaN(d)) return ""; return d.toLocaleString("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " Central"; }
  function schedulePush() { if (!MenuSync.getToken()) return; dirty = true; renderSyncBadge(); clearTimeout(pushTimer); pushTimer = setTimeout(function () { runSync("auto"); }, 2500); }
  function schedulePull(reason) { if (!MenuSync.getToken()) return; clearTimeout(pullTimer); pullTimer = setTimeout(function () { runSync(reason || "focus"); }, 400); }
  function applyMerged(m) {
    MenuSync.LIST_KEYS.forEach(function (k) { state[k] = m[k] || []; });
    MenuSync.FLAG_KEYS.forEach(function (k) { state[k] = m[k] || {}; });
    state.settings = m.settings || {}; state.settingsTimes = m.settingsTimes || {};
    state.tombstones = m.tombstones || MenuSync.emptyTombs(); state.version = 1; applyTheme();
  }
  function isTyping() { var a = document.activeElement; return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT") && a.type !== "checkbox" && a.type !== "range"; }
  function runSync(reason) {
    var token = MenuSync.getToken(); if (!token) return Promise.resolve();
    if (navigator.onLine === false) { syncStatus = "offline"; dirty = true; renderSyncStatus(); return Promise.resolve(); }
    if (syncing) { dirty = true; return Promise.resolve(); }
    syncing = true; syncStatus = reason === "connect" ? "connecting" : "syncing"; syncError = ""; renderSyncStatus();
    var before = JSON.stringify(MenuSync.syncPayload(state).data);
    return Promise.resolve().then(function () {
      var id = MenuSync.getGistId(); if (!id) return null;
      return MenuSync.getGist(token, id).then(function (g) { return { remote: MenuSync.readGistData(g) }; }).catch(function () { MenuSync.setGistId(""); return null; });
    }).then(function (found) {
      if (found) return found;
      return MenuSync.findExistingGist(token).then(function (g) { if (!g) return null; MenuSync.setGistId(g.id); return MenuSync.getGist(token, g.id).then(function (gg) { return { remote: MenuSync.readGistData(gg) }; }); });
    }).then(function (found) {
      if (found && found.remote) { applyMerged(MenuSync.mergeStates(state, found.remote)); persist(); }
      dirty = false;
      var content = JSON.stringify(MenuSync.syncPayload(state), null, 2);
      if (!MenuSync.getGistId()) return MenuSync.createGist(token, content).then(function (c) { if (c && c.id) MenuSync.setGistId(c.id); });
      return MenuSync.patchGist(token, MenuSync.getGistId(), content);
    }).then(function () {
      MenuSync.setLastSync(nowISO()); syncStatus = "synced";
      if (JSON.stringify(MenuSync.syncPayload(state).data) !== before && !isTyping()) rerender();
    }, function (err) { syncStatus = "error"; syncError = err && err.message ? String(err.message) : "Sync could not be completed."; })
      .then(function () { syncing = false; renderSyncStatus(); if (dirty && MenuSync.getToken() && navigator.onLine) schedulePush(); });
  }
  function connectSync() {
    var input = document.getElementById("syncTokenInput"), err = document.getElementById("syncConnectError");
    var token = input ? input.value.trim() : ""; if (err) err.textContent = "";
    if (!token) { err.textContent = "Paste your GitHub access token first."; return; }
    if (/\s/.test(token)) { err.textContent = "The token should not contain spaces. Copy it again from GitHub."; return; }
    MenuSync.setToken(token); input.value = ""; syncStatus = "connecting";
    runSync("connect").then(function () {
      if (syncStatus === "error") { if (syncError.indexOf("not accepted") !== -1) MenuSync.clearToken(); var e2 = document.getElementById("syncConnectError"); if (e2) e2.textContent = syncError; renderSyncStatus(); }
      else { toast("Sync connected"); rerender(); }
    });
  }
  function disconnectSync() {
    if (!confirm("Disconnect Sync on this device? Your data stays here, and the private Gist stays in your GitHub account.")) return;
    clearTimeout(pushTimer); clearTimeout(pullTimer); MenuSync.clearToken(); MenuSync.setLastSync(""); syncing = false; syncStatus = "idle"; syncError = "";
    toast("Sync disconnected"); rerender();
  }
  function syncStatusText() {
    if (!MenuSync.getToken()) return "Not connected";
    if (syncStatus === "offline" || navigator.onLine === false) return "Offline — changes will sync when you're back online";
    if (syncStatus === "connecting") return "Connecting…";
    if (syncStatus === "syncing") return "Syncing…";
    if (syncStatus === "error") return "Sync needs attention";
    if (dirty) return "Changes waiting to sync";
    return "Connected";
  }
  function renderSyncBadge() { var b = document.getElementById("syncBadge"); if (!b) return; if (!MenuSync.getToken()) { b.hidden = true; return; } b.hidden = false; b.textContent = "⟳ " + syncStatusText(); }
  function renderSyncStatus() {
    renderSyncBadge();
    var line = document.getElementById("syncStatusLine"); if (!line) return;
    var connected = !!MenuSync.getToken(), last = MenuSync.getLastSync();
    line.textContent = syncStatusText() + (syncStatus === "error" && syncError ? " — " + syncError : "");
    document.getElementById("syncLastLine").textContent = connected && last ? "Last synced " + formatStamp(last) : "";
    document.getElementById("syncTokenMask").textContent = connected ? "Token on this device: " + MenuSync.maskToken(MenuSync.getToken()) : "";
    document.getElementById("syncConnectedActions").hidden = !connected;
    var setup = document.getElementById("syncSetupCard"); if (setup) setup.querySelector("h2").textContent = connected ? "Use a different token" : "Connect this device";
  }

  /* ---------- boot ---------- */
  seed(); applyTheme();
  document.getElementById("themeBtn").addEventListener("click", function () { setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"); });
  document.getElementById("menuBtn").addEventListener("click", function () { if (document.getElementById("rail").classList.contains("open")) closeMenu(); else openMenu(); });
  document.getElementById("railBackdrop").addEventListener("click", closeMenu);
  document.getElementById("rail").addEventListener("click", function (e) { if (e.target.closest("a")) closeMenu(); });
  document.getElementById("tabbar").addEventListener("click", onClick);
  var viewEl = document.getElementById("view");
  viewEl.addEventListener("click", onClick); viewEl.addEventListener("change", onChange); viewEl.addEventListener("input", onInput); viewEl.addEventListener("submit", onSubmit);
  var modalEl = document.getElementById("modal");
  modalEl.addEventListener("submit", onModalSubmit);
  modalEl.addEventListener("click", function (e) { if (e.target === modalEl) closeModal(); else onClick(e); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modalEl.hidden) closeModal(); });
  window.addEventListener("hashchange", function () { closeModal(); render(); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") schedulePull("focus"); });
  window.addEventListener("online", function () { if (MenuSync.getToken()) runSync("online"); });
  if (!location.hash) location.hash = "#/menu"; else render();
  if (MenuSync.getToken()) runSync("open");
  window.JM_APP = { state: function () { return state; }, blockReason: blockReason, likeHits: likeHits };
})();
