// LET'S GO GAMBLING: pick how many slots (1-16), spin, get one random stratagem
// per slot - never the same one twice in a spin. What is in the pool is up to
// the player: the stratagem tree, one collapsible column per category, with a
// switch on every folder and every stratagem, plus "categories" across the
// tree: elements (fire, gas, ...) and types (bullets, shield, ...), which flip
// the switches of their stratagems in the tree. Limits such
// as "backpack: max 1" set how many of a group one spin deals. Limits, those
// categories, the top-level categories never dealt and stratagems not in the
// game (yet) live in assets/data/gambleRules.json; the tree is the game's.
// Slot count, switches, limits and open folders are remembered.

const MIN_SLOTS = 1;
const MAX_SLOTS = 16;
const ART = 19;             // stratagem art is 19px; icons scale by whole steps
const REEL_MAX = 144;       // px, the full-size reel
const REEL_GRID = 76;       // px, reel size in the 4x4 grid (57px icons, 3x)
const LABEL_MIN = 128;      // px of column width needed to show name and code
const STORE = "stratagemlegend.gamble";
const TICK = 40;            // ms per icon while a reel is rolling
const NEXT_STOP = 100;      // ms per reel stop, the first one included
const LOSE_DELAY = 120;     // ms from the last click to "aw dang it", as in the song

// Gamble Core sounds, with the game's own sounds standing in if a clip is
// missing. "start" greets you when the page opens; the rest belong to a spin.
const GambleSfx = {
    start: {src: "assets/sfx/gamble/lets go gambling.ogg", fallback: null},
    stop:  {src: "assets/sfx/gamble/click.ogg", fallback: "click"},
    lose:  {src: "assets/sfx/gamble/aw dang it.ogg", fallback: "wrong"}
};

const slotsEl = document.getElementById("slots");
const spinBtn = document.getElementById("spin");
const countEl = document.getElementById("count");
const limitsEl = document.getElementById("limits");
const typesEl = document.getElementById("types");
const poolEl = document.getElementById("pool");

let slotCount = 4;
let out = new Set();        // stratagems switched off, as "#<id>"; folders and categories show these
let open = new Set();       // folder path keys expanded in the tree
let placements = {};        // id -> [folder paths it is filed under]; some have two
let never = new Set();      // categories never dealt, from gambleRules.json
let unavailable = new Set();    // stratagem ids never dealt: not in the game (yet)
let rules = [];             // limits: [{id, name, hint, icon, default (a mode), ids: Set}]
let exempt = [];            // stratagems a cap ignores: [{id, name, hint, icon, default, ids: Set}]
let elements = [];          // "categories": stratagems by element (fire, gas) or type (bullets, shield), each with a group
let groupInfo = {};         // group name -> {icon}, from gambleRules.json
let unique = [];            // always on: at most one of each per spin (a tank, an FRV, an exosuit)
let activeRules = new Set();    // ids of the exemptions switched on
let modes = {};             // limit id -> key of MODES
let savedRules = null;      // from storage, until the rules file is loaded
let savedModes = null;
let slots = [];
let spinning = false;

// --- preferences -------------------------------------------------------------

function clampCount(n) {
    return Math.min(Math.max(Math.round(Number(n)) || MIN_SLOTS, MIN_SLOTS), MAX_SLOTS);
}

function loadPrefs() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORE));
        // "excluded" held the categories switched off, before the tree; a
        // category's path key is its name, so it carries straight over.
        if (saved && Array.isArray(saved.out)) out = new Set(saved.out);
        else if (saved && Array.isArray(saved.excluded)) out = new Set(saved.excluded);
        if (saved && Array.isArray(saved.open)) open = new Set(saved.open);
        if (saved && Array.isArray(saved.rules)) savedRules = saved.rules;
        if (saved && saved.modes && typeof saved.modes === "object") savedModes = saved.modes;
        if (saved && saved.slots) slotCount = clampCount(saved.slots);
    } catch {
        // unreadable or blocked storage: keep the defaults
    }
}

function savePrefs() {
    try {
        localStorage.setItem(STORE, JSON.stringify({
            out: [...out], open: [...open], rules: [...activeRules], modes, slots: slotCount
        }));
    } catch {
        // storage blocked: the choice just won't survive a reload
    }
}

// --- sound -------------------------------------------------------------------

const clips = {};

