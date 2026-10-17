// Loadout gamble: four slots, one spin, one random stratagem per slot - never
// the same one twice in a spin. Whole top-level categories can be taken out of
// the pool; Mission is out by default. The choice is remembered.

const SLOTS = 4;
const STORE = "stratagemlegend.gamble";
const FIRST_STOP = 700;     // ms until the first reel stops
const NEXT_STOP = 350;      // ms between the following ones
const TICK = 70;            // ms per icon while a reel is rolling

const slotsEl = document.getElementById("slots");
const spinBtn = document.getElementById("spin");
const optionsEl = document.getElementById("options");
const poolEl = document.getElementById("pool");

let excluded = new Set(["Mission"]);
let categoriesOf = {};      // id -> Set of top-level category names
let slots = [];
let spinning = false;

// --- preferences -------------------------------------------------------------

function loadPrefs() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORE));
        if (saved && Array.isArray(saved.excluded)) excluded = new Set(saved.excluded);
    } catch {
        // unreadable or blocked storage: keep the defaults
    }
}

function savePrefs() {
    try {
        localStorage.setItem(STORE, JSON.stringify({excluded: [...excluded]}));
    } catch {
        // storage blocked: the choice just won't survive a reload
    }
}

// --- pool --------------------------------------------------------------------

function indexCategories() {
    const out = {};
    function walk(nodes, top) {
        for (const node of nodes) {
            const category = top ?? node.name;
            for (const id of node.stratagemIds || []) (out[id] ||= new Set()).add(category);
            if (node.subcategories) walk(node.subcategories, category);
        }
    }
    walk(Data.roots, null);
    return out;
}

// A stratagem filed under several categories is out as soon as any of them is
// excluded: Eagle Rearm also lives under Mission > Ship, so it goes with Mission.
function pool() {
    return Data.stratagems.filter(s => {
        const categories = categoriesOf[s.id];
        if (s.disabled || !categories) return false;
        return ![...categories].some(c => excluded.has(c));
    });
}

function updatePool() {
    const n = pool().length;
    poolEl.textContent = n ? `${n} in the pool` : "pool is empty";
    spinBtn.disabled = spinning || n === 0;
}

// --- slots -------------------------------------------------------------------

const EMPTY_ICON = () => Paths.ui + "back.png";

function buildSlots() {
    for (let i = 0; i < SLOTS; i++) {
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
        slot.name.replaceChildren(el("span", "prefix", {textContent: "nothing left"}));
        slot.code.replaceChildren();
        return;
    }
    slot.icon.src = stratagemIcon(stratagem.id) || EMPTY_ICON();
    slot.name.replaceChildren(
        stratagem.prefix ? el("span", "prefix", {textContent: stratagem.prefix}) : null,
        el("span", "", {textContent: stratagem.name})
    );
    slot.code.replaceChildren(
        ...[...stratagem.code].map(k => el("img", "", {src: Sprites.arrows[k], alt: k}))
    );
}

async function spin() {
    if (spinning) return;
    const candidates = pool();
    if (!candidates.length) return;

    spinning = true;
    updatePool();
    const result = shuffle([...candidates]).slice(0, SLOTS);

    for (const slot of slots) {
        slot.box.classList.remove("landed");
        slot.box.classList.add("rolling");
        slot.name.replaceChildren();
        slot.code.replaceChildren();
    }
    const ticker = setInterval(() => {
        for (const slot of slots) {
            if (!slot.box.classList.contains("rolling")) continue;
            slot.icon.src = stratagemIcon(randomItem(candidates).id) || EMPTY_ICON();
        }
    }, TICK);

    // Reels stop one by one, left to right, each with a click; the last one
    // lands with the completion sound on top.
    for (let i = 0; i < SLOTS; i++) {
        await sleep(i === 0 ? FIRST_STOP : NEXT_STOP);
        const slot = slots[i];
        slot.box.classList.remove("rolling");
        show(slot, result[i] || null);
        slot.box.classList.add("landed");
        playSfx("click").catch(() => {});
    }
    clearInterval(ticker);
    setTimeout(() => playSfx("correct").catch(() => {}), 120);

    spinning = false;
    updatePool();
}

spinBtn.addEventListener("click", spin);

// --- options -----------------------------------------------------------------

function buildOptions() {
    optionsEl.replaceChildren();
    for (const root of Data.roots) {
        const count = Data.stratagems.filter(s => categoriesOf[s.id]?.has(root.name)).length;
        const input = el("input", "", {type: "checkbox", checked: excluded.has(root.name)});
        input.addEventListener("change", () => {
            if (input.checked) excluded.add(root.name);
            else excluded.delete(root.name);
            savePrefs();
            updatePool();
        });
        optionsEl.appendChild(el("label", "toggle", {title: `Exclude ${root.name}`}, [
            el("img", "", {src: Paths.categories + categoryIconPath([root.name]), alt: ""}),
            el("span", "name", {textContent: root.name}),
            el("span", "count", {textContent: count}),
            input,
            el("span", "switch")
        ]));
    }
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
    await loadData();
    categoriesOf = indexCategories();
    buildSlots();
    buildOptions();
    updatePool();
    preloadIcons();
}

start();
