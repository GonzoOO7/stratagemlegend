// Tree navigation: renders the breadcrumb and the current folder's contents,
// and handles activating tiles — by click, or by keyboard (WASD to move the
// selection, Space to confirm).

const screen = document.getElementById("screen");
const breadcrumb = document.getElementById("breadcrumb");

let currentPath = [];   // [] == root
let locked = false;     // true while the correct answer animation plays
let selectable = [];    // tiles in visual order, for keyboard movement
let folderPaths = [];   // child paths, index-aligned with the folder tiles
let selectedIndex = 0;
let keyboardMode = false;   // outline only shows once WASD is used

// Stratagem ids disproven this round. Clicking one only rules out that one —
// a folder is never disproven, so the player stays put and keeps every option.
let eliminated = new Set();

// Folders the player was pushed out of after guessing a wrong branch. Only
// populated when a rewind actually happens, so wandering off by accident does
// not rule out a section you merely dipped into.
let deadFolders = new Set();

const pathKey = path => path.join(">");

// --- rendering ---------------------------------------------------------------

function renderBreadcrumb() {
    breadcrumb.replaceChildren();

    const rootCrumb = el("span", "crumb root", {textContent: "Stratagem Legend"});
    rootCrumb.addEventListener("click", () => navigate([]));
    breadcrumb.appendChild(rootCrumb);

    let acc = [];
    for (const name of currentPath) {
        acc = [...acc, name];
        const target = [...acc];
        const sep = el("span", "sep", {textContent: "›"});
        const crumb = el("span", "crumb", {textContent: name});
        crumb.addEventListener("click", () => navigate(target));
        breadcrumb.append(sep, crumb);
    }
}

function addTile(tile, onActivate) {
    tile.addEventListener("click", () => {
        if (!locked) onActivate();
    });
    screen.appendChild(tile);
    selectable.push(tile);
}

function renderScreen() {
    const node = nodeChildren(currentPath);
    screen.replaceChildren();
    selectable = [];
    folderPaths = [];

    const subcategories = nodeSubcategories(node);
    const stratagemIds = nodeStratagems(node);

    // "cd .." — one level up, only once there is somewhere to go. Sits as the
    // first tile of the top row, alongside the category tiles.
    if (currentPath.length) {
        const up = [...currentPath.slice(0, -1)];
        addTile(el("div", "tile nav", {title: "Back"}, [
            el("img", "", {src: Paths.ui + "back.png", alt: "Back"}),
            el("span", "label", {textContent: "Back"})
        ]), () => navigate(up));
    }

    for (const sub of subcategories) {
        const childPath = [...currentPath, sub.name];
        folderPaths.push(childPath);
        addTile(el("div", "tile folder", {title: sub.name}, [
            el("img", "", {src: Paths.categories + categoryIconPath(childPath), alt: ""}),
            el("span", "label", {textContent: sub.name})
        ]), () => navigate(childPath));
    }

    // Only worth drawing when the view actually holds both kinds.
    if (subcategories.length && stratagemIds.length) {
        screen.appendChild(el("div", "separator"));
    }

    for (const id of stratagemIds) {
        const stratagem = Data.byId[id];
        const label = (stratagem.prefix ? stratagem.prefix + " " : "") + stratagem.name;
        const tile = el("div", "tile stratagem", {title: stratagem.name}, [
            el("img", "", {src: stratagemIcon(id), alt: ""}),
            el("span", "label", {textContent: label})
        ]);
        tile.dataset.id = id;
        addTile(tile, () => answer(id, tile));
    }

    // Remember where WASD movement starts from — the first real tile, never the
    // Back row. The outline stays hidden until a key is actually pressed.
    selectedIndex = Math.max(0, selectable.findIndex(t => !t.classList.contains("nav")));
    applyEliminated();
    applyTrace();
    paintSelection();
}

// A dead folder takes its whole subtree with it.
function isDeadFolder(path) {
    const key = pathKey(path);
    for (const dead of deadFolders) {
        if (key === dead || key.startsWith(dead + ">")) return true;
    }
    return false;
}

// Apply the dimming to whatever is on screen. Called after every render AND
// after a miss that did not navigate, so the state never drifts from the sets.
function applyEliminated() {
    screen.querySelectorAll(".tile.stratagem").forEach(tile => {
        tile.classList.toggle("eliminated", eliminated.has(tile.dataset.id));
    });
    screen.querySelectorAll(".tile.folder").forEach((tile, i) => {
        tile.classList.toggle("eliminated", isDeadFolder(folderPaths[i]));
    });
}