function loadClips() {
    for (const [name, {src}] of Object.entries(GambleSfx)) {
        const audio = new Audio(src);
        audio.preload = "auto";
        clips[name] = audio;
    }
}

function playGamble(name) {
    const clip = clips[name];
    const sound = clip.cloneNode();
    sound.volume = sfxVolume;
    sound.play().catch(() => {
        // clip missing (or blocked): fall back to the game's sound, if any
        if (GambleSfx[name].fallback) playSfx(GambleSfx[name].fallback).catch(() => {});
    });
}

// "Let's go gambling!" as the page opens. Browsers may refuse sound before the
// first interaction with a page - then it plays on the first click or key.
function playIntro() {
    const sound = clips.start.cloneNode();
    sound.volume = sfxVolume;
    sound.play().catch(err => {
        if (err.name !== "NotAllowedError") return;     // missing clip: stay quiet
        const once = () => {
            removeEventListener("pointerdown", once, true);
            removeEventListener("keydown", once, true);
            playGamble("start");
        };
        addEventListener("pointerdown", once, true);
        addEventListener("keydown", once, true);
    });
}

// --- rules -------------------------------------------------------------------

// What a limit can be set to: how many of its group one spin deals.
const MODES = {
    none:    {label: "none", min: 0, max: 0},
    any:     {label: "any", min: 0, max: Infinity},
    max1:    {label: "max 1", min: 0, max: 1},
    exactly: {label: "exactly 1", min: 1, max: 1}
};

// The on/off "one backpack" and "one support weapon" of before, as modes.
const OLD_LIMITS = {one_backpack: "backpack", one_support_weapon: "support_weapon"};

async function loadRules() {
    const data = await fetch("assets/data/gambleRules.json").then(r => r.json());
    never = new Set(data.never || []);
    unavailable = new Set(data.unavailable || []);
    rules = (data.rules || []).map(r => ({...r, ids: new Set(r.ids || [])}));
    exempt = (data.exempt || []).map(r => ({...r, ids: new Set(r.ids || [])}));
    elements = (data.categories || []).map(r => ({...r, ids: new Set(r.ids || [])}));
    groupInfo = data.groups || {};
    unique = (data.unique || []).map(r => ({...r, ids: new Set(r.ids || [])}));

    // Categories used to be bans of their own; one saved that way becomes its
    // stratagems' switches in the tree, once.
    for (const r of elements) {
        if (savedRules?.includes(r.id) || savedRules?.includes("@" + (r.group || "Other"))) {
            for (const id of r.ids) out.add(idKey(id));
        }
    }
    const known = exempt.map(r => r.id);
    activeRules = new Set(savedRules
        ? savedRules.filter(id => known.includes(id))
        : exempt.filter(r => r.default).map(r => r.id));

    modes = {};
    for (const r of rules) {
        const saved = savedModes?.[r.id];
        const old = savedRules?.some(id => OLD_LIMITS[id] === r.id);
        modes[r.id] = MODES[saved] ? saved : old ? "max1" : MODES[r.default] ? r.default : "any";
    }
}

function isFree(s) {
    return exempt.some(r => activeRules.has(r.id) && r.ids.has(s.id));
}

// The limits a stratagem counts towards. A stratagem in several groups counts
// towards each of them: a Recoilless Rifle is a backpack and a support weapon.
// Free ones (expendables, when allowed) count towards nothing.
function limitsOf(s) {
    return isFree(s) ? [] : rules.filter(r => r.ids.has(s.id));
}

// "exactly 1" goes first: one random stratagem per such group, preferring one
// that covers every group still missing when slots run short (1 slot, both
// "exactly 1": a backpack weapon). Then the rest of the shuffled pool, skipping
// anything over a limit. The hand is shuffled so the forced pick can land in
// any slot.
function deal(candidates, count) {
    const used = new Map();
    // the "unique" groups too: never two tanks, two FRVs or two exosuits -
    // one of each together is fine
    const once = s => unique.filter(u => u.ids.has(s.id));
    const fits = s => limitsOf(s).every(r => (used.get(r.id) || 0) < MODES[modes[r.id]].max)
        && once(s).every(u => !used.get("unique:" + u.name));
    const take = s => {
        for (const r of limitsOf(s)) used.set(r.id, (used.get(r.id) || 0) + 1);
        for (const u of once(s)) used.set("unique:" + u.name, 1);
        hand.push(s);
    };
    const hand = [];
    const order = shuffle([...candidates]);
    const missing = () => rules.filter(r => MODES[modes[r.id]].min > (used.get(r.id) || 0));

    for (let need = missing(); need.length && hand.length < count; need = missing()) {
        const covers = s => need.filter(r => r.ids.has(s.id) && !isFree(s)).length;
        const short = count - hand.length < need.length;
        const pick = order.find(s => !hand.includes(s) && fits(s)
            && (short ? covers(s) === need.length : covers(s) > 0 && limitsOf(s).includes(need[0])));
        if (!pick) break;       // nothing left that fits: deal without it
        take(pick);
    }
    for (const s of order) {
        if (hand.length === count) break;
        if (!hand.includes(s) && fits(s)) take(s);
    }
    return shuffle(hand);
}

