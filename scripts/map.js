// The code map, as a fractal: a square split 3x3, and the four edge cells are
// the four arrows -
//     . w .
//     a . d
//     . s .
// Each of those cells is the same again, one third the size, for the next
// arrow - so the way into a cell is a code. A cell whose way is a whole
// stratagem code is that stratagem's icon; a cell no code goes through stays
// empty. Deeper cells sit on top of the ones they are in and get lighter.
// The corners are never used, so each cell is drawn as a cross - the middle
// and its four arms - and the next level's crosses sit in its arms.
//
// With "collapse" on, an arrow that has no other way beside it (no fork) gets
// no cell of its own: the next cell takes the whole space instead of a
// third of it. So a run of arrows without a crossing is one step, and a
// code's tail after its last fork lands as one big icon. The readout shows the
// skipped arrows dimmed.
//
// Click a cell to zoom in on it, Escape to step back out one level. Hover an
// icon for its name and code. Wheel to zoom, drag to pan.

const svg = document.getElementById("map");
const tip = document.getElementById("tip");
const readout = document.getElementById("where");
const collapseBox = document.getElementById("collapse");
const hoverBox = document.getElementById("hover");
const {svgEl} = Wheel;
const tips = Wheel.tooltip(tip, {codes: true});
// Deep zoom: a 9-arrow code is 3^9 times smaller than the whole map.
const zoom = Wheel.zoomable(svg, {onPanStart: () => tips.hide(), minWidth: 0.02});

const SIZE = 640;           // the whole map, in SVG units, centred on 0 0
const STORE = "stratagemlegend.map";

// Where each arrow's cell sits in the 3x3, as a step from the middle.
const DIR = {w: [0, -1], a: [-1, 0], d: [1, 0], s: [0, 1]};

const cells = new Map();    // prefix -> {x, y, size} (collapsed prefixes have none)
let focus = "";             // the cell zoomed in on last

// The colour of a cell by how deep it is: the root is the site's panel blue
// (#1b2a4d), each level inward a little lighter - big steps first, smaller ones
// deeper in. It never gets past ~38% lightness, so the icons (blue ones
// especially) stay readable deep inside.
const shade = depth => `hsl(222 ${48 - depth * 3}% ${(20 + 18 * (1 - 0.7 ** depth)).toFixed(1)}%)`;

// A code as arrow images; `skipped` are the indexes of the arrows collapsed on
// the way (shown dimmed).
function arrowImgs(code, skipped = new Set()) {
    return [...code].map((k, i) => {
        const img = document.createElement("img");
        img.src = Sprites.arrows[k];
        img.alt = k;
        if (skipped.has(i)) img.className = "skipped";
        return img;
    });
}

// A cell's cross: the middle third of its box both ways, one path.
function crossPath({x, y, width: w}) {
    const t = w / 3;
    return `M${x + t} ${y}h${t}v${t}h${t}v${t}h${-t}v${t}h${-t}v${-t}h${-t}v${-t}h${t}z`;
}

const stratagemCount = n => n === 1 ? "1 stratagem" : `${n} stratagems`;

// The legend readout: the code of the square or icon under the pointer.
function showWhere(prefix, count, skipped) {
    readout.replaceChildren(...arrowImgs(prefix, skipped));
    if (count !== undefined) {
        const n = document.createElement("span");
        n.textContent = stratagemCount(count);
        readout.appendChild(n);
    }
}

// The hover card for a square: its code and how many stratagems are in it
// (the icons get the full card from Wheel.tooltip).
function showSquareTip(prefix, count, skipped, event) {
    const code = document.createElement("div");
    code.className = "code";
    code.append(...arrowImgs(prefix, skipped));
    const n = document.createElement("div");
    n.className = "count";
    n.textContent = stratagemCount(count);
    const text = document.createElement("div");
    text.className = "text";
    text.append(...(prefix ? [code, n] : [n]));
    tip.replaceChildren(text);
    tip.hidden = false;
    tips.move(event);
}

