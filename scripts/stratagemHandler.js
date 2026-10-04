// One stratagem at a time, endless: show its code, let the player navigate the
// tree to find it, flash the tile, then deal the next one.

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
// them can repeat. The bag refills (and reshuffles) once it runs dry, so a repeat
// is still possible across the cycle boundary - just never back to back.
let bag = [];

function dealable() {
    return Data.stratagems.filter(s => !s.disabled);
}

function refillBag() {
    bag = shuffle(dealable().map(s => s.id));
}

function drawStratagem() {
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
    revealed = false;
    target = drawStratagem();
    renderCode(target);
    navigate([]);
    locked = false;
    accepting = true;
}

// A wrong click rules out exactly the stratagem that was clicked, and rewinds
// to the deepest point where the player's branch was still correct — the
// longest common prefix of where they are and where the answer is. Being on
// the right branch already means no movement.
function registerMiss(id) {
    misses++;
    setMisses();
    eliminated.add(id);

    const path = Data.pathOf[target.id] || [];
    const shared = [];
    for (let i = 0; i < Math.min(currentPath.length, path.length); i++) {
        if (currentPath[i] !== path[i]) break;
        shared.push(currentPath[i]);
    }

    if (shared.length !== currentPath.length) {
        // Pushed out of a branch that cannot contain the answer. Everything
        // from the leaf up to - but not including - where we land is dead.
        for (let i = shared.length; i < currentPath.length; i++) {
            deadFolders.add(pathKey(currentPath.slice(0, i + 1)));
        }
        navigate(shared);
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
        registerMiss(id);
        return;
    }

    accepting = false;
    locked = true;
    flash(tile, "correct", 500);
    playSfx("correct");
    // A revealed round was already given up — no streak credit for walking a
    // path that was handed to you.
    if (!revealed) {
        streak++;
        setStreak();
    }

    await sleep(600);
    await nextStratagem();
}