function navigate(path) {
    currentPath = path;
    renderBreadcrumb();
    renderScreen();
}

// After a Reveal, the next node on the route to the answer is outlined in white.
// It follows the player down: each render outlines the child they should enter
// next, until the view holds the answer itself. Nothing off the route — and
// nothing at all once the player wanders off it — is marked.
function applyTrace() {
    if (!revealed || !target) return;

    const path = Data.pathOf[target.id] || [];
    // Only while the player is on the route, or still above it.
    if (currentPath.length > path.length) return;
    if (currentPath.some((name, i) => name !== path[i])) return;

    let tile = null;
    if (currentPath.length === path.length) {
        tile = screen.querySelector(`.tile.stratagem[data-id="${target.id}"]`);
    } else {
        // folderPaths is index-aligned with the folder tiles, and each entry is
        // the current path plus one name, so only the last one has to match.
        const next = path[currentPath.length];
        const index = folderPaths.findIndex(
            p => p.length === currentPath.length + 1 && p[p.length - 1] === next
        );
        if (index >= 0) tile = screen.querySelectorAll(".tile.folder")[index];
    }

    if (tile) tile.classList.add("traced");
}

function flash(tile, className, ms) {
    tile.classList.add(className);
    setTimeout(() => tile.classList.remove(className), ms);
}

// --- keyboard ----------------------------------------------------------------

function paintSelection() {
    selectable.forEach((tile, i) => {
        tile.classList.toggle("selected", keyboardMode && i === selectedIndex);
    });
}

function select(index) {
    const tile = selectable[index];
    if (!tile) return;
    selectedIndex = index;
    paintSelection();
    tile.scrollIntoView({block: "nearest"});
}

// Tiles sharing an offsetTop are on the same visual row.
function rowTiles(top) {
    return selectable
        .filter(tile => tile.offsetTop === top)
        .sort((a, b) => a.offsetLeft - b.offsetLeft);
}

function rowTops() {
    return [...new Set(selectable.map(tile => tile.offsetTop))].sort((a, b) => a - b);
}

// Move to the closest tile in a direction, using real geometry so that wrapped
// rows and the Back tile are handled correctly. Horizontal movement wraps: past
// the right edge drops to the next row, past the left edge climbs to the
// previous one.
function moveSelection(dx, dy) {
    if (!selectable.length) return;
    const from = selectable[selectedIndex];

    if (dy !== 0) {
        const fTop = from.offsetTop;
        const fLeft = from.offsetLeft;
        let best = -1;
        let bestScore = Infinity;
        selectable.forEach((tile, i) => {
            if (i === selectedIndex) return;
            const dTop = tile.offsetTop - fTop;
            const dLeft = tile.offsetLeft - fLeft;
            const along = dTop * dy;
            if (along <= 0) return;
            const score = along + Math.abs(dLeft) * 2;
            if (score < bestScore) {
                bestScore = score;
                best = i;
            }
        });
        if (best >= 0) select(best);
        return;
    }

    const row = rowTiles(from.offsetTop);
    const neighbour = row[row.indexOf(from) + dx];
    if (neighbour) {
        select(selectable.indexOf(neighbour));
        return;
    }

    // At the edge of the row — wrap to the adjacent one.
    const tops = rowTops();
    const nextTop = tops[tops.indexOf(from.offsetTop) + dx];
    if (nextTop === undefined) return;
    const nextRow = rowTiles(nextTop);
    if (!nextRow.length) return;
    select(selectable.indexOf(dx > 0 ? nextRow[0] : nextRow[nextRow.length - 1]));
}

document.addEventListener("keydown", event => {
    if (locked || event.ctrlKey || event.metaKey || event.altKey) return;

    // Only when nothing is focused, so form fields keep their own keys.
    const active = document.activeElement;
    if (active && active !== document.body) return;

    switch (event.key) {
        case "w": case "W": keyboardMode = true; moveSelection(0, -1); break;
        case "s": case "S": keyboardMode = true; moveSelection(0, 1); break;
        case "a": case "A": keyboardMode = true; moveSelection(-1, 0); break;
        case "d": case "D": keyboardMode = true; moveSelection(1, 0); break;
        case " ":
            event.preventDefault();               // don't scroll the page
            selectable[selectedIndex]?.click();
            break;
        default: return;
    }
});

// Moving the mouse hands control back — the keyboard outline disappears.
document.addEventListener("mousemove", () => {
    if (!keyboardMode) return;
    keyboardMode = false;
    paintSelection();
});