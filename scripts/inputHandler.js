// Tree navigation: renders the breadcrumb and the current folder's contents,
// and handles activating tiles — by click, or by keyboard (WASD to move the
// selection, Space to confirm).

const screen = document.getElementById("screen");
const breadcrumb = document.getElementById("breadcrumb");

let currentPath = [];   // [] == root
let locked = false;     // true while the correct answer animation plays
let selectable = [];    // tiles in visual order, for keyboard movement
let selectedIndex = 0;

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
        addTile(tile, () => answer(id, tile));
    }

    // Start on the first real tile, never the Back row — so that landing in a
    // folder and mashing Space does not immediately leave it again.
    select(selectable.findIndex(t => !t.classList.contains("nav")));
}

function navigate(path) {
    currentPath = path;
    renderBreadcrumb();
    renderScreen();
}

function flash(tile, className, ms) {
    tile.classList.add(className);
    setTimeout(() => tile.classList.remove(className), ms);
}

// --- keyboard ----------------------------------------------------------------

function select(index) {
    selectable.forEach(t => t.classList.remove("selected"));
    const tile = selectable[index];
    if (!tile) return;
    selectedIndex = index;
    tile.classList.add("selected");
    tile.scrollIntoView({block: "nearest"});
}

// Move to the closest tile in a direction, using real geometry so that wrapped
// rows and the full-width Back row are handled correctly.
function moveSelection(dx, dy) {
    if (!selectable.length) return;
    const from = selectable[selectedIndex];
    const fTop = from.offsetTop;
    const fLeft = from.offsetLeft;

    let best = -1;
    let bestScore = Infinity;
    selectable.forEach((tile, i) => {
        if (i === selectedIndex) return;
        const dTop = tile.offsetTop - fTop;
        const dLeft = tile.offsetLeft - fLeft;

        // Must be in the requested direction: 'up' means meaningfully higher,
        // etc. The perpendicular axis is scored, not filtered, so a row that
        // wraps still lets you move left/right along it.
        const along = dy !== 0 ? dTop * dy : dLeft * dx;
        const across = dy !== 0 ? Math.abs(dLeft) : Math.abs(dTop);
        if (along <= 0) return;

        const score = along + across * 2;
        if (score < bestScore) {
            bestScore = score;
            best = i;
        }
    });

    if (best >= 0) select(best);
}

document.addEventListener("keydown", event => {
    if (locked || event.ctrlKey || event.metaKey || event.altKey) return;

    // Only when nothing is focused, so form fields keep their own keys.
    const active = document.activeElement;
    if (active && active !== document.body) return;

    switch (event.key) {
        case "w": case "W": moveSelection(0, -1); break;
        case "s": case "S": moveSelection(0, 1); break;
        case "a": case "A": moveSelection(-1, 0); break;
        case "d": case "D": moveSelection(1, 0); break;
        case " ":
            event.preventDefault();               // don't scroll the page
            selectable[selectedIndex]?.click();
            break;
        default: return;
    }
});