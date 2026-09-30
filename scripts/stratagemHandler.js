// One stratagem at a time, endless: show its code, let the player navigate the
// tree to find it, flash the tile, then deal the next one.

const codeBoard = document.getElementById("code");
const streakEl = document.getElementById("streak");
const missesEl = document.getElementById("misses");

let target = null;
let streak = 0;
let accepting = false;
let misses = 0;

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
    target = randomItem(Data.stratagems);
    renderCode(target);
    navigate([]);
    locked = false;
    accepting = true;
}

// A wrong click rewinds to the deepest point where the player's branch was still
// correct - the longest common prefix of where they are and where the answer is.
// Being on the right branch already means no movement.
function registerMiss() {
    misses++;
    setMisses();

    const path = Data.pathOf[target.id] || [];
    const shared = [];
    for (let i = 0; i < Math.min(currentPath.length, path.length); i++) {
        if (currentPath[i] !== path[i]) break;
        shared.push(currentPath[i]);
    }

    if (shared.length !== currentPath.length) navigate(shared);
}

async function answer(id, tile) {
    if (!accepting) return;

    if (id !== target.id) {
        flash(tile, "failed", 400);
        playSfx("wrong");
        streak = 0;
        setStreak();
        registerMiss();
        return;
    }

    accepting = false;
    locked = true;
    flash(tile, "correct", 500);
    playSfx("correct");
    streak++;
    setStreak();

    await sleep(600);
    await nextStratagem();
}