function build() {
    tips.hide();
    cells.clear();
    const collapse = collapseBox.checked;
    const drawn = new Map(Data.stratagems.map(s => [s.code, s]));     // code -> stratagem

    // Every prefix of a code is a cell; count what lies below each.
    const below = new Map([["", 0]]);
    for (const code of drawn.keys()) {
        for (let n = 0; n <= code.length; n++) {
            const prefix = code.slice(0, n);
            below.set(prefix, (below.get(prefix) || 0) + 1);
        }
    }

    const scene = svgEl("g", {class: "scene"});

    const ways = prefix => Object.keys(DIR).filter(key => below.has(prefix + key));

    // Depth first, parents before children: each cell is drawn on top of the
    // one it sits in. `depth` counts the squares nested so far (with collapse
    // that is less than the arrows), `skipped` the arrows collapsed on the way.
    function draw(prefix, x, y, size, depth, skipped) {
        if (collapse && prefix !== "") {
            skipped = new Set(skipped);
            let next;
            while (!drawn.has(prefix) && (next = ways(prefix)).length === 1) {
                skipped.add(prefix.length);
                prefix += next[0];
            }
        }
        const box = {x: x - size / 2, y: y - size / 2, width: size, height: size};
        cells.set(prefix, {x, y, size});
        const s = drawn.get(prefix);

        if (s) {
            // The icon at 0 0 in its own 21x21 pixels (19px art and a 1px
            // transparent margin, so neighbours never touch), placed by a transform:
            // Firefox rounds an <image>'s x/y/size to 1/60 of a unit, which at
            // deep zoom (cells far below 1 unit) shifts it off its cell by
            // whole screen pixels. A transform is not rounded.
            const art = 21;
            const place = svgEl("g", {
                transform: `translate(${box.x} ${box.y}) scale(${size / art})`
            });
            const pixels = {x: 0, y: 0, width: art, height: art};
            const icon = svgEl("image", {class: "strat", href: stratagemIcon(s.id), ...pixels});
            place.appendChild(icon);
            const info = {id: s.id, path: Data.pathOf[s.id] || []};
            icon.addEventListener("mouseenter", e => {
                showWhere(s.code, undefined, skipped);
                if (hoverBox.checked && !zoom.dragging) tips.show(info, e);
            });
            icon.addEventListener("mousemove", tips.move);
            icon.addEventListener("mouseleave", () => {
                tips.hide();
            });
            icon.addEventListener("click", () => zoomIn(prefix));
            scene.appendChild(place);
            return;
        }

        // the root too: the whole map is one cross
        const rect = svgEl("path", {class: "cell", fill: shade(depth), d: crossPath(box)});
        rect.addEventListener("mouseenter", e => {
            showWhere(prefix, below.get(prefix), skipped);
            if (hoverBox.checked && !zoom.dragging) showSquareTip(prefix, below.get(prefix), skipped, e);
        });
        rect.addEventListener("mousemove", tips.move);
        rect.addEventListener("mouseleave", () => tips.hide());
        rect.addEventListener("click", () => zoomIn(prefix));
        scene.appendChild(rect);
        const third = size / 3;
        for (const key of ways(prefix)) {
            const [dx, dy] = DIR[key];
            draw(prefix + key, x + dx * third, y + dy * third, third, depth + 1, skipped);
        }
    }

    draw("", 0, 0, SIZE, 0, new Set());
    svg.replaceChildren(scene);
    focus = "";
    showWhere("", below.get(""));
}

function zoomIn(prefix) {
    if (zoom.justDragged) return;
    const cell = cells.get(prefix);
    if (!cell) return;
    focus = prefix;
    if (prefix === "") zoom.reset();
    else zoom.zoomTo(cell.x, cell.y, cell.size * 1.25);
}

document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || focus === "") return;
    let up = focus.slice(0, -1);
    while (!cells.has(up)) up = up.slice(0, -1);     // past collapsed arrows
    zoomIn(up);
});

// --- the options ------------------------------------------------------------------

// collapse: arrows without a fork get no cell of their own (rebuilds the map);
// hover: the card at the cursor and the icons lighting up (the legend readout
// stays either way).
function savePrefs() {
    try {
        localStorage.setItem(STORE, JSON.stringify({collapse: collapseBox.checked, hover: hoverBox.checked}));
    } catch {
        // storage blocked: the choice just won't survive a reload
    }
}

function applyHover() {
    svg.classList.toggle("no-hover", !hoverBox.checked);
    if (!hoverBox.checked) tips.hide();
}

collapseBox.addEventListener("change", () => {
    savePrefs();
    zoom.reset();
    build();
});

hoverBox.addEventListener("change", () => {
    savePrefs();
    applyHover();
});

try {
    const saved = JSON.parse(localStorage.getItem(STORE)) || {};
    if (typeof saved.collapse === "boolean") collapseBox.checked = saved.collapse;
    if (typeof saved.hover === "boolean") hoverBox.checked = saved.hover;
} catch {
    // unreadable or blocked storage: the defaults (both on, from map.html)
}
applyHover();

loadData().then(build);