// --- pool --------------------------------------------------------------------

const keyOf = path => path.join(">");
// A group in the categories column (Elements, Types): its key in `open`.
const groupKey = rule => "@" + (rule.group || "Other");
const idKey = id => "#" + id;

function indexPlacements() {
    const where = {};
    (function walk(nodes, path) {
        for (const node of nodes) {
            const here = [...path, node.name];
            for (const id of node.stratagemIds || []) (where[id] ||= []).push(here);
            if (node.subcategories) walk(node.subcategories, here);
        }
    })(Data.roots, []);
    return where;
}

// Never dealt, whatever the switches say - and why: retired, not in the game,
// or also a Mission stratagem (Eagle Rearm lives under Mission > Ship too).
function fixedReason(id) {
    const s = Data.byId[id];
    if (!s || !placements[id]) return "Not in the tree";
    if (s.disabled) return "Retired";
    if (unavailable.has(id)) return "Not in the game";
    if (placements[id].some(p => never.has(p[0]))) return "Also a Mission stratagem: never dealt";
    return null;
}

const fixedOut = id => fixedReason(id) !== null;

// Out because of its switch. Folders have none of their own: switching one
// flips every stratagem in it - the C4 Pack is filed under Team reload and
// Backpack, so either folder flips it.
const treeOut = id => out.has(idKey(id));

// Folders used to be switched off by their own key ("Support>Vehicle", or a
// category's name from before the tree); such a key becomes its stratagems'
// switches, once.
function migrateFolderKeys() {
    for (const key of [...out]) {
        if (key.startsWith("#")) continue;
        out.delete(key);
        let nodes = Data.roots, node = null;
        for (const name of key.split(">")) {
            node = (nodes || []).find(n => n.name === name);
            if (!node) break;
            nodes = node.subcategories;
        }
        if (node) for (const id of switchable(subtreeIds(node))) out.add(idKey(id));
    }
}

function pool() {
    return Data.stratagems.filter(s => {
        if (fixedOut(s.id) || treeOut(s.id)) return false;
        return !limitsOf(s).some(r => modes[r.id] === "none");
    });
}

function updatePool() {
    const inPool = pool();
    paintTree(new Set(inPool.map(s => s.id)));
    const n = inPool.length;
    poolEl.textContent = n ? `${n} in the pool` : "pool is empty";
    spinBtn.disabled = spinning || n === 0;
    countEl.disabled = spinning;
}

// --- slots -------------------------------------------------------------------

const EMPTY_ICON = () => Paths.ui + "back.png";

// All reels share one row - except a full house of 16, which goes 4x4.
function columns() {
    return slotCount === MAX_SLOTS ? 4 : slotCount;
}

// Reels shrink to fit their column; the icon inside scales by whole steps of
// the 19px art so it stays crisp. Columns too narrow for name and arrow code
// show the icon alone - the name is in its tooltip.
function sizeReels() {
    const cols = columns();
    const gap = cols > 6 ? 8 : 24;
    const colWidth = (slotsEl.clientWidth - gap * (cols - 1)) / cols;
    const reel = Math.floor(Math.min(colWidth, slotCount === MAX_SLOTS ? REEL_GRID : REEL_MAX));
    const icon = Math.max(1, Math.floor(reel * 0.8 / ART)) * ART;

    slotsEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    slotsEl.style.columnGap = gap + "px";
    slotsEl.style.rowGap = slotCount === MAX_SLOTS ? "1rem" : "";
    slotsEl.style.setProperty("--reel", reel + "px");
    slotsEl.style.setProperty("--icon", icon + "px");
    slotsEl.classList.toggle("bare", colWidth < LABEL_MIN);
}

