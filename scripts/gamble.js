// LET'S GO GAMBLING: pick how many slots (1-16), spin, get one random stratagem
// per slot - never the same one twice in a spin. Mission stratagems are never
// dealt here; the other top-level categories can each be left out of the pool.
// Slot count and exclusions are remembered.

const MIN_SLOTS = 1;
const MAX_SLOTS = 16;
const ART = 19;             // stratagem art is 19px; icons scale by whole steps
const REEL_MAX = 144;       // px, the full-size reel
const REEL_GRID = 76;       // px, reel size in the 4x4 grid (57px icons, 3x)
const LABEL_MIN = 128;      // px of column width needed to show name and code
const NEVER = new Set(["Mission"]);   // categories this page never deals from
const STORE = "stratagemlegend.gamble";
const TICK = 40;            // ms per icon while a reel is rolling
const FIRST_STOP = 1300;    // ms from the spin to the first reel stopping
const NEXT_STOP = 100;      // ms between reels, however many there are
const LOSE_DELAY = 120;     // ms from the last click to "aw dang it", as in the song

// Gamble Core sounds, with the game's own sounds standing in if a clip is
// missing. "start" greets you when the page opens; the rest belong to a spin.
const GambleSfx = {
    start: {src: "/assets/sfx/gamble/lets go gambling.ogg", fallback: null},
    stop:  {src: "/assets/sfx/gamble/click.ogg", fallback: "click"},
    lose:  {src: "/assets/sfx/gamble/aw dang it.ogg", fallback: "wrong"}
};

const slotsEl = document.getElementById("slots");
const spinBtn = document.getElementById("spin");
const countEl = document.getElementById("count");
const optionsEl = document.getElementById("options");
const poolEl = document.getElementById("pool");

let slotCount = 4;
let excluded = new Set();
let categoriesOf = {};      // id -> Set of top-level category names
let slots = [];
let spinning = false;

// --- preferences -------------------------------------------------------------

function clampCount(n) {
    return Math.min(Math.max(Math.round(Number(n)) || MIN_SLOTS, MIN_SLOTS), MAX_SLOTS);
}

function loadPrefs() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORE));
        if (saved && Array.isArray(saved.excluded)) {
            excluded = new Set(saved.excluded.filter(c => !NEVER.has(c)));
        }
        if (saved && saved.slots) slotCount = clampCount(saved.slots);
    } catch {
        // unreadable or blocked storage: keep the defaults
    }
}

function savePrefs() {
    try {
        localStorage.setItem(STORE, JSON.stringify({excluded: [...excluded], slots: slotCount}));
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
// out: Eagle Rearm also lives under Mission > Ship, so it is never dealt.
function pool() {
    return Data.stratagems.filter(s => {
        const categories = categoriesOf[s.id];
        if (s.disabled || !categories) return false;
        return ![...categories].some(c => NEVER.has(c) || excluded.has(c));
    });
}

function updatePool() {
    const n = pool().length;
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
    const result = shuffle([...candidates]).slice(0, slotCount);

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
        await sleep(i === 0 ? FIRST_STOP : NEXT_STOP);
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

function buildOptions() {
    optionsEl.replaceChildren();
    for (const root of Data.roots) {
        if (NEVER.has(root.name)) continue;
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
    loadClips();
    playIntro();
    countEl.min = MIN_SLOTS;
    countEl.max = MAX_SLOTS;
    countEl.value = slotCount;
    await loadData();
    categoriesOf = indexCategories();
    buildSlots();
    buildOptions();
    updatePool();
    preloadIcons();
}

start();
