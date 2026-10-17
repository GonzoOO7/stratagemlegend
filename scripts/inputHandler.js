// Game navigation on the stratagem ring chart (wheel.js): the current folder is
// the hub, everything below it the rings around it. Click a folder to open it,
// a stratagem to answer, the hub (or Backspace / Escape) to go back up. The
// breadcrumb sits top-left; mouse wheel zooms, dragging pans.
//
// Every stratagem below the current folder is on screen at once, so the answer
// can be clicked from higher up - opening folders just makes the cells bigger.

const wheel = document.getElementById("wheel");
const crumbs = document.getElementById("crumbs");
const tips = Wheel.tooltip(document.getElementById("tip"), {codes: false});
const zoom = Wheel.zoomable(wheel, {onPanStart: () => tips.hide()});

let currentPath = [];   // [] == root
let locked = false;     // true while the correct answer animation plays

// Stratagem ids disproven this round. Clicking one only rules out that one -
// a folder is never disproven, so the player stays put and keeps every option.
let eliminated = new Set();

// Folders the player was pushed out of after guessing a wrong branch. Only
// populated when a rewind actually happens, so wandering off by accident does
// not rule out a section you merely dipped into.
let deadFolders = new Set();

const pathKey = path => path.join(">");

let root = null;
let drawn = null;       // what Wheel.render returned for the current folder

// --- rendering ---------------------------------------------------------------

function renderBreadcrumb() {
    crumbs.replaceChildren();
    const trail = [{name: "Stratagem Legend", path: []}];
    currentPath.forEach((name, i) => trail.push({name, path: currentPath.slice(0, i + 1)}));
    trail.forEach((step, i) => {
        if (i) crumbs.appendChild(el("span", "sep", {textContent: "›"}));
        const crumb = el("span", "crumb", {textContent: step.name});
        if (i < trail.length - 1) crumb.addEventListener("click", () => activate(() => navigate(step.path)));
        crumbs.appendChild(crumb);
    });
}

// Every click is acknowledged with the arrow-complete sound; correct
// stratagems add the completion sound on top (from answer()). Nothing reacts
// during the correct-answer animation, or to the click that ends a pan.
function activate(fn) {
    if (locked || zoom.justDragged) return;
    playSfx("click");
    fn();
}

function renderScreen() {
    if (!root) root = Wheel.buildRoot();
    const focus = Wheel.find(root, currentPath);
    drawn = Wheel.render(focus, {
        folder: node => activate(() => navigate(node.path)),
        stratagem: (id, cell) => activate(() => answer(id, cell)),
        enter: (info, event) => {
            if (!zoom.dragging) tips.show(info, event);
        },
        move: tips.move,
        leave: tips.hide
    });

    // The hub is the Back tile; at the root it sits there dead.
    const hub = Wheel.folderHub(focus, !currentPath.length);
    if (currentPath.length) {
        hub.addEventListener("click", () => activate(() => navigate(currentPath.slice(0, -1))));
    }
    drawn.marks.appendChild(hub);

    wheel.replaceChildren(Wheel.svgEl("g", {class: "scene"}, [drawn.cells, drawn.marks]));
    zoom.reset();
    applyEliminated();
    applyTrace();
}

// A dead folder takes its whole subtree with it.
function isDeadFolder(path) {
    const key = pathKey(path);
    for (const dead of deadFolders) {
        if (key === dead || key.startsWith(dead + ">")) return true;
    }
    return false;
}

// A class on a cell also goes on its icon, which lives on the layer above.
function mark(elm, cls, on) {
    elm.classList.toggle(cls, on);
    if (elm.icon) elm.icon.classList.toggle(cls, on);
}

// Dim what is ruled out: stratagems clicked wrong, every folder the player
// was pushed out of - with everything inside it, subfolders and stratagems
// alike - and everything outside the folder the answer is known to be in
// (outsideKnown, stratagemHandler.js). Still clickable. Called after every render AND after a miss that did
// not navigate, so the state never drifts from the sets.
function applyEliminated() {
    if (!drawn) return;
    for (const cell of drawn.stratagems) {
        mark(cell, "eliminated", eliminated.has(cell.info.id) || isDeadFolder(cell.info.path)
            || outsideKnown(cell.info.path, cell.info.id));
    }
    for (const [key, elms] of drawn.folders) {
        const path = key.split(">");
        const dead = isDeadFolder(path) || outsideKnown(path);
        for (const elm of elms) mark(elm, "eliminated", dead);
    }
}

// Only a real change of folder rebuilds the wheel (and replays its grow-in
// animation, and resets zoom and pan). Staying where it is - a Reveal or a
// miss that needs no rewind, a new round already at the root - keeps the
// wheel as it is and only redraws the round's marks: no flash.
function navigate(path) {
    const same = drawn && pathKey(path) === pathKey(currentPath);
    currentPath = path;
    tips.hide();
    if (same) {
        refreshMarks();
        return;
    }
    renderBreadcrumb();
    renderScreen();
}

// The round's marks on the wheel as drawn: greyed out, and the Reveal outline
// (cleared first - a new round starts without it).
function refreshMarks() {
    for (const cell of drawn.cells.querySelectorAll(".traced")) cell.classList.remove("traced");
    applyEliminated();
    applyTrace();
}

// After a Reveal the whole route below the current folder is outlined in
// white - every folder on the way and the answer itself, since all of it is
// on screen at once. Off the route, nothing is marked.
function applyTrace() {
    if (!drawn || !revealed || !target) return;
    const path = Data.pathOf[target.id] || [];
    if (currentPath.length > path.length) return;
    if (currentPath.some((name, i) => name !== path[i])) return;

    const route = [];
    for (let n = currentPath.length + 1; n <= path.length; n++) {
        const elms = drawn.folders.get(pathKey(path.slice(0, n))) || [];
        route.push(...elms.filter(elm => elm.classList.contains("cell")));
    }
    const key = pathKey(path);
    route.push(...drawn.stratagems.filter(
        cell => cell.info.id === target.id && pathKey(cell.info.path) === key
    ));
    for (const elm of route) {
        elm.classList.add("traced");
        elm.parentNode.appendChild(elm);    // on top, so the outline isn't covered
    }
}

function flash(cell, className, ms) {
    cell.classList.add(className);
    setTimeout(() => cell.classList.remove(className), ms);
}

// Keys go up a level too - no pan involved, so only the answer animation blocks.
document.addEventListener("keydown", event => {
    if (event.key !== "Backspace" && event.key !== "Escape") return;
    event.preventDefault();
    if (locked || !currentPath.length) return;
    playSfx("click");
    navigate(currentPath.slice(0, -1));
});