function buildSlots() {
    slotsEl.replaceChildren();
    slots = [];
    sizeReels();

    for (let i = 0; i < slotCount; i++) {
        const icon = el("img", "icon", {src: EMPTY_ICON(), alt: ""});
        const name = el("div", "name");
        const code = el("div", "code");
        const box = el("div", "slot", null, [el("div", "reel", null, [icon]), name, code]);
        slotsEl.appendChild(box);
        slots.push({box, icon, name, code});
    }
}

function show(slot, stratagem) {
    if (!stratagem) {
        slot.icon.src = EMPTY_ICON();
        slot.box.title = "Nothing left in the pool";
        slot.name.replaceChildren(el("span", "prefix", {textContent: "nothing left"}));
        slot.code.replaceChildren();
        return;
    }
    slot.icon.src = stratagemIcon(stratagem.id) || EMPTY_ICON();
    slot.box.title = (stratagem.prefix ? stratagem.prefix + " " : "") + stratagem.name;
    // replaceChildren would print a null as the text "null", so no placeholders.
    const name = el("span", "", {textContent: stratagem.name});
    slot.name.replaceChildren(
        ...(stratagem.prefix ? [el("span", "prefix", {textContent: stratagem.prefix})] : []),
        name
    );
    slot.code.replaceChildren(
        ...[...stratagem.code].map(k => el("img", "", {src: Sprites.arrows[k], alt: k}))
    );
}

// The reels roll, then stop one by one, left to right, a click each, and the
// last one lands on "aw dang it".
async function spin() {
    if (spinning) return;
    const candidates = pool();
    if (!candidates.length) return;

    spinning = true;
    updatePool();
    const result = deal(candidates, slotCount);

    for (const slot of slots) {
        slot.box.classList.remove("landed");
        slot.box.classList.add("rolling");
        slot.box.title = "";
        slot.name.replaceChildren();
        slot.code.replaceChildren();
    }
    const ticker = setInterval(() => {
        for (const slot of slots) {
            if (!slot.box.classList.contains("rolling")) continue;
            slot.icon.src = stratagemIcon(randomItem(candidates).id) || EMPTY_ICON();
        }
    }, TICK);

    for (let i = 0; i < slots.length; i++) {
        await sleep(NEXT_STOP);
        const slot = slots[i];
        slot.box.classList.remove("rolling");
        show(slot, result[i] || null);
        slot.box.classList.add("landed");
        playGamble("stop");
    }
    clearInterval(ticker);
    await sleep(LOSE_DELAY);
    playGamble("lose");

    spinning = false;
    updatePool();
}

spinBtn.addEventListener("click", spin);

countEl.addEventListener("change", () => {
    slotCount = clampCount(countEl.value);
    countEl.value = slotCount;
    savePrefs();
    buildSlots();
});

addEventListener("resize", sizeReels);

// --- options -----------------------------------------------------------------

// The icon of a rule, from the folder icons (elements: element_<name>.png,
// yellow copies of a stratagem of that element).
const ruleIcon = rule => Paths.categories + rule.icon;

function toggle(src, name, count, title, on, change) {
    const input = el("input", "", {type: "checkbox", checked: on});
    input.addEventListener("change", () => {
        change(input.checked);
        savePrefs();
        updatePool();
    });
    return el("label", "toggle", {title}, [
        el("img", "", {src, alt: ""}),
        el("span", "name", {textContent: name}),
        el("span", "count", {textContent: count}),
        input,
        el("span", "switch")
    ]);
}

// How many of a group could be dealt at all.
const available = rule => [...rule.ids].filter(id => !fixedOut(id)).length;

// A limit: icon, name and count like a switch, with its modes as a row of
// buttons underneath. "none" (the group is out) draws it faded, like a switch
// off.
function limitCard(rule) {
    const card = el("div", "toggle limit", {title: rule.hint || rule.name});
    const buttons = Object.entries(MODES).map(([key, mode]) => {
        const btn = el("button", "", {type: "button", textContent: mode.label});
        btn.addEventListener("click", () => {
            modes[rule.id] = key;
            paint();
            savePrefs();
            updatePool();
        });
        return [key, btn];
    });
    const paint = () => {
        for (const [key, btn] of buttons) btn.classList.toggle("on", modes[rule.id] === key);
        card.classList.toggle("off", modes[rule.id] === "none");
    };
    card.append(
        el("img", "", {src: ruleIcon(rule), alt: ""}),
        el("span", "name", {textContent: rule.name}),
        el("span", "count", {textContent: available(rule)}),
        el("div", "modes", null, buttons.map(([, btn]) => btn))
    );
    paint();
    return card;
}

