// One stratagem at a time, endless: show its code, let the player find it on
// the wheel, flash its cell, then deal the next one.

const codeBoard = document.getElementById("code");
const streakEl = document.getElementById("streak");
const missesEl = document.getElementById("misses");
const revealBtn = document.getElementById("reveal");

let target = null;
let streak = 0;
let accepting = false;
let misses = 0;

// Reveal gives up the answer: pay the penalty, drop to the nearest common
// ancestor of where the player is and where the answer lives, and outline the
// next node of the route. Nothing is selected and nothing is flashed — the
// outline is the only feedback, and it persists through every render so the
// whole path can be traced by hand. The round then waits for the player to click
// the target, and wrong clicks still cost a miss on top of the reveal.
let revealed = false;

// Draw without replacement: every enabled stratagem comes up once before any of
// them can repeat. The bag refills (and reshuffles) once it runs dry.
//
// The bag survives a reload: it is saved with the stratagem on screen, and a
// reload brings that same round back - a stratagem never answered is not done.
// Stratagems added to the data later join at the next refill.
const BAG_STORE = "stratagemlegend.bag";
let bag = [];
let bagLoaded = false;
let resumed = null;         // the round that was on screen when the page was left

// Where the answer must be, as far as the misses have told: the deepest folder
// known to hold it ([] = nothing known yet). Everything outside it is greyed.
let knownFolder = [];
let places = [];            // every folder path the target is filed under

function dealable() {
    return Data.stratagems.filter(s => !s.disabled);
}

function refillBag() {
    bag = shuffle(dealable().map(s => s.id));
}

function loadBag() {
    bagLoaded = true;
    try {
        const saved = JSON.parse(localStorage.getItem(BAG_STORE));
        const known = new Set(dealable().map(s => s.id));
        if (saved && Array.isArray(saved.bag)) bag = saved.bag.filter(id => known.has(id));
        if (saved && known.has(saved.current)) resumed = saved.current;
    } catch {
        // unreadable or blocked storage: start a fresh cycle
    }
}

function saveBag() {
    try {
        localStorage.setItem(BAG_STORE, JSON.stringify({bag, current: target ? target.id : null}));
    } catch {
        // storage blocked: the cycle just won't survive a reload
    }
}

function drawStratagem() {
    if (!bagLoaded) loadBag();
    if (resumed) {
        const id = resumed;
        resumed = null;
        return Data.byId[id];
    }
    if (bag.length === 0) refillBag();
    return Data.byId[bag.shift()];
}

function renderCode(stratagem) {
    codeBoard.replaceChildren();
    for (const key of stratagem.code) {
        codeBoard.appendChild(el("img", "", {src: Sprites.arrows[key], alt: key}));
    }
}

function setStreak() {
    streakEl.textContent = streak;
}

function setMisses() {
    missesEl.textContent = misses;
}

async function nextStratagem() {
    locked = true;
    accepting = false;
    misses = 0;
    setMisses();
    eliminated.clear();
    deadFolders.clear();
    knownFolder = [];
    revealed = false;
    target = drawStratagem();
    saveBag();
    places = targetPaths();
    renderCode(target);
    navigate([]);
    locked = false;
    accepting = true;
}

// Every folder path the target is filed under - a few stratagems sit in two.
function targetPaths() {
    const paths = [];
    (function walk(nodes, path) {
        for (const node of nodes) {
            const here = [...path, node.name];
            if ((node.stratagemIds || []).includes(target.id)) paths.push(here);
            if (node.subcategories) walk(node.subcategories, here);
        }
    })(Data.roots, []);
    return paths;
}

// `path` is the folder `folder` or inside it.
const inside = (path, folder) => folder.every((name, i) => path[i] === name);

// Does the folder at `path` (or anything inside it) hold the answer?
function holdsTarget(path) {
    return places.some(p => inside(p, path));
}

// The deepest folder along `path` that still holds the answer.
function deepestHolding(path) {
    let n = path.length;
    while (n > 0 && !holdsTarget(path.slice(0, n))) n--;
    return path.slice(0, n);
}

// Ruled out because the answer is known to be elsewhere: outside the known
// folder - unless it holds the answer itself (a stratagem filed in two places
// keeps both; the folders above the known one hold it anyway). A stratagem
// cell sits at its folder's path; `id` tells it from a folder.
function outsideKnown(path, id) {
    if (!knownFolder.length || !target) return false;
    if (inside(path, knownFolder)) return false;
    return id ? id !== target.id : !holdsTarget(path);
}

// Grey out a branch the answer is not in: the outermost folder along `path`
// that does not hold it - its whole subtree goes with it. From the root that
// is the very category the player went into, unless the answer is in there too;
// then the subfolder one level down, and so on.
function killBranch(path) {
    for (let n = 1; n <= path.length; n++) {
        if (!holdsTarget(path.slice(0, n))) {
            deadFolders.add(pathKey(path.slice(0, n)));
            return;
        }
    }
}

// A wrong click rules out the stratagem, greys out the branch it was picked
// from - on the wheel that can be deep inside, straight from the root - and the
// branch the player had opened, and rewinds to the deepest folder of theirs
// that still holds the answer. Being on the right branch already means no
// movement.
//
// The miss also tells where the answer must be: in that folder the rewind
// lands on, and in the deepest folder the wrong pick shares with the answer.
// The deepest of those (and of what earlier misses told) becomes the known
// folder; everything outside it is greyed too.
function registerMiss(id, cell) {
    misses++;
    setMisses();
    eliminated.add(id);

    if (cell && cell.info) killBranch(cell.info.path);
    killBranch(currentPath);

    const back = deepestHolding(currentPath);
    const told = [back, cell && cell.info ? deepestHolding(cell.info.path) : []];
    for (const folder of told) {
        if (folder.length > knownFolder.length) knownFolder = folder;
    }

    if (back.length !== currentPath.length) {
        navigate(back);
    } else {
        applyEliminated();   // stay put, but the new dimming must show
    }
}

// Reveal gives up the answer: pay the penalty, drop to the nearest common
// ancestor of where the player is and where the answer lives, and outline the
// next node of the route. Nothing is selected and nothing is flashed — the
// outline is the only feedback, and it persists through every render so the
// whole path can be traced by hand. The round then waits for the player to click
// the target.
async function revealSolution() {
    if (!accepting) return;    accepting = false;
    revealed = true;

    streak = 0;
    misses++;
    setStreak();
    setMisses();

    const path = Data.pathOf[target.id] || [];
    let shared = 0;
    while (shared < currentPath.length && shared < path.length
           && currentPath[shared] === path[shared]) {
        shared++;
    }
    navigate(path.slice(0, shared));
}

revealBtn.addEventListener("click", () => {
    if (!locked) revealSolution();
});

async function answer(id, tile) {
    if (!accepting && !revealed) return;

    if (id !== target.id) {
        flash(tile, "failed", 400);
        playSfx("wrong");
        streak = 0;
        setStreak();
        registerMiss(id, tile);
        return;
    }

    accepting = false;
    locked = true;
    flash(tile, "correct", 500);
    // The click sound is still ringing; let the completion land on top of it.
    setTimeout(() => playSfx("correct"), 120);
    // A revealed round was already given up — no streak credit for walking a
    // path that was handed to you.
    if (!revealed) {
        streak++;
        setStreak();
    }

    await sleep(600);
    await nextStratagem();
}