// --- the pool tree ------------------------------------------------------------

// One column per category, the whole stratagem tree: a switch on every folder
// and every stratagem, folders collapsed until clicked. A folder's switch, like
// a category's, shows its stratagems - on, off or half - and flips them all.
// A row is greyed when it is out of the pool although switched on: a limit
// rules it out, or it is never dealt at all.
const treeRows = [];        // {path, ids, row, count, input} for folders, {id, row, input} for stratagems,
                            // {ids, row, count, input, cards: [{card, rule, input}]} for the groups in the categories column

function subtreeIds(node) {
    const ids = [...(node.stratagemIds || [])];
    for (const sub of node.subcategories || []) ids.push(...subtreeIds(sub));
    return [...new Set(ids)];
}

function treeSwitch(key, title) {     // a stratagem's
    const input = el("input", "", {type: "checkbox", checked: !out.has(key)});
    input.addEventListener("change", () => {
        if (input.checked) out.delete(key);
        else out.add(key);
        savePrefs();
        updatePool();
    });
    return [input, el("label", "sw", {title}, [input, el("span", "switch")])];
}

function folderNode(node, path) {
    const key = keyOf(path);
    const head = path.length === 1;
    const ids = subtreeIds(node);
    const input = el("input", "", {type: "checkbox"});
    input.addEventListener("change", () => {
        setAll(ids, input.checked);
        savePrefs();
        updatePool();
    });
    const sw = el("label", "sw", {title: `Include ${path.join(" \u203a ")}`}, [input, el("span", "switch")]);
    const count = el("span", "count");
    const row = el("div", "trow folder" + (head ? " head" : ""), null, [
        el("span", "caret"),
        el("img", "", {src: Paths.categories + categoryIconPath(path), alt: ""}),
        el("span", "name", {textContent: node.name}),
        count,
        sw
    ]);
    const kids = el("div", "kids");
    const wrap = el("div", "tnode" + (head || open.has(key) ? " open" : ""), null, [row, kids]);
    if (!head) {
        row.addEventListener("click", e => {
            if (e.target.closest(".sw")) return;
            const isOpen = wrap.classList.toggle("open");
            if (isOpen) open.add(key);
            else open.delete(key);
            savePrefs();
        });
    }
    for (const sub of node.subcategories || []) kids.appendChild(folderNode(sub, [...path, sub.name]));
    for (const id of node.stratagemIds || []) kids.appendChild(stratagemNode(id));
    treeRows.push({path, ids, row, count, input});
    return wrap;
}

function stratagemNode(id) {
    const s = Data.byId[id];
    const full = s ? (s.prefix ? s.prefix + " " : "") + s.name : id;
    const reason = fixedReason(id);
    const [input, sw] = treeSwitch(idKey(id), reason ? `${full}: ${reason}` : `Include ${full}`);
    input.disabled = !!reason;
    const row = el("div", "trow strat", {title: reason ? `${full} - ${reason}` : full}, [
        el("span", "caret"),
        el("img", "", {src: stratagemIcon(id) || Paths.ui + "back.png", alt: ""}),
        el("span", "name", {textContent: s ? s.name : id}),
        sw
    ]);
    treeRows.push({id, row, input});
    return row;
}

// Switch states (a stratagem filed twice has two switches, kept in step),
// greying, and per folder how much of it is in the pool: "7" when all of it,
// "5/7" when some is out. A folder, group or category card with nothing left
// in the pool is greyed too - everything inside it is.
function paintTree(inPool) {
    for (const r of treeRows) {
        if (r.id) {
            const off = out.has(idKey(r.id));
            const fixed = fixedOut(r.id);
            r.input.checked = !off;
            r.row.classList.toggle("fixed", fixed);
            r.row.classList.toggle("implied", !fixed && !off && !inPool.has(r.id));
        } else {
            const possible = r.ids.filter(id => !fixedOut(id));
            const dealt = possible.filter(id => inPool.has(id)).length;
            const state = paintSwitch(r.input, r.row, r.ids);
            r.row.classList.toggle("implied", state !== "off" && dealt === 0);
            for (const {card, rule, input} of r.cards || []) {
                const state = paintSwitch(input, card, [...rule.ids]);
                const left = [...rule.ids].some(id => inPool.has(id));
                card.classList.toggle("implied", state !== "off" && !left);
            }
            r.count.textContent = dealt === possible.length ? possible.length : `${dealt}/${possible.length}`;
        }
    }
}

// --- categories ---------------------------------------------------------------

// A category (Melee, Fire, ...) or a whole group (Types) has no state of its
// own: its switch shows the switches of its stratagems in the tree - on when
// all are on, off when none are, half when some are - and flipping it flips
// them all. Stratagems never dealt don't count.
const switchable = ids => ids.filter(id => !fixedOut(id));

function stateOf(ids) {
    const all = switchable(ids);
    const on = all.filter(id => !out.has(idKey(id))).length;
    return on === all.length ? "on" : on === 0 ? "off" : "half";
}

function setAll(ids, on) {
    for (const id of switchable(ids)) {
        if (on) out.delete(idKey(id));
        else out.add(idKey(id));
    }
}

function paintSwitch(input, holder, ids) {
    const state = stateOf(ids);
    input.checked = state === "on";
    holder.classList.toggle("half", state === "half");
    return state;
}

function buildOptions() {
    limitsEl.replaceChildren();
    for (const rule of rules) limitsEl.appendChild(limitCard(rule));
    for (const rule of exempt) {
        limitsEl.appendChild(toggle(
            ruleIcon(rule), rule.name, available(rule), rule.hint || rule.name,
            activeRules.has(rule.id),
            on => on ? activeRules.add(rule.id) : activeRules.delete(rule.id)
        ));
    }

    typesEl.replaceChildren();
    treeRows.length = 0;
    for (const root of Data.roots) {
        if (never.has(root.name)) continue;
        typesEl.appendChild(el("div", "type-col tree-col " + root.name.toLowerCase(), null,
            [folderNode(root, [root.name])]));
    }

    // The categories across the tree (elements, types) come first, at the very
    // left: one collapsible group each, with a switch for all of it.
    const col = el("div", "type-col elements", null, [el("h3", "", {textContent: "Categories"})]);
    const groups = [...new Set(elements.map(r => r.group || "Other"))];
    for (const name of groups) {
        const members = elements.filter(r => (r.group || "Other") === name);
        const key = groupKey(members[0]);
        const ids = [...new Set(members.flatMap(r => [...r.ids]))];
        const input = el("input", "", {type: "checkbox"});
        input.addEventListener("change", () => {
            setAll(ids, input.checked);
            savePrefs();
            updatePool();
        });
        const count = el("span", "count");
        const row = el("div", "trow folder", null, [
            el("span", "caret"),
            // its own icon if it has one, else its first category's
            el("img", "", {src: ruleIcon(groupInfo[name]?.icon ? groupInfo[name] : members[0]), alt: ""}),
            el("span", "name", {textContent: name}),
            count,
            el("label", "sw", {title: `Include ${name}`}, [input, el("span", "switch")])
        ]);
        const kids = el("div", "kids");
        const wrap = el("div", "tnode" + (open.has(key) ? " open" : ""), null, [row, kids]);
        row.addEventListener("click", e => {
            if (e.target.closest(".sw")) return;
            if (wrap.classList.toggle("open")) open.add(key);
            else open.delete(key);
            savePrefs();
        });
        const cards = members.map(rule => {
            const card = kids.appendChild(toggle(
                ruleIcon(rule), rule.name, available(rule), rule.hint || rule.name,
                true, on => setAll([...rule.ids], on)
            ));
            return {rule, card, input: card.querySelector("input")};
        });
        treeRows.push({ids, row, count, input, cards});
        col.appendChild(wrap);
    }
    typesEl.prepend(col);
}

// Every stratagem icon is fetched once up front, so the rolling reels never
// flicker while an image is still loading.
function preloadIcons() {
    for (const s of Data.stratagems) {
        const src = stratagemIcon(s.id);
        if (src) new Image().src = src;
    }
}

async function start() {
    loadPrefs();
    loadClips();
    playIntro();
    countEl.min = MIN_SLOTS;
    countEl.max = MAX_SLOTS;
    countEl.value = slotCount;
    await Promise.all([loadData(), loadRules()]);
    placements = indexPlacements();
    migrateFolderKeys();
    buildSlots();
    buildOptions();
    updatePool();
    preloadIcons();
}

start();
